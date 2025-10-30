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
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedWodDetails, setSelectedWodDetails] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
    location: '',
    maxParticipants: 100,
    registrationDeadline: '',
    workouts: [],
    categories: [],
    imageUrl: '',
    published: false
  });

  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wodSearch, setWodSearch] = useState('');
  const [wodFilter, setWodFilter] = useState('all');

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
    fetchCategories();
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
      
      // Get events with WODs data and detailed athlete/category information
      const eventsWithData = await Promise.all(response.map(async (event) => {
        // Use WODs from event record if available (same as EventDetails)
        const eventWods = event.wods || event.workouts || [];
        
        // Fetch athletes and categories for detailed participant info (same as EventDetails)
        let athletes = [];
        let categories = [];
        
        try {
          athletes = await API.get('CalisthenicsAPI', `/athletes?eventId=${event.eventId}`) || [];
        } catch (error) {
          console.warn(`Could not fetch athletes for event ${event.eventId}:`, error.response?.status, error.message);
        }
        
        // Get categories from event record or fetch them
        const eventCategories = event.categories || [];
        if (eventCategories.length > 0) {
          categories = eventCategories;
        } else {
          try {
            categories = await API.get('CalisthenicsAPI', `/categories?eventId=${event.eventId}`) || [];
          } catch (error) {
            console.warn(`Could not fetch categories for event ${event.eventId}:`, error.response?.status, error.message);
          }
        }
        
        return { 
          ...event, 
          workouts: eventWods,
          wods: eventWods,
          wodCount: eventWods.length,
          athletes,
          categories,
          athleteCount: athletes.length
        };
      }));
      
      setEvents(eventsWithData);
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

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setAvailableCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreate = () => {
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
      categories: [],
      imageUrl: '',
      published: false
    });
    setImageFile(null);
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
    
    if (isSubmitting) return;
    
    if (!selectedOrganization) {
      alert('Please select an organization first');
      return;
    }
    
    setIsSubmitting(true);
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
        categories: [],
        imageUrl: '',
        published: false
      });
      setImageFile(null);
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert(`Failed to save event: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
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
      <div className="create-event-page">
        <div className="page-header">
          <button onClick={() => setShowEditPage(false)} className="btn-back">
            ← Back to Events
          </button>
          <h1>{editingEvent ? 'Edit Event' : 'Create New Event'}</h1>
          <p className="page-subtitle">
            {editingEvent ? 'Update your event details' : 'Set up your competition with all the details'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="modern-form">
          {/* Basic Information Section */}
          <div className="form-section">
            <h3 className="section-title">📋 Basic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter event name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Event location"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe your event..."
                rows="4"
              />
            </div>
          </div>

          {/* Dates & Registration Section */}
          <div className="form-section">
            <h3 className="section-title">📅 Dates & Registration</h3>
            <div className="form-grid">
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
              <div className="form-group">
                <label>Registration Deadline</label>
                <input
                  type="date"
                  value={formData.registrationDeadline}
                  onChange={(e) => setFormData({...formData, registrationDeadline: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Max Participants</label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                  min="1"
                  placeholder="100"
                />
              </div>
            </div>
          </div>

          {/* Categories Section */}
          <div className="form-section">
            <h3 className="section-title">🏆 Categories</h3>
            <div className="categories-selection">
              <p className="section-description">Select the categories available for this event</p>
              <div className="categories-grid">
                {availableCategories.map(category => (
                  <label key={category.categoryId} className="category-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(category.categoryId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            categories: [...formData.categories, category.categoryId]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            categories: formData.categories.filter(id => id !== category.categoryId)
                          });
                        }
                      }}
                    />
                    <span className="category-name">{category.name}</span>
                    <span className="category-details">
                      {category.gender && `${category.gender} • `}
                      {category.minAge && category.maxAge ? `${category.minAge}-${category.maxAge} years` : 
                       category.minAge ? `${category.minAge}+ years` : 
                       category.maxAge ? `Under ${category.maxAge} years` : 'All ages'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Scoring System Section */}
          <div className="form-section">
            <h3 className="section-title">🎯 Scoring System</h3>
            <div className="info-note">
              <p><strong>Note:</strong> Scoring systems can be configured after creating the event.</p>
              <p>By default, events use the transversal scoring system. You can create custom scoring systems in the event details page.</p>
            </div>
          </div>

          {/* Workouts Section */}
          <div className="form-section">
            <h3 className="section-title">💪 Workouts (WODs)</h3>
            <div className="wods-selection">
              <div className="available-wods">
                <h4>Available WODs</h4>
                <div className="wods-controls">
                  <input
                    type="text"
                    placeholder="Search WODs..."
                    value={wodSearch}
                    onChange={(e) => setWodSearch(e.target.value)}
                    className="wod-search"
                  />
                  <select
                    value={wodFilter}
                    onChange={(e) => setWodFilter(e.target.value)}
                    className="wod-filter"
                  >
                    <option value="all">All Types</option>
                    <option value="amrap">AMRAP</option>
                    <option value="chipper">Chipper</option>
                    <option value="emom">EMOM</option>
                    <option value="rft">RFT</option>
                    <option value="ladder">Ladder</option>
                    <option value="tabata">Tabata</option>
                  </select>
                </div>
                <div className="wods-grid-container">
                  <div className="wods-grid">
                    {availableWods
                      .filter(wod => !formData.workouts.find(w => w.wodId === wod.wodId))
                      .filter(wod => 
                        wod.name.toLowerCase().includes(wodSearch.toLowerCase()) ||
                        wod.description?.toLowerCase().includes(wodSearch.toLowerCase())
                      )
                      .filter(wod => 
                        wodFilter === 'all' || 
                        wod.format?.toLowerCase() === wodFilter
                      )
                      .map(wod => (
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
                          <p className="wod-description">{wod.description}</p>
                          <button
                            type="button"
                            className="btn-add-wod"
                            onClick={() => setFormData({
                              ...formData,
                              workouts: [...formData.workouts, wod]
                            })}
                          >
                            + Add WOD
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              
              <div className="selected-wods">
                <h4>Selected WODs ({formData.workouts.length})</h4>
                {formData.workouts.length > 0 ? (
                  <div className="selected-wods-list">
                    {formData.workouts.map((wod, index) => (
                      <div key={wod.wodId} className="selected-wod-item">
                        <div className="wod-info">
                          <strong>{wod.name}</strong>
                          <span className="wod-format">{wod.format}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-wod"
                          onClick={() => setFormData({
                            ...formData,
                            workouts: formData.workouts.filter((_, i) => i !== index)
                          })}
                        >
                          × Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No WODs selected yet</p>
                    <small>Add WODs from the available list above</small>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event Image Section */}
          <div className="form-section">
            <h3 className="section-title">🖼️ Event Image</h3>
            <div className="form-group">
              <label>Event Banner</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="file-input"
              />
              <small className="field-hint">
                Upload a banner image for your event (optional)
              </small>
            </div>
          </div>

          {/* Publication Section */}
          <div className="form-section">
            <h3 className="section-title">🌐 Publication</h3>
            <div className="form-group">
              <label>Publication Status</label>
              <div className="toggle-container">
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => setFormData({...formData, published: e.target.checked})}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
              <div className="status-text">
                {formData.published ? 'Event is published (visible to public)' : 'Event is draft (not visible to public)'}
              </div>
              <small className="field-hint">
                Published events are visible to athletes and allow registrations
              </small>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Saving...
                </>
              ) : (
                editingEvent ? 'Update Event' : 'Create Event'
              )}
            </button>
            <button type="button" className="btn-outline" onClick={() => setShowEditPage(false)}>
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
                        setFormData({
                          ...formData,
                          workouts: [...formData.workouts, selectedWodDetails]
                        });
                        setSelectedWodDetails(null);
                      }}
                      className="btn-primary"
                      disabled={formData.workouts.find(w => w.wodId === selectedWodDetails.wodId)}
                    >
                      {formData.workouts.find(w => w.wodId === selectedWodDetails.wodId) ? 'Already Added' : 'Add This WOD'}
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
              <div className="event-badges">
                <span className={`status status-${event.status}`}>{event.status}</span>
                {event.published && <span className="published-badge">Published</span>}
              </div>
            </div>
            
            <div className="event-meta">
              <p className="event-date">📅 {formatDate(event.startDate || event.date)}</p>
              {event.location && <p className="event-location">📍 {event.location}</p>}
            </div>
            
            {event.description && (
              <p className="event-description">{event.description}</p>
            )}
            
            <div className="event-stats">
              <div className="stat-item">
                <span className="stat-icon">💪</span>
                <span className="stat-label">WODs:</span>
                <span className="stat-value">{event.wodCount || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">👥</span>
                <span className="stat-label">Athletes:</span>
                <span className="stat-value">{event.athleteCount || 0}</span>
              </div>
            </div>
            
            {/* Participant Information (same as EventDetails) */}
            <div className="participant-info">
              <div className="max-participants">
                <span className="label">Max Participants:</span>
                <span className="value">
                  {event.maxParticipants ? (
                    <span className="quota-info">
                      <span className="total-quota">{event.maxParticipants}</span>
                      <span className="quota-separator"> | </span>
                      <span className="available-quota">
                        {event.maxParticipants - (event.athletes?.length || 0)} available
                      </span>
                      <span className="quota-percentage">
                        ({Math.round(((event.athletes?.length || 0) / event.maxParticipants) * 100)}% full)
                      </span>
                    </span>
                  ) : (
                    'Unlimited'
                  )}
                </span>
              </div>
              
              {event.categories && event.categories.length > 0 && (
                <div className="categories-info">
                  <span className="label">Categories:</span>
                  <div className="categories-with-quotas">
                    {event.categories
                      .filter(category => typeof category === 'object' && category.categoryId)
                      .map(category => {
                        const categoryAthletes = (event.athletes || []).filter(a => a.categoryId === category.categoryId);
                        const categoryCount = categoryAthletes.length;
                        const maxQuota = category.maxParticipants || null;
                        
                        return (
                          <div key={category.categoryId} className="category-quota-item">
                            <span className="category-name">{category.name || category.categoryId}</span>
                            <span className="category-quota">
                              <span className="registered-count">{categoryCount}</span>
                              {maxQuota && (
                                <>
                                  <span className="quota-separator"> / </span>
                                  <span className="max-quota">{maxQuota}</span>
                                  <span className="available-spots">
                                    ({maxQuota - categoryCount} spots)
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
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
