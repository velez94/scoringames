const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./shared/utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = process.env.WODS_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Authorization helper with audit logging
async function checkWodAccess(userId, userEmail, action, wodId = null, eventId = null) {
  // Super admin bypass
  if (userEmail === 'admin@athleon.fitness') {
    const decision = { authorized: true, role: 'super_admin' };
    logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
    return decision;
  }

  // For template WODs, any authenticated user can read
  if (action === 'read' && (!eventId || eventId === 'template')) {
    const decision = { authorized: true, role: 'user' };
    logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
    return decision;
  }

  // For write operations, check WOD ownership and restrictions
  if (action === 'update' || action === 'delete') {
    try {
      // Get the WOD to check its properties
      const { Items: wods } = await ddb.send(new ScanCommand({
        TableName: WODS_TABLE,
        FilterExpression: 'wodId = :wodId',
        ExpressionAttributeValues: { ':wodId': wodId }
      }));

      if (!wods || wods.length === 0) {
        const decision = { authorized: false, reason: 'WOD not found' };
        logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
        return decision;
      }

      const wod = wods[0];

      // Block editing of transversal templates
      if (wod.isTransversal) {
        const decision = { authorized: false, reason: 'Transversal templates cannot be edited' };
        logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
        return decision;
      }

      // For template WODs, check organization ownership
      if (wod.eventId === 'template') {
        // If WOD has organizationId, check organization membership
        if (wod.organizationId) {
          try {
            const { Item } = await ddb.send(new GetCommand({
              TableName: ORGANIZATION_MEMBERS_TABLE,
              Key: { organizationId: wod.organizationId, userId }
            }));

            if (Item) {
              const decision = { authorized: true, role: Item.role };
              logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId, organizationId: wod.organizationId });
              return decision;
            }
          } catch (error) {
            logger.error('Error checking organization membership for template WOD:', { message: error.message, stack: error.stack });
          }
        }
        
        // If no organizationId (global template), only super admin can edit
        const decision = { authorized: false, reason: 'Global templates can only be edited by super admin' };
        logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
        return decision;
      }

      // For event-specific WODs, check organization membership
      if (wod.eventId && wod.eventId !== 'template') {
        // Get event's organization
        const { Items } = await ddb.send(new QueryCommand({
          TableName: ORGANIZATION_EVENTS_TABLE,
          IndexName: 'event-organization-index',
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': wod.eventId }
        }));

        if (Items && Items.length > 0) {
          const organizationId = Items[0].organizationId;
          
          // Check organization membership
          const { Item } = await ddb.send(new GetCommand({
            TableName: ORGANIZATION_MEMBERS_TABLE,
            Key: { organizationId, userId }
          }));

          if (Item) {
            const decision = { authorized: true, role: Item.role };
            logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId, organizationId });
            return decision;
          }
        }
      }
    } catch (error) {
      logger.error('Error checking WOD access:', { message: error.message, stack: error.stack });
      logger.error('Security event:', { event: 'AUTHORIZATION_ERROR', userId, userEmail, error: error.message, wodId, eventId });
    }
  }

  // For create operations, check organization membership for event-specific WODs
  if (action === 'create') {
    // Anyone can create template WODs, but only super admin can create transversal
    if (!eventId || eventId === 'template') {
      const decision = { authorized: true, role: 'user' };
      logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
      return decision;
    }

    // Only super admin can create transversal WODs
    if (eventId === 'transversal') {
      const decision = { authorized: false, reason: 'Only super admin can create transversal WODs' };
      logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
      return decision;
    }

    // For event-specific WODs, check organization membership
    try {
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        IndexName: 'event-organization-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));

      if (Items && Items.length > 0) {
        const organizationId = Items[0].organizationId;
        
        const { Item } = await ddb.send(new GetCommand({
          TableName: ORGANIZATION_MEMBERS_TABLE,
          Key: { organizationId, userId }
        }));

        if (Item) {
          const decision = { authorized: true, role: Item.role };
          logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId, organizationId });
          return decision;
        }
      }
    } catch (error) {
      logger.error('Error checking organization access for create:', { message: error.message, stack: error.stack });
    }
  }

  // For event-specific WODs, check organization membership (read operations)
  if (eventId && eventId !== 'template') {
    try {
      // Get event's organization
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        IndexName: 'event-organization-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));

      if (Items && Items.length > 0) {
        const organizationId = Items[0].organizationId;
        
        // Check organization membership
        const { Item } = await ddb.send(new GetCommand({
          TableName: ORGANIZATION_MEMBERS_TABLE,
          Key: { organizationId, userId }
        }));

        if (Item) {
          const decision = { authorized: true, role: Item.role };
          logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId, organizationId });
          return decision;
        }
      }
    } catch (error) {
      logger.error('Error checking organization access:', { message: error.message, stack: error.stack });
      logger.error('Security event:', { event: 'AUTHORIZATION_ERROR', userId, userEmail, error: error.message, wodId, eventId });
    }
  }

  const decision = { authorized: false };
  logger.info('Authorization decision:', { userId, userEmail, action, decision, wodId, eventId });
  return decision;
}

