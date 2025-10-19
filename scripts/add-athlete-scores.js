const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const SCORES_TABLE = 'CalisthenicsAppStack-ScoresTableF4C5F0E9-1RVQXQXQXQXQX'; // Update with actual table name
const EVENT_ID = 'e1dfbf7b-fcdb-414d-b505-10bc8df125a8';

const athleteScores = [
  { athleteId: 'athlete1@test.com', wodId: 'wod-1', dayId: 'day-1', categoryId: 'category-1', score: 150 },
  { athleteId: 'athlete1@test.com', wodId: 'wod-2', dayId: 'day-1', categoryId: 'category-1', score: 180 },
  { athleteId: 'athlete2@test.com', wodId: 'wod-1', dayId: 'day-1', categoryId: 'category-1', score: 145 },
  { athleteId: 'athlete2@test.com', wodId: 'wod-2', dayId: 'day-1', categoryId: 'category-1', score: 175 },
  { athleteId: 'athlete3@test.com', wodId: 'wod-1', dayId: 'day-1', categoryId: 'category-1', score: 160 },
  { athleteId: 'athlete3@test.com', wodId: 'wod-2', dayId: 'day-1', categoryId: 'category-1', score: 190 }
];

async function getScoresTable() {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
  
  const client = new DynamoDBClient({ region: 'us-east-2' });
  const { TableNames } = await client.send(new ListTablesCommand({}));
  const scoresTable = TableNames.find(name => name.includes('ScoresTable'));
  return scoresTable;
}

async function addScores() {
  try {
    const tableName = await getScoresTable();
    console.log(`Using table: ${tableName}\n`);
    
    for (const score of athleteScores) {
      const item = {
        eventId: EVENT_ID,
        scoreId: `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        athleteId: score.athleteId,
        wodId: score.wodId,
        dayId: score.dayId,
        categoryId: score.categoryId,
        score: score.score,
        rank: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await ddb.send(new PutCommand({
        TableName: tableName,
        Item: item
      }));
      
      console.log(`✓ Added score for ${score.athleteId} - WOD: ${score.wodId}, Score: ${score.score}`);
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n✅ All scores added successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

addScores();
