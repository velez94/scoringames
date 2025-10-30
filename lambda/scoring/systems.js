const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const SCORING_SYSTEMS_TABLE = process.env.SCORING_SYSTEMS_TABLE;

exports.handler = async (event) => {
  console.log('Scoring Systems Service:', JSON.stringify(event, null, 2));
  
  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;
  
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: ''
    };
  }
  
  try {
    // POST /events/{eventId}/scoring-systems - Create scoring system
    if (path.match(/^\/events\/[^/]+\/scoring-systems$/) && method === 'POST') {
      const eventId = path.split('/')[2];
      const body = JSON.parse(event.body);
      
      const scoringSystemId = `sys-${Date.now()}`;
      const item = {
        eventId,
        scoringSystemId,
        name: body.name,
        type: body.type, // 'classic' | 'advanced'
        config: body.config,
        createdBy: userId,
        createdAt: new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: SCORING_SYSTEMS_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
      };
    }
    
    // GET /events/{eventId}/scoring-systems - List scoring systems
    if (path.match(/^\/events\/[^/]+\/scoring-systems$/) && method === 'GET') {
      const eventId = path.split('/')[2];
      
      const { Items } = await ddb.send(new QueryCommand({
        TableName: SCORING_SYSTEMS_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Items || [])
      };
    }
    
    // GET /events/{eventId}/scoring-systems/{id} - Get scoring system
    if (path.match(/^\/events\/[^/]+\/scoring-systems\/[^/]+$/) && method === 'GET') {
      const [, , eventId, , scoringSystemId] = path.split('/');
      
      const { Item } = await ddb.send(new GetCommand({
        TableName: SCORING_SYSTEMS_TABLE,
        Key: { eventId, scoringSystemId }
      }));
      
      return {
        statusCode: Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Item || { message: 'Scoring system not found' })
      };
    }
    
    // PUT /events/{eventId}/scoring-systems/{id} - Update scoring system
    if (path.match(/^\/events\/[^/]+\/scoring-systems\/[^/]+$/) && method === 'PUT') {
      const [, , eventId, , scoringSystemId] = path.split('/');
      const body = JSON.parse(event.body);
      
      const updateExpr = [];
      const exprAttrNames = {};
      const exprAttrValues = {};
      
      if (body.name) {
        updateExpr.push('#name = :name');
        exprAttrNames['#name'] = 'name';
        exprAttrValues[':name'] = body.name;
      }
      
      if (body.config) {
        updateExpr.push('#config = :config');
        exprAttrNames['#config'] = 'config';
        exprAttrValues[':config'] = body.config;
      }
      
      await ddb.send(new UpdateCommand({
        TableName: SCORING_SYSTEMS_TABLE,
        Key: { eventId, scoringSystemId },
        UpdateExpression: `SET ${updateExpr.join(', ')}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Scoring system updated' })
      };
    }
    
    // DELETE /events/{eventId}/scoring-systems/{id} - Delete scoring system
    if (path.match(/^\/events\/[^/]+\/scoring-systems\/[^/]+$/) && method === 'DELETE') {
      const [, , eventId, , scoringSystemId] = path.split('/');
      
      await ddb.send(new DeleteCommand({
        TableName: SCORING_SYSTEMS_TABLE,
        Key: { eventId, scoringSystemId }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Scoring system deleted' })
      };
    }
    
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Not found' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: error.message })
    };
  }
};
