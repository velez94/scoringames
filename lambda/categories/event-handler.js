const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../shared/utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;

exports.handler = async (event) => {
  logger.info('Categories domain event handler', { event });
  
  for (const record of event.Records) {
    const eventDetail = JSON.parse(record.body);
    
    if (eventDetail['detail-type'] === 'EventDeletionRequested') {
      const { eventId } = eventDetail.detail;
      
      // Delete event-specific categories
      const { Items: categories } = await ddb.send(new QueryCommand({
        TableName: CATEGORIES_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      
      for (const category of categories || []) {
        await ddb.send(new DeleteCommand({
          TableName: CATEGORIES_TABLE,
          Key: {
            eventId: category.eventId,
            categoryId: category.categoryId
          }
        }));
      }
      
      logger.info('Categories cleanup completed', { 
        eventId, 
        categoriesRemoved: categories?.length || 0 
      });
    }
  }
  
  return { statusCode: 200 };
};
