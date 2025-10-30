const { handler } = require('../index');
const { createApiEvent } = require('../../shared/test/helpers');

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Organizations Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ORGANIZATIONS_TABLE = 'test-orgs';
    process.env.ORGANIZATION_MEMBERS_TABLE = 'test-org-members';
  });

  it('should handle GET /organizations', async () => {
    const event = createApiEvent('GET', '/organizations');
    const response = await handler(event);
    expect(response.statusCode).toBeDefined();
  });

  it('should require authentication', async () => {
    const event = createApiEvent('POST', '/organizations');
    delete event.requestContext.authorizer;
    const response = await handler(event);
    expect(response.statusCode).toBe(401);
  });
});
