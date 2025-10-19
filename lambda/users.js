const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, QueryCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./utils/logger');

// Version: 1.3 - Added structured logging

const clientConfig = process.env.DYNAMODB_ENDPOINT 
  ? { endpoint: process.env.DYNAMODB_ENDPOINT, region: 'us-east-2' }
  : {};

const client = new DynamoDBClient(clientConfig);
const ddb = DynamoDBDocumentClient.from(client);

const ATHLETES_TABLE = process.env.ATHLETES_TABLE || 'athletes';
const ATHLETE_EVENTS_TABLE = process.env.ATHLETE_EVENTS_TABLE || 'athlete-events';

exports.handler = async (event) => {
  logger.info('Request received', {
    path: event.path,
    method: event.httpMethod,
    resource: event.resource,
  });
  
  const path = event.path || event.resource;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;
  
  // Extract the actual path after /users, /me, or /athletes
  const pathParts = path.split('/').filter(p => p);
  const basePath = pathParts[0]; // users, me, or athletes
  const restPath = '/' + pathParts.slice(1).join('/');
  
  try {
    // Register athlete for competition
    if (restPath.match(/^\/[^/]+\/competitions$/) && method === 'POST') {
      const athleteId = pathParts[pathParts.length - 2];
      const body = JSON.parse(event.body);
      
      const item = {
        userId: athleteId,
        eventId: body.eventId,
        categoryId: body.categoryId || '',
        registeredAt: new Date().toISOString(),
        status: 'registered'
      };
      
      await ddb.send(new PutCommand({
        TableName: ATHLETE_EVENTS_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
      };
    }

    // Get athlete competitions - handle both /athletes/{id}/competitions and /users/athletes/{id}/competitions
    if (restPath.match(/^\/[^/]+\/competitions$/) && method === 'GET') {
      const athleteId = pathParts[pathParts.length - 2];
      
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ATHLETE_EVENTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': athleteId
        }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Items || [])
      };
    }

    // Delete athlete competition registration - /athletes/{id}/competitions/{eventId}
    if (restPath.match(/^\/[^/]+\/competitions\/[^/]+$/) && method === 'DELETE') {
      const athleteId = pathParts[pathParts.length - 3];
      const eventId = pathParts[pathParts.length - 1];
      
      await ddb.send(new DeleteCommand({
        TableName: ATHLETE_EVENTS_TABLE,
        Key: {
          userId: athleteId,
          eventId: eventId
        }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Registration deleted successfully' })
      };
    }
    
    // Legacy route: /athletes - return all athletes or filter by eventId
    if ((path === '/athletes' || restPath === '/') && method === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      
      logger.info('Athletes request', { eventId, queryStringParameters: event.queryStringParameters });
      
      if (eventId) {
        // Get registered athletes for specific event - use scan since GSI might not have all items
        const { Items: registrations } = await ddb.send(new ScanCommand({
          TableName: ATHLETE_EVENTS_TABLE,
          FilterExpression: 'eventId = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }));
        
        logger.info('Registrations found', { eventId, registrationsCount: registrations?.length, registrations });
        
        if (!registrations || registrations.length === 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify([])
          };
        }
        
        // Get athlete details for registered athletes
        const athletePromises = registrations.map(reg => 
          ddb.send(new GetCommand({
            TableName: ATHLETES_TABLE,
            Key: { userId: reg.userId }
          }))
        );
        
        const athleteResults = await Promise.all(athletePromises);
        logger.info('Athlete results', { athleteResultsCount: athleteResults.length, athleteResults: athleteResults.map(r => ({ found: !!r.Item, userId: r.Item?.userId })) });
        
        const athletes = athleteResults
          .filter(result => result.Item)
          .map(result => ({
            ...result.Item,
            athleteId: result.Item.userId, // Add alias
            registrationDate: registrations.find(r => r.userId === result.Item.userId)?.registeredAt || 
                             registrations.find(r => r.userId === result.Item.userId)?.registrationDate,
            categoryId: registrations.find(r => r.userId === result.Item.userId)?.categoryId
          }));
        
        logger.info('Final athletes', { athletesCount: athletes.length, athletes: athletes.map(a => ({ userId: a.userId, firstName: a.firstName, lastName: a.lastName })) });
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(athletes)
        };
      }
      
      // Return all athletes if no eventId specified
      const { Items } = await ddb.send(new ScanCommand({
        TableName: ATHLETES_TABLE
      }));
      
      // Add athleteId alias for backward compatibility
      const athletes = (Items || []).map(athlete => ({
        ...athlete,
        athleteId: athlete.userId // Add alias
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(athletes)
      };
    }

    // Create athlete
    if ((path === '/athletes' || restPath === '/') && method === 'POST') {
      const body = JSON.parse(event.body);
      
      const item = {
        userId: body.athleteId || userId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        alias: body.alias || '',
        categoryId: body.categoryId || '',
        age: body.age || 0,
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: body.updatedAt || new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: ATHLETES_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
      };
    }
    
    // Update athlete profile - /athletes/{id}
    if (restPath.match(/^\/[^/]+$/) && restPath !== '/' && method === 'PUT') {
      const athleteId = pathParts[pathParts.length - 1];
      const body = JSON.parse(event.body);
      
      const item = {
        ...body,
        userId: athleteId,
        updatedAt: new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: ATHLETES_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
      };
    }
    
    // Get specific athlete
    if (restPath.match(/^\/[^/]+$/) && restPath !== '/' && method === 'GET') {
      const athleteId = pathParts[pathParts.length - 1];
      const { Item } = await ddb.send(new GetCommand({
        TableName: ATHLETES_TABLE,
        Key: { userId: athleteId }
      }));
      
      return {
        statusCode: Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Item || { message: 'Athlete not found' })
      };
    }
    
    // Get current user profile
    if ((path === '/me' || basePath === 'me') && method === 'GET') {
      const { Item } = await ddb.send(new GetCommand({
        TableName: ATHLETES_TABLE,
        Key: { userId }
      }));
      
      return {
        statusCode: Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Item || { message: 'Profile not found' })
      };
    }
    
    // Get user's competitions
    if (path === '/me/competitions' && method === 'GET') {
      const { Items } = await ddb.send(new ScanCommand({
        TableName: ATHLETE_EVENTS_TABLE,
        FilterExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': userId
        }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ competitions: Items || [] })
      };
    }
    
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Route not found', path, method })
    };
    
  } catch (error) {
    logger.error('Request failed', error, {
      path: event.path,
      method: event.httpMethod,
    });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: error.message })
    };
  }
};
