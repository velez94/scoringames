const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const cognito = new CognitoIdentityProviderClient({});

const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE;
const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;
const USER_POOL_ID = process.env.USER_POOL_ID;

async function getUserDetails(userId) {
  try {
    const response = await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId
    }));
    
    const attributes = response.UserAttributes.reduce((acc, attr) => {
      acc[attr.Name] = attr.Value;
      return acc;
    }, {});
    
    return {
      email: attributes.email,
      firstName: attributes.given_name || '',
      lastName: attributes.family_name || ''
    };
  } catch (error) {
    console.error('Error fetching user from Cognito:', error);
    return { email: '', firstName: '', lastName: '' };
  }
}

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
      if (isSuperAdmin) {
        // Super admin gets all organizations
        const { Items } = await ddb.send(new ScanCommand({
          TableName: ORGANIZATIONS_TABLE
        }));
        
        const orgs = Items.map(org => ({ ...org, role: 'super_admin' }));
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(orgs)
        };
      } else {
        // Regular users get their organizations
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
      
      if (!org) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Organization not found' })
        };
      }
      
      // Fetch creator details
      const creatorDetails = await getUserDetails(org.createdBy);
      const creatorName = creatorDetails.firstName && creatorDetails.lastName
        ? `${creatorDetails.firstName} ${creatorDetails.lastName}`
        : org.createdBy;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ...org, creatorName })
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
      
      // Fetch user details from Cognito for each member
      const membersWithDetails = await Promise.all(
        (Items || []).map(async (member) => {
          const userDetails = await getUserDetails(member.userId);
          return { ...member, ...userDetails };
        })
      );
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(membersWithDetails)
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
    
    // DELETE /organizations/{id} - Delete organization
    if (path.match(/^\/organizations\/[^/]+$/) && method === 'DELETE') {
      const organizationId = path.split('/')[2];
      
      const { Item: membership } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      
      if (!isSuperAdmin && (!membership || membership.role !== 'owner')) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Only owners can delete organizations' })
        };
      }
      
      // Delete organization
      await ddb.send(new DeleteCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { organizationId }
      }));
      
      // Delete all members
      const { Items: members } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: { ':organizationId': organizationId }
      }));
      
      await Promise.all(
        (members || []).map(member =>
          ddb.send(new DeleteCommand({
            TableName: ORGANIZATION_MEMBERS_TABLE,
            Key: { organizationId, userId: member.userId }
          }))
        )
      );
      
      // Delete organization-event links
      const { Items: orgEvents } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: { ':organizationId': organizationId }
      }));
      
      await Promise.all(
        (orgEvents || []).map(orgEvent =>
          ddb.send(new DeleteCommand({
            TableName: ORGANIZATION_EVENTS_TABLE,
            Key: { organizationId, eventId: orgEvent.eventId }
          }))
        )
      );
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Organization deleted' })
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
