const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const ATHLETES_TABLE = process.env.ATHLETES_TABLE;
const ATHLETE_EVENTS_TABLE = process.env.ATHLETE_EVENTS_TABLE;

exports.handler = async (event) => {
  const { eventId } = event;
  
  const { Items: registrations } = await dynamodb.send(new QueryCommand({
    TableName: ATHLETE_EVENTS_TABLE,
    IndexName: 'event-athletes-index',
    KeyConditionExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId }
  }));

  if (!registrations || registrations.length === 0) {
    return { athletes: [] };
  }

  const athletes = [];
  for (const registration of registrations) {
    try {
      const { Item: athlete } = await dynamodb.send(new GetCommand({
        TableName: ATHLETES_TABLE,
        Key: { userId: registration.userId }
      }));

      if (athlete) {
        athletes.push({
          ...athlete,
          categoryId: registration.categoryId,
          registrationDate: registration.registrationDate,
          status: registration.status
        });
      }
    } catch (error) {
      console.log('Error fetching athlete:', registration.userId, error.message);
    }
  }

  return { athletes };
};
