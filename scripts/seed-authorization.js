const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const ROLES_TABLE = 'ScorinGames-Authorization-RolesTable';
const PERMISSIONS_TABLE = 'ScorinGames-Authorization-PermissionsTable';
const USER_ROLES_TABLE = 'ScorinGames-Authorization-UserRolesTable';

async function seedRoles() {
  const roles = [
    {
      roleId: 'super_admin',
      name: 'Super Administrator',
      description: 'Full system access'
    },
    {
      roleId: 'org_owner',
      name: 'Organization Owner',
      description: 'Full organization control'
    },
    {
      roleId: 'org_admin',
      name: 'Organization Admin',
      description: 'Manage members and events'
    },
    {
      roleId: 'org_member',
      name: 'Organization Member',
      description: 'Create and edit events'
    },
    {
      roleId: 'athlete',
      name: 'Athlete',
      description: 'Register for events and submit scores'
    }
  ];

  for (const role of roles) {
    await ddb.send(new PutCommand({
      TableName: ROLES_TABLE,
      Item: role
    }));
    console.log(`Created role: ${role.name}`);
  }
}

async function seedPermissions() {
  const permissions = [
    // Super Admin - all permissions
    { roleId: 'super_admin', resource: '*', actions: ['*'] },
    
    // Organization Owner
    { roleId: 'org_owner', resource: 'organizations', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_owner', resource: 'events', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_owner', resource: 'wods', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_owner', resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_owner', resource: 'members', actions: ['create', 'read', 'update', 'delete'] },
    
    // Organization Admin
    { roleId: 'org_admin', resource: 'events', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_admin', resource: 'wods', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_admin', resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
    { roleId: 'org_admin', resource: 'members', actions: ['create', 'read', 'update'] },
    
    // Organization Member
    { roleId: 'org_member', resource: 'events', actions: ['create', 'read', 'update'] },
    { roleId: 'org_member', resource: 'wods', actions: ['read'] },
    { roleId: 'org_member', resource: 'categories', actions: ['read'] },
    
    // Athlete
    { roleId: 'athlete', resource: 'events', actions: ['read'] },
    { roleId: 'athlete', resource: 'registrations', actions: ['create', 'read', 'update'] },
    { roleId: 'athlete', resource: 'scores', actions: ['create', 'read'] },
    { roleId: 'athlete', resource: 'profile', actions: ['read', 'update'] }
  ];

  for (const perm of permissions) {
    await ddb.send(new PutCommand({
      TableName: PERMISSIONS_TABLE,
      Item: perm
    }));
    console.log(`Created permission: ${perm.roleId} -> ${perm.resource}`);
  }
}

async function seedUserRoles() {
  const userRoles = [
    {
      userId: 'admin-user-id',
      contextId: 'global',
      roleId: 'super_admin',
      assignedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }
  ];

  for (const userRole of userRoles) {
    await ddb.send(new PutCommand({
      TableName: USER_ROLES_TABLE,
      Item: userRole
    }));
    console.log(`Assigned role: ${userRole.roleId} to ${userRole.userId}`);
  }
}

async function main() {
  try {
    console.log('Seeding authorization system...');
    await seedRoles();
    await seedPermissions();
    await seedUserRoles();
    console.log('Authorization system seeded successfully!');
  } catch (error) {
    console.error('Error seeding authorization system:', error);
  }
}

main();
