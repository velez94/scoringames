import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function ScoreEntry({ user }) {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Score entry modes - Enhanced with schedule-based tournament layout
  const [entryMode, setEntryMode] = useState('wod'); // 'wod' or 'schedule'
  const [publishedSchedules, setPublishedSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [heatScores, setHeatScores] = useState({}); // Store scores by heat and athlete
  const [completedHeats, setCompletedHeats] = useState(new Set()); // Track completed heats
  
  const [scoreData, setScoreData] = useState({
    athleteId: '',
    wodId: '',
    categoryId: '',
    dayId: '',
    score: '',
    sessionId: '' // For scheduled mode
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const userRole = user?.attributes?.['custom:role'] || 'athlete';
  const organizerId = user?.attributes?.sub;

  useEffect(() => {
    fetchEvents();
    fetchCategories();
  }, []);

  useEffect(() => {
    const filtered = events.filter(event =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEvents(filtered);
  }, [searchTerm, events]);

  useEffect(() => {
    console.log('selectedEvent changed:', selectedEvent);
    if (selectedEvent) {
      console.log('Fetching WODs and schedules for event:', selectedEvent.eventId);
      fetchWods(selectedEvent.eventId);
      fetchPublishedSchedules();
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedSchedule) {
      fetchScheduledSessions();
    }
  }, [selectedSchedule]);

  const fetchEvents = async () => {
    try {
      // Athletes should see all published events, organizers see their organization's events
      if (userRole === 'athlete') {
        const response = await API.get('CalisthenicsAPI', '/public/events');
        setEvents(response);
        setFilteredEvents(response);
      } else {
        // For organizers, we need organization context - this should be handled by parent component
        const response = await API.get('CalisthenicsAPI', '/competitions', {
          queryStringParameters: { organizationId: 'all' } // Temporary fix
        });
        setEvents(response);
        setFilteredEvents(response);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      // Fallback to empty array to prevent UI breaking
      setEvents([]);
      setFilteredEvents([]);
    }
  };

  const fetchWods = async (eventId) => {
    try {
      console.log('Fetching WODs for eventId:', eventId);
      const response = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      console.log('WODs response:', response);
      setWods(response);
    } catch (error) {
      console.error('Error fetching WODs:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchPublishedSchedules = async () => {
    try {
      console.log('Fetching published schedules for eventId:', selectedEvent.eventId);
      const response = await API.get('CalisthenicsAPI', `/scheduler/${selectedEvent.eventId}`);
      console.log('Schedules response:', response);
      const schedules = Array.isArray(response) ? response.filter(s => s.published) : [];
      console.log('Published schedules:', schedules);
      setPublishedSchedules(schedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setPublishedSchedules([]);
    }
  };

  const fetchScheduledSessions = async () => {
    if (!selectedSchedule) return;
    
    try {
      // Extract sessions from schedule with athlete order
      const sessions = [];
      selectedSchedule.days?.forEach(day => {
        day.sessions?.forEach(session => {
          sessions.push({
            ...session,
            dayId: day.dayId,
            displayName: `${session.wodName || session.wodId} - ${session.categoryName || session.categoryId} (${session.startTime})`,
            athleteOrder: session.heats?.flatMap(heat => 
              heat.athletes?.map((athlete, index) => ({
                ...athlete,
                heatNumber: heat.heatNumber,
                orderInHeat: index + 1,
                overallOrder: sessions.length * 10 + heat.heatNumber * 100 + index
              })) || []
            ) || []
          });
        });
      });
      setScheduledSessions(sessions);
    } catch (error) {
      console.error('Error processing scheduled sessions:', error);
      setScheduledSessions([]);
    }
  };

  const handleHeatScore = (sessionId, heatIndex, athleteId, score) => {
    const scoreKey = `${sessionId}-${heatIndex}-${athleteId}`;
    setHeatScores(prev => ({
      ...prev,
      [scoreKey]: score
    }));
  };

  const getCompletedHeatsCount = (session) => {
    if (!session.matches) return 0;
    return session.matches.filter((match, index) => 
      isHeatCompleted(session.sessionId, index)
    ).length;
  };

  const isHeatCompleted = (sessionId, heatIndex) => {
    return completedHeats.has(`${sessionId}-${heatIndex}`);
  };

  const canSubmitHeat = (sessionId, heatIndex, match) => {
    const athlete1Score = heatScores[`${sessionId}-${heatIndex}-${match.athlete1?.userId || match.athlete1?.athleteId}`];
    const athlete2Score = heatScores[`${sessionId}-${heatIndex}-${match.athlete2?.userId || match.athlete2?.athleteId}`];
    
    // Can submit if at least one athlete has a score
    return athlete1Score || athlete2Score;
  };

  const submitHeatScores = async (session, heatIndex, match) => {
    try {
      setSubmitting(true);
      
      const scores = [];
      
      // Prepare athlete 1 score
      if (match.athlete1) {
        const athlete1Id = match.athlete1.userId || match.athlete1.athleteId;
        const score1 = heatScores[`${session.sessionId}-${heatIndex}-${athlete1Id}`];
        
        if (score1) {
          scores.push({
            eventId: selectedEvent.eventId,
            athleteId: athlete1Id,
            wodId: session.wodId,
            categoryId: session.categoryId,
            dayId: session.dayId,
            sessionId: session.sessionId,
            scheduleId: selectedSchedule.scheduleId,
            heatNumber: heatIndex + 1,
            score: parseFloat(score1)
          });
        }
      }
      
      // Prepare athlete 2 score
      if (match.athlete2) {
        const athlete2Id = match.athlete2.userId || match.athlete2.athleteId;
        const score2 = heatScores[`${session.sessionId}-${heatIndex}-${athlete2Id}`];
        
        if (score2) {
          scores.push({
            eventId: selectedEvent.eventId,
            athleteId: athlete2Id,
            wodId: session.wodId,
            categoryId: session.categoryId,
            dayId: session.dayId,
            sessionId: session.sessionId,
            scheduleId: selectedSchedule.scheduleId,
            heatNumber: heatIndex + 1,
            score: parseFloat(score2)
          });
        }
      }
      
      // Submit all scores for this heat
      for (const scorePayload of scores) {
        await API.post('CalisthenicsAPI', '/scores', {
          body: scorePayload
        });
      }
      
      // Mark heat as completed
      setCompletedHeats(prev => new Set([...prev, `${session.sessionId}-${heatIndex}`]));
      
      // Clear the submitted scores
      const keysToRemove = [
        `${session.sessionId}-${heatIndex}-${match.athlete1?.userId || match.athlete1?.athleteId}`,
        `${session.sessionId}-${heatIndex}-${match.athlete2?.userId || match.athlete2?.athleteId}`
      ];
      
      setHeatScores(prev => {
        const newScores = { ...prev };
        keysToRemove.forEach(key => delete newScores[key]);
        return newScores;
      });
      
      setMessage(`Heat ${heatIndex + 1} scores submitted successfully!`);
      
    } catch (error) {
      console.error('Error submitting heat scores:', error);
      setMessage('Error submitting heat scores: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getAthleteName = (athleteId) => {
    // This function should be implemented to get athlete names
    return athleteId; // Fallback to ID for now
  };

  const getAthleteAlias = (athleteId) => {
    // This function should be implemented to get athlete aliases
    return `@${athleteId}`; // Fallback format
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.categoryId === categoryId);
    return category ? category.name : categoryId;
  };

  const getWodName = (wodId) => {
    const wod = wods.find(w => w.wodId === wodId);
    return wod ? wod.name : wodId;
  };

  const groupSessionsByCategory = (sessions) => {
    const grouped = {};
    sessions?.forEach(session => {
      const categoryId = session.categoryId;
      if (!grouped[categoryId]) {
        grouped[categoryId] = [];
      }
      grouped[categoryId].push(session);
    });
    return grouped;
  };

  const handleSessionSelection = (session) => {
    setSelectedSession(session);
    // Auto-populate fields based on session
    setScoreData(prev => ({
      ...prev,
      wodId: session.wodId,
      categoryId: session.categoryId,
      dayId: session.dayId,
      sessionId: session.sessionId
    }));
  };

  const submitScore = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const scorePayload = {
        eventId: selectedEvent.eventId,
        ...scoreData,
        score: parseFloat(scoreData.score)
      };

      // Add session context for scheduled mode
      if (entryMode === 'scheduled' && selectedSession) {
        scorePayload.sessionId = selectedSession.sessionId;
        scorePayload.scheduleId = selectedSchedule.scheduleId;
      }

      await API.post('CalisthenicsAPI', '/scores', {
        body: scorePayload
      });

      setMessage('Score submitted successfully!');
      setScoreData({
        athleteId: '',
        wodId: '',
        categoryId: '',
        dayId: '',
        score: '',
        sessionId: ''
      });
      setSelectedSession(null);
    } catch (error) {
      console.error('Error submitting score:', error);
      setMessage('Error submitting score: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="score-entry">
      <h1>📊 Score Entry</h1>
      
      {!selectedEvent ? (
        <div className="event-selection">
          <h2>Step 1: Select Competition Event</h2>
          <div className="search-container">
            <input
              type="text"
              placeholder="🔍 Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="events-grid">
            {filteredEvents.map(event => (
              <div key={event.eventId} className="event-card" onClick={() => setSelectedEvent(event)}>
                <h3>{event.name}</h3>
                <p>📍 {event.location}</p>
                <p>📅 {new Date(event.startDate).toLocaleDateString()}</p>
                <span className={`status-badge ${event.status}`}>{event.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="selected-event-header">
            <div>
              <h2>✅ {selectedEvent.name}</h2>
              <p>{selectedEvent.location} • {new Date(selectedEvent.startDate).toLocaleDateString()}</p>
            </div>
            <button className="btn-secondary" onClick={() => setSelectedEvent(null)}>Change Event</button>
          </div>

          {/* Step 2: Mode Selection - Only show after event is selected */}
          <div className="mode-selection-header">
            <h3>Step 2: Choose Entry Method</h3>
            <div className="entry-mode-toggle">
              <button 
                className={`mode-btn ${entryMode === 'wod' ? 'active' : ''}`}
                onClick={() => setEntryMode('wod')}
              >
                📝 WOD-Based Entry
                <small>Manual selection of WOD and category</small>
              </button>
              <button 
                className={`mode-btn ${entryMode === 'schedule' ? 'active' : ''}`}
                onClick={() => setEntryMode('schedule')}
              >
                📅 Schedule-Based Entry
                <small>Follow tournament schedule structure</small>
              </button>
            </div>
          </div>
              className="search-input"
            />
          </div>
          
          <div className="events-grid">
            {filteredEvents.map(event => (
              <div key={event.eventId} className="event-card" onClick={() => setSelectedEvent(event)}>
                <h3>{event.name}</h3>
                <p>{event.location}</p>
                <p>{new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}</p>
                <span className={`status ${event.status}`}>{event.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="score-form-container">
          <div className="selected-event-header">
            <div>
              <h2>{selectedEvent.name}</h2>
              <p>{selectedEvent.location} • {new Date(selectedEvent.startDate).toLocaleDateString()}</p>
            </div>
            <button className="btn-secondary" onClick={() => setSelectedEvent(null)}>Change Event</button>
          </div>

          {/* Debug information */}
          <div style={{background: '#f0f0f0', padding: '10px', margin: '10px 0', fontSize: '12px', border: '1px solid #ccc'}}>
            <strong>🐛 Debug Info:</strong><br/>
            Selected Event ID: {selectedEvent.eventId}<br/>
            Entry Mode: {entryMode}<br/>
            WODs Count: {wods.length}<br/>
            Categories Count: {categories.length}<br/>
            Published Schedules Count: {publishedSchedules.length}<br/>
            {entryMode === 'wod' && (
              <>
                {wods.length > 0 && (
                  <div>WODs: {wods.map(w => w.name || w.wodId).join(', ')}</div>
                )}
                {wods.length === 0 && (
                  <div style={{color: 'red'}}>⚠️ No WODs found for this event!</div>
                )}
              </>
            )}
            {entryMode === 'schedule' && (
              <>
                {publishedSchedules.length > 0 && (
                  <div>Schedules: {publishedSchedules.map(s => s.scheduleId).join(', ')}</div>
                )}
                {publishedSchedules.length === 0 && (
                  <div style={{color: 'red'}}>⚠️ No published schedules found for this event!</div>
                )}
              </>
            )}
          </div>

          <form onSubmit={submitScore} className="score-form">
            <h3>Step 3: Enter Score</h3>
            {entryMode === 'schedule' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tournament Schedule *</label>
                    <select
                      value={selectedSchedule?.scheduleId || ''}
                      onChange={(e) => {
                        const schedule = publishedSchedules.find(s => s.scheduleId === e.target.value);
                        setSelectedSchedule(schedule);
                        setSelectedSession(null);
                      }}
                      required
                    >
                      <option value="">Select Schedule</option>
                      {publishedSchedules.map(schedule => (
                        <option key={schedule.scheduleId} value={schedule.scheduleId}>
                          {schedule.config?.competitionMode} - {new Date(schedule.generatedAt).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedSchedule && (
                  <div className="schedule-layout">
                    <h3>📅 Tournament Score Entry</h3>
                    {selectedSchedule.days?.map((day, dayIndex) => {
                      const groupedSessions = groupSessionsByCategory(day.sessions);
                      
                      return (
                        <div key={day.dayId} className="tournament-day">
                          <h4>📅 Day {dayIndex + 1} - {new Date(day.date).toLocaleDateString()}</h4>
                          
                          {Object.entries(groupedSessions).map(([categoryId, sessions]) => (
                            <div key={categoryId} className="tournament-category">
                              <div className="category-header">
                                <h5>🏆 {getCategoryName(categoryId)}</h5>
                                <span className="session-count">{sessions.length} session{sessions.length > 1 ? 's' : ''}</span>
                              </div>
                              
                              {sessions.map((session, sessionIndex) => (
                                <div key={session.sessionId} className="tournament-session">
                                  <div className="session-info">
                                    <h6>💪 {getWodName(session.wodId)}</h6>
                                    <span className="session-time">🕐 {session.startTime}</span>
                                    <span className="heat-progress">
                                      {getCompletedHeatsCount(session)} / {session.matches?.length || 0} heats completed
                                    </span>
                                  </div>
                                  
                                  <div className="heats-grid">
                                    {session.matches?.map((match, matchIndex) => (
                                      <div key={match.matchId || matchIndex} className={`heat-card ${isHeatCompleted(session.sessionId, matchIndex) ? 'completed' : ''}`}>
                                        <div className="heat-header">
                                          <span className="heat-number">Heat {matchIndex + 1}</span>
                                          {isHeatCompleted(session.sessionId, matchIndex) && (
                                            <span className="completed-badge">✅ Complete</span>
                                          )}
                                        </div>
                                        
                                        <div className="heat-matchup">
                                          {match.athlete1 && (
                                            <div className="athlete-score-entry">
                                              <div className="athlete-info">
                                                <span className="athlete-name">{getAthleteName(match.athlete1.userId || match.athlete1.athleteId)}</span>
                                                <span className="athlete-alias">{getAthleteAlias(match.athlete1.userId || match.athlete1.athleteId)}</span>
                                              </div>
                                              <div className="score-input-container">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  placeholder="Score"
                                                  className="heat-score-input"
                                                  value={heatScores[`${session.sessionId}-${matchIndex}-${match.athlete1.userId || match.athlete1.athleteId}`] || ''}
                                                  onChange={(e) => handleHeatScore(session.sessionId, matchIndex, match.athlete1.userId || match.athlete1.athleteId, e.target.value)}
                                                />
                                              </div>
                                            </div>
                                          )}
                                          
                                          {match.athlete1 && match.athlete2 && (
                                            <div className="vs-divider">VS</div>
                                          )}
                                          
                                          {match.athlete2 && (
                                            <div className="athlete-score-entry">
                                              <div className="athlete-info">
                                                <span className="athlete-name">{getAthleteName(match.athlete2.userId || match.athlete2.athleteId)}</span>
                                                <span className="athlete-alias">{getAthleteAlias(match.athlete2.userId || match.athlete2.athleteId)}</span>
                                              </div>
                                              <div className="score-input-container">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  placeholder="Score"
                                                  className="heat-score-input"
                                                  value={heatScores[`${session.sessionId}-${matchIndex}-${match.athlete2.userId || match.athlete2.athleteId}`] || ''}
                                                  onChange={(e) => handleHeatScore(session.sessionId, matchIndex, match.athlete2.userId || match.athlete2.athleteId, e.target.value)}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="heat-actions">
                                          <button
                                            type="button"
                                            className="submit-heat-btn"
                                            onClick={() => submitHeatScores(session, matchIndex, match)}
                                            disabled={!canSubmitHeat(session.sessionId, matchIndex, match)}
                                          >
                                            Submit Heat {matchIndex + 1}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {entryMode === 'wod' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Athlete ID *</label>
                    <input
                      type="text"
                      value={scoreData.athleteId}
                      onChange={(e) => setScoreData({...scoreData, athleteId: e.target.value})}
                      placeholder="athlete-1"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>WOD *</label>
                    <select
                      value={scoreData.wodId}
                      onChange={(e) => {
                        console.log('WOD selected:', e.target.value);
                        setScoreData({...scoreData, wodId: e.target.value});
                      }}
                      required
                    >
                      <option value="">Select WOD</option>
                      {wods.map(wod => (
                        <option key={wod.wodId} value={wod.wodId}>{wod.name}</option>
                      ))}
                    </select>
                    {wods.length === 0 && <p style={{color: 'orange', fontSize: '12px'}}>No WODs found for this event</p>}
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={scoreData.categoryId}
                      onChange={(e) => setScoreData({...scoreData, categoryId: e.target.value})}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Score *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={scoreData.score}
                      onChange={(e) => setScoreData({...scoreData, score: e.target.value})}
                      placeholder="150"
                      required
                    />
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Submitting Score...' : 'Submit Score'}
                </button>
              </>
            )}
          </form>

          {message && (
            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = `
.mode-selection-header {
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-radius: 12px;
  border: 1px solid #dee2e6;
  text-align: center;
}

.mode-selection-header h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.entry-mode-toggle {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.mode-btn {
  padding: 16px 24px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  background: white;
  color: #495057;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.mode-btn small {
  font-size: 11px;
  font-weight: 400;
  margin-top: 4px;
  opacity: 0.7;
}

.mode-btn:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.mode-btn.active {
  border-color: #007bff;
  background: #007bff;
  color: white;
  box-shadow: 0 2px 8px rgba(0,123,255,0.3);
}

.mode-description {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
  font-style: italic;
}

@media (max-width: 768px) {
  .entry-mode-toggle {
    flex-direction: column;
    align-items: center;
  }
  
  .mode-btn {
    min-width: 200px;
  }
}

.schedule-layout {
  margin: 20px 0;
}

.tournament-day {
  margin-bottom: 30px;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tournament-day h4 {
  margin: 0;
  padding: 20px;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  font-size: 18px;
  font-weight: 600;
}

.tournament-category {
  margin: 20px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #f8f9fa;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: linear-gradient(135deg, #28a745, #1e7e34);
  color: white;
  border-radius: 8px 8px 0 0;
}

.category-header h5 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.session-count {
  background: rgba(255,255,255,0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.tournament-session {
  margin: 15px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.session-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  flex-wrap: wrap;
  gap: 10px;
}

.session-info h6 {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.session-time {
  color: #666;
  font-size: 14px;
  font-weight: 500;
}

.heat-progress {
  background: #e9ecef;
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.heats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 15px;
  padding: 20px;
}

.heat-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  transition: all 0.2s ease;
}

.heat-card.completed {
  border-color: #28a745;
  background: #f8fff9;
}

.heat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
}

.heat-number {
  font-weight: 600;
  color: #495057;
}

.completed-badge {
  background: #28a745;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.heat-matchup {
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.athlete-score-entry {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.athlete-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.athlete-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.athlete-alias {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.score-input-container {
  display: flex;
  align-items: center;
}

.heat-score-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.heat-score-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.vs-divider {
  background: #dc3545;
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  min-width: 40px;
}

.heat-actions {
  padding: 15px;
  border-top: 1px solid #e9ecef;
  text-align: center;
}

.submit-heat-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.submit-heat-btn:hover:not(:disabled) {
  background: #0056b3;
}

.submit-heat-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .heats-grid {
    grid-template-columns: 1fr;
    padding: 15px;
  }
  
  .session-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .heat-matchup {
    flex-direction: column;
    gap: 10px;
  }
  
  .vs-divider {
    align-self: center;
  }
}

.heat-scoring-section {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.heat-scoring-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.heats-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 400px;
  overflow-y: auto;
}

.athlete-order-section {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.athlete-order-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.athlete-order-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.athlete-order-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.athlete-order-item:hover {
  border-color: #007bff;
  background-color: #f0f8ff;
}

.athlete-order-item.selected {
  border-color: #007bff;
  background-color: #e3f2fd;
  box-shadow: 0 2px 4px rgba(0,123,255,0.2);
}

.athlete-position {
  font-weight: bold;
  font-size: 18px;
  color: #007bff;
  margin-right: 12px;
  min-width: 30px;
}

.heat-info {
  font-size: 12px;
  color: #666;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default ScoreEntry;
