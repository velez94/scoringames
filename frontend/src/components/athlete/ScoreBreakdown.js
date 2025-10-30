import React from 'react';

function ScoreBreakdown({ score }) {
  if (!score.breakdown) {
    return (
      <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
        <strong>Score:</strong> {score.score}
      </div>
    );
  }

  const { breakdown } = score;

  return (
    <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 15px 0'}}>Score Breakdown</h4>
      
      {breakdown.formula && (
        <div style={{marginBottom: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px'}}>
          <strong>Formula:</strong> {breakdown.formula}
        </div>
      )}

      {breakdown.exercises && (
        <div style={{marginBottom: '15px'}}>
          <strong>Exercises:</strong>
          <table style={{width: '100%', marginTop: '10px', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{background: '#e0e0e0'}}>
                <th style={{padding: '8px', textAlign: 'left'}}>Exercise</th>
                <th style={{padding: '8px', textAlign: 'center'}}>Reps</th>
                <th style={{padding: '8px', textAlign: 'center'}}>Weight</th>
                <th style={{padding: '8px', textAlign: 'center'}}>EQS</th>
                <th style={{padding: '8px', textAlign: 'right'}}>Score</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.exercises.map((ex, idx) => (
                <tr key={idx} style={{borderBottom: '1px solid #ddd'}}>
                  <td style={{padding: '8px'}}>{ex.exerciseName}</td>
                  <td style={{padding: '8px', textAlign: 'center'}}>{ex.reps || '-'}</td>
                  <td style={{padding: '8px', textAlign: 'center'}}>{ex.weight ? `${ex.weight}kg` : '-'}</td>
                  <td style={{padding: '8px', textAlign: 'center'}}>{ex.eqs}/5</td>
                  <td style={{padding: '8px', textAlign: 'right', fontWeight: 'bold'}}>{ex.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '15px'}}>
        {breakdown.totalEDS !== undefined && (
          <div style={{padding: '10px', background: 'white', borderRadius: '4px', textAlign: 'center'}}>
            <div style={{fontSize: '12px', color: '#666'}}>Total EDS</div>
            <div style={{fontSize: '20px', fontWeight: 'bold', color: '#2196f3'}}>{breakdown.totalEDS}</div>
          </div>
        )}
        
        {breakdown.timeBonus !== undefined && (
          <div style={{padding: '10px', background: 'white', borderRadius: '4px', textAlign: 'center'}}>
            <div style={{fontSize: '12px', color: '#666'}}>Time Bonus</div>
            <div style={{fontSize: '20px', fontWeight: 'bold', color: '#4caf50'}}>+{breakdown.timeBonus}</div>
          </div>
        )}
        
        <div style={{padding: '10px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '4px', textAlign: 'center', color: 'white'}}>
          <div style={{fontSize: '12px'}}>Final Score</div>
          <div style={{fontSize: '24px', fontWeight: 'bold'}}>{score.score}</div>
        </div>
      </div>

      {breakdown.rank && (
        <div style={{marginTop: '10px', textAlign: 'center', color: '#666'}}>
          Rank: {breakdown.rank}
        </div>
      )}
    </div>
  );
}

export default ScoreBreakdown;