// Check if WOD has scores (prevent deletion)
async function checkWodHasScores(wodId) {
  try {
    const { Items } = await ddb.send(new QueryCommand({
      TableName: SCORES_TABLE,
      IndexName: 'wod-scores-index',
      KeyConditionExpression: 'wodId = :wodId',
      ExpressionAttributeValues: { ':wodId': wodId },
      Limit: 1
    }));
    return Items && Items.length > 0;
  } catch (error) {
    logger.error('Error checking WOD scores:', error);
    return false;
  }
}

exports.handler = async (event) => {
  logger.info('WODs service request', { 
    method: event.httpMethod, 
    path: event.path,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters
  });
  
  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let path = event.path || '';
    if (event.pathParameters?.proxy) {
      path = '/' + event.pathParameters.proxy;
    }
    
    const method = event.httpMethod;
    
    logger.info('Processing request', { path, method });

    // Public endpoints (no auth required) - check full path first
    if (path === '/public/wods' && method === 'GET') {
    try {
      const eventId = event.queryStringParameters?.eventId;
      
      if (eventId) {
        // Return WODs for specific event
        const { Items } = await ddb.send(new QueryCommand({
          TableName: WODS_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(Items || [])
        };
      } else {
        // Return template and transversal WODs for public access
        const templateWods = await ddb.send(new QueryCommand({
          TableName: WODS_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': 'template' }
        }));
        
        const transversalWods = await ddb.send(new ScanCommand({
          TableName: WODS_TABLE,
          FilterExpression: 'isTransversal = :isTransversal',
          ExpressionAttributeValues: { ':isTransversal': true }
        }));
        
        const allPublicWods = [
          ...(templateWods.Items || []),
          ...(transversalWods.Items || [])
        ];
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(allPublicWods)
        };
      }
    } catch (error) {
      logger.error('Error fetching public WODs', { error: error.message });
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Internal server error' })
      };
    }
  }

  // Clean path - remove /wods prefix if present for authenticated endpoints
  if (path.startsWith('/wods')) {
    path = path.substring('/wods'.length);
  }

  // Extract user info for authenticated endpoints
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.claims?.email;

  if (!userId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ message: 'Authentication required' })
    };
  }

  // List WODs by eventId query parameter - /wods?eventId={eventId}
  if (path === '' && method === 'GET') {
    logger.info('Processing GET /wods request', { 
      eventId: event.queryStringParameters?.eventId,
      includeShared: event.queryStringParameters?.includeShared,
      userId,
      userEmail
    });
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
        
        // If includeShared is true, also get shared WODs and template WODs
        if (includeShared) {
          const { Items: sharedWods } = await ddb.send(new ScanCommand({
            TableName: WODS_TABLE,
            FilterExpression: '(isShared = :isShared OR isTransversal = :isTransversal OR eventId = :templateEventId) AND eventId <> :eventId',
            ExpressionAttributeValues: {
              ':isShared': true,
              ':isTransversal': true,
              ':templateEventId': 'template',
              ':eventId': eventId
            }
          }));
          
          // Get organization info for shared WODs to avoid name conflicts
          const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
          const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE;
          
          if (!ORGANIZATIONS_TABLE) {
            logger.error('ORGANIZATIONS_TABLE environment variable not set');
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ message: 'Configuration error - missing ORGANIZATIONS_TABLE' })
            };
          }
          
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
        // Return template WODs - frontend should only call this for organizers
        // RBAC is enforced at the frontend level (organization context)
        const { Items } = await ddb.send(new QueryCommand({
          TableName: WODS_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: {
            ':eventId': 'template'
          }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(Items || [])
        };
      }
    }
    
    // Create new WOD
    if (path === '' && method === 'POST') {
      logger.info('Processing POST /wods request', { userId, userEmail });
      
      const body = JSON.parse(event.body);
      
      // Check authorization for WOD creation
      const authCheck = await checkWodAccess(userId, userEmail, 'create', null, body.eventId);
      if (!authCheck.authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            message: authCheck.reason || 'Access denied - insufficient permissions to create WODs' 
          })
        };
      }
      
      // Create WOD data
      const wodData = {
        eventId: body.eventId || 'template',
        wodId: body.wodId || `wod-${Date.now()}`,
        name: body.name,
        description: body.description || '',
        format: body.format || 'AMRAP',
        timeLimit: body.timeLimit || '',
        movements: body.movements || [],
        categoryId: body.categoryId || '',
        isShared: body.isShared || false,
        isTransversal: body.isTransversal || false,
        organizationId: body.organizationId || null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // If creating for an event, get organization ID
      if (body.eventId && body.eventId !== 'template') {
        try {
          const { Items } = await ddb.send(new QueryCommand({
            TableName: ORGANIZATION_EVENTS_TABLE,
            IndexName: 'event-organization-index',
            KeyConditionExpression: 'eventId = :eventId',
            ExpressionAttributeValues: { ':eventId': body.eventId }
          }));
          
          if (Items && Items.length > 0) {
            wodData.organizationId = Items[0].organizationId;
          }
        } catch (error) {
          logger.error('Error getting organization for event:', error);
        }
      }
      
      await ddb.send(new PutCommand({
        TableName: WODS_TABLE,
        Item: wodData
      }));
      
      logger.info('WOD created', { wodId: wodData.wodId, eventId: wodData.eventId, createdBy: userId });
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          message: 'WOD created successfully',
          wodId: wodData.wodId
        })
      };
    }
    
    // Update WOD
    if (path.match(/^\/[^/]+$/) && method === 'PUT') {
      logger.info('PUT WOD handler matched', { path, method, wodId: path.split('/')[1] });
      
      const wodId = path.split('/')[1];
      const body = JSON.parse(event.body);

      // First, find the existing WOD to get its eventId for authorization
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
      
      const existingWod = wods[0];

      // Check authorization for WOD update using the existing WOD's eventId
      const authCheck = await checkWodAccess(userId, userEmail, 'update', wodId, existingWod.eventId);
      if (!authCheck.authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            message: authCheck.reason || 'Access denied - insufficient permissions to update WODs' 
          })
        };
      }
      
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
      
      // Regular WOD update - use the existing WOD we already found
      const wod = existingWod;
      const isSuperAdmin = userEmail === 'admin@athleon.fitness';
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
      if (body.categoryId !== undefined) {
        updateExpression.push('categoryId = :categoryId');
        expressionAttributeValues[':categoryId'] = body.categoryId;
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
    if (path.match(/^\/[^/]+$/) && method === 'DELETE') {
      const wodId = path.split('/')[1];
      const eventId = event.queryStringParameters?.eventId;

      // Check authorization for WOD deletion
      const authCheck = await checkWodAccess(userId, userEmail, 'delete', wodId, eventId);
      if (!authCheck.authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - insufficient permissions to delete WODs' })
        };
      }

      // Check if WOD has scores (prevent deletion)
      const hasScores = await checkWodHasScores(wodId);
      if (hasScores) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            message: 'Cannot delete WOD - it has existing scores. Please remove scores first.' 
          })
        };
      }
      
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
      const isSuperAdmin = userEmail === 'admin@athleon.fitness';
      const isOwner = wod.createdBy === userId;
      
      // Template WODs can only be deleted by super admin
      if (wod.eventId === 'template' && !isSuperAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - template WODs can only be deleted by super admin' })
        };
      }
      
      // Regular authorization - owner or super admin
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
