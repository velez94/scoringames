const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-2' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(dynamoClient);

const USER_POOL_ID = 'us-east-2_mWb6Dnztz';
const EVENTS_TABLE = 'CalisthenicsAppStack-EventsTableD24865E5-W221XUEF5VR9';
const ORGANIZER_EVENTS_TABLE = 'CalisthenicsAppStack-OrganizerEventsTable6FAFF2EB-1EN2I2JHF78CT';
const ATHLETES_TABLE = 'CalisthenicsAppStack-AthletesTableF6FEDE0B-O9KQG48QNJ58';
const CATEGORIES_TABLE = 'CalisthenicsAppStack-CategoriesTable9FFF5A67-MJT9ZQJRRWTR';
const WODS_TABLE = 'CalisthenicsAppStack-WodsTableFA80581A-118ESVE4JKKWG';
const SCORES_TABLE = 'CalisthenicsAppStack-ScoresTable6CB35494-1I8Q7KU1419S7';
const ATHLETE_EVENTS_TABLE = 'CalisthenicsAppStack-AthleteEventsTableBA7B788A-1WPIFPOUIDAGJ';

async function createUser(email, password, givenName, familyName, role) {
  try {
    const createResult = await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: givenName },
        { Name: 'family_name', Value: familyName },
        { Name: 'custom:role', Value: role }
      ],
      MessageAction: 'SUPPRESS'
    }));

    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    }));

    const userId = createResult.User.Attributes.find(attr => attr.Name === 'sub').Value;
    console.log(`✓ Created ${role}: ${email} (${userId})`);
    return userId;
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log(`  Already exists: ${email}`);
      return null;
    }
    throw error;
  }
}

