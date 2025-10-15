import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requirements: '',
    minAge: '',
    maxAge: '',
    gender: 'Mixed'
  });

  const genderOptions = ['Mixed', 'Male', 'Female'];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      requirements: '',
      minAge: '',
      maxAge: '',
      gender: 'Mixed'
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
      gender: category.gender || 'Mixed'
    });
    setShowModal(true);
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      await API.del('CalisthenicsAPI', `/categories/${categoryId}`);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error deleting category');
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

      <div className="categories-grid">
        {categories.map(category => (
          <div key={category.categoryId} className="category-card">
            <div className="category-header">
              <h3>{category.name}</h3>
              <span className="gender-badge">{category.gender}</span>
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

            <div className="category-actions">
              <button onClick={() => handleEdit(category)} className="btn-outline">
                Edit
              </button>
              <button onClick={() => handleDelete(category.categoryId)} className="btn-danger">
                Delete
              </button>
            </div>
          </div>
        ))}

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
          margin-bottom: 30px;
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
        .gender-badge {
          background: #007bff;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
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
        }
      `}</style>
    </div>
  );
}

export default CategoryManagement;
