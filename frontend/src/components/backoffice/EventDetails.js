import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CompetitionScheduler from '../CompetitionScheduler';

function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [eventDays, setEventDays] = useState([]);
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
      fetchEventDays();
      fetchCategories();
      fetchAthletes();
    }
  }, [eventId, location.pathname]); // Add location.pathname to refresh on navigation

  const fetchEventDetails = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/competitions/${eventId}`);
      setEvent(response);
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const fetchEventDays = async () => {
    try {
      const days = await API.get('CalisthenicsAPI', `/events/${eventId}/days`);
      setEventDays(days || []);
      
      // Fetch WODs for the event (not by day)
      const eventWods = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      setWods(eventWods || []);
    } catch (error) {
      console.error('Error fetching event days:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const eventCategories = await API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`);
      setCategories(eventCategories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchAthletes = async () => {
    try {
      // Get registered athletes for this event
      const registeredAthletes = await API.get('CalisthenicsAPI', `/athletes?eventId=${eventId}`);
      setAthletes(registeredAthletes || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      setAthletes([]);
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      console.log('Getting presigned URL...');
      // Get presigned URL from backend
      const response = await API.post('CalisthenicsAPI', `/competitions/${eventId}/upload-url`, {
        body: {
          fileName: file.name,
          contentType: file.type
        }
      });
      
      console.log('Presigned URL response:', response);
      const { uploadUrl, imageUrl } = response;
      
      console.log('Uploading to S3...');
      // Upload directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      
      console.log('S3 upload response:', uploadResponse.status);
      
      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.statusText}`);
      }
      
      console.log('Updating event with imageUrl...');
      // Update event with image URL
      await API.put('CalisthenicsAPI', `/competitions/${eventId}`, {
        body: { imageUrl }
      });
      
      console.log('Refreshing event details...');
      await fetchEventDetails();
      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="loading-spinner">Loading event details...</div>;
  if (!event) return <div className="error-message">Event not found</div>;

  return (
    <div className="event-details">
      <div className="page-header">
        <button onClick={() => navigate('/backoffice/events')} className="btn-back">
          <span>←</span> Back to Events
        </button>
        <div className="header-content">
          <div className="title-section">
            <h1>{event.name}</h1>
            <div className="badges">
              <span className={`badge status-${event.status}`}>{event.status}</span>
              <span className={`badge ${event.published ? 'published' : 'draft'}`}>
                {event.published ? '✓ Published' : '✗ Draft'}
              </span>
            </div>
          </div>
          <button onClick={() => navigate(`/backoffice/events/${eventId}/edit`)} className="btn-edit">
            Edit Event
          </button>
        </div>
      </div>

      {event.imageUrl && (
        <div className="banner-container">
          <img src={event.imageUrl} alt={event.name} className="banner-image" />
          <div className="banner-overlay">
            <h2>{event.name}</h2>
            <p>{event.location || 'Location TBD'}</p>
          </div>
        </div>
      )}

      <div className="upload-section">
        <label className={`upload-btn ${uploading ? 'uploading' : ''}`}>
          <span className="upload-icon">📷</span>
          {uploading ? 'Uploading...' : event.imageUrl ? 'Change Banner' : 'Upload Banner'}
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
        </label>
      </div>

      <div className="event-grid">
        <div className="info-card primary">
          <div className="card-header">
            <h3>📅 Event Information</h3>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="label">Start Date:</span>
              <span className="value">{event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}</span>
            </div>
            <div className="info-row">
              <span className="label">End Date:</span>
              <span className="value">{event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}</span>
            </div>
            <div className="info-row">
              <span className="label">Location:</span>
              <span className="value">{event.location || 'TBD'}</span>
            </div>
            <div className="info-row">
              <span className="label">Max Participants:</span>
              <span className="value">{event.maxParticipants || 'Unlimited'}</span>
            </div>
            <div className="info-row">
              <span className="label">Categories:</span>
              <span className="value">
                {categories.length > 0 ? (
                  <div className="categories-list">
                    {categories.map(category => (
                      <span key={category.categoryId} className="category-badge">
                        {category.name}
                      </span>
                    ))}
                  </div>
                ) : 'No categories defined'}
              </span>
            </div>
            {event.registrationDeadline && (
              <div className="info-row">
                <span className="label">Registration Deadline:</span>
                <span className="value">{new Date(event.registrationDeadline).toLocaleDateString()}</span>
              </div>
            )}
            {event.description && (
              <div className="description-section">
                <span className="label">Description:</span>
                <p className="description">{event.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="info-card">
          <div className="card-header">
            <h3>💪 Workouts</h3>
            <span className="count-badge">{wods.length}</span>
          </div>
          <div className="card-body">
            {wods.length > 0 ? (
              <div className="wods-grid">
                {wods.map((wod, index) => (
                  <div key={wod.wodId || index} className="wod-card">
                    <div className="wod-header">
                      <h4>{wod.name}</h4>
                      <span className="wod-format">{wod.format}</span>
                    </div>
                    {wod.timeLimit && <p className="time-limit">⏱️ {wod.timeLimit}</p>}
                    <div className="movements">
                      {wod.movements?.map((movement, i) => (
                        <div key={i} className="movement">
                          <span className="reps">{movement.reps}</span>
                          <span className="exercise">{movement.exercise}</span>
                          {movement.weight && <span className="weight">{movement.weight}</span>}
                        </div>
                      ))}
                    </div>
                    {wod.description && <p className="wod-description">{wod.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No workouts added yet</p>
                <button onClick={() => navigate(`/backoffice/events/${eventId}/edit`)} className="btn-add">
                  + Add Workout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="info-card">
          <div className="card-header">
            <h3>👥 Registered Athletes</h3>
            <span className="count-badge">{athletes.length}</span>
          </div>
          <div className="card-body">
            {athletes.length > 0 ? (
              <div className="athletes-list">
                {athletes.map(athlete => (
                  <div key={athlete.athleteId} className="athlete-item">
                    <div className="athlete-info">
                      <strong>{athlete.firstName} {athlete.lastName}</strong>
                      <span className="division">{athlete.division}</span>
                    </div>
                    <span className="email">{athlete.email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No athletes registered yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Competition Scheduler Section */}
      <div className="scheduler-section">
        <div className="info-card primary">
          <div className="card-header">
            <h3>📅 Competition Scheduler</h3>
          </div>
          <div className="card-body">
            <CompetitionScheduler 
              eventId={eventId}
              onScheduleGenerated={(schedule) => {
                console.log('Schedule generated for event:', eventId, schedule);
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .event-details {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .loading-spinner, .error-message {
          text-align: center;
          padding: 40px;
          font-size: 18px;
          color: #666;
        }
        .page-header {
          margin-bottom: 30px;
        }
        .btn-back {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
        }
        .btn-back:hover {
          background: #5a6268;
          transform: translateX(-2px);
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          width: 100%;
        }
        .title-section {
          flex: 1;
          text-align: center;
        }
        .title-section h1 {
          margin: 0 0 10px 0;
          font-size: 42px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }
        .badges {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .badge.status-upcoming { background: #e3f2fd; color: #1976d2; }
        .badge.status-active { background: #e8f5e9; color: #2e7d32; }
        .badge.status-completed { background: #f3e5f5; color: #7b1fa2; }
        .badge.published { background: #d4edda; color: #155724; }
        .badge.draft { background: #fff3cd; color: #856404; }
        .btn-edit {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-edit:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .banner-container {
          position: relative;
          width: 100%;
          height: 400px;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .banner-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .banner-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
          padding: 30px;
          color: white;
        }
        .banner-overlay h2 {
          margin: 0 0 8px 0;
          font-size: 36px;
        }
        .banner-overlay p {
          margin: 0;
          font-size: 18px;
          opacity: 0.9;
        }
        .upload-section {
          margin-bottom: 30px;
          text-align: center;
        }
        .upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 28px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
          border: none;
        }
        .upload-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        .upload-btn.uploading {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .upload-btn input {
          display: none;
        }
        .upload-icon {
          font-size: 20px;
        }
        .event-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .info-card {
          background: white;
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          transition: all 0.3s;
        }
        .info-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .info-card.primary {
          grid-column: 1 / -1;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 2px solid #f0f0f0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px 12px 0 0;
        }
        .card-header h3 {
          margin: 0;
          color: white;
          font-size: 18px;
          font-weight: 600;
        }
        .count-badge {
          background: rgba(255,255,255,0.3);
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
        }
        .card-body {
          padding: 24px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-row .label {
          font-weight: 600;
          color: #666;
        }
        .info-row .value {
          color: #333;
          text-align: right;
        }
        .description-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #f0f0f0;
        }
        .description-section .label {
          font-weight: 600;
          color: #666;
          display: block;
          margin-bottom: 10px;
        }
        .description {
          color: #555;
          line-height: 1.6;
          margin: 0;
        }
        .wods-grid {
          display: grid;
          gap: 16px;
        }
        .wod-card {
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          padding: 20px;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          transition: all 0.3s;
        }
        .wod-card:hover {
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        .wod-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .wod-header h4 {
          margin: 0;
          color: #2c3e50;
          font-size: 18px;
        }
        .wod-format {
          background: #667eea;
          color: white;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .time-limit {
          color: #666;
          font-size: 14px;
          margin: 8px 0;
        }
        .movements {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 12px 0;
        }
        .movement {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
        }
        .movement .reps {
          font-weight: 700;
          color: #667eea;
          min-width: 40px;
        }
        .movement .exercise {
          flex: 1;
          color: #333;
        }
        .movement .weight {
          color: #666;
          font-size: 13px;
        }
        .wod-description {
          margin-top: 12px;
          color: #555;
          font-size: 14px;
          font-style: italic;
        }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }
        .empty-state p {
          margin-bottom: 20px;
        }
        .btn-add {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-add:hover {
          background: #218838;
          transform: translateY(-2px);
        }
        .athletes-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 8px;
        }
        .athletes-list::-webkit-scrollbar {
          width: 8px;
        }
        .athletes-list::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .athletes-list::-webkit-scrollbar-thumb {
          background: #667eea;
          border-radius: 4px;
        }
        .athletes-list::-webkit-scrollbar-thumb:hover {
          background: #5568d3;
        }
        .athlete-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        .athlete-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .athlete-info strong {
          color: #333;
        }
        .division {
          font-size: 12px;
          color: #666;
        }
        .email {
          color: #999;
          font-size: 13px;
        }
        .scheduler-section {
          margin-top: 30px;
        }
        .scheduler-section .card-body {
          padding: 0;
        }
        .categories-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .category-badge {
          background: #007bff;
          color: white;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }
        @media (max-width: 768px) {
          .event-grid {
            grid-template-columns: 1fr;
          }
          .banner-container {
            height: 250px;
          }
          .banner-overlay h2 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}

export default EventDetails;
