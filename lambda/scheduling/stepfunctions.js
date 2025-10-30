const { SFNClient, StartSyncExecutionCommand } = require('@aws-sdk/client-sfn');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const sfn = new SFNClient({});
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;
const SCHEDULER_STATE_MACHINE_ARN = process.env.SCHEDULER_STATE_MACHINE_ARN;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('Scheduler request received', { 
      httpMethod: event.httpMethod, 
      pathParameters: event.pathParameters,
      hasSchedulesTable: !!SCHEDULES_TABLE 
    });

    if (!SCHEDULES_TABLE) {
      throw new Error('SCHEDULES_TABLE environment variable not set');
    }
    const { httpMethod, pathParameters, body } = event;
    const requestBody = body ? JSON.parse(body) : {};
    
    const proxy = pathParameters?.proxy;
    const pathParts = proxy ? proxy.split('/') : [];
    const eventId = pathParts[0];
    const scheduleId = pathParts[1];

    console.log('Step Functions scheduler request', { httpMethod, eventId, scheduleId });

    switch (httpMethod) {
      case 'POST':
        if (eventId && !scheduleId) {
          const schedule = await generateScheduleSync(eventId, requestBody);
          return { statusCode: 201, headers, body: JSON.stringify(schedule) };
        }
        if (eventId && scheduleId === 'save') {
          // Handle /scheduler/{eventId}/save
          const saved = await saveSchedule(eventId, requestBody);
          return { statusCode: 200, headers, body: JSON.stringify(saved) };
        }
        if (eventId && scheduleId) {
          const action = pathParts[2]; // publish or unpublish
          if (action === 'publish') {
            const result = await publishSchedule(eventId, scheduleId);
            return { statusCode: 200, headers, body: JSON.stringify(result) };
          }
          if (action === 'unpublish') {
            const result = await unpublishSchedule(eventId, scheduleId);
            return { statusCode: 200, headers, body: JSON.stringify(result) };
          }
        }
        break;

      case 'GET':
        if (eventId && !scheduleId) {
          const schedules = await listSchedules(eventId);
          return { statusCode: 200, headers, body: JSON.stringify(schedules) };
        }
        if (eventId && scheduleId) {
          const schedule = await getSchedule(eventId, scheduleId);
          return { 
            statusCode: schedule ? 200 : 404, 
            headers, 
            body: JSON.stringify(schedule || { error: 'Schedule not found' }) 
          };
        }
        break;

      case 'PUT':
        if (eventId && scheduleId) {
          const updated = await updateSchedule(eventId, scheduleId, requestBody);
          return { statusCode: 200, headers, body: JSON.stringify(updated) };
        }
        break;

      case 'DELETE':
        if (eventId && scheduleId) {
          const result = await deleteSchedule(eventId, scheduleId);
          return { statusCode: 200, headers, body: JSON.stringify(result) };
        }
        break;
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('Step Functions scheduler error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function generateScheduleSync(eventId, config) {
  console.log('Starting Step Functions schedule generation', { eventId });

  const input = {
    eventId,
    config,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };

  try {
    const result = await sfn.send(new StartSyncExecutionCommand({
      stateMachineArn: SCHEDULER_STATE_MACHINE_ARN,
      input: JSON.stringify(input)
    }));

    console.log('Step Functions execution result', { 
      eventId, 
      status: result.status,
      hasOutput: !!result.output 
    });

    if (result.status === 'SUCCEEDED') {
      if (!result.output) {
        throw new Error('Step Functions execution succeeded but returned no output');
      }
      
      const output = JSON.parse(result.output);
      
      console.log('Schedule generation completed via Step Functions', { 
        eventId, 
        scheduleId: output.scheduleId 
      });
      return output;
    } else {
      const errorMessage = result.cause || result.error || 'Unknown Step Functions error';
      console.error('Step Functions execution failed', { 
        eventId, 
        status: result.status,
        error: errorMessage 
      });
      throw new Error(`Step Functions execution failed: ${errorMessage}`);
    }

  } catch (error) {
    console.error('Step Functions execution error', { 
      eventId, 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
}

async function getSchedule(eventId, scheduleId) {
  const { Item } = await dynamodb.send(new GetCommand({
    TableName: SCHEDULES_TABLE,
    Key: { eventId, scheduleId }
  }));
  return Item;
}

async function updateSchedule(eventId, scheduleId, updates) {
  const updateExpressions = [];
  const attributeValues = {};
  const attributeNames = {};

  Object.keys(updates).forEach(key => {
    updateExpressions.push(`#${key} = :${key}`);
    attributeNames[`#${key}`] = key;
    attributeValues[`:${key}`] = updates[key];
  });

  attributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  attributeNames['#updatedAt'] = 'updatedAt';

  await dynamodb.send(new UpdateCommand({
    TableName: SCHEDULES_TABLE,
    Key: { eventId, scheduleId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues
  }));

  return await getSchedule(eventId, scheduleId);
}

async function deleteSchedule(eventId, scheduleId) {
  await dynamodb.send(new DeleteCommand({
    TableName: SCHEDULES_TABLE,
    Key: { eventId, scheduleId }
  }));
  return { success: true };
}

async function listSchedules(eventId) {
  const { Items } = await dynamodb.send(new QueryCommand({
    TableName: SCHEDULES_TABLE,
    KeyConditionExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId }
  }));
  return Items || [];
}

async function publishSchedule(eventId, scheduleId) {
  await dynamodb.send(new UpdateCommand({
    TableName: SCHEDULES_TABLE,
    Key: { eventId, scheduleId },
    UpdateExpression: 'SET published = :published, publishedAt = :publishedAt',
    ExpressionAttributeValues: {
      ':published': true,
      ':publishedAt': new Date().toISOString()
    }
  }));
  return { published: true };
}

async function unpublishSchedule(eventId, scheduleId) {
  await dynamodb.send(new UpdateCommand({
    TableName: SCHEDULES_TABLE,
    Key: { eventId, scheduleId },
    UpdateExpression: 'SET published = :published REMOVE publishedAt',
    ExpressionAttributeValues: {
      ':published': false
    }
  }));
  return { published: false };
}

async function saveSchedule(eventId, scheduleData) {
  const schedule = {
    ...scheduleData,
    eventId,
    scheduleId: scheduleData.scheduleId || `schedule-${Date.now()}`,
    updatedAt: new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({
    TableName: SCHEDULES_TABLE,
    Item: schedule
  }));

  return schedule;
}
