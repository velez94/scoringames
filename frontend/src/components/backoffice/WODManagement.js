import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function WODManagement() {
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWod, setEditingWod] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    format: 'AMRAP',
    timeLimit: '',
    categoryId: '',
    movements: [{ exercise: '', reps: '', weight: '' }],
    description: ''
  });

  const wodFormats = ['AMRAP', 'Chipper', 'EMOM', 'RFT', 'Ladder', 'Tabata'];

  useEffect(() => {
    fetchWods();
    fetchCategories();
  }, []);

  const fetchWods = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/wods');
      setWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreate = () => {
    setEditingWod(null);
    setFormData({
      name: '',
      format: 'AMRAP',
      timeLimit: '',
      categoryId: '',
      movements: [{ exercise: '', reps: '', weight: '' }],
      description: ''
    });
    setShowModal(true);
  };

  const handleEdit = (wod) => {
    setEditingWod(wod);
    setFormData({
      name: wod.name,
      format: wod.format,
      timeLimit: wod.timeLimit || '',
      categoryId: wod.categoryId || '',
      movements: wod.movements || [{ exercise: '', reps: '', weight: '' }],
      description: wod.description || ''
    });
    setShowModal(true);
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
      alert('Error saving WOD: ' + (error.response?.data?.message || error.message));
    }
  };

  const addMovement = () => {
    setFormData(prev => ({
      ...prev,
      movements: [...prev.movements, { exercise: '', reps: '', weight: '' }]
    }));
  };

  const updateMovement = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      movements: prev.movements.map((mov, i) => 
        i === index ? { ...mov, [field]: value } : mov
      )
    }));
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

  return (
    <div className="wod-management">
      <div className="page-header">
        <h1>WOD Management</h1>
        <button onClick={handleCreate} className="btn-primary">
          Create WOD
        </button>
      </div>

      <div className="wods-grid">
        {wods.map(wod => (
          <div key={wod.wodId} className="wod-card">
            <div className="wod-header">
              <h3>{wod.name}</h3>
              <span className="format-badge">{wod.format}</span>
            </div>
            
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
              <button onClick={() => handleEdit(wod)} className="btn-outline">
                Edit
              </button>
              <button onClick={() => handleDelete(wod.wodId)} className="btn-danger">
                Delete
              </button>
            </div>
          </div>
        ))}

        {wods.length === 0 && (
          <div className="no-wods">
            <p>No WODs created yet.</p>
            <button onClick={handleCreate} className="btn-primary">
              Create First WOD
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

              <div className="form-group">
                <div className="movements-header">
                  <label>Movements</label>
                  <button type="button" onClick={addMovement} className="btn-sm btn-outline">
                    Add Movement
                  </button>
                </div>
                
                {formData.movements.map((movement, index) => (
                  <div key={index} className="movement-row">
                    <input
                      type="text"
                      placeholder="Exercise"
                      value={movement.exercise}
                      onChange={(e) => updateMovement(index, 'exercise', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Reps"
                      value={movement.reps}
                      onChange={(e) => updateMovement(index, 'reps', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Weight (optional)"
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
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .wods-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }
        .wod-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .wod-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .wod-header h3 {
          margin: 0;
          color: #333;
        }
        .format-badge {
          background: #007bff;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
        .time-limit, .category-info {
          margin-bottom: 10px;
          font-size: 14px;
        }
        .movements {
          margin-bottom: 15px;
        }
        .movement {
          padding: 4px 0;
          border-bottom: 1px solid #eee;
          font-size: 14px;
        }
        .wod-description p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 14px;
        }
        .wod-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
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
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
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
          border-radius: 8px;
          padding: 20px;
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
