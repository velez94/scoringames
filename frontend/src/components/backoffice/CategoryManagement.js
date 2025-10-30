import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import './Backoffice.css';

function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterGender, setFilterGender] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requirements: '',
    minAge: '',
    maxAge: '',
    gender: 'Mixed',
    maxParticipants: ''
  });

  const genderOptions = ['Mixed', 'Male', 'Female'];
  const filterOptions = ['All', 'Mixed', 'Male', 'Female'];
  const typeOptions = ['All', 'Global', 'Event-Specific'];

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [categories, filterGender, filterType]);

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const applyFilters = () => {
    let filtered = categories;

    if (filterGender !== 'All') {
      filtered = filtered.filter(cat => cat.gender === filterGender);
    }

    if (filterType !== 'All') {
      if (filterType === 'Global') {
        filtered = filtered.filter(cat => !cat.eventId || cat.eventId === 'global');
      } else if (filterType === 'Event-Specific') {
        filtered = filtered.filter(cat => cat.eventId && cat.eventId !== 'global');
      }
    }

    setFilteredCategories(filtered);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      requirements: '',
      minAge: '',
      maxAge: '',
      gender: 'Mixed',
      maxParticipants: ''
    });
    setShowModal(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      requirements: category.requirements || '',
      minAge: category.minAge || '',
      maxAge: category.maxAge || '',
      gender: category.gender || 'Mixed',
      maxParticipants: category.maxParticipants || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (categoryId, eventId) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const url = eventId 
        ? `/categories/${categoryId}?eventId=${eventId}`
        : `/categories/${categoryId}`;
      await API.del('CalisthenicsAPI', url);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error deleting category. You may not have permission.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const categoryData = {
        ...formData,
        categoryId: editingCategory?.categoryId || `category-${Date.now()}`,
        createdAt: editingCategory?.createdAt || new Date().toISOString()
      };

      if (editingCategory) {
        await API.put('CalisthenicsAPI', `/categories/${editingCategory.categoryId}`, { body: categoryData });
      } else {
        await API.post('CalisthenicsAPI', '/categories', { body: categoryData });
      }

      setShowModal(false);
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error saving category');
    }
  };

  return (
    <div className="category-management">
      <div className="page-header">
        <h1>Category Management</h1>
        <button onClick={handleCreate} className="btn-primary">
          Add Category
        </button>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Filter by Gender:</label>
          <select 
            value={filterGender} 
            onChange={(e) => setFilterGender(e.target.value)}
            className="filter-select"
          >
            {filterOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Filter by Type:</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            {typeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="filter-stats">
          Showing {filteredCategories.length} of {categories.length} categories
        </div>
      </div>

      <div className="categories-grid">
        {filteredCategories.map(category => (
          <div key={category.categoryId} className="category-card">
            <div className="category-header">
              <h3>{category.name}</h3>
              <div className="category-badges">
                <span className="gender-badge">{category.gender}</span>
                {(!category.eventId || category.eventId === 'global') && (
                  <span className="type-badge global">Global</span>
                )}
                {(category.eventId && category.eventId !== 'global') && (
                  <span className="type-badge event">Event</span>
                )}
              </div>
            </div>
            <p className="category-description">{category.description}</p>
            
            {(category.minAge || category.maxAge) && (
              <div className="age-range">
                <strong>Age:</strong> 
                {category.minAge && category.maxAge 
                  ? ` ${category.minAge}-${category.maxAge} years`
                  : category.minAge 
                    ? ` ${category.minAge}+ years`
                    : ` Up to ${category.maxAge} years`
                }
              </div>
            )}
            
            {category.requirements && (
              <div className="requirements">
                <strong>Requirements:</strong>
                <p>{category.requirements}</p>
              </div>
            )}

            {category.maxParticipants && (
              <div className="max-participants">
                <strong>Max Participants:</strong> {category.maxParticipants}
              </div>
            )}

            <div className="category-actions">
              {category.eventId && category.eventId !== 'global' && (
                <>
                  <button onClick={() => handleEdit(category)} className="btn-outline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(category.categoryId, category.eventId)} className="btn-danger">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && categories.length > 0 && (
          <div className="no-results">
            <p>No categories match the current filters.</p>
            <button onClick={() => {setFilterGender('All'); setFilterType('All');}} className="btn-outline">
              Clear Filters
            </button>
          </div>
        )}

        {categories.length === 0 && (
          <div className="no-categories">
            <p>No categories created yet.</p>
            <button onClick={handleCreate} className="btn-primary">
              Create First Category
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Category Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  >
                    {genderOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Min Age</label>
                  <input
                    type="number"
                    value={formData.minAge}
                    onChange={(e) => setFormData({...formData, minAge: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label>Max Age</label>
                  <input
                    type="number"
                    value={formData.maxAge}
                    onChange={(e) => setFormData({...formData, maxAge: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Requirements</label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                  rows="3"
                  placeholder="Optional requirements or qualifications"
                />
              </div>

              <div className="form-group">
                <label>Max Participants for this category</label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({...formData, maxParticipants: e.target.value})}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingCategory ? 'Update' : 'Create'} Category
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .category-management {
          padding: 20px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .filters-section {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          flex-wrap: wrap;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .filter-group label {
          font-weight: 500;
          color: #333;
          white-space: nowrap;
        }
        .filter-select {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          min-width: 120px;
        }
        .filter-stats {
          color: #666;
          font-size: 14px;
          margin-left: auto;
        }
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }
        .category-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .category-header h3 {
          margin: 0;
          color: #333;
        }
        .category-badges {
          display: flex;
          gap: 8px;
        }
        .gender-badge {
          background: #007bff;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
        .type-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        .type-badge.global {
          background: #28a745;
          color: white;
        }
        .type-badge.event {
          background: #ffc107;
          color: #212529;
        }
        .category-description {
          color: #666;
          margin-bottom: 15px;
        }
        .age-range {
          margin-bottom: 10px;
          font-size: 14px;
        }
        .requirements {
          margin-bottom: 15px;
        }
        .requirements p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 14px;
        }
        .category-actions {
          display: flex;
          gap: 10px;
        }
        .no-categories {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .no-results {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .btn-primary {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        }
        .btn-outline {
          background: white;
          color: #007bff;
          border: 1px solid #007bff;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
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
          padding: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        @media (max-width: 768px) {
          .categories-grid {
            grid-template-columns: 1fr;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            gap: 15px;
          }
          .filters-section {
            flex-direction: column;
            align-items: stretch;
          }
          .filter-stats {
            margin-left: 0;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}

export default CategoryManagement;
