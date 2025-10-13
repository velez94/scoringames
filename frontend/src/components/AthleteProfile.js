import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function AthleteProfile({ user, signOut }) {
  const [profile, setProfile] = useState({
    name: user?.attributes?.given_name + ' ' + user?.attributes?.family_name,
    email: user?.attributes?.email,
    division: user?.attributes?.['custom:division'] || 'Male RX',
    personalBests: {},
    competitions: []
  });
  const [activeTab, setActiveTab] = useState('profile');
  const [events, setEvents] = useState([]);

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

  const updateProfile = async (updates) => {
    try {
      // Update profile logic here
      setProfile({ ...profile, ...updates });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="athlete-profile">
      <header className="profile-header">
        <div className="header-content">
          <div className="profile-info">
            <div className="avatar">
              {profile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h1>{profile.name}</h1>
              <p>{profile.division}</p>
            </div>
          </div>
          <button onClick={signOut} className="sign-out">Sign Out</button>
        </div>
      </header>

      <nav className="profile-nav">
        <button 
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button 
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          My Events
        </button>
        <button 
          className={activeTab === 'results' ? 'active' : ''}
          onClick={() => setActiveTab('results')}
        >
          Results
        </button>
        <button 
          className={activeTab === 'leaderboard' ? 'active' : ''}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </nav>

      <main className="profile-content">
        {activeTab === 'profile' && (
          <div className="profile-tab">
            <div className="card">
              <h3>Personal Information</h3>
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  value={profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Division</label>
                <select 
                  value={profile.division}
                  onChange={(e) => updateProfile({ division: e.target.value })}
                >
                  <option value="Male RX">Male RX</option>
                  <option value="Female RX">Female RX</option>
                  <option value="Male Scaled">Male Scaled</option>
                  <option value="Female Scaled">Female Scaled</option>
                </select>
              </div>
            </div>

            <div className="card">
              <h3>Personal Bests</h3>
              <div className="stats-grid">
                <div className="stat">
                  <span className="stat-value">150</span>
                  <span className="stat-label">Max Pull-ups</span>
                </div>
                <div className="stat">
                  <span className="stat-value">300</span>
                  <span className="stat-label">Max Push-ups</span>
                </div>
                <div className="stat">
                  <span className="stat-value">5:30</span>
                  <span className="stat-label">Best 1K Run</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="events-tab">
            <h3>Upcoming Events</h3>
            <div className="events-list">
              {events.filter(e => e.status === 'upcoming').map(event => (
                <div key={event.eventId} className="event-card">
                  <h4>{event.name}</h4>
                  <p>{new Date(event.date).toLocaleDateString()}</p>
                  <button className="btn-primary">Register</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="results-tab">
            <h3>My Competition Results</h3>
            <div className="results-list">
              <div className="result-item">
                <div className="result-event">Summer Challenge 2024</div>
                <div className="result-position">3rd Place</div>
                <div className="result-score">285 points</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="leaderboard-tab">
            <h3>Current Rankings</h3>
            <div className="ranking-card">
              <div className="rank-position">
                <span className="rank-number">#5</span>
                <span className="rank-division">{profile.division}</span>
              </div>
              <div className="rank-stats">
                <div>Total Points: 1,250</div>
                <div>Competitions: 8</div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .athlete-profile {
          min-height: 100vh;
          background: #f8f9fa;
        }
        .profile-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
        }
        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .profile-info {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .avatar {
          width: 60px;
          height: 60px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
        }
        .profile-nav {
          background: white;
          border-bottom: 1px solid #dee2e6;
          padding: 0 20px;
          display: flex;
          gap: 0;
          max-width: 1200px;
          margin: 0 auto;
        }
        .profile-nav button {
          background: none;
          border: none;
          padding: 15px 20px;
          cursor: pointer;
          border-bottom: 3px solid transparent;
        }
        .profile-nav button.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }
        .profile-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 30px 20px;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 25px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
        }
        .stat {
          text-align: center;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: bold;
          color: #007bff;
        }
        .stat-label {
          font-size: 14px;
          color: #666;
        }
        .events-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .event-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn-primary {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .sign-out {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .ranking-card {
          background: white;
          padding: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .rank-number {
          font-size: 48px;
          font-weight: bold;
          color: #007bff;
        }
        .rank-division {
          display: block;
          font-size: 14px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default AthleteProfile;
