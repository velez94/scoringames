import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function ScoreEntry({ user }) {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [scoreData, setScoreData] = useState({
    athleteId: '',
    wodId: '',
    categoryId: '',
    dayId: '',
    score: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const userRole = user?.attributes?.['custom:role'] || 'athlete';
  const organizerId = user?.attributes?.sub;

  useEffect(() => {
    fetchEvents();
    fetchCategories();
  }, []);

  useEffect(() => {
    const filtered = events.filter(event =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEvents(filtered);
  }, [searchTerm, events]);

  useEffect(() => {
    if (selectedEvent) {
      fetchWods(selectedEvent.eventId);
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/competitions');
      const userEvents = response.filter(event => 
        event.organizerId === organizerId && 
        (event.status === 'active' || event.status === 'upcoming')
      );
      setEvents(userEvents);
      setFilteredEvents(userEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchWods = async (eventId) => {
    try {
      const response = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      setWods(response);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const submitScore = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      await API.post('CalisthenicsAPI', `/scores`, {
        body: {
          ...scoreData,
          score: parseFloat(scoreData.score)
        }
      });
      
      setMessage('Score submitted successfully!');
      setScoreData({ athleteId: '', wodId: '', categoryId: '', dayId: '', score: '' });
    } catch (error) {
      console.error('Error submitting score:', error);
      setMessage('Error submitting score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (userRole === 'athlete') {
    return (
      <div className="score-entry">
        <h1>Score Entry</h1>
        <div className="access-denied">
          <p>Score entry is restricted to judges and organizers only.</p>
          <p>Please contact an event organizer if you need to submit scores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="score-entry">
      <h1>Score Entry</h1>
      
      {!selectedEvent ? (
        <div className="event-selection">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search events by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {filteredEvents.length === 0 ? (
            <div className="no-events">
              <p>No events found. You can only enter scores for events you organize.</p>
            </div>
          ) : (
            <div className="events-grid">
              {filteredEvents.map(event => (
                <div key={event.eventId} className="event-card" onClick={() => setSelectedEvent(event)}>
                  <h3>{event.name}</h3>
                  <p className="event-date">{new Date(event.startDate).toLocaleDateString()}</p>
                  <p className="event-location">{event.location}</p>
                  <span className={`status-badge ${event.status}`}>{event.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="score-form-container">
          <div className="selected-event-header">
            <div>
              <h2>{selectedEvent.name}</h2>
              <p>{selectedEvent.location} • {new Date(selectedEvent.startDate).toLocaleDateString()}</p>
            </div>
            <button className="btn-secondary" onClick={() => setSelectedEvent(null)}>Change Event</button>
          </div>

          <form onSubmit={submitScore} className="score-form">
            <div className="form-row">
              <div className="form-group">
                <label>Athlete ID *</label>
                <input
                  type="text"
                  value={scoreData.athleteId}
                  onChange={(e) => setScoreData({...scoreData, athleteId: e.target.value})}
                  placeholder="athlete-1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  value={scoreData.categoryId}
                  onChange={(e) => setScoreData({...scoreData, categoryId: e.target.value})}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.categoryId} value={cat.categoryId}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>WOD *</label>
                <select
                  value={scoreData.wodId}
                  onChange={(e) => {
                    const wod = wods.find(w => w.wodId === e.target.value);
                    setScoreData({...scoreData, wodId: e.target.value, dayId: wod?.dayId || ''});
                  }}
                  required
                >
                  <option value="">Select WOD</option>
                  {wods.map(wod => (
                    <option key={wod.wodId} value={wod.wodId}>{wod.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Score *</label>
                <input
                  type="number"
                  step="0.01"
                  value={scoreData.score}
                  onChange={(e) => setScoreData({...scoreData, score: e.target.value})}
                  placeholder="Enter score"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Score'}
            </button>

            {message && (
              <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
          </form>
        </div>
      )}

      <style jsx>{`
        .score-entry {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .access-denied {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          margin-top: 40px;
        }
        .event-selection {
          margin-top: 20px;
        }
        .search-box {
          margin-bottom: 20px;
        }
        .search-box input {
          width: 100%;
          padding: 12px 20px;
          font-size: 16px;
          border: 2px solid #ddd;
          border-radius: 8px;
        }
        .search-box input:focus {
          outline: none;
          border-color: #007bff;
        }
        .no-events {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .event-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .event-card h3 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .event-date, .event-location {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          margin-top: 10px;
        }
        .status-badge.active {
          background: #d4edda;
          color: #155724;
        }
        .status-badge.upcoming {
          background: #fff3cd;
          color: #856404;
        }
        .selected-event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .selected-event-header h2 {
          margin: 0;
        }
        .selected-event-header p {
          margin: 5px 0 0 0;
          color: #666;
        }
        .score-form-container {
          margin-top: 20px;
        }
        .score-form {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .form-group {
          margin-bottom: 20px;
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
          color: #333;
        }
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }
        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        .btn-primary, .btn-secondary {
          padding: 12px 30px;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
        }
        .btn-primary {
          background: #007bff;
          color: white;
          width: 100%;
          margin-top: 10px;
        }
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }
        .message {
          margin-top: 15px;
          padding: 10px;
          border-radius: 4px;
          text-align: center;
        }
        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        @media (max-width: 768px) {
          .events-grid {
            grid-template-columns: 1fr;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .selected-event-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
        }
      `}</style>
    </div>
  );
}

export default ScoreEntry;
