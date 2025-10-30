const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = 'ScorinGames-WodsWodsTableC84CB78B-1FQWYB636JK8C';

const baselineWods = [
  // Men's Categories
  {
    wodId: 'baseline-men-intermediate',
    eventId: 'template',
    name: 'Baseline AMRAP - Men Intermediate',
    description: 'Complete as many rounds as possible in 8 minutes',
    format: 'AMRAP',
    timeLimit: '8 minutes',
    categoryId: 'men-intermediate',
    movements: [
      { exercise: 'Push-ups', reps: '8', weight: '' },
      { exercise: 'Air Squats', reps: '12', weight: '' },
      { exercise: 'Mountain Climbers', reps: '16', weight: '' }
    ]
  },
  {
    wodId: 'baseline-men-advanced',
    eventId: 'template',
    name: 'Baseline AMRAP - Men Advanced',
    description: 'Complete as many rounds as possible in 10 minutes',
    format: 'AMRAP',
    timeLimit: '10 minutes',
    categoryId: 'men-advanced',
    movements: [
      { exercise: 'Pull-ups', reps: '5', weight: '' },
      { exercise: 'Push-ups', reps: '10', weight: '' },
      { exercise: 'Air Squats', reps: '15', weight: '' }
    ]
  },
  {
    wodId: 'baseline-men-elite',
    eventId: 'template',
    name: 'Baseline AMRAP - Men Elite',
    description: 'Complete as many rounds as possible in 12 minutes',
    format: 'AMRAP',
    timeLimit: '12 minutes',
    categoryId: 'men-elite',
    movements: [
      { exercise: 'Muscle Ups', reps: '3', weight: '' },
      { exercise: 'Handstand Push-ups', reps: '6', weight: '' },
      { exercise: 'Pistol Squats', reps: '9', weight: '' }
    ]
  },
  {
    wodId: 'baseline-men-professional',
    eventId: 'template',
    name: 'Baseline AMRAP - Men Professional',
    description: 'Complete as many rounds as possible in 15 minutes',
    format: 'AMRAP',
    timeLimit: '15 minutes',
    categoryId: 'men-professional',
    movements: [
      { exercise: 'Weighted Muscle Ups', reps: '2', weight: '10kg' },
      { exercise: 'One Arm Push-ups', reps: '4', weight: '' },
      { exercise: 'Weighted Pistol Squats', reps: '6', weight: '20kg' }
    ]
  },
  // Women's Categories
  {
    wodId: 'baseline-women-intermediate',
    eventId: 'template',
    name: 'Baseline AMRAP - Women Intermediate',
    description: 'Complete as many rounds as possible in 8 minutes',
    format: 'AMRAP',
    timeLimit: '8 minutes',
    categoryId: 'women-intermediate',
    movements: [
      { exercise: 'Push-ups (Knee)', reps: '6', weight: '' },
      { exercise: 'Air Squats', reps: '10', weight: '' },
      { exercise: 'Plank Hold', reps: '30s', weight: '' }
    ]
  },
  {
    wodId: 'baseline-women-advanced',
    eventId: 'template',
    name: 'Baseline AMRAP - Women Advanced',
    description: 'Complete as many rounds as possible in 10 minutes',
    format: 'AMRAP',
    timeLimit: '10 minutes',
    categoryId: 'women-advanced',
    movements: [
      { exercise: 'Pull-ups (Assisted)', reps: '4', weight: '' },
      { exercise: 'Push-ups', reps: '8', weight: '' },
      { exercise: 'Air Squats', reps: '12', weight: '' }
    ]
  },
  {
    wodId: 'baseline-women-elite',
    eventId: 'template',
    name: 'Baseline AMRAP - Women Elite',
    description: 'Complete as many rounds as possible in 12 minutes',
    format: 'AMRAP',
    timeLimit: '12 minutes',
    categoryId: 'women-elite',
    movements: [
      { exercise: 'Pull-ups', reps: '3', weight: '' },
      { exercise: 'Handstand Push-ups', reps: '5', weight: '' },
      { exercise: 'Pistol Squats', reps: '7', weight: '' }
    ]
  },
  {
    wodId: 'baseline-women-professional',
    eventId: 'template',
    name: 'Baseline AMRAP - Women Professional',
    description: 'Complete as many rounds as possible in 15 minutes',
    format: 'AMRAP',
    timeLimit: '15 minutes',
    categoryId: 'women-professional',
    movements: [
      { exercise: 'Muscle Ups', reps: '2', weight: '' },
      { exercise: 'Weighted Push-ups', reps: '4', weight: '5kg' },
      { exercise: 'Weighted Pistol Squats', reps: '6', weight: '10kg' }
    ]
  }
];

async function seedBaselineWods() {
  console.log('Seeding baseline WODs for all categories...\n');

  for (const wod of baselineWods) {
    try {
      await ddb.send(new PutCommand({
        TableName: WODS_TABLE,
        Item: {
          ...wod,
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          isShared: false,
          isTransversal: false
        }
      }));
      console.log(`✅ Created: ${wod.name}`);
    } catch (error) {
      console.error(`❌ Error creating ${wod.name}:`, error.message);
    }
  }

  console.log('\n✨ Baseline WODs seeded successfully!');
}

seedBaselineWods();
