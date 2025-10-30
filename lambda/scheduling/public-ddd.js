const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Infrastructure
const { DynamoScheduleRepository } = require('./scheduler/infrastructure/repositories/DynamoScheduleRepository');

// Initialize infrastructure
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const scheduleRepository = new DynamoScheduleRepository(dynamoClient, process.env.SCHEDULES_TABLE);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const { httpMethod, pathParameters } = event;
    
    // Extract eventId and scheduleId from proxy path
    const proxy = pathParameters?.proxy;
    const pathParts = proxy ? proxy.split('/') : [];
    const eventId = pathParts[0];
    const scheduleId = pathParts[1];

    console.log('Public schedules request:', { httpMethod, eventId, scheduleId });

    if (httpMethod !== 'GET') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Get published schedules for an event
    if (eventId && !scheduleId) {
      const schedules = await scheduleRepository.findPublishedByEventId(eventId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(schedules.map(s => s.toSnapshot()))
      };
    }

    // Get specific published schedule
    if (eventId && scheduleId) {
      const schedule = await scheduleRepository.findById(eventId, scheduleId);
      
      if (!schedule || schedule.status !== 'PUBLISHED') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Schedule not found or not published' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(schedule.toSnapshot())
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Public schedules error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
