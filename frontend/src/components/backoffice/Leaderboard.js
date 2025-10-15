import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function Leaderboard() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedWod, setSelectedWod] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [athletes, setAthletes] = useState([]);

  useEffect(() => {
    fetchEvents();
    fetchAthletes();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedEvent && selectedWod) {
      fetchLeaderboard();
    }
  }, [selectedEvent, selectedWod]);

  useEffect(() => {
    if (selectedEvent && selectedWod) {
      fetchLeaderboard();
    }
  }, [selectedCategory]);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/events');
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

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/scores?eventId=${selectedEvent.eventId}`);
      let wodScores = response.filter(score => score.workoutId === selectedWod.wodId);
      
      // Filter by category if selected
      if (selectedCategory) {
        const categoryAthletes = athletes.filter(athlete => athlete.categoryId === selectedCategory);
        const categoryAthleteIds = categoryAthletes.map(athlete => athlete.athleteId);
        
        wodScores = wodScores.filter(score => {
          const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
          return categoryAthleteIds.includes(actualAthleteId);
        });
      }
      
      // Sort by score (descending for most formats)
      const sortedScores = wodScores.sort((a, b) => {
        if (selectedWod.format === 'AMRAP' || selectedWod.format === 'Ladder') {
          return b.score - a.score; // Higher is better
        }
        return a.score - b.score; // Lower is better (time-based)
      });

      setLeaderboard(sortedScores);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const getAthleteInfo = (athleteId) => {
    // Use originalAthleteId if available, fallback to athleteId
    const actualAthleteId = athleteId.includes('#') ? athleteId.split('#')[0] : athleteId;
    const athlete = athletes.find(athlete => athlete.athleteId === actualAthleteId);
    if (!athlete) {
      // Try alternative matching methods
      const athleteByEmail = athletes.find(athlete => athlete.email === actualAthleteId);
      if (athleteByEmail) return athleteByEmail;
      
      // Try partial ID matching for Cognito IDs
      const athleteByPartialId = athletes.find(athlete => 
        athlete.athleteId && actualAthleteId && athlete.athleteId.includes(actualAthleteId.split('-')[0])
      );
      if (athleteByPartialId) return athleteByPartialId;
    }
    return athlete;
  };

  const getRankSuffix = (rank) => {
    if (rank === 1) return 'st';
    if (rank === 2) return 'nd';
    if (rank === 3) return 'rd';
    return 'th';
  };

  return (
    <div className="leaderboard">
      <h1>Leaderboard</h1>

      <div className="selection-panel">
        <div className="form-group">
          <label>Select Event</label>
          <select 
            value={selectedEvent?.eventId || ''} 
            onChange={(e) => {
              const event = events.find(ev => ev.eventId === e.target.value);
              setSelectedEvent(event);
              setSelectedWod(null);
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

        {selectedEvent && selectedEvent.workouts?.length > 0 && (
          <div className="form-group">
            <label>Select Workout</label>
            <select 
              value={selectedWod?.wodId || ''} 
              onChange={(e) => {
                const wod = selectedEvent.workouts.find(w => w.wodId === e.target.value);
                setSelectedWod(wod);
              }}
            >
              <option value="">Choose a workout...</option>
              {selectedEvent.workouts.map(wod => (
                <option key={wod.wodId} value={wod.wodId}>
                  {wod.name} ({wod.format})
                </option>
              ))}
            </select>
          </div>
        )}

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

      {selectedWod && (
        <div className="leaderboard-section">
          <div className="wod-header">
            <h2>{selectedWod.name}</h2>
            <span className="format-badge">{selectedWod.format}</span>
            {selectedCategory && (
              <div className="category-info">
                <span>Category: {categories.find(c => c.categoryId === selectedCategory)?.name}</span>
              </div>
            )}
          </div>

          {leaderboard.length > 0 ? (
            <div className="leaderboard-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Athlete</th>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Time</th>
                    <th>Reps</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((score, index) => {
                    const athlete = getAthleteInfo(score.athleteId);
                    const rank = index + 1;
                    return (
                      <tr key={score.athleteId} className={`rank-${rank <= 3 ? rank : 'other'}`}>
                        <td className="rank-cell">
                          <span className="rank-number">{rank}</span>
                          <span className="rank-suffix">{getRankSuffix(rank)}</span>
                        </td>
                        <td className="athlete-cell">
                          {athlete ? `${athlete.firstName} ${athlete.lastName}` : 
                           `Athlete ID: ${score.athleteId}`}
                        </td>
                        <td>{categories.find(c => c.categoryId === athlete?.categoryId)?.name || 'No Category'}</td>
                        <td className="score-cell">{score.score}</td>
                        <td>{score.time || '-'}</td>
                        <td>{score.reps || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-scores">
              <p>No scores recorded for this workout yet.</p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .leaderboard {
          padding: 20px;
        }
        .selection-panel {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }
        .form-group {
          flex: 1;
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
        .wod-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }
        .format-badge {
          background: #007bff;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 14px;
        }
        .leaderboard-table table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .leaderboard-table th,
        .leaderboard-table td {
          padding: 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        .leaderboard-table th {
          background: #f8f9fa;
          font-weight: bold;
        }
        .rank-cell {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .rank-number {
          font-size: 24px;
          font-weight: bold;
        }
        .rank-suffix {
          font-size: 14px;
          color: #666;
        }
        .rank-1 {
          background: linear-gradient(135deg, #ffd700, #ffed4e);
        }
        .rank-2 {
          background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
        }
        .rank-3 {
          background: linear-gradient(135deg, #cd7f32, #daa520);
        }
        .rank-1 .rank-number { color: #b8860b; }
        .rank-2 .rank-number { color: #696969; }
        .rank-3 .rank-number { color: #8b4513; }
        .athlete-cell {
          font-weight: bold;
        }
        .score-cell {
          font-size: 18px;
          font-weight: bold;
          color: #007bff;
        }
        .no-scores {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        @media (max-width: 768px) {
          .selection-panel {
            flex-direction: column;
          }
          .wod-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .leaderboard-table {
            overflow-x: auto;
          }
          .leaderboard-table table {
            min-width: 600px;
          }
          .rank-cell {
            flex-direction: column;
            gap: 2px;
          }
          .rank-number {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}

export default Leaderboard;
