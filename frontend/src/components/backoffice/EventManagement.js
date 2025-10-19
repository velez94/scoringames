import React, { useState, useEffect } from 'react';
import { API, Storage } from 'aws-amplify';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import OrganizationSelector from './OrganizationSelector';
import './EventManagement.css';

function EventManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedOrganization, organizations } = useOrganization();
  const [events, setEvents] = useState([]);
  const [showEditPage, setShowEditPage] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [availableWods, setAvailableWods] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
    location: '',
    maxParticipants: 100,
    registrationDeadline: '',
    workouts: [],
    imageUrl: '',
    published: false
  });

  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [showWodModal, setShowWodModal] = useState(false);
  const [wodFormData, setWodFormData] = useState({
    name: '',
    format: 'AMRAP',
    timeLimit: '',
    movements: [{ exercise: '', reps: '', weight: '' }],
    description: ''
  });

  const wodFormats = ['AMRAP', 'Chipper', 'EMOM', 'RFT', 'Ladder', 'Tabata'];

  useEffect(() => {
    if (selectedOrganization) {
      fetchEvents();
    }
  }, [selectedOrganization]);

  useEffect(() => {
    fetchWods();
  }, []);

  useEffect(() => {
    // Handle edit event from navigation state
    if (location.state?.editEvent) {
      handleEdit(location.state.editEvent);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchEvents = async () => {
    if (!selectedOrganization) return;
    
    try {
      const response = await API.get('CalisthenicsAPI', `/competitions?organizationId=${selectedOrganization.organizationId}`);
      
      // Fetch WOD count for each event
      const eventsWithWods = await Promise.all(
        response.map(async (event) => {
          try {
            const wods = await API.get('CalisthenicsAPI', `/wods?eventId=${event.eventId}`);
            return { ...event, workouts: wods || [] };
          } catch (error) {
            console.error(`Error fetching WODs for event ${event.eventId}:`, error);
            return { ...event, workouts: [] };
          }
        })
      );
      
      setEvents(eventsWithWods);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchWods = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/wods');
      setAvailableWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const handleCreate = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      date: '',
      description: '',
      maxParticipants: 100,
      registrationDeadline: '',
      workouts: []
    });
    setShowEditPage(true);
  };

  const handleEdit = async (event) => {
    setEditingEvent(event);
    
    // Fetch WODs for this event
    let eventWods = [];
    try {
      eventWods = await API.get('CalisthenicsAPI', `/wods?eventId=${event.eventId}`);
    } catch (error) {
      console.error('Error fetching event WODs:', error);
    }
    
    setFormData({
      name: event.name,
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      location: event.location || '',
      description: event.description || '',
      maxParticipants: event.maxParticipants || 100,
      registrationDeadline: event.registrationDeadline || '',
      workouts: eventWods || [],
      imageUrl: event.imageUrl || '',
      published: event.published || false
    });
    setShowEditPage(true);
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await API.del('CalisthenicsAPI', `/competitions/${eventId}`);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return null;
    
    try {
      setUploading(true);
      const fileName = `events/${Date.now()}-${file.name}`;
      
      // Upload to S3 via API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      
      const response = await API.post('CalisthenicsAPI', '/upload-image', { body: formData });
      return response.imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedOrganization) {
      alert('Please select an organization first');
      return;
    }
    
    try {
      let imageUrl = formData.imageUrl;
      
      // Upload image if file is selected
      if (imageFile) {
        imageUrl = await handleImageUpload(imageFile);
        if (!imageUrl) return; // Upload failed
      }

      const eventData = { 
        ...formData, 
        imageUrl,
        organizationId: selectedOrganization.organizationId 
      };
      
      if (editingEvent) {
        await API.put('CalisthenicsAPI', `/competitions/${editingEvent.eventId}`, { body: eventData });
      } else {
        await API.post('CalisthenicsAPI', '/competitions', { body: eventData });
      }
      setShowEditPage(false);
      setEditingEvent(null);
      setFormData({ 
        name: '', 
        startDate: '', 
        endDate: '', 
        description: '', 
        location: '',
        maxParticipants: 100, 
        registrationDeadline: '', 
        workouts: [], 
        imageUrl: '',
        published: false
      });
      setImageFile(null);
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert(`Failed to save event: ${error.response?.data?.message || error.message}`);
    }
  };

  const updateEventStatus = async (eventId, status) => {
    try {
      await API.put('CalisthenicsAPI', `/competitions/${eventId}`, { body: { status } });
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const handleAddWod = () => {
    setWodFormData({
      name: '',
      format: 'AMRAP',
      timeLimit: '',
      movements: [{ exercise: '', reps: '', weight: '' }],
      description: ''
    });
    setShowWodModal(true);
  };

  const handleWodSubmit = (e) => {
    e.preventDefault();
    const newWod = { ...wodFormData, wodId: `wod-${Date.now()}` };
    setFormData(prev => ({
      ...prev,
      workouts: [...prev.workouts, newWod]
    }));
    setShowWodModal(false);
  };

  const addMovement = () => {
    setWodFormData(prev => ({
      ...prev,
      movements: [...prev.movements, { exercise: '', reps: '', weight: '' }]
    }));
  };

  const updateMovement = (index, field, value) => {
    setWodFormData(prev => ({
      ...prev,
      movements: prev.movements.map((mov, i) => 
        i === index ? { ...mov, [field]: value } : mov
      )
    }));
  };

  const removeMovement = (index) => {
    setWodFormData(prev => ({
      ...prev,
      movements: prev.movements.filter((_, i) => i !== index)
    }));
  };

  const removeWod = (wodId) => {
    setFormData(prev => ({
      ...prev,
      workouts: prev.workouts.filter(wod => wod.wodId !== wodId)
    }));
  };

  const handleEventClick = (eventId) => {
    navigate(`/backoffice/events/${eventId}`);
  };

  // Show edit page
  if (showEditPage) {
    return (
      <div className="edit-page">
        <div className="page-header">
          <button onClick={() => setShowEditPage(false)} className="btn-back">← Back</button>
          <h1>{editingEvent ? 'Edit Event' : 'Create Event'}</h1>
        </div>
        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label>Event Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="4"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Max Participants</label>
              <input
                type="number"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label>Registration Deadline</label>
              <input
                type="date"
                value={formData.registrationDeadline}
                onChange={(e) => setFormData({...formData, registrationDeadline: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
              <input
                type="checkbox"
                checked={formData.published}
                onChange={(e) => setFormData({...formData, published: e.target.checked})}
                style={{width: 'auto', cursor: 'pointer'}}
              />
              <span>Publish event (visible to public)</span>
            </label>
          </div>
          
          <div className="form-group">
            <label>Workouts (WODs)</label>
            <div className="wod-selection">
              <div className="available-wods">
                <h4>Available WODs</h4>
                {availableWods
                  .filter(wod => !formData.workouts.find(w => w.wodId === wod.wodId))
                  .map(wod => (
                    <div key={wod.wodId} className="wod-item">
                      <div className="wod-info">
                        <strong>{wod.name}</strong>
                        <span className="wod-format">{wod.format}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-add"
                        onClick={() => setFormData({
                          ...formData,
                          workouts: [...formData.workouts, wod]
                        })}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
              </div>
              
              <div className="selected-wods">
                <h4>Selected WODs ({formData.workouts.length})</h4>
                {formData.workouts.map((wod, index) => (
                  <div key={wod.wodId} className="wod-item selected">
                    <div className="wod-info">
                      <strong>{wod.name}</strong>
                      <span className="wod-format">{wod.format}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => setFormData({
                        ...formData,
                        workouts: formData.workouts.filter((_, i) => i !== index)
                      })}
                    >
                      × Remove
                    </button>
                  </div>
                ))}
                {formData.workouts.length === 0 && (
                  <p className="empty-message">No WODs selected</p>
                )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingEvent ? 'Update Event' : 'Create Event'}
            </button>
            <button type="button" className="btn-outline" onClick={() => setShowEditPage(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="event-management">
      <OrganizationSelector />
      
      <div className="page-header">
        <h1>Event Management</h1>
        <button className="btn-primary" onClick={handleCreate}>
          Create Event
        </button>
      </div>

      <div className="events-grid">
        {events.map(event => (
          <div key={event.eventId} className="event-card" onClick={() => handleEventClick(event.eventId)}>
            {selectedOrganization?.organizationId === 'all' && event.organizationId && (
              <div className="organization-badge">
                <span className="org-icon">👥</span>
                <span className="org-name">{organizations.find(o => o.organizationId === event.organizationId)?.name || 'Unknown Org'}</span>
              </div>
            )}
            <div className="event-header">
              <h3>{event.name}</h3>
              <span className={`status ${event.status}`}>{event.status}</span>
            </div>
            <p className="event-date">{formatDate(event.startDate || event.date)}</p>
            {event.location && <p className="event-location">📍 {event.location}</p>}
            <p className="event-description">{event.description}</p>
            <div className="event-stats">
              <span>💪 WODs: {event.workouts?.length || 0}</span>
              {event.published && <span className="published-badge">✓ Published</span>}
            </div>
            <div className="event-actions" onClick={(e) => e.stopPropagation()}>
              <button 
                className="btn-success"
                onClick={() => updateEventStatus(event.eventId, 'active')}
                disabled={event.status === 'active'}
              >
                Activate
              </button>
              <button 
                className="btn-warning"
                onClick={() => updateEventStatus(event.eventId, 'completed')}
                disabled={event.status === 'completed'}
              >
                Complete
              </button>
              <button className="btn-outline" onClick={() => handleEdit(event)}>
                Edit
              </button>
              <button className="btn-danger" onClick={() => handleDelete(event.eventId)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showWodModal && (
        <div className="modal-overlay">
          <div className="modal wod-modal">
            <h3>Add Workout (WOD)</h3>
            <form onSubmit={handleWodSubmit}>
              <div className="form-group">
                <label>WOD Name</label>
                <input
                  type="text"
                  value={wodFormData.name}
                  onChange={(e) => setWodFormData({...wodFormData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Format</label>
                  <select
                    value={wodFormData.format}
                    onChange={(e) => setWodFormData({...wodFormData, format: e.target.value})}
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
                    value={wodFormData.timeLimit}
                    onChange={(e) => setWodFormData({...wodFormData, timeLimit: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="movements-header">
                  <label>Movements</label>
                  <button type="button" onClick={addMovement} className="btn-sm btn-outline">
                    Add Movement
                  </button>
                </div>
                
                {wodFormData.movements.map((movement, index) => (
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
                    {wodFormData.movements.length > 1 && (
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
                  value={wodFormData.description}
                  onChange={(e) => setWodFormData({...wodFormData, description: e.target.value})}
                  rows="2"
                  placeholder="Additional instructions or notes"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">Add WOD</button>
                <button type="button" className="btn-outline" onClick={() => setShowWodModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventManagement;
