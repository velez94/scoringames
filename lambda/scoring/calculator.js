// Stateless score calculation engine
// Pure function: input (rawData, scoringSystem) → output (calculatedScore)

exports.calculateScore = (rawData, scoringSystem) => {
  if (scoringSystem.type === 'classic') {
    return calculateClassicScore(rawData, scoringSystem.config);
  } else if (scoringSystem.type === 'advanced') {
    return calculateAdvancedScore(rawData, scoringSystem.config);
  }
  
  throw new Error(`Unknown scoring system type: ${scoringSystem.type}`);
};

function calculateClassicScore(rawData, config) {
  const baseScore = config.baseScore || 100;
  const decrement = config.decrement || 1;
  const rank = rawData.rank || 1;
  
  const calculatedScore = Math.max(0, baseScore - ((rank - 1) * decrement));
  
  return {
    calculatedScore,
    breakdown: {
      baseScore,
      rank,
      decrement,
      formula: `${baseScore} - ((${rank} - 1) × ${decrement})`
    }
  };
}

function calculateAdvancedScore(rawData, config) {
  let totalEDS = 0;
  const exerciseBreakdown = [];
  
  // Calculate EDS × EQS for each exercise
  rawData.exercises?.forEach(exercise => {
    const exerciseDef = config.exercises?.find(e => e.exerciseId === exercise.exerciseId);
    
    if (!exerciseDef) {
      console.warn(`Exercise ${exercise.exerciseId} not found in config`);
      return;
    }
    
    let eds = exerciseDef.baseScore * (exercise.reps || 1);
    
    // Apply modifiers (weight, deadstop, etc.)
    exerciseDef.modifiers?.forEach(mod => {
      if (mod.type === 'weight' && exercise.weight) {
        const weightBonus = Math.floor(exercise.weight / mod.increment) * mod.points;
        eds += weightBonus * (exercise.reps || 1);
      } else if (mod.type === 'deadstop' && exercise.deadstop) {
        eds += mod.points * (exercise.reps || 1);
      } else if (mod.type === 'hold' && exercise.timeHeld) {
        const holdBonus = Math.floor(exercise.timeHeld / mod.increment) * mod.points;
        eds += holdBonus;
      }
    });
    
    // Apply EQS multiplier (1-5 scale)
    const eqs = exercise.eqs || 5;
    const exerciseScore = eds * eqs;
    
    totalEDS += exerciseScore;
    
    exerciseBreakdown.push({
      exerciseId: exercise.exerciseId,
      exerciseName: exerciseDef.name,
      reps: exercise.reps,
      weight: exercise.weight,
      eqs,
      eds,
      score: exerciseScore
    });
  });
  
  // Add time bonus
  const timeBonuses = config.timeBonuses || { 1: 10, 2: 7, 3: 5 };
  const rank = rawData.rank || 0;
  const timeBonus = timeBonuses[rank] || (rawData.completedInTime ? 2 : 0);
  
  const calculatedScore = totalEDS + timeBonus;
  
  return {
    calculatedScore,
    breakdown: {
      totalEDS,
      timeBonus,
      rank,
      exercises: exerciseBreakdown,
      formula: 'Σ(EDS × EQS) + TB'
    }
  };
}

// Lambda handler for direct invocation
exports.handler = async (event) => {
  try {
    const { rawData, scoringSystem } = event;
    
    const result = exports.calculateScore(rawData, scoringSystem);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Calculation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};
