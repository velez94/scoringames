const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = process.env.WODS_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  logger.info('WODs service request', { 
    method: event.httpMethod, 
    path: event.path 
  });
  
  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  let path = event.path || '';
  if (event.pathParameters?.proxy) {
    path = '/' + event.pathParameters.proxy;
  }
  
  // Clean path - remove /wods prefix if present
  if (path.startsWith('/wods')) {
    path = path.substring('/wods'.length);
  }
  
  const method = event.httpMethod;
  
  // Extract user info from JWT token
  let userId = 'temp-user';
  let email = 'temp@example.com';
  
  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (claims) {
      userId = claims.sub;
      email = claims.email;
    }
  } catch (error) {
    logger.warn('Could not extract user info from token', { error: error.message });
  }
  
  try {
    // Create WOD - POST /wods
    if (path === '' && method === 'POST') {
      const body = JSON.parse(event.body);
      const { eventId, ...wodData } = body;
      
      if (!eventId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'eventId is required' })
        };
      }
      
      const wodId = wodData.wodId || `wod-${Date.now()}`;
      const now = new Date().toISOString();
      const isSuperAdmin = email === 'admin@scoringames.com';
      
      // Handle transversal WOD creation (super admin only)
      const isTransversalCreation = eventId === 'transversal';
      if (isTransversalCreation && !isSuperAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - super admin required for transversal WODs' })
        };
      }
      
      const newWod = {
        eventId,
        wodId,
        name: wodData.name,
        description: wodData.description || '',
        format: wodData.format || 'AMRAP',
        timeLimit: wodData.timeLimit || '',
        movements: wodData.movements || [],
        categoryId: wodData.categoryId || '',
        createdBy: userId,
        isShared: wodData.isShared || isTransversalCreation,
        isTransversal: wodData.isTransversal || isTransversalCreation,
        createdAt: now,
        updatedAt: now
      };
      
      await ddb.send(new PutCommand({
        TableName: WODS_TABLE,
        Item: newWod
      }));
      
      logger.info('WOD created', { 
        wodId, 
        eventId, 
        createdBy: userId, 
        isTransversal: newWod.isTransversal 
      });
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          message: `${isTransversalCreation ? 'Transversal template' : 'WOD'} created successfully`,
          wodId,
          wod: newWod
        })
      };
    }

    // List WODs by eventId query parameter - /wods?eventId={eventId}
    if (path === '' && method === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      const includeShared = event.queryStringParameters?.includeShared === 'true';
      
      if (eventId) {
        // Query WODs for specific event
        const { Items } = await ddb.send(new QueryCommand({
          TableName: WODS_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }));
        
        let wods = Items || [];
        
        // If includeShared is true, also get shared WODs from other events
        if (includeShared) {
          const { Items: sharedWods } = await ddb.send(new ScanCommand({
            TableName: WODS_TABLE,
            FilterExpression: '(isShared = :isShared OR isTransversal = :isTransversal) AND eventId <> :eventId',
            ExpressionAttributeValues: {
              ':isShared': true,
              ':isTransversal': true,
              ':eventId': eventId
            }
          }));
          
          // Get organization info for shared WODs to avoid name conflicts
          const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
          const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE;
          
          const uniqueSharedWods = [];
          const seenKeys = new Set();
          
          for (const wod of sharedWods || []) {
            try {
              // Get organization for this WOD's event
              const { Items: orgEvents } = await ddb.send(new QueryCommand({
                TableName: ORGANIZATION_EVENTS_TABLE,
                IndexName: 'event-organization-index',
                KeyConditionExpression: 'eventId = :eventId',
                ExpressionAttributeValues: { ':eventId': wod.eventId }
              }));
              
              let orgName = 'Unknown';
              if (orgEvents && orgEvents.length > 0) {
                const { Item: org } = await ddb.send(new GetCommand({
                  TableName: ORGANIZATIONS_TABLE,
                  Key: { organizationId: orgEvents[0].organizationId }
                }));
                orgName = org?.name || 'Unknown';
              }
              
              // Create unique key: name + organization
              const uniqueKey = `${wod.name}-${orgName}`;
              
              if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                uniqueSharedWods.push({
                  ...wod,
                  displayName: `${wod.name} (${orgName})`,
                  isSharedWod: true,
                  originalEventId: wod.eventId,
                  organizationName: orgName
                });
              }
            } catch (error) {
              // Fallback: use original name if org lookup fails
              const uniqueKey = `${wod.name}-fallback`;
              if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                uniqueSharedWods.push({
                  ...wod,
                  isSharedWod: true,
                  originalEventId: wod.eventId
                });
              }
            }
          }
          
          wods = [...wods, ...uniqueSharedWods];
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(wods)
        };
      } else {
        // Return all WODs (for super admin management)
        const isSuperAdmin = email === 'admin@scoringames.com';
        
        if (!isSuperAdmin) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ message: 'Access denied - super admin required' })
          };
        }
        
        const { Items } = await ddb.send(new ScanCommand({
          TableName: WODS_TABLE
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(Items || [])
        };
      }
    }
    
    // Update WOD
    if (path.match(/^\/wod-[^/]+$/) && method === 'PUT') {
      logger.info('PUT WOD handler matched', { path, method, wodId: path.split('/')[1] });
      
      const wodId = path.split('/')[1];
      const body = JSON.parse(event.body);
      
      // Check if this is adding a WOD to an event (has eventId but minimal data)
      if (body.eventId && !body.name) {
        logger.info('Adding WOD to event', { wodId, eventId: body.eventId, sourceEventId: body.currentEventId });
        
        if (!body.currentEventId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: 'currentEventId is required when adding WOD to event' })
          };
        }
        
        // Use efficient query instead of expensive scan
        const { Item: sourceWod } = await ddb.send(new GetCommand({
          TableName: WODS_TABLE,
          Key: { 
            eventId: body.currentEventId,
            wodId: wodId
          }
        }));
        
        if (!sourceWod) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              message: 'Source WOD not found',
              searchedWodId: wodId,
              searchedEventId: body.currentEventId
            })
          };
        }
        
        // Create new WOD record for this event with full data
        const newWod = {
          eventId: body.eventId,
          wodId: sourceWod.wodId,
          name: sourceWod.name,
          description: sourceWod.description || '',
          format: sourceWod.format || 'AMRAP',
          timeLimit: sourceWod.timeLimit || '',
          movements: sourceWod.movements || [],
          categoryId: sourceWod.categoryId || '',
          createdBy: sourceWod.createdBy,
          isShared: false, // Event-specific copy is not shared
          isTransversal: false,
          createdAt: sourceWod.createdAt,
          updatedAt: new Date().toISOString()
        };
        
        await ddb.send(new PutCommand({
          TableName: WODS_TABLE,
          Item: newWod
        }));
        
        logger.info('WOD added to event', { wodId, eventId: body.eventId });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'WOD added to event successfully' })
        };
      }
      
      // Regular WOD update - find existing WOD
      const { Items: wods } = await ddb.send(new ScanCommand({
        TableName: WODS_TABLE,
        FilterExpression: 'wodId = :wodId',
        ExpressionAttributeValues: {
          ':wodId': wodId
        }
      }));
      
      if (!wods || wods.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'WOD not found' })
        };
      }
      
      const wod = wods[0];
      const isSuperAdmin = email === 'admin@scoringames.com';
      const isOwner = wod.createdBy === userId;
      
      // Simple authorization - owner or super admin
      if (!isSuperAdmin && !isOwner) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - not WOD owner' })
        };
      }
      
      // Update WOD
      const updateExpression = [];
      const expressionAttributeValues = {};
      const expressionAttributeNames = {};
      
      if (body.name) {
        updateExpression.push('#name = :name');
        expressionAttributeNames['#name'] = 'name';
        expressionAttributeValues[':name'] = body.name;
      }
      if (body.description !== undefined) {
        updateExpression.push('description = :description');
        expressionAttributeValues[':description'] = body.description;
      }
      if (body.format) {
        updateExpression.push('#format = :format');
        expressionAttributeNames['#format'] = 'format';
        expressionAttributeValues[':format'] = body.format;
      }
      if (body.timeLimit !== undefined) {
        updateExpression.push('timeLimit = :timeLimit');
        expressionAttributeValues[':timeLimit'] = body.timeLimit;
      }
      if (body.movements) {
        updateExpression.push('movements = :movements');
        expressionAttributeValues[':movements'] = body.movements;
      }
      if (body.isShared !== undefined) {
        updateExpression.push('isShared = :isShared');
        expressionAttributeValues[':isShared'] = body.isShared;
      }
      
      // Always update the updatedAt timestamp
      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();
      
      await ddb.send(new UpdateCommand({
        TableName: WODS_TABLE,
        Key: { eventId: wod.eventId, wodId: wod.wodId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ...(Object.keys(expressionAttributeNames).length > 0 && { ExpressionAttributeNames: expressionAttributeNames })
      }));
      
      logger.info('WOD updated', { wodId, eventId: wod.eventId, updatedBy: userId });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'WOD updated successfully'
        })
      };
    }
    
    // Delete WOD
    if (path.match(/^\/wod-[^/]+$/) && method === 'DELETE') {
      const wodId = path.split('/')[1];
      const eventId = event.queryStringParameters?.eventId;
      
      if (eventId) {
        // Remove WOD from specific event
        await ddb.send(new DeleteCommand({
          TableName: WODS_TABLE,
          Key: { eventId, wodId }
        }));
        
        logger.info('WOD removed from event', { wodId, eventId });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'WOD removed from event successfully' })
        };
      }
      
      // Delete WOD completely (original logic)
      const { Items: wods } = await ddb.send(new ScanCommand({
        TableName: WODS_TABLE,
        FilterExpression: 'wodId = :wodId',
        ExpressionAttributeValues: {
          ':wodId': wodId
        }
      }));
      
      if (!wods || wods.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'WOD not found' })
        };
      }
      
      const wod = wods[0];
      const isSuperAdmin = email === 'admin@scoringames.com';
      const isOwner = wod.createdBy === userId;
      
      // Simple authorization - owner or super admin
      if (!isSuperAdmin && !isOwner) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - not WOD owner' })
        };
      }
      
      // Smart deletion logic: if WOD is shared, convert to transversal
      if (wod.isShared) {
        // Check if this WOD is used in other events (simplified check)
        const { Items: otherEventWods } = await ddb.send(new ScanCommand({
          TableName: WODS_TABLE,
          FilterExpression: 'wodId = :wodId AND eventId <> :eventId',
          ExpressionAttributeValues: {
            ':wodId': wod.wodId,
            ':eventId': wod.eventId
          }
        }));
        
        if (otherEventWods && otherEventWods.length > 0) {
          // Convert to transversal template instead of deleting
          await ddb.send(new UpdateCommand({
            TableName: WODS_TABLE,
            Key: { eventId: wod.eventId, wodId: wod.wodId },
            UpdateExpression: 'SET isTransversal = :isTransversal, isShared = :isShared, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':isTransversal': true,
              ':isShared': false,
              ':updatedAt': new Date().toISOString()
            }
          }));
          
          logger.info('WOD converted to transversal template', { wodId: wod.wodId, eventId: wod.eventId, convertedBy: userId });
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              message: 'WOD converted to transversal template to preserve existing relationships',
              action: 'converted_to_transversal'
            })
          };
        }
      }
      
      // Delete the WOD
      await ddb.send(new DeleteCommand({
        TableName: WODS_TABLE,
        Key: { eventId: wod.eventId, wodId: wod.wodId }
      }));
      
      logger.info('WOD deleted', { wodId, eventId: wod.eventId, deletedBy: userId });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'WOD deleted successfully',
          action: 'deleted'
        })
      };
    }
    
    logger.info('No handler matched', { path, method });
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: 'Not found', path, method })
    };
    
  } catch (error) {
    logger.error('WODs service error', { 
      error: error.message, 
      stack: error.stack,
      method: event.httpMethod,
      path: event.path
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};
