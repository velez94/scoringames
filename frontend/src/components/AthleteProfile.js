import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import AthleteLeaderboard from './AthleteLeaderboard';

function AthleteProfile({ user, signOut }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wods, setWods] = useState([]);
  const [scores, setScores] = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [registrations, setRegistrations] = useState([]);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await fetchProfile();
      await fetchEvents();
      await fetchCategories();
      await fetchRegistrations();
      // fetchScores will be called after events are loaded
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Call fetchScores when events are loaded
  useEffect(() => {
    if (events.length > 0) {
      fetchScores();
    }
  }, [events]);

  const fetchProfile = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      const userAthlete = response.find(athlete => 
        athlete.email === user?.attributes?.email
      );
      
      if (userAthlete) {
        setProfile(userAthlete);
      } else {
        setProfile({
          athleteId: user?.attributes?.sub,
          firstName: user?.attributes?.given_name || '',
          lastName: user?.attributes?.family_name || '',
          email: user?.attributes?.email || '',
          categoryId: user?.attributes?.['custom:categoryId'] || null
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile({
        athleteId: user?.attributes?.sub,
        firstName: user?.attributes?.given_name || '',
        lastName: user?.attributes?.family_name || '',
        email: user?.attributes?.email || '',
        categoryId: user?.attributes?.['custom:categoryId'] || null
      });
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/public/events');
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchRegistrations = async () => {
    try {
      // Fetch from athlete-competitions table
      const response = await API.get('CalisthenicsAPI', `/athletes/${user?.attributes?.sub}/competitions`);
      console.log('Fetched registrations:', response);
      setRegistrations(response || []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      setRegistrations([]);
    }
  };

  const handleEditProfile = () => {
    setEditForm({...profile});
    setEditMode(true);
  };

  const handleSaveProfile = async () => {
    try {
      if (profile.athleteId) {
        await API.put('CalisthenicsAPI', `/athletes/${profile.athleteId}`, { body: editForm });
      } else {
        await API.post('CalisthenicsAPI', '/athletes', { body: editForm });
      }
      setProfile(editForm);
      setEditMode(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleRegisterForEvent = async (eventId, categoryId) => {
    try {
      const athleteId = profile.athleteId || user?.attributes?.sub;
      
      await API.post('CalisthenicsAPI', `/athletes/${athleteId}/competitions`, {
        body: {
          eventId,
          categoryId,
          registrationDate: new Date().toISOString()
        }
      });
      
      // Refresh registrations
      await fetchRegistrations();
      alert('Registration successful!');
    } catch (error) {
      console.error('Error registering for event:', error);
      alert('Error registering for event. Please try again.');
    }
  };

  const isRegisteredForEvent = (eventId) => {
    return registrations.some(reg => reg.eventId === eventId || reg.eventId === eventId);
  };

  const fetchScores = async () => {
    try {
      // Get all scores from all events
      let allScoresResponse = [];
      let allWodsResponse = [];
      
      // Fetch scores and WODs for each event
      for (const event of events) {
        try {
          const [eventScores, eventWods] = await Promise.all([
            API.get('CalisthenicsAPI', `/scores?eventId=${event.eventId}`),
            API.get('CalisthenicsAPI', `/wods?eventId=${event.eventId}`)
          ]);
          allScoresResponse = [...allScoresResponse, ...(eventScores || [])];
          allWodsResponse = [...allWodsResponse, ...(eventWods || [])];
        } catch (error) {
          console.error(`Error fetching data for event ${event.eventId}:`, error);
        }
      }
      
      setAllScores(allScoresResponse);
      setWods(allWodsResponse);
      
      // Find athlete's scores using multiple possible IDs
      const possibleAthleteIds = [
        profile?.athleteId,
        user?.attributes?.sub,
        user?.attributes?.email
      ].filter(Boolean);
      
      const athleteScores = allScoresResponse.filter(score => {
        if (!score || !score.athleteId) return false;
        const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
        return possibleAthleteIds.includes(actualAthleteId);
      });
      
      setScores(athleteScores);
    } catch (error) {
      console.error('Error fetching scores:', error);
      setScores([]);
      setAllScores([]);
    }
  };

  const calculatePersonalBests = () => {
    if (!scores.length) return {};
    
    const bests = {};
    scores.forEach(score => {
      if (!score || !score.eventId || !score.wodId) return;
      const key = `${score.eventId}-${score.wodId}`;
      if (!bests[key] || (score.score && score.score > (bests[key]?.score || 0))) {
        bests[key] = score;
      }
    });
    return bests;
  };

  const getAthleteRanking = (eventId, wodId) => {
    const wodScores = allScores.filter(score => 
      score && score.eventId === eventId && score.wodId === wodId
    );
    
    // Sort scores (assuming higher is better for most formats)
    const sortedScores = wodScores.sort((a, b) => (b?.score || 0) - (a?.score || 0));
    
    const possibleAthleteIds = [
      profile?.athleteId,
      user?.attributes?.sub,
      user?.attributes?.email
    ].filter(Boolean);
    
    const athleteRank = sortedScores.findIndex(score => {
      if (!score || !score.athleteId) return false;
      const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
      return possibleAthleteIds.includes(actualAthleteId);
    }) + 1;
    
    return {
      rank: athleteRank || null,
      total: sortedScores.length
    };
  };

  const getEventName = (eventId) => {
    const event = events.find(e => e.eventId === eventId);
    return event?.name || `Event ${eventId}`;
  };

  const getWorkoutName = (eventId, wodId) => {
    const workout = wods.find(w => w.eventId === eventId && w.wodId === wodId);
    return workout?.name || `Workout ${wodId}`;
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="error">Unable to load profile</div>;
  }

  const personalBests = calculatePersonalBests();
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <div className="athlete-profile">
      <header className="profile-header">
        <div className="header-content">
          <div className="profile-info">
            <div className="avatar">
              {fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <h1>{fullName}</h1>
              <p>{categories.find(c => c.categoryId === profile.categoryId)?.name || 'Category not assigned'}</p>
              <p>{profile.email}</p>
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
          className={activeTab === 'competitions' ? 'active' : ''} 
          onClick={() => setActiveTab('competitions')}
        >
          My Competitions
        </button>
        <button 
          className={activeTab === 'scores' ? 'active' : ''} 
          onClick={() => setActiveTab('scores')}
        >
          My Scores
        </button>
        <button 
          className={activeTab === 'events' ? 'active' : ''} 
          onClick={() => setActiveTab('events')}
        >
          All Events
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
            <div className="profile-header-section">
              <h2>Profile Information</h2>
              {!editMode ? (
                <button onClick={handleEditProfile} className="edit-btn">Edit Profile</button>
              ) : (
                <div className="edit-actions">
                  <button onClick={handleSaveProfile} className="save-btn">Save</button>
                  <button onClick={() => setEditMode(false)} className="cancel-btn">Cancel</button>
                </div>
              )}
            </div>

            {editMode ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>First Name</label>
                  <input 
                    value={editForm.firstName || ''} 
                    onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input 
                    value={editForm.lastName || ''} 
                    onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input 
                    type="email"
                    value={editForm.email || ''} 
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input 
                    type="number"
                    min="1"
                    max="100"
                    value={editForm.age || ''} 
                    onChange={(e) => setEditForm({...editForm, age: parseInt(e.target.value) || ''})}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="tel"
                    value={editForm.phone || ''} 
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select 
                    value={editForm.categoryId || ''} 
                    onChange={(e) => setEditForm({...editForm, categoryId: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category.categoryId} value={category.categoryId}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Competitions</h3>
                  <p>{events.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Personal Bests</h3>
                  <p>{Object.keys(personalBests).length}</p>
                </div>
                <div className="stat-card">
                  <h3>Category</h3>
                  <p>{categories.find(c => c.categoryId === profile.categoryId)?.name || 'Not assigned'}</p>
                </div>
              </div>
            )}

            <div className="personal-bests">
              <h3>🏆 Personal Bests</h3>
              {Object.keys(personalBests).length > 0 ? (
                <div className="bests-grid">
                  {Object.values(personalBests).map((best, index) => {
                    if (!best || !best.eventId || !best.wodId) return null;
                    const eventName = getEventName(best.eventId);
                    const workoutName = getWorkoutName(best.eventId, best.wodId);
                    const ranking = getAthleteRanking(best.eventId, best.wodId);
                    
                    return (
                      <div key={index} className="best-card">
                        <div className="best-header">
                          <div className="best-icon">🥇</div>
                          <div className="best-info">
                            <h4>{eventName}</h4>
                            <p className="workout-name">{workoutName}</p>
                          </div>
                        </div>
                        <div className="best-score">
                          <span className="score-value">{best.score}</span>
                          <span className="score-label">points</span>
                        </div>
                        {ranking.rank && (
                          <div className="best-ranking">
                            <span className="rank-badge">#{ranking.rank} of {ranking.total}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-bests">
                  <div className="no-bests-icon">🎯</div>
                  <p>No personal bests recorded yet.</p>
                  <p className="no-bests-subtitle">Complete some workouts to see your achievements here!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'competitions' && (
          <div className="competitions-tab">
            <h3>🏆 My Registered Competitions</h3>
            {registrations.length > 0 ? (
              <div className="competitions-grid">
                {registrations.map((reg) => {
                  const event = events.find(e => e.eventId === reg.eventId);
                  console.log('Registration:', reg, 'Found event:', event);
                  if (!event) return null;
                  
                  return (
                    <div key={reg.eventId || reg.eventId} className="competition-card registered">
                      {event.imageUrl && (
                        <div className="event-banner">
                          <img src={event.imageUrl} alt={event.name} />
                        </div>
                      )}
                      
                      <div className="event-content">
                        <div className="event-header">
                          <h4>{event.name}</h4>
                          <div className={`status-badge ${event.status}`}>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                          </div>
                        </div>
                        
                        <div className="event-details">
                          <p className="event-description">{event.description}</p>
                          
                          <div className="event-meta">
                            <div className="meta-item">
                              <span className="meta-icon">📅</span>
                              <span>{new Date(event.date).toLocaleDateString()}</span>
                            </div>
                            
                            <div className="meta-item">
                              <span className="meta-icon">✅</span>
                              <span>Registered on {new Date(reg.registeredAt || reg.registrationDate).toLocaleDateString()}</span>
                            </div>
                            
                            {reg.categoryId && (
                              <div className="meta-item">
                                <span className="meta-icon">🏆</span>
                                <span>Category: {categories.find(c => c.categoryId === reg.categoryId)?.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="registration-badge">
                          <span className="status-icon">✅</span>
                          <span>You are registered</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-competitions">
                <div className="no-competitions-icon">🎯</div>
                <p>You haven't registered for any competitions yet.</p>
                <p className="no-competitions-subtitle">Check the "All Events" tab to find competitions to join!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scores' && (
          <div className="scores-tab">
            <h3>My Competition Scores</h3>
            
            {scores.length > 0 ? (
              <div className="scores-list">
                {scores.map((score, index) => {
                  const ranking = getAthleteRanking(score.eventId, score.wodId);
                  const eventName = getEventName(score.eventId);
                  const workoutName = getWorkoutName(score.eventId, score.wodId);
                  
                  return (
                    <div key={index} className="score-item">
                      <div className="score-header">
                        <div>
                          <strong>{eventName}</strong>
                          <p>{workoutName}</p>
                          <span className="division-badge">{score.division}</span>
                        </div>
                        {ranking.rank && (
                          <div className="ranking">
                            <span className={`rank rank-${ranking.rank <= 3 ? ranking.rank : 'other'}`}>
                              #{ranking.rank}
                            </span>
                            <span className="total">of {ranking.total}</span>
                          </div>
                        )}
                      </div>
                      <div className="score-details">
                        <div className="score-main">
                          <span className="score-value">{score.score}</span>
                          <span className="score-label">points</span>
                        </div>
                        {score.time && (
                          <div className="score-metric">
                            <span className="metric-value">{score.time}</span>
                            <span className="metric-label">time</span>
                          </div>
                        )}
                        {score.reps && (
                          <div className="score-metric">
                            <span className="metric-value">{score.reps}</span>
                            <span className="metric-label">reps</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-scores">
                <p>No competition scores recorded yet.</p>
                <p>Participate in events to see your results here!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="events-tab">
            <h3>🎯 Competition Events</h3>
            {events.length > 0 ? (
              <div className="events-grid">
                {events.map((event) => {
                  const isRegistered = isRegisteredForEvent(event.eventId);
                  const canRegister = event.status === 'upcoming' && profile.categoryId && !isRegistered;
                  
                  return (
                    <div key={event.eventId} className={`event-card ${isRegistered ? 'registered' : ''}`}>
                      {event.imageUrl && (
                        <div className="event-banner">
                          <img src={event.imageUrl} alt={event.name} />
                        </div>
                      )}
                      
                      <div className="event-content">
                        <div className="event-header">
                          <h4>{event.name}</h4>
                          <div className={`status-badge ${event.status}`}>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                          </div>
                        </div>
                        
                        <div className="event-details">
                          <p className="event-description">{event.description}</p>
                          
                          <div className="event-meta">
                            <div className="meta-item">
                              <span className="meta-icon">📅</span>
                              <span>{new Date(event.date).toLocaleDateString()}</span>
                            </div>
                            
                            {event.maxParticipants && (
                              <div className="meta-item">
                                <span className="meta-icon">👥</span>
                                <span>Max: {event.maxParticipants} participants</span>
                              </div>
                            )}
                            
                            {profile.categoryId && (
                              <div className="meta-item">
                                <span className="meta-icon">🏆</span>
                                <span>Category: {categories.find(c => c.categoryId === profile.categoryId)?.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="event-actions">
                          {isRegistered && (
                            <div className="registration-status registered">
                              <span className="status-icon">✅</span>
                              <span>Registered</span>
                            </div>
                          )}
                          
                          {canRegister && (
                            <button 
                              onClick={() => handleRegisterForEvent(event.eventId, profile.categoryId)}
                              className="register-btn"
                            >
                              Register for Event
                            </button>
                          )}
                          
                          {event.status === 'upcoming' && !profile.categoryId && (
                            <div className="registration-status no-category">
                              <span className="status-icon">⚠️</span>
                              <span>Category assignment required</span>
                            </div>
                          )}
                          
                          {event.status !== 'upcoming' && !isRegistered && (
                            <div className="registration-status unavailable">
                              <span className="status-icon">🔒</span>
                              <span>Registration closed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-events">
                <div className="no-events-icon">📅</div>
                <p>No events available at the moment.</p>
                <p className="no-events-subtitle">Check back later for upcoming competitions!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="leaderboard-tab">
            <h3>Competition Leaderboard</h3>
            <AthleteLeaderboard userProfile={profile} />
          </div>
        )}
      </main>

      <style jsx>{`
        .athlete-profile {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .profile-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .profile-header h1 {
          color: white;
          margin: 0 0 5px 0;
        }
        .profile-header p {
          color: rgba(255,255,255,0.9);
          margin: 3px 0;
        }
        .header-content {
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
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: white;
        }
        .sign-out {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        }
        .profile-nav {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .profile-nav button {
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 5px;
        }
        .profile-nav button.active {
          background: #667eea;
          color: white;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        .personal-bests, .scores-list, .events-list {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .score-item {
          display: flex;
          flex-direction: column;
          padding: 20px;
          border-bottom: 1px solid #eee;
          gap: 15px;
        }
        .score-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .division-badge {
          background: #e9ecef;
          color: #495057;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          margin-top: 5px;
          display: inline-block;
        }
        .ranking {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }
        .rank {
          font-size: 24px;
          font-weight: bold;
          padding: 8px 12px;
          border-radius: 50%;
          min-width: 50px;
          text-align: center;
        }
        .rank-1 { background: #ffd700; color: #b8860b; }
        .rank-2 { background: #c0c0c0; color: #696969; }
        .rank-3 { background: #cd7f32; color: #8b4513; }
        .rank-other { background: #f8f9fa; color: #495057; }
        .total {
          font-size: 12px;
          color: #666;
        }
        .score-details {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .score-main {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .score-value {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
        }
        .score-label, .metric-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .score-metric {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .metric-value {
          font-size: 16px;
          font-weight: bold;
          color: #28a745;
        }
        .no-scores {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .loading, .error {
          text-align: center;
          padding: 50px;
          font-size: 18px;
        }
        .profile-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .edit-actions {
          display: flex;
          gap: 10px;
        }
        .edit-btn, .save-btn, .cancel-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .edit-btn {
          background: #007bff;
          color: white;
        }
        .save-btn {
          background: #28a745;
          color: white;
        }
        .cancel-btn {
          background: #6c757d;
          color: white;
        }
        .edit-form {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input, .form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .registration-section {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        .category-selection {
          margin-top: 10px;
        }
        .category-selection label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .category-selection select {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          min-width: 200px;
        }
        .register-btn {
          background: #28a745;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        .register-btn:hover {
          background: #218838;
        }
        .no-category-message {
          color: #dc3545;
          font-style: italic;
        }
        .form-note {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
        }
        @media (max-width: 768px) {
          .profile-header {
            padding: 15px;
          }
          .header-content {
            flex-direction: column;
            gap: 15px;
          }
          .profile-info {
            flex-direction: column;
            text-align: center;
            gap: 15px;
          }
          .profile-nav {
            flex-wrap: wrap;
            gap: 5px;
          }
          .profile-nav button {
            flex: 1;
            min-width: 80px;
            font-size: 14px;
            padding: 8px 12px;
          }
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .score-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .ranking {
            align-self: flex-end;
          }
          .score-details {
            flex-wrap: wrap;
            gap: 15px;
          }
          .score-item {
            padding: 15px;
          }
        }
        @media (max-width: 480px) {
          .profile-header {
            padding: 10px;
          }
          .avatar {
            width: 35px;
            height: 35px;
            font-size: 12px;
          }
          .profile-nav button {
            font-size: 12px;
            padding: 6px 8px;
            min-width: 70px;
          }
          .stat-card {
            padding: 15px;
          }
          .score-item {
            padding: 12px;
          }
          .rank {
            font-size: 18px;
            min-width: 40px;
            padding: 6px 10px;
          }
        }
        @media (max-width: 320px) {
          .profile-header {
            padding: 8px;
          }
          .profile-nav button {
            font-size: 11px;
            padding: 5px 6px;
            min-width: 60px;
          }
          .score-details {
            flex-direction: column;
            gap: 10px;
          }
        }
        .personal-bests {
          margin-top: 30px;
        }
        .personal-bests h3 {
          margin-bottom: 20px;
          color: #333;
          font-size: 24px;
        }
        .bests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .best-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border: 1px solid #e9ecef;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .best-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.15);
        }
        .best-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }
        .best-icon {
          font-size: 32px;
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(255,215,0,0.3);
        }
        .best-info h4 {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 18px;
          font-weight: 600;
        }
        .workout-name {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        .best-score {
          text-align: center;
          margin: 20px 0;
        }
        .score-value {
          display: block;
          font-size: 36px;
          font-weight: bold;
          color: #007bff;
          line-height: 1;
        }
        .score-label {
          font-size: 14px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .best-ranking {
          text-align: center;
          margin-top: 15px;
        }
        .rank-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .no-bests {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          border: 2px dashed #dee2e6;
        }
        .no-bests-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .no-bests p {
          margin: 10px 0;
          color: #666;
        }
        .no-bests-subtitle {
          font-size: 14px;
          color: #999;
        }
        @media (max-width: 768px) {
          .bests-grid {
            grid-template-columns: 1fr;
          }
          .best-card {
            padding: 15px;
          }
          .best-icon {
            width: 40px;
            height: 40px;
            font-size: 24px;
          }
          .best-info h4 {
            font-size: 16px;
          }
          .score-value {
            font-size: 28px;
          }
        }
        @media (max-width: 480px) {
          .personal-bests h3 {
            font-size: 20px;
          }
          .best-header {
            gap: 10px;
          }
          .score-value {
            font-size: 24px;
          }
          .no-bests {
            padding: 40px 15px;
          }
          .no-bests-icon {
            font-size: 36px;
          }
        }
        .events-tab h3 {
          margin-bottom: 25px;
          color: #333;
          font-size: 24px;
        }
        .competitions-tab h3 {
          margin-bottom: 25px;
          color: #333;
          font-size: 24px;
        }
        .competitions-grid {
          display: grid;
          gap: 20px;
        }
        .competition-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border: 1px solid #e9ecef;
          transition: transform 0.2s, box-shadow 0.2s;
          border-left: 4px solid #28a745;
          background: linear-gradient(135deg, #f8fff9, #ffffff);
        }
        .competition-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.15);
        }
        .registration-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: #e8f5e8;
          color: #2e7d32;
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
        }
        .no-competitions {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          border: 2px dashed #dee2e6;
        }
        .no-competitions-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .no-competitions p {
          margin: 10px 0;
          color: #666;
        }
        .no-competitions-subtitle {
          font-size: 14px;
          color: #999;
        }
        .events-tab h3 {
          margin-bottom: 25px;
          color: #333;
          font-size: 24px;
        }
        .events-grid {
          display: grid;
          gap: 20px;
        }
        .event-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border: 1px solid #e9ecef;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.15);
        }
        .event-card.registered {
          border-left: 4px solid #28a745;
          background: linear-gradient(135deg, #f8fff9, #ffffff);
        }
        .event-banner {
          width: 100%;
          height: 200px;
          overflow: hidden;
          position: relative;
        }
        .event-banner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .event-card:hover .event-banner img {
          transform: scale(1.05);
        }
        .event-content {
          padding: 24px;
        }
        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .event-header h4 {
          margin: 0;
          color: #333;
          font-size: 20px;
          font-weight: 600;
        }
        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-badge.upcoming {
          background: #e3f2fd;
          color: #1976d2;
        }
        .status-badge.active {
          background: #e8f5e8;
          color: #2e7d32;
        }
        .status-badge.completed {
          background: #f3e5f5;
          color: #7b1fa2;
        }
        .event-details {
          margin-bottom: 20px;
        }
        .event-description {
          color: #666;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .event-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #555;
          font-size: 14px;
        }
        .meta-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }
        .event-actions {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .registration-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
        }
        .registration-status.registered {
          background: #e8f5e8;
          color: #2e7d32;
        }
        .registration-status.no-category {
          background: #fff3cd;
          color: #856404;
        }
        .registration-status.unavailable {
          background: #f8d7da;
          color: #721c24;
        }
        .status-icon {
          font-size: 16px;
        }
        .register-btn {
          background: linear-gradient(135deg, #28a745, #20c997);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(40,167,69,0.2);
        }
        .register-btn:hover {
          background: linear-gradient(135deg, #218838, #1ea085);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(40,167,69,0.3);
        }
        .no-events {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          border: 2px dashed #dee2e6;
        }
        .no-events-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .no-events p {
          margin: 10px 0;
          color: #666;
        }
        .no-events-subtitle {
          font-size: 14px;
          color: #999;
        }
        @media (max-width: 768px) {
          .event-card {
            overflow: hidden;
          }
          .event-content {
            padding: 16px;
          }
          .event-banner {
            height: 150px;
          }
          .event-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .event-meta {
            gap: 6px;
          }
          .meta-item {
            font-size: 13px;
          }
          .register-btn {
            width: 100%;
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default AthleteProfile;
