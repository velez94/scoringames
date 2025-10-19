import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useOrganization } from '../../contexts/OrganizationContext';
import './Backoffice.css';

function Leaderboard() {
  const { selectedOrganization } = useOrganization();
  const [view, setView] = useState('wod'); // 'wod' or 'general'
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wods, setWods] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedWod, setSelectedWod] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedOrganization) {
      fetchEvents();
    }
    fetchCategories();
    fetchAthletes();
  }, [selectedOrganization]);

  useEffect(() => {
    if (selectedEvent) {
      fetchWods();
      fetchScores();
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent && (selectedWod || view === 'general')) {
      fetchScores();
    }
  }, [selectedWod, selectedCategory]);

  const fetchEvents = async () => {
    if (!selectedOrganization) return;
    try {
      const response = await API.get('CalisthenicsAPI', '/competitions', {
        queryStringParameters: { organizationId: selectedOrganization.organizationId }
      });
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
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
      const response = await API.get('CalisthenicsAPI', `/wods?eventId=${selectedEvent.eventId}`);
      setWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchScores = async () => {
    setLoading(true);
    try {
      const response = await API.get('CalisthenicsAPI', `/scores?eventId=${selectedEvent.eventId}`);
      setScores(response || []);
    } catch (error) {
      console.error('Error fetching scores:', error);
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  const getWodLeaderboard = () => {
    if (!selectedWod) return [];
    
    let filtered = scores.filter(s => s.wodId === selectedWod.wodId);
    if (selectedCategory) {
      filtered = filtered.filter(s => s.categoryId === selectedCategory);
    }
    
    return filtered.sort((a, b) => b.score - a.score);
  };

  const getGeneralLeaderboard = () => {
    const athletePoints = {};
    
    const filtered = selectedCategory 
      ? scores.filter(s => s.categoryId === selectedCategory)
      : scores;

    const byWod = {};
    filtered.forEach(score => {
      if (!byWod[score.wodId]) byWod[score.wodId] = [];
      byWod[score.wodId].push(score);
    });

    Object.values(byWod).forEach(wodScores => {
      const sorted = wodScores.sort((a, b) => b.score - a.score);
      sorted.forEach((score, idx) => {
        const points = Math.max(100 - idx, 1);
        if (!athletePoints[score.athleteId]) {
          athletePoints[score.athleteId] = {
            athleteId: score.athleteId,
            categoryId: score.categoryId,
            totalPoints: 0,
            wodResults: []
          };
        }
        athletePoints[score.athleteId].totalPoints += points;
        const wod = wods.find(w => w.wodId === score.wodId);
        athletePoints[score.athleteId].wodResults.push({
          wodName: wod?.name || score.wodId,
          position: idx + 1,
          points,
          score: score.score
        });
      });
    });

    return Object.values(athletePoints)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((a, idx) => ({ ...a, rank: idx + 1 }));
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  };

  const getAthleteName = (athleteId) => {
    const athlete = athletes.find(a => 
      a.athleteId === athleteId || 
      a.userId === athleteId || 
      a.email === athleteId
    );
    if (athlete) {
      return `${athlete.firstName} ${athlete.lastName}`;
    }
    return athleteId;
  };

  const leaderboard = view === 'wod' ? getWodLeaderboard() : getGeneralLeaderboard();

  return (
    <div className="leaderboard">
      <h1>Leaderboard</h1>

      <div className="view-tabs">
        <button 
          className={view === 'wod' ? 'active' : ''} 
          onClick={() => setView('wod')}
        >
          WOD Leaderboard
        </button>
        <button 
          className={view === 'general' ? 'active' : ''} 
          onClick={() => setView('general')}
        >
          General Leaderboard
        </button>
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Event</label>
          <select 
            value={selectedEvent?.eventId || ''} 
            onChange={(e) => {
              const event = events.find(ev => ev.eventId === e.target.value);
              setSelectedEvent(event);
              setSelectedWod(null);
            }}
          >
            <option value="">Select Event</option>
            {events.map(event => (
              <option key={event.eventId} value={event.eventId}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {view === 'wod' && selectedEvent && (
          <div className="form-group">
            <label>WOD</label>
            <select 
              value={selectedWod?.wodId || ''} 
              onChange={(e) => {
                const wod = wods.find(w => w.wodId === e.target.value);
                setSelectedWod(wod);
              }}
            >
              <option value="">Select WOD</option>
              {wods.map(wod => (
                <option key={wod.wodId} value={wod.wodId}>
                  {wod.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Category</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.categoryId} value={cat.categoryId}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="no-data">No scores available</div>
      ) : (
        <div className="leaderboard-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Athlete</th>
                <th>Category</th>
                {view === 'wod' ? (
                  <th>Score</th>
                ) : (
                  <>
                    <th>Total Points</th>
                    <th>WOD Results</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => {
                const rank = view === 'wod' ? idx + 1 : entry.rank;
                const category = categories.find(c => c.categoryId === entry.categoryId);
                
                return (
                  <tr key={entry.athleteId} className={getRankClass(rank)}>
                    <td className="rank-cell">
                      <span className={`rank-badge ${getRankClass(rank)}`}>
                        #{rank}
                      </span>
                    </td>
                    <td className="athlete-cell">{getAthleteName(entry.athleteId)}</td>
                    <td>{category?.name || 'N/A'}</td>
                    {view === 'wod' ? (
                      <td className="score-cell">{entry.score}</td>
                    ) : (
                      <>
                        <td className="points-cell">{entry.totalPoints}</td>
                        <td className="results-cell">
                          {entry.wodResults.map((r, i) => (
                            <div key={i} className="wod-result">
                              <span>{r.wodName}</span>
                              <span>#{r.position} ({r.points}pts)</span>
                            </div>
                          ))}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .leaderboard {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .leaderboard h1 {
          margin: 0 0 25px 0;
          color: #2c3e50;
          font-size: 28px;
          font-weight: 600;
        }
        .view-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 25px;
          background: white;
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          width: fit-content;
        }
        .view-tabs button {
          padding: 12px 24px;
          border: none;
          background: transparent;
          color: #6c757d;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          position: relative;
        }
        .view-tabs button:hover {
          color: #495057;
          background: #f8f9fa;
        }
        .view-tabs button.active {
          background: #007bff;
          color: white;
          box-shadow: 0 2px 8px rgba(0,123,255,0.3);
        }
        .filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 25px;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #495057;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          font-size: 14px;
          color: #495057;
          background: white;
          transition: all 0.2s;
          cursor: pointer;
        }
        .form-group select:hover {
          border-color: #ced4da;
        }
        .form-group select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
        }
        .loading, .no-data {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          color: #6c757d;
          font-size: 15px;
        }
        .leaderboard-table {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          padding: 16px;
          text-align: left;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: none;
        }
        td {
          padding: 16px;
          border-bottom: 1px solid #f1f3f5;
        }
        tbody tr {
          transition: all 0.2s;
        }
        tbody tr:hover {
          background: #f8f9fa;
          transform: scale(1.01);
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 40px;
          height: 40px;
          border-radius: 50%;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .rank-badge.gold {
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          color: #b8860b;
        }
        .rank-badge.silver {
          background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
          color: #696969;
        }
        .rank-badge.bronze {
          background: linear-gradient(135deg, #cd7f32, #daa520);
          color: #8b4513;
        }
        .rank-badge {
          background: #e9ecef;
          color: #495057;
        }
        tr.gold {
          background: linear-gradient(90deg, rgba(255,215,0,0.08), transparent);
        }
        tr.silver {
          background: linear-gradient(90deg, rgba(192,192,192,0.08), transparent);
        }
        tr.bronze {
          background: linear-gradient(90deg, rgba(205,127,50,0.08), transparent);
        }
        .athlete-cell {
          font-weight: 600;
          color: #2c3e50;
          font-size: 15px;
        }
        .score-cell, .points-cell {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .results-cell {
          max-width: 400px;
        }
        .wod-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: linear-gradient(135deg, #f8f9fa, #e9ecef);
          border-radius: 6px;
          margin-bottom: 6px;
          font-size: 13px;
          border-left: 3px solid #007bff;
        }
        .wod-result span:first-child {
          font-weight: 600;
          color: #495057;
        }
        .wod-result span:last-child {
          color: #6c757d;
          font-weight: 500;
        }
        @media (max-width: 768px) {
          .leaderboard {
            padding: 15px;
          }
          .view-tabs {
            width: 100%;
          }
          .view-tabs button {
            flex: 1;
            padding: 10px 16px;
            font-size: 13px;
          }
          .filters {
            grid-template-columns: 1fr;
            gap: 15px;
            padding: 15px;
          }
          .leaderboard-table {
            overflow-x: auto;
          }
          table {
            min-width: 600px;
          }
          th, td {
            padding: 12px 8px;
            font-size: 13px;
          }
          .rank-badge {
            min-width: 32px;
            height: 32px;
            font-size: 14px;
          }
          .score-cell, .points-cell {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}

export default Leaderboard;
