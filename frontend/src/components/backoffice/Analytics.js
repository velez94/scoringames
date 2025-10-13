import React, { useState, useEffect } from 'react';

function Analytics() {
  const [stats, setStats] = useState({
    totalEvents: 12,
    totalAthletes: 245,
    activeEvents: 3,
    completedEvents: 9,
    avgParticipation: 85,
    topDivision: 'Male RX'
  });

  return (
    <div className="analytics">
      <h1>Analytics Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-number">{stats.totalEvents}</div>
            <div className="stat-label">Total Events</div>
          </div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-number">{stats.totalAthletes}</div>
            <div className="stat-label">Total Athletes</div>
          </div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-icon">🏃</div>
          <div className="stat-content">
            <div className="stat-number">{stats.activeEvents}</div>
            <div className="stat-label">Active Events</div>
          </div>
        </div>
        
        <div className="stat-card info">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.completedEvents}</div>
            <div className="stat-label">Completed Events</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Event Participation Trends</h3>
          <div className="chart-placeholder">
            <div className="chart-bar" style={{height: '60%'}}></div>
            <div className="chart-bar" style={{height: '80%'}}></div>
            <div className="chart-bar" style={{height: '45%'}}></div>
            <div className="chart-bar" style={{height: '90%'}}></div>
            <div className="chart-bar" style={{height: '75%'}}></div>
          </div>
        </div>

        <div className="chart-card">
          <h3>Division Distribution</h3>
          <div className="division-chart">
            <div className="division-item">
              <span>Male RX</span>
              <div className="progress-bar">
                <div className="progress" style={{width: '40%'}}></div>
              </div>
              <span>40%</span>
            </div>
            <div className="division-item">
              <span>Female RX</span>
              <div className="progress-bar">
                <div className="progress" style={{width: '30%'}}></div>
              </div>
              <span>30%</span>
            </div>
            <div className="division-item">
              <span>Male Scaled</span>
              <div className="progress-bar">
                <div className="progress" style={{width: '20%'}}></div>
              </div>
              <span>20%</span>
            </div>
            <div className="division-item">
              <span>Female Scaled</span>
              <div className="progress-bar">
                <div className="progress" style={{width: '10%'}}></div>
              </div>
              <span>10%</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .analytics {
          padding: 0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .stat-card.primary { border-left: 4px solid #007bff; }
        .stat-card.success { border-left: 4px solid #28a745; }
        .stat-card.warning { border-left: 4px solid #ffc107; }
        .stat-card.info { border-left: 4px solid #17a2b8; }
        .stat-icon {
          font-size: 32px;
        }
        .stat-number {
          font-size: 28px;
          font-weight: bold;
          color: #333;
        }
        .stat-label {
          color: #666;
          font-size: 14px;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
        }
        .chart-card {
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-card h3 {
          margin: 0 0 20px 0;
          color: #333;
        }
        .chart-placeholder {
          display: flex;
          align-items: end;
          gap: 10px;
          height: 200px;
          padding: 20px 0;
        }
        .chart-bar {
          flex: 1;
          background: linear-gradient(to top, #007bff, #66b3ff);
          border-radius: 4px 4px 0 0;
          min-height: 20px;
        }
        .division-chart {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .division-item {
          display: grid;
          grid-template-columns: 100px 1fr 50px;
          align-items: center;
          gap: 15px;
        }
        .progress-bar {
          background: #e9ecef;
          border-radius: 10px;
          height: 8px;
          overflow: hidden;
        }
        .progress {
          background: #007bff;
          height: 100%;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

export default Analytics;
