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

// Get table names from environment or use defaults
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'ScorinGames-CategoriesCategoriesTable6441F570-1SPJLAEBJ8R5E';
const WODS_TABLE = process.env.WODS_TABLE || 'ScorinGames-WodsWodsTableC84CB78B-1FQWYB636JK8C';

const initialCategories = [
  // Men's Categories
  {
    eventId: 'global',
    categoryId: 'men-intermediate',
    name: "Men's Intermediate",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Male',
    description: 'Intermediate level male athletes',
    requirements: 'Basic calisthenics skills',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'global',
    categoryId: 'men-advanced',
    name: "Men's Advanced",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Male',
    description: 'Advanced level male athletes',
    requirements: 'Strong calisthenics foundation',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'global',
    categoryId: 'men-professional',
    name: "Men's Professional",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Male',
    description: 'Professional level male athletes',
    requirements: 'Competitive experience required',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'global',
    categoryId: 'men-elite',
    name: "Men's Elite",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Male',
    description: 'Elite level male athletes',
    requirements: 'Top tier performance',
    createdAt: new Date().toISOString(),
  },
  // Women's Categories
  {
    eventId: 'global',
    categoryId: 'women-intermediate',
    name: "Women's Intermediate",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Female',
    description: 'Intermediate level female athletes',
    requirements: 'Basic calisthenics skills',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'global',
    categoryId: 'women-advanced',
    name: "Women's Advanced",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Female',
    description: 'Advanced level female athletes',
    requirements: 'Strong calisthenics foundation',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'global',
    categoryId: 'women-professional',
    name: "Women's Professional",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Female',
    description: 'Professional level female athletes',
    requirements: 'Competitive experience required',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'global',
    categoryId: 'women-elite',
    name: "Women's Elite",
    ageRange: '18+',
    minAge: 18,
    maxAge: 100,
    gender: 'Female',
    description: 'Elite level female athletes',
    requirements: 'Top tier performance',
    createdAt: new Date().toISOString(),
  },
];

const sampleWods = [
  {
    eventId: 'template',
    wodId: 'sample-amrap-1',
    name: 'Baseline AMRAP',
    format: 'AMRAP',
    timeLimit: '10 minutes',
    categoryId: 'men-elite',
    movements: [
      { exercise: 'Pull-ups', reps: '10', weight: '' },
      { exercise: 'Push-ups', reps: '20', weight: '' },
      { exercise: 'Air Squats', reps: '30', weight: '' },
    ],
    description: 'Complete as many rounds as possible in 10 minutes',
    createdAt: new Date().toISOString(),
  },
  {
    eventId: 'template',
    wodId: 'sample-chipper-1',
    name: 'The Gauntlet',
    format: 'Chipper',
    timeLimit: '20 minutes',
    categoryId: 'men-elite',
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
