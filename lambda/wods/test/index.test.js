const { handler } = require('../index');
const { createApiEvent } = require('../../shared/test/helpers');

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('WODs Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WODS_TABLE = 'test-wods';
  });

  it('should handle GET /wods', async () => {
    const event = createApiEvent('GET', '/wods');
    const response = await handler(event);
    expect(response.statusCode).toBeDefined();
  });
});
