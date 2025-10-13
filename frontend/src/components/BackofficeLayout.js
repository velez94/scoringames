import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import EventManagement from './backoffice/EventManagement';
import AthleteManagement from './backoffice/AthleteManagement';
import ScoreManagement from './backoffice/ScoreManagement';
import Analytics from './backoffice/Analytics';

function BackofficeLayout({ user, signOut }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <div className="backoffice">
      <nav className="backoffice-nav">
        <div className="nav-header">
          <h2>Backoffice</h2>
          <div className="user-info">
            <span>{user?.attributes?.given_name} (Organizer)</span>
            <button onClick={signOut} className="sign-out">Sign Out</button>
          </div>
        </div>
        <div className="nav-links">
          <Link to="/backoffice/events" className={isActive('/backoffice/events') ? 'active' : ''}>
            Events
          </Link>
          <Link to="/backoffice/athletes" className={isActive('/backoffice/athletes') ? 'active' : ''}>
            Athletes
          </Link>
          <Link to="/backoffice/scores" className={isActive('/backoffice/scores') ? 'active' : ''}>
            Scores
          </Link>
          <Link to="/backoffice/analytics" className={isActive('/backoffice/analytics') ? 'active' : ''}>
            Analytics
          </Link>
        </div>
      </nav>

      <main className="backoffice-content">
        <Routes>
          <Route path="/events" element={<EventManagement />} />
          <Route path="/athletes" element={<AthleteManagement />} />
          <Route path="/scores" element={<ScoreManagement />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/" element={<EventManagement />} />
        </Routes>
      </main>

      <style jsx>{`
        .backoffice {
          display: flex;
          height: 100vh;
        }
        .backoffice-nav {
          width: 250px;
          background: #2c3e50;
          color: white;
          padding: 0;
        }
        .nav-header {
          padding: 20px;
          border-bottom: 1px solid #34495e;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .nav-header h2 {
          margin: 0;
          color: #ecf0f1;
        }
        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }
        .user-info span {
          font-size: 12px;
          color: #bdc3c7;
        }
        .sign-out {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
        }
        .nav-links {
          padding: 20px 0;
        }
        .nav-links a {
          display: block;
          padding: 12px 20px;
          color: #bdc3c7;
          text-decoration: none;
          border-left: 3px solid transparent;
        }
        .nav-links a:hover,
        .nav-links a.active {
          background: #34495e;
          color: white;
          border-left-color: #3498db;
        }
        .backoffice-content {
          flex: 1;
          padding: 20px;
          background: #ecf0f1;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}

export default BackofficeLayout;
