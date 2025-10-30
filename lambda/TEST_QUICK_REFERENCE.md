# Testing Quick Reference

## Run Tests

```bash
# Single package
cd lambda/scoring && npm test

# Watch mode
cd lambda/scoring && npm run test:watch

# Coverage
cd lambda/scoring && npm run test:coverage

# All packages
cd lambda && ./test-all.sh
```

## Test Structure

```javascript
const { handler } = require('../index');
const { createApiEvent } = require('../../shared/test/helpers');

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  it('should handle request', async () => {
    const event = createApiEvent('GET', '/path');
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
  });
});
```

## Test Helpers

```javascript
// Mock API Gateway event
const event = createApiEvent('GET', '/path', { data: 'value' }, 'user-id');

// Mock DynamoDB response
const response = mockDynamoDBResponse({ id: '123' });
```

## Coverage Goals

- Pure Functions: 100%
- Handlers: 70%+
- Utilities: 90%+

## Test Patterns

✅ Test business logic
✅ Mock AWS services
✅ Test error cases
✅ Keep tests fast

❌ Don't test AWS SDK
❌ Don't make real API calls
❌ Don't test implementation details
