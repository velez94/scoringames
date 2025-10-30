const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const logger = require('./utils/logger');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const eventbridge = new EventBridgeClient({});

const ATHLETES_TABLE = process.env.ATHLETES_TABLE;
const ATHLETE_EVENTS_TABLE = process.env.ATHLETE_EVENTS_TABLE;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';

exports.handler = async (event) => {
  logger.info('Athletes EventBridge handler triggered', { event });

  try {
    for (const record of event.Records || [event]) {
      const { source, 'detail-type': detailType, detail } = record;
      
      if (source === 'scheduler.orchestrator' && detailType === 'Athletes Data Requested') {
        await handleAthletesDataRequest(detail);
      }
    }

    return { statusCode: 200, body: 'Athletes events processed' };
  } catch (error) {
    logger.error('Athletes EventBridge handler error', { error: error.message, stack: error.stack });
    throw error;
  }
};

async function handleAthletesDataRequest(detail) {
  const { eventId, requestId } = detail;
  
  logger.info('Processing athletes data request', { eventId, requestId });

  try {
    // Get registered athletes for the event
    const { Items: athleteRegistrations } = await dynamodb.send(new QueryCommand({
      TableName: ATHLETE_EVENTS_TABLE,
      IndexName: 'event-athletes-index',
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));

    if (!athleteRegistrations || athleteRegistrations.length === 0) {
      logger.warn('No registered athletes found', { eventId });
      await publishAthletesResponse(requestId, eventId, []);
      return;
    }

    // Get athlete details for each registration
    const athletes = [];
    for (const registration of athleteRegistrations) {
      try {
        const { Item: athlete } = await dynamodb.send(new QueryCommand({
          TableName: ATHLETES_TABLE,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': registration.userId }
        }));

        if (athlete) {
          athletes.push({
            ...athlete,
            categoryId: registration.categoryId, // Use category from registration
            registrationDate: registration.registrationDate,
            status: registration.status
          });
        }
      } catch (error) {
        logger.error('Error fetching athlete details', { 
          userId: registration.userId, 
          error: error.message 
        });
      }
    }

    logger.info('Athletes data retrieved', { 
      eventId, 
      athletesCount: athletes.length,
      athletes: athletes.map(a => ({ 
        userId: a.userId, 
        name: `${a.firstName} ${a.lastName}`,
        categoryId: a.categoryId 
      }))
    });

    await publishAthletesResponse(requestId, eventId, athletes);

  } catch (error) {
    logger.error('Error processing athletes data request', { 
      eventId, 
      requestId, 
      error: error.message 
    });
    
    // Publish error response
    await publishAthletesResponse(requestId, eventId, [], error.message);
  }
}

async function publishAthletesResponse(requestId, eventId, athletes, error = null) {
  const eventDetail = {
    requestId,
    eventId,
    athletes,
    timestamp: new Date().toISOString()
  };

  if (error) {
    eventDetail.error = error;
  }

  await eventbridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'athletes.domain',
      DetailType: error ? 'Athletes Data Error' : 'Athletes Data Response',
      Detail: JSON.stringify(eventDetail),
      EventBusName: EVENT_BUS_NAME
    }]
  }));

  logger.info('Athletes response published', { 
    requestId, 
    eventId, 
    athletesCount: athletes.length,
    hasError: !!error 
  });
}
