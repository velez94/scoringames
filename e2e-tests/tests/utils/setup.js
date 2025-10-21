const { test as base } = require('@playwright/test');
const { AuthHelper } = require('./auth');
const { ApiHelper } = require('./api');
const { TestDataHelper } = require('./testData');

// Extend base test with custom fixtures
const test = base.extend({
  authHelper: async ({ page }, use) => {
    const authHelper = new AuthHelper(page);
    await use(authHelper);
  },

  apiHelper: async ({}, use) => {
    const apiHelper = new ApiHelper();
    await use(apiHelper);
  },

  testData: async ({}, use) => {
    await use(TestDataHelper);
  },

  // Auto-cleanup fixture for test data
  cleanupIds: async ({}, use) => {
    const cleanupIds = {
      events: [],
      organizations: [],
      athletes: []
    };
    
    await use(cleanupIds);
    
    // Cleanup after test
    const apiHelper = new ApiHelper();
    
    // Note: In real implementation, you'd need authentication token
    // This is a placeholder for the cleanup logic
    for (const eventId of cleanupIds.events) {
      try {
        console.log(`Cleaning up event: ${eventId}`);
        // await apiHelper.cleanupTestData(token, 'event', eventId);
      } catch (error) {
        console.warn(`Failed to cleanup event ${eventId}:`, error.message);
      }
    }
  }
});

module.exports = { test };
