import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function AthleteManagement() {
  const [athletes, setAthletes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDivision, setFilterDivision] = useState('');

  const divisions = ['Male RX', 'Female RX', 'Male Scaled', 'Female Scaled'];

  useEffect(() => {
    fetchAthletes();
  }, []);

  const fetchAthletes = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      setAthletes(response);
    } catch (error) {
      console.error('Error fetching athletes:', error);
    }
  };

  const filteredAthletes = athletes.filter(athlete => {
    const matchesSearch = athlete.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         athlete.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDivision = !filterDivision || athlete.division === filterDivision;
    return matchesSearch && matchesDivision;
  });

  return (
    <div className="athlete-management">
      <div className="page-header">
        <h1>Athlete Management</h1>
        <div className="header-actions">
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
      </div>

      <div className="athletes-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Division</th>
              <th>Competitions</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAthletes.map(athlete => (
              <tr key={athlete.athleteId}>
                <td className="athlete-name">
                  <div className="avatar">
                    {athlete.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  {athlete.name}
                </td>
                <td>{athlete.email}</td>
                <td>
                  <span className="division-badge">{athlete.division}</span>
                </td>
                <td>{athlete.competitions?.length || 0}</td>
                <td>{new Date(athlete.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="actions">
                    <button className="btn-sm btn-outline">View</button>
                    <button className="btn-sm btn-warning">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAthletes.length === 0 && (
          <div className="no-data">
            No athletes found matching your criteria.
          </div>
        )}
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Athletes</h3>
          <div className="stat-number">{athletes.length}</div>
        </div>
        <div className="stat-card">
          <h3>Active This Month</h3>
          <div className="stat-number">
            {athletes.filter(a => new Date(a.createdAt) > new Date(Date.now() - 30*24*60*60*1000)).length}
          </div>
        </div>
        <div className="stat-card">
          <h3>By Division</h3>
          <div className="division-stats">
            {divisions.map(division => (
              <div key={division} className="division-stat">
                <span>{division}</span>
                <span>{athletes.filter(a => a.division === division).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .athlete-management {
          padding: 0;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header-actions {
          display: flex;
          gap: 15px;
        }
        .search-input,
        .filter-select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .search-input {
          width: 250px;
        }
        .athletes-table {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        th {
          background: #f8f9fa;
          font-weight: bold;
        }
        .athlete-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .avatar {
          width: 32px;
          height: 32px;
          background: #007bff;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }
        .division-badge {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        .actions {
          display: flex;
          gap: 5px;
        }
        .btn-sm {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }
        .btn-outline {
          background: transparent;
          border: 1px solid #007bff;
          color: #007bff;
        }
        .btn-warning {
          background: #ffc107;
          color: #212529;
        }
        .no-data {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .stats-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }
        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #007bff;
        }
        .division-stats {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .division-stat {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

export default AthleteManagement;
