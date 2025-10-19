const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const logger = require('./utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;
const EVENT_IMAGES_BUCKET = process.env.EVENT_IMAGES_BUCKET;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  logger.info('Competitions service request', { 
    method: event.httpMethod, 
    path: event.path,
    pathParameters: event.pathParameters 
  });
  
  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    // Extract path - handle both direct and proxy routing
    let path = event.path || '';
    if (event.pathParameters?.proxy) {
      path = '/' + event.pathParameters.proxy;
    }
    
    // Clean path - remove /competitions prefix if present
    if (path.startsWith('/competitions')) {
      path = path.substring('/competitions'.length);
    }
    
    const method = event.httpMethod;
    const pathParts = path.split('/').filter(p => p); // Remove empty parts
    const eventId = pathParts[0]; // First part after /competitions/
    
    // Parse request body for PUT/POST requests
    let requestBody = {};
    if (event.body && (method === 'PUT' || method === 'POST')) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (e) {
        logger.error('Invalid JSON in request body', { error: e.message });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'Invalid JSON in request body' })
        };
      }
    }
    
    logger.debug('Request processing', { 
      method, 
      originalPath: event.path, 
      cleanedPath: path, 
      pathParts, 
      eventId 
    });
    
    // Public endpoints (no auth required)
    if (path === '/public/events' && method === 'GET') {
      const { Items } = await ddb.send(new ScanCommand({
        TableName: EVENTS_TABLE,
        FilterExpression: 'published = :published',
        ExpressionAttributeValues: {
          ':published': true
        }
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(Items || [])
      };
    }
    
    if (path.match(/^\/public\/events\/[^/]+$/) && method === 'GET') {
      const eventId = path.split('/')[3]; // /public/events/{eventId}
      
      const { Item } = await ddb.send(new GetCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));
      
      if (!Item || !Item.published) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'Event not found or not published' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(Item)
      };
    }
    
    // List competitions by organization
    if (pathParts.length === 0 && method === 'GET') {
      const organizationId = event.queryStringParameters?.organizationId;
      
      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'organizationId query parameter is required' })
        };
      }
      
      if (organizationId === 'all') {
        // Super admin - return all events
        const { Items } = await ddb.send(new ScanCommand({
          TableName: EVENTS_TABLE
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(Items || [])
        };
      } else {
        // Get events for specific organization
        const { Items } = await ddb.send(new QueryCommand({
          TableName: ORGANIZATION_EVENTS_TABLE,
          KeyConditionExpression: 'organizationId = :orgId',
          ExpressionAttributeValues: {
            ':orgId': organizationId
          }
        }));
        
        // Get full event details
        const events = [];
        for (const item of Items || []) {
          const { Item } = await ddb.send(new GetCommand({
            TableName: EVENTS_TABLE,
            Key: { eventId: item.eventId }
          }));
          if (Item) events.push(Item);
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(events)
        };
      }
    }
    
    // Get single event
    if (pathParts.length === 1 && method === 'GET') {
      const { Item } = await ddb.send(new GetCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));
      
      return {
        statusCode: Item ? 200 : 404,
        headers,
        body: JSON.stringify(Item || { message: 'Event not found' })
      };
    }

    // Update single event
    if (pathParts.length === 1 && method === 'PUT') {
      // Build update expression dynamically
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      if (requestBody.name !== undefined) {
        updateExpression.push('#name = :name');
        expressionAttributeNames['#name'] = 'name';
        expressionAttributeValues[':name'] = requestBody.name;
      }
      if (requestBody.description !== undefined) {
        updateExpression.push('description = :description');
        expressionAttributeValues[':description'] = requestBody.description;
      }
      if (requestBody.startDate !== undefined) {
        updateExpression.push('startDate = :startDate');
        expressionAttributeValues[':startDate'] = requestBody.startDate;
      }
      if (requestBody.endDate !== undefined) {
        updateExpression.push('endDate = :endDate');
        expressionAttributeValues[':endDate'] = requestBody.endDate;
      }
      if (requestBody.location !== undefined) {
        updateExpression.push('#location = :location');
        expressionAttributeNames['#location'] = 'location';
        expressionAttributeValues[':location'] = requestBody.location;
      }
      if (requestBody.status !== undefined) {
        updateExpression.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = requestBody.status;
      }
      if (requestBody.published !== undefined) {
        updateExpression.push('published = :published');
        expressionAttributeValues[':published'] = requestBody.published;
      }
      if (requestBody.maxParticipants !== undefined) {
        updateExpression.push('maxParticipants = :maxParticipants');
        expressionAttributeValues[':maxParticipants'] = requestBody.maxParticipants;
      }
      if (requestBody.imageUrl !== undefined) {
        updateExpression.push('imageUrl = :imageUrl');
        expressionAttributeValues[':imageUrl'] = requestBody.imageUrl;
      }
      
      if (updateExpression.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'No fields to update' })
        };
      }
      
      // Add updatedAt timestamp
      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();
      
      await ddb.send(new UpdateCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId },
        UpdateExpression: 'SET ' + updateExpression.join(', '),
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Event updated successfully' })
      };
    }

    // Delete single event
    if (pathParts.length === 1 && method === 'DELETE') {
      // Check if event is published
      const { Item } = await ddb.send(new GetCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));
      
      if (!Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'Event not found' })
        };
      }
      
      if (Item.published) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'Cannot delete published event. Unpublish first.' })
        };
      }
      
      // Get all athlete registrations for this event
      const { Items: registrations } = await ddb.send(new QueryCommand({
        TableName: process.env.ATHLETE_EVENTS_TABLE,
        IndexName: 'event-athletes-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      
      // Delete athlete registrations
      for (const registration of registrations || []) {
        await ddb.send(new DeleteCommand({
          TableName: process.env.ATHLETE_EVENTS_TABLE,
          Key: { 
            userId: registration.userId,
            eventId: registration.eventId
          }
        }));
      }
      
      // Delete the event
      await ddb.send(new DeleteCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'Event deleted successfully',
          registrationsRemoved: registrations?.length || 0
        })
      };
    }

    // Get event days - Redirect to events service
    if (pathParts.length === 2 && pathParts[1] === 'days' && method === 'GET') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          message: 'Event days should be accessed via /events/{eventId}/days endpoint',
          redirect: `/events/${eventId}/days`
        })
      };
    }
    
    // Get registered athletes - Redirect to users service
    if (pathParts.length === 2 && pathParts[1] === 'athletes' && method === 'GET') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          message: 'Athletes should be accessed via /athletes endpoint with eventId filter',
          redirect: `/athletes?eventId=${eventId}`
        })
      };
    }
    
    // Save schedule endpoint
    if (pathParts.length === 3 && pathParts[1] === 'schedule' && pathParts[2] === 'save' && method === 'POST') {
      const scheduleData = {
        ...requestBody,
        eventId,
        scheduleId: requestBody.scheduleId || `schedule-${Date.now()}`,
        savedAt: new Date().toISOString()
      };
      
      // Save schedule data to the event record
      await ddb.send(new UpdateCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId },
        UpdateExpression: 'SET scheduleData = :scheduleData, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':scheduleData': scheduleData,
          ':updatedAt': new Date().toISOString()
        }
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'Schedule saved successfully',
          schedule: scheduleData
        })
      };
    }
    
    // Generate schedule - Event-driven approach
    if (pathParts.length === 2 && pathParts[1] === 'schedule' && method === 'POST') {
      const requestBody = JSON.parse(event.body || '{}');
      
      logger.info('Schedule generation requested', { eventId, config: requestBody });
      
      // Publish event to EventBridge for scheduler service
      const eventBridgeClient = new EventBridgeClient({});
      
      await eventBridgeClient.send(new PutEventsCommand({
        Entries: [{
          Source: 'competitions.service',
          DetailType: 'Schedule Generation Requested',
          Detail: JSON.stringify({
            eventId,
            config: requestBody,
            requestedBy: event.requestContext?.authorizer?.claims?.sub,
            requestedAt: new Date().toISOString()
          })
        }]
      }));
      
      logger.info('Schedule generation event published', { eventId });
      
      return {
        statusCode: 202, // Accepted - processing asynchronously
        headers,
        body: JSON.stringify({ 
          message: 'Schedule generation started',
          eventId,
          status: 'processing'
        })
      };
    }

    // Get schedules for event
    if (pathParts.length === 2 && pathParts[1] === 'schedule' && method === 'GET') {
      // Get schedules from SCHEDULES_TABLE instead of EVENTS_TABLE
      const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;
      
      if (SCHEDULES_TABLE) {
        // Get all schedules for this event from SCHEDULES_TABLE
        const { Items } = await ddb.send(new QueryCommand({
          TableName: SCHEDULES_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        }));
        
        // Return the most recent schedule or null if none exist
        const schedules = Items || [];
        const latestSchedule = schedules.length > 0 
          ? schedules.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0]
          : null;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(latestSchedule)
        };
      } else {
        // Fallback to EVENTS_TABLE for backward compatibility
        const { Item } = await ddb.send(new GetCommand({
          TableName: EVENTS_TABLE,
          Key: { eventId }
        }));
        
        const scheduleData = Item?.scheduleData || null;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(scheduleData)
        };
      }
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: 'Not found', path, method })
    };
    
  } catch (error) {
    logger.error('Competitions service error', { 
      error: error.message, 
      stack: error.stack,
      method: event.httpMethod,
      path: event.path
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message, stack: error.stack })
    };
  }
};
