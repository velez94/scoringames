const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const EVENTS_TABLE = 'ScorinGames-CompetitionsEventsTable5FF68F4B-14FLK0VZGOYSQ';
const ORGANIZATION_EVENTS_TABLE = 'ScorinGames-OrganizationsOrganizationEventsTable7597D5EB-744A9V11WAGL';

async function cleanupDuplicateEvents() {
  console.log('🔍 Scanning for duplicate events...');
  
  // Get all events
  const { Items: events } = await ddb.send(new ScanCommand({
    TableName: EVENTS_TABLE
  }));
  
  console.log(`Found ${events.length} total events`);
  
  // Group events by name, location, and organization
  const eventGroups = {};
  
  for (const event of events) {
    const key = `${event.name}-${event.location}-${event.organizationId}`;
    if (!eventGroups[key]) {
      eventGroups[key] = [];
    }
    eventGroups[key].push(event);
  }
  
  // Find groups with duplicates
  const duplicateGroups = Object.entries(eventGroups).filter(([key, events]) => events.length > 1);
  
  console.log(`Found ${duplicateGroups.length} groups with duplicates:`);
  
  for (const [key, duplicates] of duplicateGroups) {
    console.log(`\n📋 Group: ${key} (${duplicates.length} events)`);
    
    // Sort by creation date
    duplicates.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Find the published event or keep the first one
    const publishedEvent = duplicates.find(e => e.published);
    const keepEvent = publishedEvent || duplicates[0];
    
    console.log(`✅ Keeping: ${keepEvent.eventId} (${keepEvent.published ? 'Published' : 'Draft'}) - ${keepEvent.createdAt}`);
    
    // Delete the rest
    for (const event of duplicates) {
      if (event.eventId !== keepEvent.eventId) {
        console.log(`❌ Deleting: ${event.eventId} (${event.published ? 'Published' : 'Draft'}) - ${event.createdAt}`);
        
        try {
          // Delete from Events table
          await ddb.send(new DeleteCommand({
            TableName: EVENTS_TABLE,
            Key: { eventId: event.eventId }
          }));
          
          // Delete from Organization Events table
          const { Items: orgEvents } = await ddb.send(new QueryCommand({
            TableName: ORGANIZATION_EVENTS_TABLE,
            IndexName: 'event-organization-index',
            KeyConditionExpression: 'eventId = :eventId',
            ExpressionAttributeValues: { ':eventId': event.eventId }
          }));
          
          for (const orgEvent of orgEvents || []) {
            await ddb.send(new DeleteCommand({
              TableName: ORGANIZATION_EVENTS_TABLE,
              Key: { 
                organizationId: orgEvent.organizationId,
                eventId: orgEvent.eventId
              }
            }));
          }
          
          console.log(`   ✓ Deleted from both tables`);
        } catch (error) {
          console.error(`   ❌ Error deleting ${event.eventId}:`, error.message);
        }
      }
    }
  }
  
  console.log('\n🎉 Cleanup completed!');
}

// Run the cleanup
cleanupDuplicateEvents().catch(console.error);
