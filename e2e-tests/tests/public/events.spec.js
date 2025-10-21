const { test, expect } = require('@playwright/test');
const { ApiHelper } = require('../utils/api');

test.describe('Public Events', () => {
  let apiHelper;

  test.beforeAll(async () => {
    apiHelper = new ApiHelper();
  });

  test('should display published events without authentication', async ({ page }) => {
    await page.goto('/');
    
    // Should see events without login
    await expect(page.locator('h1')).toContainText(['Events', 'Competitions', 'ScorinGames']);
    
    // Check if events are loaded
    await page.waitForSelector('[data-testid="event-card"], [data-testid="no-events"]', { timeout: 10000 });
  });

  test('should show event details for published events', async ({ page }) => {
    // First get published events from API
    const response = await apiHelper.getPublicEvents();
    expect(response.ok()).toBeTruthy();
    
    const events = await response.json();
    
    if (events.length > 0) {
      const firstEvent = events[0];
      
      await page.goto(`/events/${firstEvent.eventId}`);
      
      // Should show event details
      await expect(page.locator('h1')).toContainText(firstEvent.name);
      await expect(page.locator('[data-testid="event-description"]')).toBeVisible();
    }
  });

  test('should handle non-existent event gracefully', async ({ page }) => {
    await page.goto('/events/non-existent-event-id');
    
    // Should show error or redirect
    await expect(page.locator('body')).toContainText(['Not Found', 'Event not found', '404']);
  });

  test('API: should return published events only', async () => {
    const response = await apiHelper.getPublicEvents();
    expect(response.ok()).toBeTruthy();
    
    const events = await response.json();
    expect(Array.isArray(events)).toBeTruthy();
    
    // All events should be published
    events.forEach(event => {
      expect(event.published).toBe(true);
    });
  });
});
