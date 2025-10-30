const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const LEADERBOARD_TABLE = process.env.LEADERBOARD_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;

exports.handler = async (event) => {
  console.log('Leaderboard API:', JSON.stringify(event, null, 2));
  
  const path = event.path;
  const method = event.httpMethod;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET /leaderboard?eventId={id}&wodId={id}&categoryId={id}
    if (path === '/leaderboard' && method === 'GET') {
      const { eventId, wodId, categoryId } = event.queryStringParameters || {};
      
      if (!eventId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'eventId is required' })
        };
      }

      const leaderboardId = `${eventId}_${wodId || 'all'}_${categoryId || 'all'}`;
      
      // Try to get cached leaderboard
      const { Item: cached } = await ddb.send(new GetCommand({
        TableName: LEADERBOARD_TABLE,
        Key: { leaderboardId }
      }));

      if (cached && cached.leaderboard) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            leaderboard: cached.leaderboard,
            cached: true,
            updatedAt: cached.updatedAt
          })
        };
      }

      // Fallback: Calculate on-the-fly
      const { Items: scores } = await ddb.send(new QueryCommand({
        TableName: SCORES_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        FilterExpression: buildFilterExpression(wodId, categoryId),
        ExpressionAttributeValues: buildExpressionValues(eventId, wodId, categoryId)
      }));

      const sorted = (scores || []).sort((a, b) => {
        const scoreA = typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0;
        const scoreB = typeof b.score === 'number' ? b.score : parseFloat(b.score) || 0;
        return scoreB - scoreA;
      });

      const leaderboard = sorted.map((score, idx) => ({
        rank: idx + 1,
        athleteId: score.athleteId,
        score: score.score,
        breakdown: score.breakdown,
        scoringSystemId: score.scoringSystemId
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          leaderboard,
          cached: false
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};

function buildFilterExpression(wodId, categoryId) {
  const filters = [];
  if (wodId) filters.push('wodId = :wodId');
  if (categoryId) filters.push('categoryId = :categoryId');
  return filters.length > 0 ? filters.join(' AND ') : undefined;
}

function buildExpressionValues(eventId, wodId, categoryId) {
  const values = { ':eventId': eventId };
  if (wodId) values[':wodId'] = wodId;
  if (categoryId) values[':categoryId'] = categoryId;
  return values;
}
