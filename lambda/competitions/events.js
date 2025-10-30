const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const lambdaClient = new LambdaClient({});

const EVENT_DAYS_TABLE = process.env.EVENT_DAYS_TABLE;

exports.handler = async (event) => {
  console.log('Event Days Service:', JSON.stringify(event, null, 2));
  
  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.claims?.email;
  
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
  
  // Check authentication for non-OPTIONS requests
  if (!userId) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Unauthorized' })
    };
  }
  
  try {
    // Proxy scoring-systems requests to scoring-systems Lambda
    if (path.match(/^\/events\/[^/]+\/scoring-systems/)) {
      const invokeParams = {
        FunctionName: process.env.SCORING_SYSTEMS_LAMBDA_NAME,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(event)
      };
      
      const response = await lambdaClient.send(new InvokeCommand(invokeParams));
      const payload = JSON.parse(Buffer.from(response.Payload).toString());
      return payload;
    }
    
    // Get event days for a specific event
    if (path.match(/^\/events\/[^/]+\/days$/) && method === 'GET') {
      const eventId = path.split('/')[2];
      
      const { Items } = await ddb.send(new QueryCommand({
        TableName: EVENT_DAYS_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': eventId
        }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Items || [])
      };
    }
    
    // Get specific event day
    if (path.match(/^\/events\/[^/]+\/days\/[^/]+$/) && method === 'GET') {
      const [, , eventId, , dayId] = path.split('/');
      
      const { Item } = await ddb.send(new GetCommand({
        TableName: EVENT_DAYS_TABLE,
        Key: { eventId, dayId }
      }));
      
      return {
        statusCode: Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Item || { message: 'Event day not found' })
      };
    }
    
    // Create event day
    if (path.match(/^\/events\/[^/]+\/days$/) && method === 'POST') {
      const eventId = path.split('/')[2];
      const body = JSON.parse(event.body);
      const dayId = body.dayId || `day-${Date.now()}`;
      
      const item = {
        eventId,
        dayId,
        name: body.name,
        date: body.date,
        description: body.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: EVENT_DAYS_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
      };
    }
    
    // Update event day
    if (path.match(/^\/events\/[^/]+\/days\/[^/]+$/) && method === 'PUT') {
      const [, , eventId, , dayId] = path.split('/');
      const body = JSON.parse(event.body);
      
      const updateExpr = [];
      const exprAttrNames = {};
      const exprAttrValues = {};
      
      Object.keys(body).forEach(key => {
        if (key !== 'eventId' && key !== 'dayId') {
          updateExpr.push(`#${key} = :${key}`);
          exprAttrNames[`#${key}`] = key;
          exprAttrValues[`:${key}`] = body[key];
        }
      });
      
      exprAttrNames['#updatedAt'] = 'updatedAt';
      exprAttrValues[':updatedAt'] = new Date().toISOString();
      updateExpr.push('#updatedAt = :updatedAt');
      
      await ddb.send(new UpdateCommand({
        TableName: EVENT_DAYS_TABLE,
        Key: { eventId, dayId },
        UpdateExpression: `SET ${updateExpr.join(', ')}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Event day updated' })
      };
    }
    
    // Delete event day
    if (path.match(/^\/events\/[^/]+\/days\/[^/]+$/) && method === 'DELETE') {
      const [, , eventId, , dayId] = path.split('/');
      
      await ddb.send(new DeleteCommand({
        TableName: EVENT_DAYS_TABLE,
        Key: { eventId, dayId }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Event day deleted' })
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
