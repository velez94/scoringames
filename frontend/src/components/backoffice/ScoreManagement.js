import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function ScoreManagement() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [scores, setScores] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchScores();
    }
  }, [selectedEvent]);

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

  const fetchScores = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/scores?eventId=${selectedEvent}`);
      setScores(response);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  return (
    <div className="score-management">
      <div className="page-header">
        <h1>Score Management</h1>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="event-select"
        >
          {events.map(event => (
            <option key={event.eventId} value={event.eventId}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      <div className="scores-table">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Athlete</th>
              <th>Division</th>
              <th>Score</th>
              <th>Time</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scores.sort((a, b) => b.score - a.score).map((score, index) => (
              <tr key={`${score.athleteId}-${score.workoutId}`}>
                <td className="rank">#{index + 1}</td>
                <td>{score.athleteId}</td>
                <td>{score.division}</td>
                <td className="score">{score.score}</td>
                <td>{score.time || '-'}</td>
                <td>{new Date(score.submittedAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn-sm btn-warning">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .score-management {
          padding: 0;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .event-select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .scores-table {
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
          color: #007bff;
        }
        .score {
          font-weight: bold;
        }
        .btn-sm {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }
        .btn-warning {
          background: #ffc107;
          color: #212529;
        }
      `}</style>
    </div>
  );
}

export default ScoreManagement;
