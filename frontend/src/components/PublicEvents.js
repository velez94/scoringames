import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useNavigate } from 'react-router-dom';

function PublicEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPublishedEvents();
  }, []);

  const fetchPublishedEvents = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(`${apiUrl}/public/events`);
      const data = await response.json();
      console.log('Published events:', data);
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  return (
    <div className="public-events">
      <div className="hero">
        <h1>Competition Events</h1>
        <p>Browse our upcoming and active competitions</p>
      </div>

      {events.length === 0 ? (
        <div className="no-events">
          <p>No published events at this time. Check back soon!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <div 
              key={event.eventId} 
              className="event-cube"
              onClick={() => navigate(`/events/${event.eventId}`)}
            >
              <div className="event-image">
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt={event.name} />
                ) : (
                  <div className="placeholder-image">🏆</div>
                )}
              </div>
              <div className="event-content">
                <h3>{event.name}</h3>
                <p className="event-date">
                  📅 {new Date(event.startDate).toLocaleDateString()}
                </p>
                <p className="event-location">📍 {event.location}</p>
                <p className="event-description">{event.description}</p>
                <span className={`status-badge ${event.status}`}>
                  {event.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .public-events {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 40px 20px;
        }
        .hero {
          text-align: center;
          margin-bottom: 50px;
        }
        .hero h1 {
          font-size: 48px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 15px 0;
        }
        .hero p {
          font-size: 20px;
          color: #6c757d;
        }
        .loading, .no-events {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          max-width: 600px;
          margin: 0 auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 30px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .event-cube {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .event-cube:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.15);
        }
        .event-image {
          width: 100%;
          height: 200px;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .event-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .placeholder-image {
          font-size: 80px;
        }
        .event-content {
          padding: 24px;
        }
        .event-content h3 {
          margin: 0 0 16px 0;
          color: #2c3e50;
          font-size: 24px;
          font-weight: 600;
        }
        .event-date, .event-location {
          margin: 8px 0;
          color: #6c757d;
          font-size: 14px;
        }
        .event-description {
          margin: 16px 0;
          color: #495057;
          font-size: 14px;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 12px;
        }
        .status-badge.active {
          background: linear-gradient(135deg, #d4edda, #c3e6cb);
          color: #155724;
        }
        .status-badge.upcoming {
          background: linear-gradient(135deg, #fff3cd, #ffeaa7);
          color: #856404;
        }
        .status-badge.completed {
          background: linear-gradient(135deg, #e2e3e5, #d6d8db);
          color: #383d41;
        }
        @media (max-width: 768px) {
          .hero h1 {
            font-size: 36px;
          }
          .events-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default PublicEvents;
