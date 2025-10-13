const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;
const ATHLETES_TABLE = process.env.ATHLETES_TABLE;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  try {
    const { httpMethod, resource, pathParameters, body } = event;
    const requestBody = body ? JSON.parse(body) : {};

    switch (resource) {
      case '/events':
        if (httpMethod === 'GET') return await getEvents();
        if (httpMethod === 'POST') return await createEvent(requestBody);
        break;

      case '/events/{eventId}':
        const eventId = pathParameters.eventId;
        if (httpMethod === 'GET') return await getEvent(eventId);
        if (httpMethod === 'PUT') return await updateEvent(eventId, requestBody);
        break;

      case '/scores':
        if (httpMethod === 'GET') return await getScores(event.queryStringParameters);
        if (httpMethod === 'POST') return await submitScore(requestBody);
        break;

      case '/scores/leaderboard':
        if (httpMethod === 'GET') return await getLeaderboard(event.queryStringParameters);
        break;

      case '/athletes':
        if (httpMethod === 'GET') return await getAthletes();
        if (httpMethod === 'POST') return await createAthlete(requestBody);
        break;
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

async function getEvents() {
  const result = await dynamodb.scan({ TableName: EVENTS_TABLE }).promise();
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function createEvent(event) {
  const eventData = {
    eventId: generateId(),
    name: event.name,
    date: event.date,
    workouts: event.workouts || [],
    divisions: event.divisions || [],
    status: 'upcoming',
    createdAt: new Date().toISOString()
  };

  await dynamodb.put({ TableName: EVENTS_TABLE, Item: eventData }).promise();
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(eventData) };
}

async function getEvent(eventId) {
  const result = await dynamodb.get({ TableName: EVENTS_TABLE, Key: { eventId } }).promise();
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Item) };
}

async function updateEvent(eventId, updates) {
  const params = {
    TableName: EVENTS_TABLE,
    Key: { eventId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': updates.status, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
}

async function getScores(queryParams) {
  const eventId = queryParams?.eventId;
  if (!eventId) {
    return { statusCode: 400, headers: getHeaders(), body: JSON.stringify({ error: 'eventId required' }) };
  }

  const result = await dynamodb.query({
    TableName: SCORES_TABLE,
    KeyConditionExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId }
  }).promise();

  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function submitScore(scoreData) {
  const score = {
    eventId: scoreData.eventId,
    athleteId: scoreData.athleteId,
    workoutId: scoreData.workoutId,
    score: scoreData.score,
    time: scoreData.time,
    reps: scoreData.reps,
    division: scoreData.division,
    submittedAt: new Date().toISOString()
  };

  await dynamodb.put({ TableName: SCORES_TABLE, Item: score }).promise();
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(score) };
}

async function getLeaderboard(queryParams) {
  const eventId = queryParams?.eventId;
  const division = queryParams?.division;

  let params = {
    TableName: SCORES_TABLE,
    KeyConditionExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId }
  };

  if (division) {
    params.FilterExpression = 'division = :division';
    params.ExpressionAttributeValues[':division'] = division;
  }

  const result = await dynamodb.query(params).promise();
  const sortedScores = result.Items.sort((a, b) => b.score - a.score);

  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(sortedScores) };
}

async function getAthletes() {
  const result = await dynamodb.scan({ TableName: ATHLETES_TABLE }).promise();
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function createAthlete(athlete) {
  const athleteData = {
    athleteId: generateId(),
    name: athlete.name,
    email: athlete.email,
    division: athlete.division,
    personalBests: {},
    createdAt: new Date().toISOString()
  };

  await dynamodb.put({ TableName: ATHLETES_TABLE, Item: athleteData }).promise();
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(athleteData) };
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };
}
