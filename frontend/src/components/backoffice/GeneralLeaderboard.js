import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function GeneralLeaderboard() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wods, setWods] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [generalLeaderboard, setGeneralLeaderboard] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [allScores, setAllScores] = useState([]);

  useEffect(() => {
    fetchEvents();
    fetchAthletes();
    fetchWods();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventScores();
      
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
      calculateGeneralLeaderboard(allScores);
    }
  }, [selectedCategory, athletes, allScores]);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/competitions');
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchAthletes = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      setAthletes(response || []);
    } catch (error) {
      console.error('Error fetching athletes:', error);
    }
  };

  const fetchWods = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/wods');
      setWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchEventScores = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/scores?eventId=${selectedEvent.eventId}`);
      setAllScores(response || []);
      calculateGeneralLeaderboard(response || []);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  const calculateGeneralLeaderboard = (scores) => {
    // Filter athletes by selected category if one is selected
    const filteredAthletes = selectedCategory 
      ? athletes.filter(athlete => athlete.categoryId === selectedCategory)
      : athletes;
    
    const athleteIds = filteredAthletes.map(athlete => athlete.athleteId);
    
    // Filter scores to only include athletes from selected category
    const filteredScores = scores.filter(score => {
      const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
      return athleteIds.includes(actualAthleteId);
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
    Object.values(workoutScores).forEach(wodScores => {
      // Sort by score (descending - higher is better)
      const sortedScores = wodScores.sort((a, b) => b.score - a.score);
      
      // Assign points: 1st = 100, 2nd = 99, etc.
      sortedScores.forEach((score, index) => {
        const points = Math.max(100 - index, 1); // Minimum 1 point
        const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
        
        if (!athletePoints[actualAthleteId]) {
          const athlete = athletes.find(a => a.athleteId === actualAthleteId);
          athletePoints[actualAthleteId] = {
            athleteId: actualAthleteId,
            totalPoints: 0,
            wodResults: [],
            categoryId: athlete?.categoryId
          };
        }
        
        athletePoints[actualAthleteId].totalPoints += points;
        const wod = wods.find(w => w.wodId === score.wodId);
        athletePoints[actualAthleteId].wodResults.push({
          wodId: score.wodId,
          wodName: wod?.name || 'Unknown WOD',
          position: index + 1,
          points: points,
          score: score.score
        });
      });
    });

    // Convert to array and sort by total points
    const leaderboard = Object.values(athletePoints)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((athlete, index) => ({
        ...athlete,
        overallRank: index + 1
      }));

    setGeneralLeaderboard(leaderboard);
  };

  const getAthleteInfo = (athleteId) => {
    return athletes.find(athlete => athlete.athleteId === athleteId);
  };

  const getWorkoutName = (workoutId) => {
    const workout = selectedEvent?.workouts?.find(w => w.wodId === workoutId);
    return workout?.name || `WOD ${workoutId}`;
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'other';
  };

  return (
    <div className="general-leaderboard">
      <h1>General Leaderboard</h1>

      <div className="selection-panel">
        <div className="form-group">
          <label>Select Event</label>
          <select 
            value={selectedEvent?.eventId || ''} 
            onChange={(e) => {
              const event = events.find(ev => ev.eventId === e.target.value);
              setSelectedEvent(event);
            }}
          >
            <option value="">Choose an event...</option>
            {events.map(event => (
              <option key={event.eventId} value={event.eventId}>
                {event.name} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Filter by Category</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.name} ({category.ageRange}, {category.gender})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEvent && (
        <div className="leaderboard-section">
          <div className="event-header">
            <h2>{selectedEvent.name}</h2>
            {selectedCategory && (
              <div className="category-info">
                <span>Category: {categories.find(c => c.categoryId === selectedCategory)?.name}</span>
              </div>
            )}
            <div className="points-info">
              <span>Points System: 1st = 100pts, 2nd = 99pts, 3rd = 98pts...</span>
            </div>
          </div>

          {/* Podium */}
          {generalLeaderboard.length >= 3 && (
            <div className="podium">
              {[1, 0, 2].map(index => {
                const athlete = generalLeaderboard[index];
                const athleteInfo = getAthleteInfo(athlete?.athleteId);
                if (!athlete) return null;
                
                return (
                  <div key={athlete.athleteId} className={`podium-position ${getRankClass(athlete.overallRank)}`}>
                    <div className="podium-rank">#{athlete.overallRank}</div>
                    <div className="podium-athlete">
                      {athleteInfo ? `${athleteInfo.firstName} ${athleteInfo.lastName}` : 'Unknown'}
                    </div>
                    <div className="podium-points">{athlete.totalPoints} pts</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Leaderboard */}
          <div className="full-leaderboard">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Athlete</th>
                  <th>Total Points</th>
                  <th>WOD Results</th>
                </tr>
              </thead>
              <tbody>
                {generalLeaderboard.map((athlete) => {
                  const athleteInfo = getAthleteInfo(athlete.athleteId);
                  return (
                    <tr key={athlete.athleteId} className={`rank-${getRankClass(athlete.overallRank)}`}>
                      <td className="rank-cell">
                        <span className={`rank-badge ${getRankClass(athlete.overallRank)}`}>
                          #{athlete.overallRank}
                        </span>
                      </td>
                      <td className="athlete-cell">
                        {athleteInfo ? `${athleteInfo.firstName} ${athleteInfo.lastName}` : 'Unknown'}
                      </td>
                      <td className="points-cell">{athlete.totalPoints}</td>
                      <td className="results-cell">
                        <div className="wod-results">
                          {athlete.wodResults.map((result, index) => (
                            <div key={index} className="wod-result">
                              <span className="wod-name">{result.wodName}</span>
                              <span className="wod-position">#{result.position} ({result.points}pts)</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .general-leaderboard {
          padding: 20px;
        }
        .selection-panel {
          margin-bottom: 30px;
        }
        .form-group {
          max-width: 400px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .event-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .points-info {
          font-size: 14px;
          color: #666;
          margin-top: 10px;
        }
        .category-info {
          font-size: 16px;
          color: #007bff;
          font-weight: 600;
          margin: 5px 0;
        }
        .podium {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 40px;
          padding: 20px;
        }
        .podium-position {
          text-align: center;
          padding: 20px;
          border-radius: 12px;
          min-width: 180px;
          max-width: 200px;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: transform 0.2s;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }
        .podium-position:hover {
          transform: translateY(-5px);
        }
        .podium-position.gold {
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          color: #b8860b;
          height: 140px;
          order: 2;
        }
        .podium-position.silver {
          background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
          color: #696969;
          height: 120px;
          order: 1;
        }
        .podium-position.bronze {
          background: linear-gradient(135deg, #cd7f32, #daa520);
          color: #8b4513;
          height: 110px;
          order: 3;
        }
        .podium-rank {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .podium-athlete {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 8px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          line-height: 1.2;
          padding: 0 5px;
        }
        .podium-points {
          font-size: 18px;
          font-weight: bold;
        }
        .full-leaderboard table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .full-leaderboard th,
        .full-leaderboard td {
          padding: 16px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        .full-leaderboard th {
          background: #f8f9fa;
          font-weight: bold;
          color: #495057;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        .full-leaderboard tbody tr:hover {
          background: #f8f9fa;
        }
        .rank-cell {
          width: 80px;
        }
        .rank-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
        }
        .rank-badge.gold { background: #ffd700; color: #b8860b; }
        .rank-badge.silver { background: #c0c0c0; color: #696969; }
        .rank-badge.bronze { background: #cd7f32; color: #8b4513; }
        .rank-badge.other { background: #e9ecef; color: #495057; }
        .athlete-cell {
          font-weight: 600;
          color: #212529;
        }
        .points-cell {
          font-size: 20px;
          font-weight: bold;
          color: #007bff;
          width: 120px;
        }
        .results-cell {
          min-width: 250px;
        }
        .wod-results {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .wod-result {
          display: flex;
          justify-content: space-between;
          background: #f8f9fa;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 13px;
        }
        .wod-name {
          font-weight: 600;
          color: #495057;
        }
        .wod-position {
          color: #6c757d;
          font-weight: 500;
        }
        @media (max-width: 768px) {
          .podium {
            flex-direction: column;
            align-items: center;
          }
          .podium-position {
            width: 100%;
            max-width: 200px;
            height: auto !important;
            order: unset !important;
          }
          .full-leaderboard {
            overflow-x: auto;
          }
          .full-leaderboard table {
            min-width: 600px;
          }
          .wod-results {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default GeneralLeaderboard;
