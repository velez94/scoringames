const logger = require('./logger');

/**
 * Audit logger for RBAC decisions and security events
 */
class AuditLogger {
  
  /**
   * Log RBAC authorization decision
   */
  static logAuthorizationDecision(userId, userEmail, resource, action, decision, context = {}) {
    const auditEvent = {
      type: 'AUTHORIZATION_DECISION',
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      resource,
      action,
      decision: decision.authorized ? 'GRANTED' : 'DENIED',
      role: decision.role,
      context,
      severity: decision.authorized ? 'INFO' : 'WARN'
    };

    logger.info('RBAC Authorization Decision', auditEvent);
    
    // In production, this could also send to:
    // - CloudWatch Logs with specific log group
    // - AWS CloudTrail for compliance
    // - Security monitoring system
    // - DynamoDB audit table
  }

  /**
   * Log security event (failed auth, suspicious activity, etc.)
   */
  static logSecurityEvent(eventType, userId, userEmail, details = {}) {
    const auditEvent = {
      type: 'SECURITY_EVENT',
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      details,
      severity: 'ERROR'
    };

    logger.error('Security Event', auditEvent);
  }

  /**
   * Log data access event
   */
  static logDataAccess(userId, userEmail, resource, operation, recordCount = 1) {
    const auditEvent = {
      type: 'DATA_ACCESS',
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      resource,
      operation,
      recordCount,
      severity: 'INFO'
    };

    logger.info('Data Access', auditEvent);
  }

  /**
   * Log administrative action
   */
  static logAdminAction(userId, userEmail, action, target, details = {}) {
    const auditEvent = {
      type: 'ADMIN_ACTION',
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      action,
      target,
      details,
      severity: 'WARN'
    };

    logger.warn('Administrative Action', auditEvent);
  }
}

module.exports = { AuditLogger };
