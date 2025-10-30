const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const ROLES_TABLE = process.env.ROLES_TABLE;
const PERMISSIONS_TABLE = process.env.PERMISSIONS_TABLE;
const USER_ROLES_TABLE = process.env.USER_ROLES_TABLE;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Cache for permissions (in-memory)
const permissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.claims?.email;

  // Clean path - remove /authorization prefix if present
  let cleanPath = path;
  if (path.startsWith('/authorization')) {
    cleanPath = path.substring('/authorization'.length) || '/';
  }

  console.log('Authorization request:', { path, cleanPath, method, userEmail });

  try {
    // Authorization check endpoint
    if (cleanPath === '/authorize' && method === 'POST') {
      const { userId, resource, action, contextId } = JSON.parse(event.body);
      const authorized = await checkPermission(userId, resource, action, contextId);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ authorized, userId, resource, action })
      };
    }

    // Super admin only endpoints
    if (userEmail !== 'admin@athleon.fitness') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Super admin access required' })
      };
    }

    // Get all roles
    if (cleanPath === '/roles' && method === 'GET') {
      const { Items } = await ddb.send(new ScanCommand({ TableName: ROLES_TABLE }));
      return { statusCode: 200, headers, body: JSON.stringify(Items || []) };
    }

    // Create role
    if (cleanPath === '/roles' && method === 'POST') {
      const { roleId, name, description } = JSON.parse(event.body);
      
      await ddb.send(new PutCommand({
        TableName: ROLES_TABLE,
        Item: { roleId, name, description, createdAt: new Date().toISOString() }
      }));

      return { statusCode: 201, headers, body: JSON.stringify({ message: 'Role created' }) };
    }

    // Get all permissions
    if (cleanPath === '/permissions' && method === 'GET') {
      const { Items } = await ddb.send(new ScanCommand({ TableName: PERMISSIONS_TABLE }));
      return { statusCode: 200, headers, body: JSON.stringify(Items || []) };
    }

    // Create permission
    if (cleanPath === '/permissions' && method === 'POST') {
      const { roleId, resource, actions } = JSON.parse(event.body);
      
      await ddb.send(new PutCommand({
        TableName: PERMISSIONS_TABLE,
        Item: { roleId, resource, actions, createdAt: new Date().toISOString() }
      }));

      return { statusCode: 201, headers, body: JSON.stringify({ message: 'Permission created' }) };
    }

    // Get all user roles
    if (cleanPath === '/user-roles' && method === 'GET') {
      const { Items } = await ddb.send(new ScanCommand({ TableName: USER_ROLES_TABLE }));
      return { statusCode: 200, headers, body: JSON.stringify(Items || []) };
    }

    // Assign user role
    if (cleanPath === '/user-roles' && method === 'POST') {
      const { userId, email, roleId, contextId } = JSON.parse(event.body);
      
      await ddb.send(new PutCommand({
        TableName: USER_ROLES_TABLE,
        Item: {
          userId,
          contextId: contextId || 'global',
          roleId,
          email,
          assignedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
        }
      }));

      // Clear cache for this user
      clearUserCache(userId);

      return { statusCode: 201, headers, body: JSON.stringify({ message: 'Role assigned' }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ message: 'Not found' }) };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};

async function checkPermission(userId, resource, action, contextId = 'global') {
  const cacheKey = `${userId}:${resource}:${action}:${contextId}`;
  
  // Check cache first
  const cached = permissionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.authorized;
  }

  try {
    // Get user roles for context
    const { Items: userRoles } = await ddb.send(new QueryCommand({
      TableName: USER_ROLES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'contextId = :contextId OR contextId = :global',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':contextId': contextId,
        ':global': 'global'
      }
    }));

    if (!userRoles || userRoles.length === 0) {
      permissionsCache.set(cacheKey, { authorized: false, timestamp: Date.now() });
      return false;
    }

    // Check permissions for each role
    for (const userRole of userRoles) {
      const { Items: permissions } = await ddb.send(new QueryCommand({
        TableName: PERMISSIONS_TABLE,
        KeyConditionExpression: 'roleId = :roleId AND resource = :resource',
        ExpressionAttributeValues: {
          ':roleId': userRole.roleId,
          ':resource': resource
        }
      }));

      if (permissions && permissions.length > 0) {
        const permission = permissions[0];
        if (permission.actions.includes(action) || permission.actions.includes('*')) {
          permissionsCache.set(cacheKey, { authorized: true, timestamp: Date.now() });
          return true;
        }
      }
    }

    permissionsCache.set(cacheKey, { authorized: false, timestamp: Date.now() });
    return false;

  } catch (error) {
    console.error('Authorization check failed:', error);
    return false;
  }
}

function clearUserCache(userId) {
  for (const [key] of permissionsCache) {
    if (key.startsWith(`${userId}:`)) {
      permissionsCache.delete(key);
    }
  }
}
