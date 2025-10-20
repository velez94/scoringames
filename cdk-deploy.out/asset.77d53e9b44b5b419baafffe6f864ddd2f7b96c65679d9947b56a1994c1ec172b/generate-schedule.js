const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CompetitionScheduler } = require('./scheduler');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;

exports.handler = async (event) => {
  const { eventId, config, eventData, days, athletes, categories, wods } = event;
  
  console.log('Generating schedule with collected data:', {
    eventId,
    daysCount: days.length,
    athletesCount: athletes.length,
    categoriesCount: categories.length,
    wodsCount: wods.length
  });

  const scheduler = new CompetitionScheduler(dynamodb);
  const scheduleConfig = {
    ...config,
    days,
    athletes,
    categories,
    wods
  };

  const schedule = await scheduler.generateSchedule(eventId, scheduleConfig);
  
  // Save the generated schedule
  const savedSchedule = {
    ...schedule,
    eventId,
    scheduleId: schedule.scheduleId || `schedule-${Date.now()}`,
    updatedAt: new Date().toISOString()
  };

  await dynamodb.send(new PutCommand({
    TableName: SCHEDULES_TABLE,
    Item: savedSchedule
  }));

  console.log('Schedule saved successfully:', { 
    eventId, 
    scheduleId: savedSchedule.scheduleId 
  });

  return savedSchedule;
};
