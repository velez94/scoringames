const { verifyToken } = require('../utils/auth');

describe('Auth Utils', () => {
  describe('verifyToken', () => {
    it('should extract user ID from valid token', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'test@example.com' }
          }
        }
      };
      
      const result = verifyToken(event);
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should return fallback for missing token', () => {
      const event = { requestContext: {} };
      const result = verifyToken(event);
      expect(result.userId).toBe('temp-user');
      expect(result.email).toBe('temp@example.com');
    });
  });
});
