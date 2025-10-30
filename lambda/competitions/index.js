const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const logger = require('./logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const EVENT_DAYS_TABLE = process.env.EVENT_DAYS_TABLE;
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
    
    // Clean path - remove /competitions or /events prefix if present
    if (path.startsWith('/competitions')) {
      path = path.substring('/competitions'.length);
    } else if (path.startsWith('/events')) {
      path = path.substring('/events'.length);
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
    
    // Extract user info from JWT token
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.claims?.email;
    
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
      
      // Enrich events with organization names
      const enrichedEvents = await Promise.all((Items || []).map(async (event) => {
        try {
          const { Items: orgEvents } = await ddb.send(new QueryCommand({
            TableName: ORGANIZATION_EVENTS_TABLE,
            IndexName: 'event-organization-index',
            KeyConditionExpression: 'eventId = :eventId',
            ExpressionAttributeValues: { ':eventId': event.eventId }
          }));
          
          if (orgEvents && orgEvents.length > 0) {
            const { Item: org } = await ddb.send(new GetCommand({
              TableName: ORGANIZATIONS_TABLE,
              Key: { organizationId: orgEvents[0].organizationId }
            }));
            
            return { ...event, organizationName: org?.name };
          }
        } catch (error) {
          logger.error('Error fetching organization', { eventId: event.eventId, error });
        }
        return event;
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(enrichedEvents)
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
        // Super admin - return all events linked to organizations
        const { Items: orgEvents } = await ddb.send(new ScanCommand({
          TableName: ORGANIZATION_EVENTS_TABLE
        }));
        
        // Get unique event IDs and fetch full event details
        const uniqueEventIds = [...new Set(orgEvents?.map(item => item.eventId) || [])];
        const events = [];
        
        for (const eventId of uniqueEventIds) {
          const { Item } = await ddb.send(new GetCommand({
            TableName: EVENTS_TABLE,
            Key: { eventId }
          }));
          if (Item) events.push(Item);
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(events)
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
    
    // Create new competition
    if (pathParts.length === 0 && method === 'POST') {
      // Check for duplicates if organizationId provided
      if (requestBody.organizationId && requestBody.name && requestBody.location) {
        const { Items: orgEvents } = await ddb.send(new QueryCommand({
          TableName: ORGANIZATION_EVENTS_TABLE,
          KeyConditionExpression: 'organizationId = :orgId',
          ExpressionAttributeValues: { ':orgId': requestBody.organizationId }
        }));
        
        // Check if any existing event has same name and location
        for (const orgEvent of orgEvents || []) {
          const { Item: existingEvent } = await ddb.send(new GetCommand({
            TableName: EVENTS_TABLE,
            Key: { eventId: orgEvent.eventId }
          }));
          
          if (existingEvent && 
              existingEvent.name === requestBody.name && 
              existingEvent.location === requestBody.location) {
            return {
              statusCode: 409,
              headers,
              body: JSON.stringify({ message: 'Event with same name and location already exists' })
            };
          }
        }
      }
      
      const eventData = {
        eventId: `evt-${Date.now()}`,
        ...requestBody,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        published: false
      };
      
      // Store event with conditional write
      await ddb.send(new PutCommand({
        TableName: EVENTS_TABLE,
        Item: eventData,
        ConditionExpression: 'attribute_not_exists(eventId)'
      }));
      
      // Link to organization if provided
      if (requestBody.organizationId) {
        await ddb.send(new PutCommand({
          TableName: ORGANIZATION_EVENTS_TABLE,
          Item: {
            organizationId: requestBody.organizationId,
            eventId: eventData.eventId,
            createdAt: new Date().toISOString(),
            createdBy: userId
          }
        }));
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(eventData)
      };
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
      if (requestBody.wods !== undefined || requestBody.workouts !== undefined) {
        updateExpression.push('wods = :wods');
        expressionAttributeValues[':wods'] = requestBody.wods || requestBody.workouts;
      }
      if (requestBody.categories !== undefined) {
        updateExpression.push('categories = :categories');
        expressionAttributeValues[':categories'] = requestBody.categories;
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
      
      // 1. Delete organization-event link (within our domain boundary)
      if (ORGANIZATION_EVENTS_TABLE) {
        const { Items: orgLinks } = await ddb.send(new QueryCommand({
          TableName: ORGANIZATION_EVENTS_TABLE,
          IndexName: 'event-organization-index',
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        }));
        
        for (const link of orgLinks || []) {
          await ddb.send(new DeleteCommand({
            TableName: ORGANIZATION_EVENTS_TABLE,
            Key: {
              organizationId: link.organizationId,
              eventId: link.eventId
            }
          }));
        }
      }
      
      // 2. Emit EventDeletionRequested event for other domains to handle cleanup
      if (process.env.DOMAIN_EVENT_BUS) {
        const eventBridgeClient = new EventBridgeClient({});
        
        await eventBridgeClient.send(new PutEventsCommand({
          Entries: [{
            Source: 'competitions.domain',
            DetailType: 'EventDeletionRequested',
            Detail: JSON.stringify({
              eventId,
              eventName: Item.name,
              organizationId: Item.organizationId,
              requestedBy: userId,
              timestamp: new Date().toISOString()
            }),
            EventBusName: process.env.DOMAIN_EVENT_BUS
          }]
        }));
        
        logger.info('Emitted EventDeletionRequested event', { eventId });
      }
      
      // 3. Delete the event (our domain responsibility)
      await ddb.send(new DeleteCommand({
        TableName: EVENTS_TABLE,
        Key: { eventId }
      }));
      
      logger.info('Event deleted - cleanup delegated to other domains', { eventId });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'Event deleted successfully. Related data cleanup in progress.',
          eventId
        })
      };
    }

    // Get event days
    if (pathParts.length === 2 && pathParts[1] === 'days' && method === 'GET') {
      if (!EVENT_DAYS_TABLE) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ message: 'Event days table not configured' })
        };
      }
      
      const { Items } = await ddb.send(new QueryCommand({
        TableName: EVENT_DAYS_TABLE,
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

    // Get scoring systems
    if (pathParts.length === 2 && pathParts[1] === 'scoring-systems' && method === 'GET') {
      const SCORING_SYSTEMS_TABLE = process.env.SCORING_SYSTEMS_TABLE;
      if (!SCORING_SYSTEMS_TABLE) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ message: 'Scoring systems table not configured' })
        };
      }
      
      const { Items } = await ddb.send(new QueryCommand({
        TableName: SCORING_SYSTEMS_TABLE,
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
