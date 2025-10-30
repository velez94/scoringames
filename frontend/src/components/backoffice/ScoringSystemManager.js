import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

function ScoringSystemManager({ eventId }) {
  const [scoringSystems, setScoringSystems] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'classic',
    config: {
      baseScore: 100,
      decrement: 1
    }
  });

  useEffect(() => {
    fetchScoringSystems();
    fetchExercises();
  }, [eventId]);

  const fetchScoringSystems = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', `/events/${eventId}/scoring-systems`);
      setScoringSystems(response);
    } catch (error) {
      console.error('Error fetching scoring systems:', error);
    }
  };

  const fetchExercises = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/exercises');
      setExercises(response);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const createScoringSystem = async (e) => {
    e.preventDefault();
    try {
      await API.post('CalisthenicsAPI', `/events/${eventId}/scoring-systems`, {
        body: formData
      });
      setShowForm(false);
      fetchScoringSystems();
    } catch (error) {
      console.error('Error creating scoring system:', error);
    }
  };

  const deleteScoringSystem = async (scoringSystemId) => {
    if (!window.confirm('Delete this scoring system?')) return;
    try {
      await API.del('CalisthenicsAPI', `/events/${eventId}/scoring-systems/${scoringSystemId}`);
      fetchScoringSystems();
    } catch (error) {
      console.error('Error deleting scoring system:', error);
    }
  };

  return (
    <div style={{padding: '20px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
        <h2>Scoring Systems</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {showForm ? 'Cancel' : 'Create Scoring System'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createScoringSystem} style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              required
            />
          </div>

          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
            >
              <option value="classic">Classic (Rank-based)</option>
              <option value="advanced">Advanced (EDS × EQS + TB)</option>
            </select>
          </div>

          {formData.type === 'classic' && (
            <>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px'}}>Base Score</label>
                <input
                  type="number"
                  value={formData.config.baseScore}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: {...formData.config, baseScore: Number(e.target.value)}
                  })}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px'}}>Decrement per Rank</label>
                <input
                  type="number"
                  value={formData.config.decrement}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: {...formData.config, decrement: Number(e.target.value)}
                  })}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Create
          </button>
        </form>
      )}

      <div style={{display: 'grid', gap: '15px'}}>
        {scoringSystems.map(system => (
          <div key={system.scoringSystemId} style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
              <div>
                <h3 style={{margin: '0 0 10px 0'}}>{system.name}</h3>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  background: system.type === 'classic' ? '#4caf50' : '#2196f3',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  {system.type.toUpperCase()}
                </span>
                {system.type === 'classic' && (
                  <p style={{marginTop: '10px', color: '#666'}}>
                    Base: {system.config.baseScore} | Decrement: {system.config.decrement}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteScoringSystem(system.scoringSystemId)}
                style={{
                  padding: '6px 12px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScoringSystemManager;
