const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = 'ScorinGames-WodsWodsTableC84CB78B-1FQWYB636JK8C';
const EXERCISE_LIBRARY_TABLE = 'ScorinGames-ScoringExerciseLibraryTable4BA87342-DK3OFRYGRUJ6';

async function addExerciseIdToWods() {
  console.log('Adding exerciseId to all WOD movements...\n');

  // First, get all exercises to create name-to-id mapping
  const exercisesResult = await ddb.send(new ScanCommand({
    TableName: EXERCISE_LIBRARY_TABLE
  }));
  
  const exerciseMap = {};
  exercisesResult.Items.forEach(exercise => {
    exerciseMap[exercise.name] = exercise.exerciseId;
  });
  
  console.log(`Found ${Object.keys(exerciseMap).length} exercises in library`);

  // Get all WODs
  const wodsResult = await ddb.send(new ScanCommand({
    TableName: WODS_TABLE
  }));

  console.log(`Found ${wodsResult.Items.length} WODs to update\n`);

  for (const wod of wodsResult.Items) {
    if (!wod.movements || wod.movements.length === 0) {
      console.log(`⏭️  Skipping ${wod.name} - no movements`);
      continue;
    }

    let needsUpdate = false;
    const updatedMovements = wod.movements.map(movement => {
      if (!movement.exerciseId && movement.exercise) {
        const exerciseId = exerciseMap[movement.exercise];
        if (exerciseId) {
          needsUpdate = true;
          return {
            ...movement,
            exerciseId: exerciseId
          };
        } else {
          console.log(`⚠️  No exerciseId found for: "${movement.exercise}"`);
        }
      }
      return movement;
    });

    if (needsUpdate) {
      try {
        await ddb.send(new UpdateCommand({
          TableName: WODS_TABLE,
          Key: {
            eventId: wod.eventId,
            wodId: wod.wodId
          },
          UpdateExpression: 'SET movements = :movements',
          ExpressionAttributeValues: {
            ':movements': updatedMovements
          }
        }));
        console.log(`✅ Updated: ${wod.name}`);
      } catch (error) {
        console.error(`❌ Error updating ${wod.name}:`, error.message);
      }
    } else {
      console.log(`⏭️  Skipping ${wod.name} - already has exerciseId`);
    }
  }

  console.log('\n✨ WOD movements updated successfully!');
}

addExerciseIdToWods();
