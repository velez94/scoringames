import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import EventManagement from './backoffice/EventManagement';
import AthleteManagement from './backoffice/AthleteManagement';
import ScoreEntry from './backoffice/ScoreEntry';
import Leaderboard from './backoffice/Leaderboard';
import GeneralLeaderboard from './backoffice/GeneralLeaderboard';
import Analytics from './backoffice/Analytics';

function BackofficeLayout({ user, signOut }) {
  const location = useLocation();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  const isActive = (path) => location.pathname === path;
  
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const getTogglePosition = () => {
    if (window.innerWidth <= 768) {
      return sidebarVisible ? '10px' : '10px';
    } else if (window.innerWidth <= 992) {
      return sidebarVisible ? '210px' : '20px';
    } else if (window.innerWidth <= 1200) {
      return sidebarVisible ? '230px' : '20px';
    } else {
      return sidebarVisible ? '260px' : '20px';
    }
  };

  return (
    <div className="backoffice">
      <button 
        className="sidebar-toggle" 
        onClick={toggleSidebar}
        style={{ left: getTogglePosition() }}
      >
        {sidebarVisible ? '←' : '→'}
      </button>
      
      <div className={`sidebar-container ${sidebarVisible ? '' : 'hidden'}`}>
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
            Score Entry
          </Link>
          <Link to="/backoffice/leaderboard" className={isActive('/backoffice/leaderboard') ? 'active' : ''}>
            WOD Leaderboard
          </Link>
          <Link to="/backoffice/general-leaderboard" className={isActive('/backoffice/general-leaderboard') ? 'active' : ''}>
            General Leaderboard
          </Link>
          <Link to="/backoffice/analytics" className={isActive('/backoffice/analytics') ? 'active' : ''}>
            Analytics
          </Link>
        </div>
        </nav>
      </div>

      <main className={`backoffice-content ${sidebarVisible ? 'with-sidebar' : 'full-width'}`}>
        <Routes>
          <Route path="/backoffice/events" element={<EventManagement />} />
          <Route path="/backoffice/athletes" element={<AthleteManagement />} />
          <Route path="/backoffice/scores" element={<ScoreEntry />} />
          <Route path="/backoffice/leaderboard" element={<Leaderboard />} />
          <Route path="/backoffice/general-leaderboard" element={<GeneralLeaderboard />} />
          <Route path="/backoffice/analytics" element={<Analytics />} />
          <Route path="/backoffice" element={<EventManagement />} />
          <Route path="/" element={<EventManagement />} />
        </Routes>
      </main>

      <style jsx>{`
        .backoffice {
          display: flex;
          height: 100vh;
          position: relative;
        }
        .sidebar-toggle {
          position: fixed;
          bottom: 20px;
          z-index: 1001;
          background: #2c3e50;
          color: white;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .sidebar-toggle:hover {
          background: #34495e;
        }
        .sidebar-container {
          width: 250px;
          transition: width 0.3s ease;
          flex-shrink: 0;
          overflow: hidden;
        }
        .sidebar-container.hidden {
          width: 0;
        }
        .backoffice-nav {
          width: 250px;
          background: #2c3e50;
          color: white;
          padding: 0;
          height: 100vh;
        }
        .backoffice-content {
          flex: 1;
          padding: 20px;
          background: #ecf0f1;
          overflow-y: auto;
          transition: all 0.3s ease;
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
        @media (max-width: 1200px) {
          .sidebar-container {
            width: 220px;
          }
          .sidebar-toggle {
            left: 230px;
          }
          .backoffice-nav {
            width: 220px;
          }
        }
        @media (max-width: 992px) {
          .sidebar-container {
            width: 200px;
          }
          .sidebar-toggle {
            left: 210px;
          }
          .backoffice-nav {
            width: 200px;
          }
        }
        @media (max-width: 768px) {
          .sidebar-toggle {
            bottom: 10px;
            left: 10px;
            width: 35px;
            height: 35px;
            font-size: 16px;
          }
          .backoffice-layout {
            flex-direction: column;
          }
          .sidebar {
            width: 100%;
            height: auto;
            position: relative;
          }
          .backoffice-nav {
            width: 100%;
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 999;
          }
          .backoffice-nav.hidden {
            transform: translateX(-100%);
          }
          .sidebar-container {
            width: 0;
            position: fixed;
            z-index: 999;
          }
          .sidebar-container:not(.hidden) {
            width: 100%;
          }
          .nav-links {
            display: flex;
            flex-direction: column;
            padding: 60px 10px 10px;
          }
          .nav-links a {
            white-space: nowrap;
            min-width: 100px;
            text-align: left;
            border-left: none;
            border-bottom: 1px solid #34495e;
            padding: 15px 20px;
          }
          .nav-links a:hover,
          .nav-links a.active {
            border-left: 3px solid #3498db;
            border-bottom-color: #34495e;
          }
          .backoffice-content {
            padding: 60px 15px 15px;
            width: 100%;
          }
        }
        @media (max-width: 480px) {
          .sidebar-toggle {
            width: 30px;
            height: 30px;
            font-size: 14px;
            bottom: 15px;
            left: 15px;
          }
          .backoffice-content {
            padding: 50px 10px 10px;
          }
          .nav-header {
            padding: 15px;
          }
          .nav-header h2 {
            font-size: 18px;
          }
          .nav-links a {
            padding: 12px 15px;
            font-size: 14px;
          }
        }
        @media (max-width: 320px) {
          .sidebar-toggle {
            width: 28px;
            height: 28px;
            font-size: 12px;
          }
          .backoffice-content {
            padding: 45px 8px 8px;
          }
          .nav-header {
            padding: 12px;
          }
          .nav-header h2 {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}

export default BackofficeLayout;
