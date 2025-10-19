import React, { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import './OrganizationSelector.css';

function OrganizationSelector() {
  const { organizations, selectedOrganization, selectOrganization, createOrganization } = useOrganization();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createOrganization(newOrgName, newOrgDescription);
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgDescription('');
    } catch (error) {
      alert('Failed to create organization: ' + error.message);
    }
  };

  return (
    <div className="organization-selector">
      <select 
        value={selectedOrganization?.organizationId || ''} 
        onChange={(e) => {
          const org = organizations.find(o => o.organizationId === e.target.value);
          if (org) selectOrganization(org);
        }}
        className="org-dropdown"
      >
        {organizations.map(org => (
          <option key={org.organizationId} value={org.organizationId}>
            {org.name} ({org.role})
          </option>
        ))}
      </select>
      
      <button onClick={() => setShowCreateModal(true)} className="btn-create-org">
        + New Organization
      </button>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Organization</h2>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="Organization Name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={newOrgDescription}
                onChange={(e) => setNewOrgDescription(e.target.value)}
              />
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrganizationSelector;
