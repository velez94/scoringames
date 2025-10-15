const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const eventbridge = new EventBridgeClient({});
const s3 = new S3Client({});

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;
const ATHLETES_TABLE = process.env.ATHLETES_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const WODS_TABLE = process.env.WODS_TABLE;
const EVENT_IMAGES_BUCKET = process.env.EVENT_IMAGES_BUCKET;

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

      case '/categories':
        if (httpMethod === 'GET') return await getCategories();
        if (httpMethod === 'POST') return await createCategory(requestBody);
        break;

      case '/categories/{categoryId}':
        const categoryId = pathParameters?.categoryId;
        if (httpMethod === 'PUT') return await updateCategory(categoryId, requestBody);
        if (httpMethod === 'DELETE') return await deleteCategory(categoryId);
        break;

      case '/wods':
        if (httpMethod === 'GET') return await getWods();
        if (httpMethod === 'POST') return await createWod(requestBody);
        break;

      case '/wods/{wodId}':
        const wodId = pathParameters?.wodId;
        if (httpMethod === 'PUT') return await updateWod(wodId, requestBody);
        if (httpMethod === 'DELETE') return await deleteWod(wodId);
        break;

      case '/events/{eventId}/upload-image':
        const uploadEventId = pathParameters?.eventId;
        if (httpMethod === 'POST') return await uploadEventImage(uploadEventId, requestBody);
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
  
  // Publish event for leaderboard recalculation
  await publishScoreEvent('Score Created', score);
  
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(score) };
}

async function updateScore(eventId, compositeAthleteId, scoreData) {
  console.log('UPDATE SCORE CALLED:', { eventId, compositeAthleteId, scoreData });
  
  try {
    const params = {
      TableName: SCORES_TABLE,
      Key: { 
        eventId: eventId,
        athleteId: compositeAthleteId 
      },
      UpdateExpression: 'SET score = :score, #time = :time, reps = :reps, division = :division, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#time': 'time'
      },
      ExpressionAttributeValues: {
        ':score': scoreData.score,
        ':time': scoreData.time,
        ':reps': scoreData.reps,
        ':division': scoreData.division,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(athleteId)',
      ReturnValues: 'ALL_NEW'
    };

    console.log('Attempting update with params:', JSON.stringify(params, null, 2));

    try {
      const result = await dynamodb.send(new UpdateCommand(params));
      console.log('Update successful:', result.Attributes);
      await publishScoreEvent('Score Updated', scoreData);
      return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
    } catch (conditionError) {
      console.log('Condition failed, checking for old format. Error:', conditionError.name);
      
      if (conditionError.name === 'ConditionalCheckFailedException') {
        const queryParams = {
          TableName: SCORES_TABLE,
          KeyConditionExpression: 'eventId = :eventId',
          FilterExpression: 'workoutId = :workoutId AND (athleteId = :athleteId OR originalAthleteId = :athleteId)',
          ExpressionAttributeValues: {
            ':eventId': eventId,
            ':workoutId': scoreData.workoutId,
            ':athleteId': scoreData.athleteId
          }
        };
        
        console.log('Querying for old format:', queryParams);
        const queryResult = await dynamodb.send(new QueryCommand(queryParams));
        console.log('Query result:', queryResult.Items);
        
        if (queryResult.Items && queryResult.Items.length > 0) {
          const oldItem = queryResult.Items[0];
          console.log('Found old format entry, migrating:', oldItem);
          
          await dynamodb.send(new DeleteCommand({
            TableName: SCORES_TABLE,
            Key: { 
              eventId: eventId, 
              athleteId: oldItem.athleteId 
            }
          }));
          
          const newScore = {
            eventId: scoreData.eventId,
            athleteId: compositeAthleteId,
            originalAthleteId: scoreData.athleteId,
            workoutId: scoreData.workoutId,
            score: scoreData.score,
            time: scoreData.time,
            reps: scoreData.reps,
            division: scoreData.division,
            submittedAt: oldItem.submittedAt,
            updatedAt: new Date().toISOString()
          };
          
          await dynamodb.send(new PutCommand({ TableName: SCORES_TABLE, Item: newScore }));
          console.log('Migration complete, new entry:', newScore);
          await publishScoreEvent('Score Updated', scoreData);
          return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(newScore) };
        }
      }
      throw conditionError;
    }
  } catch (error) {
    console.error('Update error:', error);
    return { statusCode: 500, headers: getHeaders(), body: JSON.stringify({ error: error.message, stack: error.stack }) };
  }
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
    alias: athlete.alias || '',
    age: athlete.age || null,
    categoryId: athlete.categoryId || null,
    createdAt: athlete.createdAt || new Date().toISOString(),
    updatedAt: athlete.updatedAt || new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({ TableName: ATHLETES_TABLE, Item: athleteData }));
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(athleteData) };
}

