const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const EVENT_DAYS_TABLE = process.env.EVENT_DAYS_TABLE;

exports.handler = async (event) => {
  const { eventId } = event;
  
  console.log('GetEventData called with:', { eventId, EVENTS_TABLE, EVENT_DAYS_TABLE });
  
  const { Item: eventData } = await dynamodb.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId }
  }));

  console.log('Event data retrieved:', { 
    eventId, 
    hasEventData: !!eventData,
    startDate: eventData?.startDate,
    endDate: eventData?.endDate 
  });

  let days = [];
  if (EVENT_DAYS_TABLE) {
    try {
      const { Items } = await dynamodb.send(new QueryCommand({
        TableName: EVENT_DAYS_TABLE,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      days = Items || [];
      console.log('Existing event days found:', days.length);
    } catch (error) {
      console.log('Could not fetch event days:', error.message);
    }
  }

  // Auto-generate days if none exist
  if (days.length === 0 && eventData?.startDate && eventData?.endDate) {
    console.log('Auto-generating days from event dates');
    const startDate = new Date(eventData.startDate);
    const endDate = new Date(eventData.endDate);
    
    console.log('Date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayId = `day-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = `Day ${days.length + 1}`;
      
      days.push({
        dayId,
        name: dayName,
        date: d.toISOString().split('T')[0],
        eventId
      });
    }
    
    console.log('Generated days:', days.map(d => ({ dayId: d.dayId, name: d.name, date: d.date })));
  }

  console.log('Final result:', { eventId, daysCount: days.length });
  
  return { eventData, days };
};
