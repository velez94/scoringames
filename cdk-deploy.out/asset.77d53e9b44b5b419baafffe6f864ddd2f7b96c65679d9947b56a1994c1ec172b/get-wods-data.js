const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = process.env.WODS_TABLE;

exports.handler = async (event) => {
  const { eventId } = event;
  
  const { Items: wods } = await dynamodb.send(new QueryCommand({
    TableName: WODS_TABLE,
    KeyConditionExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId }
  }));

  return { wods: wods || [] };
};
