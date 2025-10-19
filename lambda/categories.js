const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  logger.info('Categories service request', { 
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
  
  // Clean path - remove /categories prefix if present
  if (path.startsWith('/categories')) {
    path = path.substring('/categories'.length);
  }
  
  const method = event.httpMethod;
  
  try {
    // List all categories - /categories
    if (path === '' && method === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      
      if (eventId) {
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
      
      if (body.eventId && !body.name) {
        // Adding existing category to event - copy category data
        const { Items: existingCategories } = await ddb.send(new ScanCommand({
          TableName: CATEGORIES_TABLE,
          FilterExpression: 'categoryId = :categoryId',
          ExpressionAttributeValues: {
            ':categoryId': categoryId
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
