const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;
const ATHLETES_TABLE = process.env.ATHLETES_TABLE;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { httpMethod, resource, pathParameters, body } = event;
    const requestBody = body ? JSON.parse(body) : {};

    switch (resource) {
      case '/events':
        if (httpMethod === 'GET') return await getEvents();
        if (httpMethod === 'POST') return await createEvent(requestBody);
        break;

      case '/events/{eventId}':
        const eventId = pathParameters?.eventId;
        if (httpMethod === 'GET') return await getEvent(eventId);
        if (httpMethod === 'PUT') return await updateEvent(eventId, requestBody);
        if (httpMethod === 'DELETE') return await deleteEvent(eventId);
        break;

      case '/scores':
        if (httpMethod === 'GET') return await getScores(event.queryStringParameters);
        if (httpMethod === 'POST') return await submitScore(requestBody);
        break;

      case '/scores/{eventId}/{athleteId}':
        const eventIdParam = pathParameters?.eventId;
        const athleteIdParam = pathParameters?.athleteId;
        if (httpMethod === 'PUT') return await updateScore(eventIdParam, athleteIdParam, requestBody);
        break;

      case '/scores/leaderboard':
        if (httpMethod === 'GET') return await getLeaderboard(event.queryStringParameters);
        break;

      case '/athletes':
        if (httpMethod === 'GET') return await getAthletes();
        if (httpMethod === 'POST') return await createAthlete(requestBody);
        break;

      case '/athletes/{athleteId}':
        const athleteId = pathParameters?.athleteId;
        if (httpMethod === 'PUT') return await updateAthlete(athleteId, requestBody);
        if (httpMethod === 'DELETE') return await deleteAthlete(athleteId);
        break;
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error('Lambda error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

async function getEvents() {
  const result = await dynamodb.send(new ScanCommand({ TableName: EVENTS_TABLE }));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function createEvent(event) {
  const eventData = {
    eventId: generateId(),
    name: event.name,
    date: event.date,
    description: event.description || '',
    maxParticipants: event.maxParticipants || 100,
    registrationDeadline: event.registrationDeadline || '',
    workouts: event.workouts || [],
    divisions: event.divisions || [],
    status: event.status || 'upcoming',
    createdAt: new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: eventData }));
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(eventData) };
}

async function getEvent(eventId) {
  const result = await dynamodb.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Item) };
}

async function updateEvent(eventId, updates) {
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = { ':updatedAt': new Date().toISOString() };

  // Build dynamic update expression
  Object.keys(updates).forEach(key => {
    if (key !== 'eventId') {
      updateExpressions.push(`#${key} = :${key}`);
      attributeNames[`#${key}`] = key;
      attributeValues[`:${key}`] = updates[key];
    }
  });

  updateExpressions.push('updatedAt = :updatedAt');

  const params = {
    TableName: EVENTS_TABLE,
    Key: { eventId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.send(new UpdateCommand(params));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
}

async function deleteEvent(eventId) {
  await dynamodb.send(new DeleteCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId }
  }));
  
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify({ message: 'Event deleted successfully' }) };
}

async function getScores(queryParams) {
  const eventId = queryParams?.eventId;
  if (!eventId) {
    return { statusCode: 400, headers: getHeaders(), body: JSON.stringify({ error: 'eventId required' }) };
  }

  const result = await dynamodb.send(new QueryCommand({
    TableName: SCORES_TABLE,
    KeyConditionExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId }
  }));

  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function submitScore(scoreData) {
  const score = {
    eventId: scoreData.eventId,
    athleteId: `${scoreData.athleteId}#${scoreData.workoutId}`, // Composite key to allow multiple WODs
    originalAthleteId: scoreData.athleteId, // Keep original for queries
    workoutId: scoreData.workoutId,
    score: scoreData.score,
    time: scoreData.time,
    reps: scoreData.reps,
    division: scoreData.division,
    submittedAt: new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({ TableName: SCORES_TABLE, Item: score }));
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(score) };
}

async function updateScore(eventId, compositeAthleteId, scoreData) {
  const params = {
    TableName: SCORES_TABLE,
    Key: { 
      eventId: eventId,
      athleteId: compositeAthleteId 
    },
    UpdateExpression: 'SET score = :score, #time = :time, reps = :reps, division = :division, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#time': 'time' // 'time' is a reserved word in DynamoDB
    },
    ExpressionAttributeValues: {
      ':score': scoreData.score,
      ':time': scoreData.time,
      ':reps': scoreData.reps,
      ':division': scoreData.division,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.send(new UpdateCommand(params));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
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

  const result = await dynamodb.send(new QueryCommand(params));
  const sortedScores = result.Items.sort((a, b) => b.score - a.score);

  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(sortedScores) };
}

async function getAthletes() {
  const result = await dynamodb.send(new ScanCommand({ TableName: ATHLETES_TABLE }));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function createAthlete(athlete) {
  const athleteData = {
    athleteId: athlete.athleteId || generateId(),
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    email: athlete.email,
    division: athlete.division,
    createdAt: athlete.createdAt || new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({ TableName: ATHLETES_TABLE, Item: athleteData }));
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(athleteData) };
}

async function updateAthlete(athleteId, updates) {
  const params = {
    TableName: ATHLETES_TABLE,
    Key: { athleteId },
    UpdateExpression: 'SET firstName = :firstName, lastName = :lastName, email = :email, division = :division',
    ExpressionAttributeValues: {
      ':firstName': updates.firstName,
      ':lastName': updates.lastName,
      ':email': updates.email,
      ':division': updates.division
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.send(new UpdateCommand(params));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
}

async function deleteAthlete(athleteId) {
  await dynamodb.send(new DeleteCommand({
    TableName: ATHLETES_TABLE,
    Key: { athleteId }
  }));
  
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify({ message: 'Athlete deleted successfully' }) };
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
