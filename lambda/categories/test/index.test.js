const { handler } = require('../index');
const { createApiEvent } = require('../../shared/test/helpers');

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Categories Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CATEGORIES_TABLE = 'test-categories';
  });

  it('should handle GET /categories', async () => {
    const event = createApiEvent('GET', '/categories');
    const response = await handler(event);
    expect(response.statusCode).toBeDefined();
  });
});
