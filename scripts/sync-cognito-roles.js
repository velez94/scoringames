const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-2' });
const ddbClient = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(ddbClient);

const USER_POOL_ID = 'us-east-2_KUxqDApCY';
const USER_ROLES_TABLE = 'ScorinGames-AuthorizationUserRolesTable77A8EE09-SNJ5J983JW50';

// Cognito to RBAC role mapping
const ROLE_MAPPING = {
  'super_admin': 'super_admin',
  'organizer': 'org_member', 
  'athlete': 'athlete'
};

async function syncCognitoRoles() {
  try {
    console.log('Fetching users from Cognito...');
    
    const { Users } = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID
    }));
    
    console.log(`Found ${Users.length} users`);
    
    for (const user of Users) {
      const attributes = {};
      user.Attributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
      
      const userId = attributes.sub;
      const email = attributes.email;
      const cognitoRole = attributes['custom:role'];
      
      if (!cognitoRole || !ROLE_MAPPING[cognitoRole]) {
        console.log(`Skipping ${email} - no valid role (${cognitoRole})`);
        continue;
      }
      
      const rbacRole = ROLE_MAPPING[cognitoRole];
      
      await ddb.send(new PutCommand({
        TableName: USER_ROLES_TABLE,
        Item: {
          userId,
          contextId: 'global',
          roleId: rbacRole,
          email,
          assignedAt: new Date().toISOString(),
          syncedFromCognito: true,
          ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
        }
      }));
      
      console.log(`✅ Synced ${email}: ${cognitoRole} -> ${rbacRole}`);
    }
    
    console.log('Sync completed!');
  } catch (error) {
    console.error('Error syncing roles:', error);
  }
}

syncCognitoRoles();
