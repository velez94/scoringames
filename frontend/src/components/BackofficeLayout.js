import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import EventManagement from './backoffice/EventManagement';
import EventDetails from './backoffice/EventDetails';
import EventEdit from './backoffice/EventEdit';
import AthleteManagement from './backoffice/AthleteManagement';
import CategoryManagement from './backoffice/CategoryManagement';
import WODManagement from './backoffice/WODManagement';
import ScoreEntry from './backoffice/ScoreEntry';
import Leaderboard from './backoffice/Leaderboard';
import Analytics from './backoffice/Analytics';
import AdminProfile from './backoffice/AdminProfile';
import { getOrganizerRole, ROLE_LABELS, hasPermission, PERMISSIONS } from '../utils/organizerRoles';

function BackofficeLayout({ user, signOut }) {
  const location = useLocation();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  const organizerRole = getOrganizerRole(user);
  const roleLabel = ROLE_LABELS[organizerRole] || 'Organizer';
  
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
        className={`sidebar-toggle ${sidebarVisible ? 'sidebar-open' : ''}`}
        onClick={toggleSidebar}
        style={{ left: getTogglePosition() }}
      >
        {sidebarVisible ? '←' : '→'}
      </button>
      
      {/* Mobile overlay */}
      {sidebarVisible && (
        <div className="mobile-overlay" onClick={() => setSidebarVisible(false)}></div>
      )}
      
      <div className={`sidebar-container ${sidebarVisible ? '' : 'hidden'}`}>
        <nav className="backoffice-nav">
        <div className="nav-header" onClick={() => window.location.href = '/admin-profile'}>
          <div className="admin-info">
            <span className="admin-icon">👤</span>
            <div className="admin-text">
              <h2>Scoring Games</h2>
              <div className="user-info">
                <span>{user?.attributes?.given_name}</span>
                <span className="role-badge">{roleLabel}</span>
                <button onClick={(e) => { e.stopPropagation(); signOut(); }} className="sign-out">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
        <div className="nav-links">
          {hasPermission(organizerRole, PERMISSIONS.MANAGE_EVENTS) && (
            <Link to="/backoffice/events" className={isActive('/backoffice/events') ? 'active' : ''}>
              <span className="nav-icon">📅</span>
              <span className="nav-text">Events</span>
            </Link>
          )}
          {hasPermission(organizerRole, PERMISSIONS.MANAGE_ATHLETES) && (
            <Link to="/backoffice/athletes" className={isActive('/backoffice/athletes') ? 'active' : ''}>
              <span className="nav-icon">👥</span>
              <span className="nav-text">Athletes</span>
            </Link>
          )}
          {hasPermission(organizerRole, PERMISSIONS.MANAGE_CATEGORIES) && (
            <Link to="/backoffice/categories" className={isActive('/backoffice/categories') ? 'active' : ''}>
              <span className="nav-icon">🏷️</span>
              <span className="nav-text">Categories</span>
            </Link>
          )}
          {hasPermission(organizerRole, PERMISSIONS.MANAGE_WODS) && (
            <Link to="/backoffice/wods" className={isActive('/backoffice/wods') ? 'active' : ''}>
              <span className="nav-icon">💪</span>
              <span className="nav-text">WODs</span>
            </Link>
          )}
          {hasPermission(organizerRole, PERMISSIONS.ENTER_SCORES) && (
            <Link to="/backoffice/scores" className={isActive('/backoffice/scores') ? 'active' : ''}>
              <span className="nav-icon">📝</span>
              <span className="nav-text">Score Entry</span>
            </Link>
          )}
          {hasPermission(organizerRole, PERMISSIONS.VIEW_LEADERBOARDS) && (
            <Link to="/backoffice/leaderboard" className={isActive('/backoffice/leaderboard') ? 'active' : ''}>
              <span className="nav-icon">🏆</span>
              <span className="nav-text">Leaderboard</span>
            </Link>
          )}
          {hasPermission(organizerRole, PERMISSIONS.MANAGE_OWN_COMPETITIONS) && (
            <Link to="/backoffice/analytics" className={isActive('/backoffice/analytics') ? 'active' : ''}>
              <span className="nav-icon">📊</span>
              <span className="nav-text">Analytics</span>
            </Link>
          )}
        </div>
        </nav>
      </div>

      <main className={`backoffice-content ${sidebarVisible ? 'sidebar-open' : ''}`}>
        <Routes>
          <Route path="/backoffice/events/:eventId/edit" element={<EventEdit />} />
          <Route path="/backoffice/events/:eventId" element={<EventDetails />} />
          <Route path="/backoffice/events" element={<EventManagement />} />
          <Route path="/backoffice/athletes" element={<AthleteManagement />} />
          <Route path="/backoffice/categories" element={<CategoryManagement />} />
          <Route path="/backoffice/wods" element={<WODManagement />} />
          <Route path="/backoffice/scores" element={<ScoreEntry />} />
          <Route path="/backoffice/leaderboard" element={<Leaderboard />} />
          <Route path="/backoffice/analytics" element={<Analytics />} />
          <Route path="/admin-profile" element={<AdminProfile user={user} signOut={signOut} />} />
          <Route path="/backoffice" element={<EventManagement />} />
          <Route path="*" element={<EventManagement />} />
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
        .mobile-overlay {
          display: none;
        }
        .sidebar-container {
          width: 250px;
          transition: width 0.3s ease;
          flex-shrink: 0;
          overflow: visible;
        }
        .sidebar-container.hidden {
          width: 70px;
        }
        .sidebar-container.hidden .nav-text {
          display: none;
        }
        .sidebar-container.hidden .nav-icon {
          margin-right: 0;
        }
        .sidebar-container.hidden .admin-text {
          display: none;
        }
        .sidebar-container.hidden .admin-icon {
          margin: 0;
        }
        .backoffice-nav {
          width: 100%;
          background: #2c3e50;
          color: white;
          padding: 0;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
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
          cursor: pointer;
          transition: background 0.3s ease;
        }
        .nav-header:hover {
          background: rgba(255,255,255,0.1);
        }
        .admin-info {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
        .admin-icon {
          font-size: 24px;
          min-width: 24px;
          text-align: center;
          color: #ecf0f1;
        }
        .admin-text {
          flex: 1;
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
        .role-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
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
          display: flex;
          align-items: center;
          padding: 12px 20px;
          color: #bdc3c7;
          text-decoration: none;
          border-left: 3px solid transparent;
          transition: all 0.3s ease;
          justify-content: flex-start;
        }
        .sidebar-container.hidden .nav-links a {
          padding: 12px 8px;
          justify-content: center;
        }
        .nav-icon {
          font-size: 20px;
          margin-right: 12px;
          min-width: 24px;
          text-align: center;
          flex-shrink: 0;
        }
        .nav-text {
          font-size: 14px;
          font-weight: 500;
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
          .backoffice-layout {
            flex-direction: column;
            overflow-x: hidden;
            width: 100%;
          }
          .sidebar-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 80vw;
            max-width: 280px;
            height: 100vh;
            z-index: 1000;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            background: #2c3e50;
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
          }
          .sidebar-container:not(.hidden) {
            transform: translateX(0);
          }
          .backoffice-content {
            margin-left: 0;
            width: 100%;
            min-height: 100vh;
            padding: 60px 15px 15px;
            background: #f8f9fa;
            overflow-x: hidden;
          }
          .sidebar-toggle {
            display: block;
            position: fixed;
            top: 15px;
            left: 15px;
            z-index: 1001;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            width: 40px;
            height: 40px;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .sidebar-toggle:hover {
            background: #0056b3;
          }
          .mobile-overlay {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.5);
            z-index: 999;
          }
        }
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
