const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const logger = require('../shared/utils/logger');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const eventbridge = new EventBridgeClient({});

const WODS_TABLE = process.env.WODS_TABLE;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';

exports.handler = async (event) => {
  logger.info('WODs EventBridge handler triggered', { event });

  try {
    for (const record of event.Records || [event]) {
      const { source, 'detail-type': detailType, detail } = record;
      
      if (source === 'scheduler.orchestrator' && detailType === 'WODs Data Requested') {
        await handleWodsDataRequest(detail);
      }
    }

    return { statusCode: 200, body: 'WODs events processed' };
  } catch (error) {
    logger.error('WODs EventBridge handler error', { error: error.message, stack: error.stack });
    throw error;
  }
};

async function handleWodsDataRequest(detail) {
  const { eventId, requestId } = detail;
  
  logger.info('Processing WODs data request', { eventId, requestId });

  try {
    // Get WODs for the event
    const { Items: wods } = await dynamodb.send(new QueryCommand({
      TableName: WODS_TABLE,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));

    const processedWods = wods || [];

    logger.info('WODs data retrieved', { 
      eventId, 
      wodsCount: processedWods.length,
      wods: processedWods.map(w => ({ 
        wodId: w.wodId, 
        name: w.name,
        dayId: w.dayId,
        estimatedDuration: w.estimatedDuration,
        type: w.type,
        scoringType: w.scoringType
      }))
    });

    await publishWodsResponse(requestId, eventId, processedWods);

  } catch (error) {
    logger.error('Error processing WODs data request', { 
      eventId, 
      requestId, 
      error: error.message 
    });
    
    // Publish error response
    await publishWodsResponse(requestId, eventId, [], error.message);
  }
}

async function publishWodsResponse(requestId, eventId, wods, error = null) {
  const eventDetail = {
    requestId,
    eventId,
    wods,
    timestamp: new Date().toISOString()
  };

  if (error) {
    eventDetail.error = error;
  }

  await eventbridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'wods.domain',
      DetailType: error ? 'WODs Data Error' : 'WODs Data Response',
      Detail: JSON.stringify(eventDetail),
      EventBusName: EVENT_BUS_NAME
    }]
  }));

  logger.info('WODs response published', { 
    requestId, 
    eventId, 
    wodsCount: wods.length,
    hasError: !!error 
  });
}
