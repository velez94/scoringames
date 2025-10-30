const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Extract user info
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.claims?.email;

  if (!userId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ message: 'Unauthorized' })
    };
  }

  try {
    const method = event.httpMethod;
    const path = event.path;
    
    // Extract eventId from path
    const pathParts = path.split('/').filter(p => p);
    const eventId = pathParts[1]; // /scheduler/{eventId}

    // GET /scheduler/{eventId} - Get schedules for event
    if (method === 'GET' && eventId) {
      if (!SCHEDULES_TABLE) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ message: 'Schedules table not configured' })
        };
      }

      const { Items } = await ddb.send(new QueryCommand({
        TableName: SCHEDULES_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': eventId
        }
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(Items || [])
      };
    }

    // Default response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Scheduler service', eventId })
    };

  } catch (error) {
    console.error('Scheduler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
