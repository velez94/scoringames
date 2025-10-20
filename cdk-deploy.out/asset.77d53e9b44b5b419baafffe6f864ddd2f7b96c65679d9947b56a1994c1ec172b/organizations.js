const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE;
const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;

exports.handler = async (event) => {
  console.log('Organizations Service:', JSON.stringify(event, null, 2));
  
  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.claims?.email;
  
  const isSuperAdmin = userEmail === 'admin@scoringames.com';
  
  try {
    // GET /organizations - List user's organizations
    if (path === '/organizations' && method === 'GET') {
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        IndexName: 'user-organizations-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId }
      }));
      
      const orgs = await Promise.all(
        (Items || []).map(async (membership) => {
          const { Item } = await ddb.send(new GetCommand({
            TableName: ORGANIZATIONS_TABLE,
            Key: { organizationId: membership.organizationId }
          }));
          return { ...Item, role: membership.role };
        })
      );
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(orgs.filter(o => o.organizationId))
      };
    }
    
    // POST /organizations - Create organization
    if (path === '/organizations' && method === 'POST') {
      const body = JSON.parse(event.body);
      const organizationId = `org-${Date.now()}`;
      
      await ddb.send(new PutCommand({
        TableName: ORGANIZATIONS_TABLE,
        Item: {
          organizationId,
          name: body.name,
          description: body.description || '',
          settings: body.settings || {},
          createdAt: new Date().toISOString(),
          createdBy: userId
        }
      }));
      
      await ddb.send(new PutCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Item: {
          organizationId,
          userId,
          role: 'owner',
          joinedAt: new Date().toISOString()
        }
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ organizationId, name: body.name })
      };
    }
    
    // GET /organizations/{id} - Get organization details
    if (path.match(/^\/organizations\/[^/]+$/) && method === 'GET') {
      const organizationId = path.split('/')[2];
      
      const { Item: membership } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      
      if (!membership && !isSuperAdmin) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Not a member of this organization' })
        };
      }
      
      const { Item: org } = await ddb.send(new GetCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { organizationId }
      }));
      
      return {
        statusCode: org ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(org || { message: 'Organization not found' })
      };
    }
    
    // PUT /organizations/{id} - Update organization
    if (path.match(/^\/organizations\/[^/]+$/) && method === 'PUT') {
      const organizationId = path.split('/')[2];
      const body = JSON.parse(event.body);
      
      const { Item: membership } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Insufficient permissions' })
        };
      }
      
      const updateExpr = [];
      const exprAttrNames = {};
      const exprAttrValues = {};
      
      if (body.name) {
        updateExpr.push('#name = :name');
        exprAttrNames['#name'] = 'name';
        exprAttrValues[':name'] = body.name;
      }
      if (body.description !== undefined) {
        updateExpr.push('#description = :description');
        exprAttrNames['#description'] = 'description';
        exprAttrValues[':description'] = body.description;
      }
      if (body.settings) {
        updateExpr.push('#settings = :settings');
        exprAttrNames['#settings'] = 'settings';
        exprAttrValues[':settings'] = body.settings;
      }
      
      await ddb.send(new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { organizationId },
        UpdateExpression: `SET ${updateExpr.join(', ')}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Organization updated' })
      };
    }
    
    // GET /organizations/{id}/members - List members
    if (path.match(/^\/organizations\/[^/]+\/members$/) && method === 'GET') {
      const organizationId = path.split('/')[2];
      
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: { ':organizationId': organizationId }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Items || [])
      };
    }
    
    // POST /organizations/{id}/members - Add member
    if (path.match(/^\/organizations\/[^/]+\/members$/) && method === 'POST') {
      const organizationId = path.split('/')[2];
      const body = JSON.parse(event.body);
      
      const { Item: membership } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Insufficient permissions' })
        };
      }
      
      await ddb.send(new PutCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Item: {
          organizationId,
          userId: body.userId,
          role: body.role || 'member',
          joinedAt: new Date().toISOString(),
          invitedBy: userId
        }
      }));
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Member added' })
      };
    }
    
    // PUT /organizations/{id}/members/{userId} - Update member role
    if (path.match(/^\/organizations\/[^/]+\/members\/[^/]+$/) && method === 'PUT') {
      const [, , organizationId, , targetUserId] = path.split('/');
      const body = JSON.parse(event.body);
      
      const { Item: membership } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      
      if (!membership || membership.role !== 'owner') {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Only owners can change roles' })
        };
      }
      
      await ddb.send(new UpdateCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId: targetUserId },
        UpdateExpression: 'SET #role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': body.role }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Role updated' })
      };
    }
    
    // DELETE /organizations/{id}/members/{userId} - Remove member
    if (path.match(/^\/organizations\/[^/]+\/members\/[^/]+$/) && method === 'DELETE') {
      const [, , organizationId, , targetUserId] = path.split('/');
      
      const { Item: membership } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Insufficient permissions' })
        };
      }
      
      await ddb.send(new DeleteCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId: targetUserId }
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Member removed' })
      };
    }
    
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Not found' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: error.message })
    };
  }
};
