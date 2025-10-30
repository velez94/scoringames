const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = 'ScorinGames-WodsWodsTableC84CB78B-1FQWYB636JK8C';

const wodUpdates = [
  {
    wodId: 'baseline-men-intermediate',
    movements: [
      { exercise: 'Push Ups (Bodyweight)', reps: '8', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '12', weight: '' },
      { exercise: 'Burpees', reps: '8', weight: '' }
    ]
  },
  {
    wodId: 'baseline-men-advanced',
    movements: [
      { exercise: 'Pull Up (Bodyweight)', reps: '5', weight: '' },
      { exercise: 'Push Ups (Bodyweight)', reps: '10', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '15', weight: '' }
    ]
  },
  {
    wodId: 'baseline-men-elite',
    movements: [
      { exercise: 'Muscle Up (Bodyweight)', reps: '3', weight: '' },
      { exercise: 'Handstand Push Up', reps: '6', weight: '' },
      { exercise: 'Pistol Squats (Bodyweight)', reps: '9', weight: '' }
    ]
  },
  {
    wodId: 'baseline-men-professional',
    movements: [
      { exercise: 'Muscle Up (Weighted)', reps: '2', weight: '10' },
      { exercise: 'Handstand Push Up', reps: '4', weight: '' },
      { exercise: 'Pistol Squats (Weighted)', reps: '6', weight: '20' }
    ]
  },
  {
    wodId: 'baseline-women-intermediate',
    movements: [
      { exercise: 'Push Ups (Bodyweight)', reps: '6', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '10', weight: '' },
      { exercise: 'Burpees', reps: '5', weight: '' }
    ]
  },
  {
    wodId: 'baseline-women-advanced',
    movements: [
      { exercise: 'Pull Up (Bodyweight)', reps: '4', weight: '' },
      { exercise: 'Push Ups (Bodyweight)', reps: '8', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '12', weight: '' }
    ]
  },
  {
    wodId: 'baseline-women-elite',
    movements: [
      { exercise: 'Pull Up (Bodyweight)', reps: '3', weight: '' },
      { exercise: 'Handstand Push Up', reps: '5', weight: '' },
      { exercise: 'Pistol Squats (Bodyweight)', reps: '7', weight: '' }
    ]
  },
  {
    wodId: 'baseline-women-professional',
    movements: [
      { exercise: 'Muscle Up (Bodyweight)', reps: '2', weight: '' },
      { exercise: 'Push Ups (Bodyweight)', reps: '8', weight: '5' },
      { exercise: 'Pistol Squats (Weighted)', reps: '6', weight: '10' }
    ]
  }
];

async function updateBaselineWods() {
  console.log('Updating baseline WODs with correct exercise names...\n');

  for (const update of wodUpdates) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: WODS_TABLE,
        Key: {
          eventId: 'template',
          wodId: update.wodId
        },
        UpdateExpression: 'SET movements = :movements',
        ExpressionAttributeValues: {
          ':movements': update.movements
        }
      }));
      console.log(`✅ Updated: ${update.wodId}`);
    } catch (error) {
      console.error(`❌ Error updating ${update.wodId}:`, error.message);
    }
  }

  console.log('\n✨ Baseline WODs updated successfully!');
}

updateBaselineWods();
