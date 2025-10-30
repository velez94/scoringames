# Lambda Testing Guide

## Overview

All Lambda domain packages include Jest unit tests for isolated testing without AWS dependencies.

## Test Structure

```
lambda/
├── shared/
│   ├── test/
│   │   ├── helpers.js        # Test utilities
│   │   └── auth.test.js      # Auth utility tests
│   └── jest.config.js
├── competitions/
│   ├── test/
│   │   └── index.test.js     # Handler tests
│   └── jest.config.js
├── scoring/
│   ├── test/
│   │   └── calculator.test.js # Calculator tests
│   └── jest.config.js
└── [other domains...]
```

## Running Tests

### Single Package
```bash
cd lambda/scoring
npm test
```

### Watch Mode
```bash
cd lambda/scoring
npm run test:watch
```

### Coverage Report
```bash
cd lambda/scoring
npm run test:coverage
```

### All Packages
```bash
cd lambda
./test-all.sh
```

## Test Utilities

### Mock API Gateway Event
```javascript
const { createApiEvent } = require('../../shared/test/helpers');

const event = createApiEvent('GET', '/path', { body: 'data' }, 'user-id');
```

### Mock DynamoDB Response
```javascript
const { mockDynamoDBResponse } = require('../../shared/test/helpers');

const response = mockDynamoDBResponse({ id: '123', name: 'Test' });
```

## Writing Tests

### Basic Handler Test
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

  it('should handle GET request', async () => {
    const event = createApiEvent('GET', '/resource');
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
  });
});
```

### Pure Function Test
```javascript
const { calculateScore } = require('../calculator');

describe('Calculator', () => {
  it('should calculate score correctly', () => {
    const result = calculateScore(rawData, config);
    expect(result.calculatedScore).toBe(100);
  });
});
```

## Test Coverage Goals

- **Shared Utilities**: 90%+ coverage
- **Pure Functions**: 100% coverage (calculators, validators)
- **Handlers**: 70%+ coverage (focus on business logic)
- **EventBridge Handlers**: 80%+ coverage

## Mocking AWS Services

### DynamoDB
```javascript
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn().mockResolvedValue({ Item: { id: '123' } })
    }))
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn()
}));
```

### EventBridge
```javascript
jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutEventsCommand: jest.fn()
}));
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Lambda Functions

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd lambda
          for dir in */; do
            cd "$dir" && npm install && cd ..
          done
      - name: Run tests
        run: cd lambda && ./test-all.sh
```

## Best Practices

### ✅ Do
- Test business logic thoroughly
- Mock external dependencies
- Use descriptive test names
- Test error cases
- Keep tests fast (<1s per test)
- Test edge cases

### ❌ Don't
- Test AWS SDK internals
- Make real AWS API calls
- Test implementation details
- Write flaky tests
- Skip error handling tests

## Test Examples by Domain

### Competitions
- Event creation validation
- Organization membership checks
- Event publishing logic
- Image upload URL generation

### Scoring
- Classic score calculation
- Advanced EDS × EQS calculation
- Score validation
- Leaderboard sorting

### Athletes
- Profile creation
- Event registration
- Registration validation
- Duplicate prevention

### Organizations
- Organization creation
- Member management
- Role validation
- Access control

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="should calculate score"
```

### Verbose Output
```bash
npm test -- --verbose
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Performance Testing

For performance-critical functions:

```javascript
describe('Performance', () => {
  it('should calculate 1000 scores in <100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      calculateScore(rawData, config);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

## Integration Testing

For integration tests with real AWS services, use separate test files:

```
test/
├── unit/           # Fast, mocked tests
└── integration/    # Slow, real AWS tests
```

Run integration tests separately:
```bash
npm test -- --testPathPattern=integration
```

## Continuous Improvement

- Review test coverage weekly
- Add tests for bug fixes
- Refactor tests with code
- Update mocks when AWS SDK changes
- Document complex test scenarios
