import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function EventDetails({ eventId, onBack, onEdit }) {
  const [event, setEvent] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
      fetchAthletes();
    }
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/events/${eventId}`);
      setEvent(response);
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const fetchAthletes = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      setAthletes(response || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await API.post('CalisthenicsAPI', `/events/${eventId}/upload-image`, {
          body: {
            imageData: reader.result,
            fileName: file.name,
            contentType: file.type
          }
        });
        await fetchEventDetails();
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
      setUploading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div className="event-details">
      <div className="page-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h1>{event.name}</h1>
        <span className={`status ${event.status}`}>{event.status}</span>
        <button onClick={() => onEdit(event)} className="btn-edit">Edit Event</button>
      </div>

      {event.bannerImage && (
        <div className="banner-image">
          <img src={event.bannerImage} alt={event.name} />
        </div>
      )}

      <div className="upload-section">
        <label className="upload-btn">
          {uploading ? 'Uploading...' : 'Upload Banner Image'}
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
        </label>
      </div>

      <div className="event-info">
        <div className="info-card">
          <h3>Event Information</h3>
          <p><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
          <p><strong>Description:</strong> {event.description}</p>
          <p><strong>Max Participants:</strong> {event.maxParticipants}</p>
          {event.registrationDeadline && (
            <p><strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleDateString()}</p>
          )}
        </div>

        <div className="info-card">
          <h3>Workouts ({event.workouts?.length || 0})</h3>
          {event.workouts?.length > 0 ? (
            <div className="wods-list">
              {event.workouts.map((wod, index) => (
                <div key={wod.wodId || index} className="wod-card">
                  <div className="wod-header">
                    <h4>{wod.name}</h4>
                    <span className="wod-format">{wod.format}</span>
                  </div>
                  {wod.timeLimit && <p className="time-limit">{wod.timeLimit}</p>}
                  <div className="movements">
                    {wod.movements?.map((movement, i) => (
                      <div key={i} className="movement">
                        {movement.reps} {movement.exercise} {movement.weight && `(${movement.weight})`}
                      </div>
                    ))}
                  </div>
                  {wod.description && <p className="wod-description">{wod.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p>No workouts added yet</p>
          )}
        </div>

        <div className="info-card">
          <h3>Registered Athletes ({athletes.length})</h3>
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
            <p>No athletes registered yet</p>
          )}
        </div>
      </div>

      <style jsx>{`
        .event-details {
          padding: 20px;
        }
        .page-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }
        .btn-back, .btn-edit {
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-edit {
          background: #007bff;
          margin-left: auto;
        }
        .banner-image {
          width: 100%;
          max-height: 300px;
          overflow: hidden;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .banner-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .upload-section {
          margin-bottom: 20px;
        }
        .upload-btn {
          display: inline-block;
          background: #28a745;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }
        .upload-btn input {
          display: none;
        }
        .status {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        .status.upcoming { background: #e3f2fd; color: #1976d2; }
        .status.active { background: #e8f5e8; color: #388e3c; }
        .status.completed { background: #f3e5f5; color: #7b1fa2; }
        .event-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .info-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .info-card h3 {
          margin: 0 0 15px 0;
          color: #333;
        }
        .wods-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .wod-card {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
          background: #f9f9f9;
        }
        .wod-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .wod-header h4 {
          margin: 0;
          color: #333;
        }
        .wod-format {
          background: #007bff;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        .time-limit {
          font-weight: bold;
          color: #666;
          margin-bottom: 10px;
        }
        .movements {
          margin-bottom: 10px;
        }
        .movement {
          padding: 4px 0;
          border-bottom: 1px solid #eee;
        }
        .wod-description {
          font-style: italic;
          color: #666;
          margin: 0;
        }
        .athletes-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .athlete-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #f9f9f9;
          border-radius: 4px;
        }
        .athlete-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .division {
          font-size: 12px;
          color: #666;
        }
        .email {
          font-size: 14px;
          color: #666;
        }
        @media (max-width: 768px) {
          .event-info {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
          .page-header h1 {
            font-size: 24px;
          }
          .info-card {
            padding: 15px;
          }
          .wod-card {
            padding: 12px;
          }
          .athlete-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default EventDetails;
