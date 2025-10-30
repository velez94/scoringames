const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = process.env.WODS_TABLE;

async function cleanupDuplicateWods() {
  console.log('🔍 Scanning for duplicate WODs...\n');
  
  // Scan all WODs
  const { Items: wods } = await ddb.send(new ScanCommand({
    TableName: WODS_TABLE
  }));
  
  console.log(`Found ${wods.length} total WODs\n`);
  
  // Group by name (case-insensitive)
  const groups = {};
  wods.forEach(wod => {
    const key = wod.name.toLowerCase();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(wod);
  });
  
  let deletedCount = 0;
  
  for (const [name, group] of Object.entries(groups)) {
    if (group.length > 2) {
      console.log(`\n📊 Found ${group.length} WODs named "${name}":`);
      
      // Separate shared/transversal from event-specific
      const shared = group.filter(w => w.isShared || w.isTransversal);
      const eventSpecific = group.filter(w => !w.isShared && !w.isTransversal);
      
      // Keep 1 shared and 1 event-specific
      const toKeep = [];
      const toDelete = [];
      
      if (shared.length > 0) {
        toKeep.push(shared[0]);
        toDelete.push(...shared.slice(1));
      }
      
      if (eventSpecific.length > 0) {
        toKeep.push(eventSpecific[0]);
        toDelete.push(...eventSpecific.slice(1));
      }
      
      console.log(`   ✅ Keeping ${toKeep.length} WODs:`);
      toKeep.forEach(w => {
        console.log(`      - ${w.wodId} (${w.isShared ? 'Shared' : w.isTransversal ? 'Transversal' : 'Event-specific'})`);
      });
      
      if (toDelete.length > 0) {
        console.log(`   ❌ Deleting ${toDelete.length} duplicates:`);
        for (const wod of toDelete) {
          console.log(`      - ${wod.wodId} (eventId: ${wod.eventId})`);
          
          await ddb.send(new DeleteCommand({
            TableName: WODS_TABLE,
            Key: {
              eventId: wod.eventId,
              wodId: wod.wodId
            }
          }));
          
          deletedCount++;
        }
      }
    }
  }
  
  console.log(`\n✅ Cleanup complete!`);
  console.log(`   WODs deleted: ${deletedCount}`);
  console.log(`   WODs remaining: ${wods.length - deletedCount}`);
}

cleanupDuplicateWods().catch(console.error);
