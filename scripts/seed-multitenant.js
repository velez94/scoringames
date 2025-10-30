#!/usr/bin/env node
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { CloudFormationClient, DescribeStackResourcesCommand } = require('@aws-sdk/client-cloudformation');
const { v4: uuidv4 } = require('uuid');

const isLocal = process.argv.includes('--local');
const profile = process.argv.find(arg => arg.startsWith('--profile='))?.split('=')[1];

const clientConfig = isLocal 
  ? { endpoint: 'http://localhost:8000', region: 'us-east-2' }
  : { region: 'us-east-2' };

const client = new DynamoDBClient(clientConfig);
const ddb = DynamoDBDocumentClient.from(client);

async function getTableNames() {
  if (isLocal) {
    return {
      competitions: 'competitions',
      categories: 'categories',
      wods: 'wods',
      events: 'events',
      athletes: 'athletes',
      athleteCompetitions: 'athlete-competitions',
      scores: 'scores',
    };
  }

  // Get table names from AWS
  const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
  const response = await client.send(new ListTablesCommand({}));
  const tables = response.TableNames;
  
  return {
    competitions: tables.find(t => t.includes('CompetitionsTableA294B6D4')),
    categories: tables.find(t => t.includes('CategoriesTable9FFF5A67')),
    wods: tables.find(t => t.includes('WodsTableFA80581A')),
    events: tables.find(t => t.includes('EventsTableD24865E5')),
    athletes: tables.find(t => t.includes('AthletesTableF6FEDE0B')),
    athleteCompetitions: tables.find(t => t.includes('AthleteCompetitionsTableF0990200')),
    scores: tables.find(t => t.includes('ScoresTable6CB35494')),
  };
}

