// NO DIRECT TABLE ACCESS - Only API calls to other domains
const API_BASE_URL = process.env.API_BASE_URL;

exports.handler = async (event) => {
  const { eventId, scheduleId } = event.pathParameters || {};
  const leaderboardType = event.queryStringParameters?.type || 'combined';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let leaderboard;

    switch (leaderboardType) {
      case 'general':
        leaderboard = await getGeneralLeaderboard(eventId, event.headers.Authorization);
        break;
      case 'tournament':
        leaderboard = await getTournamentLeaderboard(eventId, scheduleId, event.headers.Authorization);
        break;
      case 'combined':
      default:
        leaderboard = await getCombinedLeaderboard(eventId, scheduleId, event.headers.Authorization);
        break;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        leaderboard,
        type: leaderboardType,
        eventId,
        scheduleId 
      })
    };

  } catch (error) {
    console.error('Leaderboard Integration Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};

async function getGeneralLeaderboard(eventId, authToken) {
  // Call Scoring Domain API - respects bounded context
  const response = await fetch(`${API_BASE_URL}/scores/leaderboard/${eventId}`, {
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get general leaderboard: ${response.statusText}`);
  }

  const data = await response.json();
  return data.leaderboard || [];
}

async function getTournamentLeaderboard(eventId, scheduleId, authToken) {
  if (!scheduleId) return [];

  // Call Tournament Domain API - respects bounded context
  const response = await fetch(`${API_BASE_URL}/tournament-leaderboard/${eventId}/${scheduleId}`, {
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get tournament leaderboard: ${response.statusText}`);
  }

  const data = await response.json();
  return data.leaderboard || [];
}

async function getCombinedLeaderboard(eventId, scheduleId, authToken) {
  // Call both domain APIs in parallel - no direct table access
  const [generalLeaderboard, tournamentLeaderboard] = await Promise.all([
    getGeneralLeaderboard(eventId, authToken),
    getTournamentLeaderboard(eventId, scheduleId, authToken)
  ]);

  // Group by category for better presentation
  const combinedByCategory = {};

  // Add general rankings
  generalLeaderboard.forEach(athlete => {
    const categoryId = athlete.categoryId || 'uncategorized';
    if (!combinedByCategory[categoryId]) {
      combinedByCategory[categoryId] = {
        categoryId,
        general: [],
        tournament: []
      };
    }
    combinedByCategory[categoryId].general.push(athlete);
  });

  // Add tournament rankings
  tournamentLeaderboard.forEach(athlete => {
    const categoryId = athlete.categoryId || 'uncategorized';
    if (!combinedByCategory[categoryId]) {
      combinedByCategory[categoryId] = {
        categoryId,
        general: [],
        tournament: []
      };
    }
    combinedByCategory[categoryId].tournament.push(athlete);
  });

  return combinedByCategory;
}
