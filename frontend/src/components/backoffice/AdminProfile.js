import React from 'react';

function AdminProfile({ user, signOut }) {
  const isSuperAdmin = user?.attributes?.['custom:isSuperAdmin'] === 'true';
  const userRole = isSuperAdmin ? 'Super Admin' : (user?.attributes?.['custom:role'] || 'Organizer');
  
  return (
    <div className="admin-profile">
      <div className="profile-header">
        <div className="admin-avatar">
          <span className="avatar-icon">{isSuperAdmin ? '👑' : '👤'}</span>
        </div>
        <div className="admin-info">
          <h1>{user?.attributes?.given_name} {user?.attributes?.family_name}</h1>
          <p className="role">{isSuperAdmin ? 'Platform Administrator' : 'System Administrator'}</p>
          <p className="email">{user?.attributes?.email}</p>
        </div>
      </div>

      <div className="profile-content">
        <div className="info-section">
          <h2>Account Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>First Name</label>
              <span>{user?.attributes?.given_name || 'Not set'}</span>
            </div>
            <div className="info-item">
              <label>Last Name</label>
              <span>{user?.attributes?.family_name || 'Not set'}</span>
            </div>
            <div className="info-item">
              <label>Email</label>
              <span>{user?.attributes?.email}</span>
            </div>
            <div className="info-item">
              <label>Role</label>
              <span>{userRole}</span>
            </div>
            <div className="info-item">
              <label>User ID</label>
              <span>{user?.attributes?.sub}</span>
            </div>
          </div>
        </div>

        <div className="actions-section">
          <h2>Account Actions</h2>
          <div className="action-buttons">
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-profile {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .profile-header {
          display: flex;
          align-items: center;
          gap: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
        }
        .admin-avatar {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-icon {
          font-size: 40px;
        }
        .admin-info h1 {
          margin: 0 0 5px 0;
          font-size: 2rem;
        }
        .role {
          margin: 0 0 5px 0;
          opacity: 0.9;
          font-weight: 600;
        }
        .email {
          margin: 0;
          opacity: 0.8;
        }
        .profile-content {
          display: grid;
          gap: 30px;
        }
        .info-section, .actions-section {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .info-section h2, .actions-section h2 {
          margin: 0 0 20px 0;
          color: #333;
          font-size: 1.3rem;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .info-item label {
          font-weight: 600;
          color: #666;
          font-size: 14px;
        }
        .info-item span {
          color: #333;
          font-size: 16px;
        }
        .action-buttons {
          display: flex;
          gap: 15px;
        }
        .sign-out-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s ease;
        }
        .sign-out-btn:hover {
          background: #c82333;
        }
        @media (max-width: 768px) {
          .profile-header {
            flex-direction: column;
            text-align: center;
          }
          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default AdminProfile;
