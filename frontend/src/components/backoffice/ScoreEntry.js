import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useOrganization } from '../../contexts/OrganizationContext';
import './Backoffice.css';
import './ScoreEntry.css';

function ScoreEntry() {
  const { selectedOrganization } = useOrganization();
  const [events, setEvents] = useState([]);
  const [wods, setWods] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedWod, setSelectedWod] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [scores, setScores] = useState([]);
  const [scoreForm, setScoreForm] = useState({
    athleteId: '',
    score: '',
    time: '',
    reps: ''
  });
  const [athleteSearch, setAthleteSearch] = useState('');

  useEffect(() => {
    if (selectedOrganization) {
      fetchEvents();
    }
    fetchAthletes();
    fetchCategories();
  }, [selectedOrganization]);

  useEffect(() => {
    if (selectedEvent && selectedWod && selectedCategory) {
      fetchScores();
    }
  }, [selectedEvent, selectedWod, selectedCategory]);

  const fetchEvents = async () => {
    if (!selectedOrganization) return;
    
    try {
      const response = await API.get('CalisthenicsAPI', `/competitions?organizationId=${selectedOrganization.organizationId}`);
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
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

  const fetchCategories = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchWods = async (eventId) => {
    try {
      const response = await API.get('CalisthenicsAPI', `/wods?eventId=${eventId}`);
      setWods(response || []);
    } catch (error) {
      console.error('Error fetching WODs:', error);
      setWods([]);
    }
  };

  const fetchScores = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/scores?eventId=${selectedEvent.eventId}`);
      const wodScores = response.filter(score => score.wodId === selectedWod.wodId);
      setScores(wodScores);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  const handleSubmitScore = async (e) => {
    e.preventDefault();
    try {
      const scoreData = {
        eventId: selectedEvent.eventId,
        dayId: selectedWod.dayId,
        wodId: selectedWod.wodId,
        athleteId: scoreForm.athleteId,
        score: parseFloat(scoreForm.score) || 0,
        time: scoreForm.time,
        reps: parseInt(scoreForm.reps) || 0,
        division: selectedCategory,
        categoryId: selectedCategory
      };

      const existingScore = getAthleteScoreForWod(scoreForm.athleteId);
      
      if (existingScore) {
        // Update existing score
        await API.put('CalisthenicsAPI', `/scores/${existingScore.scoreId}`, { 
          body: { ...scoreData, eventId: selectedEvent.eventId }
        });
        alert('Score updated successfully!');
      } else {
        // Create new score
        await API.post('CalisthenicsAPI', `/scores`, { 
          body: scoreData 
        });
        alert('Score submitted successfully!');
      }
      
      setScoreForm({ athleteId: '', score: '', time: '', reps: '' });
      setAthleteSearch('');
      
      // Immediate refresh
      await fetchScores();
      
      // Force a second refresh after 1 second to ensure backend is synced
      setTimeout(async () => {
        await fetchScores();
      }, 1000);
    } catch (error) {
      console.error('Error submitting score:', error);
      alert('Error submitting score: ' + error.message);
    }
  };

  const getFilteredAthletes = () => {
    if (!selectedCategory) {
      return [];
    }
    let filtered = athletes.filter(athlete => athlete.categoryId === selectedCategory);
    
    if (athleteSearch) {
      const search = athleteSearch.toLowerCase();
      filtered = filtered.filter(athlete => 
        athlete.firstName.toLowerCase().includes(search) ||
        athlete.lastName.toLowerCase().includes(search) ||
        (athlete.alias && athlete.alias.toLowerCase().includes(search))
      );
    }
    
    return filtered;
  };

  const getAthleteScoreForWod = (athleteId) => {
    return scores.find(score => {
      const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
      return actualAthleteId === athleteId && score.wodId === selectedWod?.wodId;
    });
  };

  return (
    <div className="score-entry">
      <h1>Score Entry</h1>

      <div className="selection-panel">
        <div className="form-group">
          <label>Select Event</label>
          <select 
            value={selectedEvent?.eventId || ''} 
            onChange={async (e) => {
              const event = events.find(ev => ev.eventId === e.target.value);
              setSelectedEvent(event);
              setSelectedWod(null);
              setSelectedCategory('');
              setWods([]);
              if (event) {
                await fetchWods(event.eventId);
              }
            }}
          >
            <option value="">Choose an event...</option>
            {events.map(event => (
              <option key={event.eventId} value={event.eventId}>
                {event.name} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && wods.length > 0 && (
          <div className="form-group">
            <label>Select Workout</label>
            <select 
              value={selectedWod?.wodId || ''} 
              onChange={(e) => {
                const wod = wods.find(w => w.wodId === e.target.value);
                setSelectedWod(wod);
                setSelectedCategory('');
              }}
            >
              <option value="">Choose a workout...</option>
              {wods.map(wod => (
                <option key={wod.wodId} value={wod.wodId}>
                  {wod.name} ({wod.scoringType})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedWod && (
          <div className="form-group">
            <label>Select Category</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Choose a category...</option>
              {categories.map(category => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.name} ({category.ageRange}, {category.gender})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedEvent && selectedWod && selectedCategory && (
        <div className="workout-info">
          <h2>{selectedWod.name}</h2>
          <p><strong>Format:</strong> {selectedWod.format}</p>
          <p><strong>Description:</strong> {selectedWod.description}</p>
          <p><strong>Category:</strong> {categories.find(c => c.categoryId === selectedCategory)?.name}</p>
          <p><strong>Available Athletes:</strong> {getFilteredAthletes().length}</p>
        </div>
      )}

      {selectedEvent && selectedWod && selectedCategory && (
        <div className="score-form-section">
          <h3>Enter Score</h3>
          <form onSubmit={handleSubmitScore} className="score-form">
            <div className="form-group">
              <label>Search Athlete</label>
              <input 
                type="text"
                placeholder="Search by name or alias..."
                value={athleteSearch}
                onChange={(e) => setAthleteSearch(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>Athlete</label>
              <select 
                value={scoreForm.athleteId} 
                onChange={(e) => setScoreForm({...scoreForm, athleteId: e.target.value})}
                required
              >
                <option value="">Select athlete...</option>
                {getFilteredAthletes().map(athlete => {
                  const existingScore = getAthleteScoreForWod(athlete.athleteId);
                  return (
                    <option key={athlete.athleteId} value={athlete.athleteId}>
                      {athlete.firstName} {athlete.lastName} 
                      {athlete.alias && ` (${athlete.alias})`}
                      {existingScore && ' ✓ Has Score'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Score</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={scoreForm.score} 
                  onChange={(e) => setScoreForm({...scoreForm, score: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Time (optional)</label>
                <input 
                  type="text" 
                  placeholder="MM:SS"
                  value={scoreForm.time} 
                  onChange={(e) => setScoreForm({...scoreForm, time: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Reps (optional)</label>
                <input 
                  type="number" 
                  value={scoreForm.reps} 
                  onChange={(e) => setScoreForm({...scoreForm, reps: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn">
              {scoreForm.athleteId && getAthleteScoreForWod(scoreForm.athleteId) ? 'Update Score' : 'Submit Score'}
            </button>
          </form>
        </div>
      )}

      {selectedEvent && selectedWod && selectedCategory && scores.length > 0 && (
        <div className="current-scores">
          <h3>Current Scores for {selectedWod.name}</h3>
          <div className="scores-table">
            <div className="table-header">
              <span>Athlete</span>
              <span>Score</span>
              <span>Time</span>
              <span>Reps</span>
            </div>
            {scores
              .filter(score => {
                const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
                const athlete = athletes.find(a => a.athleteId === actualAthleteId);
                return athlete?.categoryId === selectedCategory;
              })
              .sort((a, b) => b.score - a.score)
              .map((score) => {
                const actualAthleteId = score.originalAthleteId || (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
                const athlete = athletes.find(a => a.athleteId === actualAthleteId);
                return (
                  <div key={score.athleteId} className="table-row">
                    <span>
                      {athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Unknown'}
                      {athlete?.alias && ` (${athlete.alias})`}
                    </span>
                    <span>{score.score}</span>
                    <span>{score.time || '-'}</span>
                    <span>{score.reps || '-'}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScoreEntry;