async function updateAthlete(athleteId, updates) {
  const params = {
    TableName: ATHLETES_TABLE,
    Key: { athleteId },
    UpdateExpression: 'SET firstName = :firstName, lastName = :lastName, email = :email, alias = :alias, age = :age, categoryId = :categoryId, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':firstName': updates.firstName,
      ':lastName': updates.lastName,
      ':email': updates.email,
      ':alias': updates.alias || '',
      ':age': updates.age || null,
      ':categoryId': updates.categoryId || null,
      ':updatedAt': new Date().toISOString()
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

// Category functions
async function getCategories() {
  const result = await dynamodb.send(new ScanCommand({ TableName: CATEGORIES_TABLE }));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function createCategory(category) {
  const categoryData = {
    categoryId: category.categoryId || generateId(),
    name: category.name,
    description: category.description,
    requirements: category.requirements || '',
    minAge: category.minAge || null,
    maxAge: category.maxAge || null,
    gender: category.gender || 'Mixed',
    createdAt: category.createdAt || new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({ TableName: CATEGORIES_TABLE, Item: categoryData }));
  return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(categoryData) };
}

async function updateCategory(categoryId, updates) {
  const params = {
    TableName: CATEGORIES_TABLE,
    Key: { categoryId },
    UpdateExpression: 'SET #name = :name, description = :description, requirements = :requirements, minAge = :minAge, maxAge = :maxAge, gender = :gender, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':name': updates.name,
      ':description': updates.description,
      ':requirements': updates.requirements,
      ':minAge': updates.minAge,
      ':maxAge': updates.maxAge,
      ':gender': updates.gender,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.send(new UpdateCommand(params));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
}

async function deleteCategory(categoryId) {
  await dynamodb.send(new DeleteCommand({
    TableName: CATEGORIES_TABLE,
    Key: { categoryId }
  }));
  
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify({ message: 'Category deleted successfully' }) };
}

// WOD functions
async function getWods() {
  const result = await dynamodb.send(new ScanCommand({ TableName: WODS_TABLE }));
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Items) };
}

async function createWod(wod) {
  try {
    console.log('Creating WOD with data:', JSON.stringify(wod, null, 2));
    
    const wodData = {
      wodId: wod.wodId || generateId(),
      name: wod.name,
      format: wod.format,
      timeLimit: wod.timeLimit || '',
      categoryId: wod.categoryId || '',
      movements: wod.movements || [],
      description: wod.description || '',
      createdAt: wod.createdAt || new Date().toISOString(),
      updatedAt: wod.updatedAt || new Date().toISOString()
    };

    console.log('Saving WOD data to DynamoDB:', JSON.stringify(wodData, null, 2));
    
    await dynamodb.send(new PutCommand({ TableName: WODS_TABLE, Item: wodData }));
    
    console.log('WOD saved successfully');
    return { statusCode: 201, headers: getHeaders(), body: JSON.stringify(wodData) };
  } catch (error) {
    console.error('Error in createWod:', error);
    return { 
      statusCode: 500, 
      headers: getHeaders(), 
      body: JSON.stringify({ 
        error: 'Failed to create WOD', 
        message: error.message,
        details: error.stack 
      }) 
    };
  }
}

async function updateWod(wodId, updates) {
  try {
    console.log('Updating WOD:', wodId, 'with data:', JSON.stringify(updates, null, 2));
    
    const params = {
      TableName: WODS_TABLE,
      Key: { wodId },
      UpdateExpression: 'SET #name = :name, #format = :format, timeLimit = :timeLimit, categoryId = :categoryId, movements = :movements, description = :description, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#format': 'format'
      },
      ExpressionAttributeValues: {
        ':name': updates.name,
        ':format': updates.format,
        ':timeLimit': updates.timeLimit,
        ':categoryId': updates.categoryId,
        ':movements': updates.movements,
        ':description': updates.description,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    console.log('WOD updated successfully');
    return { statusCode: 200, headers: getHeaders(), body: JSON.stringify(result.Attributes) };
  } catch (error) {
    console.error('Error in updateWod:', error);
    return { 
      statusCode: 500, 
      headers: getHeaders(), 
      body: JSON.stringify({ 
        error: 'Failed to update WOD', 
        message: error.message,
        details: error.stack 
      }) 
    };
  }
}

async function deleteWod(wodId) {
  await dynamodb.send(new DeleteCommand({
    TableName: WODS_TABLE,
    Key: { wodId }
  }));
  
  return { statusCode: 200, headers: getHeaders(), body: JSON.stringify({ message: 'WOD deleted successfully' }) };
}

async function uploadEventImage(eventId, data) {
  try {
    const { imageData, fileName } = data;
    const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const key = `events/${eventId}/${Date.now()}-${fileName}`;

    await s3.send(new PutObjectCommand({
      Bucket: EVENT_IMAGES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: data.contentType || 'image/jpeg',
    }));

    const imageUrl = `https://${EVENT_IMAGES_BUCKET}.s3.amazonaws.com/${key}`;
    
    await dynamodb.send(new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { eventId },
      UpdateExpression: 'SET bannerImage = :imageUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':imageUrl': imageUrl,
        ':updatedAt': new Date().toISOString()
      }
    }));

    return { statusCode: 200, headers: getHeaders(), body: JSON.stringify({ imageUrl }) };
  } catch (error) {
    console.error('Upload error:', error);
    return { statusCode: 500, headers: getHeaders(), body: JSON.stringify({ error: error.message }) };
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// EventBridge event publishing for decoupled leaderboard calculations
async function publishScoreEvent(detailType, scoreData) {
  try {
    const event = {
      Source: 'calisthenics.scores',
      DetailType: detailType,
      Detail: JSON.stringify({
        eventId: scoreData.eventId,
        athleteId: scoreData.originalAthleteId || scoreData.athleteId,
        workoutId: scoreData.workoutId,
        score: scoreData.score,
        timestamp: new Date().toISOString()
      })
    };

    await eventbridge.send(new PutEventsCommand({
      Entries: [event]
    }));
    
    console.log(`Published ${detailType} event for eventId: ${scoreData.eventId}`);
  } catch (error) {
    console.error('Error publishing score event:', error);
    // Don't throw - leaderboard calculation failure shouldn't break score submission
  }
}

function getHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };
}
