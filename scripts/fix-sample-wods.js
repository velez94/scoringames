const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = 'ScorinGames-WodsWodsTableC84CB78B-1FQWYB636JK8C';

const wodFixes = [
  {
    wodId: 'sample-amrap-1',
    movements: [
      { exercise: 'Pull Up (Bodyweight)', reps: '10', weight: '' },
      { exercise: 'Push Ups (Bodyweight)', reps: '20', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '30', weight: '' }
    ]
  },
  {
    wodId: 'sample-chipper-1',
    movements: [
      { exercise: 'Burpees', reps: '50', weight: '' },
      { exercise: 'Pull Up (Bodyweight)', reps: '40', weight: '' },
      { exercise: 'Push Ups (Bodyweight)', reps: '30', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '20', weight: '' },
      { exercise: 'Squats (Bodyweight)', reps: '10', weight: '' }
    ]
  }
];

async function fixSampleWods() {
  console.log('Fixing sample WODs with correct exercise names...\n');

  for (const fix of wodFixes) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: WODS_TABLE,
        Key: {
          eventId: 'template',
          wodId: fix.wodId
        },
        UpdateExpression: 'SET movements = :movements',
        ExpressionAttributeValues: {
          ':movements': fix.movements
        }
      }));
      console.log(`✅ Fixed: ${fix.wodId}`);
    } catch (error) {
      console.error(`❌ Error fixing ${fix.wodId}:`, error.message);
    }
  }

  console.log('\n✨ Sample WODs fixed successfully!');
}

fixSampleWods();
