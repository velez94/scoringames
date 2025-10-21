const { test, expect } = require('@playwright/test');
const { AuthHelper } = require('../utils/auth');

test.describe('Athlete - Event Registration', () => {
  let authHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.loginAsAthlete();
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should view published events', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await page.goto('/events');
    
    // Should see events list
    await page.waitForSelector('[data-testid="event-card"], [data-testid="no-events"]', { timeout: 10000 });
    
    // Check if events are displayed
    const eventCards = await page.locator('[data-testid="event-card"]').count();
    if (eventCards > 0) {
      await expect(page.locator('[data-testid="event-card"]').first()).toBeVisible();
    }
  });

  test('should register for event', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await page.goto('/events');
    
    // Wait for events to load
    await page.waitForSelector('[data-testid="event-card"], [data-testid="no-events"]', { timeout: 10000 });
    
    const eventCards = await page.locator('[data-testid="event-card"]').count();
    
    if (eventCards > 0) {
      // Click on first event
      await page.locator('[data-testid="event-card"]').first().click();
      
      // Should see event details
      await expect(page.locator('h1')).toBeVisible();
      
      // Try to register (if registration button exists)
      const registerButton = await page.locator('[data-testid="register-button"]').count();
      if (registerButton > 0) {
        await page.click('[data-testid="register-button"]');
        
        // Select category if available
        const categorySelect = await page.locator('[data-testid="category-select"]').count();
        if (categorySelect > 0) {
          await page.selectOption('[data-testid="category-select"]', { index: 0 });
        }
        
        await page.click('[data-testid="confirm-registration"]');
        
        // Should show success message
        await expect(page.locator('body')).toContainText(['Registered', 'Success', 'registered']);
      }
    }
  });

  test('should view athlete profile', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await page.goto('/profile');
    
    // Should see profile form
    await expect(page.locator('[data-testid="athlete-profile"]')).toBeVisible();
    await expect(page.locator('[data-testid="first-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="last-name"]')).toBeVisible();
  });

  test('should view registered competitions', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await page.goto('/profile');
    
    // Click on registered competitions tab
    await page.click('[data-testid="registered-competitions-tab"]');
    
    // Should see registered competitions or empty state
    await page.waitForSelector('[data-testid="registered-event"], [data-testid="no-registered-events"]', { timeout: 10000 });
  });

  test('should submit score for registered event', async ({ page }) => {
    test.skip(!process.env.TEST_ATHLETE_EMAIL, 'Athlete credentials not configured');
    
    await page.goto('/profile');
    await page.click('[data-testid="registered-competitions-tab"]');
    
    // Wait for registered events
    await page.waitForSelector('[data-testid="registered-event"], [data-testid="no-registered-events"]', { timeout: 10000 });
    
    const registeredEvents = await page.locator('[data-testid="registered-event"]').count();
    
    if (registeredEvents > 0) {
      // Click on first registered event
      await page.locator('[data-testid="registered-event"]').first().click();
      
      // Look for score submission form
      const scoreForm = await page.locator('[data-testid="score-form"]').count();
      if (scoreForm > 0) {
        await page.fill('[data-testid="score-input"]', '12:30');
        await page.click('[data-testid="submit-score-button"]');
        
        // Should show success message
        await expect(page.locator('body')).toContainText(['Score submitted', 'Success']);
      }
    }
  });
});
