import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import './SchedulerWizard.css';

const SchedulerWizard = ({ eventId, onScheduleGenerated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState({
    maxDayHours: 10,
    lunchBreakHours: 1,
    competitionMode: 'HEATS',
    athletesPerHeat: 8,
    numberOfHeats: 6,
    categoryHeats: {},
    athletesEliminatedPerFilter: 0,
    categoryEliminationRules: {},
    heatWodMapping: {},
    startTime: '08:00',
    timezone: 'UTC',
    transitionTime: 5,
    setupTime: 10
  });
  
  const [eventData, setEventData] = useState({
    wods: [],
    categories: [],
    athletes: [],
    days: []
  });
  
  const [dataLoading, setDataLoading] = useState(true);
  
  const [schedules, setSchedules] = useState([]);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tournamentState, setTournamentState] = useState({
    currentFilter: 1,
    pendingResults: false,
    eliminationResults: {},
    showEliminationDialog: false,
    currentFilterData: null
  });

  useEffect(() => {
    loadEventData();
    loadSchedules();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      setDataLoading(true);
      console.log('🔍 Fetching schedule details for event:', eventId);
      
      // First get event details (same as EventDetails component)
      const eventResponse = await API.get('CalisthenicsAPI', `/competitions/${eventId}`);
      
      console.log('📋 Event response keys:', Object.keys(eventResponse));
      console.log('📋 Categories field exists:', !!eventResponse.categories);
      console.log('📋 Workouts field exists:', !!eventResponse.workouts);
      console.log('📋 WODs field exists:', !!eventResponse.wods);
      
      const [athletes, days] = await Promise.all([
        API.get('CalisthenicsAPI', `/athletes?eventId=${eventId}`).catch(err => {
          console.warn('Failed to load athletes:', err);
          return [];
        }),
        API.get('CalisthenicsAPI', `/competitions/${eventId}/days`).catch(err => {
          console.warn('Failed to load event days:', err);
          return [];
        })
      ]);

      // Get WODs from event record (same as EventDetails)
      let wods = [];
      console.log('📋 Raw eventResponse.workouts:', eventResponse.workouts?.length || 0);
      console.log('📋 Raw eventResponse.wods:', eventResponse.wods?.length || 0);
      
      const eventWods = eventResponse.wods || eventResponse.workouts || [];
      console.log('📋 Combined eventWods length:', eventWods.length);
      
      if (eventWods.length > 0) {
        wods = eventWods;
      } else {
        // Fallback to fetching WODs linked to event
        try {
          wods = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`) || [];
        } catch (err) {
          console.warn('Failed to load WODs:', err);
          wods = [];
        }
      }

      // Get categories from event record (same as EventDetails)
      let categories = [];
      console.log('📋 Raw eventResponse.categories:', eventResponse.categories?.length || 0);
      
      const eventCategories = eventResponse.categories || [];
      if (eventCategories.length > 0) {
        console.log('📋 Categories before filtering:', eventCategories);
        // Filter to only get objects (not strings) and valid category objects
        categories = eventCategories.filter(category => 
          typeof category === 'object' && 
          category !== null && 
          category.categoryId && 
          category.name
        );
        console.log('📋 Categories after filtering:', categories.length);
      } else {
        // Fallback to fetching categories linked to event
        try {
          categories = await API.get('CalisthenicsAPI', `/categories?eventId=${eventId}`) || [];
        } catch (err) {
          console.warn('Failed to load categories:', err);
          categories = [];
        }
      }

      console.log('Loaded event data:', { 
        wods: wods?.length || 0, 
        categories: categories?.length || 0, 
        athletes: athletes?.length || 0, 
        days: days?.length || 0,
        categoriesRaw: categories,
        athletesData: athletes
      });
      
      setEventData({ wods: wods || [], categories: categories || [], athletes: athletes || [], days: days || [] });
    } catch (error) {
      console.error('Error loading event data:', error);
      setEventData({ wods: [], categories: [], athletes: [], days: [] });
    } finally {
      setDataLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const scheduleData = await API.get('CalisthenicsAPI', `/scheduler/${eventId}`);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : (scheduleData ? [scheduleData] : []));
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    }
  };

  const steps = [
    { id: 1, title: 'Competition Mode', icon: '🏆' },
    { id: 2, title: 'Basic Settings', icon: '⚙️' },
    { id: 3, title: 'Category Configuration', icon: '👥' },
    { id: 4, title: 'WOD Assignment', icon: '💪' },
    { id: 5, title: 'Review & Generate', icon: '✅' },
    { id: 6, title: 'Schedule Management', icon: '📋' }
  ];

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateSchedule = async () => {
    setLoading(true);
    try {
      const scheduleConfig = { ...config, ...eventData };
      const response = await API.post('CalisthenicsAPI', `/scheduler/${eventId}`, {
        body: scheduleConfig
      });
      setCurrentSchedule(response);
      onScheduleGenerated?.(response);
      await loadSchedules();
      setCurrentStep(6); // Go to schedule management
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

  const publishSchedule = async (scheduleId) => {
    setPublishing(true);
    try {
      await API.post('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}/publish`);
      if (currentSchedule?.scheduleId === scheduleId) {
        setCurrentSchedule({...currentSchedule, published: true});
      }
      await loadSchedules();
      alert('Schedule published successfully! Athletes can now view it.');
    } catch (error) {
      console.error('Error publishing schedule:', error);
      alert('Failed to publish schedule');
    } finally {
      setPublishing(false);
    }
  };

  const unpublishSchedule = async (scheduleId) => {
    setPublishing(true);
    try {
      await API.post('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}/unpublish`);
      if (currentSchedule?.scheduleId === scheduleId) {
        setCurrentSchedule({...currentSchedule, published: false});
      }
      await loadSchedules();
      alert('Schedule unpublished successfully.');
    } catch (error) {
      console.error('Error unpublishing schedule:', error);
      alert('Failed to unpublish schedule');
    } finally {
      setPublishing(false);
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
      setCurrentStep(6);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return config.competitionMode;
      case 2: return config.startTime && config.timezone;
      case 3: 
        if (config.competitionMode === 'VERSUS') {
          // Check that all categories with athletes have heats configured
          const categoriesWithAthletes = eventData.categories.filter(cat => 
            eventData.athletes.filter(a => a.categoryId === cat.categoryId).length > 0
          );
          
          if (categoriesWithAthletes.length === 0) return true; // No athletes, can proceed
          
          // Check that each category has heats configured (elimination rules are optional)
          const allCategoriesHaveHeats = categoriesWithAthletes.every(cat => 
            config.categoryHeats[cat.categoryId] && config.categoryHeats[cat.categoryId] > 0
          );
          
          return allCategoriesHaveHeats;
        }
        return true;
      case 4:
        if (config.competitionMode === 'VERSUS') {
          // Check that all categories have WOD mappings for all their heats
          const categoriesWithAthletes = eventData.categories.filter(cat => 
            eventData.athletes.filter(a => a.categoryId === cat.categoryId).length > 0
          );
          
          if (categoriesWithAthletes.length === 0) return true;
          
          const allCategoriesHaveWodMappings = categoriesWithAthletes.every(cat => {
            const numberOfHeats = config.categoryHeats[cat.categoryId] || 0;
            const categoryMapping = config.heatWodMapping[cat.categoryId] || {};
            
            // Check that all heats have WOD mappings
            for (let heat = 1; heat <= numberOfHeats; heat++) {
              if (!categoryMapping[heat]) return false;
            }
            return numberOfHeats > 0; // Must have at least one heat
          });
          
          return allCategoriesHaveWodMappings;
        }
        return true;
      default: return true;
    }
  };

  return (
    <div className="scheduler-wizard">
      <div className="wizard-header">
        <div className="step-indicator">
          {steps.map(step => (
            <div 
              key={step.id} 
              className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              onClick={() => step.id <= 5 && setCurrentStep(step.id)}
            >
              <div className="step-icon">{step.icon}</div>
              <div className="step-title">{step.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        {currentStep === 1 && (
          <Step1CompetitionMode config={config} setConfig={setConfig} eventData={eventData} />
        )}
        {currentStep === 2 && (
          <Step2BasicSettings config={config} setConfig={setConfig} />
        )}
        {currentStep === 3 && (
          dataLoading ? (
            <div className="step-content">
              <h3>Tournament Configuration</h3>
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading categories and athletes...</p>
              </div>
            </div>
          ) : !eventData.categories || eventData.categories.length === 0 ? (
            <div className="step-content">
              <h3>Tournament Configuration</h3>
              <div className="empty-state">
                <p>⚠️ No categories found for this event.</p>
                <p>Please add categories to the event first before configuring the tournament.</p>
                <small>Debug: Categories: {eventData.categories?.length || 0}, Athletes: {eventData.athletes?.length || 0}</small>
              </div>
            </div>
          ) : (
            <Step3CategoryConfig config={config} setConfig={setConfig} eventData={eventData} />
          )
        )}
        {currentStep === 4 && (
          dataLoading ? (
            <div className="step-content">
              <h3>WOD Assignment</h3>
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading WODs and categories...</p>
              </div>
            </div>
          ) : (
            <Step4WodAssignment config={config} setConfig={setConfig} eventData={eventData} />
          )
        )}
        {currentStep === 5 && (
          <Step5Review config={config} eventData={eventData} onGenerate={generateSchedule} loading={loading} />
        )}
        {currentStep === 6 && (
          <Step6ScheduleManagement 
            schedules={schedules}
            currentSchedule={currentSchedule}
            eventData={eventData}
            onSave={saveSchedule}
            onPublish={publishSchedule}
            onUnpublish={unpublishSchedule}
            onDelete={deleteSchedule}
            onLoad={loadSchedule}
            saving={saving}
            publishing={publishing}
            tournamentState={tournamentState}
            setTournamentState={setTournamentState}
          />
        )}
      </div>

      <div className="wizard-navigation">
        <button 
          onClick={prevStep} 
          disabled={currentStep === 1}
          className="btn-secondary"
        >
          Previous
        </button>
        
        {currentStep < 5 ? (
          <button 
            onClick={nextStep} 
            disabled={!canProceed()}
            className="btn-primary"
          >
            Next
          </button>
        ) : currentStep === 5 ? (
          <button 
            onClick={generateSchedule} 
            disabled={loading || !canProceed()}
            className="btn-generate"
          >
            {loading ? 'Generating...' : 'Generate Schedule'}
          </button>
        ) : (
          <button 
            onClick={() => setCurrentStep(1)} 
            className="btn-primary"
          >
            Create New Schedule
          </button>
        )}
      </div>
    </div>
  );
};

const Step1CompetitionMode = ({ config, setConfig, eventData }) => (
  <div className="step-content">
    <h3>Choose Competition Mode</h3>
    <p>Select how athletes will compete in your event:</p>
    
    <div className="mode-options">
      <div 
        className={`mode-card ${config.competitionMode === 'HEATS' ? 'selected' : ''}`}
        onClick={() => setConfig({...config, competitionMode: 'HEATS'})}
      >
        <div className="mode-icon">🏃‍♂️</div>
        <h4>Traditional Heats</h4>
        <p>Athletes compete in groups, multiple heats per WOD</p>
        <div className="mode-details">
          <span>• Best for large groups</span>
          <span>• Multiple athletes per heat</span>
          <span>• Standard competition format</span>
        </div>
      </div>

      <div 
        className={`mode-card ${config.competitionMode === 'VERSUS' ? 'selected' : ''}`}
        onClick={() => setConfig({...config, competitionMode: 'VERSUS'})}
      >
        <div className="mode-icon">⚔️</div>
        <h4>One vs One Tournament</h4>
        <p>Head-to-head elimination tournament</p>
        <div className="mode-details">
          <span>• Progressive elimination</span>
          <span>• 1v1 matches</span>
          <span>• Tournament bracket style</span>
        </div>
      </div>

      <div 
        className={`mode-card ${config.competitionMode === 'SIMULTANEOUS' ? 'selected' : ''}`}
        onClick={() => setConfig({...config, competitionMode: 'SIMULTANEOUS'})}
      >
        <div className="mode-icon">🎯</div>
        <h4>All Simultaneous</h4>
        <p>All athletes compete at the same time</p>
        <div className="mode-details">
          <span>• Everyone competes together</span>
          <span>• Single session per WOD</span>
          <span>• Fastest format</span>
        </div>
      </div>
    </div>

    <div className="event-summary">
      <h4>Your Event Overview</h4>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="label">Categories:</span>
          <span className="value">{eventData.categories.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Athletes:</span>
          <span className="value">{eventData.athletes.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">WODs:</span>
          <span className="value">{eventData.wods.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Days:</span>
          <span className="value">{eventData.days.length}</span>
        </div>
      </div>
    </div>
  </div>
);

const Step2BasicSettings = ({ config, setConfig }) => (
  <div className="step-content">
    <h3>Basic Schedule Settings</h3>
    <p>Configure the timing and logistics for your competition:</p>
    
    <div className="settings-grid">
      <div className="setting-group">
        <label>Start Time</label>
        <input
          type="time"
          value={config.startTime}
          onChange={(e) => setConfig({...config, startTime: e.target.value})}
        />
      </div>

      <div className="setting-group">
        <label>Timezone</label>
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
        </select>
      </div>

      <div className="setting-group">
        <label>Max Hours per Day</label>
        <input
          type="number"
          value={config.maxDayHours}
          onChange={(e) => setConfig({...config, maxDayHours: parseInt(e.target.value)})}
          min="6" max="12"
        />
        <small>Competition will be split across multiple days if needed</small>
      </div>

      <div className="setting-group">
        <label>Transition Time (minutes)</label>
        <input
          type="number"
          value={config.transitionTime}
          onChange={(e) => setConfig({...config, transitionTime: parseInt(e.target.value)})}
          min="1" max="15"
        />
        <small>Time between heats/matches</small>
      </div>

      {config.competitionMode === 'HEATS' && (
        <>
          <div className="setting-group">
            <label>Athletes per Heat</label>
            <input
              type="number"
              value={config.athletesPerHeat}
              onChange={(e) => setConfig({...config, athletesPerHeat: parseInt(e.target.value)})}
              min="4" max="16"
            />
            <small>How many athletes compete in each heat</small>
          </div>

          <div className="setting-group">
            <label>Concurrent Heats</label>
            <input
              type="number"
              value={config.concurrentHeats || 1}
              onChange={(e) => setConfig({...config, concurrentHeats: parseInt(e.target.value)})}
              min="1" max="4"
            />
            <small>How many heats run at the same time</small>
          </div>

          <div className="setting-group">
            <label>Athletes Eliminated per Filter</label>
            <input
              type="number"
              value={config.athletesEliminatedPerFilter || 0}
              onChange={(e) => setConfig({...config, athletesEliminatedPerFilter: parseInt(e.target.value)})}
              min="0"
              max="50"
            />
            <small>How many athletes are eliminated per round (0 = no elimination)</small>
          </div>
        </>
      )}

      {config.competitionMode === 'VERSUS' && (
        <div className="setting-group">
          <label>Concurrent Matches</label>
          <input
            type="number"
            value={config.concurrentMatches || 1}
            onChange={(e) => setConfig({...config, concurrentMatches: parseInt(e.target.value)})}
            min="1" max="4"
          />
          <small>How many 1v1 matches run at the same time</small>
        </div>
      )}
    </div>
  </div>
);

const Step3CategoryConfig = ({ config, setConfig, eventData }) => {
  console.log('Step3CategoryConfig - Rendering with:', {
    eventData,
    categories: eventData?.categories,
    athletes: eventData?.athletes,
    competitionMode: config.competitionMode
  });
  
  const updateCategoryHeats = (categoryId, numberOfHeats) => {
    const newHeats = { ...config.categoryHeats, [categoryId]: parseInt(numberOfHeats) || 2 };
    setConfig({...config, categoryHeats: newHeats});
  };

  const updateEliminationRule = (categoryId, roundIndex, eliminate) => {
    const newRules = { ...config.categoryEliminationRules };
    if (!newRules[categoryId]) {
      newRules[categoryId] = [];
    }
    newRules[categoryId][roundIndex] = {
      filter: roundIndex + 1,
      eliminate: parseInt(eliminate) || 0,
      wildcards: 0
    };
    setConfig({...config, categoryEliminationRules: newRules});
  };

  // Initialize category heats for categories with athletes
  React.useEffect(() => {
    if (config.competitionMode === 'VERSUS' && eventData.categories.length > 0) {
      const categoriesWithAthletes = eventData.categories.filter(cat => 
        eventData.athletes.filter(a => a.categoryId === cat.categoryId).length > 0
      );
      
      const newHeats = { ...config.categoryHeats };
      let hasChanges = false;
      
      categoriesWithAthletes.forEach(cat => {
        if (!newHeats[cat.categoryId]) {
          newHeats[cat.categoryId] = 2; // Default to 2 rounds
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setConfig({...config, categoryHeats: newHeats});
      }
    }
  }, [config.competitionMode, eventData.categories, eventData.athletes]);

  const calculateRemainingAthletes = (categoryId, roundIndex) => {
    const totalAthletes = eventData.athletes.filter(a => a.categoryId === categoryId).length;
    let remaining = totalAthletes;
    
    const rules = config.categoryEliminationRules[categoryId] || [];
    for (let i = 0; i < roundIndex; i++) {
      const rule = rules[i];
      if (rule) {
        remaining = Math.max(1, remaining - rule.eliminate);
      } else {
        remaining = Math.ceil(remaining / 2); // Default: eliminate half
      }
    }
    return remaining;
  };

  if (config.competitionMode !== 'VERSUS') {
    return (
      <div className="step-content">
        <h3>Category Configuration</h3>
        <p>✅ No additional category configuration needed for {config.competitionMode} mode.</p>
        <div className="categories-preview">
          <h4>Your Categories:</h4>
          {eventData.categories && eventData.categories.length > 0 ? (
            eventData.categories.map(category => {
              const athleteCount = eventData.athletes.filter(a => a.categoryId === category.categoryId).length;
              return (
                <div key={category.categoryId} className="category-preview">
                  <span className="category-name">{category.name}</span>
                  <span className="athlete-count">{athleteCount} athletes</span>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <p>⚠️ No categories found for this event.</p>
              <p>Please add categories to the event first.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if we have categories for VERSUS mode
  if (!eventData.categories || eventData.categories.length === 0) {
    return (
      <div className="step-content">
        <h3>Tournament Configuration</h3>
        <div className="empty-state">
          <p>⚠️ No categories found for this event.</p>
          <p>Please add categories to the event first before configuring the tournament.</p>
          <div className="debug-info">
            <small>Debug: Categories: {eventData.categories?.length || 0}, Athletes: {eventData.athletes?.length || 0}</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h3>Tournament Configuration</h3>
      <p>Configure elimination rules for each category:</p>
      
      <div className="categories-config">
        {eventData.categories
          .filter(category => category && category.categoryId && category.name) // Filter out invalid categories
          .map(category => {
          const athleteCount = eventData.athletes.filter(a => a.categoryId === category.categoryId).length;
          console.log('Category matching:', {
            categoryId: category.categoryId,
            categoryName: category.name,
            athleteCount,
            athletes: eventData.athletes.map(a => ({ id: a.userId, categoryId: a.categoryId, name: `${a.firstName} ${a.lastName}` }))
          });
          
          if (athleteCount === 0) {
            return (
              <div key={category.categoryId} className="category-card">
                <h4>{category.name} <span className="athlete-count">(0 athletes)</span></h4>
                <div className="no-athletes-warning">
                  <p>⚠️ No athletes registered in this category.</p>
                  <p>Athletes must be registered before configuring tournament rules.</p>
                </div>
              </div>
            );
          }
          
          const numberOfHeats = config.categoryHeats[category.categoryId] || 2;
          
          return (
            <div key={category.categoryId} className="category-card">
              <h4>{category.name} <span className="athlete-count">({athleteCount} athletes)</span></h4>
              
              <div className="heats-selector">
                <label>Number of Tournament Rounds:</label>
                <select
                  value={numberOfHeats}
                  onChange={(e) => updateCategoryHeats(category.categoryId, e.target.value)}
                >
                  {[1,2,3,4,5,6].map(n => (
                    <option key={n} value={n}>{n} rounds</option>
                  ))}
                </select>
              </div>

              <div className="elimination-rules">
                <h5>Elimination Rules:</h5>
                {Array.from({length: numberOfHeats}, (_, i) => {
                  const startingAthletes = calculateRemainingAthletes(category.categoryId, i);
                  const rules = config.categoryEliminationRules[category.categoryId] || [];
                  const currentRule = rules[i] || { eliminate: 0 };
                  const maxEliminate = Math.max(0, startingAthletes - 1);
                  const remaining = Math.max(1, startingAthletes - currentRule.eliminate);
                  
                  return (
                    <div key={i} className="elimination-row">
                      <div className="round-info">
                        <span className="round-label">Round {i + 1}:</span>
                        <span className="athletes-count">{startingAthletes} athletes</span>
                      </div>
                      <div className="elimination-control">
                        <label>Eliminate:</label>
                        <input
                          type="number"
                          min="0"
                          max={maxEliminate}
                          value={currentRule.eliminate}
                          onChange={(e) => updateEliminationRule(category.categoryId, i, e.target.value)}
                        />
                        <span className="result">→ {remaining} advance</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Step4WodAssignment = ({ config, setConfig, eventData }) => {
  console.log('Step4WodAssignment - eventData:', eventData);
  console.log('Step4WodAssignment - wods:', eventData?.wods);
  console.log('Step4WodAssignment - categories:', eventData?.categories);
  
  if (config.competitionMode !== 'VERSUS') {
    return (
      <div className="step-content">
        <h3>WOD Assignment</h3>
        <p>✅ WODs will be automatically assigned for {config.competitionMode} mode.</p>
        <div className="wods-preview">
          <h4>Available WODs:</h4>
          {eventData.wods.map(wod => (
            <div key={wod.wodId} className="wod-preview">
              <span className="wod-name">{wod.name}</span>
              <span className="wod-type">{wod.type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h3>WOD Assignment</h3>
      <p>Assign specific WODs to each tournament round for each category:</p>
      
      <div className="wod-assignment">
        {eventData.categories.map(category => {
          const athleteCount = eventData.athletes.filter(a => a.categoryId === category.categoryId).length;
          if (athleteCount === 0) return null;
          
          const numberOfHeats = config.categoryHeats[category.categoryId] || 2;
          const categoryWodMapping = config.heatWodMapping[category.categoryId] || {};
          
          return (
            <div key={category.categoryId} className="category-wod-card">
              <h4>{category.name}</h4>
              
              <div className="wod-rounds">
                {Array.from({length: numberOfHeats}, (_, i) => {
                  const roundNumber = i + 1;
                  return (
                    <div key={roundNumber} className="wod-round">
                      <label>Round {roundNumber}:</label>
                      <select
                        value={categoryWodMapping[roundNumber] || ''}
                        onChange={(e) => {
                          const newMapping = { ...config.heatWodMapping };
                          if (!newMapping[category.categoryId]) {
                            newMapping[category.categoryId] = {};
                          }
                          newMapping[category.categoryId][roundNumber] = e.target.value;
                          setConfig({...config, heatWodMapping: newMapping});
                        }}
                      >
                        <option value="">Select WOD</option>
                        {eventData.wods.map(wod => (
                          <option key={wod.wodId} value={wod.wodId}>{wod.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Step5Review = ({ config, eventData, onGenerate, loading }) => (
  <div className="step-content">
    <h3>Review Configuration</h3>
    <p>Please review your schedule configuration before generating:</p>
    
    <div className="review-sections">
      <div className="review-section">
        <h4>🏆 Competition Mode</h4>
        <p>{config.competitionMode === 'HEATS' ? 'Traditional Heats' : 
           config.competitionMode === 'VERSUS' ? 'One vs One Tournament' : 
           'All Simultaneous'}</p>
      </div>

      <div className="review-section">
        <h4>⚙️ Basic Settings</h4>
        <div className="review-grid">
          <span>Start Time: {config.startTime} ({config.timezone})</span>
          <span>Max Hours/Day: {config.maxDayHours}h</span>
          <span>Transition Time: {config.transitionTime} min</span>
        </div>
      </div>

      <div className="review-section">
        <h4>👥 Categories</h4>
        {eventData.categories.map(category => {
          const athleteCount = eventData.athletes.filter(a => a.categoryId === category.categoryId).length;
          const rounds = config.categoryHeats[category.categoryId] || 'Auto';
          return (
            <div key={category.categoryId} className="category-review">
              <span>{category.name}: {athleteCount} athletes</span>
              {config.competitionMode === 'VERSUS' && <span>({rounds} rounds)</span>}
            </div>
          );
        })}
      </div>

      {config.competitionMode === 'VERSUS' && (
        <div className="review-section">
          <h4>💪 WOD Assignments</h4>
          {Object.entries(config.heatWodMapping).map(([categoryId, rounds]) => {
            const category = eventData.categories.find(c => c.categoryId === categoryId);
            return (
              <div key={categoryId} className="wod-review">
                <strong>{category?.name}:</strong>
                {Object.entries(rounds).map(([round, wodId]) => {
                  const wod = eventData.wods.find(w => w.wodId === wodId);
                  return (
                    <span key={round}>Round {round}: {wod?.name}</span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>

    <div className="generate-warning">
      <p>⚠️ This will generate a new schedule. Any existing unsaved schedules will be replaced.</p>
    </div>
  </div>
);

const Step6ScheduleManagement = ({ 
  schedules, currentSchedule, eventData, onSave, onPublish, onUnpublish, 
  onDelete, onLoad, saving, publishing, tournamentState, setTournamentState 
}) => (
  <div className="step-content">
    <h3>Schedule Management</h3>
    
    {/* Existing Schedules */}
    {schedules.length > 0 && (
      <div className="schedules-section">
        <h4>📋 Existing Schedules</h4>
        <div className="schedules-grid">
          {schedules.map(schedule => (
            <div key={schedule.scheduleId} className="schedule-card">
              <div className="schedule-header">
                <h5>Schedule {schedule.scheduleId.slice(-8)}</h5>
                <div className="schedule-status">
                  <span className="schedule-date">
                    {new Date(schedule.generatedAt).toLocaleDateString()}
                  </span>
                  {schedule.published && (
                    <span className="published-badge">Published</span>
                  )}
                </div>
              </div>
              <div className="schedule-info">
                <p>Mode: {schedule.config?.competitionMode || 'HEATS'}</p>
                <p>Duration: {schedule.totalDuration?.toFixed(1)}h</p>
                <p>Days: {schedule.days?.length || 0}</p>
              </div>
              <div className="schedule-actions">
                <button onClick={() => onLoad(schedule.scheduleId)} className="btn-load">
                  Load
                </button>
                {schedule.published ? (
                  <button 
                    onClick={() => onUnpublish(schedule.scheduleId)} 
                    disabled={publishing}
                    className="btn-unpublish btn-small"
                  >
                    Unpublish
                  </button>
                ) : (
                  <button 
                    onClick={() => onPublish(schedule.scheduleId)} 
                    disabled={publishing}
                    className="btn-publish btn-small"
                  >
                    Publish
                  </button>
                )}
                <button onClick={() => onDelete(schedule.scheduleId)} className="btn-delete">
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
      <div className="current-schedule-section">
        <div className="schedule-header-actions">
          <h4>📅 Current Schedule</h4>
          <div className="header-actions">
            <button 
              onClick={() => onSave(currentSchedule)} 
              disabled={saving}
              className="btn-save"
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
            
            {currentSchedule?.scheduleId ? (
              currentSchedule.published ? (
                <button 
                  onClick={() => onUnpublish(currentSchedule.scheduleId)} 
                  disabled={publishing}
                  className="btn-unpublish"
                >
                  {publishing ? 'Unpublishing...' : 'Unpublish'}
                </button>
              ) : (
                <button 
                  onClick={() => onPublish(currentSchedule.scheduleId)} 
                  disabled={publishing}
                  className="btn-publish"
                >
                  {publishing ? 'Publishing...' : 'Publish for Athletes'}
                </button>
              )
            ) : (
              <div className="save-first-message">
                <span className="save-icon">💾</span>
                <span>Save schedule first to publish</span>
              </div>
            )}
          </div>
        </div>

        <div className="schedule-summary">
          <p>Mode: <strong>{currentSchedule.config?.competitionMode || 'HEATS'}</strong></p>
          <p>Start Time: <strong>{currentSchedule.config?.startTime} ({currentSchedule.config?.timezone})</strong></p>
          <p>Total Days: <strong>{currentSchedule.days?.length || 0}</strong></p>
          <p>Total Duration: <strong>{currentSchedule.totalDuration?.toFixed(1)} hours</strong></p>
          
          {currentSchedule.config?.competitionMode === 'VERSUS' && (
            <div className="versus-summary">
              <h5>🥊 Tournament Matches:</h5>
              {currentSchedule.days?.map(day => {
                const sessionsByCategory = day.sessions?.filter(s => s.competitionMode === 'VERSUS')
                  .reduce((groups, session) => {
                    const categoryKey = session.categoryId;
                    if (!groups[categoryKey]) {
                      groups[categoryKey] = {
                        categoryName: session.categoryName || session.categoryId,
                        sessions: []
                      };
                    }
                    groups[categoryKey].sessions.push(session);
                    return groups;
                  }, {}) || {};

                return (
                  <div key={day.dayId}>
                    {Object.entries(sessionsByCategory).map(([categoryId, categoryData]) => (
                      <div key={categoryId} className="category-group">
                        <h6 className="category-title">{categoryData.categoryName}</h6>
                        {categoryData.sessions.map(session => (
                          <div key={session.sessionId} className="match-summary-item">
                            <strong>Round {session.heatNumber || 1}</strong> - {eventData.wods.find(w => w.wodId === session.wodId)?.name || session.wodId}
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
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Schedule View */}
        {currentSchedule.days?.map(day => (
          <DayScheduleView
            key={day.dayId}
            day={day}
            competitionMode={currentSchedule.config?.competitionMode}
            timezone={currentSchedule.config?.timezone}
            eventData={eventData}
          />
        ))}
      </div>
    )}

    {!currentSchedule && schedules.length === 0 && (
      <div className="no-schedules">
        <div className="no-schedules-icon">📅</div>
        <h4>No Schedules Yet</h4>
        <p>Generate your first schedule using the wizard above.</p>
      </div>
    )}
  </div>
);

const DayScheduleView = ({ day, competitionMode, timezone, eventData }) => (
  <div className="day-schedule">
    <h5>Day {day.dayId}</h5>
    <p>Duration: {day.totalDuration?.toFixed(1)} hours</p>
    <p className={day.withinTimeLimit ? 'time-ok' : 'time-warning'}>
      {day.withinTimeLimit ? '✓ Within time limit' : '⚠ Exceeds time limit'}
    </p>

    <div className="sessions">
      {day.sessions?.map(session => (
        <div key={session.sessionId} className="session">
          <div className="session-header">
            <div className="session-info">
              <h6>{session.wodName || session.wodId} - {session.categoryName || session.categoryId}</h6>
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
              <span className="start-time">{session.startTime}</span>
              <span className="duration">{session.duration} min</span>
            </div>
          </div>

          {session.competitionMode === 'VERSUS' && session.matches && (
            <div className="versus-display">
              {session.matches.map((match, idx) => (
                <div key={match.matchId} className="versus-match-card">
                  <div className="versus-athletes">
                    <div className="athlete-card athlete-1">
                      <div className="athlete-name">{match.athlete1?.firstName} {match.athlete1?.lastName}</div>
                    </div>
                    <div className="versus-divider">
                      <span className="vs-text">VS</span>
                    </div>
                    <div className="athlete-card athlete-2">
                      {match.athlete2 ? (
                        <div className="athlete-name">{match.athlete2.firstName} {match.athlete2.lastName}</div>
                      ) : (
                        <div className="bye-card">
                          <div className="bye-text">BYE</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default SchedulerWizard;
