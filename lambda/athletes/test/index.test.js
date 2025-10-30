const { handler } = require('../index');
const { createApiEvent } = require('../../shared/test/helpers');

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Athletes Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ATHLETES_TABLE = 'test-athletes';
    process.env.ATHLETE_EVENTS_TABLE = 'test-athlete-events';
  });

  it('should handle GET /athletes', async () => {
    const event = createApiEvent('GET', '/athletes');
    const response = await handler(event);
    expect(response.statusCode).toBeDefined();
  });
});
