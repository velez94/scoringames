import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useAuthenticator } from '@aws-amplify/ui-react';

function ExerciseLibraryManager() {
  const { user } = useAuthenticator((context) => [context.user]);
  const [exercises, setExercises] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'strength',
    baseScore: 1,
    modifiers: []
  });
  const [message, setMessage] = useState('');

  const isSuperAdmin = user?.attributes?.email === 'admin@athleon.fitness';

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const response = await API.get('CalisthenicsAPI', '/exercises');
      setExercises(response);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExercise) {
        await API.put('CalisthenicsAPI', `/exercises/${editingExercise.exerciseId}`, {
          body: formData
        });
        setMessage('✅ Exercise updated successfully');
      } else {
        await API.post('CalisthenicsAPI', '/exercises', {
          body: formData
        });
        setMessage('✅ Exercise created successfully');
      }
      setShowForm(false);
      setEditingExercise(null);
      setFormData({ name: '', category: 'strength', baseScore: 1, modifiers: [] });
      fetchExercises();
    } catch (error) {
      console.error('Error saving exercise:', error);
      setMessage('❌ Error saving exercise');
    }
  };

  const handleEdit = (exercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: exercise.name,
      category: exercise.category,
      baseScore: exercise.baseScore,
      modifiers: exercise.modifiers || []
    });
    setShowForm(true);
  };

  const handleDelete = async (exerciseId) => {
    if (!window.confirm('Delete this exercise?')) return;
    try {
      await API.del('CalisthenicsAPI', `/exercises/${exerciseId}`);
      setMessage('✅ Exercise deleted');
      fetchExercises();
    } catch (error) {
      console.error('Error deleting exercise:', error);
      setMessage('❌ Error deleting exercise');
    }
  };

  const addModifier = () => {
    setFormData({
      ...formData,
      modifiers: [...formData.modifiers, { type: 'weight', unit: 'kg', increment: 5, points: 1 }]
    });
  };

  const updateModifier = (index, field, value) => {
    const newModifiers = [...formData.modifiers];
    newModifiers[index][field] = field === 'increment' || field === 'points' ? Number(value) : value;
    setFormData({ ...formData, modifiers: newModifiers });
  };

  const removeModifier = (index) => {
    setFormData({
      ...formData,
      modifiers: formData.modifiers.filter((_, i) => i !== index)
    });
  };

  const filteredExercises = exercises
    .filter(ex => filter === 'all' || ex.category === filter)
    .filter(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const categoryColors = {
    strength: '#ff9800',
    endurance: '#4caf50',
    skill: '#2196f3'
  };

  return (
    <div style={{padding: '20px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>Exercise Library</h2>
        {isSuperAdmin && (
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingExercise(null);
              setFormData({ name: '', category: 'strength', baseScore: 1, modifiers: [] });
            }}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Cancel' : '+ Add Exercise'}
          </button>
        )}
      </div>

      {message && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          borderRadius: '4px',
          background: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24'
        }}>
          {message}
        </div>
      )}

      {showForm && isSuperAdmin && (
        <form onSubmit={handleSubmit} style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3>{editingExercise ? 'Edit Exercise' : 'Create Exercise'}</h3>
          
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              required
            />
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
            <div>
              <label style={{display: 'block', marginBottom: '5px'}}>Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              >
                <option value="strength">Strength</option>
                <option value="endurance">Endurance</option>
                <option value="skill">Skill</option>
              </select>
            </div>
            <div>
              <label style={{display: 'block', marginBottom: '5px'}}>Base Score *</label>
              <input
                type="number"
                step="0.5"
                value={formData.baseScore}
                onChange={(e) => setFormData({...formData, baseScore: Number(e.target.value)})}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                required
              />
            </div>
          </div>

          <div style={{marginBottom: '15px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
              <label style={{margin: 0}}>Modifiers</label>
              <button
                type="button"
                onClick={addModifier}
                style={{
                  padding: '5px 10px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                + Add Modifier
              </button>
            </div>
            
            {formData.modifiers.map((mod, idx) => (
              <div key={idx} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                gap: '10px',
                marginBottom: '10px',
                padding: '10px',
                background: 'white',
                borderRadius: '4px'
              }}>
                <select
                  value={mod.type}
                  onChange={(e) => updateModifier(idx, 'type', e.target.value)}
                  style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}
                >
                  <option value="weight">Weight</option>
                  <option value="deadstop">Deadstop</option>
                  <option value="hold">Hold</option>
                </select>
                
                {mod.type !== 'deadstop' && (
                  <>
                    <input
                      type="text"
                      placeholder="Unit"
                      value={mod.unit || ''}
                      onChange={(e) => updateModifier(idx, 'unit', e.target.value)}
                      style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}
                    />
                    <input
                      type="number"
                      placeholder="Increment"
                      value={mod.increment || ''}
                      onChange={(e) => updateModifier(idx, 'increment', e.target.value)}
                      style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}
                    />
                  </>
                )}
                
                <input
                  type="number"
                  step="0.5"
                  placeholder="Points"
                  value={mod.points || ''}
                  onChange={(e) => updateModifier(idx, 'points', e.target.value)}
                  style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
                
                <button
                  type="button"
                  onClick={() => removeModifier(idx)}
                  style={{
                    padding: '6px 10px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

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
            {editingExercise ? 'Update Exercise' : 'Create Exercise'}
          </button>
        </form>
      )}
      
      <div style={{marginBottom: '20px'}}>
        <input
          type="text"
          placeholder="🔍 Search exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            marginBottom: '15px'
          }}
        />
      </div>
      
      <div style={{marginBottom: '20px'}}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px',
            margin: '0 5px',
            background: filter === 'all' ? '#667eea' : '#e0e0e0',
            color: filter === 'all' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          All ({exercises.length})
        </button>
        <button
          onClick={() => setFilter('strength')}
          style={{
            padding: '8px 16px',
            margin: '0 5px',
            background: filter === 'strength' ? '#ff9800' : '#e0e0e0',
            color: filter === 'strength' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Strength ({exercises.filter(e => e.category === 'strength').length})
        </button>
        <button
          onClick={() => setFilter('endurance')}
          style={{
            padding: '8px 16px',
            margin: '0 5px',
            background: filter === 'endurance' ? '#4caf50' : '#e0e0e0',
            color: filter === 'endurance' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Endurance ({exercises.filter(e => e.category === 'endurance').length})
        </button>
        <button
          onClick={() => setFilter('skill')}
          style={{
            padding: '8px 16px',
            margin: '0 5px',
            background: filter === 'skill' ? '#2196f3' : '#e0e0e0',
            color: filter === 'skill' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Skill ({exercises.filter(e => e.category === 'skill').length})
        </button>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px'}}>
        {filteredExercises.map(exercise => (
          <div key={exercise.exerciseId} style={{
            background: 'white',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px'}}>
              <h4 style={{margin: 0, flex: 1}}>{exercise.name}</h4>
              <span style={{
                padding: '4px 8px',
                borderRadius: '12px',
                background: categoryColors[exercise.category],
                color: 'white',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                {exercise.category.toUpperCase()}
              </span>
            </div>
            
            <div style={{marginBottom: '8px'}}>
              <strong>Base Score:</strong> {exercise.baseScore} pts
            </div>
            
            {exercise.modifiers && exercise.modifiers.length > 0 && (
              <div style={{marginBottom: '10px'}}>
                <strong>Modifiers:</strong>
                <ul style={{margin: '5px 0', paddingLeft: '20px', fontSize: '14px'}}>
                  {exercise.modifiers.map((mod, idx) => (
                    <li key={idx}>
                      {mod.type === 'weight' && `+${mod.points} pts per ${mod.increment}${mod.unit}`}
                      {mod.type === 'deadstop' && `+${mod.points} pts (deadstop)`}
                      {mod.type === 'hold' && `+${mod.points} pts per ${mod.increment}${mod.unit}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isSuperAdmin && (
              <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                <button
                  onClick={() => handleEdit(exercise)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(exercise.exerciseId)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExerciseLibraryManager;