async function seedData() {
  console.log('🌱 Seeding demo data...\n');

  // 1. Create Organizers
  console.log('👥 Creating organizers...');
  const org1Id = await createUser('organizer1@demo.com', 'Demo123!', 'Sarah', 'Johnson', 'organizer');
  const org2Id = await createUser('organizer2@demo.com', 'Demo123!', 'Mike', 'Chen', 'organizer');

  // 2. Create Athletes
  console.log('\n🏃 Creating athletes...');
  const athlete1Id = await createUser('athlete1@demo.com', 'Demo123!', 'Alex', 'Martinez', 'athlete');
  const athlete2Id = await createUser('athlete2@demo.com', 'Demo123!', 'Emma', 'Davis', 'athlete');
  const athlete3Id = await createUser('athlete3@demo.com', 'Demo123!', 'Jordan', 'Smith', 'athlete');
  const athlete4Id = await createUser('athlete4@demo.com', 'Demo123!', 'Taylor', 'Brown', 'athlete');

  // 3. Create Athlete Profiles
  console.log('\n📝 Creating athlete profiles...');
  const athletes = [
    { userId: athlete1Id, firstName: 'Alex', lastName: 'Martinez', email: 'athlete1@demo.com', categoryId: 'rx-male', alias: 'AlexM', age: 28 },
    { userId: athlete2Id, firstName: 'Emma', lastName: 'Davis', email: 'athlete2@demo.com', categoryId: 'rx-female', alias: 'EmmaD', age: 25 },
    { userId: athlete3Id, firstName: 'Jordan', lastName: 'Smith', email: 'athlete3@demo.com', categoryId: 'scaled-male', alias: 'JordanS', age: 32 },
    { userId: athlete4Id, firstName: 'Taylor', lastName: 'Brown', email: 'athlete4@demo.com', categoryId: 'scaled-female', alias: 'TaylorB', age: 27 }
  ];

  for (const athlete of athletes) {
    if (athlete.userId) {
      await ddb.send(new PutCommand({
        TableName: ATHLETES_TABLE,
        Item: { ...athlete, createdAt: new Date().toISOString() }
      }));
      console.log(`  ✓ ${athlete.firstName} ${athlete.lastName}`);
    }
  }

  // 4. Create Events for Organizer 1
  console.log('\n🎯 Creating events for Organizer 1 (Sarah)...');
  const event1Id = 'evt-summer-2025';
  const event1 = {
    eventId: event1Id,
    name: 'Summer Games 2025',
    description: 'Annual summer calisthenics competition',
    location: 'Miami, FL',
    startDate: '2025-06-01T00:00:00Z',
    endDate: '2025-06-03T23:59:59Z',
    status: 'upcoming',
    published: true,
    createdBy: 'organizer1@demo.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: event1 }));
  if (org1Id) {
    await ddb.send(new PutCommand({
      TableName: ORGANIZER_EVENTS_TABLE,
      Item: { userId: org1Id, eventId: event1Id, role: 'admin', createdAt: new Date().toISOString() }
    }));
  }
  console.log(`  ✓ ${event1.name}`);

  // 5. Create Events for Organizer 2
  console.log('\n🎯 Creating events for Organizer 2 (Mike)...');
  const event2Id = 'evt-winter-2025';
  const event2 = {
    eventId: event2Id,
    name: 'Winter Challenge 2025',
    description: 'Indoor winter competition series',
    location: 'Denver, CO',
    startDate: '2025-12-15T00:00:00Z',
    endDate: '2025-12-17T23:59:59Z',
    status: 'upcoming',
    published: true,
    createdBy: 'organizer2@demo.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: event2 }));
  if (org2Id) {
    await ddb.send(new PutCommand({
      TableName: ORGANIZER_EVENTS_TABLE,
      Item: { userId: org2Id, eventId: event2Id, role: 'admin', createdAt: new Date().toISOString() }
    }));
  }
  console.log(`  ✓ ${event2.name}`);

  // 6. Create Categories for Event 1
  console.log('\n📊 Creating categories for Summer Games...');
  const categories = [
    { eventId: event1Id, categoryId: 'rx-male', name: 'RX Male', description: 'Advanced male division' },
    { eventId: event1Id, categoryId: 'rx-female', name: 'RX Female', description: 'Advanced female division' },
    { eventId: event1Id, categoryId: 'scaled-male', name: 'Scaled Male', description: 'Intermediate male division' },
    { eventId: event1Id, categoryId: 'scaled-female', name: 'Scaled Female', description: 'Intermediate female division' }
  ];

  for (const cat of categories) {
    await ddb.send(new PutCommand({ TableName: CATEGORIES_TABLE, Item: cat }));
    console.log(`  ✓ ${cat.name}`);
  }

  // 7. Create WODs for Event 1
  console.log('\n💪 Creating WODs for Summer Games...');
  const wods = [
    {
      eventId: event1Id,
      wodId: 'wod-grace',
      name: 'Grace',
      description: '30 Clean and Jerks for time',
      format: 'time',
      timeCap: 600,
      createdAt: new Date().toISOString()
    },
    {
      eventId: event1Id,
      wodId: 'wod-murph',
      name: 'Murph',
      description: '1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run',
      format: 'time',
      timeCap: 3600,
      createdAt: new Date().toISOString()
    },
    {
      eventId: event1Id,
      wodId: 'wod-fran',
      name: 'Fran',
      description: '21-15-9 Thrusters and Pull-ups',
      format: 'time',
      timeCap: 600,
      createdAt: new Date().toISOString()
    }
  ];

  for (const wod of wods) {
    await ddb.send(new PutCommand({ TableName: WODS_TABLE, Item: wod }));
    console.log(`  ✓ ${wod.name}`);
  }

  // 8. Register Athletes for Event 1
  console.log('\n✍️  Registering athletes for Summer Games...');
  const registrations = [
    { userId: athlete1Id, eventId: event1Id, categoryId: 'rx-male' },
    { userId: athlete2Id, eventId: event1Id, categoryId: 'rx-female' },
    { userId: athlete3Id, eventId: event1Id, categoryId: 'scaled-male' },
    { userId: athlete4Id, eventId: event1Id, categoryId: 'scaled-female' }
  ];

  for (const reg of registrations) {
    if (reg.userId) {
      await ddb.send(new PutCommand({
        TableName: ATHLETE_EVENTS_TABLE,
        Item: { ...reg, registrationDate: new Date().toISOString(), status: 'registered' }
      }));
      console.log(`  ✓ Registered athlete ${reg.userId.substring(0, 8)}...`);
    }
  }

  // 9. Create Scores
  console.log('\n🏆 Creating scores...');
  const scores = [
    // Grace - RX Male
    { eventId: event1Id, scoreId: 'score-grace-1', wodId: 'wod-grace', athleteId: athlete1Id, categoryId: 'rx-male', score: 180, rank: 1 },
    // Grace - RX Female
    { eventId: event1Id, scoreId: 'score-grace-2', wodId: 'wod-grace', athleteId: athlete2Id, categoryId: 'rx-female', score: 240, rank: 1 },
    // Grace - Scaled Male
    { eventId: event1Id, scoreId: 'score-grace-3', wodId: 'wod-grace', athleteId: athlete3Id, categoryId: 'scaled-male', score: 300, rank: 1 },
    // Murph - RX Male
    { eventId: event1Id, scoreId: 'score-murph-1', wodId: 'wod-murph', athleteId: athlete1Id, categoryId: 'rx-male', score: 2400, rank: 1 },
    // Murph - RX Female
    { eventId: event1Id, scoreId: 'score-murph-2', wodId: 'wod-murph', athleteId: athlete2Id, categoryId: 'rx-female', score: 2700, rank: 1 },
    // Fran - RX Male
    { eventId: event1Id, scoreId: 'score-fran-1', wodId: 'wod-fran', athleteId: athlete1Id, categoryId: 'rx-male', score: 240, rank: 1 }
  ];

  for (const score of scores) {
    if (score.athleteId) {
      await ddb.send(new PutCommand({
        TableName: SCORES_TABLE,
        Item: { ...score, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      }));
      console.log(`  ✓ Score for ${score.wodId}`);
    }
  }

  console.log('\n✅ Demo data seeded successfully!\n');
  console.log('📋 Demo Accounts:');
  console.log('   Organizer 1: organizer1@demo.com / Demo123!');
  console.log('   Organizer 2: organizer2@demo.com / Demo123!');
  console.log('   Athlete 1: athlete1@demo.com / Demo123!');
  console.log('   Athlete 2: athlete2@demo.com / Demo123!');
  console.log('   Athlete 3: athlete3@demo.com / Demo123!');
  console.log('   Athlete 4: athlete4@demo.com / Demo123!');
  console.log('\n🔒 Multi-Tenant Isolation:');
  console.log('   ✓ Organizer 1 sees only "Summer Games 2025"');
  console.log('   ✓ Organizer 2 sees only "Winter Challenge 2025"');
}

seedData().catch(console.error);
