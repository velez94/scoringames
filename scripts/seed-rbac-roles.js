const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

// Get table names from environment or use defaults
const ROLES_TABLE = process.env.ROLES_TABLE || 'ScorinGames-AuthorizationRolesTable';
const PERMISSIONS_TABLE = process.env.PERMISSIONS_TABLE || 'ScorinGames-AuthorizationPermissionsTable';

const roles = [
  {
    roleId: 'super_admin',
    name: 'Super Administrator',
    description: 'Full system access across all organizations'
  },
  {
    roleId: 'org_owner',
    name: 'Organization Owner',
    description: 'Full control over organization and its events'
  },
  {
    roleId: 'org_admin',
    name: 'Organization Administrator',
    description: 'Manage organization members and events'
  },
  {
    roleId: 'org_member',
    name: 'Organization Member',
    description: 'Create and manage events within organization'
  },
  {
    roleId: 'athlete',
    name: 'Athlete',
    description: 'Register for events and submit scores'
  }
];

const permissions = [
  // Super Admin - all permissions
  { roleId: 'super_admin', resource: 'system', actions: ['*'] },
  { roleId: 'super_admin', resource: 'organizations', actions: ['*'] },
  { roleId: 'super_admin', resource: 'events', actions: ['*'] },
  { roleId: 'super_admin', resource: 'wods', actions: ['*'] },
  { roleId: 'super_admin', resource: 'categories', actions: ['*'] },
  { roleId: 'super_admin', resource: 'athletes', actions: ['*'] },
  { roleId: 'super_admin', resource: 'scores', actions: ['*'] },

  // Organization Owner
  { roleId: 'org_owner', resource: 'organizations', actions: ['read', 'update', 'delete'] },
  { roleId: 'org_owner', resource: 'events', actions: ['create', 'read', 'update', 'delete'] },
  { roleId: 'org_owner', resource: 'wods', actions: ['create', 'read', 'update', 'delete'] },
  { roleId: 'org_owner', resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
  { roleId: 'org_owner', resource: 'athletes', actions: ['read'] },
  { roleId: 'org_owner', resource: 'scores', actions: ['read', 'update', 'delete'] },

  // Organization Admin
  { roleId: 'org_admin', resource: 'organizations', actions: ['read'] },
  { roleId: 'org_admin', resource: 'events', actions: ['create', 'read', 'update', 'delete'] },
  { roleId: 'org_admin', resource: 'wods', actions: ['create', 'read', 'update', 'delete'] },
  { roleId: 'org_admin', resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
  { roleId: 'org_admin', resource: 'athletes', actions: ['read'] },
  { roleId: 'org_admin', resource: 'scores', actions: ['read', 'update'] },

  // Organization Member
  { roleId: 'org_member', resource: 'events', actions: ['create', 'read', 'update'] },
  { roleId: 'org_member', resource: 'wods', actions: ['create', 'read', 'update'] },
  { roleId: 'org_member', resource: 'categories', actions: ['create', 'read', 'update'] },
  { roleId: 'org_member', resource: 'athletes', actions: ['read'] },
  { roleId: 'org_member', resource: 'scores', actions: ['read'] },

  // Athlete
  { roleId: 'athlete', resource: 'events', actions: ['read'] },
  { roleId: 'athlete', resource: 'athletes', actions: ['read', 'update'] },
  { roleId: 'athlete', resource: 'scores', actions: ['create', 'read'] }
];

async function seedRoles() {
  console.log('Seeding RBAC roles and permissions...');
  
  try {
    // Seed roles
    for (const role of roles) {
      await ddb.send(new PutCommand({
        TableName: ROLES_TABLE,
        Item: {
          ...role,
          createdAt: new Date().toISOString()
        }
      }));
      console.log(`✓ Created role: ${role.name}`);
    }

    // Seed permissions
    for (const permission of permissions) {
      await ddb.send(new PutCommand({
        TableName: PERMISSIONS_TABLE,
        Item: {
          ...permission,
          createdAt: new Date().toISOString()
        }
      }));
      console.log(`✓ Created permission: ${permission.roleId} -> ${permission.resource} [${permission.actions.join(', ')}]`);
    }

    console.log('\n🎉 RBAC seeding completed successfully!');
    console.log(`📊 Created ${roles.length} roles and ${permissions.length} permissions`);
    
  } catch (error) {
    console.error('❌ Error seeding RBAC:', error);
    process.exit(1);
  }
}

seedRoles();
