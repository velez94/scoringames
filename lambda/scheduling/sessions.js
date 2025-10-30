const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const SESSION_TTL_HOURS = 24; // Sessions expire after 24 hours

exports.handler = async (event) => {
  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;

  try {
    // Create session
    if (path === '/sessions' && method === 'POST') {
      const body = JSON.parse(event.body);
      const sessionId = randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const ttl = now + (SESSION_TTL_HOURS * 3600);

      const session = {
        sessionId,
        userId,
        deviceInfo: body.deviceInfo || {},
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.requestContext?.identity?.userAgent,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ttl,
      };

      await ddb.send(new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: session,
      }));

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ sessionId, expiresAt: new Date(ttl * 1000).toISOString() }),
      };
    }

    // Get session
    if (path.match(/^\/sessions\/[^/]+$/) && method === 'GET') {
      const sessionId = path.split('/')[2];

      const { Item } = await ddb.send(new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
      }));

      if (!Item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Session not found or expired' }),
        };
      }

      // Update last activity
      await ddb.send(new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: {
          ...Item,
          lastActivity: new Date().toISOString(),
        },
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Item),
      };
    }

    // Get user's active sessions
    if (path === '/sessions' && method === 'GET') {
      const { Items } = await ddb.send(new QueryCommand({
        TableName: SESSIONS_TABLE,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Items || []),
      };
    }

    // Delete session (logout)
    if (path.match(/^\/sessions\/[^/]+$/) && method === 'DELETE') {
      const sessionId = path.split('/')[2];

      await ddb.send(new DeleteCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
      }));

      return {
        statusCode: 204,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: '',
      };
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Route not found' }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: error.message }),
    };
  }
};
