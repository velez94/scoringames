const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const USER_ROLES_TABLE = process.env.USER_ROLES_TABLE;

// Cognito to RBAC role mapping
const ROLE_MAPPING = {
  'super_admin': 'super_admin',
  'organizer': 'org_member',
  'athlete': 'athlete'
};

exports.handler = async (event) => {
  console.log('Cognito sync event:', JSON.stringify(event, null, 2));
  
  try {
    const { userName, request } = event;
    const userAttributes = request.userAttributes;
    
    const userId = userAttributes.sub;
    const email = userAttributes.email;
    const cognitoRole = userAttributes['custom:role'];
    
    if (!cognitoRole || !ROLE_MAPPING[cognitoRole]) {
      console.log('No valid Cognito role found, skipping sync');
      return event;
    }
    
    const rbacRole = ROLE_MAPPING[cognitoRole];
    
    // Check if user role already exists
    const { Item } = await ddb.send(new GetCommand({
      TableName: USER_ROLES_TABLE,
      Key: {
        userId,
        contextId: 'global'
      }
    }));
    
    // Only create if doesn't exist or role changed
    if (!Item || Item.roleId !== rbacRole) {
      await ddb.send(new PutCommand({
        TableName: USER_ROLES_TABLE,
        Item: {
          userId,
          contextId: 'global',
          roleId: rbacRole,
          email,
          assignedAt: new Date().toISOString(),
          syncedFromCognito: true,
          ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
        }
      }));
      
      console.log(`Synced role: ${cognitoRole} -> ${rbacRole} for ${email}`);
    }
    
    return event;
  } catch (error) {
    console.error('Error syncing Cognito role:', error);
    return event; // Don't block login on sync failure
  }
};
