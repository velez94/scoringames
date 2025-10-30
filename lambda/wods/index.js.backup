const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./shared/utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Authorization helper
async function checkCategoryAccess(userId, userEmail, action, eventId = null) {
  // Super admin bypass
  if (userEmail === 'admin@athleon.fitness') {
    return { authorized: true, role: 'super_admin' };
  }

  // For global categories, any authenticated user can read
  if (action === 'read' && (!eventId || eventId === 'global')) {
    return { authorized: true, role: 'user' };
  }

  // For event-specific categories, check organization membership
  if (eventId && eventId !== 'global') {
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
          return { authorized: true, role: Item.role };
        }
      }
    } catch (error) {
      logger.error('Error checking organization access:', { message: error.message });
    }
  }

  return { authorized: false };
}

exports.handler = async (event) => {
  logger.info('Categories service request', { 
    method: event.httpMethod, 
    path: event.path 
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
  
  // Clean path - remove /categories prefix if present
  if (path.startsWith('/categories')) {
    path = path.substring('/categories'.length);
  }
  
  const method = event.httpMethod;

  // Public endpoints (no auth required)
  if (path === '/public/categories' && method === 'GET') {
    try {
      const eventId = event.queryStringParameters?.eventId;
      
      if (eventId) {
        // Return categories for specific event
        const { Items } = await ddb.send(new QueryCommand({
          TableName: CATEGORIES_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(Items || [])
        };
      } else {
        // Return global categories
        const { Items } = await ddb.send(new QueryCommand({
          TableName: CATEGORIES_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': 'global' }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(Items || [])
        };
      }
    } catch (error) {
      logger.error('Error fetching public categories', { error: error.message });
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Internal server error' })
      };
    }
  }

  // Extract user info for authenticated endpoints
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.claims?.email;
    if (path === '' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { eventId, categoryId, ...categoryData } = body;

      // Check authorization for category creation
      const authCheck = await checkCategoryAccess(userId, userEmail, 'create', eventId);
      if (!authCheck.authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - insufficient permissions to create categories' })
        };
      }

      if (categoryId && eventId && !categoryData.name) {
        // Copy existing global category to event
        const { Items: existingCategories } = await ddb.send(new ScanCommand({
          TableName: CATEGORIES_TABLE,
          FilterExpression: 'categoryId = :categoryId AND eventId = :globalEventId',
          ExpressionAttributeValues: {
            ':categoryId': categoryId,
            ':globalEventId': 'global'
          },
          Limit: 1
        }));
        
        if (existingCategories && existingCategories.length > 0) {
          const sourceCategory = existingCategories[0];
          const item = {
            categoryId,
            eventId,
            name: sourceCategory.name,
            description: sourceCategory.description,
            requirements: sourceCategory.requirements,
            minAge: sourceCategory.minAge,
            maxAge: sourceCategory.maxAge,
            gender: sourceCategory.gender,
            ageRange: sourceCategory.ageRange,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await ddb.send(new PutCommand({
            TableName: CATEGORIES_TABLE,
            Item: item
          }));
          
          logger.info('Category copied to event', { categoryId, eventId });
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ message: 'Category added to event successfully', category: item })
          };
        } else {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Global category not found' })
          };
        }
      }

      // Create new category
      const newCategoryId = categoryId || `cat-${Date.now()}`;
      const item = {
        categoryId: newCategoryId,
        eventId: eventId || 'global',
        name: categoryData.name,
        description: categoryData.description,
        requirements: categoryData.requirements,
        minAge: categoryData.minAge,
        maxAge: categoryData.maxAge,
        gender: categoryData.gender,
        ageRange: categoryData.ageRange,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: CATEGORIES_TABLE,
        Item: item
      }));
      
      logger.info('Category created', { categoryId: newCategoryId, eventId: item.eventId });
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ message: 'Category created successfully', category: item })
      };
    }

    // List all categories - /categories
    if (path === '' && method === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      
      if (eventId) {
        // Check authorization for reading event categories
        const authCheck = await checkCategoryAccess(userId, userEmail, 'read', eventId);
        
        if (!authCheck.authorized) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ message: 'Access denied - insufficient permissions to view event categories' })
          };
        }

        // Get categories for specific event
        const { Items } = await ddb.send(new QueryCommand({
          TableName: CATEGORIES_TABLE,
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
      } else {
        // Get all categories (deduplicated)
        const { Items } = await ddb.send(new ScanCommand({
          TableName: CATEGORIES_TABLE
        }));
        
        // Deduplicate categories by categoryId
        const uniqueCategories = [];
        const seenIds = new Set();
        
        for (const item of Items || []) {
          if (!seenIds.has(item.categoryId)) {
            seenIds.add(item.categoryId);
            uniqueCategories.push(item);
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(uniqueCategories)
        };
      }
    }
    
    // Update category - /categories/{categoryId}
    if (path.match(/^\/[^/]+$/) && method === 'PUT') {
      const categoryId = path.split('/')[1];
      const body = JSON.parse(event.body || '{}');

      // Validate required eventId
      if (!body.eventId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'eventId is required for category updates' })
        };
      }

      // Check authorization for category update
      const authCheck = await checkCategoryAccess(userId, userEmail, 'update', body.eventId);
      if (!authCheck.authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - insufficient permissions to update categories' })
        };
      }
      
      if (body.eventId && !body.name) {
        // Adding existing category to event - copy category data from global template
        const { Items: existingCategories } = await ddb.send(new ScanCommand({
          TableName: CATEGORIES_TABLE,
          FilterExpression: 'categoryId = :categoryId AND eventId = :globalEventId',
          ExpressionAttributeValues: {
            ':categoryId': categoryId,
            ':globalEventId': 'global'
          },
          Limit: 1
        }));
        
        if (existingCategories && existingCategories.length > 0) {
          const sourceCategory = existingCategories[0];
          const item = {
            categoryId,
            eventId: body.eventId,
            name: sourceCategory.name,
            description: sourceCategory.description,
            requirements: sourceCategory.requirements,
            minAge: sourceCategory.minAge,
            maxAge: sourceCategory.maxAge,
            gender: sourceCategory.gender,
            maxParticipants: body.maxParticipants || null,
            updatedAt: new Date().toISOString(),
            createdAt: sourceCategory.createdAt
          };
          
          await ddb.send(new PutCommand({
            TableName: CATEGORIES_TABLE,
            Item: item
          }));
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Category added to event successfully' })
          };
        }
      }
      
      // Regular category update with full data
      const item = {
        categoryId,
        eventId: body.eventId,
        name: body.name,
        description: body.description,
        requirements: body.requirements,
        minAge: body.minAge,
        maxAge: body.maxAge,
        gender: body.gender,
        maxParticipants: body.maxParticipants || null,
        updatedAt: new Date().toISOString(),
        createdAt: body.createdAt || new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: CATEGORIES_TABLE,
        Item: item
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Category updated successfully' })
      };
    }
    
    // Delete category - /categories/{categoryId}
    if (path.match(/^\/[^/]+$/) && method === 'DELETE') {
      const categoryId = path.split('/')[1];
      const eventId = event.queryStringParameters?.eventId;

      // Check authorization for category deletion
      const authCheck = await checkCategoryAccess(userId, userEmail, 'delete', eventId);
      if (!authCheck.authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied - insufficient permissions to delete categories' })
        };
      }
      
      if (eventId) {
        // Delete specific category-event relationship
        await ddb.send(new DeleteCommand({
          TableName: CATEGORIES_TABLE,
          Key: { eventId, categoryId }
        }));
        
        logger.info('Category removed from event', { categoryId, eventId });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Category removed from event successfully' })
        };
      } else {
        // Delete all instances of this category (across events)
        const { Items: categories } = await ddb.send(new ScanCommand({
          TableName: CATEGORIES_TABLE,
          FilterExpression: 'categoryId = :categoryId',
          ExpressionAttributeValues: {
            ':categoryId': categoryId
          }
        }));
        
        if (!categories || categories.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Category not found' })
          };
        }
        
        // Delete all instances of this category
        for (const category of categories) {
          await ddb.send(new DeleteCommand({
            TableName: CATEGORIES_TABLE,
            Key: { eventId: category.eventId, categoryId: category.categoryId }
          }));
        }
        
        logger.info('Category deleted completely', { categoryId, deletedInstances: categories.length });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Category deleted successfully' })
        };
      }
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: 'Not found', path, method })
    };
    
  } catch (error) {
    logger.error('Categories service error', { 
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
