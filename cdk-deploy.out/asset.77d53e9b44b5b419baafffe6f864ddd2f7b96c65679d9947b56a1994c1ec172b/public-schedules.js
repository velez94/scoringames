const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

exports.handler = async (event) => {
  const { httpMethod, pathParameters } = event;
  const { eventId, scheduleId } = pathParameters || {};

  try {
    if (httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers };
    }

    // Get published schedules for an event
    if (httpMethod === 'GET' && eventId && !scheduleId) {
      const { Items } = await dynamodb.send(new QueryCommand({
        TableName: SCHEDULES_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        FilterExpression: 'published = :published',
        ExpressionAttributeValues: {
          ':eventId': eventId,
          ':published': true
        }
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(Items || [])
      };
    }

    // Get specific published schedule
    if (httpMethod === 'GET' && eventId && scheduleId) {
      const { Item } = await dynamodb.send(new GetCommand({
        TableName: SCHEDULES_TABLE,
        Key: { eventId, scheduleId }
      }));

      if (!Item || !Item.published) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Schedule not found or not published' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(Item)
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
