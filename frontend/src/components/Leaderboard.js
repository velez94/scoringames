import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function Leaderboard() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);

  const divisions = ['Male RX', 'Female RX', 'Male Scaled', 'Female Scaled'];

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchLeaderboard();
    }
  }, [selectedEvent, selectedDivision]);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/events');
      setEvents(response);
      if (response.length > 0) {
        setSelectedEvent(response[0].eventId);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = { eventId: selectedEvent };
      if (selectedDivision) {
        params.division = selectedDivision;
      }
      
      const queryString = new URLSearchParams(params).toString();
      const response = await API.get('CalisthenicsAPI', `/scores/leaderboard?${queryString}`);
      setLeaderboard(response);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return '#f8f9fa';
  };

  return (
    <div className="leaderboard">
      <h1>Leaderboard</h1>
      
      <div className="filters">
        <div className="filter-group">
          <label>Event</label>
          <select 
            value={selectedEvent} 
            onChange={(e) => setSelectedEvent(e.target.value)}
          >
            {events.map(event => (
              <option key={event.eventId} value={event.eventId}>
                {event.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Division</label>
          <select 
            value={selectedDivision} 
            onChange={(e) => setSelectedDivision(e.target.value)}
          >
            <option value="">All Divisions</option>
            {divisions.map(division => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading leaderboard...</div>
      ) : (
        <div className="leaderboard-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Athlete</th>
                <th>Division</th>
                <th>Score</th>
                <th>Time</th>
                <th>Reps</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr 
                  key={`${entry.athleteId}-${entry.workoutId}`}
                  style={{ backgroundColor: getRankColor(index + 1) }}
                >
                  <td className="rank">
                    {index + 1}
                    {index < 3 && <span className="medal">🏆</span>}
                  </td>
                  <td className="athlete-name">{entry.athleteId}</td>
                  <td>{entry.division}</td>
                  <td className="score">{entry.score}</td>
                  <td>{entry.time || '-'}</td>
                  <td>{entry.reps || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {leaderboard.length === 0 && (
            <div className="no-data">
              No scores available for the selected event and division.
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .leaderboard {
          padding: 20px;
        }
        .filters {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .filter-group {
          display: flex;
          flex-direction: column;
        }
        .filter-group label {
          margin-bottom: 5px;
          font-weight: bold;
        }
        .filter-group select {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          min-width: 200px;
        }
        .loading {
          text-align: center;
          padding: 40px;
          font-size: 18px;
        }
        .leaderboard-table {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        th {
          background: #f8f9fa;
          font-weight: bold;
        }
        .rank {
          font-weight: bold;
          text-align: center;
          width: 80px;
        }
        .medal {
          margin-left: 5px;
        }
        .athlete-name {
          font-weight: bold;
        }
        .score {
          font-weight: bold;
          color: #007bff;
        }
        .no-data {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        @media (max-width: 768px) {
          .filters {
            flex-direction: column;
          }
          .filter-group select {
            min-width: auto;
          }
          table {
            font-size: 14px;
          }
          th, td {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default Leaderboard;
