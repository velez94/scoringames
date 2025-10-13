import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function Dashboard({ user }) {
  const [events, setEvents] = useState([]);
  const [recentScores, setRecentScores] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/events');
      setEvents(response.slice(0, 3)); // Show only recent 3 events
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const userRole = user?.attributes?.['custom:role'] || 'athlete';

  return (
    <div className="dashboard">
      <h1>Welcome, {user?.attributes?.given_name}!</h1>
      
      <div className="dashboard-grid">
        <div className="card">
          <h3>Upcoming Events</h3>
          {events.length > 0 ? (
            <ul>
              {events.map(event => (
                <li key={event.eventId}>
                  <strong>{event.name}</strong>
                  <br />
                  <small>{new Date(event.date).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No upcoming events</p>
          )}
        </div>

        <div className="card">
          <h3>Quick Actions</h3>
          <div className="actions">
            {userRole === 'organizer' && (
              <button className="btn-primary">Create Event</button>
            )}
            {(userRole === 'judge' || userRole === 'organizer') && (
              <button className="btn-secondary">Enter Scores</button>
            )}
            <button className="btn-outline">View Leaderboard</button>
          </div>
        </div>

        <div className="card">
          <h3>Your Stats</h3>
          <div className="stats">
            <div className="stat">
              <span className="stat-number">12</span>
              <span className="stat-label">Competitions</span>
            </div>
            <div className="stat">
              <span className="stat-number">3</span>
              <span className="stat-label">Podium Finishes</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          padding: 20px;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
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
        .stats {
          display: flex;
          gap: 20px;
        }
        .stat {
          text-align: center;
        }
        .stat-number {
          display: block;
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
