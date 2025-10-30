// Mock AWS SDK clients
const mockDynamoDBClient = {
  send: jest.fn()
};

const mockEventBridgeClient = {
  send: jest.fn()
};

const mockS3Client = {
  send: jest.fn()
};

// Mock API Gateway event
const createApiEvent = (method, path, body = null, userId = 'test-user') => ({
  httpMethod: method,
  path,
  resource: path,
  body: body ? JSON.stringify(body) : null,
  requestContext: {
    authorizer: {
      claims: {
        sub: userId,
        email: 'test@example.com'
      }
    }
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

// Mock DynamoDB responses
const mockDynamoDBResponse = (data) => ({
  Item: data,
  Items: Array.isArray(data) ? data : [data]
});

module.exports = {
  mockDynamoDBClient,
  mockEventBridgeClient,
  mockS3Client,
  createApiEvent,
  mockDynamoDBResponse
};
