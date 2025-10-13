import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function ScoreEntry({ user }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [scoreData, setScoreData] = useState({
    athleteId: '',
    workoutId: 'workout-1',
    score: '',
    time: '',
    reps: '',
    division: 'Male RX'
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const divisions = ['Male RX', 'Female RX', 'Male Scaled', 'Female Scaled'];
  const userRole = user?.attributes?.['custom:role'] || 'athlete';

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/events');
      const activeEvents = response.filter(event => event.status === 'active' || event.status === 'upcoming');
      setEvents(activeEvents);
      if (activeEvents.length > 0) {
        setSelectedEvent(activeEvents[0].eventId);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const submitScore = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const submission = {
        ...scoreData,
        eventId: selectedEvent,
        score: parseFloat(scoreData.score) || 0
      };

      await API.post('CalisthenicsAPI', '/scores', { body: submission });
      setMessage('Score submitted successfully!');
      
      // Reset form
      setScoreData({
        athleteId: '',
        workoutId: 'workout-1',
        score: '',
        time: '',
        reps: '',
        division: 'Male RX'
      });
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
      
      <div className="score-form-container">
        <form onSubmit={submitScore} className="score-form">
          <div className="form-group">
            <label>Event</label>
            <select 
              value={selectedEvent} 
              onChange={(e) => setSelectedEvent(e.target.value)}
              required
            >
              <option value="">Select Event</option>
              {events.map(event => (
                <option key={event.eventId} value={event.eventId}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Athlete ID</label>
              <input
                type="text"
                value={scoreData.athleteId}
                onChange={(e) => setScoreData({...scoreData, athleteId: e.target.value})}
                placeholder="Enter athlete ID"
                required
              />
            </div>

            <div className="form-group">
              <label>Division</label>
              <select
                value={scoreData.division}
                onChange={(e) => setScoreData({...scoreData, division: e.target.value})}
                required
              >
                {divisions.map(division => (
                  <option key={division} value={division}>
                    {division}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Workout</label>
            <select
              value={scoreData.workoutId}
              onChange={(e) => setScoreData({...scoreData, workoutId: e.target.value})}
              required
            >
              <option value="workout-1">Workout 1</option>
              <option value="workout-2">Workout 2</option>
              <option value="workout-3">Workout 3</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Score</label>
              <input
                type="number"
                step="0.01"
                value={scoreData.score}
                onChange={(e) => setScoreData({...scoreData, score: e.target.value})}
                placeholder="Enter score"
                required
              />
            </div>

            <div className="form-group">
              <label>Time (optional)</label>
              <input
                type="text"
                value={scoreData.time}
                onChange={(e) => setScoreData({...scoreData, time: e.target.value})}
                placeholder="MM:SS"
              />
            </div>

            <div className="form-group">
              <label>Reps (optional)</label>
              <input
                type="number"
                value={scoreData.reps}
                onChange={(e) => setScoreData({...scoreData, reps: e.target.value})}
                placeholder="Total reps"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary"
            disabled={submitting || !selectedEvent}
          >
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>

          {message && (
            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
        </form>

        <div className="quick-tips">
          <h3>Quick Tips</h3>
          <ul>
            <li>Verify athlete ID before submitting</li>
            <li>Double-check division assignment</li>
            <li>For AMRAP: Enter total reps as score</li>
            <li>For Time: Enter time in MM:SS format</li>
            <li>For weighted workouts: Include weight in score</li>
          </ul>
        </div>
      </div>

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
        .score-form-container {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        .btn-primary {
          background: #007bff;
          color: white;
          padding: 12px 30px;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          margin-top: 10px;
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
        .quick-tips {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          height: fit-content;
        }
        .quick-tips h3 {
          margin-top: 0;
          color: #333;
        }
        .quick-tips ul {
          margin: 0;
          padding-left: 20px;
        }
        .quick-tips li {
          margin-bottom: 8px;
          color: #666;
        }
        @media (max-width: 768px) {
          .score-form-container {
            grid-template-columns: 1fr;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default ScoreEntry;
