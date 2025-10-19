import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import './CompetitionScheduler.css';

const CompetitionScheduler = ({ eventId, onScheduleGenerated }) => {
  const [config, setConfig] = useState({
    maxDayHours: 10,
    lunchBreakHours: 1,
    competitionMode: 'HEATS', // HEATS, VERSUS, SIMULTANEOUS
    athletesPerHeat: 8,
    numberOfHeats: 6, // Required for VERSUS mode
    athletesEliminatedPerFilter: 0, // How many athletes are eliminated per heat
    heatWodMapping: {}, // Maps heat numbers to WOD IDs for VERSUS mode
    startTime: '08:00',
    timezone: 'UTC',
    transitionTime: 5,
    setupTime: 10
  });
  
  const [schedules, setSchedules] = useState([]);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eventData, setEventData] = useState({
    wods: [],
    categories: [],
    athletes: [],
    days: []
  });

  useEffect(() => {
    loadEventData();
    loadSchedules();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      const [wods, categories, days] = await Promise.all([
        API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`).catch(() => []),
        API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`).catch(() => []),
        API.get('CalisthenicsAPI', `/events/${eventId}/days`).catch(() => [])
      ]);

      // Get registered athletes with full details
      const athletes = await API.get('CalisthenicsAPI', `/athletes?eventId=${eventId}`).catch(() => []);

      setEventData({ wods, categories, athletes, days });
    } catch (error) {
      console.error('Error loading event data:', error);
      setEventData({ wods: [], categories: [], athletes: [], days: [] });
    }
  };

  const loadSchedules = async () => {
    try {
      const scheduleData = await API.get('CalisthenicsAPI', `/scheduler/${eventId}`);
      // API now returns array of schedules
      setSchedules(Array.isArray(scheduleData) ? scheduleData : (scheduleData ? [scheduleData] : []));
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    }
  };

  const generateSchedule = async () => {
    setLoading(true);
    try {
      const scheduleConfig = { ...config, ...eventData };
      
      // Use direct scheduler endpoint
      const response = await API.post('CalisthenicsAPI', `/scheduler/${eventId}`, {
        body: scheduleConfig
      });

      setCurrentSchedule(response);
      onScheduleGenerated?.(response);
      await loadSchedules(); // Refresh the schedules list
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async (schedule) => {
    setSaving(true);
    try {
      const saved = await API.post('CalisthenicsAPI', `/scheduler/${eventId}/save`, {
        body: schedule
      });
      
      setCurrentSchedule(saved);
      await loadSchedules();
      alert('Schedule saved successfully!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = async (scheduleId, updates) => {
    try {
      const updated = await API.put('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}`, {
        body: updates
      });
      
      setCurrentSchedule(updated);
      await loadSchedules();
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Failed to update schedule');
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      await API.del('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}`);
      
      if (currentSchedule?.scheduleId === scheduleId) {
        setCurrentSchedule(null);
      }
      await loadSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Failed to delete schedule');
    }
  };

  const loadSchedule = async (scheduleId) => {
    try {
      const schedule = await API.get('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}`);
      setCurrentSchedule(schedule);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  return (
    <div className="competition-scheduler">
      <h2>Competition Scheduler</h2>
      
      {/* Configuration Panel */}
      <div className="config-panel">
        <h3>Schedule Configuration</h3>
        <div className="config-grid">
          <div>
            <label>Competition Mode:</label>
            <select
              value={config.competitionMode}
              onChange={(e) => setConfig({...config, competitionMode: e.target.value})}
            >
              <option value="HEATS">Traditional Heats</option>
              <option value="VERSUS">One vs One</option>
              <option value="SIMULTANEOUS">All Simultaneous</option>
            </select>
          </div>
          
          <div>
            <label>Start Time:</label>
            <input
              type="time"
              value={config.startTime}
              onChange={(e) => setConfig({...config, startTime: e.target.value})}
            />
          </div>
          
          <div>
            <label>Timezone:</label>
            <select
              value={config.timezone}
              onChange={(e) => setConfig({...config, timezone: e.target.value})}
            >
              <option value="UTC">UTC</option>
              <option value="EST">EST (UTC-5)</option>
              <option value="CST">CST (UTC-6)</option>
              <option value="MST">MST (UTC-7)</option>
              <option value="PST">PST (UTC-8)</option>
              <option value="CET">CET (UTC+1)</option>
              <option value="JST">JST (UTC+9)</option>
              <option value="AEST">AEST (UTC+10)</option>
            </select>
          </div>

          <div>
            <label>Max Day Hours:</label>
            <input
              type="number"
              value={config.maxDayHours}
              onChange={(e) => setConfig({...config, maxDayHours: parseInt(e.target.value)})}
              min="6" max="12"
            />
          </div>

          {config.competitionMode === 'HEATS' && (
            <>
              <div>
                <label>Athletes per Heat:</label>
                <input
                  type="number"
                  value={config.athletesPerHeat}
                  onChange={(e) => setConfig({...config, athletesPerHeat: parseInt(e.target.value)})}
                  min="4" max="16"
                />
              </div>
              
              <div>
                <label>Athletes Eliminated per Filter:</label>
                <input
                  type="number"
                  value={config.athletesEliminatedPerFilter || 0}
                  onChange={(e) => setConfig({...config, athletesEliminatedPerFilter: parseInt(e.target.value)})}
                  min="0" 
                  max={Math.max(0, (eventData.athletes?.length || 1) - 1)}
                  placeholder="How many eliminated per filter"
                />
              </div>
            </>
          )}

          {config.competitionMode === 'VERSUS' && (
            <>
              <div>
                <label>Number of Heats:</label>
                <input
                  type="number"
                  value={config.numberOfHeats}
                  onChange={(e) => setConfig({...config, numberOfHeats: parseInt(e.target.value)})}
                  min="1" max="20"
                  required
                />
              </div>
              
              <div>
                <label>Athletes Eliminated per Filter:</label>
                <input
                  type="number"
                  value={config.athletesEliminatedPerFilter || 0}
                  onChange={(e) => setConfig({...config, athletesEliminatedPerFilter: parseInt(e.target.value)})}
                  min="0" 
                  max={Math.max(0, (eventData.athletes?.length || 2) - 1)}
                  placeholder="How many eliminated per filter"
                />
              </div>
              
              <div className="heat-wod-mapping">
                <label>Heat to WOD Mapping:</label>
                <div className="mapping-grid">
                  {Array.from({length: config.numberOfHeats}, (_, i) => i + 1).map(heatNum => (
                    <div key={heatNum} className="mapping-row">
                      <span>Heat {heatNum}:</span>
                      <select
                        value={config.heatWodMapping[heatNum] || ''}
                        onChange={(e) => setConfig({
                          ...config, 
                          heatWodMapping: {
                            ...config.heatWodMapping,
                            [heatNum]: e.target.value
                          }
                        })}
                        required
                      >
                        <option value="">Select WOD</option>
                        {eventData.wods.map(wod => (
                          <option key={wod.wodId} value={wod.wodId}>
                            {wod.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label>Transition Time (min):</label>
            <input
              type="number"
              value={config.transitionTime}
              onChange={(e) => setConfig({...config, transitionTime: parseInt(e.target.value)})}
              min="1" max="15"
            />
          </div>
        </div>
        
        <button 
          onClick={generateSchedule} 
          disabled={loading || !eventData.wods.length}
          className="generate-btn"
        >
          {loading ? 'Generating Schedule...' : 'Generate New Schedule'}
        </button>
      </div>

      {/* Existing Schedules */}
      {schedules.length > 0 && (
        <div className="schedules-list">
          <h3>Existing Schedules</h3>
          <div className="schedules-grid">
            {schedules.map(schedule => (
              <div key={schedule.scheduleId} className="schedule-card">
                <div className="schedule-header">
                  <h4>Schedule {schedule.scheduleId.slice(-8)}</h4>
                  <span className="schedule-date">
                    {new Date(schedule.generatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="schedule-info">
                  <p>Mode: {schedule.config?.competitionMode || 'HEATS'}</p>
                  <p>Duration: {schedule.totalDuration?.toFixed(1)}h</p>
                  <p>Days: {schedule.days?.length || 0}</p>
                </div>
                <div className="schedule-actions">
                  <button onClick={() => loadSchedule(schedule.scheduleId)} className="btn-load">
                    Load
                  </button>
                  <button onClick={() => deleteSchedule(schedule.scheduleId)} className="btn-delete">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Schedule Display */}
      {currentSchedule && (
        <div className="schedule-display">
          <div className="schedule-header-actions">
            <h3>Current Schedule</h3>
            <div className="header-actions">
              <button 
                onClick={() => saveSchedule(currentSchedule)} 
                disabled={saving}
                className="btn-save"
              >
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>

          <div className="schedule-summary">
            <p>Mode: <strong>{currentSchedule.config?.competitionMode || 'HEATS'}</strong></p>
            <p>Start Time: <strong>{currentSchedule.config?.startTime} ({currentSchedule.config?.timezone})</strong></p>
            <p>Total Days: <strong>{currentSchedule.days?.length || 0}</strong></p>
            <p>Total Duration: <strong>{currentSchedule.totalDuration?.toFixed(1)} hours</strong></p>
            
            {currentSchedule.config?.competitionMode === 'VERSUS' && (
              <div className="versus-summary">
                <h4>Match Summary:</h4>
                {currentSchedule.days?.map(day => 
                  day.sessions?.filter(s => s.competitionMode === 'VERSUS').map(session => (
                    <div key={session.sessionId} className="match-summary-item">
                      <strong>Heat {session.heatNumber || 1}</strong> - {eventData.wods.find(w => w.wodId === session.wodId)?.name || session.wodId}
                      <div className="match-details">
                        {session.matches?.map(match => (
                          <div key={match.matchId} className="match-summary">
                            <span className="athlete-vs">
                              {match.athlete1?.firstName || 'Athlete 1'} {match.athlete1?.lastName || ''}
                              {match.athlete2 ? (
                                <> vs {match.athlete2.firstName} {match.athlete2.lastName}</>
                              ) : (
                                <> (BYE)</>
                              )}
                            </span>
                            <span className="match-time">{session.startTime}</span>
                          </div>
                        )) || (
                          // Fallback: extract from athleteSchedule if matches not available
                          session.athleteSchedule?.reduce((pairs, athlete, index, arr) => {
                            if (index % 2 === 0) {
                              const opponent = arr[index + 1];
                              pairs.push(
                                <div key={`pair-${index}`} className="match-summary">
                                  <span className="athlete-vs">
                                    {athlete.athleteName}
                                    {opponent ? <> vs {opponent.athleteName}</> : <> (BYE)</>}
                                  </span>
                                  <span className="match-time">{athlete.startTime}</span>
                                </div>
                              );
                            }
                            return pairs;
                          }, [])
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {currentSchedule.days?.map(day => (
            <DayScheduleView
              key={day.dayId}
              day={day}
              competitionMode={currentSchedule.config?.competitionMode}
              timezone={currentSchedule.config?.timezone}
              eventData={eventData}
              onUpdateTime={(sessionId, newStartTime) => {
                const updatedDay = { ...day };
                const session = updatedDay.sessions.find(s => s.sessionId === sessionId);
                if (session) {
                  session.startTime = newStartTime;
                  updateSchedule(currentSchedule.scheduleId, { days: [updatedDay] });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DayScheduleView = ({ day, competitionMode, timezone, eventData, onUpdateTime }) => {
  return (
    <div className="day-schedule">
      <h4>Day {day.dayId}</h4>
      <p>Duration: {day.totalDuration?.toFixed(1)} hours</p>
      <p className={day.withinTimeLimit ? 'time-ok' : 'time-warning'}>
        {day.withinTimeLimit ? '✓ Within time limit' : '⚠ Exceeds time limit'}
      </p>

      <div className="sessions">
        {day.sessions?.map(session => (
          <div key={session.sessionId} className="session">
            <div className="session-header">
              <div className="session-info">
                <h5>{session.wodName || session.wodId} - {session.categoryName || session.categoryId}</h5>
                <span className="session-mode">{session.competitionMode}</span>
                {session.heatNumber && (
                  <span className="heat-indicator">Heat {session.heatNumber} of {session.numberOfHeats}</span>
                )}
                <div className="session-stats">
                  <span>Athletes: {session.athleteCount || 0}</span>
                  {session.heatCount && <span>Heats: {session.heatCount}</span>}
                  {session.matches && <span>Matches: {session.matches.length}</span>}
                </div>
              </div>
              <div className="session-time">
                <input
                  type="time"
                  value={session.startTime}
                  onChange={(e) => onUpdateTime(session.sessionId, e.target.value)}
                />
                <span className="utc-time">UTC: {session.startTimeUTC}</span>
                <span className="duration">{session.duration} min</span>
              </div>
            </div>

            {/* Session Details based on mode */}
            {session.competitionMode === 'HEATS' && session.heats && (
              <div className="heats-display">
                <h6>Heats Breakdown:</h6>
                {session.heats.map((heat, idx) => (
                  <div key={heat.heatId} className="heat-info">
                    <strong>Heat {idx + 1}:</strong> {heat.athletes?.length || 0} athletes
                    <div className="heat-athletes">
                      {heat.athletes?.map(athlete => (
                        <span key={athlete.userId} className="athlete-name">
                          {athlete.firstName} {athlete.lastName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {session.competitionMode === 'VERSUS' && session.matches && (
              <div className="versus-display">
                <div className="versus-header">
                  <h6>Heat {session.heatNumber} of {session.numberOfHeats} - {session.wodName || session.wodId}</h6>
                  <span className="versus-time">{session.startTime} - {session.endTime}</span>
                </div>
                {session.matches.map((match, idx) => (
                  <div key={match.matchId} className="versus-match-card">
                    <div className="versus-athletes">
                      <div className="athlete-card athlete-1">
                        <div className="athlete-name">{match.athlete1?.firstName} {match.athlete1?.lastName}</div>
                        <div className="athlete-corner">Corner 1</div>
                      </div>
                      <div className="versus-divider">
                        <span className="vs-text">VS</span>
                      </div>
                      <div className="athlete-card athlete-2">
                        {match.athlete2 ? (
                          <>
                            <div className="athlete-name">{match.athlete2.firstName} {match.athlete2.lastName}</div>
                            <div className="athlete-corner">Corner 2</div>
                          </>
                        ) : (
                          <div className="bye-card">
                            <div className="bye-text">BYE</div>
                            <div className="bye-subtitle">Advances Automatically</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {session.competitionMode === 'SIMULTANEOUS' && session.athletes && (
              <div className="simultaneous-display">
                <h6>All Athletes Compete Together:</h6>
                <div className="simultaneous-athletes">
                  {session.athletes.map((athlete, idx) => (
                    <span key={athlete.userId} className="athlete-station">
                      Station {idx + 1}: {athlete.firstName} {athlete.lastName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Athlete Schedule */}
            {session.athleteSchedule && session.athleteSchedule.length > 0 && (
              <div className="athlete-schedule">
                <h6>Detailed Schedule:</h6>
                <div className="athlete-list">
                  {session.athleteSchedule.slice(0, 10).map((athlete, idx) => (
                    <div key={idx} className="athlete-time-slot">
                      <span className="athlete-name">{athlete.athleteName}</span>
                      <span className="time-slot">
                        {athlete.startTime} - {athlete.endTime}
                      </span>
                      {athlete.opponent && (
                        <span className="opponent">vs {athlete.opponent}</span>
                      )}
                      {athlete.heatNumber && (
                        <span className="heat-info">Heat {athlete.heatNumber}, Lane {athlete.lane}</span>
                      )}
                      {athlete.station && (
                        <span className="station-info">Station {athlete.station}</span>
                      )}
                    </div>
                  ))}
                  {session.athleteSchedule.length > 10 && (
                    <div className="more-athletes">
                      ... and {session.athleteSchedule.length - 10} more athletes
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Add CSS for processing status
const processingStatusStyles = `
  .processing-status {
    margin-top: 10px;
    padding: 10px;
    background-color: #e3f2fd;
    border: 1px solid #2196f3;
    border-radius: 4px;
    text-align: center;
  }
  
  .status-text {
    color: #1976d2;
    font-weight: 500;
    font-size: 14px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = processingStatusStyles;
  document.head.appendChild(styleSheet);
}

export default CompetitionScheduler;
