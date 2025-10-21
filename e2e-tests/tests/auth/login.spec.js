const { test, expect } = require('@playwright/test');
const { AuthHelper } = require('../utils/auth');

test.describe('Authentication', () => {
  let authHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should login as super admin', async ({ page }) => {
    test.skip(!process.env.TEST_SUPER_ADMIN_EMAIL, 'Super admin credentials not configured');
    
    await authHelper.loginAsSuperAdmin();
    
    // Should see admin interface
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('body')).toContainText(['Admin', 'Organizations', 'All Organizations']);
  });

  test('should login as organizer', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    await authHelper.loginAsOrganizer();
    
    // Should see organizer interface
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('body')).toContainText(['Competitions', 'Events']);
  });

  test('should login as athlete', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await authHelper.loginAsAthlete();
    
    // Should see athlete interface
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('body')).toContainText(['Profile', 'Events']);
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Wait for auth form
    await page.waitForSelector('[data-testid="sign-in-form"], input[type="email"]', { timeout: 10000 });
    
    // Try invalid login
    await page.fill('input[name="username"], input[type="email"]', 'invalid@example.com');
    await page.fill('input[name="password"], input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('body')).toContainText(['Invalid', 'Error', 'incorrect']);
  });

  test('should logout successfully', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Test credentials not configured');
    
    await authHelper.loginAsOrganizer();
    await authHelper.logout();
    
    // Should return to login page
    await expect(page.locator('[data-testid="sign-in-form"], input[type="email"]')).toBeVisible();
  });
});
