#!/usr/bin/env node
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const isLocal = process.argv.includes('--local');
const profile = process.argv.find(arg => arg.startsWith('--profile='))?.split('=')[1] || 'labvel-dev';

const clientConfig = isLocal 
  ? { endpoint: 'http://localhost:8000', region: 'us-east-2' }
  : { region: 'us-east-2' };

const client = new DynamoDBClient(clientConfig);
const dynamodb = DynamoDBDocumentClient.from(client);

const CATEGORIES_TABLE = 'calisthenics-categories';
const WODS_TABLE = 'calisthenics-wods';

const initialCategories = [
  {
    categoryId: 'elite-endurance',
    name: 'Elite Endurance',
    ageRange: '18-35',
    minAge: 18,
    maxAge: 35,
    gender: 'Mixed',
    description: 'High-performance athletes',
    requirements: 'Advanced fitness level',
    createdAt: new Date().toISOString(),
  },
  {
    categoryId: 'masters',
    name: 'Masters',
    ageRange: '35+',
    minAge: 35,
    maxAge: 100,
    gender: 'Mixed',
    description: 'Experienced athletes 35 and older',
    requirements: 'Intermediate to advanced fitness',
    createdAt: new Date().toISOString(),
  },
  {
    categoryId: 'scaled',
    name: 'Scaled',
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Mixed',
    description: 'Modified movements for all levels',
    requirements: 'Beginner to intermediate fitness',
    createdAt: new Date().toISOString(),
  },
];

const sampleWods = [
  {
    wodId: 'sample-amrap-1',
    name: 'Baseline AMRAP',
    format: 'AMRAP',
    timeLimit: '10 minutes',
    categoryId: 'elite-endurance',
    movements: [
      { exercise: 'Pull-ups', reps: '10', weight: '' },
      { exercise: 'Push-ups', reps: '20', weight: '' },
      { exercise: 'Air Squats', reps: '30', weight: '' },
    ],
    description: 'Complete as many rounds as possible in 10 minutes',
    createdAt: new Date().toISOString(),
  },
  {
    wodId: 'sample-chipper-1',
    name: 'The Gauntlet',
    format: 'Chipper',
    timeLimit: '20 minutes',
    categoryId: 'elite-endurance',
    movements: [
      { exercise: 'Burpees', reps: '50', weight: '' },
      { exercise: 'Pull-ups', reps: '40', weight: '' },
      { exercise: 'Push-ups', reps: '30', weight: '' },
      { exercise: 'Sit-ups', reps: '20', weight: '' },
      { exercise: 'Squats', reps: '10', weight: '' },
    ],
    description: 'Complete all movements for time',
    createdAt: new Date().toISOString(),
  },
];

async function seedCategories() {
  console.log('📂 Seeding categories...');
  for (const category of initialCategories) {
    try {
      await dynamodb.send(new PutCommand({
        TableName: CATEGORIES_TABLE,
        Item: category,
      }));
      console.log(`  ✅ ${category.name}`);
    } catch (error) {
      console.error(`  ❌ Failed to seed ${category.name}:`, error.message);
    }
  }
}

async function seedWods() {
  console.log('🏋️  Seeding sample WODs...');
  for (const wod of sampleWods) {
    try {
      await dynamodb.send(new PutCommand({
        TableName: WODS_TABLE,
        Item: wod,
      }));
      console.log(`  ✅ ${wod.name}`);
    } catch (error) {
      console.error(`  ❌ Failed to seed ${wod.name}:`, error.message);
    }
  }
}

async function main() {
  console.log('🌱 Starting data seeding...');
  console.log(`📍 Environment: ${isLocal ? 'LOCAL' : 'AWS'}`);
  console.log('');

  try {
    await seedCategories();
    await seedWods();
    console.log('');
    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
