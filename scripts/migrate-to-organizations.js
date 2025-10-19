const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);
const cognito = new CognitoIdentityProviderClient({ region: 'us-east-2' });

const USER_POOL_ID = 'us-east-2_mWb6Dnztz';
const ORGANIZER_EVENTS_TABLE = 'CalisthenicsAppStack-OrganizerEventsTable6FAFF2EB-1EN2I2JHF78CT';
const ORGANIZATIONS_TABLE = 'CalisthenicsAppStack-OrganizationsTable01047E98-4OXZTG3S51HM';
const ORGANIZATION_MEMBERS_TABLE = 'CalisthenicsAppStack-OrganizationMembersTableA6523B04-14CRPSEQ77JYH';
const ORGANIZATION_EVENTS_TABLE = 'CalisthenicsAppStack-OrganizationEventsTable6C44D408-JKEAI0YBRM9Q';

async function getUserEmail(userId) {
  try {
    const { UserAttributes } = await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId
    }));
    return UserAttributes.find(a => a.Name === 'email')?.Value;
  } catch (error) {
    console.error(`Failed to get email for ${userId}:`, error.message);
    return null;
  }
}

async function migrate() {
  console.log('Starting migration to organization model...\n');
  
  // Get all organizer-event relationships
  const { Items: organizerEvents } = await ddb.send(new ScanCommand({
    TableName: ORGANIZER_EVENTS_TABLE
  }));
  
  console.log(`Found ${organizerEvents.length} organizer-event relationships\n`);
  
  // Group by userId
  const organizerMap = {};
  for (const item of organizerEvents) {
    if (!organizerMap[item.userId]) {
      organizerMap[item.userId] = [];
    }
    organizerMap[item.userId].push(item.eventId);
  }
  
  console.log(`Found ${Object.keys(organizerMap).length} unique organizers\n`);
  
  // Create organization for each organizer
  for (const [userId, eventIds] of Object.entries(organizerMap)) {
    const email = await getUserEmail(userId);
    const organizationId = `org-${userId.substring(0, 8)}-${Date.now()}`;
    const orgName = email ? `${email.split('@')[0]}'s Organization` : `Organization ${userId.substring(0, 8)}`;
    
    console.log(`Creating organization for ${email || userId}...`);
    
    // Create organization
    await ddb.send(new PutCommand({
      TableName: ORGANIZATIONS_TABLE,
      Item: {
        organizationId,
        name: orgName,
        description: 'Auto-created during migration',
        settings: {},
        createdAt: new Date().toISOString(),
        createdBy: userId,
        migratedFrom: 'legacy'
      }
    }));
    
    // Add user as owner
    await ddb.send(new PutCommand({
      TableName: ORGANIZATION_MEMBERS_TABLE,
      Item: {
        organizationId,
        userId,
        role: 'owner',
        joinedAt: new Date().toISOString()
      }
    }));
    
    // Link events to organization
    for (const eventId of eventIds) {
      await ddb.send(new PutCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        Item: {
          organizationId,
          eventId,
          createdAt: new Date().toISOString(),
          createdBy: userId,
          migratedFrom: 'legacy'
        }
      }));
    }
    
    console.log(`  ✓ Created ${orgName} with ${eventIds.length} events\n`);
  }
  
  console.log('Migration complete!');
  console.log('\nSummary:');
  console.log(`- Organizations created: ${Object.keys(organizerMap).length}`);
  console.log(`- Events migrated: ${organizerEvents.length}`);
  console.log('\nNote: Legacy ORGANIZER_EVENTS_TABLE is preserved for rollback');
}

migrate().catch(console.error);
