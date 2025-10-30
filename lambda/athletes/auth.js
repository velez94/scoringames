const axios = require('axios');

const AUTHORIZATION_SERVICE_URL = process.env.AUTHORIZATION_SERVICE_URL || 'https://h5c4i3jvn5.execute-api.us-east-2.amazonaws.com/dev';

// Cache for permissions (in-memory)
const permissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract user info from JWT token
 */
function verifyToken(event) {
  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims) {
      throw new Error('No authorization claims found');
    }
    
    return {
      userId: claims.sub,
      email: claims.email
    };
  } catch (error) {
    return null;
  }
}

/**
 * Check permission via Authorization Service
 */
async function checkPermission(userId, resource, action, contextId = 'global') {
  const cacheKey = `${userId}:${resource}:${action}:${contextId}`;
  
  // Check cache first
  const cached = permissionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.authorized;
  }

  try {
    const response = await axios.post(`${AUTHORIZATION_SERVICE_URL}/authorize`, {
      userId, resource, action, contextId
    });
    
    const authorized = response.data.authorized;
    
    // Cache result
    permissionsCache.set(cacheKey, { authorized, timestamp: Date.now() });
    return authorized;
  } catch (error) {
    console.error('Authorization service error:', error);
    return false;
  }
}

/**
 * Authorization middleware
 */
async function authorize(event, resource, action, contextId = 'global') {
  const user = verifyToken(event);
  if (!user) {
    return { authorized: false, error: 'Invalid token' };
  }

  // Super admin bypass (only for critical system operations)
  if (user.email === 'admin@athleon.fitness' && resource === 'system') {
    return { authorized: true, user, role: 'super_admin' };
  }

  const authorized = await checkPermission(user.userId, resource, action, contextId);
  return { authorized, user };
}

module.exports = {
  verifyToken,
  checkPermission,
  authorize
};
