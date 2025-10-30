import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from 'aws-amplify';

function EventEdit() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableWods, setAvailableWods] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedWodDetails, setSelectedWodDetails] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    status: 'upcoming',
    published: false,
    maxParticipants: null,
    registrationDeadline: '',
    workouts: [],
    categories: []
  });

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchWods();
      fetchCategories();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const eventData = await API.get('CalisthenicsAPI', `/competitions/${eventId}`);
      console.log('Fetched event data:', eventData);
      
      // Use WODs and categories from event record if available (same as EventDetails)
      const eventWods = eventData.wods || eventData.workouts || [];
      const eventCategories = eventData.categories || [];
      
      console.log('Event WODs:', eventWods);
      console.log('Event Categories:', eventCategories);
      
      // Convert ISO dates to datetime-local format
      const formatDateForInput = (isoDate) => {
        if (!isoDate) return '';
        return new Date(isoDate).toISOString().slice(0, 16);
      };
      
      setFormData({
        name: eventData.name || '',
        description: eventData.description || '',
        startDate: formatDateForInput(eventData.startDate),
        endDate: formatDateForInput(eventData.endDate),
        location: eventData.location || '',
        status: eventData.status || 'upcoming',
        published: eventData.published || false,
        maxParticipants: eventData.maxParticipants || null,
        registrationDeadline: formatDateForInput(eventData.registrationDeadline),
        workouts: eventWods,
        categories: eventCategories
      });
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const fetchWods = async () => {
    try {
      const wods = await API.get('CalisthenicsAPI', '/wods');
      setAvailableWods(wods || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const categories = await API.get('CalisthenicsAPI', '/categories');
      setAvailableCategories(categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddWod = async (wod) => {
    if (!formData.workouts.some(w => w.wodId === wod.wodId)) {
      const updatedWorkouts = [...formData.workouts, wod];
      setFormData({
        ...formData,
        workouts: updatedWorkouts
      });
      
      // Immediately save to backend
      try {
        await API.put('CalisthenicsAPI', `/competitions/${eventId}`, {
          body: {
            ...formData,
            wods: updatedWorkouts  // Send as 'wods' not 'workouts'
          }
        });
        console.log('WOD added and saved successfully');
      } catch (error) {
        console.error('Error saving WOD to event:', error);
        // Revert the local state if save failed
        setFormData({
          ...formData,
          workouts: formData.workouts
        });
      }
    }
  };

  const handleRemoveWod = async (wodId) => {
    const updatedWorkouts = formData.workouts.filter(w => w.wodId !== wodId);
    setFormData({
      ...formData,
      workouts: updatedWorkouts
    });
    
    // Immediately save to backend
    try {
      await API.put('CalisthenicsAPI', `/competitions/${eventId}`, {
        body: {
          ...formData,
          wods: updatedWorkouts  // Send as 'wods' not 'workouts'
        }
      });
      console.log('WOD removed and saved successfully');
    } catch (error) {
      console.error('Error saving WOD removal:', error);
      // Revert the local state if save failed
      setFormData({
        ...formData,
        workouts: formData.workouts
      });
    }
  };

  const handleCategoryChange = (category, isSelected) => {
    if (isSelected) {
      if (!formData.categories.some(c => c.categoryId === category.categoryId)) {
        setFormData({
          ...formData,
          categories: [...formData.categories, { ...category, maxParticipants: null }]
        });
      }
    } else {
      setFormData({
        ...formData,
        categories: formData.categories.filter(c => c.categoryId !== category.categoryId)
      });
    }
  };

  const handleCategoryQuotaChange = (categoryId, maxParticipants) => {
    setFormData({
      ...formData,
      categories: formData.categories.map(c => 
        c.categoryId === categoryId 
          ? { ...c, maxParticipants: maxParticipants ? parseInt(maxParticipants) : null }
          : c
      )
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await API.put('CalisthenicsAPI', `/competitions/${eventId}`, {
        body: formData
      });
      navigate(`/backoffice/events/${eventId}`);
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-event-page">
      <div className="page-header">
        <button onClick={() => navigate(`/backoffice/events/${eventId}`)} className="btn-back">
          <span>←</span> Back to Event
        </button>
        <div className="header-content">
          <h1>Edit Event</h1>
          <p className="page-subtitle">Update your event details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="modern-form">
        {/* Basic Information Section */}
        <div className="form-section">
          <h3 className="section-title">📋 Basic Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Event Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Event location"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your event..."
              rows="3"
            />
          </div>
        </div>

        {/* Event Schedule Section */}
        <div className="form-section">
          <h3 className="section-title">📅 Event Schedule</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Start Date & Time</label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>End Date & Time</label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Registration Deadline</label>
            <input
              type="datetime-local"
              value={formData.registrationDeadline}
              onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
              placeholder="When registration closes"
            />
            <small className="field-hint">Athletes cannot register after this date</small>
          </div>
        </div>

        {/* Event Settings Section */}
        <div className="form-section">
          <h3 className="section-title">⚙️ Event Settings</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Max Participants</label>
              <input
                type="number"
                value={formData.maxParticipants || ''}
                onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Leave empty for unlimited"
                min="1"
              />
            </div>
            
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Event Visibility Section */}
        <div className="form-section">
          <h3 className="section-title">👁️ Event Visibility</h3>
          <div className="toggle-container">
            <input
              type="checkbox"
              checked={formData.published}
              onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
              className="toggle-input"
              id="publish-toggle-edit"
            />
            <label htmlFor="publish-toggle-edit" className="toggle-slider"></label>
          </div>
          <div className="status-text">
            {formData.published ? 'Event is published (visible to public)' : 'Event is draft (not visible to public)'}
          </div>
          <small className="field-hint">
            {formData.published ? 'Athletes can register and view this event' : 'Event is hidden from public view'}
          </small>
        </div>

        {/* Workouts Section */}
        <div className="form-section">
          <h3 className="section-title">💪 Workouts (WODs)</h3>
          <div className="wods-selection">
            <div className="wods-grid-container">
              <h4>Available WODs</h4>
              <div className="wods-grid">
                {availableWods.map((wod) => (
                  <div key={wod.wodId} className="wod-card">
                    <div className="wod-header">
                      <h5>{wod.name}</h5>
                      <div className="wod-header-actions">
                        <span className={`wod-badge ${wod.format?.toLowerCase()}`}>
                          {wod.format}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedWodDetails(wod)}
                          className="btn-wod-info"
                          title="View WOD details"
                        >
                          ℹ️
                        </button>
                      </div>
                    </div>
                    {wod.description && (
                      <p className="wod-description">{wod.description}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddWod(wod)}
                      className="btn-add-wod"
                      disabled={formData.workouts.some(w => w.wodId === wod.wodId)}
                    >
                      {formData.workouts.some(w => w.wodId === wod.wodId) ? 'Added' : 'Add WOD'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="selected-wods-list">
              <h4>Selected WODs ({formData.workouts.length})</h4>
              {formData.workouts.length > 0 ? (
                formData.workouts.map((wod) => (
                  <div key={wod.wodId} className="selected-wod-item">
                    <div>
                      <strong>{wod.name}</strong>
                      <span className={`wod-badge ${wod.format?.toLowerCase()}`}>
                        {wod.format}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveWod(wod.wodId)}
                      className="btn-remove-wod"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No WODs selected</p>
                  <p>Add workouts from the available list above</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="form-section">
          <h3 className="section-title">🏆 Categories</h3>
          <div className="categories-grid">
            {availableCategories.map((category) => (
              <div key={category.categoryId} className="category-item-with-quota">
                <div className="category-main-info">
                  <div className="category-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.categories.some(c => c.categoryId === category.categoryId)}
                      onChange={(e) => handleCategoryChange(category, e.target.checked)}
                    />
                    <div>
                      <div className="category-name">{category.name}</div>
                      <div className="category-details">
                        {category.description}
                      </div>
                    </div>
                  </div>
                </div>
                
                {formData.categories.some(c => c.categoryId === category.categoryId) && (
                  <div className="category-quota-settings">
                    <label>Max Participants for this category:</label>
                    <input
                      type="number"
                      value={formData.categories.find(c => c.categoryId === category.categoryId)?.maxParticipants || ''}
                      onChange={(e) => handleCategoryQuotaChange(category.categoryId, e.target.value)}
                      placeholder="Leave empty for unlimited"
                      min="1"
                      className="quota-input"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <span className="spinner"></span> : null}
            Update Event
          </button>
          <button 
            type="button" 
            onClick={() => navigate(`/backoffice/events/${eventId}`)} 
            className="btn-outline"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* WOD Details Modal */}
      {selectedWodDetails && (
        <div className="modal-overlay" onClick={() => setSelectedWodDetails(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedWodDetails.name}</h3>
              <button 
                onClick={() => setSelectedWodDetails(null)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="wod-info-section">
                <div className="wod-meta">
                  <span className={`wod-badge ${selectedWodDetails.format?.toLowerCase()}`}>
                    {selectedWodDetails.format}
                  </span>
                  {selectedWodDetails.timeCap && (
                    <span className="time-cap">⏱️ {selectedWodDetails.timeCap}</span>
                  )}
                </div>
                
                {selectedWodDetails.description && (
                  <div className="wod-description-full">
                    <h4>Description</h4>
                    <p>{selectedWodDetails.description}</p>
                  </div>
                )}

                {/* Show available WOD information */}
                <div className="wod-info-grid">
                  {selectedWodDetails.format && (
                    <div className="wod-info-item">
                      <span className="info-label">Format:</span>
                      <span className="info-value">{selectedWodDetails.format}</span>
                    </div>
                  )}
                  {selectedWodDetails.timeCap && (
                    <div className="wod-info-item">
                      <span className="info-label">Time Cap:</span>
                      <span className="info-value">{selectedWodDetails.timeCap}</span>
                    </div>
                  )}
                  {selectedWodDetails.scoringType && (
                    <div className="wod-info-item">
                      <span className="info-label">Scoring:</span>
                      <span className="info-value">{selectedWodDetails.scoringType}</span>
                    </div>
                  )}
                </div>

                {/* Show movements if available */}
                {selectedWodDetails.movements && selectedWodDetails.movements.length > 0 ? (
                  <div className="wod-movements">
                    <h4>Movements</h4>
                    <div className="movements-list">
                      {selectedWodDetails.movements.map((movement, index) => (
                        <div key={index} className="movement-item">
                          <div className="movement-info">
                            <span className="movement-name">{movement.name || movement.exercise || `Movement ${index + 1}`}</span>
                            <span className="movement-reps">{movement.reps || movement.quantity || 'N/A'} reps</span>
                          </div>
                          <div className="movement-note">
                            <span className="scoring-note">Uses event scoring system</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Max Score Display */}
                    <div className="max-score-display">
                      <div className="max-score-label">Maximum Possible Score:</div>
                      <div className="max-score-value">
                        {(() => {
                          // Calculate max score based on movements
                          let maxScore = 0;
                          selectedWodDetails.movements.forEach(movement => {
                            const reps = parseInt(movement.reps) || 0;
                            // Base points from exercise library (estimated)
                            const basePoints = movement.name?.toLowerCase().includes('muscle up') ? 5 :
                                             movement.name?.toLowerCase().includes('pull up') ? 1 :
                                             movement.name?.toLowerCase().includes('push up') ? 0.5 :
                                             movement.name?.toLowerCase().includes('squat') ? 0.5 :
                                             movement.name?.toLowerCase().includes('dip') ? 1 : 1;
                            // EDS × max EQS (5) + potential modifiers
                            maxScore += (basePoints * reps * 5);
                          });
                          // Add time bonus for 1st place
                          maxScore += 10;
                          return Math.round(maxScore);
                        })()}
                        <span className="score-unit">pts</span>
                      </div>
                      <div className="max-score-note">Perfect execution + 1st place finish</div>
                    </div>
                    
                    <div className="scoring-info">
                      <p><strong>Note:</strong> This WOD will use the event's scoring system. By default, events use the advanced scoring system with exercise-based points and quality ratings (EDS × EQS + Time Bonus).</p>
                    </div>
                  </div>
                ) : (
                  <div className="wod-info-note">
                    <h4>WOD Information</h4>
                    <p>This WOD is available for use in your event. Detailed movement breakdown and scoring information will be configured when setting up the competition.</p>
                    {selectedWodDetails.type && (
                      <p><strong>Type:</strong> {selectedWodDetails.type}</p>
                    )}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    onClick={() => {
                      handleAddWod(selectedWodDetails);
                      setSelectedWodDetails(null);
                    }}
                    className="btn-primary"
                    disabled={formData.workouts.some(w => w.wodId === selectedWodDetails.wodId)}
                  >
                    {formData.workouts.some(w => w.wodId === selectedWodDetails.wodId) ? 'Already Added' : 'Add This WOD'}
                  </button>
                  <button
                    onClick={() => setSelectedWodDetails(null)}
                    className="btn-outline"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .btn-back {
          background: none;
          border: 1px solid #dee2e6;
          color: #6c757d;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .btn-back:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
          color: #495057;
        }
        
        .page-header {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .header-content {
          flex: 1;
        }
        
        .toggle-input {
          display: none;
        }
        
        .toggle-slider {
          position: relative;
          width: 60px;
          height: 30px;
          background: #ccc;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .toggle-slider:before {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .toggle-input:checked + .toggle-slider {
          background: #28a745;
        }
        
        .toggle-input:checked + .toggle-slider:before {
          transform: translateX(30px);
        }
        
        .wod-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .btn-wod-info {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s ease;
        }
        
        .btn-wod-info:hover {
          background: rgba(0,0,0,0.1);
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
        
        .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .modal-header h3 {
          margin: 0;
          color: #333;
        }
        
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        
        .modal-close:hover {
          background: #f8f9fa;
          color: #333;
        }
        
        .modal-body {
          padding: 20px;
        }
        
        .wod-meta {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .time-cap {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #666;
        }
        
        .wod-description-full {
          margin-bottom: 20px;
        }
        
        .wod-description-full h4 {
          margin: 0 0 8px 0;
          color: #333;
        }
        
        .wod-movements h4 {
          margin: 0 0 12px 0;
          color: #333;
        }
        
        .movements-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .movement-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .movement-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .movement-name {
          font-weight: 500;
          color: #333;
        }
        
        .movement-reps {
          font-size: 12px;
          color: #666;
        }
        
        .movement-points {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        
        .base-points {
          font-weight: 600;
          color: #28a745;
        }
        
        .modifiers {
          font-size: 11px;
          color: #666;
        }
        
        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        
        .wod-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .wod-info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .info-label {
          font-weight: 500;
          color: #666;
        }
        
        .info-value {
          font-weight: 600;
          color: #333;
        }
        
        .wod-info-note {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        
        .wod-info-note h4 {
          margin: 0 0 8px 0;
          color: #333;
        }
        
        .wod-info-note p {
          margin: 0 0 8px 0;
          color: #666;
          line-height: 1.5;
        }
        
        .movement-note {
          display: flex;
          align-items: center;
        }
        
        .scoring-note {
          font-size: 12px;
          color: #666;
          font-style: italic;
        }
        
        .scoring-info {
          margin-top: 16px;
          padding: 12px;
          background: #e3f2fd;
          border-radius: 6px;
          border-left: 4px solid #2196f3;
        }
        
        .scoring-info p {
          margin: 0;
          font-size: 13px;
          color: #1565c0;
          line-height: 1.4;
        }
        
        .max-score-display {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          margin: 16px 0;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .max-score-label {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
          opacity: 0.9;
        }
        
        .max-score-value {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .score-unit {
          font-size: 18px;
          font-weight: 500;
          margin-left: 4px;
        }
        
        .max-score-note {
          font-size: 12px;
          opacity: 0.8;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

export default EventEdit;
