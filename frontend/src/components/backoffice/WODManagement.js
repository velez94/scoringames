import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useParams } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import './Backoffice.css';

function WODManagement() {
  const { eventId } = useParams();
  const { user } = useAuthenticator((context) => [context.user]);
  const { selectedOrganization } = useOrganization();
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingWod, setEditingWod] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    format: 'AMRAP',
    timeLimit: '',
    categoryId: '',
    movements: [{ exerciseId: '', exercise: '', reps: '', weight: '' }],
    description: '',
    isShared: false,
    organizationId: ''
  });
  const [maxScore, setMaxScore] = useState(null);
  
  // Global advanced scoring system
  const globalScoringSystem = {
    type: 'advanced',
    config: {
      timeBonuses: { 1: 10, 2: 7, 3: 5 }
    }
  };

  const wodFormats = ['AMRAP', 'Chipper', 'EMOM', 'RFT', 'Ladder', 'Tabata'];

  useEffect(() => {
    fetchWods();
    fetchCategories();
    fetchExercises();
  }, [eventId]);

  useEffect(() => {
    calculateMaxScore();
  }, [formData.movements, exercises]);

  const fetchWods = async () => {
    try {
      let url = '/wods';
      if (eventId) {
        url += `?eventId=${eventId}&includeShared=true`;
      }
      const response = await API.get('CalisthenicsAPI', url);
      setWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      // Fetch both global and event-specific categories
      const [globalResponse, eventResponse] = await Promise.all([
        API.get('CalisthenicsAPI', '/categories?eventId=global'),
        eventId && eventId !== 'template' ? API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`) : Promise.resolve([])
      ]);
      
      // Combine and deduplicate categories
      const allCategories = [...(globalResponse || []), ...(eventResponse || [])];
      const uniqueCategories = allCategories.reduce((acc, category) => {
        if (!acc.find(c => c.categoryId === category.categoryId)) {
          acc.push(category);
        }
        return acc;
      }, []);
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchExercises = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/exercises');
      setExercises(response || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const calculateMaxScore = () => {
    if (!formData.movements.length || !exercises.length) {
      setMaxScore(null);
      return;
    }

    let totalEDS = 0;
    formData.movements.forEach(movement => {
      if (!movement.exerciseId) return;
      
      const exercise = exercises.find(e => e.exerciseId === movement.exerciseId);
      if (!exercise) return;

      const reps = parseInt(movement.reps) || 1;
      const weight = parseFloat(movement.weight) || 0;
      
      let eds = exercise.baseScore * reps;
      
      // Apply weight modifier
      exercise.modifiers?.forEach(mod => {
        if (mod.type === 'weight' && weight > 0) {
          eds += Math.floor(weight / mod.increment) * mod.points * reps;
        }
      });
      
      // Assume perfect EQS (5)
      totalEDS += eds * 5;
    });

    // Add max time bonus (1st place) from global system
    const timeBonus = globalScoringSystem.config.timeBonuses[1];
    
    setMaxScore({
      total: totalEDS + timeBonus,
      eds: totalEDS,
      timeBonus
    });
  };

  const handleCreate = () => {
    setEditingWod(null);
    setFormData({
      name: '',
      format: 'AMRAP',
      timeLimit: '',
      categoryId: '',
      movements: [{ exercise: '', reps: '', weight: '' }],
      description: '',
      isShared: false,
      organizationId: selectedOrganization?.organizationId || ''
    });
    setShowModal(true);
  };

  const handleEdit = (wod) => {
    setEditingWod(wod);
    
    // Map exercise names to exerciseId for form compatibility
    const mappedMovements = (wod.movements || []).map(movement => {
      const exercise = exercises.find(e => e.name === movement.exercise);
      return {
        exerciseId: exercise?.exerciseId || '',
        exercise: movement.exercise || '',
        reps: movement.reps || '',
        weight: movement.weight || ''
      };
    });
    
    setFormData({
      name: wod.name,
      format: wod.format,
      timeLimit: wod.timeLimit || '',
      categoryId: wod.categoryId || '',
      movements: mappedMovements.length > 0 ? mappedMovements : [{ exerciseId: '', exercise: '', reps: '', weight: '' }],
      description: wod.description || '',
      isShared: wod.isShared || false,
      organizationId: wod.organizationId || ''
    });
    setShowModal(true);
  };

  const canEditWod = (wod) => {
    // Super admin can edit any WOD except transversal templates
    if (user?.attributes?.email === 'admin@athleon.fitness') {
      return !wod.isTransversal;
    }
    
    // Can't edit transversal templates
    if (wod.isTransversal) {
      return false;
    }
    
    // Can't edit shared WODs from other users
    if (wod.isSharedWod) {
      return false;
    }
    
    // For template WODs, check organization ownership
    if (wod.eventId === 'template') {
      // If WOD has organizationId and user is in that organization, allow edit
      if (wod.organizationId && selectedOrganization?.organizationId === wod.organizationId) {
        return true;
      }
      // If no organizationId (global template), only super admin can edit
      if (!wod.organizationId) {
        return false;
      }
      return false;
    }
    
    // Can edit own WODs and organization WODs
    return true;
  };

  const canDeleteWod = (wod) => {
    // Super admin can delete any WOD
    if (user?.attributes?.email === 'admin@athleon.fitness') {
      return true;
    }
    
    // Can't delete global templates (eventId: 'template' and createdBy: 'system')
    if (wod.eventId === 'template' && wod.createdBy === 'system') {
      return false;
    }
    
    // Can't delete shared WODs from other users
    if (wod.isShared && wod.createdBy !== user?.attributes?.sub) {
      return false;
    }
    
    // Can delete own WODs
    return wod.createdBy === user?.attributes?.sub;
  };

  const handleDelete = async (wodId) => {
    if (!window.confirm('Are you sure you want to delete this WOD?')) {
      return;
    }

    try {
      await API.del('CalisthenicsAPI', `/wods/${wodId}`);
      fetchWods();
    } catch (error) {
      console.error('Error deleting WOD:', error);
      alert('Error deleting WOD');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const wodData = {
        ...formData,
        wodId: editingWod?.wodId || `wod-${Date.now()}`,
        createdAt: editingWod?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Determine eventId based on context
      if (editingWod) {
        // Editing existing WOD - preserve original context
        wodData.eventId = editingWod.eventId;
        wodData.organizationId = editingWod.organizationId;
        wodData.isTransversal = editingWod.isTransversal;
      } else if (!eventId) {
        // Creating new WOD without event context
        if (user?.attributes?.email === 'admin@athleon.fitness') {
          // Super admin can create transversal WODs
          wodData.eventId = 'transversal';
          wodData.isTransversal = true;
          wodData.isShared = true;
        } else if (selectedOrganization?.organizationId && selectedOrganization.organizationId !== 'all') {
          // Organization owner/admin creates organization template
          wodData.eventId = 'template';
          wodData.organizationId = selectedOrganization.organizationId;
        } else {
          // Fallback to template
          wodData.eventId = 'template';
        }
      } else {
        // Creating new WOD for specific event
        wodData.eventId = eventId;
      }

      console.log('Saving WOD data:', wodData);

      if (editingWod) {
        await API.put('CalisthenicsAPI', `/wods/${editingWod.wodId}`, { body: wodData });
      } else {
        await API.post('CalisthenicsAPI', '/wods', { body: wodData });
      }

      setShowModal(false);
      fetchWods();
    } catch (error) {
      console.error('Error saving WOD:', error);
      console.error('Error details:', error.response || error.message);
      
      // Extract error message from response
      let errorMessage = 'Unknown error occurred';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show user-friendly alert
      alert(`Error saving WOD: ${errorMessage}`);
    }
  };

  const addMovement = () => {
    setFormData(prev => ({
      ...prev,
      movements: [...prev.movements, { exerciseId: '', exercise: '', reps: '', weight: '' }]
    }));
  };

  const updateMovement = (index, field, value) => {
    setFormData(prev => {
      const newMovements = [...prev.movements];
      
      if (field === 'exerciseId') {
        const exercise = exercises.find(e => e.exerciseId === value);
        newMovements[index] = {
          ...newMovements[index],
          exerciseId: value,
          exercise: exercise?.name || ''
        };
      } else {
        newMovements[index][field] = value;
      }
      
      return { ...prev, movements: newMovements };
    });
  };

  const removeMovement = (index) => {
    setFormData(prev => ({
      ...prev,
      movements: prev.movements.filter((_, i) => i !== index)
    }));
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.categoryId === categoryId);
    return category?.name || 'No Category';
  };

  const filteredWods = wods.filter(wod => 
    wod.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wod.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wod.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateWodMaxScore = (wod) => {
    
    if (!wod.movements?.length) {
      return null;
    }
    
    if (!exercises.length) {
      return null;
    }

    let totalEDS = 0;
    const breakdown = [];
    
    wod.movements.forEach((movement, idx) => {
      
      // Match by exerciseId first, then by name (case-insensitive)
      const exercise = exercises.find(e => 
        e.exerciseId === movement.exerciseId || 
        e.name.toLowerCase() === movement.exercise?.toLowerCase()
      );
      
      if (!exercise) {
        return;
      }
      
      const reps = parseInt(movement.reps) || 1;
      const weight = parseFloat(movement.weight?.replace(/[^\d.]/g, '')) || 0;
      
      let eds = exercise.baseScore * reps;
      
      exercise.modifiers?.forEach(mod => {
        if (mod.type === 'weight' && weight > 0) {
          const bonus = Math.floor(weight / mod.increment) * mod.points * reps;
          eds += bonus;
        }
      });
      
      totalEDS += eds;
      breakdown.push({
        name: exercise.name,
        reps,
        weight,
        eds
      });
    });

    if (totalEDS === 0) {
      return null;
    }

    const totalScore = totalEDS * 5; // Perfect EQS
    const timeBonus = globalScoringSystem.config.timeBonuses[1];
    const maxScore = totalScore + timeBonus;
    
    return { maxScore, totalEDS, breakdown, timeBonus };
  };

  return (
    <div className="wod-management">
      <div className="page-header" style={{marginBottom: '30px'}}>
        <div>
          <h1 style={{margin: '0 0 10px 0'}}>{eventId ? 'WOD Management' : 'WOD Templates'}</h1>
          <p style={{margin: 0, color: '#666', fontSize: '14px'}}>
            {eventId ? 'Manage workouts for this event' : 'Create reusable WOD templates'}
          </p>
        </div>
        <button 
          onClick={handleCreate} 
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.25)'
          }}
        >
          + {eventId ? 'Create WOD' : 'Create Template'}
        </button>
      </div>

      <div style={{marginBottom: '20px'}}>
        <input
          type="text"
          placeholder="🔍 Search WODs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '12px 16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
        <div style={{marginTop: '10px', color: '#666', fontSize: '14px'}}>
          Showing {filteredWods.length} of {wods.length} WODs
        </div>
      </div>

      <div className="wods-grid">
        {filteredWods.map(wod => {
          const scoreData = calculateWodMaxScore(wod);
          
          return (
          <div key={wod.wodId} className="wod-card">
            <div className="wod-header">
              <h3>{wod.displayName || wod.name}</h3>
              <div className="wod-badges">
                <span className="format-badge">{wod.format}</span>
                {wod.isShared && <span className="shared-badge">Shared</span>}
                {wod.isTransversal && <span className="transversal-badge">Template</span>}
                {wod.isSharedWod && <span className="external-badge">External</span>}
              </div>
            </div>
            
            {scoreData && (
              <div style={{
                padding: '10px 12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '6px',
                marginBottom: '10px',
                fontSize: '12px'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <div style={{opacity: 0.85, fontSize: '11px', marginBottom: '2px'}}>Max Score (Perfect EQS)</div>
                    <div style={{fontSize: '20px', fontWeight: 'bold'}}>{scoreData.maxScore} pts</div>
                  </div>
                  <div style={{textAlign: 'right', fontSize: '11px', opacity: 0.9}}>
                    <div>EDS: {scoreData.totalEDS} × 5</div>
                    <div>Bonus: +{scoreData.timeBonus}</div>
                  </div>
                </div>
              </div>
            )}
            
            {wod.timeLimit && (
              <div className="time-limit">
                <strong>Time Limit:</strong> {wod.timeLimit}
              </div>
            )}

            <div className="category-info">
              <strong>Category:</strong> {getCategoryName(wod.categoryId)}
            </div>

            <div className="movements">
              <strong>Movements:</strong>
              {wod.movements?.map((movement, i) => (
                <div key={i} className="movement">
                  {movement.reps} {movement.exercise} {movement.weight && `(${movement.weight})`}
                </div>
              ))}
            </div>

            {wod.description && (
              <div className="wod-description">
                <strong>Description:</strong>
                <p>{wod.description}</p>
              </div>
            )}

            <div className="wod-actions">
              {canEditWod(wod) && (
                <button onClick={() => handleEdit(wod)} className="btn-outline">
                  Edit
                </button>
              )}
              {canDeleteWod(wod) && (
                <button onClick={() => handleDelete(wod.wodId)} className="btn-danger">
                  Delete
                </button>
              )}
              {wod.isSharedWod && (
                <span className="shared-info">
                  From: {wod.organizationName || wod.originalEventId}
                </span>
              )}
              {(wod.eventId === 'template' || wod.isTransversal) && !canEditWod(wod) && (
                <span className="template-info">
                  {wod.isTransversal 
                    ? 'Transversal Template - Read Only' 
                    : wod.organizationId 
                      ? 'Organization Template - Read Only'
                      : 'Global Template - Read Only'
                  }
                </span>
              )}
            </div>
          </div>
        );
        })}

        {filteredWods.length === 0 && wods.length > 0 && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '60px 20px',
            color: '#666'
          }}>
            <div style={{fontSize: '48px', marginBottom: '16px'}}>🔍</div>
            <h3 style={{margin: '0 0 8px 0'}}>No WODs found</h3>
            <p style={{margin: 0}}>Try adjusting your search terms</p>
          </div>
        )}

        {wods.length === 0 && (
          <div className="no-wods">
            <p>No {eventId ? 'WODs created yet' : 'templates found'}.</p>
            <button onClick={handleCreate} className="btn-primary">
              {eventId ? 'Create First WOD' : 'Create First Template'}
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal wod-modal">
            <h3>{editingWod ? 'Edit WOD' : 'Create New WOD'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>WOD Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              {!eventId && (
                <div className="form-group">
                  <label>Organization</label>
                  <select
                    value={formData.organizationId}
                    onChange={(e) => setFormData({...formData, organizationId: e.target.value})}
                    required
                  >
                    <option value="">Select Organization</option>
                    {selectedOrganization?.organizationId !== 'all' ? (
                      <option value={selectedOrganization?.organizationId}>
                        {selectedOrganization?.name}
                      </option>
                    ) : (
                      user?.attributes?.email === 'admin@athleon.fitness' && (
                        <option value="transversal">Global Template (Transversal)</option>
                      )
                    )}
                  </select>
                  <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                    {user?.attributes?.email === 'admin@athleon.fitness' 
                      ? 'Super admin can create global templates'
                      : 'WOD will be created for your organization'
                    }
                  </small>
                </div>
              )}
              
              <div className="form-row">
                <div className="form-group">
                  <label>Format</label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({...formData, format: e.target.value})}
                  >
                    {wodFormats.map(format => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Time Limit</label>
                  <input
                    type="text"
                    placeholder="e.g., 10:00, 12 rounds"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({...formData, timeLimit: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                >
                  <option value="">No Category</option>
                  {categories.map(category => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {maxScore && (
                <div style={{
                  padding: '15px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <h4 style={{margin: '0 0 10px 0'}}>Maximum Possible Score</h4>
                  <div style={{fontSize: '24px', fontWeight: 'bold'}}>{maxScore.total} points</div>
                  <div style={{fontSize: '14px', marginTop: '5px'}}>
                    EDS: {maxScore.eds} pts + Time Bonus: {maxScore.timeBonus} pts
                  </div>
                  <div style={{fontSize: '12px', marginTop: '5px', opacity: 0.9}}>
                    (Assuming perfect execution - EQS: 5/5)
                  </div>
                </div>
              )}

              <div className="form-group">
                <div className="movements-header">
                  <label>Movements</label>
                  <button type="button" onClick={addMovement} className="btn-sm btn-outline">
                    Add Movement
                  </button>
                </div>
                
                {formData.movements.map((movement, index) => (
                  <div key={index} className="movement-row">
                    <select
                      value={movement.exerciseId}
                      onChange={(e) => updateMovement(index, 'exerciseId', e.target.value)}
                      style={{flex: 2}}
                    >
                      <option value="">Select Exercise</option>
                      {exercises.map(ex => (
                        <option key={ex.exerciseId} value={ex.exerciseId}>
                          {ex.name} ({ex.baseScore} pts)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Reps"
                      value={movement.reps}
                      onChange={(e) => updateMovement(index, 'reps', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Weight (kg)"
                      value={movement.weight}
                      onChange={(e) => updateMovement(index, 'weight', e.target.value)}
                    />
                    {formData.movements.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeMovement(index)}
                        className="btn-sm btn-danger"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  placeholder="Additional instructions or notes"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isShared}
                    onChange={(e) => setFormData({...formData, isShared: e.target.checked})}
                  />
                  <span className="checkmark"></span>
                  Share this WOD with entire platform
                  <small>Other organizations can use this WOD in their events</small>
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingWod ? 'Update' : 'Create'} WOD
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .wod-management {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .wods-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .wod-card {
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: box-shadow 0.2s;
        }
        .wod-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .wod-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .wod-header h3 {
          margin: 0;
          color: #333;
          font-size: 16px;
        }
        .wod-badges {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
        }
        .format-badge {
          background: #007bff;
          color: white;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }
        .shared-badge {
          background: #28a745;
          color: white;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }
        .transversal-badge {
          background: #6f42c1;
          color: white;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }
        .external-badge {
          background: #fd7e14;
          color: white;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }
        .time-limit, .category-info {
          margin-bottom: 8px;
          font-size: 13px;
          color: #555;
        }
        .movements {
          margin-bottom: 12px;
        }
        .movement {
          padding: 3px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
          color: #555;
        }
        .movement:last-child {
          border-bottom: none;
        }
        .wod-description p {
          margin: 8px 0 0 0;
          color: #666;
          font-size: 13px;
          line-height: 1.4;
        }
        .wod-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .no-wods {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .btn-primary {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        }
        .btn-outline {
          background: white;
          color: #007bff;
          border: 1px solid #007bff;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .btn-outline:hover {
          background: #007bff;
          color: white;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .btn-danger:hover {
          background: #c82333;
        }
        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
          border-radius: 3px;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .wod-modal {
          background: white;
          border-radius: 12px;
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .movements-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .movement-row {
          display: flex;
          gap: 10px;
          margin-bottom: 8px;
          align-items: center;
        }
        .movement-row input {
          flex: 1;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          font-weight: normal;
        }
        .checkbox-label input[type="checkbox"] {
          width: auto;
          margin: 0;
        }
        .checkbox-label small {
          display: block;
          color: #666;
          font-size: 12px;
          margin-top: 4px;
        }
        .shared-info {
          color: #666;
          font-size: 12px;
          font-style: italic;
        }
        .template-info {
          color: #6f42c1;
          font-size: 12px;
          font-style: italic;
          font-weight: 500;
        }
        .info-message {
          background: #e3f2fd;
          color: #1976d2;
          padding: 10px 15px;
          border-radius: 4px;
          font-size: 14px;
          border: 1px solid #bbdefb;
        }
        @media (max-width: 768px) {
          .wods-grid {
            grid-template-columns: 1fr;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .movement-row {
            flex-direction: column;
            gap: 8px;
          }
          .page-header {
            flex-direction: column;
            gap: 15px;
          }
        }
      `}</style>
    </div>
  );
}

export default WODManagement;
