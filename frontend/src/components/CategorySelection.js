import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function CategorySelection({ onCategorySelect, selectedCategoryId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading categories...</div>;
  }

  return (
    <div className="category-selection">
      <h3>Select Your Competition Category</h3>
      <p>Choose the category that best matches your profile. This cannot be changed later without admin assistance.</p>
      
      <div className="categories-grid">
        {categories.map(category => (
          <div 
            key={category.categoryId}
            className={`category-card ${selectedCategoryId === category.categoryId ? 'selected' : ''}`}
            onClick={() => onCategorySelect(category.categoryId)}
          >
            <h4>{category.name}</h4>
            <div className="category-details">
              <p><strong>Age:</strong> {category.ageRange}</p>
              <p><strong>Gender:</strong> {category.gender}</p>
              {category.requirements && (
                <p><strong>Requirements:</strong> {category.requirements}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .category-selection {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .category-selection h3 {
          text-align: center;
          color: #333;
          margin-bottom: 10px;
          font-size: 1.8rem;
          font-weight: 600;
        }
        .category-selection p {
          text-align: center;
          color: #666;
          margin-bottom: 30px;
          font-size: 16px;
          line-height: 1.5;
        }
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .category-card {
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: #fafafa;
        }
        .category-card:hover {
          border-color: #007bff;
          box-shadow: 0 4px 16px rgba(0,123,255,0.15);
          transform: translateY(-2px);
          background: white;
        }
        .category-card.selected {
          border-color: #28a745;
          background: #f8fff9;
          box-shadow: 0 4px 16px rgba(40,167,69,0.2);
        }
        .category-card h4 {
          margin: 0 0 15px 0;
          color: #007bff;
          font-size: 1.3rem;
          font-weight: 600;
        }
        .category-card.selected h4 {
          color: #28a745;
        }
        .category-details p {
          margin: 8px 0;
          font-size: 14px;
          color: #555;
        }
        .category-details strong {
          color: #333;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .category-selection {
            padding: 20px;
          }
          .categories-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default CategorySelection;
