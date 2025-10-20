const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Infrastructure
const { DynamoScheduleRepository } = require('./scheduler/infrastructure/repositories/DynamoScheduleRepository');
const { EventPublisher } = require('./scheduler/infrastructure/EventPublisher');

// Application Services
const { ScheduleApplicationService } = require('./scheduler/application/ScheduleApplicationService');
const { EventDataService } = require('./scheduler/application/EventDataService');

// Initialize infrastructure
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const scheduleRepository = new DynamoScheduleRepository(dynamoClient, process.env.SCHEDULES_TABLE);
const eventDataService = new EventDataService(dynamoClient);
const eventPublisher = new EventPublisher();

// Initialize application service
const scheduleService = new ScheduleApplicationService(
  scheduleRepository,
  eventDataService,
  eventPublisher,
  dynamoClient // Pass DynamoDB client for ScoreService
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, pathParameters, body } = event;
    const requestBody = body ? JSON.parse(body) : {};
    
    // Extract path parameters
    const proxy = pathParameters?.proxy;
    const pathParts = proxy ? proxy.split('/') : [];
    const eventId = pathParts[0];
    const scheduleId = pathParts[1];
    const action = pathParts[2];

    console.log('Schedule request:', { httpMethod, eventId, scheduleId, action });

    // Route requests to application service
    switch (true) {
      // Generate new schedule
      case httpMethod === 'POST' && eventId && !scheduleId:
        const schedule = await scheduleService.generateSchedule(eventId, requestBody);
        return { 
          statusCode: 201, 
          headers, 
          body: JSON.stringify(schedule.toSnapshot()) 
        };

      // Get all schedules for event
      case httpMethod === 'GET' && eventId && !scheduleId:
        const schedules = await scheduleService.getSchedulesByEvent(eventId);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify(schedules.map(s => s.toSnapshot())) 
        };

      // Get specific schedule
      case httpMethod === 'GET' && eventId && scheduleId && !action:
        const foundSchedule = await scheduleService.getSchedule(eventId, scheduleId);
        if (!foundSchedule) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Schedule not found' }) };
        }
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify(foundSchedule.toSnapshot()) 
        };

      // Update schedule
      case httpMethod === 'PUT' && eventId && scheduleId && !action:
        const updatedSchedule = await scheduleService.updateSchedule(eventId, scheduleId, requestBody);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify(updatedSchedule.toSnapshot()) 
        };

      // Delete schedule
      case httpMethod === 'DELETE' && eventId && scheduleId && !action:
        await scheduleService.deleteSchedule(eventId, scheduleId);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ success: true }) 
        };

      // Publish schedule
      case httpMethod === 'POST' && eventId && scheduleId && action === 'publish':
        const publishedSchedule = await scheduleService.publishSchedule(eventId, scheduleId);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ published: true }) 
        };

      // Unpublish schedule
      case httpMethod === 'POST' && eventId && scheduleId && action === 'unpublish':
        const unpublishedSchedule = await scheduleService.unpublishSchedule(eventId, scheduleId);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ published: false }) 
        };

      // Process tournament results (scores loaded from Score domain)
      case httpMethod === 'POST' && eventId && scheduleId && action === 'process-results':
        const { filterId } = requestBody;
        if (!filterId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'filterId required' }) };
        }
        const tournamentResult = await scheduleService.processTournamentResults(eventId, scheduleId, filterId);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify(tournamentResult) 
        };

      // Generate next tournament stage
      case httpMethod === 'POST' && eventId && scheduleId && action === 'next-stage':
        const { startTime } = requestBody;
        const nextStageSchedule = await scheduleService.generateNextTournamentStage(
          eventId, 
          scheduleId, 
          startTime || '09:00'
        );
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify(nextStageSchedule.toSnapshot()) 
        };

      // Get tournament bracket
      case httpMethod === 'GET' && eventId && scheduleId && action === 'bracket':
        const bracket = await scheduleService.getTournamentBracket(eventId, scheduleId);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify(bracket) 
        };

      default:
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Not found' }) 
        };
    }

  } catch (error) {
    console.error('Schedule service error:', error);
    
    return {
      statusCode: error.message.includes('not found') ? 404 : 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
