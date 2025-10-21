const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TOURNAMENT_RESULTS_TABLE = process.env.TOURNAMENT_RESULTS_TABLE;
const TOURNAMENT_LEADERBOARD_TABLE = process.env.TOURNAMENT_LEADERBOARD_TABLE;
const ATHLETES_TABLE = process.env.ATHLETES_TABLE;

exports.handler = async (event) => {
  console.log('Tournament Leaderboard Calculator triggered:', JSON.stringify(event, null, 2));

  try {
    // Handle EventBridge events
    if (event.source === 'tournament.results') {
      const { eventId, scheduleId } = event.detail;
      await recalculateTournamentLeaderboard(eventId, scheduleId);
      return { statusCode: 200, body: 'Tournament leaderboard updated' };
    }

    // Handle direct API calls
    const { eventId, scheduleId } = event.pathParameters || {};
    if (eventId && scheduleId) {
      const leaderboard = await getTournamentLeaderboard(eventId, scheduleId);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ leaderboard })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid request' })
    };

  } catch (error) {
    console.error('Tournament Leaderboard Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

async function recalculateTournamentLeaderboard(eventId, scheduleId) {
  console.log(`Recalculating tournament leaderboard for ${eventId}/${scheduleId}`);

  // Get all match results for this tournament
  const { Items: matchResults } = await ddb.send(new QueryCommand({
    TableName: TOURNAMENT_RESULTS_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}#SCHEDULE#${scheduleId}`,
      ':sk': 'MATCH#'
    }
  }));

  // Calculate standings by category
  const categoryStandings = calculateCategoryStandings(matchResults);

  // Store updated leaderboard
  for (const [categoryId, standings] of Object.entries(categoryStandings)) {
    await ddb.send(new PutCommand({
      TableName: TOURNAMENT_LEADERBOARD_TABLE,
      Item: {
        PK: `EVENT#${eventId}#SCHEDULE#${scheduleId}`,
        SK: `CATEGORY#${categoryId}`,
        categoryId,
        standings,
        lastUpdated: new Date().toISOString()
      }
    }));
  }

  console.log(`Tournament leaderboard updated for ${Object.keys(categoryStandings).length} categories`);
}

async function getTournamentLeaderboard(eventId, scheduleId) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: TOURNAMENT_LEADERBOARD_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}#SCHEDULE#${scheduleId}`,
      ':sk': 'CATEGORY#'
    }
  }));

  return Items.reduce((acc, item) => {
    acc[item.categoryId] = item.standings;
    return acc;
  }, {});
}

function calculateCategoryStandings(matchResults) {
  const categoryStandings = {};

  matchResults.forEach(match => {
    const { categoryId, winnerId, loserId, filterNumber } = match;
    
    if (!categoryStandings[categoryId]) {
      categoryStandings[categoryId] = {};
    }

    // Initialize athlete records
    if (!categoryStandings[categoryId][winnerId]) {
      categoryStandings[categoryId][winnerId] = {
        athleteId: winnerId,
        wins: 0,
        losses: 0,
        currentRound: 1,
        eliminated: false,
        placement: null
      };
    }

    if (loserId && !categoryStandings[categoryId][loserId]) {
      categoryStandings[categoryId][loserId] = {
        athleteId: loserId,
        wins: 0,
        losses: 0,
        currentRound: 1,
        eliminated: false,
        placement: null
      };
    }

    // Update win/loss records
    categoryStandings[categoryId][winnerId].wins++;
    categoryStandings[categoryId][winnerId].currentRound = Math.max(
      categoryStandings[categoryId][winnerId].currentRound,
      filterNumber + 1
    );

    if (loserId) {
      categoryStandings[categoryId][loserId].losses++;
      // Mark as eliminated if this was an elimination match
      categoryStandings[categoryId][loserId].eliminated = true;
      categoryStandings[categoryId][loserId].eliminatedInRound = filterNumber;
    }
  });

  // Calculate final rankings for each category
  Object.keys(categoryStandings).forEach(categoryId => {
    const athletes = Object.values(categoryStandings[categoryId]);
    
    // Sort by: not eliminated, then by current round (desc), then by wins (desc)
    athletes.sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }
      if (a.currentRound !== b.currentRound) {
        return b.currentRound - a.currentRound;
      }
      return b.wins - a.wins;
    });

    // Assign placements
    athletes.forEach((athlete, index) => {
      athlete.placement = index + 1;
    });

    // Convert back to object keyed by athleteId
    categoryStandings[categoryId] = athletes.reduce((acc, athlete) => {
      acc[athlete.athleteId] = athlete;
      return acc;
    }, {});
  });

  return categoryStandings;
}
