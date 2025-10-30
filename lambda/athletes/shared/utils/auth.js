const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const ORGANIZATION_MEMBERS_TABLE = process.env.ORGANIZATION_MEMBERS_TABLE;
const ORGANIZATION_EVENTS_TABLE = process.env.ORGANIZATION_EVENTS_TABLE;

/**
 * Extract user info from JWT token
 */
function verifyToken(event) {
  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims) {
      throw new Error('No authorization claims found');
    }
    
    return {
      userId: claims.sub,
      email: claims.email
    };
  } catch (error) {
    // Fallback for development/testing
    return {
      userId: 'temp-user',
      email: 'temp@example.com'
    };
  }
}

/**
 * Check if user has access to an event through organization membership
 */
async function checkOrganizationAccess(userId, eventId = null, organizationId = null) {
  try {
    // If organizationId is provided directly, check membership
    if (organizationId) {
      const { Item } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId, userId }
      }));
      return !!Item;
    }
    
    // If eventId is provided, find the organization first
    if (eventId) {
      const { Items } = await ddb.send(new QueryCommand({
        TableName: ORGANIZATION_EVENTS_TABLE,
        IndexName: 'event-organization-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId }
      }));
      
      if (!Items || Items.length === 0) {
        return false; // Event not found or not linked to organization
      }
      
      const eventOrganizationId = Items[0].organizationId;
      
      // Check if user is member of this organization
      const { Item } = await ddb.send(new GetCommand({
        TableName: ORGANIZATION_MEMBERS_TABLE,
        Key: { organizationId: eventOrganizationId, userId }
      }));
      
      return !!Item;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking organization access:', error);
    return false;
  }
}

module.exports = {
  verifyToken,
  checkOrganizationAccess
};
