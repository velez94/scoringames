const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class ScoreService {
  constructor(dynamoClient) {
    this.dynamodb = dynamoClient;
    this.scoresTable = process.env.SCORES_TABLE;
  }

  async getAthleteScores(athleteIds, filterId) {
    const scores = [];
    
    for (const athleteId of athleteIds) {
      try {
        const { Items } = await this.dynamodb.send(new QueryCommand({
          TableName: this.scoresTable,
          IndexName: 'athlete-scores-index',
          KeyConditionExpression: 'athleteId = :athleteId',
          FilterExpression: 'filterId = :filterId',
          ExpressionAttributeValues: {
            ':athleteId': athleteId,
            ':filterId': filterId
          }
        }));

        if (Items && Items.length > 0) {
          // Get the latest/best score for this athlete in this filter
          const bestScore = Items.reduce((best, current) => 
            current.score > best.score ? current : best
          );
          
          scores.push({
            athleteId,
            score: bestScore.score,
            submittedAt: bestScore.submittedAt
          });
        } else {
          // No score found, assign lowest possible score
          scores.push({
            athleteId,
            score: 0,
            submittedAt: null
          });
        }
      } catch (error) {
        console.error(`Error getting scores for athlete ${athleteId}:`, error);
        scores.push({
          athleteId,
          score: 0,
          submittedAt: null
        });
      }
    }

    return scores;
  }

  async getMatchResults(eventId, filterId) {
    try {
      const { Items } = await this.dynamodb.send(new QueryCommand({
        TableName: this.scoresTable,
        KeyConditionExpression: 'eventId = :eventId',
        FilterExpression: 'filterId = :filterId',
        ExpressionAttributeValues: {
          ':eventId': eventId,
          ':filterId': filterId
        }
      }));

      // Group scores by match and determine winners
      const matchResults = {};
      
      for (const score of Items || []) {
        const matchId = score.matchId;
        if (!matchResults[matchId]) {
          matchResults[matchId] = [];
        }
        matchResults[matchId].push({
          athleteId: score.athleteId,
          score: score.score,
          submittedAt: score.submittedAt
        });
      }

      // Determine winners for each match
      const results = [];
      for (const [matchId, scores] of Object.entries(matchResults)) {
        if (scores.length === 2) {
          const [athlete1, athlete2] = scores;
          const winner = athlete1.score > athlete2.score ? athlete1 : athlete2;
          const loser = athlete1.score > athlete2.score ? athlete2 : athlete1;
          
          results.push({
            matchId,
            winnerId: winner.athleteId,
            loserId: loser.athleteId,
            winnerScore: winner.score,
            loserScore: loser.score
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting match results:', error);
      return [];
    }
  }
}

module.exports = { ScoreService };
