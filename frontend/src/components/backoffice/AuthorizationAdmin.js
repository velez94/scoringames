import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

const AuthorizationAdmin = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('roles');
  const [editingPermission, setEditingPermission] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingUserRole, setEditingUserRole] = useState(null);

  // New role form
  const [newRole, setNewRole] = useState({
    roleId: '',
    name: '',
    description: ''
  });

  // New permission form
  const [newPermission, setNewPermission] = useState({
    roleId: '',
    resource: '',
    actions: []
  });

  // User role assignment
  const [userRoleAssignment, setUserRoleAssignment] = useState({
    userId: '',
    email: '',
    roleId: '',
    contextId: 'global'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permissionsRes, userRolesRes] = await Promise.all([
        API.get('CalisthenicsAPI', '/authorization/roles'),
        API.get('CalisthenicsAPI', '/authorization/permissions'),
        API.get('CalisthenicsAPI', '/authorization/user-roles')
      ]);
      
      setRoles(rolesRes);
      setPermissions(permissionsRes);
      setUserRoles(userRolesRes);
    } catch (error) {
      console.error('Error fetching authorization data:', error);
    }
    setLoading(false);
  };

  const createRole = async (e) => {
    e.preventDefault();
    try {
      await API.post('CalisthenicsAPI', '/authorization/roles', {
        body: newRole
      });
      setNewRole({ roleId: '', name: '', description: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating role:', error);
    }
  };

  const createPermission = async (e) => {
    e.preventDefault();
    try {
      await API.post('CalisthenicsAPI', '/authorization/permissions', {
        body: newPermission
      });
      setNewPermission({ roleId: '', resource: '', actions: [] });
      fetchData();
    } catch (error) {
      console.error('Error creating permission:', error);
    }
  };

  const assignUserRole = async (e) => {
    e.preventDefault();
    try {
      await API.post('CalisthenicsAPI', '/authorization/user-roles', {
        body: userRoleAssignment
      });
      setUserRoleAssignment({ userId: '', email: '', roleId: '', contextId: 'global' });
      fetchData();
    } catch (error) {
      console.error('Error assigning user role:', error);
    }
  };

  const updatePermission = async (e) => {
    e.preventDefault();
    try {
      await API.put('CalisthenicsAPI', `/authorization/permissions/${editingPermission.roleId}/${editingPermission.resource}`, {
        body: { actions: editingPermission.actions }
      });
      setEditingPermission(null);
      fetchData();
    } catch (error) {
      console.error('Error updating permission:', error);
    }
  };

  const deletePermission = async (roleId, resource) => {
    if (!window.confirm('Are you sure you want to delete this permission?')) return;
    try {
      await API.del('CalisthenicsAPI', `/authorization/permissions/${roleId}/${resource}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting permission:', error);
    }
  };

  const updateRole = async (e) => {
    e.preventDefault();
    try {
      await API.put('CalisthenicsAPI', `/authorization/roles/${editingRole.roleId}`, {
        body: { name: editingRole.name, description: editingRole.description }
      });
      setEditingRole(null);
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const deleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await API.del('CalisthenicsAPI', `/authorization/roles/${roleId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  };

  const updateUserRole = async (e) => {
    e.preventDefault();
    try {
      await API.put('CalisthenicsAPI', `/authorization/user-roles/${editingUserRole.userId}`, {
        body: { roleId: editingUserRole.roleId, contextId: editingUserRole.contextId }
      });
      setEditingUserRole(null);
      fetchData();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const deleteUserRole = async (userId, contextId) => {
    if (!window.confirm('Are you sure you want to remove this user role?')) return;
    try {
      await API.del('CalisthenicsAPI', `/authorization/user-roles/${userId}?contextId=${contextId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting user role:', error);
    }
  };

  const handleActionToggle = (action) => {
    const actions = newPermission.actions.includes(action)
      ? newPermission.actions.filter(a => a !== action)
      : [...newPermission.actions, action];
    setNewPermission({ ...newPermission, actions });
  };

  const availableActions = ['create', 'read', 'update', 'delete', '*'];
  const availableResources = ['organizations', 'events', 'wods', 'categories', 'athletes', 'scores', 'system'];

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">🔐 Authorization Administration</h1>
        <p className="admin-subtitle">Manage roles, permissions, and user access</p>
      </div>
      
      {/* Tabs */}
      <div className="admin-tabs">
        <nav className="tab-nav">
          {['roles', 'permissions', 'users'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button ${activeTab === tab ? 'tab-active' : ''}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="admin-grid">
          <div className="admin-card">
            <h2 className="card-title">Create Role</h2>
            <form onSubmit={createRole} className="admin-form">
              <input
                type="text"
                placeholder="Role ID (e.g., org_manager)"
                value={newRole.roleId}
                onChange={(e) => setNewRole({ ...newRole, roleId: e.target.value })}
                className="form-input"
                required
              />
              <input
                type="text"
                placeholder="Role Name"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                className="form-input"
                required
              />
              <textarea
                placeholder="Description"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                className="form-textarea"
                rows="3"
              />
              <button type="submit" className="btn-primary">
                Create Role
              </button>
            </form>
          </div>
          
          <div className="admin-card">
            <h2 className="card-title">Existing Roles</h2>
            <div className="items-list">
              {roles.map((role) => (
                <div key={role.roleId} className="item-card">
                  {editingRole?.roleId === role.roleId ? (
                    <form onSubmit={updateRole} className="edit-form">
                      <input
                        type="text"
                        value={editingRole.name}
                        onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                        className="form-input-small"
                        required
                      />
                      <textarea
                        value={editingRole.description}
                        onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                        className="form-textarea-small"
                        rows="2"
                      />
                      <div className="edit-actions">
                        <button type="submit" className="btn-save">Save</button>
                        <button type="button" onClick={() => setEditingRole(null)} className="btn-cancel">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="item-content">
                        <div className="item-title">{role.name}</div>
                        <div className="item-subtitle">{role.roleId}</div>
                        <div className="item-description">{role.description}</div>
                      </div>
                      <div className="item-actions">
                        <button 
                          onClick={() => setEditingRole(role)} 
                          className="btn-edit"
                          title="Edit Role"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => deleteRole(role.roleId)} 
                          className="btn-delete"
                          title="Delete Role"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="permissions-layout">
          <div className="admin-card matrix-card">
            <h2 className="card-title">Permissions Matrix</h2>
            <div className="permissions-matrix">
              <div className="matrix-table">
                <div className="matrix-header">
                  <div className="matrix-cell header-cell">Role / Resource</div>
                  {availableResources.map((resource) => (
                    <div key={resource} className="matrix-cell header-cell">{resource}</div>
                  ))}
                </div>
                {roles.map((role) => (
                  <div key={role.roleId} className="matrix-row">
                    <div className="matrix-cell role-cell">{role.name}</div>
                    {availableResources.map((resource) => {
                      const permission = permissions.find(p => p.roleId === role.roleId && p.resource === resource);
                      return (
                        <div key={resource} className="matrix-cell permission-cell">
                          {permission ? (
                            <div className="permission-content">
                              <div className="permission-actions">
                                {permission.actions.includes('*') ? (
                                  <span className="action-badge all">ALL</span>
                                ) : (
                                  permission.actions.map(action => (
                                    <span key={action} className="action-badge">{action}</span>
                                  ))
                                )}
                              </div>
                              <div className="permission-controls">
                                <button 
                                  onClick={() => setEditingPermission({...permission})} 
                                  className="control-btn edit"
                                  title="Edit Permission"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => deletePermission(role.roleId, resource)} 
                                  className="control-btn delete"
                                  title="Delete Permission"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setEditingPermission({ roleId: role.roleId, resource, actions: [] })}
                              className="add-permission-btn"
                              title="Add Permission"
                            >
                              +
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="admin-card create-permission-card">
            <h2 className="card-title">Create Permission</h2>
            <form onSubmit={createPermission} className="admin-form">
              <select
                value={newPermission.roleId}
                onChange={(e) => setNewPermission({ ...newPermission, roleId: e.target.value })}
                className="form-select"
                required
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.name}</option>
                ))}
              </select>
              
              <select
                value={newPermission.resource}
                onChange={(e) => setNewPermission({ ...newPermission, resource: e.target.value })}
                className="form-select"
                required
              >
                <option value="">Select Resource</option>
                {availableResources.map((resource) => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
              
              <div className="checkbox-group">
                <label className="group-label">Actions</label>
                <div className="checkbox-list">
                  {availableActions.map((action) => (
                    <label key={action} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={newPermission.actions.includes(action)}
                        onChange={() => handleActionToggle(action)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-label">{action}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <button type="submit" className="btn-secondary">
                Create Permission
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permission Modal */}
      {editingPermission && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Edit Permission</h3>
            <form onSubmit={updatePermission} className="modal-form">
              <div className="form-group">
                <label>Role: {roles.find(r => r.roleId === editingPermission.roleId)?.name}</label>
                <label>Resource: {editingPermission.resource}</label>
              </div>
              
              <div className="checkbox-group">
                <label className="group-label">Actions</label>
                <div className="checkbox-list">
                  {availableActions.map((action) => (
                    <label key={action} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={editingPermission.actions.includes(action)}
                        onChange={() => {
                          const actions = editingPermission.actions.includes(action)
                            ? editingPermission.actions.filter(a => a !== action)
                            : [...editingPermission.actions, action];
                          setEditingPermission({ ...editingPermission, actions });
                        }}
                        className="checkbox-input"
                      />
                      <span className="checkbox-label">{action}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Update Permission</button>
                <button type="button" onClick={() => setEditingPermission(null)} className="btn-cancel">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="admin-grid">
          <div className="admin-card">
            <h2 className="card-title">Assign User Role</h2>
            <form onSubmit={assignUserRole} className="admin-form">
              <input
                type="text"
                placeholder="User ID"
                value={userRoleAssignment.userId}
                onChange={(e) => setUserRoleAssignment({ ...userRoleAssignment, userId: e.target.value })}
                className="form-input"
                required
              />
              <input
                type="email"
                placeholder="User Email"
                value={userRoleAssignment.email}
                onChange={(e) => setUserRoleAssignment({ ...userRoleAssignment, email: e.target.value })}
                className="form-input"
                required
              />
              <select
                value={userRoleAssignment.roleId}
                onChange={(e) => setUserRoleAssignment({ ...userRoleAssignment, roleId: e.target.value })}
                className="form-select"
                required
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Context ID (organization ID or 'global')"
                value={userRoleAssignment.contextId}
                onChange={(e) => setUserRoleAssignment({ ...userRoleAssignment, contextId: e.target.value })}
                className="form-input"
              />
              <button type="submit" className="btn-accent">
                Assign Role
              </button>
            </form>
          </div>
          
          <div className="admin-card">
            <h2 className="card-title">User Role Assignments</h2>
            <div className="items-list">
              {userRoles.map((userRole, index) => (
                <div key={index} className="item-card">
                  {editingUserRole?.userId === userRole.userId && editingUserRole?.contextId === userRole.contextId ? (
                    <form onSubmit={updateUserRole} className="edit-form">
                      <select
                        value={editingUserRole.roleId}
                        onChange={(e) => setEditingUserRole({ ...editingUserRole, roleId: e.target.value })}
                        className="form-select-small"
                        required
                      >
                        {roles.map((role) => (
                          <option key={role.roleId} value={role.roleId}>{role.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editingUserRole.contextId}
                        onChange={(e) => setEditingUserRole({ ...editingUserRole, contextId: e.target.value })}
                        className="form-input-small"
                        placeholder="Context ID"
                      />
                      <div className="edit-actions">
                        <button type="submit" className="btn-save">Save</button>
                        <button type="button" onClick={() => setEditingUserRole(null)} className="btn-cancel">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="item-content">
                        <div className="item-title">{userRole.email}</div>
                        <div className="item-subtitle">{userRole.roleId}</div>
                        <div className="item-description">Context: {userRole.contextId}</div>
                      </div>
                      <div className="item-actions">
                        <button 
                          onClick={() => setEditingUserRole(userRole)} 
                          className="btn-edit"
                          title="Edit User Role"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => deleteUserRole(userRole.userId, userRole.contextId)} 
                          className="btn-delete"
                          title="Remove User Role"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .admin-container {
          padding: var(--spacing-xl);
          background: var(--color-background);
          min-height: 100vh;
        }
        
        .admin-header {
          margin-bottom: var(--spacing-xl);
          text-align: center;
        }
        
        .admin-title {
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-sm);
          background: linear-gradient(135deg, var(--color-fire-orange), var(--color-copper));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .admin-subtitle {
          color: var(--color-text-secondary);
          font-size: 1.1rem;
        }
        
        .admin-tabs {
          margin-bottom: var(--spacing-xl);
          border-bottom: 2px solid #e5e7eb;
        }
        
        .tab-nav {
          display: flex;
          gap: var(--spacing-lg);
          justify-content: center;
        }
        
        .tab-button {
          padding: var(--spacing-md) var(--spacing-lg);
          border: none;
          background: none;
          font-weight: 600;
          font-size: 1rem;
          color: var(--color-text-secondary);
          border-bottom: 3px solid transparent;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .tab-button:hover {
          color: var(--color-fire-orange);
        }
        
        .tab-active {
          color: var(--color-fire-orange) !important;
          border-bottom-color: var(--color-fire-orange);
        }
        
        .admin-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-xl);
        }
        
        .permissions-layout {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }
        
        .create-permission-card {
          width: 100%;
        }
        
        .matrix-card {
          width: 100%;
        }
        
        @media (max-width: 768px) {
          .admin-grid {
            grid-template-columns: 1fr;
          }
          
          .create-permission-card {
            max-width: 100%;
          }
        }
        
        .admin-card {
          background: var(--color-surface);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 1px solid #e1e5e9;
          transition: box-shadow 0.2s ease;
        }
        
        .admin-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-md);
          padding-bottom: var(--spacing-sm);
          border-bottom: 2px solid var(--color-fire-orange);
        }
        
        .admin-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        
        .form-input, .form-select, .form-textarea {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid #d1d5db;
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: var(--color-fire-orange);
          background: white;
          box-shadow: 0 0 0 3px rgba(255, 87, 34, 0.1);
        }
        
        .checkbox-group {
          margin: var(--spacing-sm) 0;
        }
        
        .group-label {
          display: block;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-xs);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .checkbox-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: var(--spacing-xs);
        }
        
        .checkbox-item {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 2px;
        }
        
        .checkbox-input {
          margin-right: var(--spacing-xs);
          accent-color: var(--color-fire-orange);
        }
        
        .checkbox-label {
          color: var(--color-text-primary);
          font-size: 0.8rem;
        }
        
        .permissions-matrix {
          overflow-x: auto;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .matrix-table {
          display: grid;
          grid-template-columns: 150px repeat(7, 1fr);
          gap: 1px;
          background: #e5e7eb;
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        
        .matrix-header {
          display: contents;
        }
        
        .matrix-row {
          display: contents;
        }
        
        .matrix-cell {
          background: white;
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
        }
        
        .header-cell {
          background: linear-gradient(135deg, var(--color-fire-orange), var(--color-copper));
          color: white;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .role-cell {
          background: #f8f9fa;
          font-weight: 600;
          color: var(--color-text-primary);
          justify-content: flex-start;
          text-align: left;
        }
        
        .permission-cell {
          background: #fafbfc;
        }
        
        .permission-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          justify-content: center;
        }
        
        .action-badge {
          background: var(--color-fire-orange);
          color: white;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .action-badge.all {
          background: linear-gradient(135deg, #10b981, #059669);
        }
        
        .no-permission {
          color: #9ca3af;
          font-size: 1rem;
        }
        
        .btn-primary, .btn-secondary, .btn-accent {
          border: none;
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, var(--color-fire-orange), var(--color-copper));
          color: white;
        }
        
        .btn-secondary {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }
        
        .btn-accent {
          background: linear-gradient(135deg, var(--color-copper), #92400e);
          color: white;
        }
        
        .btn-primary:hover, .btn-secondary:hover, .btn-accent:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .items-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          max-height: 300px;
          overflow-y: auto;
        }
        
        .item-card {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid #e5e7eb;
          border-radius: var(--radius-sm);
          background: #f8f9fa;
          transition: all 0.2s ease;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .item-card:hover {
          background: #f1f3f4;
          border-color: var(--color-fire-orange);
        }
        
        .item-content {
          flex: 1;
        }
        
        .item-actions {
          display: flex;
          gap: var(--spacing-xs);
          margin-left: var(--spacing-sm);
        }
        
        .btn-edit, .btn-delete {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        
        .btn-edit:hover {
          background: #e3f2fd;
        }
        
        .btn-delete:hover {
          background: #ffebee;
        }
        
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          width: 100%;
        }
        
        .form-input-small, .form-select-small, .form-textarea-small {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        
        .edit-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
        
        .btn-save, .btn-cancel {
          padding: 4px 12px;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          font-weight: 600;
        }
        
        .btn-save {
          background: #10b981;
          color: white;
        }
        
        .btn-cancel {
          background: #6b7280;
          color: white;
        }
        
        .permission-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        
        .permission-controls {
          display: flex;
          gap: 2px;
        }
        
        .control-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          border-radius: 2px;
          font-size: 0.7rem;
          opacity: 0.7;
          transition: all 0.2s ease;
        }
        
        .control-btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.8);
        }
        
        .add-permission-btn {
          background: #e5e7eb;
          border: 1px dashed #9ca3af;
          border-radius: 4px;
          cursor: pointer;
          padding: 4px 8px;
          font-size: 1rem;
          color: #6b7280;
          transition: all 0.2s ease;
        }
        
        .add-permission-btn:hover {
          background: var(--color-fire-orange);
          color: white;
          border-color: var(--color-fire-orange);
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: white;
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .modal-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-md);
          text-align: center;
        }
        
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        
        .form-group label {
          font-weight: 600;
          color: var(--color-text-primary);
          font-size: 0.9rem;
        }
        
        .modal-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: flex-end;
          margin-top: var(--spacing-md);
        }
        
        .item-title {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-text-primary);
          margin-bottom: 2px;
        }
        
        .item-subtitle {
          font-size: 0.8rem;
          color: var(--color-fire-orange);
          font-weight: 500;
          margin-bottom: 2px;
        }
        
        .item-description {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
};

export default AuthorizationAdmin;
