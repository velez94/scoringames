import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation({ user, signOut }) {
  const location = useLocation();
  const isSuperAdmin = user?.attributes?.['custom:isSuperAdmin'] === 'true';
  const userRole = isSuperAdmin ? 'Super Admin' : (user?.attributes?.['custom:role'] || 'athlete');

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/">Calisthenics Competition</Link>
        </div>
        
        <div className="nav-links">
          <Link 
            to="/" 
            className={isActive('/') ? 'active' : ''}
          >
            Dashboard
          </Link>
          
          <Link 
            to="/events" 
            className={isActive('/events') ? 'active' : ''}
          >
            Events
          </Link>
          
          <Link 
            to="/leaderboard" 
            className={isActive('/leaderboard') ? 'active' : ''}
          >
            Leaderboard
          </Link>
          
          {(userRole === 'judge' || userRole === 'organizer') && (
            <Link 
              to="/score-entry" 
              className={isActive('/score-entry') ? 'active' : ''}
            >
              Score Entry
            </Link>
          )}
        </div>

        <div className="nav-user">
          <span className="user-info">
            {user?.attributes?.given_name} ({userRole})
          </span>
          <button onClick={signOut} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </div>

      <style jsx>{`
        .navigation {
          background: #343a40;
          color: white;
          padding: 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .nav-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 60px;
        }
        .nav-brand a {
          color: white;
          text-decoration: none;
          font-size: 20px;
          font-weight: bold;
        }
        .nav-links {
          display: flex;
          gap: 30px;
        }
        .nav-links a {
          color: #adb5bd;
          text-decoration: none;
          padding: 8px 12px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .nav-links a:hover,
        .nav-links a.active {
          color: white;
          background: rgba(255,255,255,0.1);
        }
        .nav-user {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .user-info {
          font-size: 14px;
          color: #adb5bd;
        }
        .sign-out-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .sign-out-btn:hover {
          background: #c82333;
        }
        @media (max-width: 768px) {
          .nav-container {
            flex-direction: column;
            height: auto;
            padding: 15px 20px;
          }
          .nav-links {
            margin: 10px 0;
            gap: 15px;
          }
          .nav-user {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </nav>
  );
}

export default Navigation;
