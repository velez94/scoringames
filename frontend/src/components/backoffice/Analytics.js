import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function Analytics() {
  const [events, setEvents] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [eventsData, athletesData] = await Promise.all([
        API.get('CalisthenicsAPI', '/events'),
        API.get('CalisthenicsAPI', '/athletes')
      ]);
      
      setEvents(eventsData || []);
      setAthletes(athletesData || []);
      
      // Fetch scores for all events
      let scoresData = [];
      for (const event of eventsData || []) {
        try {
          const eventScores = await API.get('CalisthenicsAPI', `/scores?eventId=${event.eventId}`);
          scoresData = [...scoresData, ...(eventScores || [])];
        } catch (error) {
          console.error(`Error fetching scores for event ${event.eventId}:`, error);
        }
      }
      setAllScores(scoresData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverviewStats = () => {
    const totalWods = events.reduce((sum, event) => sum + (event.workouts?.length || 0), 0);
    const totalScores = allScores.length;
    const activeEvents = events.filter(event => event.status === 'active').length;
    const completedEvents = events.filter(event => event.status === 'completed').length;
    
    return {
      totalEvents: events.length,
      totalAthletes: athletes.length,
      totalWods,
      totalScores,
      activeEvents,
      completedEvents
    };
  };

  const getDivisionStats = () => {
    const divisions = {};
    athletes.forEach(athlete => {
      divisions[athlete.division] = (divisions[athlete.division] || 0) + 1;
    });
    return divisions;
  };

  const getWodFormatStats = () => {
    const formats = {};
    events.forEach(event => {
      event.workouts?.forEach(wod => {
        formats[wod.format] = (formats[wod.format] || 0) + 1;
      });
    });
    return formats;
  };

  const getTopPerformers = () => {
    const athleteScores = {};
    allScores.forEach(score => {
      if (!athleteScores[score.athleteId]) {
        athleteScores[score.athleteId] = {
          totalScore: 0,
          count: 0,
          athlete: athletes.find(a => a.athleteId === score.athleteId)
        };
      }
      athleteScores[score.athleteId].totalScore += score.score;
      athleteScores[score.athleteId].count += 1;
    });

    return Object.values(athleteScores)
      .map(data => ({
        ...data,
        avgScore: data.totalScore / data.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);
  };

  const getEventParticipation = () => {
    return events.map(event => {
      const eventScores = allScores.filter(score => score.eventId === event.eventId);
      const uniqueAthletes = new Set(eventScores.map(score => score.athleteId)).size;
      return {
        eventName: event.name,
        participants: uniqueAthletes,
        totalScores: eventScores.length,
        wodCount: event.workouts?.length || 0
      };
    });
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  const stats = getOverviewStats();
  const divisionStats = getDivisionStats();
  const wodFormatStats = getWodFormatStats();
  const topPerformers = getTopPerformers();
  const eventParticipation = getEventParticipation();

  return (
    <div className="analytics">
      <h1>Competition Analytics</h1>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Events</h3>
          <div className="stat-number">{stats.totalEvents}</div>
          <div className="stat-detail">
            {stats.activeEvents} active, {stats.completedEvents} completed
          </div>
        </div>
        <div className="stat-card">
          <h3>Total Athletes</h3>
          <div className="stat-number">{stats.totalAthletes}</div>
          <div className="stat-detail">Registered participants</div>
        </div>
        <div className="stat-card">
          <h3>Total WODs</h3>
          <div className="stat-number">{stats.totalWods}</div>
          <div className="stat-detail">Across all events</div>
        </div>
        <div className="stat-card">
          <h3>Total Scores</h3>
          <div className="stat-number">{stats.totalScores}</div>
          <div className="stat-detail">Recorded results</div>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Division Distribution */}
        <div className="analytics-card">
          <h3>Athletes by Division</h3>
          <div className="chart-container">
            {Object.entries(divisionStats).map(([division, count]) => (
              <div key={division} className="bar-item">
                <span className="bar-label">{division}</span>
                <div className="bar-container">
                  <div 
                    className="bar" 
                    style={{ width: `${(count / stats.totalAthletes) * 100}%` }}
                  ></div>
                  <span className="bar-value">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WOD Format Distribution */}
        <div className="analytics-card">
          <h3>WOD Formats</h3>
          <div className="chart-container">
            {Object.entries(wodFormatStats).map(([format, count]) => (
              <div key={format} className="bar-item">
                <span className="bar-label">{format}</span>
                <div className="bar-container">
                  <div 
                    className="bar format-bar" 
                    style={{ width: `${(count / stats.totalWods) * 100}%` }}
                  ></div>
                  <span className="bar-value">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div className="analytics-card">
          <h3>Top Performers (Avg Score)</h3>
          <div className="leaderboard">
            {topPerformers.map((performer, index) => (
              <div key={performer.athlete?.athleteId || index} className="performer-item">
                <div className="rank">#{index + 1}</div>
                <div className="performer-info">
                  <div className="name">
                    {performer.athlete ? 
                      `${performer.athlete.firstName} ${performer.athlete.lastName}` : 
                      'Unknown Athlete'
                    }
                  </div>
                  <div className="division">{performer.athlete?.division}</div>
                </div>
                <div className="score">
                  <div className="avg-score">{performer.avgScore.toFixed(1)}</div>
                  <div className="score-count">{performer.count} scores</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Participation */}
        <div className="analytics-card">
          <h3>Event Participation</h3>
          <div className="participation-list">
            {eventParticipation.map((event, index) => (
              <div key={index} className="participation-item">
                <div className="event-info">
                  <div className="event-name">{event.eventName}</div>
                  <div className="event-details">
                    {event.wodCount} WODs • {event.totalScores} total scores
                  </div>
                </div>
                <div className="participation-count">
                  <div className="participant-number">{event.participants}</div>
                  <div className="participant-label">participants</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .analytics {
          padding: 20px;
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
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        .stat-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
          text-transform: uppercase;
        }
        .stat-number {
          font-size: 36px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 5px;
        }
        .stat-detail {
          font-size: 12px;
          color: #888;
        }
        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        .analytics-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .analytics-card h3 {
          margin: 0 0 20px 0;
          color: #333;
        }
        .bar-item {
          margin-bottom: 15px;
        }
        .bar-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 5px;
        }
        .bar-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bar {
          height: 20px;
          background: #007bff;
          border-radius: 10px;
          min-width: 20px;
        }
        .format-bar {
          background: #28a745;
        }
        .bar-value {
          font-size: 12px;
          font-weight: bold;
          color: #666;
        }
        .leaderboard {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .performer-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .rank {
          font-size: 18px;
          font-weight: bold;
          color: #007bff;
          min-width: 30px;
        }
        .performer-info {
          flex: 1;
        }
        .name {
          font-weight: 500;
          color: #333;
        }
        .division {
          font-size: 12px;
          color: #666;
        }
        .score {
          text-align: right;
        }
        .avg-score {
          font-size: 18px;
          font-weight: bold;
          color: #28a745;
        }
        .score-count {
          font-size: 11px;
          color: #666;
        }
        .participation-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .participation-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .event-name {
          font-weight: 500;
          color: #333;
        }
        .event-details {
          font-size: 12px;
          color: #666;
          margin-top: 2px;
        }
        .participation-count {
          text-align: center;
        }
        .participant-number {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
        }
        .participant-label {
          font-size: 11px;
          color: #666;
        }
        .loading {
          text-align: center;
          padding: 50px;
          font-size: 18px;
        }
        @media (max-width: 768px) {
          .analytics {
            padding: 15px;
          }
          .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
          }
          .analytics-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .stat-number {
            font-size: 28px;
          }
          .performer-item {
            flex-direction: column;
            text-align: center;
            gap: 8px;
          }
          .participation-item {
            flex-direction: column;
            gap: 8px;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}

export default Analytics;
