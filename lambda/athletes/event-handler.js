const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../shared/utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const ATHLETE_EVENTS_TABLE = process.env.ATHLETE_EVENTS_TABLE;

exports.handler = async (event) => {
  logger.info('Athletes domain event handler', { event });
  
  for (const record of event.Records) {
    const eventDetail = JSON.parse(record.body);
    
    if (eventDetail['detail-type'] === 'EventDeletionRequested') {
      const { eventId } = eventDetail.detail;
      
      // Delete athlete registrations for this event
      const { Items: registrations } = await ddb.send(new QueryCommand({
        TableName: ATHLETE_EVENTS_TABLE,
        IndexName: 'event-athletes-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      
      for (const registration of registrations || []) {
        await ddb.send(new DeleteCommand({
          TableName: ATHLETE_EVENTS_TABLE,
          Key: { 
            userId: registration.userId,
            eventId: registration.eventId
          }
        }));
      }
      
      logger.info('Athletes cleanup completed', { 
        eventId, 
        registrationsRemoved: registrations?.length || 0 
      });
    }
  }
  
  return { statusCode: 200 };
};
