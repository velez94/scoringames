# ScorinGames E2E Tests

End-to-end tests for the ScorinGames platform using Playwright.

## Setup

1. **Install dependencies:**
   ```bash
   cd e2e-tests
   npm install
   npx playwright install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your test credentials and URLs
   ```

3. **Required environment variables:**
   - `BASE_URL`: Frontend URL (default: http://localhost:3000)
   - `API_BASE_URL`: Backend API URL
   - `TEST_SUPER_ADMIN_EMAIL` & `TEST_SUPER_ADMIN_PASSWORD`
   - `TEST_ORGANIZER_EMAIL` & `TEST_ORGANIZER_PASSWORD`
   - `TEST_ATHLETE_EMAIL` & `TEST_ATHLETE_PASSWORD`

## Running Tests

```bash
# Run all tests
npm test

# Run with UI mode
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Run specific test file
npx playwright test tests/public/events.spec.js

# Run tests for specific browser
npx playwright test --project=chromium

# Debug mode
npm run test:debug
```

## Test Structure

```
tests/
├── auth/           # Authentication & security tests
├── public/         # Public endpoints (no auth required)
├── organizer/      # Organizer workflow tests
├── athlete/        # Athlete workflow tests
└── utils/          # Test utilities and helpers
```

## Test Categories

### Public Tests
- Event browsing without authentication
- Public API endpoints
- Event details display

### Authentication Tests
- Login/logout flows for all user types
- Invalid credential handling
- Session management
- Role-based access control

### Organizer Tests
- Event creation and management
- Organization management
- Category and WOD management
- Event publishing workflow

### Athlete Tests
- Event registration
- Profile management
- Score submission
- Leaderboard viewing

### Security Tests
- Cross-tenant data isolation
- Input sanitization (XSS prevention)
- SQL injection protection
- Authorization enforcement
- Session timeout handling

## Best Practices

### Test Data Management
- Use `TestDataHelper` for generating test data
- Clean up created resources after tests
- Use unique identifiers to avoid conflicts

### Authentication
- Use `AuthHelper` for login/logout operations
- Test different user roles separately
- Handle authentication state properly

### API Testing
- Use `ApiHelper` for direct API calls
- Test both UI and API layers
- Verify response formats and status codes

### Security
- Never commit real credentials to version control
- Use test-specific accounts only
- Test authorization boundaries
- Validate input sanitization

## CI/CD Integration

The tests are configured for CI environments:
- Retries on failure (2 retries in CI)
- Single worker in CI to avoid conflicts
- HTML and JSON reports generated
- Screenshots and videos on failure

## Troubleshooting

### Common Issues

1. **Authentication failures:**
   - Verify test credentials in `.env`
   - Check if test accounts exist in Cognito
   - Ensure accounts have proper roles

2. **Timeout errors:**
   - Increase timeout values for slow environments
   - Check if frontend/backend are running
   - Verify network connectivity

3. **Element not found:**
   - Add proper `data-testid` attributes to components
   - Use `waitForSelector` for dynamic content
   - Check if selectors match actual DOM

4. **CORS errors:**
   - Verify API CORS configuration
   - Check if API_BASE_URL is correct
   - Ensure proper headers in requests

### Debug Tips

1. **Use headed mode** to see what's happening:
   ```bash
   npm run test:headed
   ```

2. **Use debug mode** to step through tests:
   ```bash
   npm run test:debug
   ```

3. **Check screenshots** in `test-results/` folder after failures

4. **Use console logs** in test files for debugging:
   ```javascript
   console.log('Current URL:', page.url());
   ```

## Maintenance

- Update test data generators when schema changes
- Add new test cases for new features
- Review and update selectors when UI changes
- Keep environment variables up to date
- Regular cleanup of test accounts and data

## Security Considerations

- Test accounts should have minimal permissions
- Use separate test environment/database
- Regularly rotate test credentials
- Monitor test account usage
- Never use production data in tests
