const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridge = new EventBridgeClient({});

const TOURNAMENT_RESULTS_TABLE = process.env.TOURNAMENT_RESULTS_TABLE;
const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path || '';
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // POST /tournament-results/{eventId}/{scheduleId}/match-result
    if (method === 'POST' && path.includes('/match-result')) {
      return await submitMatchResult(event, headers);
    }
    
    // GET /tournament-results/{eventId}/{scheduleId}/standings
    if (method === 'GET' && path.includes('/standings')) {
      return await getTournamentStandings(event, headers);
    }
    
    // POST /tournament-results/{eventId}/{scheduleId}/advance-tournament
    if (method === 'POST' && path.includes('/advance-tournament')) {
      return await advanceTournament(event, headers);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: 'Endpoint not found' })
    };

  } catch (error) {
    console.error('Tournament Results Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};

async function submitMatchResult(event, headers) {
  const { eventId, scheduleId } = event.pathParameters;
  const { matchId, winnerId, loserId, scores } = JSON.parse(event.body);

  // Store match result
  const matchResult = {
    eventId,
    scheduleId,
    matchId,
    winnerId,
    loserId,
    scores,
    submittedAt: new Date().toISOString(),
    submittedBy: event.requestContext.authorizer?.claims?.sub
  };

  await ddb.send(new PutCommand({
    TableName: TOURNAMENT_RESULTS_TABLE,
    Item: {
      PK: `EVENT#${eventId}#SCHEDULE#${scheduleId}`,
      SK: `MATCH#${matchId}`,
      ...matchResult
    }
  }));

  // Publish domain event
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'tournament.results',
      DetailType: 'Match Result Submitted',
      Detail: JSON.stringify({
        eventId,
        scheduleId,
        matchId,
        winnerId,
        loserId,
        timestamp: new Date().toISOString()
      })
    }]
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Match result submitted', matchResult })
  };
}

async function getTournamentStandings(event, headers) {
  const { eventId, scheduleId } = event.pathParameters;

  // Get all match results for this tournament
  const { Items } = await ddb.send(new QueryCommand({
    TableName: TOURNAMENT_RESULTS_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}#SCHEDULE#${scheduleId}`,
      ':sk': 'MATCH#'
    }
  }));

  // Calculate tournament standings by category
  const standings = calculateTournamentStandings(Items);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ standings })
  };
}

async function advanceTournament(event, headers) {
  const { eventId, scheduleId } = event.pathParameters;
  const { filterNumber, matchResults } = JSON.parse(event.body);

  // Process elimination results and advance tournament
  const advancementResults = await processTournamentAdvancement(
    eventId, 
    scheduleId, 
    filterNumber, 
    matchResults
  );

  // Publish tournament advancement event
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'tournament.results',
      DetailType: 'Tournament Advanced',
      Detail: JSON.stringify({
        eventId,
        scheduleId,
        filterNumber,
        advancingAthletes: advancementResults.advancingAthletes,
        eliminatedAthletes: advancementResults.eliminatedAthletes,
        timestamp: new Date().toISOString()
      })
    }]
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ 
      message: 'Tournament advanced successfully',
      results: advancementResults 
    })
  };
}

function calculateTournamentStandings(matchResults) {
  const standings = {};
  
  matchResults.forEach(result => {
    const { winnerId, loserId, categoryId } = result;
    
    if (!standings[categoryId]) {
      standings[categoryId] = {};
    }
    
    // Winner gets +1 win
    if (!standings[categoryId][winnerId]) {
      standings[categoryId][winnerId] = { wins: 0, losses: 0 };
    }
    standings[categoryId][winnerId].wins++;
    
    // Loser gets +1 loss
    if (loserId && !standings[categoryId][loserId]) {
      standings[categoryId][loserId] = { wins: 0, losses: 0 };
    }
    if (loserId) {
      standings[categoryId][loserId].losses++;
    }
  });
  
  return standings;
}

async function processTournamentAdvancement(eventId, scheduleId, filterNumber, matchResults) {
  // Implementation for processing tournament advancement logic
  const advancingAthletes = [];
  const eliminatedAthletes = [];
  
  matchResults.forEach(result => {
    advancingAthletes.push(result.winnerId);
    if (result.loserId) {
      eliminatedAthletes.push(result.loserId);
    }
  });
  
  return { advancingAthletes, eliminatedAthletes };
}
