const { calculateScore } = require('../calculator');

describe('Score Calculator', () => {
  describe('Classic Mode', () => {
    it('should calculate rank-based score', () => {
      const scoringSystem = {
        type: 'classic',
        config: { baseScore: 100, decrement: 1 }
      };
      const rawData = { rank: 3 };
      
      const result = calculateScore(rawData, scoringSystem);
      expect(result.calculatedScore).toBe(98); // 100 - (3-1)*1
      expect(result.breakdown.formula).toBeDefined();
    });
  });

  describe('Advanced Mode', () => {
    it('should calculate EDS × EQS score', () => {
      const scoringSystem = {
        type: 'advanced',
        config: {
          exercises: [{
            exerciseId: 'ex-1',
            name: 'Test Exercise',
            baseScore: 5,
            modifiers: []
          }],
          timeBonuses: { '1': 10 }
        }
      };
      const rawData = {
        exercises: [{ exerciseId: 'ex-1', reps: 5, eqs: 4 }],
        rank: 1
      };
      
      const result = calculateScore(rawData, scoringSystem);
      expect(result.calculatedScore).toBe(110); // (5*5)*4 + 10
      expect(result.breakdown.totalEDS).toBe(100);
      expect(result.breakdown.timeBonus).toBe(10);
    });
  });
});
