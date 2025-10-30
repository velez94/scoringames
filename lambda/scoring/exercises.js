const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const EXERCISE_LIBRARY_TABLE = process.env.EXERCISE_LIBRARY_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  console.log('Exercise Library Service:', JSON.stringify(event, null, 2));
  
  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;
  
  try {
    // GET /exercises - List all exercises
    if (path === '/exercises' && method === 'GET') {
      const { Items } = await ddb.send(new ScanCommand({
        TableName: EXERCISE_LIBRARY_TABLE
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(Items || [])
      };
    }
    
    // POST /exercises - Create exercise
    if (path === '/exercises' && method === 'POST') {
      const body = JSON.parse(event.body);
      
      const exerciseId = `ex-${Date.now()}`;
      const item = {
        exerciseId,
        name: body.name,
        category: body.category, // 'strength', 'endurance', 'skill'
        baseScore: body.baseScore,
        modifiers: body.modifiers || [], // [{ type: 'weight', unit: 'kg', increment: 5, points: 1 }]
        isGlobal: body.isGlobal !== false,
        createdBy: userId,
        createdAt: new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: EXERCISE_LIBRARY_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
      };
    }
    
    // GET /exercises/{id} - Get exercise
    if (path.match(/^\/exercises\/[^/]+$/) && method === 'GET') {
      const exerciseId = path.split('/')[2];
      
      const { Item } = await ddb.send(new GetCommand({
        TableName: EXERCISE_LIBRARY_TABLE,
        Key: { exerciseId }
      }));
      
      return {
        statusCode: Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Item || { message: 'Exercise not found' })
      };
    }
    
    // PUT /exercises/{id} - Update exercise
    if (path.match(/^\/exercises\/[^/]+$/) && method === 'PUT') {
      const exerciseId = path.split('/')[2];
      const body = JSON.parse(event.body);
      
      const updateExpr = [];
      const exprAttrNames = {};
      const exprAttrValues = {};
      
      if (body.name) {
        updateExpr.push('#name = :name');
        exprAttrNames['#name'] = 'name';
        exprAttrValues[':name'] = body.name;
      }
      
      if (body.baseScore !== undefined) {
        updateExpr.push('#baseScore = :baseScore');
        exprAttrNames['#baseScore'] = 'baseScore';
        exprAttrValues[':baseScore'] = body.baseScore;
      }
      
      if (body.modifiers) {
        updateExpr.push('#modifiers = :modifiers');
        exprAttrNames['#modifiers'] = 'modifiers';
        exprAttrValues[':modifiers'] = body.modifiers;
      }
      
      await ddb.send(new UpdateCommand({
        TableName: EXERCISE_LIBRARY_TABLE,
        Key: { exerciseId },
        UpdateExpression: `SET ${updateExpr.join(', ')}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Exercise updated' })
      };
    }
    
    // DELETE /exercises/{id} - Delete exercise
    if (path.match(/^\/exercises\/[^/]+$/) && method === 'DELETE') {
      const exerciseId = path.split('/')[2];
      
      await ddb.send(new DeleteCommand({
        TableName: EXERCISE_LIBRARY_TABLE,
        Key: { exerciseId }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Exercise deleted' })
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