async function seedData() {
  console.log('🌱 Seeding multi-tenant data...\n');

  const tables = await getTableNames();
  console.log('📋 Tables:', JSON.stringify(tables, null, 2), '\n');

  // Create competition
  const competitionId = uuidv4();
  console.log('📋 Creating competition...');
  await ddb.send(new PutCommand({
    TableName: tables.competitions,
    Item: {
      competitionId,
      name: 'Summer Games 2025',
      startDate: '2025-06-01T00:00:00Z',
      endDate: '2025-06-03T23:59:59Z',
      status: 'upcoming',
      description: 'Annual summer calisthenics competition',
      location: 'Miami, FL',
      createdBy: 'admin@athleon.fitness',
      createdAt: new Date().toISOString(),
    }
  }));
  console.log(`✓ Competition created: ${competitionId}\n`);

  // Create categories
  console.log('📂 Creating categories...');
  const categories = [
    { categoryId: 'rx-male', name: 'RX Male', description: 'Elite male athletes' },
    { categoryId: 'rx-female', name: 'RX Female', description: 'Elite female athletes' },
    { categoryId: 'scaled-male', name: 'Scaled Male', description: 'Intermediate male athletes' },
    { categoryId: 'scaled-female', name: 'Scaled Female', description: 'Intermediate female athletes' },
  ];

  for (const cat of categories) {
    await ddb.send(new PutCommand({
      TableName: tables.categories,
      Item: {
        competitionId,
        categoryId: cat.categoryId,
        name: cat.name,
        description: cat.description,
        createdAt: new Date().toISOString(),
      }
    }));
    console.log(`✓ ${cat.name}`);
  }
  console.log('');

  // Create WODs
  console.log('💪 Creating WODs...');
  const wods = [
    {
      wodId: 'wod-1',
      name: 'Fran',
      description: '21-15-9 Thrusters (95/65 lb) and Pull-ups',
      type: 'time',
      movements: ['Thrusters', 'Pull-ups'],
    },
    {
      wodId: 'wod-2',
      name: 'Murph',
      description: '1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run',
      type: 'time',
      movements: ['Run', 'Pull-ups', 'Push-ups', 'Squats'],
    },
    {
      wodId: 'wod-3',
      name: 'Grace',
      description: '30 Clean and Jerks for time (135/95 lb)',
      type: 'time',
      movements: ['Clean and Jerk'],
    },
  ];

  for (const wod of wods) {
    await ddb.send(new PutCommand({
      TableName: tables.wods,
      Item: {
        competitionId,
        ...wod,
        createdAt: new Date().toISOString(),
      }
    }));
    console.log(`✓ ${wod.name}`);
  }
  console.log('');

  // Create events
  console.log('📅 Creating events...');
  const events = [
    {
      eventId: 'event-1',
      name: 'Friday Competition',
      date: '2025-06-01T10:00:00Z',
      status: 'upcoming',
      description: 'Day 1 of competition',
      workouts: [
        { wodId: 'wod-1', name: 'Fran', format: 'For Time' },
        { wodId: 'wod-3', name: 'Grace', format: 'For Time' }
      ],
      categories: ['rx-male', 'rx-female', 'scaled-male', 'scaled-female'],
    },
    {
      eventId: 'event-2',
      name: 'Saturday Competition',
      date: '2025-06-02T10:00:00Z',
      status: 'upcoming',
      description: 'Day 2 of competition - The Hero WOD',
      workouts: [
        { wodId: 'wod-2', name: 'Murph', format: 'For Time' }
      ],
      categories: ['rx-male', 'rx-female'],
    },
  ];

  for (const event of events) {
    await ddb.send(new PutCommand({
      TableName: tables.events,
      Item: {
        competitionId,
        ...event,
        createdAt: new Date().toISOString(),
      }
    }));
    console.log(`✓ ${event.name}`);
  }
  console.log('');

  // Create sample athletes
  console.log('👥 Creating sample athletes...');
  const athletes = [
    { userId: 'athlete-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', categoryId: 'rx-male' },
    { userId: 'athlete-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', categoryId: 'rx-female' },
    { userId: 'athlete-3', firstName: 'Mike', lastName: 'Johnson', email: 'mike@example.com', categoryId: 'rx-male' },
  ];

  for (const athlete of athletes) {
    await ddb.send(new PutCommand({
      TableName: tables.athletes,
      Item: {
        ...athlete,
        createdAt: new Date().toISOString(),
      }
    }));
    console.log(`✓ ${athlete.firstName} ${athlete.lastName}`);
  }
  console.log('');

  // Register athletes
  console.log('📝 Registering athletes...');
  for (const athlete of athletes) {
    await ddb.send(new PutCommand({
      TableName: tables.athleteCompetitions,
      Item: {
        userId: athlete.userId,
        competitionId,
        categoryId: 'rx-male',
        registeredAt: new Date().toISOString(),
        status: 'registered',
      }
    }));
    console.log(`✓ ${athlete.firstName} registered`);
  }
  console.log('');

  // Create sample scores
  console.log('🏆 Creating sample scores...');
  const scores = [
    { eventId: 'event-1', workoutId: 'wod-1', athleteId: 'athlete-1', score: 245, scoreType: 'time', categoryId: 'rx-male' },
    { eventId: 'event-1', workoutId: 'wod-1', athleteId: 'athlete-2', score: 312, scoreType: 'time', categoryId: 'rx-male' },
    { eventId: 'event-1', workoutId: 'wod-1', athleteId: 'athlete-3', score: 198, scoreType: 'time', categoryId: 'rx-male' },
    { eventId: 'event-1', workoutId: 'wod-3', athleteId: 'athlete-1', score: 180, scoreType: 'time', categoryId: 'rx-male' },
    { eventId: 'event-2', workoutId: 'wod-2', athleteId: 'athlete-2', score: 2145, scoreType: 'time', categoryId: 'rx-male' },
  ];

  for (const score of scores) {
    await ddb.send(new PutCommand({
      TableName: tables.scores,
      Item: {
        competitionId,
        scoreId: `${score.eventId}#${score.workoutId}#${score.athleteId}`,
        ...score,
        submittedAt: new Date().toISOString(),
      }
    }));
    console.log(`✓ Score for ${score.athleteId} on ${score.workoutId}: ${score.score}s`);
  }
  console.log('');

  console.log('✅ Seeding complete!\n');
  console.log('📊 Summary:');
  console.log(`   Competition: ${competitionId}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   WODs: ${wods.length}`);
  console.log(`   Events: ${events.length}`);
  console.log(`   Athletes: ${athletes.length}`);
  console.log(`   Scores: ${scores.length}`);
  console.log('');
  console.log('🌐 View in app: https://d19p6fb4ubnfdu.cloudfront.net');
}

seedData().catch(console.error);
