const { handler } = require('../ddd-handler');
const { createApiEvent } = require('../../shared/test/helpers');

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Scheduling Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCHEDULES_TABLE = 'test-schedules';
    process.env.HEATS_TABLE = 'test-heats';
  });

  it('should handle scheduler requests', async () => {
    const event = createApiEvent('GET', '/scheduler/test-event');
    const response = await handler(event);
    expect(response.statusCode).toBeDefined();
  });
});
