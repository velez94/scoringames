import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function AthleteManagement() {
  const [athletes, setAthletes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    division: 'Open'
  });

  const divisions = ['Open', 'Women', 'Masters', 'Scaled'];

  useEffect(() => {
    fetchAthletes();
  }, []);

  const fetchAthletes = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      setAthletes(response || []);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      setAthletes([]);
    }
  };

  const handleCreate = () => {
    setEditingAthlete(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      division: 'Open'
    });
    setShowModal(true);
  };

  const handleEdit = (athlete) => {
    setEditingAthlete(athlete);
    setFormData({
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      email: athlete.email,
      division: athlete.division
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

  const filteredAthletes = athletes.filter(athlete => {
    const fullName = `${athlete.firstName} ${athlete.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         athlete.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDivision = !filterDivision || athlete.division === filterDivision;
    return matchesSearch && matchesDivision;
  });

  return (
    <div className="athlete-management">
      <div className="page-header">
        <h1>Athlete Management</h1>
        <button onClick={handleCreate} className="btn-primary">
          Add New Athlete
        </button>
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
          value={filterDivision}
          onChange={(e) => setFilterDivision(e.target.value)}
          className="filter-select"
        >
          <option value="">All Divisions</option>
          {divisions.map(division => (
            <option key={division} value={division}>{division}</option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table className="athletes-table">
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Email</th>
              <th>Division</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAthletes.map(athlete => {
              const fullName = `${athlete.firstName} ${athlete.lastName}`;
              return (
                <tr key={athlete.athleteId}>
                  <td className="athlete-name">
                    <div className="avatar">
                      {fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    {fullName}
                  </td>
                  <td>{athlete.email}</td>
                  <td>
                    <span className="division-badge">{athlete.division}</span>
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
                        onClick={() => handleDelete(athlete.athleteId)}
                        className="btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
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
                <label>Division</label>
                <select
                  value={formData.division}
                  onChange={(e) => setFormData({...formData, division: e.target.value})}
                  required
                >
                  {divisions.map(division => (
                    <option key={division} value={division}>{division}</option>
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
        .division-badge {
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
      `}</style>
    </div>
  );
}

export default AthleteManagement;
