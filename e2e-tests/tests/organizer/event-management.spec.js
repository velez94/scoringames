const { test, expect } = require('@playwright/test');
const { AuthHelper } = require('../utils/auth');
const { TestDataHelper } = require('../utils/testData');

test.describe('Organizer - Event Management', () => {
  let authHelper;
  let createdEventIds = [];

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.loginAsOrganizer();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup created events
    for (const eventId of createdEventIds) {
      try {
        await page.goto(`/backoffice/events/${eventId}`);
        await page.click('[data-testid="delete-event-button"]');
        await page.click('[data-testid="confirm-delete"]');
      } catch (error) {
        console.warn(`Failed to cleanup event ${eventId}:`, error.message);
      }
    }
    createdEventIds = [];
    
    await authHelper.logout();
  });

  test('should create new event', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    const testEvent = TestDataHelper.createTestEvent();
    
    // Navigate to create event
    await page.goto('/backoffice/events');
    await page.click('[data-testid="create-event-button"]');
    
    // Fill event form
    await page.fill('[data-testid="event-name"]', testEvent.name);
    await page.fill('[data-testid="event-description"]', testEvent.description);
    await page.fill('[data-testid="event-start-date"]', testEvent.startDate);
    await page.fill('[data-testid="event-end-date"]', testEvent.endDate);
    await page.fill('[data-testid="event-location"]', testEvent.location);
    
    // Submit form
    await page.click('[data-testid="save-event-button"]');
    
    // Should redirect to event details
    await expect(page.locator('h1')).toContainText(testEvent.name);
    
    // Extract event ID for cleanup
    const url = page.url();
    const eventId = url.split('/').pop();
    createdEventIds.push(eventId);
  });

  test('should edit existing event', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    // First create an event
    const testEvent = TestDataHelper.createTestEvent();
    
    await page.goto('/backoffice/events');
    await page.click('[data-testid="create-event-button"]');
    
    await page.fill('[data-testid="event-name"]', testEvent.name);
    await page.fill('[data-testid="event-description"]', testEvent.description);
    await page.fill('[data-testid="event-start-date"]', testEvent.startDate);
    await page.fill('[data-testid="event-end-date"]', testEvent.endDate);
    await page.fill('[data-testid="event-location"]', testEvent.location);
    
    await page.click('[data-testid="save-event-button"]');
    
    const url = page.url();
    const eventId = url.split('/').pop();
    createdEventIds.push(eventId);
    
    // Now edit the event
    await page.click('[data-testid="edit-event-button"]');
    
    const updatedName = `${testEvent.name} - Updated`;
    await page.fill('[data-testid="event-name"]', updatedName);
    await page.click('[data-testid="save-event-button"]');
    
    // Should show updated name
    await expect(page.locator('h1')).toContainText(updatedName);
  });

  test('should add categories to event', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    // Create event first
    const testEvent = TestDataHelper.createTestEvent();
    
    await page.goto('/backoffice/events');
    await page.click('[data-testid="create-event-button"]');
    
    await page.fill('[data-testid="event-name"]', testEvent.name);
    await page.fill('[data-testid="event-description"]', testEvent.description);
    await page.fill('[data-testid="event-start-date"]', testEvent.startDate);
    await page.fill('[data-testid="event-end-date"]', testEvent.endDate);
    await page.fill('[data-testid="event-location"]', testEvent.location);
    
    await page.click('[data-testid="save-event-button"]');
    
    const url = page.url();
    const eventId = url.split('/').pop();
    createdEventIds.push(eventId);
    
    // Add category
    await page.click('[data-testid="categories-tab"]');
    await page.click('[data-testid="add-category-button"]');
    
    const testCategory = TestDataHelper.createTestCategory();
    await page.fill('[data-testid="category-name"]', testCategory.name);
    await page.fill('[data-testid="category-description"]', testCategory.description);
    await page.fill('[data-testid="category-min-age"]', testCategory.minAge.toString());
    await page.fill('[data-testid="category-max-age"]', testCategory.maxAge.toString());
    await page.selectOption('[data-testid="category-gender"]', testCategory.gender);
    
    await page.click('[data-testid="save-category-button"]');
    
    // Should show category in list
    await expect(page.locator('[data-testid="categories-list"]')).toContainText(testCategory.name);
  });

  test('should publish event', async ({ page }) => {
    test.skip(!process.env.TEST_ORGANIZER_EMAIL, 'Organizer credentials not configured');
    
    // Create event first
    const testEvent = TestDataHelper.createTestEvent();
    
    await page.goto('/backoffice/events');
    await page.click('[data-testid="create-event-button"]');
    
    await page.fill('[data-testid="event-name"]', testEvent.name);
    await page.fill('[data-testid="event-description"]', testEvent.description);
    await page.fill('[data-testid="event-start-date"]', testEvent.startDate);
    await page.fill('[data-testid="event-end-date"]', testEvent.endDate);
    await page.fill('[data-testid="event-location"]', testEvent.location);
    
    await page.click('[data-testid="save-event-button"]');
    
    const url = page.url();
    const eventId = url.split('/').pop();
    createdEventIds.push(eventId);
    
    // Publish event
    await page.click('[data-testid="publish-event-button"]');
    await page.click('[data-testid="confirm-publish"]');
    
    // Should show published status
    await expect(page.locator('[data-testid="event-status"]')).toContainText('Published');
  });
});
