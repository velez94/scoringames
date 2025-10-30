const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const logger = require('./utils/logger');

const eventBridge = new EventBridgeClient({});
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const EVENT_DAYS_TABLE = process.env.EVENT_DAYS_TABLE;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';

// EventBridge handler for Events domain
exports.handler = async (event) => {
  logger.info('Events EventBridge handler triggered', { event });

  try {
    for (const record of event.Records || [event]) {
      const { source, 'detail-type': detailType, detail } = record;
      
      if (source === 'scheduler.orchestrator' && detailType === 'Event Data Requested') {
        await handleEventDataRequest(detail);
      }
    }

    return { statusCode: 200, body: 'Events processed' };

  } catch (error) {
    logger.error('Events EventBridge handler error', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

async function handleEventDataRequest(detail) {
  const { eventId, requestId } = detail;
  
  logger.info('Processing event data request', { eventId, requestId });

  try {
    // Get event data
    const { Item: eventData } = await ddb.send(new GetCommand({
      TableName: EVENTS_TABLE,
      Key: { eventId }
    }));

    if (!eventData) {
      throw new Error(`Event not found: ${eventId}`);
    }

    // Try to get existing event days first
    let days = [];
    if (EVENT_DAYS_TABLE) {
      try {
        const { Items: existingDays } = await ddb.send(new QueryCommand({
          TableName: EVENT_DAYS_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        }));
        days = existingDays || [];
      } catch (error) {
        logger.warn('Could not fetch event days from table', { error: error.message });
      }
    }

    // Auto-generate days from event dates if no existing days found
    if (days.length === 0 && eventData.startDate && eventData.endDate) {
      const startDate = new Date(eventData.startDate);
      const endDate = new Date(eventData.endDate);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayId = `day-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayName = `Day ${days.length + 1}`;
        
        days.push({
          dayId,
          name: dayName,
          date: d.toISOString().split('T')[0],
          eventId
        });
      }
      
      logger.info('Auto-generated event days', { eventId, daysCount: days.length });
    }

    logger.info('Event data retrieved', { 
      eventId, 
      requestId,
      daysCount: days.length,
      eventName: eventData.name
    });

    await publishEventResponse(requestId, eventId, eventData, days);

  } catch (error) {
    logger.error('Failed to collect event data', { 
      eventId, 
      requestId, 
      error: error.message 
    });
    
    // Publish error response
    await publishEventResponse(requestId, eventId, null, [], error.message);
  }
}

async function publishEventResponse(requestId, eventId, event, days, error = null) {
  const eventDetail = {
    requestId,
    eventId,
    event,
    days,
    timestamp: new Date().toISOString()
  };

  if (error) {
    eventDetail.error = error;
  }

  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'events.domain',
      DetailType: error ? 'Event Data Error' : 'Event Data Response',
      Detail: JSON.stringify(eventDetail),
      EventBusName: EVENT_BUS_NAME
    }]
  }));

  logger.info('Event response published', { 
    requestId, 
    eventId, 
    daysCount: days.length,
    hasError: !!error 
  });
}
