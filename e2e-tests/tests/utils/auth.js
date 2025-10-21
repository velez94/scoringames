const { expect } = require('@playwright/test');

class AuthHelper {
  constructor(page) {
    this.page = page;
  }

  async loginAs(email, password) {
    await this.page.goto('/');
    
    // Wait for Amplify auth to load
    await this.page.waitForSelector('[data-testid="sign-in-form"], [data-testid="user-menu"]', { timeout: 10000 });
    
    // Check if already logged in
    const userMenu = await this.page.locator('[data-testid="user-menu"]').count();
    if (userMenu > 0) {
      return;
    }

    // Fill login form
    await this.page.fill('input[name="username"], input[type="email"]', email);
    await this.page.fill('input[name="password"], input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    
    // Wait for successful login
    await this.page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });
  }

  async logout() {
    const userMenu = await this.page.locator('[data-testid="user-menu"]').count();
    if (userMenu > 0) {
      await this.page.click('[data-testid="user-menu"]');
      await this.page.click('[data-testid="logout-button"]');
      await this.page.waitForSelector('[data-testid="sign-in-form"]', { timeout: 10000 });
    }
  }

  async loginAsSuperAdmin() {
    await this.loginAs(
      process.env.TEST_SUPER_ADMIN_EMAIL,
      process.env.TEST_SUPER_ADMIN_PASSWORD
    );
  }

  async loginAsOrganizer() {
    await this.loginAs(
      process.env.TEST_ORGANIZER_EMAIL,
      process.env.TEST_ORGANIZER_PASSWORD
    );
  }

  async loginAsAthlete() {
    await this.loginAs(
      process.env.TEST_ATHLETE_EMAIL,
      process.env.TEST_ATHLETE_PASSWORD
    );
  }
}

module.exports = { AuthHelper };
