import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import EventDetails from './EventDetails';

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    description: '',
    maxParticipants: 100,
    registrationDeadline: '',
    workouts: []
  });

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
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/events');
      setEvents(response);
    } catch (error) {
      console.error('Error fetching events:', error);
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
    setShowModal(true);
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      date: event.date,
      description: event.description || '',
      maxParticipants: event.maxParticipants || 100,
      registrationDeadline: event.registrationDeadline || '',
      workouts: event.workouts || []
    });
    setShowModal(true);
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await API.del('CalisthenicsAPI', `/events/${eventId}`);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await API.put('CalisthenicsAPI', `/events/${editingEvent.eventId}`, { body: formData });
      } else {
        await API.post('CalisthenicsAPI', '/events', { body: formData });
      }
      setShowModal(false);
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const updateEventStatus = async (eventId, status) => {
    try {
      await API.put('CalisthenicsAPI', `/events/${eventId}`, { body: { status } });
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
    setSelectedEventId(eventId);
  };

  const handleBackToList = () => {
    setSelectedEventId(null);
  };

  // Show event details if an event is selected
  if (selectedEventId) {
    return <EventDetails eventId={selectedEventId} onBack={handleBackToList} />;
  }

  return (
    <div className="event-management">
      <div className="page-header">
        <h1>Event Management</h1>
        <button className="btn-primary" onClick={handleCreate}>
          Create Event
        </button>
      </div>

      <div className="events-grid">
        {events.map(event => (
          <div key={event.eventId} className="event-card" onClick={() => handleEventClick(event.eventId)}>
            <div className="event-header">
              <h3>{event.name}</h3>
              <span className={`status ${event.status}`}>{event.status}</span>
            </div>
            <p className="event-date">{new Date(event.date).toLocaleDateString()}</p>
            <p className="event-description">{event.description}</p>
            <div className="event-stats">
              <span>WODs: {event.workouts?.length || 0}</span>
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

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Max Participants</label>
                  <input
                    type="number"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <div className="wod-section">
                  <div className="wod-header">
                    <label>Workouts (WODs)</label>
                    <button type="button" onClick={handleAddWod} className="btn-sm btn-primary">
                      Add WOD
                    </button>
                  </div>
                  
                  {formData.workouts.length > 0 && (
                    <div className="wod-list">
                      {formData.workouts.map((wod, index) => (
                        <div key={wod.wodId} className="wod-item">
                          <div className="wod-info">
                            <strong>{wod.name}</strong> - {wod.format}
                            {wod.timeLimit && <span> ({wod.timeLimit})</span>}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => removeWod(wod.wodId)}
                            className="btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingEvent ? 'Update' : 'Create'}
                </button>
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      <style jsx>{`
        .event-management {
          padding: 0;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }
        .event-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .status {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .status.upcoming { background: #e3f2fd; color: #1976d2; }
        .status.active { background: #e8f5e8; color: #2e7d32; }
        .status.completed { background: #f3e5f5; color: #7b1fa2; }
        .event-actions {
          display: flex;
          gap: 8px;
          margin-top: 15px;
        }
        .btn-primary, .btn-success, .btn-warning, .btn-outline, .btn-danger {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: #212529; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-outline { background: transparent; border: 1px solid #007bff; color: #007bff; }
        .btn-primary:disabled, .btn-success:disabled, .btn-warning:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .modal {
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
          padding: 30px;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .wod-section {
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          background: #f9f9f9;
        }
        .wod-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .wod-list {
          margin-top: 10px;
        }
        .wod-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 3px;
          margin-bottom: 5px;
        }
        .wod-modal {
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
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
        .modal {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          max-width: 500px;
          width: 90%;
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
        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
          border-radius: 3px;
          border: 1px solid;
          cursor: pointer;
        }
        .btn-primary {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }
        .btn-outline {
          background: white;
          color: #007bff;
          border-color: #007bff;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }
        .event-description {
          color: #666;
          margin: 10px 0;
          font-size: 14px;
        }
        .event-stats {
          margin: 10px 0;
          font-size: 14px;
          color: #007bff;
        }
        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }
          .events-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .event-card {
            padding: 15px;
          }
          .event-actions {
            flex-direction: column;
            gap: 8px;
          }
          .modal {
            width: 95%;
            margin: 10px;
            max-height: 90vh;
          }
          .form-row {
            flex-direction: column;
          }
          .wod-modal {
            width: 95%;
            max-width: none;
          }
          .movement-row {
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default EventManagement;
