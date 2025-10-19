const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const logger = require('./utils/logger');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const eventbridge = new EventBridgeClient({});

const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';

exports.handler = async (event) => {
  logger.info('Categories EventBridge handler triggered', { event });

  try {
    for (const record of event.Records || [event]) {
      const { source, 'detail-type': detailType, detail } = record;
      
      if (source === 'scheduler.orchestrator' && detailType === 'Categories Data Requested') {
        await handleCategoriesDataRequest(detail);
      }
    }

    return { statusCode: 200, body: 'Categories events processed' };
  } catch (error) {
    logger.error('Categories EventBridge handler error', { error: error.message, stack: error.stack });
    throw error;
  }
};

async function handleCategoriesDataRequest(detail) {
  const { eventId, requestId } = detail;
  
  logger.info('Processing categories data request', { eventId, requestId });

  try {
    // Get categories for the event
    const { Items: categories } = await dynamodb.send(new QueryCommand({
      TableName: CATEGORIES_TABLE,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));

    const processedCategories = categories || [];

    logger.info('Categories data retrieved', { 
      eventId, 
      categoriesCount: processedCategories.length,
      categories: processedCategories.map(c => ({ 
        categoryId: c.categoryId, 
        name: c.name,
        minAge: c.minAge,
        maxAge: c.maxAge,
        gender: c.gender
      }))
    });

    await publishCategoriesResponse(requestId, eventId, processedCategories);

  } catch (error) {
    logger.error('Error processing categories data request', { 
      eventId, 
      requestId, 
      error: error.message 
    });
    
    // Publish error response
    await publishCategoriesResponse(requestId, eventId, [], error.message);
  }
}

async function publishCategoriesResponse(requestId, eventId, categories, error = null) {
  const eventDetail = {
    requestId,
    eventId,
    categories,
    timestamp: new Date().toISOString()
  };

  if (error) {
    eventDetail.error = error;
  }

  await eventbridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'categories.domain',
      DetailType: error ? 'Categories Data Error' : 'Categories Data Response',
      Detail: JSON.stringify(eventDetail),
      EventBusName: EVENT_BUS_NAME
    }]
  }));

  logger.info('Categories response published', { 
    requestId, 
    eventId, 
    categoriesCount: categories.length,
    hasError: !!error 
  });
}
