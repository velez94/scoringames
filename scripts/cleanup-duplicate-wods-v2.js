const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = process.env.WODS_TABLE;

async function cleanupDuplicateWods() {
  console.log('🔍 Scanning for duplicate WODs...\n');
  
  const { Items: wods } = await ddb.send(new ScanCommand({
    TableName: WODS_TABLE
  }));
  
  console.log(`Found ${wods.length} total WODs\n`);
  
  // Group by name
  const groups = {};
  wods.forEach(wod => {
    const key = wod.name.toLowerCase();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(wod);
  });
  
  let deletedCount = 0;
  const toKeep = new Set();
  
  for (const [name, group] of Object.entries(groups)) {
    console.log(`\n📊 WOD: "${name}" (${group.length} entries)`);
    
    // Categorize WODs
    const templates = group.filter(w => w.eventId === 'template');
    const shared = group.filter(w => w.isShared && w.eventId !== 'template');
    const eventSpecific = group.filter(w => !w.isShared && !w.isTransversal && w.eventId !== 'template');
    
    console.log(`   Templates: ${templates.length}, Shared: ${shared.length}, Event-specific: ${eventSpecific.length}`);
    
    // Keep 1 template OR 1 shared (prefer template)
    if (templates.length > 0) {
      toKeep.add(templates[0].wodId);
      console.log(`   ✅ Keep template: ${templates[0].wodId}`);
      
      // Delete other templates
      for (let i = 1; i < templates.length; i++) {
        console.log(`   ❌ Delete template: ${templates[i].wodId}`);
      }
    } else if (shared.length > 0) {
      toKeep.add(shared[0].wodId);
      console.log(`   ✅ Keep shared: ${shared[0].wodId}`);
      
      // Delete other shared
      for (let i = 1; i < shared.length; i++) {
        console.log(`   ❌ Delete shared: ${shared[i].wodId}`);
      }
    }
    
    // Keep 1 event-specific
    if (eventSpecific.length > 0) {
      toKeep.add(eventSpecific[0].wodId);
      console.log(`   ✅ Keep event-specific: ${eventSpecific[0].wodId} (event: ${eventSpecific[0].eventId})`);
      
      // Delete other event-specific
      for (let i = 1; i < eventSpecific.length; i++) {
        console.log(`   ❌ Delete event-specific: ${eventSpecific[i].wodId} (event: ${eventSpecific[i].eventId})`);
      }
    }
    
    // Delete all WODs not in toKeep
    for (const wod of group) {
      if (!toKeep.has(wod.wodId)) {
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
  
  console.log(`\n✅ Cleanup complete!`);
  console.log(`   WODs deleted: ${deletedCount}`);
  console.log(`   WODs remaining: ${wods.length - deletedCount}`);
}

cleanupDuplicateWods().catch(console.error);
