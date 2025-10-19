import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useOrganization } from '../../contexts/OrganizationContext';

function AthleteManagement() {
  const { selectedOrganization } = useOrganization();
  const [athletes, setAthletes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [events, setCompetitions] = useState([]);
  const [athleteCompetitions, setAthleteCompetitions] = useState({});
  const [expandedAthlete, setExpandedAthlete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [editingAthlete, setEditingAthlete] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    alias: '',
    age: '',
    categoryId: ''
  });

  useEffect(() => {
    fetchAthletes();
    fetchCompetitions();
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      fetchCategories();
    }
  }, [events]);

  const fetchAthletes = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      setAthletes(response || []);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      setAthletes([]);
    }
  };

  const fetchCategories = async () => {
    try {
      // Get categories for all events
      const allCategories = [];
      for (const event of events) {
        try {
          const eventCategories = await API.get('CalisthenicsAPI', `/categories?eventId=${event.eventId}`);
          allCategories.push(...(eventCategories || []));
        } catch (error) {
          console.error(`Error fetching categories for event ${event.eventId}:`, error);
        }
      }
      setCategories(allCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchCompetitions = async () => {
    try {
      // Fetch all published events since athletes can register for any event
      const response = await API.get('CalisthenicsAPI', '/public/events');
      const comps = Array.isArray(response) ? response : [];
      console.log('Competitions loaded:', comps);
      setCompetitions(comps);
    } catch (error) {
      console.error('Error fetching events:', error);
      setCompetitions([]);
    }
  };

  const fetchAthleteCompetitions = async (athleteId) => {
    try {
      const response = await API.get('CalisthenicsAPI', `/athletes/${athleteId}/competitions`);
      const comps = Array.isArray(response) ? response : [];
      console.log('Athlete events:', comps);
      setAthleteCompetitions(prev => ({
        ...prev,
        [athleteId]: comps
      }));
    } catch (error) {
      console.error('Error fetching athlete events:', error);
      setAthleteCompetitions(prev => ({
        ...prev,
        [athleteId]: []
      }));
    }
  };

  const toggleAthleteExpand = async (athleteId) => {
    if (expandedAthlete === athleteId) {
      setExpandedAthlete(null);
    } else {
      setExpandedAthlete(athleteId);
      if (!athleteCompetitions[athleteId]) {
        await fetchAthleteCompetitions(athleteId);
      }
    }
  };

  const handleRegister = async (athleteId, eventId, categoryId) => {
    try {
      await API.post('CalisthenicsAPI', `/athletes/${athleteId}/competitions`, {
        body: { eventId, categoryId }
      });
      await fetchAthleteCompetitions(athleteId);
      alert('Athlete registered successfully');
    } catch (error) {
      console.error('Error registering athlete:', error);
      alert('Error registering athlete. Please try again.');
    }
  };

  const handleDeregister = async (athleteId, eventId, eventName) => {
    if (!window.confirm(`Are you sure you want to deregister this athlete from "${eventName}"?`)) {
      return;
    }

    try {
      await API.del('CalisthenicsAPI', `/athletes/${athleteId}/competitions/${eventId}`);
      await fetchAthleteCompetitions(athleteId);
      alert('Athlete deregistered successfully');
    } catch (error) {
      console.error('Error deregistering athlete:', error);
      alert('Error deregistering athlete. Please try again.');
    }
  };

  const handleCreate = () => {
    setEditingAthlete(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      alias: '',
      age: '',
      categoryId: ''
    });
    setShowModal(true);
  };

  const handleEdit = (athlete) => {
    setEditingAthlete(athlete);
    setFormData({
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      email: athlete.email,
      alias: athlete.alias || '',
      age: athlete.age || '',
      categoryId: athlete.categoryId || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (athleteId) => {
    if (!window.confirm('Are you sure you want to delete this athlete?')) {
      return;
    }

    try {
      await API.del('CalisthenicsAPI', `/athletes/${athleteId}`);
      await fetchAthletes();
    } catch (error) {
      console.error('Error deleting athlete:', error);
      alert('Error deleting athlete');
    }
  };

  const handleReset = async (athlete) => {
    if (window.confirm(`Reset ${athlete.firstName} ${athlete.lastName}? This will force them to complete the welcome setup again.`)) {
      try {
        await API.del('CalisthenicsAPI', `/athletes/${athlete.athleteId}`);
        await fetchAthletes();
        alert('User reset successfully. They will need to complete setup again on next login.');
      } catch (error) {
        console.error('Error resetting user:', error);
        alert('Error resetting user. Please try again.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const athleteData = {
        ...formData,
        athleteId: editingAthlete?.athleteId || `athlete-${Date.now()}`,
        createdAt: editingAthlete?.createdAt || new Date().toISOString()
      };

      if (editingAthlete) {
        await API.put('CalisthenicsAPI', `/athletes/${editingAthlete.athleteId}`, {
          body: athleteData
        });
      } else {
        await API.post('CalisthenicsAPI', '/athletes', {
          body: athleteData
        });
      }

      setShowModal(false);
      await fetchAthletes();
    } catch (error) {
      console.error('Error saving athlete:', error);
      alert('Error saving athlete');
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        const headers = rows[0];
        
        const summary = {
          total: rows.length - 1,
          success: 0,
          errors: [],
          fields: headers
        };

        for (let i = 1; i < rows.length; i++) {
          if (!rows[i][0]) continue;
          
          const athleteData = {
            athleteId: `athlete-${Date.now()}-${i}`,
            firstName: rows[i][0] || '',
            lastName: rows[i][1] || '',
            email: rows[i][2] || '',
            alias: rows[i][3] || '',
            age: rows[i][4] ? parseInt(rows[i][4]) : 0,
            categoryId: rows[i][5] || '',
            createdAt: new Date().toISOString()
          };

          try {
            await API.post('CalisthenicsAPI', '/athletes', { body: athleteData });
            summary.success++;
          } catch (error) {
            summary.errors.push(`Row ${i + 1}: ${error.message}`);
          }
        }

        setImportSummary(summary);
        await fetchAthletes();
      } catch (error) {
        alert('Error parsing file. Please ensure it\'s a valid CSV.');
      }
    };
    reader.readAsText(file);
  };

  const filteredAthletes = athletes.filter(athlete => {
    const fullName = `${athlete.firstName} ${athlete.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         athlete.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (athlete.alias && athlete.alias.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !filterCategory || athlete.categoryId === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="athlete-management">
      <div className="page-header">
        <h1>Athlete Management</h1>
        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={() => setShowImportModal(true)} className="btn-outline">
            Import CSV
          </button>
          <button onClick={handleCreate} className="btn-primary">
            Add New Athlete
          </button>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search athletes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table className="athletes-table">
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Alias</th>
              <th>Email</th>
              <th>Age</th>
              <th>Category</th>
              <th>Competitions</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAthletes.map(athlete => {
              const fullName = `${athlete.firstName} ${athlete.lastName}`;
              const isExpanded = expandedAthlete === athlete.athleteId;
              const athleteComps = athleteCompetitions[athlete.athleteId] || [];
              
              return (
                <React.Fragment key={athlete.athleteId}>
                  <tr>
                    <td className="athlete-name">
                      <div className="avatar">
                        {fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      {fullName}
                    </td>
                    <td>{athlete.alias || '-'}</td>
                    <td>{athlete.email}</td>
                    <td>{athlete.age || '-'}</td>
                    <td>
                      <span className="category-badge">
                        {categories.find(c => c.categoryId === athlete.categoryId)?.name || 'Not assigned'}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => toggleAthleteExpand(athlete.athleteId)}
                        className="btn-sm btn-info"
                        title="View events"
                      >
                        {isExpanded ? '▼' : '▶'} Competitions ({athleteComps.length})
                      </button>
                    </td>
                    <td>{new Date(athlete.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="actions">
                        <button 
                          onClick={() => handleEdit(athlete)}
                          className="btn-sm btn-outline"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleReset(athlete)}
                          className="btn-sm btn-warning"
                        >
                          Reset
                      </button>
                      <button 
                        onClick={() => handleDelete(athlete.athleteId)}
                        className="btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="expanded-row">
                    <td colSpan="8">
                      <div className="events-detail">
                        <h4>Registered Competitions</h4>
                        {athleteComps.length > 0 ? (
                          <div className="events-list">
                            {athleteComps.map((comp) => {
                              const competition = events.find(c => 
                                c.eventId === comp.eventId || 
                                c.id === comp.eventId ||
                                c.eventId === comp.id
                              );
                              return (
                                <div key={comp.eventId || comp.id} className="competition-item">
                                  <div className="comp-info">
                                    <strong>
                                      {competition?.name || competition?.title || comp.eventId || comp.id || 'Unknown Competition'}
                                      {competition?.startDate && ` (${new Date(competition.startDate).toLocaleDateString()})`}
                                    </strong>
                                    <span className="comp-date">
                                      Registered: {new Date(comp.registrationDate || comp.registeredAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="comp-actions">
                                    <span className={`status-badge ${competition?.status || 'active'}`}>
                                      {competition?.status || 'Active'}
                                    </span>
                                    <button 
                                      className="btn-deregister"
                                      onClick={() => handleDeregister(
                                        athlete.userId || athlete.athleteId,
                                        comp.eventId,
                                        competition?.name || comp.eventId
                                      )}
                                      title="Deregister athlete from this event"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="no-events">Not registered in any events</p>
                        )}
                        
                        <h4>Register for Event</h4>
                        <div className="registration-section">
                          {events.filter(event => {
                            const athleteComps = athleteCompetitions[athlete.userId || athlete.athleteId] || [];
                            return !athleteComps.some(comp => comp.eventId === event.eventId);
                          }).map(event => (
                            <div key={event.eventId} className="event-registration">
                              <div className="event-info">
                                <strong>{event.name}</strong>
                                <span className="event-date">
                                  {new Date(event.startDate).toLocaleDateString()}
                                </span>
                              </div>
                              <select 
                                className="category-select"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleRegister(
                                      athlete.userId || athlete.athleteId,
                                      event.eventId,
                                      e.target.value
                                    );
                                    e.target.value = '';
                                  }
                                }}
                              >
                                <option value="">Select Category</option>
                                {categories.filter(cat => cat.eventId === event.eventId).map(category => (
                                  <option key={category.categoryId} value={category.categoryId}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {events.filter(event => {
                            const athleteComps = athleteCompetitions[athlete.userId || athlete.athleteId] || [];
                            return !athleteComps.some(comp => comp.eventId === event.eventId);
                          }).length === 0 && (
                            <p className="no-events">All available events registered</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
            })}
          </tbody>
        </table>

        {filteredAthletes.length === 0 && (
          <div className="no-data">
            No athletes found matching your criteria.
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingAthlete ? 'Edit Athlete' : 'Add New Athlete'}</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Alias/Nickname</label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => setFormData({...formData, alias: e.target.value})}
                  placeholder="Competition alias"
                />
              </div>

              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  min="1"
                  max="100"
                />
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(category => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.name} ({category.ageRange}, {category.gender})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingAthlete ? 'Update' : 'Create'} Athlete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .athlete-management {
          padding: 20px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .page-header h1 {
          margin: 0;
          color: #333;
        }
        .btn-primary {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-primary:hover {
          background: #0056b3;
        }
        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }
        .search-input, .filter-select {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
        }
        .search-input {
          flex: 1;
          max-width: 300px;
        }
        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .athletes-table {
          width: 100%;
          border-collapse: collapse;
        }
        .athletes-table th {
          background: #f8f9fa;
          padding: 15px;
          text-align: left;
          font-weight: 600;
          color: #555;
          border-bottom: 1px solid #dee2e6;
        }
        .athletes-table td {
          padding: 15px;
          border-bottom: 1px solid #f1f1f1;
        }
        .athlete-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #007bff;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
        }
        .category-badge {
          background: #e9ecef;
          color: #495057;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn-sm {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          border: 1px solid;
        }
        .btn-outline {
          background: white;
          color: #007bff;
          border-color: #007bff;
        }
        .btn-outline:hover {
          background: #007bff;
          color: white;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }
        .btn-danger:hover {
          background: #c82333;
        }
        .btn-info {
          background: #17a2b8;
          color: white;
          border-color: #17a2b8;
        }
        .btn-info:hover {
          background: #138496;
        }
        .expanded-row {
          background: #f8f9fa;
        }
        .expanded-row td {
          padding: 0 !important;
        }
        .registration-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }
        .event-registration {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          margin-bottom: 10px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        .event-info {
          display: flex;
          flex-direction: column;
        }
        .event-date {
          font-size: 0.9em;
          color: #666;
        }
        .category-select {
          padding: 5px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }
        .events-detail {
          padding: 20px;
          border-top: 2px solid #dee2e6;
        }
        .events-detail h4 {
          margin: 0 0 15px 0;
          color: #495057;
          font-size: 16px;
        }
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .competition-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: white;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }
        .comp-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .comp-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .btn-deregister {
          background: #dc3545;
          color: white;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .btn-deregister:hover {
          background: #c82333;
          transform: scale(1.1);
        }
        .comp-info strong {
          color: #212529;
        }
        .comp-date {
          font-size: 12px;
          color: #6c757d;
        }
        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .status-badge.active {
          background: #d4edda;
          color: #155724;
        }
        .status-badge.upcoming {
          background: #d1ecf1;
          color: #0c5460;
        }
        .status-badge.completed {
          background: #d6d8db;
          color: #383d41;
        }
        .no-events {
          color: #6c757d;
          font-style: italic;
          margin: 10px 0;
        }
        .btn-warning {
          background: #ffc107;
          color: #212529;
          border-color: #ffc107;
        }
        .btn-warning:hover {
          background: #e0a800;
        }
        .no-data {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #dee2e6;
        }
        .modal-header h2 {
          margin: 0;
          color: #333;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }
        .modal-body {
          padding: 20px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
        }
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 30px;
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .athlete-management {
            padding: 10px;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
          .page-header h1 {
            font-size: 24px;
          }
          .filters {
            flex-direction: column;
            width: 100%;
          }
          .search-input {
            max-width: 100%;
          }
          .table-container {
            overflow-x: auto;
          }
          .athletes-table {
            min-width: 600px;
          }
          .athletes-table th,
          .athletes-table td {
            padding: 10px 8px;
            font-size: 13px;
          }
          .avatar {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }
          .actions {
            flex-direction: column;
            gap: 4px;
          }
          .btn-sm {
            width: 100%;
            text-align: center;
          }
          .competition-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .modal-content {
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
          }
        }
      `}</style>

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import Athletes from CSV</h3>
            
            <div className="import-instructions">
              <h4>CSV Format:</h4>
              <p>firstName,lastName,email,alias,age,categoryId</p>
              <p>Example: John,Doe,john@email.com,JD,25,category-1</p>
            </div>

            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileImport}
              style={{marginBottom: '20px'}}
            />

            {importSummary && (
              <div className="import-summary">
                <h4>Import Summary</h4>
                <p>Total rows: {importSummary.total}</p>
                <p style={{color: '#28a745'}}>Success: {importSummary.success}</p>
                <p style={{color: '#dc3545'}}>Errors: {importSummary.errors.length}</p>
                {importSummary.errors.length > 0 && (
                  <div style={{maxHeight: '200px', overflow: 'auto', marginTop: '10px'}}>
                    {importSummary.errors.map((err, i) => (
                      <p key={i} style={{color: '#dc3545', fontSize: '12px'}}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button onClick={() => {
                setShowImportModal(false);
                setImportSummary(null);
              }} className="btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AthleteManagement;
