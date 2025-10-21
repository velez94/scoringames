const { request } = require('@playwright/test');

class ApiHelper {
  constructor() {
    this.baseURL = process.env.API_BASE_URL;
  }

  async createApiContext() {
    return await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json'
      }
    });
  }

  async makeAuthenticatedRequest(method, endpoint, token, data = null) {
    const apiContext = await this.createApiContext();
    
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    if (data) {
      options.data = data;
    }

    const response = await apiContext[method.toLowerCase()](endpoint, options);
    await apiContext.dispose();
    
    return response;
  }

  async cleanupTestData(token, resourceType, resourceId) {
    try {
      const endpoints = {
        event: `/competitions/${resourceId}`,
        organization: `/organizations/${resourceId}`,
        athlete: `/athletes/${resourceId}`
      };

      const endpoint = endpoints[resourceType];
      if (endpoint) {
        await this.makeAuthenticatedRequest('DELETE', endpoint, token);
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${resourceType} ${resourceId}:`, error.message);
    }
  }

  async getPublicEvents() {
    const apiContext = await this.createApiContext();
    const response = await apiContext.get('/public/events');
    await apiContext.dispose();
    return response;
  }
}

module.exports = { ApiHelper };
