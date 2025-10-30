const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const SCORES_TABLE = process.env.SCORES_TABLE || 'CalisthenicsAppStack-ScoresTable298B42D8-1RVQXQVVVVVVV';

async function cleanupDuplicates() {
  console.log('🔍 Scanning for duplicate scores...\n');
  
  // Scan all scores
  const { Items: scores } = await ddb.send(new ScanCommand({
    TableName: SCORES_TABLE
  }));
  
  console.log(`Found ${scores.length} total scores\n`);
  
  // Group by athlete+wod+category
  const groups = {};
  scores.forEach(score => {
    const key = `${score.athleteId}|${score.wodId}|${score.categoryId}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(score);
  });
  
  // Find duplicates
  let duplicateCount = 0;
  let deletedCount = 0;
  
  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      duplicateCount++;
      const [athleteId, wodId, categoryId] = key.split('|');
      
      // Sort by updatedAt (keep most recent)
      group.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      
      console.log(`\n📊 Duplicate found:`);
      console.log(`   Athlete: ${athleteId}`);
      console.log(`   WOD: ${wodId}`);
      console.log(`   Category: ${categoryId}`);
      console.log(`   Count: ${group.length} entries`);
      
      // Keep the first (most recent), delete the rest
      const toKeep = group[0];
      const toDelete = group.slice(1);
      
      console.log(`   ✅ Keeping: ${toKeep.scoreId} (score: ${toKeep.score}, updated: ${toKeep.updatedAt || toKeep.createdAt})`);
      
      for (const score of toDelete) {
        console.log(`   ❌ Deleting: ${score.scoreId} (score: ${score.score}, created: ${score.createdAt})`);
        
        await ddb.send(new DeleteCommand({
          TableName: SCORES_TABLE,
          Key: {
            eventId: score.eventId,
            scoreId: score.scoreId
          }
        }));
        
        deletedCount++;
      }
    }
  }
  
  console.log(`\n✅ Cleanup complete!`);
  console.log(`   Duplicate groups found: ${duplicateCount}`);
  console.log(`   Scores deleted: ${deletedCount}`);
  console.log(`   Scores remaining: ${scores.length - deletedCount}`);
}

cleanupDuplicates().catch(console.error);
