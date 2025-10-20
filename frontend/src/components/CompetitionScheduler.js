import React, { useState } from 'react';
import { API } from 'aws-amplify';
import SchedulerWizard from './SchedulerWizard';
import './CompetitionScheduler.css';

const CompetitionScheduler = ({ eventId, onScheduleGenerated }) => {
  const [tournamentState, setTournamentState] = useState({
    currentFilter: 1,
    pendingResults: false,
    eliminationResults: {},
    showEliminationDialog: false,
    currentFilterData: null
  });
  const [loading, setLoading] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);

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
      <SchedulerWizard 
        eventId={eventId} 
        onScheduleGenerated={onScheduleGenerated} 
      />

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
