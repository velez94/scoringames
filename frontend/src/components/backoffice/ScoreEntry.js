import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function ScoreEntry({ user }) {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [entryMode, setEntryMode] = useState('wod');
  const [publishedSchedules, setPublishedSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [scores, setScores] = useState([]);
  
  const [scoreData, setScoreData] = useState({
    athleteId: '',
    wodId: '',
    categoryId: '',
    score: '',
    scheduleId: '',
    sessionId: '',
    competitionMode: 'HEATS',
    scoreType: ''
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchEvents();
    fetchCategories();
    fetchAthletes();
  }, []);

  useEffect(() => {
    const filtered = events.filter(event =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEvents(filtered);
  }, [events, searchTerm]);

  useEffect(() => {
    if (selectedEvent) {
      fetchWods(selectedEvent.eventId);
      fetchPublishedSchedules();
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent && scoreData.wodId && scoreData.categoryId) {
      console.log('Fetching scores for:', { eventId: selectedEvent.eventId, wodId: scoreData.wodId, categoryId: scoreData.categoryId });
      fetchScores();
    }
  }, [selectedEvent?.eventId, scoreData.wodId, scoreData.categoryId]);

  const fetchEvents = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/public/events');
      setEvents(response);
    } catch (error) {
      console.error('Error fetching events:', error);
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

  const fetchAthletes = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/athletes');
      setAthletes(response || []);
    } catch (error) {
      console.error('Error fetching athletes:', error);
    }
  };

  const fetchScores = async () => {
    try {
      console.log('Fetching scores from API...');
      const response = await API.get('CalisthenicsAPI', `/scores?eventId=${selectedEvent.eventId}`);
      console.log('All scores response:', response);
      
      const filteredScores = response.filter(score => 
        score.wodId === scoreData.wodId && score.categoryId === scoreData.categoryId
      );
      console.log('Filtered scores:', filteredScores);
      setScores(filteredScores);
    } catch (error) {
      console.error('Error fetching scores:', error);
      setScores([]); // Set empty array on error
    }
  };

  const fetchPublishedSchedules = async () => {
    try {
      console.log('Fetching published schedules for eventId:', selectedEvent.eventId);
      const response = await API.get('CalisthenicsAPI', `/scheduler/${selectedEvent.eventId}`);
      console.log('Schedules response:', response);
      const schedules = Array.isArray(response) ? response.filter(s => s.published) : [];
      
      // Get detailed schedule data for each published schedule
      const detailedSchedules = [];
      for (const schedule of schedules) {
        try {
          const details = await API.get('CalisthenicsAPI', `/scheduler/${selectedEvent.eventId}/${schedule.scheduleId}`);
          console.log('Schedule details:', details);
          detailedSchedules.push(details);
        } catch (error) {
          console.error('Error fetching schedule details:', error);
          detailedSchedules.push(schedule); // Fallback to basic schedule
        }
      }
      
      setPublishedSchedules(detailedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setPublishedSchedules([]);
    }
  };

  const submitScore = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const scorePayload = {
        eventId: selectedEvent.eventId,
        athleteId: scoreData.athleteId,
        wodId: scoreData.wodId,
        categoryId: scoreData.categoryId,
        score: scoreData.score,
        dayId: scoreData.dayId || 'day-1', // Default day
        rank: 0, // Default rank
        ...(scoreData.scheduleId && { scheduleId: scoreData.scheduleId }),
        ...(scoreData.sessionId && { sessionId: scoreData.sessionId }),
        ...(scoreData.scoreType && { scoreType: scoreData.scoreType }),
        ...(selectedMatch && { matchId: selectedMatch.matchId || `match-${Date.now()}` })
      };

      console.log('Submitting score payload:', scorePayload);

      await API.post('CalisthenicsAPI', '/scores', {
        body: scorePayload
      });

      setMessage('✅ Score submitted successfully!');
      setScoreData({
        athleteId: '',
        wodId: '',
        categoryId: '',
        score: ''
      });
      setAthleteSearch('');
      
      // Refresh scores
      await fetchScores();
    } catch (error) {
      console.error('Error submitting score:', error);
      setMessage('❌ Error submitting score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredAthletes = () => {
    if (!scoreData.categoryId) return [];
    
    let filtered = athletes.filter(athlete => athlete.categoryId === scoreData.categoryId);
    
    if (athleteSearch) {
      const search = athleteSearch.toLowerCase();
      filtered = filtered.filter(athlete => 
        athlete.firstName?.toLowerCase().includes(search) ||
        athlete.lastName?.toLowerCase().includes(search) ||
        (athlete.alias && athlete.alias.toLowerCase().includes(search))
      );
    }
    
    return filtered;
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

          <div style={{background: '#f0f0f0', padding: '10px', margin: '10px 0', fontSize: '12px', border: '1px solid #ccc'}}>
            <strong>🐛 Debug Info:</strong><br/>
            Selected Event ID: {selectedEvent.eventId}<br/>
            Entry Mode: {entryMode}<br/>
            WODs Count: {wods.length}<br/>
            Categories Count: {categories.length}<br/>
            Published Schedules Count: {publishedSchedules.length}<br/>
            Scores Count: {scores.length}<br/>
            Selected WOD: {scoreData.wodId}<br/>
            Selected Category: {scoreData.categoryId}<br/>
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
            
            {entryMode === 'wod' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>WOD *</label>
                    <select
                      value={scoreData.wodId}
                      onChange={(e) => setScoreData({...scoreData, wodId: e.target.value})}
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
                      onChange={(e) => {
                        setScoreData({...scoreData, categoryId: e.target.value, athleteId: ''});
                        setAthleteSearch('');
                      }}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {scoreData.categoryId && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Search Athlete</label>
                      <input
                        type="text"
                        placeholder="🔍 Search by name or alias..."
                        value={athleteSearch}
                        onChange={(e) => setAthleteSearch(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Athlete *</label>
                    <select
                      value={scoreData.athleteId}
                      onChange={(e) => setScoreData({...scoreData, athleteId: e.target.value})}
                      required
                      disabled={!scoreData.categoryId}
                    >
                      <option value="">Select Athlete</option>
                      {getFilteredAthletes().map(athlete => (
                        <option key={athlete.athleteId} value={athlete.athleteId}>
                          {athlete.firstName} {athlete.lastName}
                          {athlete.alias && ` (${athlete.alias})`}
                        </option>
                      ))}
                    </select>
                    {scoreData.categoryId && getFilteredAthletes().length === 0 && (
                      <p style={{color: 'orange', fontSize: '12px'}}>
                        No athletes found for this category
                      </p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Score *</label>
                    <input
                      type="text"
                      value={scoreData.score}
                      onChange={(e) => setScoreData({...scoreData, score: e.target.value})}
                      placeholder="e.g., 150, 05:30, 25 reps"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {entryMode === 'schedule' && (
              <div className="schedule-mode">
                {publishedSchedules.length === 0 ? (
                  <p>No published schedules available for this event.</p>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Schedule *</label>
                      <select
                        value={selectedSchedule?.scheduleId || ''}
                        onChange={(e) => {
                          const schedule = publishedSchedules.find(s => s.scheduleId === e.target.value);
                          setSelectedSchedule(schedule);
                          setSelectedSession(null);
                          setSelectedMatch(null);
                          setScoreData({...scoreData, scheduleId: schedule?.scheduleId || '', sessionId: '', athleteId: ''});
                        }}
                        required
                      >
                        <option value="">Select a schedule...</option>
                        {publishedSchedules.map(schedule => (
                          <option key={schedule.scheduleId} value={schedule.scheduleId}>
                            {schedule.name || `Schedule ${schedule.scheduleId}`} - {schedule.competitionMode}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedSchedule && selectedSchedule.days && (
                      <div className="form-group">
                        <label>Session *</label>
                        <select
                          value={selectedSession?.sessionId || ''}
                          onChange={(e) => {
                            const allSessions = selectedSchedule.days.flatMap(day => day.sessions || []);
                            const session = allSessions.find(s => s.sessionId === e.target.value);
                            setSelectedSession(session);
                            setSelectedMatch(null);
                            setScoreData({
                              ...scoreData, 
                              sessionId: session?.sessionId || '',
                              wodId: session?.wodId || '',
                              categoryId: session?.categoryId || '',
                              athleteId: ''
                            });
                          }}
                          required
                        >
                          <option value="">Select a session...</option>
                          {selectedSchedule.days.flatMap(day => day.sessions || []).map(session => (
                            <option key={session.sessionId} value={session.sessionId}>
                              {session.wodName || session.wodId} - {session.categoryName || session.categoryId} ({session.startTime})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedSession && selectedSession.matches && (
                      <div className="form-group">
                        <label>Match *</label>
                        <select
                          value={selectedMatch?.matchId || ''}
                          onChange={(e) => {
                            const match = selectedSession.matches.find(m => m.matchId === e.target.value);
                            setSelectedMatch(match);
                            setScoreData({...scoreData, athleteId: ''});
                          }}
                          required
                        >
                          <option value="">Select a match...</option>
                          {selectedSession.matches.map((match, index) => (
                            <option key={match.matchId || index} value={match.matchId || index}>
                              Match {index + 1}: {match.athlete1?.firstName} {match.athlete1?.lastName} vs {match.athlete2?.firstName} {match.athlete2?.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedMatch && (
                      <>
                        <div className="form-group">
                          <label>Athlete *</label>
                          <select
                            value={scoreData.athleteId}
                            onChange={(e) => setScoreData({...scoreData, athleteId: e.target.value})}
                            required
                          >
                            <option value="">Select athlete...</option>
                            {[selectedMatch.athlete1, selectedMatch.athlete2].filter(Boolean).map(athlete => (
                              <option key={athlete.userId || athlete.athleteId} value={athlete.userId || athlete.athleteId}>
                                {athlete.firstName} {athlete.lastName} ({athlete.alias || athlete.categoryId})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Score Type *</label>
                          <select
                            value={scoreData.scoreType || ''}
                            onChange={(e) => setScoreData({...scoreData, scoreType: e.target.value})}
                            required
                          >
                            <option value="">Select score type...</option>
                            <option value="time">Time (mm:ss or seconds)</option>
                            <option value="reps">Reps/Rounds</option>
                            <option value="weight">Weight (lbs/kg)</option>
                            <option value="points">Points</option>
                            <option value="placement">Placement (1st, 2nd)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>
                            {scoreData.scoreType === 'time' ? 'Time *' : 
                             scoreData.scoreType === 'reps' ? 'Reps/Rounds *' :
                             scoreData.scoreType === 'weight' ? 'Weight *' :
                             scoreData.scoreType === 'points' ? 'Points *' :
                             scoreData.scoreType === 'placement' ? 'Placement *' : 'Score *'}
                          </label>
                          {scoreData.scoreType === 'placement' ? (
                            <select
                              value={scoreData.score}
                              onChange={(e) => setScoreData({...scoreData, score: e.target.value})}
                              required
                            >
                              <option value="">Select placement...</option>
                              <option value="1">Winner (1st place)</option>
                              <option value="2">Runner-up (2nd place)</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={scoreData.score}
                              onChange={(e) => setScoreData({...scoreData, score: e.target.value})}
                              placeholder={
                                scoreData.scoreType === 'time' ? 'e.g., 3:45 or 225' :
                                scoreData.scoreType === 'reps' ? 'e.g., 150 or 5+10' :
                                scoreData.scoreType === 'weight' ? 'e.g., 225 or 102.5' :
                                scoreData.scoreType === 'points' ? 'e.g., 100' : 'Enter score'
                              }
                              required
                            />
                          )}
                          {scoreData.scoreType === 'time' && (
                            <small style={{color: '#666'}}>Format: mm:ss (3:45) or total seconds (225)</small>
                          )}
                          {scoreData.scoreType === 'reps' && (
                            <small style={{color: '#666'}}>Format: total reps (150) or rounds+reps (5+10)</small>
                          )}
                          {scoreData.scoreType === 'placement' && (
                            <small style={{color: '#666'}}>VERSUS mode: Winner vs Runner-up</small>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
            </div>

            {message && (
              <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
          </form>

          {/* Current Scores Display */}
          {scoreData.wodId && scoreData.categoryId && (
            <div className="current-scores">
              <h3>Current Scores - {wods.find(w => w.wodId === scoreData.wodId)?.name}</h3>
              {scores.length === 0 ? (
                <p>No scores found for this WOD and category combination.</p>
              ) : (
                <div className="scores-table">
                  <div className="table-header">
                    <span>Athlete</span>
                    <span>Score</span>
                    <span>Submitted</span>
                  </div>
                  {scores
                    .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
                    .map((score, index) => {
                      const athlete = athletes.find(a => a.athleteId === score.athleteId);
                      return (
                        <div key={score.scoreId} className="table-row">
                          <span>
                            {athlete ? `${athlete.firstName} ${athlete.lastName}` : score.athleteId}
                            {athlete?.alias && ` (${athlete.alias})`}
                          </span>
                          <span className="score-value">{score.score}</span>
                          <span className="score-time">{new Date(score.createdAt).toLocaleTimeString()}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .score-entry {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .score-entry h1 {
          margin: 0 0 25px 0;
          color: #2c3e50;
          font-size: 28px;
          font-weight: 600;
        }

        .event-selection h2 {
          margin-bottom: 20px;
          color: #2c3e50;
          font-size: 22px;
          font-weight: 600;
        }

        .search-container {
          margin-bottom: 20px;
        }

        .search-input {
          width: 100%;
          max-width: 400px;
          padding: 12px 16px;
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .event-card {
          background: white;
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .event-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
          border-color: #667eea;
        }

        .event-card h3 {
          margin: 0 0 12px 0;
          color: #2c3e50;
          font-size: 18px;
          font-weight: 600;
        }

        .event-card p {
          margin: 8px 0;
          color: #6c757d;
          font-size: 14px;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 8px;
        }

        .status-badge.active {
          background: linear-gradient(135deg, #d4edda, #c3e6cb);
          color: #155724;
        }

        .status-badge.upcoming {
          background: linear-gradient(135deg, #fff3cd, #ffeaa7);
          color: #856404;
        }

        .selected-event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 25px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .selected-event-header h2 {
          margin: 0;
          color: #2c3e50;
          font-size: 22px;
          font-weight: 600;
        }

        .selected-event-header p {
          margin: 4px 0 0 0;
          color: #6c757d;
          font-size: 14px;
        }

        .mode-selection-header {
          background: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 25px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .mode-selection-header h3 {
          margin: 0 0 20px 0;
          color: #2c3e50;
          font-size: 20px;
          font-weight: 600;
        }

        .entry-mode-toggle {
          display: flex;
          gap: 20px;
        }

        .mode-btn {
          flex: 1;
          padding: 20px;
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          background: white;
          color: #495057;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .mode-btn small {
          font-size: 13px;
          font-weight: 400;
          margin-top: 8px;
          opacity: 0.7;
        }

        .mode-btn:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .mode-btn.active {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .score-form {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .score-form h3 {
          margin: 0 0 25px 0;
          color: #2c3e50;
          font-size: 20px;
          font-weight: 600;
        }

        .form-row {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }

        .form-group {
          flex: 1;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2c3e50;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input:disabled,
        .form-group select:disabled {
          background: #f8f9fa;
          color: #6c757d;
          cursor: not-allowed;
        }

        .form-actions {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e1e8ed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .btn-secondary:hover {
          background: #5a6268;
        }

        .message {
          margin-top: 20px;
          padding: 16px;
          border-radius: 8px;
          font-weight: 600;
        }

        .message.success {
          background: linear-gradient(135deg, #d4edda, #c3e6cb);
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: linear-gradient(135deg, #f8d7da, #f5c6cb);
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .current-scores {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          margin-top: 25px;
        }

        .current-scores h3 {
          margin: 0 0 20px 0;
          color: #2c3e50;
          font-size: 20px;
          font-weight: 600;
        }

        .scores-table {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e1e8ed;
        }

        .table-header {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-weight: 600;
          padding: 16px;
        }

        .table-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          padding: 16px;
          border-bottom: 1px solid #e1e8ed;
          transition: background 0.2s;
        }

        .table-row:hover {
          background: #f8f9ff;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .score-value {
          font-weight: 600;
          color: #667eea;
        }

        .score-time {
          color: #6c757d;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .form-row {
            flex-direction: column;
          }
          
          .entry-mode-toggle {
            flex-direction: column;
          }
          
          .events-grid {
            grid-template-columns: 1fr;
          }
          
          .selected-event-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
        }
      `}</style>
    </div>
  );
}

export default ScoreEntry;
