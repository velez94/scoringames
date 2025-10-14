import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function AthleteProfile({ user, signOut }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [events, setEvents] = useState([]);
  const [scores, setScores] = useState([]);
  const [allScores, setAllScores] = useState([]);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await fetchProfile();
      await fetchEvents();
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
          division: user?.attributes?.['custom:division'] || 'Open'
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile({
        athleteId: user?.attributes?.sub,
        firstName: user?.attributes?.given_name || '',
        lastName: user?.attributes?.family_name || '',
        email: user?.attributes?.email || '',
        division: user?.attributes?.['custom:division'] || 'Open'
      });
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/events');
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    }
  };

  const fetchScores = async () => {
    try {
      // Get all scores from all events
      let allScoresResponse = [];
      
      // Fetch scores for each event
      for (const event of events) {
        try {
          const eventScores = await API.get('CalisthenicsAPI', `/scores?eventId=${event.eventId}`);
          allScoresResponse = [...allScoresResponse, ...(eventScores || [])];
        } catch (error) {
          console.error(`Error fetching scores for event ${event.eventId}:`, error);
        }
      }
      
      setAllScores(allScoresResponse);
      
      // Find athlete's scores using multiple possible IDs
      const possibleAthleteIds = [
        profile?.athleteId,
        user?.attributes?.sub,
        user?.attributes?.email
      ].filter(Boolean);
      
      const athleteScores = allScoresResponse.filter(score => {
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
      const key = `${score.eventId}-${score.workoutId}`;
      if (!bests[key] || score.score > bests[key].score) {
        bests[key] = score;
      }
    });
    return bests;
  };

  const getAthleteRanking = (eventId, workoutId) => {
    const wodScores = allScores.filter(score => 
      score.eventId === eventId && score.workoutId === workoutId
    );
    
    // Sort scores (assuming higher is better for most formats)
    const sortedScores = wodScores.sort((a, b) => b.score - a.score);
    
    const possibleAthleteIds = [
      profile?.athleteId,
      user?.attributes?.sub,
      user?.attributes?.email
    ].filter(Boolean);
    
    const athleteRank = sortedScores.findIndex(score => {
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

  const getWorkoutName = (eventId, workoutId) => {
    const event = events.find(e => e.eventId === eventId);
    const workout = event?.workouts?.find(w => w.wodId === workoutId);
    return workout?.name || `Workout ${workoutId}`;
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
              <p>{profile.division}</p>
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
          className={activeTab === 'scores' ? 'active' : ''} 
          onClick={() => setActiveTab('scores')}
        >
          My Scores
        </button>
        <button 
          className={activeTab === 'events' ? 'active' : ''} 
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
      </nav>

      <main className="profile-content">
        {activeTab === 'profile' && (
          <div className="profile-tab">
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
                <h3>Division</h3>
                <p>{profile.division}</p>
              </div>
            </div>

            <div className="personal-bests">
              <h3>Personal Bests</h3>
              {Object.keys(personalBests).length > 0 ? (
                <div className="bests-list">
                  {Object.values(personalBests).map((best, index) => (
                    <div key={index} className="best-item">
                      <span>Event {best.eventId} - Workout {best.workoutId}</span>
                      <span>{best.score} points</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No personal bests recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'scores' && (
          <div className="scores-tab">
            <h3>My Competition Scores</h3>
            
            {scores.length > 0 ? (
              <div className="scores-list">
                {scores.map((score, index) => {
                  const ranking = getAthleteRanking(score.eventId, score.workoutId);
                  const eventName = getEventName(score.eventId);
                  const workoutName = getWorkoutName(score.eventId, score.workoutId);
                  
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
            <h3>Available Events</h3>
            {events.length > 0 ? (
              <div className="events-list">
                {events.map((event) => (
                  <div key={event.eventId} className="event-item">
                    <h4>{event.name}</h4>
                    <p>{event.description}</p>
                    <p>Date: {new Date(event.date).toLocaleDateString()}</p>
                    <p>Status: {event.status}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No events available.</p>
            )}
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
      `}</style>
    </div>
  );
}

export default AthleteProfile;
