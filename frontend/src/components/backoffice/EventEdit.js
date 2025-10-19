import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useParams, useNavigate } from 'react-router-dom';
import './EventManagement.css';

function EventEdit() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [availableWods, setAvailableWods] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    status: 'upcoming',
    published: false,
    maxParticipants: null,
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
      const eventWods = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      const eventCategories = await API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`);
      
      setEvent(eventData);
      setFormData({
        name: eventData.name || '',
        description: eventData.description || '',
        startDate: eventData.startDate || '',
        endDate: eventData.endDate || '',
        location: eventData.location || '',
        status: eventData.status || 'upcoming',
        published: eventData.published || false,
        maxParticipants: eventData.maxParticipants || null,
        workouts: eventWods || [],
        categories: eventCategories || []
      });
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      // Get all available categories (global + event-specific)
      const response = await API.get('CalisthenicsAPI', '/categories');
      setAvailableCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchWods = async () => {
    try {
      // Only fetch shared WODs for event selection
      const response = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}&includeShared=true`);
      // Filter to only show shared WODs from other events, not current event WODs
      const sharedWods = (response || []).filter(wod => wod.isSharedWod || wod.isShared || wod.isTransversal);
      setAvailableWods(sharedWods);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update event metadata
      await API.put('CalisthenicsAPI', `/competitions/${eventId}`, {
        body: {
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          endDate: formData.endDate,
          location: formData.location,
          status: formData.status,
          published: formData.published,
          maxParticipants: formData.maxParticipants
        }
      });

      // Get current WODs for this event
      const currentWods = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      const currentWodIds = currentWods.map(w => w.wodId);
      const selectedWodIds = formData.workouts.map(w => w.wodId);

      // Update each WOD's eventId
      // Add new WODs to event
      for (const wod of formData.workouts) {
        if (!currentWodIds.includes(wod.wodId)) {
          await API.put('CalisthenicsAPI', `/wods/${wod.wodId}`, {
            body: { 
              eventId,
              currentEventId: wod.eventId // Pass current eventId to avoid scan
            }
          });
        }
      }

      // Remove WODs from event
      for (const currentWod of currentWods) {
        if (!selectedWodIds.includes(currentWod.wodId)) {
          await API.del('CalisthenicsAPI', `/wods/${currentWod.wodId}?eventId=${eventId}`);
        }
      }

      // Update categories for event
      const currentCategories = await API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`);
      const currentCategoryIds = currentCategories.map(c => c.categoryId);
      const selectedCategoryIds = formData.categories.map(c => c.categoryId);

      // Add new categories to event
      for (const category of formData.categories) {
        if (!currentCategoryIds.includes(category.categoryId)) {
          await API.put('CalisthenicsAPI', `/categories/${category.categoryId}`, {
            body: { eventId }
          });
        }
      }

      // Remove categories from event
      for (const currentCategory of currentCategories) {
        if (!selectedCategoryIds.includes(currentCategory.categoryId)) {
          await API.del('CalisthenicsAPI', `/categories/${currentCategory.categoryId}?eventId=${eventId}`);
        }
      }

      navigate(`/backoffice/events/${eventId}`);
    } catch (error) {
      console.error('Error updating event:', error);
      alert(`Failed to update event: ${error.response?.data?.message || error.message}`);
    }
  };

  const addWorkout = (wodId) => {
    const wod = availableWods.find(w => w.wodId === wodId);
    if (wod && !formData.workouts.find(w => w.wodId === wodId)) {
      setFormData({ ...formData, workouts: [...formData.workouts, wod] });
    }
  };

  const removeWorkout = (wodId) => {
    setFormData({
      ...formData,
      workouts: formData.workouts.filter(w => w.wodId !== wodId)
    });
  };

  const addCategory = (categoryId) => {
    const category = availableCategories.find(c => c.categoryId === categoryId);
    if (category && !formData.categories.find(c => c.categoryId === categoryId)) {
      setFormData({ ...formData, categories: [...formData.categories, category] });
    }
  };

  const removeCategory = (categoryId) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter(c => c.categoryId !== categoryId)
    });
  };

  if (!event) return <div>Loading...</div>;

  return (
    <div className="event-edit">
      <div className="page-header">
        <button onClick={() => navigate(`/backoffice/events/${eventId}`)} className="btn-back">← Back</button>
        <h1>Edit Event</h1>
      </div>

      <form onSubmit={handleSubmit} className="event-form">
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
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="4"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="datetime-local"
              value={formData.startDate?.slice(0, 16)}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="datetime-local"
              value={formData.endDate?.slice(0, 16)}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>

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

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.published}
              onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <span>Publish event (visible to public)</span>
          </label>
        </div>

        <div className="form-group">
          <label>Workouts (WODs)</label>
          <div className="wod-selection">
            <div className="available-wods">
              <h4>Available WODs</h4>
              {availableWods.length === 0 ? (
                <p style={{color: '#666', padding: '20px', textAlign: 'center'}}>
                  No WODs available. Create WODs in WOD Management first.
                </p>
              ) : (
                availableWods
                  .filter(wod => !formData.workouts.find(w => w.wodId === wod.wodId))
                  .map(wod => (
                    <div key={wod.wodId} className="wod-item">
                      <div className="wod-info">
                        <strong>{wod.name}</strong>
                        <span className="wod-format">{wod.format || wod.scoringType}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-add"
                        onClick={() => addWorkout(wod.wodId)}
                      >
                        + Add
                      </button>
                    </div>
                  ))
              )}
            </div>
            
            <div className="selected-wods">
              <h4>Selected WODs ({formData.workouts.length})</h4>
              {formData.workouts.map((wod) => (
                <div key={wod.wodId} className="wod-item selected">
                  <div className="wod-info">
                    <strong>{wod.name}</strong>
                    <span className="wod-format">{wod.scoringType}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeWorkout(wod.wodId)}
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

        <div className="form-group">
          <label>Categories</label>
          <div className="wod-selection">
            <div className="available-wods">
              <h4>Available Categories</h4>
              {availableCategories.length === 0 ? (
                <p className="empty-message">
                  No categories available. Create categories in Category Management first.
                </p>
              ) : (
                availableCategories
                  .filter(category => !formData.categories.find(c => c.categoryId === category.categoryId))
                  .map(category => (
                    <div key={category.categoryId} className="wod-item">
                      <div className="wod-info">
                        <strong>{category.name}</strong>
                        <span className="wod-format">{category.description}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-add"
                        onClick={() => addCategory(category.categoryId)}
                      >
                        + Add
                      </button>
                    </div>
                  ))
              )}
            </div>
            
            <div className="selected-wods">
              <h4>Selected Categories ({formData.categories.length})</h4>
              {formData.categories.map((category) => (
                <div key={category.categoryId} className="wod-item selected">
                  <div className="wod-info">
                    <strong>{category.name}</strong>
                    <span className="wod-format">{category.description}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeCategory(category.categoryId)}
                  >
                    × Remove
                  </button>
                </div>
              ))}
              {formData.categories.length === 0 && (
                <p className="empty-message">No categories selected</p>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">Save Changes</button>
          <button type="button" onClick={() => navigate(`/backoffice/events/${eventId}`)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default EventEdit;
