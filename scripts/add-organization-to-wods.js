const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const WODS_TABLE = process.env.WODS_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;

async function addOrganizationToWods() {
  console.log('🔍 Scanning WODs without organizationId...\n');
  
  const { Items: wods } = await ddb.send(new ScanCommand({
    TableName: WODS_TABLE
  }));
  
  console.log(`Found ${wods.length} total WODs\n`);
  
  let updatedCount = 0;
  
  for (const wod of wods) {
    // Skip templates and transversal WODs
    if (wod.eventId === 'template' || wod.eventId === 'transversal' || wod.isTransversal) {
      console.log(`⏭️  Skipping ${wod.name} (${wod.eventId}) - template/transversal`);
      continue;
    }
    
    // Skip if already has organizationId
    if (wod.organizationId) {
      console.log(`✅ ${wod.name} already has organizationId: ${wod.organizationId}`);
      continue;
    }
    
    // Get organization for this event
    try {
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        IndexName: 'event-organization-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': wod.eventId
        }
      }));
      
      const organizationId = Items?.[0]?.organizationId;
      
      if (organizationId) {
        console.log(`📝 Updating ${wod.name} (${wod.wodId}) with organizationId: ${organizationId}`);
        
        await ddb.send(new UpdateCommand({
          TableName: WODS_TABLE,
          Key: {
            eventId: wod.eventId,
            wodId: wod.wodId
          },
          UpdateExpression: 'SET organizationId = :orgId, updatedAt = :now',
          ExpressionAttributeValues: {
            ':orgId': organizationId,
            ':now': new Date().toISOString()
          }
        }));
        
        updatedCount++;
      } else {
        console.log(`⚠️  No organization found for ${wod.name} (event: ${wod.eventId})`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${wod.name}:`, error.message);
    }
  }
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   WODs updated: ${updatedCount}`);
}

addOrganizationToWods().catch(console.error);
