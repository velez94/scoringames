import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function Events({ user }) {
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    workouts: [],
    divisions: ['Male RX', 'Female RX', 'Male Scaled', 'Female Scaled']
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
      setNewEvent({ name: '', date: '', workouts: [], divisions: ['Male RX', 'Female RX', 'Male Scaled', 'Female Scaled'] });
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const userRole = user?.attributes?.['custom:role'] || 'athlete';

  return (
    <div className="events">
      <div className="events-header">
        <h1>Events</h1>
        {userRole === 'organizer' && (
          <button 
            className="btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create Event
          </button>
        )}
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
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">Create</button>
                <button 
                  type="button" 
                  className="btn-outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="events-grid">
        {events.map(event => (
          <div key={event.eventId} className="event-card">
            {event.bannerImage && (
              <div className="event-banner">
                <img src={event.bannerImage} alt={event.name} />
              </div>
            )}
            <div className="event-content">
              <h3>{event.name}</h3>
              <p className="event-date">{new Date(event.date).toLocaleDateString()}</p>
              <p className="event-status">Status: {event.status}</p>
              <div className="event-actions">
                <button className="btn-outline">View Details</button>
                {userRole !== 'athlete' && (
                  <button className="btn-secondary">Manage</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .events {
          padding: 20px;
        }
        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .event-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .event-banner {
          width: 100%;
          height: 120px;
          overflow: hidden;
          background: #f5f5f5;
        }
        .event-banner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .event-content {
          padding: 20px;
        }
        .event-date {
          color: #666;
          margin: 10px 0;
        }
        .event-status {
          font-weight: bold;
          text-transform: capitalize;
        }
        .event-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
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
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input {
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
        .btn-primary, .btn-secondary, .btn-outline {
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn-outline { background: transparent; border: 1px solid #007bff; color: #007bff; }
      `}</style>
    </div>
  );
}

export default Events;
