const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../shared/utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const SCORES_TABLE = process.env.SCORES_TABLE;

exports.handler = async (event) => {
  logger.info('Scoring domain event handler', { event });
  
  for (const record of event.Records) {
    const eventDetail = JSON.parse(record.body);
    
    if (eventDetail['detail-type'] === 'EventDeletionRequested') {
      const { eventId } = eventDetail.detail;
      
      // Delete scores for this event
      const { Items: scores } = await ddb.send(new QueryCommand({
        TableName: SCORES_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      
      for (const score of scores || []) {
        await ddb.send(new DeleteCommand({
          TableName: SCORES_TABLE,
          Key: {
            eventId: score.eventId,
            scoreId: score.scoreId
          }
        }));
      }
      
      logger.info('Scoring cleanup completed', { 
        eventId, 
        scoresRemoved: scores?.length || 0 
      });
    }
  }
  
  return { statusCode: 200 };
};
