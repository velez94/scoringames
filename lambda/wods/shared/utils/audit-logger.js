const logger = require('./logger');

class AuditLogger {
  static logAuthorizationDecision(userId, userEmail, resource, action, decision, context = {}) {
    const auditEvent = {
      type: 'AUTHORIZATION_DECISION',
      userId,
      userEmail,
      resource,
      action,
      decision: decision.authorized ? 'GRANTED' : 'DENIED',
      role: decision.role,
      context
    };
    logger.info('RBAC Authorization Decision', auditEvent);
  }

  static logSecurityEvent(eventType, userId, userEmail, details = {}) {
    logger.error('Security Event', { eventType, userId, userEmail, details });
  }
}

module.exports = { AuditLogger };
