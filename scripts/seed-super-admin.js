const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

// Actual table names from deployment
const ROLES_TABLE = 'ScorinGames-AuthorizationRolesTable118AC625-L8SNGAZNULK8';
const PERMISSIONS_TABLE = 'ScorinGames-AuthorizationPermissionsTable79EDEB0E-1LQMVKEQ20WAQ';
const USER_ROLES_TABLE = 'ScorinGames-AuthorizationUserRolesTable77A8EE09-SNJ5J983JW50';

async function seedSuperAdmin() {
  try {
    // Create super admin role
    await ddb.send(new PutCommand({
      TableName: ROLES_TABLE,
      Item: {
        roleId: 'super_admin',
        name: 'Super Administrator',
        description: 'Full system access',
        createdAt: new Date().toISOString()
      }
    }));
    console.log('Created super_admin role');

    // Create super admin permissions
    await ddb.send(new PutCommand({
      TableName: PERMISSIONS_TABLE,
      Item: {
        roleId: 'super_admin',
        resource: '*',
        actions: ['*'],
        createdAt: new Date().toISOString()
      }
    }));
    console.log('Created super_admin permissions');

    // Assign super admin role to admin@athleon.fitness
    await ddb.send(new PutCommand({
      TableName: USER_ROLES_TABLE,
      Item: {
        userId: '618bb540-0061-7013-ea5b-0e9b625ebbdf', // Super admin user ID from Cognito
        contextId: 'global',
        roleId: 'super_admin',
        email: 'admin@athleon.fitness',
        assignedAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
      }
    }));
    console.log('Assigned super_admin role to admin@athleon.fitness');

    console.log('Super admin setup complete!');
  } catch (error) {
    console.error('Error setting up super admin:', error);
  }
}

seedSuperAdmin();
