const { handler } = require('../index');
const { createApiEvent } = require('../../shared/test/helpers');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-eventbridge');

describe('Competitions Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVENTS_TABLE = 'test-events';
    process.env.ORGANIZATION_EVENTS_TABLE = 'test-org-events';
    process.env.ORGANIZATION_MEMBERS_TABLE = 'test-org-members';
  });

  it('should return 404 for unknown path', async () => {
    const event = createApiEvent('GET', '/unknown');
    const response = await handler(event);
    
    expect(response.statusCode).toBe(404);
  });

  it('should require authentication for protected endpoints', async () => {
    const event = createApiEvent('GET', '/competitions');
    delete event.requestContext.authorizer;
    
    const response = await handler(event);
    expect(response.statusCode).toBe(401);
  });
});
