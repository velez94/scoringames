import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useParams, useNavigate } from 'react-router-dom';

function OrganizationManagement() {
  const { user } = useAuthenticator((context) => [context.user]);
  const { organizations, selectedOrganization, selectOrganization } = useOrganization();
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [organizationDetails, setOrganizationDetails] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = user?.attributes?.email === 'admin@athleon.fitness';
  const isOwnerOrAdmin = selectedOrganization && ['owner', 'admin'].includes(selectedOrganization.role);

  // Handle URL parameter organization selection
  useEffect(() => {
    if (organizationId && organizations.length > 0) {
      const org = organizations.find(o => o.organizationId === organizationId);
      if (org && (!selectedOrganization || selectedOrganization.organizationId !== organizationId)) {
        selectOrganization(org);
      }
    }
  }, [organizationId, organizations, selectedOrganization, selectOrganization]);

  // Debug logging
  console.log('OrganizationManagement Debug:', {
    userEmail: user?.attributes?.email,
    isSuperAdmin,
    selectedOrganization,
    isOwnerOrAdmin,
    organizationsCount: organizations.length,
    organizations: organizations
  });

  useEffect(() => {
    if (selectedOrganization && selectedOrganization.organizationId !== 'all') {
      fetchOrganizationDetails();
      fetchMembers();
      fetchEvents();
    }
  }, [selectedOrganization]);

  const fetchOrganizationDetails = async () => {
    try {
      setLoading(true);
      const response = await API.get('CalisthenicsAPI', `/organizations/${selectedOrganization.organizationId}`);
      setOrganizationDetails(response);
      setCreatorName(response.creatorName || response.createdBy);
    } catch (error) {
      console.error('Error fetching organization details:', error);
      setMessage('Error loading organization details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/organizations/${selectedOrganization.organizationId}/members`);
      setMembers(response || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMessage('Error loading members');
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/competitions', {
        queryStringParameters: {
          organizationId: selectedOrganization.organizationId
        }
      });
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    try {
      await API.post('CalisthenicsAPI', `/organizations/${selectedOrganization.organizationId}/members`, {
        body: { email: newMemberEmail, role: newMemberRole }
      });
      setMessage('✅ Member added successfully');
      setNewMemberEmail('');
      setNewMemberRole('member');
      fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      setMessage('❌ Error adding member');
    }
  };

  const updateMemberRole = async (userId, newRole) => {
    try {
      await API.put('CalisthenicsAPI', `/organizations/${selectedOrganization.organizationId}/members/${userId}`, {
        body: { role: newRole }
      });
      setMessage('✅ Member role updated');
      fetchMembers();
    } catch (error) {
      console.error('Error updating member role:', error);
      setMessage('❌ Error updating member role');
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await API.del('CalisthenicsAPI', `/organizations/${selectedOrganization.organizationId}/members/${userId}`);
      setMessage('✅ Member removed');
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      setMessage('❌ Error removing member');
    }
  };

  const deleteOrganization = async () => {
    if (!window.confirm(`Are you sure you want to delete "${organizationDetails.name}"? This action cannot be undone.`)) return;
    
    try {
      await API.del('CalisthenicsAPI', `/organizations/${selectedOrganization.organizationId}`);
      setMessage('✅ Organization deleted');
      setTimeout(() => {
        navigate('/backoffice/organization');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error deleting organization:', error);
      setMessage('❌ Error deleting organization');
    }
  };

  if (!selectedOrganization || (isSuperAdmin && selectedOrganization.organizationId === 'all')) {
    return (
      <div className="organization-management">
        <h2>Organization Management</h2>
        {isSuperAdmin ? (
          <div>
            <p>Select a specific organization to manage from the dropdown above, or view all organizations below:</p>
            
            <div style={{marginBottom: '20px'}}>
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '12px 16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="organizations-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px'}}>
              {organizations
                .filter(org => org.organizationId !== 'all')
                .filter(org => org.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              org.organizationId.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(org => (
                <div 
                  key={org.organizationId} 
                  className="organization-card" 
                  onClick={() => navigate(`/backoffice/organization/${org.organizationId}`)}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '20px',
                    background: '#ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h3 style={{margin: '0 0 15px 0', color: '#333', fontSize: '18px', fontWeight: '600'}}>{org.name}</h3>
                  <div style={{marginBottom: '10px'}}>
                    <span style={{fontSize: '14px', color: '#666', fontWeight: '500'}}>ID: </span>
                    <span style={{fontSize: '14px', color: '#888', fontFamily: 'monospace'}}>{org.organizationId}</span>
                  </div>
                  <div style={{marginBottom: '20px'}}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'uppercase'
                    }}>
                      Super Admin
                    </span>
                  </div>
                  <div style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    textAlign: 'center'
                  }}>
                    View Details →
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p>Please select an organization to manage.</p>
        )}
      </div>
    );
  }

  if (!isSuperAdmin && !isOwnerOrAdmin) {
    return (
      <div className="organization-management">
        <h2>Organization Management</h2>
        <p>You don't have permission to manage this organization.</p>
      </div>
    );
  }

  return (
    <div className="organization-management">
      <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px'}}>
        <button
          onClick={() => {
            selectOrganization(organizations.find(o => o.organizationId === 'all'));
            navigate('/backoffice/organization');
          }}
          style={{
            padding: '8px 16px',
            background: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back to Organizations
        </button>
        <h2 style={{margin: 0}}>Organization Management</h2>
      </div>
      
      {loading && <p>Loading...</p>}
      
      {organizationDetails && (
        <div className="organization-details" style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '24px',
          margin: '20px 0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h3 style={{margin: 0, color: '#333', fontSize: '20px', fontWeight: '600'}}>Organization Details</h3>
            {(isSuperAdmin || selectedOrganization.role === 'owner') && (
              <button
                onClick={deleteOrganization}
                style={{
                  padding: '8px 16px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Delete Organization
              </button>
            )}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'}}>
            <div>
              <span style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '4px'}}>Name</span>
              <span style={{fontSize: '16px', color: '#333'}}>{organizationDetails.name}</span>
            </div>
            <div>
              <span style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '4px'}}>Description</span>
              <span style={{fontSize: '16px', color: '#333'}}>{organizationDetails.description || 'No description'}</span>
            </div>
            <div>
              <span style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '4px'}}>Created</span>
              <span style={{fontSize: '16px', color: '#333'}}>{new Date(organizationDetails.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '4px'}}>Created By</span>
              <span style={{fontSize: '16px', color: '#333'}}>{creatorName || organizationDetails.createdBy}</span>
            </div>
            <div>
              <span style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '4px'}}>Organization ID</span>
              <span style={{fontSize: '14px', color: '#888', fontFamily: 'monospace'}}>{organizationDetails.organizationId}</span>
            </div>
          </div>
        </div>
      )}

      <div className="members-section">
        <h3 style={{margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: '600'}}>Members ({members.length})</h3>
        
        {(isSuperAdmin || isOwnerOrAdmin) && (
          <div className="add-member-form" style={{
            background: '#f8fff8',
            border: '1px solid #d4edda',
            borderRadius: '8px',
            padding: '20px',
            margin: '0 0 24px 0'
          }}>
            <h4 style={{margin: '0 0 16px 0', color: '#155724', fontSize: '16px', fontWeight: '600'}}>Add New Member</h4>
            <form onSubmit={addMember}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '12px', alignItems: 'end'}}>
                <div>
                  <label style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '6px'}}>Email</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontSize: '14px', color: '#666', fontWeight: '500', marginBottom: '6px'}}>Role</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    {(isSuperAdmin || selectedOrganization.role === 'owner') && <option value="owner">Owner</option>}
                  </select>
                </div>
                <button 
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="members-list">
          {members.length === 0 ? (
            <p>No members found.</p>
          ) : (
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: '#f0f0f0'}}>
                  <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Name</th>
                  <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Email</th>
                  <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Role</th>
                  <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Joined</th>
                  <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Invited By</th>
                  {(isSuperAdmin || isOwnerOrAdmin) && <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.userId}>
                    <td style={{padding: '10px', border: '1px solid #ddd'}}>
                      {member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}`
                        : member.userId}
                    </td>
                    <td style={{padding: '10px', border: '1px solid #ddd'}}>{member.email || 'N/A'}</td>
                    <td style={{padding: '10px', border: '1px solid #ddd'}}>
                      {(isSuperAdmin || (isOwnerOrAdmin && selectedOrganization.role === 'owner')) && member.role !== 'owner' ? (
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.userId, e.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </select>
                      ) : (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: member.role === 'owner' ? '#ff9800' : member.role === 'admin' ? '#2196f3' : '#4caf50',
                          color: 'white',
                          fontSize: '12px'
                        }}>
                          {member.role.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td style={{padding: '10px', border: '1px solid #ddd'}}>
                      {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{padding: '10px', border: '1px solid #ddd'}}>{member.invitedBy || 'N/A'}</td>
                    {(isSuperAdmin || isOwnerOrAdmin) && (
                      <td style={{padding: '10px', border: '1px solid #ddd'}}>
                        <button
                          onClick={() => removeMember(member.userId)}
                          style={{background: '#f44336', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'}}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Events Section */}
      <div className="events-section" style={{
        background: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '24px',
        margin: '20px 0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: '600'}}>
          Events ({events.length})
        </h3>
        
        {events.length > 0 ? (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px'}}>
            {events.map(event => (
              <div 
                key={event.eventId}
                onClick={() => navigate(`/backoffice/events/${event.eventId}`)}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: '#fafafa'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h4 style={{margin: '0 0 8px 0', color: '#333', fontSize: '16px'}}>{event.name}</h4>
                <div style={{fontSize: '13px', color: '#666', marginBottom: '4px'}}>
                  📍 {event.location}
                </div>
                <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>
                  📅 {new Date(event.startDate).toLocaleDateString()}
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  background: event.published ? '#28a745' : '#6c757d',
                  color: 'white'
                }}>
                  {event.published ? 'Published' : 'Draft'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{color: '#666', textAlign: 'center', padding: '20px'}}>
            No events created yet for this organization
          </p>
        )}
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`} style={{
          padding: '10px',
          margin: '10px 0',
          borderRadius: '4px',
          background: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}

      {isSuperAdmin && (
        <div className="super-admin-info" style={{background: '#fff3cd', padding: '15px', margin: '15px 0', borderRadius: '5px', border: '1px solid #ffeaa7'}}>
          <h4>🔧 Super Admin View</h4>
          <p>You have super admin privileges and can manage all organizations.</p>
          <p><strong>Total Organizations:</strong> {organizations.length}</p>
        </div>
      )}
    </div>
  );
}

export default OrganizationManagement;
