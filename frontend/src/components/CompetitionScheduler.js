import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import SchedulerWizard from './SchedulerWizard';
import './CompetitionScheduler.css';

const CompetitionScheduler = ({ eventId, onScheduleGenerated }) => {
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tournamentState, setTournamentState] = useState({
    currentFilter: 1,
    pendingResults: false,
    eliminationResults: {},
    showEliminationDialog: false,
    currentFilterData: null
  });
  const [currentSchedule, setCurrentSchedule] = useState(null);

  useEffect(() => {
    fetchSavedSchedules();
  }, [eventId]);

  const fetchSavedSchedules = async () => {
    try {
      setLoading(true);
      const response = await API.get('CalisthenicsAPI', `/scheduler/${eventId}`);
      setSavedSchedules(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching saved schedules:', error);
      setSavedSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleGenerated = (schedule) => {
    fetchSavedSchedules(); // Refresh the list
    setShowWizard(false);
    if (onScheduleGenerated) {
      onScheduleGenerated(schedule);
    }
  };

  const publishSchedule = async (scheduleId) => {
    try {
      await API.put('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}/publish`);
      fetchSavedSchedules(); // Refresh to show updated status
    } catch (error) {
      console.error('Error publishing schedule:', error);
      alert('Error publishing schedule');
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }
    
    try {
      await API.del('CalisthenicsAPI', `/scheduler/${eventId}/${scheduleId}`);
      fetchSavedSchedules(); // Refresh the list
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Error deleting schedule');
    }
  };

  const processEliminationResults = async (results) => {
    try {
      setLoading(true);
      
      const response = await API.post('CalisthenicsAPI', 
        `/scheduler/${eventId}/${currentSchedule.scheduleId}/process-results`, {
        body: {
          filterId: tournamentState.currentFilter,
          matchResults: results
        }
      });
      
      if (response.nextStage) {
        const nextStageResponse = await API.post('CalisthenicsAPI',
          `/scheduler/${eventId}/${currentSchedule.scheduleId}/next-stage`, {
          body: { startTime: '09:00' }
        });
        
        setCurrentSchedule(nextStageResponse);
      }
      
      setTournamentState(prev => ({
        ...prev,
        currentFilter: prev.currentFilter + 1,
        pendingResults: false,
        showEliminationDialog: false,
        eliminationResults: { ...prev.eliminationResults, [prev.currentFilter]: results }
      }));
      
    } catch (error) {
      console.error('Error processing elimination results:', error);
      alert('Error processing elimination results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="competition-scheduler">
      <div className="scheduler-header">
        <h2>📅 Competition Scheduler</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowWizard(true)}
        >
          + Create New Schedule
        </button>
      </div>

      {/* Saved Schedules List */}
      <div className="saved-schedules-section">
        <h3>Saved Schedules</h3>
        {loading ? (
          <div className="loading">Loading schedules...</div>
        ) : savedSchedules.length === 0 ? (
          <div className="no-schedules">
            <p>No schedules created yet. Click "Create New Schedule" to get started.</p>
          </div>
        ) : (
          <div className="schedules-grid">
            {savedSchedules.map(schedule => (
              <div key={schedule.scheduleId} className="schedule-card">
                <div className="schedule-header">
                  <h4>{schedule.config?.competitionMode || 'Tournament'}</h4>
                  <span className={`status ${schedule.published ? 'published' : 'draft'}`}>
                    {schedule.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="schedule-details">
                  <p><strong>Created:</strong> {new Date(schedule.generatedAt).toLocaleDateString()}</p>
                  <p><strong>Days:</strong> {schedule.days?.length || 0}</p>
                  <p><strong>Sessions:</strong> {schedule.days?.reduce((total, day) => total + (day.sessions?.length || 0), 0) || 0}</p>
                </div>
                <div className="schedule-actions">
                  {!schedule.published && (
                    <button 
                      className="btn-secondary"
                      onClick={() => publishSchedule(schedule.scheduleId)}
                    >
                      Publish
                    </button>
                  )}
                  <button 
                    className="btn-primary"
                    onClick={() => onScheduleGenerated && onScheduleGenerated(schedule)}
                  >
                    View Details
                  </button>
                  <button 
                    className="btn-danger"
                    onClick={() => deleteSchedule(schedule.scheduleId)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="wizard-modal">
          <div className="wizard-content">
            <div className="wizard-header">
              <h3>Create New Schedule</h3>
              <button 
                className="close-btn"
                onClick={() => setShowWizard(false)}
              >
                ×
              </button>
            </div>
            <div className="wizard-body">
              <h2>📅 Competition Scheduler</h2>
              <SchedulerWizard 
                eventId={eventId} 
                onScheduleGenerated={handleScheduleGenerated}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tournament Elimination Dialog */}
      {tournamentState.showEliminationDialog && (
        <EliminationDialog
          filterNumber={tournamentState.currentFilter}
          sessions={tournamentState.currentFilterData}
          onSubmit={processEliminationResults}
          onCancel={() => setTournamentState(prev => ({ ...prev, showEliminationDialog: false }))}
        />
      )}
    </div>
  );
};

const EliminationDialog = ({ filterNumber, sessions, onSubmit, onCancel }) => {
  const [results, setResults] = useState({});

  const handleMatchResult = (matchId, winnerId, loserId) => {
    setResults(prev => ({
      ...prev,
      [matchId]: { matchId, winnerId, loserId }
    }));
  };

  const handleSubmit = () => {
    const resultsList = Object.values(results);
    const totalMatches = sessions.reduce((total, session) => total + (session.matches?.length || 0), 0);
    
    if (resultsList.length !== totalMatches) {
      alert('Please select winners for all matches before proceeding.');
      return;
    }
    
    onSubmit(resultsList);
  };

  return (
    <div className="elimination-dialog-overlay">
      <div className="elimination-dialog">
        <h3>Filter {filterNumber} - Select Winners</h3>
        <p>Please select the winner for each match to proceed to the next filter.</p>
        
        {sessions.map(session => (
          <div key={session.sessionId} className="session-matches">
            <h4>{session.wodName} - {session.categoryName}</h4>
            {session.matches?.map(match => (
              <div key={match.matchId} className="match-result">
                <div className="match-info">
                  <span className="match-title">Match {match.matchId}</span>
                </div>
                <div className="athlete-selection">
                  <label>
                    <input
                      type="radio"
                      name={match.matchId}
                      value={match.athlete1.userId}
                      onChange={() => handleMatchResult(
                        match.matchId, 
                        match.athlete1.userId, 
                        match.athlete2?.userId
                      )}
                    />
                    {match.athlete1.firstName} {match.athlete1.lastName}
                  </label>
                  {match.athlete2 && (
                    <label>
                      <input
                        type="radio"
                        name={match.matchId}
                        value={match.athlete2.userId}
                        onChange={() => handleMatchResult(
                          match.matchId, 
                          match.athlete2.userId, 
                          match.athlete1.userId
                        )}
                      />
                      {match.athlete2.firstName} {match.athlete2.lastName}
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        
        <div className="dialog-actions">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary">Proceed to Next Filter</button>
        </div>
      </div>
    </div>
  );
};

export default CompetitionScheduler;
