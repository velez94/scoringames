import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from 'aws-amplify';

function AthleteEventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [wods, setWods] = useState([]);
  const [scores, setScores] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWod, setSelectedWod] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  useEffect(() => {
    if (selectedCategory || selectedWod) {
      fetchScores();
    }
  }, [selectedCategory, selectedWod]);

  const fetchEventData = async () => {
    try {
      // First try to get the public event data
      const eventRes = await API.get('CalisthenicsAPI', `/public/events/${eventId}`);
      setEvent(eventRes);
      
      // Try to fetch authenticated data
      try {
        const [categoriesRes, wodsRes, athletesRes] = await Promise.all([
          API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`),
          API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`),
          API.get('CalisthenicsAPI', '/athletes')
        ]);

        setCategories(categoriesRes);
        setWods(wodsRes);
        setAthletes(athletesRes);
        setIsAuthenticated(true);
        
        if (categoriesRes.length > 0) setSelectedCategory(categoriesRes[0].categoryId);
      } catch (authError) {
        console.log('User not authenticated, showing limited view');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    if (!isAuthenticated) return;
    
    try {
      let url = `/scores?eventId=${eventId}`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (selectedWod) url += `&wodId=${selectedWod}`;
      
      const scoresRes = await API.get('CalisthenicsAPI', url);
      setScores(scoresRes);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  const getAthleteById = (athleteId) => {
    return athletes.find(a => a.userId === athleteId) || { firstName: 'Unknown', lastName: 'Athlete' };
  };

  const getCategoryById = (categoryId) => {
    return categories.find(c => c.categoryId === categoryId) || { name: 'Unknown Category' };
  };

  const getWodById = (wodId) => {
    return wods.find(w => w.wodId === wodId) || { name: 'Unknown WOD' };
  };

  const getLeaderboard = () => {
    if (!scores.length) return [];
    
    let filteredScores = scores;
    if (selectedWod) {
      filteredScores = scores.filter(s => s.wodId === selectedWod);
    }
    
    return filteredScores
      .sort((a, b) => b.score - a.score)
      .map((score, index) => ({
        ...score,
        rank: index + 1,
        athlete: getAthleteById(score.athleteId)
      }));
  };

  if (loading) return <div className="loading">Loading event details...</div>;
  if (!event) return <div className="error">Event not found</div>;

  return (
    <div className="athlete-event-details">
      <button onClick={() => navigate(-1)} className="back-btn">
        ← Back
      </button>

      <div className="event-header">
        <h1>{event.name}</h1>
        <div className="event-meta">
          <span>📅 {new Date(event.startDate).toLocaleDateString()}</span>
          <span>📍 {event.location}</span>
          <span className={`status ${event.status}`}>{event.status}</span>
        </div>
        <p>{event.description}</p>
      </div>

      {!isAuthenticated ? (
        <div className="auth-required">
          <div className="auth-card">
            <h2>🔐 Sign In Required</h2>
            <p>To view detailed event information including categories, workouts, and live leaderboards, please sign in to your account.</p>
            <div className="auth-actions">
              <button onClick={() => navigate('/login')} className="signin-btn">
                Sign In
              </button>
              <button onClick={() => navigate('/events')} className="browse-btn">
                Browse Other Events
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="content-grid">
          <div className="categories-section">
            <h2>Categories</h2>
            <div className="categories-list">
              {categories.map(category => (
                <div 
                  key={category.categoryId}
                  className={`category-card ${selectedCategory === category.categoryId ? 'selected' : ''}`}
                  onClick={() => setSelectedCategory(category.categoryId)}
                >
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <div className="category-meta">
                    {category.gender && <span>👤 {category.gender}</span>}
                    {category.minAge && <span>🎂 {category.minAge}+ years</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="wods-section">
            <h2>Workouts (WODs)</h2>
            <div className="wods-filter">
              <select 
                value={selectedWod} 
                onChange={(e) => setSelectedWod(e.target.value)}
              >
                <option value="">All WODs</option>
                {wods.map(wod => (
                  <option key={wod.wodId} value={wod.wodId}>{wod.name}</option>
                ))}
              </select>
            </div>
            <div className="wods-list">
              {wods.map(wod => (
                <div key={wod.wodId} className="wod-card">
                  <h3>{wod.name}</h3>
                  <p>{wod.description}</p>
                  <div className="wod-meta">
                    <span>⏱️ {wod.format}</span>
                    {wod.timeCap && <span>🕐 {wod.timeCap}s cap</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="scores-section">
            <h2>Leaderboard</h2>
            {selectedCategory && (
              <p className="category-filter">
                Showing: {getCategoryById(selectedCategory).name}
                {selectedWod && ` - ${getWodById(selectedWod).name}`}
              </p>
            )}
            <div className="leaderboard">
              {getLeaderboard().length > 0 ? (
                getLeaderboard().map(entry => (
                  <div key={entry.scoreId} className="score-entry">
                    <div className="rank">#{entry.rank}</div>
                    <div className="athlete-info">
                      <strong>{entry.athlete.firstName} {entry.athlete.lastName}</strong>
                      {!selectedWod && (
                        <small>{getWodById(entry.wodId).name}</small>
                      )}
                    </div>
                    <div className="score">{entry.score}</div>
                  </div>
                ))
              ) : (
                <p className="no-scores">No scores available for this selection</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .athlete-event-details {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .back-btn {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          margin-bottom: 20px;
        }
        .event-header {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        .event-header h1 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }
        .event-meta {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }
        .event-meta span {
          padding: 4px 12px;
          background: #f8f9fa;
          border-radius: 20px;
          font-size: 14px;
        }
        .status.active { background: #d4edda; color: #155724; }
        .status.upcoming { background: #fff3cd; color: #856404; }
        .auth-required {
          display: flex;
          justify-content: center;
          padding: 60px 20px;
        }
        .auth-card {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 500px;
        }
        .auth-card h2 {
          margin: 0 0 20px 0;
          color: #2c3e50;
        }
        .auth-card p {
          margin: 0 0 30px 0;
          color: #6c757d;
          line-height: 1.6;
        }
        .auth-actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .signin-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .signin-btn:hover {
          background: #0056b3;
        }
        .browse-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .browse-btn:hover {
          background: #545b62;
        }
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 30px;
        }
        @media (max-width: 768px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
          .auth-actions {
            flex-direction: column;
          }
        }
        .categories-section, .wods-section, .scores-section {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .categories-section h2, .wods-section h2, .scores-section h2 {
          margin: 0 0 20px 0;
          color: #2c3e50;
          border-bottom: 2px solid #3498db;
          padding-bottom: 10px;
        }
        .category-card {
          padding: 15px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          margin-bottom: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .category-card:hover {
          border-color: #3498db;
        }
        .category-card.selected {
          border-color: #3498db;
          background: #f8f9ff;
        }
        .category-card h3 {
          margin: 0 0 8px 0;
          color: #2c3e50;
        }
        .category-card p {
          margin: 0 0 10px 0;
          color: #6c757d;
          font-size: 14px;
        }
        .category-meta {
          display: flex;
          gap: 10px;
          font-size: 12px;
          color: #6c757d;
        }
        .wods-filter {
          margin-bottom: 20px;
        }
        .wods-filter select {
          width: 100%;
          padding: 10px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
        }
        .wod-card {
          padding: 15px;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          margin-bottom: 15px;
        }
        .wod-card h3 {
          margin: 0 0 8px 0;
          color: #2c3e50;
        }
        .wod-card p {
          margin: 0 0 10px 0;
          color: #6c757d;
          font-size: 14px;
        }
        .wod-meta {
          display: flex;
          gap: 10px;
          font-size: 12px;
          color: #6c757d;
        }
        .category-filter {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 15px;
          font-size: 14px;
          color: #495057;
        }
        .score-entry {
          display: flex;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #e9ecef;
        }
        .rank {
          font-weight: bold;
          color: #3498db;
          width: 40px;
        }
        .athlete-info {
          flex: 1;
          margin-left: 15px;
        }
        .athlete-info small {
          display: block;
          color: #6c757d;
          font-size: 12px;
        }
        .score {
          font-weight: bold;
          color: #2c3e50;
        }
        .no-scores {
          text-align: center;
          color: #6c757d;
          padding: 30px;
        }
        .loading, .error {
          text-align: center;
          padding: 60px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}

export default AthleteEventDetails;
