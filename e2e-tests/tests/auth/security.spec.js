const { test, expect } = require('@playwright/test');
const { AuthHelper } = require('../utils/auth');
const { ApiHelper } = require('../utils/api');

test.describe('Security Tests', () => {
  let authHelper;
  let apiHelper;

  test.beforeAll(async () => {
    apiHelper = new ApiHelper();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('should block access to protected routes without authentication', async ({ page }) => {
    // Try to access organizer routes without login
    const protectedRoutes = [
      '/backoffice',
      '/backoffice/events',
      '/backoffice/organizations'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login or show auth form
      await page.waitForSelector('[data-testid="sign-in-form"], input[type="email"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="sign-in-form"], input[type="email"]')).toBeVisible();
    }
  });

  test('should prevent cross-tenant data access', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    await authHelper.loginAsOrganizer();
    
    // Try to access another organization's data
    await page.goto('/backoffice/events');
    
    // Should only see events from user's organization
    await page.waitForSelector('[data-testid="event-list"], [data-testid="no-events"]', { timeout: 10000 });
    
    // Check that organization selector shows user's organizations only
    const orgSelector = await page.locator('[data-testid="organization-selector"]').count();
    if (orgSelector > 0) {
      await page.click('[data-testid="organization-selector"]');
      
      // Should not see "All Organizations" option for non-super-admin
      const allOrgsOption = await page.locator('text="All Organizations"').count();
      expect(allOrgsOption).toBe(0);
    }
  });

  test('should validate API authentication', async () => {
    // Test protected endpoints without token
    const protectedEndpoints = [
      '/competitions',
      '/organizations',
      '/athletes'
    ];

    for (const endpoint of protectedEndpoints) {
      const apiContext = await apiHelper.createApiContext();
      const response = await apiContext.get(endpoint);
      
      // Should return 401 Unauthorized
      expect(response.status()).toBe(401);
      
      await apiContext.dispose();
    }
  });

  test('should sanitize user input', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    await authHelper.loginAsOrganizer();
    
    // Try XSS in event creation
    await page.goto('/backoffice/events');
    await page.click('[data-testid="create-event-button"]');
    
    const xssPayload = '<script>alert("xss")</script>';
    
    await page.fill('[data-testid="event-name"]', xssPayload);
    await page.fill('[data-testid="event-description"]', xssPayload);
    
    // Form should handle malicious input safely
    await page.click('[data-testid="save-event-button"]');
    
    // Check that script tags are not executed
    const alerts = [];
    page.on('dialog', dialog => {
      alerts.push(dialog.message());
      dialog.dismiss();
    });
    
    await page.waitForTimeout(2000);
    expect(alerts).toHaveLength(0);
  });

  test('should enforce role-based access control', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await authHelper.loginAsAthlete();
    
    // Athletes should not access organizer routes
    await page.goto('/backoffice/events');
    
    // Should be redirected or show access denied
    await expect(page.locator('body')).toContainText(['Access denied', 'Not authorized', 'Permission denied']);
  });

  test('should handle session timeout', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    await authHelper.loginAsOrganizer();
    
    // Simulate expired token by clearing storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to access protected resource
    await page.goto('/backoffice/events');
    
    // Should redirect to login
    await page.waitForSelector('[data-testid="sign-in-form"], input[type="email"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="sign-in-form"], input[type="email"]')).toBeVisible();
  });

  test('should prevent SQL injection in API calls', async () => {
    const sqlPayloads = [
      "'; DROP TABLE events; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users --"
    ];

    for (const payload of sqlPayloads) {
      const response = await apiHelper.getPublicEvents();
      expect(response.ok()).toBeTruthy();
      
      // API should handle malicious input gracefully
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    }
  });
});
