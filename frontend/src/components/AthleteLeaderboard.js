import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function AthleteLeaderboard({ userProfile }) {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [wods, setWods] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  
  // New tournament-related state
  const [leaderboardType, setLeaderboardType] = useState('general'); // 'general', 'tournament', 'combined'
  const [publishedSchedules, setPublishedSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (userProfile?.categoryId && !selectedCategory) {
      setSelectedCategory(userProfile.categoryId);
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventScores();
      fetchEventWods();
      fetchPublishedSchedules(); // New: Load tournament schedules
      
      // Auto-refresh every 5 seconds, but only when tab is visible
      const interval = setInterval(() => {
        if (!document.hidden) {
          fetchEventScores();
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (allScores.length > 0) {
      calculateLeaderboard();
    }
  }, [selectedCategory, athletes, allScores]);

  const fetchData = async () => {
    try {
      const [eventsRes, athletesRes, categoriesRes] = await Promise.all([
        API.get('CalisthenicsAPI', '/public/events'),
        API.get('CalisthenicsAPI', '/athletes'),
        API.get('CalisthenicsAPI', '/categories')
      ]);
      
      setEvents(eventsRes || []);
      setAthletes(athletesRes || []);
      setCategories(categoriesRes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchPublishedSchedules = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/scheduler/${selectedEvent.eventId}`);
      const schedules = Array.isArray(response) ? response.filter(s => s.published) : [];
      setPublishedSchedules(schedules);
      
      if (schedules.length > 0 && !selectedSchedule) {
        setSelectedSchedule(schedules[0]);
      }
    } catch (error) {
      console.error('Error fetching published schedules:', error);
      setPublishedSchedules([]);
    }
  };

  const fetchLeaderboard = async () => {
    if (!selectedEvent) return;

    try {
      let endpoint;
      let params = {};

      switch (leaderboardType) {
        case 'general':
          endpoint = `/scores/leaderboard/${selectedEvent.eventId}`;
          break;
        case 'tournament':
          if (!selectedSchedule) return;
          endpoint = `/tournament-leaderboard/${selectedEvent.eventId}/${selectedSchedule.scheduleId}`;
          break;
        case 'combined':
          if (!selectedSchedule) return;
          endpoint = `/leaderboard-integration/${selectedEvent.eventId}/${selectedSchedule.scheduleId}`;
          params = { type: 'combined' };
          break;
        default:
          endpoint = `/scores/leaderboard/${selectedEvent.eventId}`;
      }

      const response = await API.get('CalisthenicsAPI', endpoint, {
        queryStringParameters: params
      });

      setLeaderboard(response.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    }
  };

  // Update existing useEffect to include leaderboard fetching
  useEffect(() => {
    if (selectedEvent) {
      fetchEventScores();
      fetchEventWods();
      fetchPublishedSchedules();
      fetchLeaderboard(); // New: Fetch appropriate leaderboard
    }
  }, [selectedEvent, leaderboardType, selectedSchedule]);

  const fetchEventScores = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/public/scores?eventId=${selectedEvent.eventId}`);
      setAllScores(response || []);
    } catch (error) {
      console.error('Error fetching scores:', error);
      setAllScores([]);
    }
  };

  const fetchEventWods = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/wods?eventId=${selectedEvent.eventId}`);
      setWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
      setWods([]);
    }
  };

  const calculateLeaderboard = () => {
    if (!selectedCategory || allScores.length === 0) {
      setLeaderboard([]);
      return;
    }

    // Filter athletes by selected category
    const filteredAthletes = athletes.filter(athlete => athlete.categoryId === selectedCategory);
    
    // Create a map of all possible athlete identifiers
    const athleteIdMap = new Map();
    filteredAthletes.forEach(athlete => {
      athleteIdMap.set(athlete.athleteId, athlete);
      athleteIdMap.set(athlete.userId, athlete);
      if (athlete.email) athleteIdMap.set(athlete.email, athlete);
    });
    
    // Filter scores to only include athletes from selected category
    const filteredScores = allScores.filter(score => {
      if (!score || !score.athleteId) return false;
      const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
      return athleteIdMap.has(actualAthleteId);
    });

    const athletePoints = {};
    
    // Group scores by workout
    const workoutScores = {};
    filteredScores.forEach(score => {
      if (!workoutScores[score.wodId]) {
        workoutScores[score.wodId] = [];
      }
      workoutScores[score.wodId].push(score);
    });

    // Calculate points for each workout
    Object.entries(workoutScores).forEach(([wodId, wodScores]) => {
      // Sort by score (descending - higher is better)
      const sortedScores = wodScores.sort((a, b) => b.score - a.score);
      
      // Assign points: 1st = 100, 2nd = 99, etc.
      sortedScores.forEach((score, index) => {
        const points = Math.max(100 - index, 1); // Minimum 1 point
        const position = index + 1;
        const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
        
        if (!athletePoints[actualAthleteId]) {
          const athlete = athletes.find(a => 
            a.athleteId === actualAthleteId || 
            a.userId === actualAthleteId || 
            a.email === actualAthleteId
          );
          athletePoints[actualAthleteId] = {
            athlete,
            totalPoints: 0,
            workoutCount: 0,
            workouts: []
          };
        }
        
        athletePoints[actualAthleteId].totalPoints += points;
        athletePoints[actualAthleteId].workoutCount += 1;
        athletePoints[actualAthleteId].workouts.push({
          wodId,
          workoutName: wods.find(w => w.wodId === wodId)?.name || `WOD ${wodId}`,
          position,
          points
        });
      });
    });

    const sortedLeaderboard = Object.values(athletePoints)
      .filter(entry => entry.workoutCount > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({
        ...entry,
        position: index + 1
      }));

    setLeaderboard(sortedLeaderboard);
  };

  const isCurrentUser = (athleteId) => {
    return userProfile?.athleteId === athleteId;
  };

  const toggleCard = (athleteId) => {
    setExpandedCards(prev => ({
      ...prev,
      [athleteId]: !prev[athleteId]
    }));
  };

  const handleManualRefresh = async () => {
    if (selectedEvent) {
      await fetchEventScores();
    }
  };

  return (
    <div className="athlete-leaderboard">
      <div className="leaderboard-controls">
        <div className="control-group">
          <label>Event:</label>
          <select 
            value={selectedEvent?.eventId || ''} 
            onChange={(e) => {
              const event = events.find(ev => ev.eventId === e.target.value);
              setSelectedEvent(event);
            }}
          >
            <option value="">Select an event</option>
            {events.map(event => (
              <option key={event.eventId} value={event.eventId}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Category:</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {!selectedCategory && <option value="">Select Category</option>}
            {categories.map(category => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <button className="refresh-btn" onClick={handleManualRefresh}>
            🔄 Refresh
          </button>
        )}
      </div>

      {selectedEvent && (
        <div className="leaderboard-content">
          <h3>
            🏆 {selectedEvent.name} - {categories.find(c => c.categoryId === selectedCategory)?.name || 'Select a category'}
          </h3>
          
          {leaderboard.length > 0 ? (
            <div className="leaderboard-cards">
              {leaderboard.map((entry) => (
                <div 
                  key={entry.athlete.athleteId} 
                  className={`leaderboard-card ${isCurrentUser(entry.athlete.athleteId) ? 'current-user' : ''}`}
                >
                  <div className="card-header">
                    <div className="position-badge">
                      <span className="position-number">#{entry.position}</span>
                    </div>
                    <div className="athlete-info">
                      <h4 className="athlete-name">
                        {entry.athlete.firstName} {entry.athlete.lastName}
                        {entry.athlete.alias && <span className="alias">({entry.athlete.alias})</span>}
                      </h4>
                      {isCurrentUser(entry.athlete.athleteId) && <span className="you-badge">YOU</span>}
                    </div>
                  </div>
                  <div className="card-stats">
                    <div className="stat-item">
                      <span className="stat-value">{entry.totalPoints}</span>
                      <span className="stat-label">Total Points</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{entry.workoutCount}</span>
                      <span className="stat-label">Workouts</span>
                    </div>
                    {entry.workouts && entry.workouts.length > 0 && (
                      <button 
                        className="expand-btn"
                        onClick={() => toggleCard(entry.athlete.athleteId)}
                      >
                        {expandedCards[entry.athlete.athleteId] ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                  {expandedCards[entry.athlete.athleteId] && entry.workouts && entry.workouts.length > 0 && (
                    <div className="workout-details">
                      {entry.workouts.map((wod, idx) => (
                        <div key={idx} className="wod-result">
                          <span className="wod-name">{wod.workoutName}</span>
                          <div className="wod-stats">
                            <span className="wod-position">#{wod.position}</span>
                            <span className="wod-points">{wod.points}pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-scores">
              <div className="no-scores-icon">📊</div>
              <p>No scores available for this event and category.</p>
              <p className="no-scores-subtitle">Check back after athletes complete their workouts!</p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .athlete-leaderboard {
          padding: 20px 0;
        }
        .leaderboard-controls {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .refresh-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        .refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .refresh-btn:active {
          transform: translateY(0);
        }
        .control-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .control-group label {
          font-weight: bold;
          color: #333;
        }
        .control-group select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          min-width: 200px;
        }
        .leaderboard-content h3 {
          margin-bottom: 25px;
          color: #333;
          font-size: 24px;
          text-align: center;
        }
        .leaderboard-cards {
          display: grid;
          gap: 15px;
        }
        .leaderboard-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border: 1px solid #e9ecef;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .leaderboard-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.15);
        }
        .leaderboard-card.current-user {
          background: linear-gradient(135deg, #e3f2fd, #f8f9fa);
          border-left: 4px solid #2196f3;
          box-shadow: 0 4px 12px rgba(33,150,243,0.2);
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }
        .position-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(102,126,234,0.3);
        }
        .position-number {
          font-size: 16px;
        }
        .athlete-info {
          flex: 1;
        }
        .athlete-name {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .alias {
          color: #666;
          font-weight: normal;
          font-size: 14px;
        }
        .you-badge {
          background: #2196f3;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .card-stats {
          display: flex;
          gap: 30px;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        .expand-btn {
          position: absolute;
          right: 0;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .expand-btn:hover {
          background: #e9ecef;
          transform: scale(1.1);
        }
        .stat-item {
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
          line-height: 1;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .workout-details {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
        }
        .wod-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 6px;
          margin-bottom: 8px;
        }
        .wod-result:last-child {
          margin-bottom: 0;
        }
        .wod-name {
          font-size: 14px;
          font-weight: 500;
          color: #495057;
        }
        .wod-stats {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .wod-position {
          background: #667eea;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        .wod-points {
          color: #28a745;
          font-weight: bold;
          font-size: 14px;
        }
        .no-scores {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          border: 2px dashed #dee2e6;
        }
        .no-scores-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .no-scores p {
          margin: 10px 0;
          color: #666;
        }
        .no-scores-subtitle {
          font-size: 14px;
          color: #999;
        }
        @media (max-width: 768px) {
          .leaderboard-controls {
            flex-direction: column;
          }
          .control-group select {
            min-width: 100%;
          }
          .leaderboard-content h3 {
            font-size: 20px;
          }
          .leaderboard-card {
            padding: 15px;
          }
          .position-badge {
            width: 40px;
            height: 40px;
          }
          .position-number {
            font-size: 14px;
          }
          .athlete-name {
            font-size: 16px;
          }
          .stat-value {
            font-size: 20px;
          }
          .card-stats {
            gap: 20px;
          }
        }
        @media (max-width: 480px) {
          .leaderboard-content h3 {
            font-size: 18px;
          }
          .card-header {
            gap: 10px;
          }
          .athlete-name {
            font-size: 14px;
          }
          .stat-value {
            font-size: 18px;
          }
          .no-scores {
            padding: 40px 15px;
          }
          .no-scores-icon {
            font-size: 36px;
          }
        }
      `}</style>
    </div>
  );
}

export default AthleteLeaderboard;
