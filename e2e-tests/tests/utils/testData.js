const crypto = require('crypto');

class TestDataHelper {
  static generateUniqueId() {
    return crypto.randomBytes(8).toString('hex');
  }

  static createTestEvent() {
    const id = this.generateUniqueId();
    return {
      name: `Test Event ${id}`,
      description: `Automated test event created at ${new Date().toISOString()}`,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 8 days from now
      location: `Test Location ${id}`
    };
  }

  static createTestOrganization() {
    const id = this.generateUniqueId();
    return {
      name: `Test Org ${id}`,
      description: `Automated test organization created at ${new Date().toISOString()}`
    };
  }

  static createTestAthlete() {
    const id = this.generateUniqueId();
    return {
      firstName: `TestAthlete${id}`,
      lastName: 'User',
      email: `test-athlete-${id}@example.com`,
      dateOfBirth: '1990-01-01',
      gender: 'male',
      country: 'US'
    };
  }

  static createTestCategory() {
    const id = this.generateUniqueId();
    return {
      name: `Test Category ${id}`,
      description: 'Automated test category',
      minAge: 18,
      maxAge: 35,
      gender: 'mixed'
    };
  }

  static createTestWod() {
    const id = this.generateUniqueId();
    return {
      name: `Test WOD ${id}`,
      description: '21-15-9 Thrusters and Pull-ups',
      type: 'for_time',
      timeCap: 15,
      scoringType: 'time'
    };
  }
}

module.exports = { TestDataHelper };
