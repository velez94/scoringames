const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./utils/logger');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const ATHLETES_TABLE = process.env.ATHLETES_TABLE;
const ATHLETE_EVENTS_TABLE = process.env.ATHLETE_EVENTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const WODS_TABLE = process.env.WODS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

const checkOrgAccess = async (organizationId, userId, email) => {
  const isSuperAdmin = email === 'admin@scoringames.com';
  if (isSuperAdmin) return { hasAccess: true, role: 'super_admin' };

  const { Item } = await ddb.send(new GetCommand({
    TableName: ORGANIZATION_MEMBERS_TABLE,
    Key: { organizationId, userId }
  }));

  return { hasAccess: !!Item, role: Item?.role };
};

exports.handler = async (event) => {
  logger.info('Analytics service request', { 
    method: event.httpMethod, 
    path: event.path 
  });

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const userId = event.requestContext?.authorizer?.claims?.sub;
  const email = event.requestContext?.authorizer?.claims?.email;
  const organizationId = event.queryStringParameters?.organizationId;

  if (!organizationId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'organizationId is required' })
    };
  }

  try {
    const isSuperAdmin = email === 'admin@scoringames.com';
    let eventIds = [];

    if (organizationId === 'all' && isSuperAdmin) {
      // Super admin viewing all organizations - get all events
      const { Items: allEvents } = await ddb.send(new ScanCommand({
        TableName: EVENTS_TABLE,
        ProjectionExpression: 'eventId'
      }));
      eventIds = allEvents?.map(e => e.eventId) || [];
    } else {
      // Check organization access
      const { hasAccess } = await checkOrgAccess(organizationId, userId, email);
      if (!hasAccess) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ message: 'Access denied to organization' })
        };
      }

      // Get organization events
      const { Items: orgEvents } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: { ':organizationId': organizationId }
      }));
      eventIds = orgEvents?.map(e => e.eventId) || [];
    }
    
    if (eventIds.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          events: [],
          athletes: [],
          categories: [],
          wods: [],
          scores: [],
          stats: { totalEvents: 0, totalAthletes: 0, totalWods: 0, totalScores: 0 }
        })
      };
    }

    // Fetch all data in parallel
    const [eventsData, athletesData, categoriesData, wodsData, scoresData] = await Promise.all([
      // Events
      Promise.all(eventIds.map(eventId => 
        ddb.send(new GetCommand({
          TableName: EVENTS_TABLE,
          Key: { eventId }
        })).then(result => result.Item).catch(() => null)
      )),
      
      // Athletes (get all registered for org events)
      Promise.all(eventIds.map(eventId =>
        ddb.send(new QueryCommand({
          TableName: ATHLETE_EVENTS_TABLE,
          IndexName: 'event-athletes-index',
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        })).then(result => result.Items || []).catch(() => [])
      )).then(results => results.flat()),

      // Categories (for org events)
      Promise.all(eventIds.map(eventId =>
        ddb.send(new QueryCommand({
          TableName: CATEGORIES_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        })).then(result => result.Items || []).catch(() => [])
      )).then(results => results.flat()),

      // WODs (for org events)
      Promise.all(eventIds.map(eventId =>
        ddb.send(new QueryCommand({
          TableName: WODS_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        })).then(result => result.Items || []).catch(() => [])
      )).then(results => results.flat()),

      // Scores (for org events)
      Promise.all(eventIds.map(eventId =>
        ddb.send(new QueryCommand({
          TableName: SCORES_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: { ':eventId': eventId }
        })).then(result => result.Items || []).catch(() => [])
      )).then(results => results.flat())
    ]);

    // Get unique athlete details
    const uniqueAthleteIds = [...new Set(athletesData.map(a => a.userId))];
    const athleteDetails = await Promise.all(
      uniqueAthleteIds.map(athleteId =>
        ddb.send(new GetCommand({
          TableName: ATHLETES_TABLE,
          Key: { userId: athleteId }
        })).then(result => result.Item ? { ...result.Item, athleteId: result.Item.userId } : null).catch(() => null)
      )
    );

    const events = eventsData.filter(Boolean);
    const athletes = athleteDetails.filter(Boolean);
    const categories = categoriesData;
    const wods = wodsData;
    const scores = scoresData;

    // Calculate stats
    const stats = {
      totalEvents: events.length,
      totalAthletes: athletes.length,
      totalWods: wods.length,
      totalScores: scores.length,
      activeEvents: events.filter(e => e.status === 'active').length,
      completedEvents: events.filter(e => e.status === 'completed').length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events,
        athletes,
        categories,
        wods,
        scores,
        stats
      })
    };

  } catch (error) {
    logger.error('Analytics error', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
