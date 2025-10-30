const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const SCORES_TABLE = process.env.SCORES_TABLE;
const ATHLETES_TABLE = process.env.ATHLETES_TABLE;

exports.handler = async (event) => {
  console.log('Leaderboard calculation triggered:', JSON.stringify(event, null, 2));

  try {
    // Extract event details from EventBridge event
    const { eventId, athleteId, workoutId } = event.detail;
    
    if (!eventId) {
      console.log('No eventId in event detail, skipping leaderboard calculation');
      return;
    }

    // Recalculate leaderboard for the specific event
    await calculateEventLeaderboard(eventId);
    
    console.log(`Leaderboard recalculated for event: ${eventId}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Leaderboard calculation completed',
        eventId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error calculating leaderboard:', error);
    throw error;
  }
};

async function calculateEventLeaderboard(eventId) {
  try {
    // Get all scores for the event
    const scoresParams = {
      TableName: SCORES_TABLE,
      FilterExpression: 'eventId = :eventId',
      ExpressionAttributeValues: {
        ':eventId': eventId
      }
    };

    const scoresResult = await dynamodb.send(new ScanCommand(scoresParams));
    const scores = scoresResult.Items || [];

    if (scores.length === 0) {
      console.log(`No scores found for event ${eventId}`);
      return;
    }

    // Get all athletes
    const athletesResult = await dynamodb.send(new ScanCommand({
      TableName: ATHLETES_TABLE
    }));
    const athletes = athletesResult.Items || [];

    // Calculate points-based leaderboard
    const athletePoints = {};
    
    // Group scores by workout
    const workoutScores = {};
    scores.forEach(score => {
      if (!workoutScores[score.workoutId]) {
        workoutScores[score.workoutId] = [];
      }
      workoutScores[score.workoutId].push(score);
    });

    // Calculate points for each workout
    Object.values(workoutScores).forEach(wodScores => {
      // Sort by score (descending - higher is better)
      const sortedScores = wodScores.sort((a, b) => b.score - a.score);
      
      // Assign points: 1st = 100, 2nd = 99, etc.
      sortedScores.forEach((score, index) => {
        const points = Math.max(100 - index, 1);
        const actualAthleteId = score.originalAthleteId || 
          (score.athleteId.includes('#') ? score.athleteId.split('#')[0] : score.athleteId);
        
        if (!athletePoints[actualAthleteId]) {
          const athlete = athletes.find(a => a.athleteId === actualAthleteId);
          athletePoints[actualAthleteId] = {
            athleteId: actualAthleteId,
            totalPoints: 0,
            workoutCount: 0,
            categoryId: athlete?.categoryId
          };
        }
        
        athletePoints[actualAthleteId].totalPoints += points;
        athletePoints[actualAthleteId].workoutCount += 1;
      });
    });

    // Store leaderboard results (could be cached in DynamoDB or ElastiCache)
    console.log(`Calculated leaderboard for ${Object.keys(athletePoints).length} athletes in event ${eventId}`);
    
    // Optional: Store calculated leaderboard in a separate table for caching
    // This would improve read performance for leaderboard queries
    
  } catch (error) {
    console.error('Error in calculateEventLeaderboard:', error);
    throw error;
  }
}
