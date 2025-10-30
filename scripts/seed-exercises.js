const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const EXERCISE_LIBRARY_TABLE = 'ScorinGames-ScoringExerciseLibraryTable4BA87342-DK3OFRYGRUJ6';

const exercises = [
  {
    exerciseId: 'ex-muscle-up',
    name: 'Muscle Up (Bodyweight)',
    category: 'strength',
    baseScore: 5,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-muscle-up-weighted',
    name: 'Muscle Up (Weighted)',
    category: 'strength',
    baseScore: 5,
    modifiers: [{ type: 'weight', unit: 'kg', increment: 5, points: 1 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-pull-up',
    name: 'Pull Up (Bodyweight)',
    category: 'strength',
    baseScore: 1,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-pull-up-weighted',
    name: 'Pull Up (Weighted)',
    category: 'strength',
    baseScore: 1,
    modifiers: [{ type: 'weight', unit: 'kg', increment: 5, points: 0.5 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-bar-dips',
    name: 'Bar Dips (Bodyweight)',
    category: 'strength',
    baseScore: 1,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-bar-dips-weighted',
    name: 'Bar Dips (Weighted)',
    category: 'strength',
    baseScore: 1,
    modifiers: [{ type: 'weight', unit: 'kg', increment: 5, points: 0.5 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-push-ups',
    name: 'Push Ups (Bodyweight)',
    category: 'endurance',
    baseScore: 0.5,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-push-ups-deadstop',
    name: 'Push Ups (Deadstop)',
    category: 'endurance',
    baseScore: 0.5,
    modifiers: [{ type: 'deadstop', points: 0.5 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-squats',
    name: 'Squats (Bodyweight)',
    category: 'endurance',
    baseScore: 0.5,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-squats-weighted',
    name: 'Squats (Weighted)',
    category: 'strength',
    baseScore: 0.5,
    modifiers: [{ type: 'weight', unit: 'kg', increment: 10, points: 0.5 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-pistol-squats',
    name: 'Pistol Squats (Bodyweight)',
    category: 'skill',
    baseScore: 1.5,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-pistol-squats-weighted',
    name: 'Pistol Squats (Weighted)',
    category: 'skill',
    baseScore: 1.5,
    modifiers: [{ type: 'weight', unit: 'kg', increment: 5, points: 0.5 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-handstand-hold',
    name: 'Handstand Hold',
    category: 'skill',
    baseScore: 2,
    modifiers: [{ type: 'hold', unit: 'seconds', increment: 10, points: 2 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-handstand-push-up',
    name: 'Handstand Push Up',
    category: 'skill',
    baseScore: 4,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-front-lever-hold',
    name: 'Front Lever Hold',
    category: 'skill',
    baseScore: 3,
    modifiers: [{ type: 'hold', unit: 'seconds', increment: 10, points: 3 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-chin-over-bar-hold',
    name: 'Chin Over Bar Hold',
    category: 'endurance',
    baseScore: 2,
    modifiers: [{ type: 'hold', unit: 'seconds', increment: 10, points: 2 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-one-arm-pull-up',
    name: 'One Arm Pull Up',
    category: 'skill',
    baseScore: 8,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-leg-raiser-muscle-up',
    name: 'Leg Raiser Muscle Up',
    category: 'skill',
    baseScore: 6,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-burpees',
    name: 'Burpees',
    category: 'endurance',
    baseScore: 1,
    modifiers: [],
    isGlobal: true
  },
  {
    exerciseId: 'ex-l-sit-hold',
    name: 'L-Sit Hold',
    category: 'skill',
    baseScore: 2,
    modifiers: [{ type: 'hold', unit: 'seconds', increment: 10, points: 2 }],
    isGlobal: true
  },
  {
    exerciseId: 'ex-zancadas-burpees',
    name: 'Zancadas Burpees',
    category: 'endurance',
    baseScore: 2,
    modifiers: [],
    isGlobal: true
  }
];

async function seedExercises() {
  console.log('Seeding exercise library...');
  
  for (const exercise of exercises) {
    try {
      await ddb.send(new PutCommand({
        TableName: EXERCISE_LIBRARY_TABLE,
        Item: {
          ...exercise,
          createdBy: 'system',
          createdAt: new Date().toISOString()
        }
      }));
      console.log(`✅ Created: ${exercise.name}`);
    } catch (error) {
      console.error(`❌ Error creating ${exercise.name}:`, error.message);
    }
  }
  
  console.log('\n✨ Exercise library seeded successfully!');
}

seedExercises();
