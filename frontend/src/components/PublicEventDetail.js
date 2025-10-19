import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function PublicEventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(`${apiUrl}/public/events/${eventId}`);
      const eventData = await response.json();

      if (!eventData.published) {
        navigate('/events');
        return;
      }

      setEvent(eventData);
    } catch (error) {
      console.error('Error fetching event:', error);
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!event) return null;

  return (
    <div className="public-event-detail">
      <button onClick={() => navigate('/events')} className="back-btn">
        ← Back to Events
      </button>

      <div className="event-header">
        <h1>{event.name}</h1>
        <div className="event-meta">
          <span>📅 {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}</span>
          <span>📍 {event.location}</span>
          <span className={`status-badge ${event.status}`}>{event.status}</span>
        </div>
        <p className="event-description">{event.description}</p>
      </div>

      <div className="cta-section">
        <h2>Interested in Competing?</h2>
        <p>Sign in to view full event details, workouts, and live leaderboards</p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          Sign In to View More
        </button>
      </div>

      <style jsx>{`
        .public-event-detail {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 40px 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .back-btn {
          background: white;
          border: 2px solid #667eea;
          color: #667eea;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 30px;
        }
        .back-btn:hover {
          background: #667eea;
          color: white;
        }
        .event-header {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        .event-header h1 {
          margin: 0 0 20px 0;
          font-size: 36px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .event-meta {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          font-size: 16px;
          color: #6c757d;
        }
        .event-description {
          color: #495057;
          line-height: 1.8;
          font-size: 16px;
        }
        .cta-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 60px 40px;
          border-radius: 16px;
          text-align: center;
          color: white;
          box-shadow: 0 8px 24px rgba(102,126,234,0.3);
        }
        .cta-section h2 {
          margin: 0 0 16px 0;
          font-size: 32px;
        }
        .cta-section p {
          margin: 0 0 32px 0;
          font-size: 18px;
          opacity: 0.95;
        }
        .btn-primary {
          background: white;
          color: #667eea;
          border: none;
          padding: 16px 40px;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }
        .status-badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-badge.active {
          background: linear-gradient(135deg, #d4edda, #c3e6cb);
          color: #155724;
        }
        .status-badge.upcoming {
          background: linear-gradient(135deg, #fff3cd, #ffeaa7);
          color: #856404;
        }
        .loading {
          text-align: center;
          padding: 60px;
        }
      `}</style>
    </div>
  );
}

export default PublicEventDetail;
