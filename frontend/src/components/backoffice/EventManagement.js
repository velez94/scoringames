import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    description: '',
    maxParticipants: 100,
    registrationDeadline: '',
    workouts: []
  });

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

  const createEvent = async (e) => {
    e.preventDefault();
    try {
      await API.post('CalisthenicsAPI', '/events', { body: newEvent });
      setShowCreateForm(false);
      setNewEvent({ name: '', date: '', description: '', maxParticipants: 100, registrationDeadline: '', workouts: [] });
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
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

  return (
    <div className="event-management">
      <div className="page-header">
        <h1>Event Management</h1>
        <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
          Create Event
        </button>
      </div>

      <div className="events-grid">
        {events.map(event => (
          <div key={event.eventId} className="event-card">
            <div className="event-header">
              <h3>{event.name}</h3>
              <span className={`status ${event.status}`}>{event.status}</span>
            </div>
            <p className="event-date">{new Date(event.date).toLocaleDateString()}</p>
            <div className="event-actions">
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
              <button className="btn-outline">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {showCreateForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Create New Event</h3>
            <form onSubmit={createEvent}>
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Max Participants</label>
                  <input
                    type="number"
                    value={newEvent.maxParticipants}
                    onChange={(e) => setNewEvent({...newEvent, maxParticipants: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">Create</button>
                <button type="button" className="btn-outline" onClick={() => setShowCreateForm(false)}>
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
        .btn-primary, .btn-success, .btn-warning, .btn-outline {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: #212529; }
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
      `}</style>
    </div>
  );
}

export default EventManagement;
