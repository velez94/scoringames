import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CompetitionScheduler from '../CompetitionScheduler';
import ScoringSystemManager from './ScoringSystemManager';

function EventDetails() {
  const { eventId, scheduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduleAthletes, setScheduleAthletes] = useState({});
  const [scheduleCategories, setScheduleCategories] = useState({});
  const [scheduleWods, setScheduleWods] = useState({});

  const [event, setEvent] = useState(null);
  const [eventDays, setEventDays] = useState([]);
  const [wods, setWods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [wodSearch, setWodSearch] = useState('');
  const [wodFormatFilter, setWodFormatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Global advanced scoring system
  const globalScoringSystem = {
    type: 'advanced',
    config: {
      timeBonuses: { 1: 10, 2: 7, 3: 5 }
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
      fetchEventDays();
      fetchAthletes();
      fetchExercises();
    }
  }, [eventId, location.pathname]); // Add location.pathname to refresh on navigation

  useEffect(() => {
    if (scheduleId) {
      fetchScheduleById(scheduleId);
    } else {
      setSelectedSchedule(null);
    }
  }, [scheduleId]);

  const fetchScheduleById = async (id) => {
    if (!id || id === 'undefined') {
      console.log('⚠️ Invalid schedule ID, skipping fetch');
      return;
    }
    
    try {
      const response = await API.get('CalisthenicsAPI', `/scheduler/${eventId}/${id}`);
      setSelectedSchedule(response);
      if (response && response.scheduleId && response.scheduleId !== 'undefined') {
        fetchScheduleDetails(response);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  const togglePublishStatus = async () => {
    try {
      await API.put('CalisthenicsAPI', `/competitions/${eventId}`, {
        body: {
          ...event,
          published: !event.published
        }
      });
      
      // Update local state
      setEvent(prev => ({ ...prev, published: !prev.published }));
    } catch (error) {
      console.error('Error updating publish status:', error);
      alert('Failed to update publish status');
    }
  };

  const fetchEventDetails = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/competitions/${eventId}`);
      setEvent(response);
      
      // Try both approaches: event record wods field AND separate WODs query
      const eventWods = response.wods || response.workouts || [];
      const linkedWods = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      
      // Combine both sources and deduplicate by wodId
      const allWods = [...eventWods, ...(linkedWods || [])];
      const uniqueWods = allWods.reduce((acc, wod) => {
        if (!acc.find(w => w.wodId === wod.wodId)) {
          acc.push(wod);
        }
        return acc;
      }, []);
      
      setWods(uniqueWods);

      // Use categories from event record if available
      const eventCategories = response.categories || [];
      if (eventCategories.length > 0) {
        // Filter to only get objects (not strings) and valid category objects
        const validCategories = eventCategories.filter(category => 
          typeof category === 'object' && 
          category !== null && 
          category.categoryId && 
          category.name
        );
        setCategories(validCategories);
      } else {
        // Fallback to fetching categories linked to event
        const linkedCategories = await API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`);
        setCategories(linkedCategories || []);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const fetchEventDays = async () => {
    try {
      const days = await API.get('CalisthenicsAPI', `/competitions/${eventId}/days`);
      setEventDays(days || []);
    } catch (error) {
      console.error('Error fetching event days:', error);
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

  const fetchExercises = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/exercises');
      setExercises(response || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const calculateWodMaxScore = (wod) => {
    if (!wod.movements?.length || !exercises.length) {
      return null;
    }

    let totalEDS = 0;
    
    wod.movements.forEach(movement => {
      const exercise = exercises.find(e => 
        e.exerciseId === movement.exerciseId || 
        e.name.toLowerCase() === movement.exercise?.toLowerCase()
      );
      
      if (!exercise) return;

      const reps = parseInt(movement.reps) || 1;
      const weight = parseFloat(movement.weight?.replace(/[^\d.]/g, '')) || 0;
      
      let eds = exercise.baseScore * reps;
      
      exercise.modifiers?.forEach(mod => {
        if (mod.type === 'weight' && weight > 0) {
          eds += Math.floor(weight / mod.increment) * mod.points * reps;
        }
      });
      
      totalEDS += eds;
    });

    if (totalEDS === 0) return null;

    const totalScore = totalEDS * 5;
    const timeBonus = globalScoringSystem.config.timeBonuses[1];
    const maxScore = totalScore + timeBonus;
    
    return { maxScore, totalEDS, timeBonus };
  };

  const fetchScheduleDetails = async (schedule) => {
    if (!schedule || !schedule.scheduleId || schedule.scheduleId === 'undefined') {
      console.log('⚠️ No valid schedule provided, skipping fetch');
      setSelectedSchedule(null);
      return;
    }
    
    try {
      console.log('🔍 Fetching schedule details for event:', eventId);
      
      // Fetch athletes, categories, and WODs for the schedule
      const [athletesRes, categoriesRes, wodsRes] = await Promise.all([
        API.get('CalisthenicsAPI', `/athletes?eventId=${eventId}`),
        API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`),
        API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`)
      ]);

      console.log('✅ Athletes fetched:', athletesRes.length, athletesRes);
      console.log('✅ Categories fetched:', categoriesRes.length);
      console.log('✅ WODs fetched:', wodsRes.length);

      // Create lookup maps with multiple key formats
      const athletesMap = {};
      athletesRes.forEach(athlete => {
        const keys = [
          athlete.userId,
          athlete.athleteId,
          `athlete-${athlete.userId}`,
          athlete.userId?.replace('athlete-', '')
        ].filter(Boolean);
        
        keys.forEach(key => {
          athletesMap[key] = athlete;
        });
      });

      const categoriesMap = {};
      categoriesRes.forEach(category => {
        categoriesMap[category.categoryId] = category;
      });

      const wodsMap = {};
      wodsRes.forEach(wod => {
        wodsMap[wod.wodId] = wod;
      });

      console.log('📊 Athletes map created with keys:', Object.keys(athletesMap).slice(0, 10));
      console.log('📋 Full schedule structure:', JSON.stringify(schedule, null, 2));
      
      // Check first match/heat athlete IDs
      if (schedule.days?.[0]?.sessions?.[0]) {
        const firstSession = schedule.days[0].sessions[0];
        console.log('🔍 First session structure:', JSON.stringify(firstSession, null, 2));
        if (firstSession.matches?.[0]) {
          console.log('🎯 First match full object:', firstSession.matches[0]);
          console.log('🎯 First match athlete IDs:', firstSession.matches[0].athlete1Id, firstSession.matches[0].athlete2Id);
          console.log('🔎 Athlete 1 found:', athletesMap[firstSession.matches[0].athlete1Id]);
          console.log('🔎 Athlete 2 found:', athletesMap[firstSession.matches[0].athlete2Id]);
        }
        if (firstSession.heats?.[0]?.athletes?.[0]) {
          console.log('🎯 First heat athlete ID:', firstSession.heats[0].athletes[0]);
          console.log('🔎 Athlete found:', athletesMap[firstSession.heats[0].athletes[0]]);
        }
      }

      setScheduleAthletes(athletesMap);
      setScheduleCategories(categoriesMap);
      setScheduleWods(wodsMap);
      setSelectedSchedule(schedule);
    } catch (error) {
      console.error('❌ Error fetching schedule details:', error);
      setSelectedSchedule(schedule);
    }
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

  const getAthleteName = (athleteId) => {
    const athlete = scheduleAthletes[athleteId];
    if (athlete?.firstName && athlete?.lastName) {
      return `${athlete.firstName} ${athlete.lastName}`;
    }
    return athleteId;
  };

  const getCategoryName = (categoryId) => {
    const category = scheduleCategories[categoryId];
    return category ? category.name : categoryId;
  };

  const getAthleteAlias = (athleteId) => {
    const athlete = scheduleAthletes[athleteId];
    return athlete?.alias || athleteId;
  };

  const getWodName = (wodId) => {
    const wod = scheduleWods[wodId];
    return wod ? wod.name : wodId;
  };

  const getFilteredWods = () => {
    return wods.filter(wod => {
      const searchTerm = wodSearch.toLowerCase();
      const nameMatch = wod.name?.toLowerCase().includes(searchTerm);
      const descMatch = wod.description?.toLowerCase().includes(searchTerm);
      const formatMatch = !wodFormatFilter || wod.format === wodFormatFilter;
      
      return (nameMatch || descMatch) && formatMatch;
    });
  };

  const getAthletesByCategory = () => {
    // Filter athletes by search term
    const filteredAthletes = athletes.filter(athlete => {
      const searchTerm = athleteSearch.toLowerCase();
      const fullName = `${athlete.firstName} ${athlete.lastName}`.toLowerCase();
      const alias = (athlete.alias || '').toLowerCase();
      const email = (athlete.email || '').toLowerCase();
      
      return fullName.includes(searchTerm) || 
             alias.includes(searchTerm) || 
             email.includes(searchTerm);
    });

    // Group by category
    const grouped = filteredAthletes.reduce((acc, athlete) => {
      const categoryId = athlete.categoryId || 'uncategorized';
      
      if (!acc[categoryId]) {
        const category = categories.find(c => c.categoryId === categoryId);
        acc[categoryId] = {
          name: category?.name || 'Uncategorized',
          athletes: []
        };
      }
      
      acc[categoryId].athletes.push(athlete);
      return acc;
    }, {});

    // Sort categories by name and athletes by name within each category
    Object.keys(grouped).forEach(categoryId => {
      grouped[categoryId].athletes.sort((a, b) => 
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
    });

    return grouped;
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

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading event details...</p>
    </div>
  );
  if (!event) return <div className="error-message">Event not found</div>;

  return (
    <div className="event-details">
      {scheduleId && selectedSchedule ? (
        // Schedule Details View
        <div className="schedule-details-page">
          <div className="schedule-page-header">
            <button onClick={() => navigate(`/backoffice/events/${eventId}`)} className="btn-back">
              <span>←</span> Back to Event
            </button>
            <h2>Schedule Details - {selectedSchedule.config?.competitionMode}</h2>
          </div>
          
          <div className="schedule-info-card">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Competition Mode:</span>
                <span className="info-value">{selectedSchedule.config?.competitionMode}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Created:</span>
                <span className="info-value">{new Date(selectedSchedule.generatedAt).toLocaleString()}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className={`status-badge ${selectedSchedule.published ? 'published' : 'draft'}`}>
                  {selectedSchedule.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Days:</span>
                <span className="info-value">{selectedSchedule.days?.length || 0}</span>
              </div>
            </div>
          </div>

          {selectedSchedule.days?.map((day, dayIndex) => {
            const groupedSessions = groupSessionsByCategory(day.sessions);
            return (
              <div key={dayIndex} className="day-section">
                <h3 className="day-title">Day {dayIndex + 1}</h3>
                {Object.entries(groupedSessions).map(([categoryId, sessions]) => (
                  <div key={categoryId} className="category-section">
                    <h4 className="category-title">{scheduleCategories[categoryId]?.name || categoryId}</h4>
                    <div className="sessions-grid">
                      {sessions.map((session, sessionIndex) => (
                        <div key={sessionIndex} className="session-card">
                          <div className="session-header">
                            <span className="session-time">⏰ {session.startTime}</span>
                            <span className="session-wod">🏋️ {scheduleWods[session.wodId]?.name || session.wodId}</span>
                          </div>
                          <div className="heats-section">
                            {session.heats && session.heats.length > 0 ? (
                              session.heats.map((heat, heatIndex) => (
                                <div key={heatIndex} className="heat-card">
                                  <div className="heat-header">Heat {heatIndex + 1}</div>
                                  <div className="athletes-list">
                                    {heat.athletes?.map((athleteId, idx) => {
                                      const athlete = scheduleAthletes[athleteId];
                                      return (
                                        <div key={idx} className="athlete-item">
                                          <span className="athlete-number">{idx + 1}</span>
                                          <span className="athlete-name">
                                            {athlete ? `${athlete.firstName} ${athlete.lastName}` : athleteId}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                            ) : session.matches && session.matches.length > 0 ? (
                              session.matches.map((match, matchIndex) => {
                                const athlete1 = match.athlete1;
                                const athlete2 = match.athlete2;
                                return (
                                  <div key={matchIndex} className="match-card">
                                    <div className="match-header">Match {matchIndex + 1}</div>
                                    <div className="match-athletes">
                                      <span className="athlete-name">
                                        {athlete1 ? `${athlete1.firstName} ${athlete1.lastName}` : 'TBD'}
                                      </span>
                                      <span className="vs">VS</span>
                                      <span className="athlete-name">
                                        {athlete2 ? `${athlete2.firstName} ${athlete2.lastName}` : 'TBD'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="no-heats">No matches found for this session</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        // Event Details View
        <>
      <div className="page-header">
        <button onClick={() => navigate('/backoffice/events')} className="btn-back">
          <span>←</span> Back to Events
        </button>
        <div className="header-content">
          <div className="title-section">
            <h1>{event.name}</h1>
            <div className="status-controls">
              <span className={`badge status-${event.status}`}>{event.status}</span>
              <div className="publish-checkbox-container">
                <div className="toggle-container">
                  <input
                    type="checkbox"
                    checked={event.published}
                    onChange={togglePublishStatus}
                    className="toggle-input"
                    id="publish-toggle"
                  />
                  <label htmlFor="publish-toggle" className="toggle-slider"></label>
                  <span className="toggle-text">
                    {event.published ? 'Published (visible to public)' : 'Draft (not visible to public)'}
                  </span>
                </div>
              </div>
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
              <span className="value">
                {event.maxParticipants ? (
                  <span className="quota-info">
                    <span className="total-quota">{event.maxParticipants}</span>
                    <span className="quota-separator"> | </span>
                    <span className="available-quota">
                      {event.maxParticipants - athletes.length} available
                    </span>
                    <span className="quota-percentage">
                      ({Math.round((athletes.length / event.maxParticipants) * 100)}% full)
                    </span>
                  </span>
                ) : (
                  'Unlimited'
                )}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Categories:</span>
              <span className="value">
                {categories.length > 0 ? (
                  <div className="categories-with-quotas">
                    {categories
                      .filter(category => typeof category === 'object' && category.categoryId)
                      .map(category => {
                        const categoryAthletes = athletes.filter(a => a.categoryId === category.categoryId);
                        const categoryCount = categoryAthletes.length;
                        const maxQuota = category.maxParticipants || null;
                        
                        console.log('Category quota display:', { 
                          categoryId: category.categoryId, 
                          name: category.name, 
                          maxQuota, 
                          categoryCount,
                          fullCategory: category
                        });
                        
                        return (
                          <div key={category.categoryId} className="category-quota-item">
                            <span className="category-name">{category.name || category.categoryId}</span>
                          <span className="category-quota">
                            <span className="registered-count">{categoryCount}</span>
                            {maxQuota && (
                              <>
                                <span className="quota-separator"> / </span>
                                <span className="max-quota">{maxQuota}</span>
                                <span className="available-spots">
                                  ({maxQuota - categoryCount} spots)
                                </span>
                              </>
                            )}
                            {!maxQuota && <span className="unlimited-quota"> (unlimited)</span>}
                          </span>
                        </div>
                      );
                    })}
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
            <span className="count-badge">{getFilteredWods().length}</span>
          </div>
          <div className="card-body">
            {wods.length > 0 ? (
              <>
                <div className="wods-filters">
                  <input
                    type="text"
                    placeholder="🔍 Search workouts..."
                    value={wodSearch}
                    onChange={(e) => setWodSearch(e.target.value)}
                    className="search-input"
                  />
                  <select
                    value={wodFormatFilter}
                    onChange={(e) => setWodFormatFilter(e.target.value)}
                    className="format-filter"
                  >
                    <option value="">All Formats</option>
                    <option value="time">Time</option>
                    <option value="reps">Reps</option>
                    <option value="weight">Weight</option>
                    <option value="ladder">Ladder</option>
                    <option value="amrap">AMRAP</option>
                  </select>
                </div>
                <div className="wods-grid">
                  {getFilteredWods().map((wod, index) => {
                    const scoreData = calculateWodMaxScore(wod);
                    return (
                    <div key={wod.wodId || index} className="wod-card">
                      <div className="wod-header">
                        <h4>{wod.name}</h4>
                        <span className="wod-format">{wod.format}</span>
                      </div>
                      {scoreData && (
                        <div style={{
                          padding: '10px 12px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          borderRadius: '6px',
                          marginBottom: '10px',
                          fontSize: '12px'
                        }}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div>
                              <div style={{opacity: 0.85, fontSize: '11px', marginBottom: '2px'}}>Max Score (Perfect EQS)</div>
                              <div style={{fontSize: '20px', fontWeight: 'bold'}}>{scoreData.maxScore} pts</div>
                            </div>
                            <div style={{textAlign: 'right', fontSize: '11px', opacity: 0.9}}>
                              <div>EDS: {scoreData.totalEDS} × 5</div>
                              <div>Bonus: +{scoreData.timeBonus}</div>
                            </div>
                          </div>
                        </div>
                      )}
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
                  )})}
                </div>
                {getFilteredWods().length === 0 && (
                  <div className="no-results">
                    <p>No workouts match your search criteria</p>
                  </div>
                )}
              </>
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
            <h3>🎯 Scoring Systems</h3>
          </div>
          <div className="card-body">
            <ScoringSystemManager eventId={eventId} />
          </div>
        </div>
      </div>

      {/* Registered Athletes Section - Full Width */}
      <div className="scheduler-section">
        <div className="info-card">
          <div className="card-header">
            <h3>👥 Registered Athletes</h3>
            <span className="count-badge">{athletes.length}</span>
          </div>
          <div className="card-body">
            {athletes.length > 0 ? (
              <div className="athletes-section">
                <div className="athletes-search">
                  <input
                    type="text"
                    placeholder="🔍 Search by name or alias..."
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
                
                <div className="athletes-by-category">
                  {Object.entries(getAthletesByCategory()).map(([categoryId, categoryData]) => (
                    <div key={categoryId} className="category-group">
                      <div className="category-header">
                        <h4 className="category-title">🏷️ {categoryData.name}</h4>
                        <span className="category-count">{categoryData.athletes.length}</span>
                      </div>
                      <div className="athletes-grid">
                        {categoryData.athletes.map(athlete => (
                          <div key={athlete.athleteId} className="athlete-card">
                            <div className="athlete-main">
                              <div className="athlete-name">
                                <strong>{athlete.firstName} {athlete.lastName}</strong>
                                {athlete.alias && (
                                  <span className="athlete-alias">"{athlete.alias}"</span>
                                )}
                              </div>
                              <div className="athlete-email">{athlete.email}</div>
                            </div>
                            <div className="athlete-meta">
                              {athlete.age && <span className="athlete-age">Age: {athlete.age}</span>}
                              <span className="registration-date">
                                {new Date(athlete.registrationDate || athlete.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h4>No Athletes Registered</h4>
                <p>Athletes will appear here once they register for this event</p>
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
                navigate(`/backoffice/events/${eventId}/schedule/${schedule.scheduleId}`);
              }}
              onScheduleClick={(schedule) => {
                navigate(`/backoffice/events/${eventId}/schedule/${schedule.scheduleId}`);
              }}
            />
          </div>
        </div>
      </div>
        </>
      )}

      <style jsx>{`
        .event-details {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          text-align: center;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-container p {
          color: #666;
          font-size: 16px;
          margin: 0;
        }
        
        .error-message {
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
        .status-controls {
          display: flex;
          gap: 15px;
          justify-content: center;
          align-items: center;
        }
        .publish-checkbox-container {
          margin: 12px 0;
        }
        
        .toggle-container {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          transition: all 0.2s ease;
        }
        
        .toggle-container:hover {
          background: #e9ecef;
          border-color: #dee2e6;
        }
        
        .toggle-input {
          display: none;
        }
        
        .toggle-slider {
          position: relative;
          width: 60px;
          height: 30px;
          background: #ccc;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .toggle-slider:before {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .toggle-input:checked + .toggle-slider {
          background: #28a745;
        }
        
        .toggle-input:checked + .toggle-slider:before {
          transform: translateX(30px);
        }
        
        .toggle-text {
          font-size: 14px;
          font-weight: 500;
          color: #495057;
          user-select: none;
        }
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
        
        /* Quota Styling */
        .quota-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        
        .total-quota {
          font-weight: 700;
          color: #667eea;
        }
        
        .quota-separator {
          color: #999;
        }
        
        .available-quota {
          color: #28a745;
          font-weight: 600;
        }
        
        .quota-percentage {
          color: #666;
          font-size: 0.9em;
          font-style: italic;
        }
        
        /* Categories with Quotas */
        .categories-with-quotas {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
        }
        
        .category-quota-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 3px solid #667eea;
        }
        
        .category-name {
          font-weight: 600;
          color: #495057;
        }
        
        .category-quota {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.9em;
        }
        
        .registered-count {
          font-weight: 700;
          color: #667eea;
        }
        
        .max-quota {
          font-weight: 600;
          color: #495057;
        }
        
        .available-spots {
          color: #28a745;
          font-weight: 500;
        }
        
        .unlimited-quota {
          color: #6c757d;
          font-style: italic;
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
        .empty-state .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .empty-state h4 {
          color: #666;
          margin-bottom: 8px;
        }
        .empty-state p {
          margin-bottom: 20px;
          color: #888;
        }
        
        /* Enhanced Athletes Section */
        .athletes-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .athletes-search {
          margin-bottom: 12px;
        }
        
        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .search-input:focus {
          outline: none;
          border-color: #007bff;
        }
        
        .wods-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: center;
        }
        
        .format-filter {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background: white;
          min-width: 140px;
        }
        
        .format-filter:focus {
          outline: none;
          border-color: #007bff;
        }
        
        .no-results {
          text-align: center;
          padding: 20px;
          color: #666;
          font-style: italic;
        }
        
        .athletes-by-category {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 600px;
          overflow-y: auto;
          width: 100%;
          padding: 10px;
          box-sizing: border-box;
        }
        
        .category-group {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          padding: 15px;
          border: 1px solid #667eea;
          width: 100%;
          box-sizing: border-box;
        }
        
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.3);
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .category-title {
          margin: 0;
          color: white !important;
          background: transparent !important;
          font-size: 16px;
          font-weight: 600;
          flex: 1;
          min-width: 0;
        }
        
        .category-count {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        
        .athletes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          width: 100%;
        }
        
        @media (max-width: 768px) {
          .athletes-by-category {
            max-height: 400px;
            padding: 5px;
          }
          
          .category-group {
            padding: 12px;
          }
          
          .category-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }
          
          .category-title {
            font-size: 14px;
          }
          
          .athletes-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 8px;
          }
        }
        
        @media (max-width: 480px) {
          .athletes-by-category {
            max-height: 300px;
            padding: 2px;
          }
          
          .category-group {
            padding: 10px;
          }
          
          .athletes-grid {
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 8px;
        }
        
        .athlete-card {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 10px;
          font-size: 13px;
        }
        
        .athlete-card:hover {
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .athlete-main {
          margin-bottom: 6px;
        }
        
        .athlete-name {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        
        .athlete-name strong {
          color: #333;
          font-size: 14px;
        }
        
        .athlete-alias {
          background: #e8f0fe;
          color: #667eea;
          padding: 1px 6px;
          border-radius: 8px;
          font-size: 11px;
          font-style: italic;
        }
        
        .athlete-email {
          color: #666;
          font-size: 12px;
        }
        
        .athlete-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #888;
          margin-top: 4px;
        }
        
        .athlete-age {
          background: #f8f9fa;
          padding: 1px 4px;
          border-radius: 3px;
        }
        
        .registration-date {
          font-style: italic;
        }
        
        @media (max-width: 768px) {
          .athletes-grid {
            grid-template-columns: 1fr;
          }
          
          .athlete-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
          }
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
        
        .schedule-modal {
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
        
        .schedule-modal-content {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .schedule-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #dee2e6;
          background: #f8f9fa;
          border-radius: 8px 8px 0 0;
        }
        
        .schedule-modal-header h3 {
          margin: 0;
          color: #333;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6c757d;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-btn:hover {
          color: #333;
        }
        
        .schedule-modal-body {
          padding: 20px;
        }
        
        .schedule-info {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .schedule-info p {
          margin: 5px 0;
          color: #495057;
        }
        
        .day-section {
          margin-bottom: 30px;
          border: 1px solid #dee2e6;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .day-section h4 {
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
          font-size: 18px;
          font-weight: 600;
        }
        
        .category-section {
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
        
        .session-card {
          margin: 15px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          border-radius: 8px 8px 0 0;
        }
        
        .session-title h6 {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 16px;
          font-weight: 600;
        }
        
        .session-time {
          color: #666;
          font-size: 14px;
          font-weight: 500;
        }
        
        .session-stats {
          display: flex;
          gap: 15px;
        }
        
        .heat-count, .athlete-count {
          background: #e9ecef;
          padding: 4px 10px;
          border-radius: 15px;
          font-size: 12px;
          font-weight: 500;
          color: #495057;
        }
        
        .heats-container {
          padding: 15px 20px;
        }
        
        .heat-row {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }
        
        .heat-row:last-child {
          margin-bottom: 0;
        }
        
        .heat-number {
          margin-right: 20px;
        }
        
        .heat-badge {
          background: #007bff;
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .heat-matchup {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }
        
        .athlete-card {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 12px 16px;
          min-width: 180px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .athlete-name {
          font-weight: 600;
          color: #333;
          font-size: 14px;
          margin-bottom: 4px;
        }
        
        .athlete-id {
          font-size: 12px;
          color: #666;
          font-weight: 500;
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
        
        .no-heats, .no-athletes {
          text-align: center;
          padding: 20px;
          color: #6c757d;
          font-style: italic;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px dashed #dee2e6;
        }
        
        /* Schedule Details Page Styles */
        .schedule-details-page {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .schedule-page-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }
        .schedule-page-header h2 {
          margin: 0;
          color: #2c3e50;
        }
        .schedule-info-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 30px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .info-label {
          font-size: 12px;
          color: #666;
          font-weight: 600;
        }
        .info-value {
          font-size: 16px;
          color: #333;
        }
        .day-title {
          margin: 0 0 20px 0;
          color: #667eea;
          font-size: 20px;
          border-bottom: 2px solid #667eea;
          padding-bottom: 10px;
        }
        .category-title {
          margin: 20px 0 15px 0;
          color: #333;
        }
        .sessions-grid {
          display: grid;
          gap: 16px;
        }
        .session-time {
          font-weight: 600;
        }
        .session-wod {
          font-weight: 600;
        }
        .athlete-number {
          background: #667eea;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
        }
        .match-athletes .vs {
          background: #dc3545;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}

export default EventDetails;
