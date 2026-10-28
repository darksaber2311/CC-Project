import { auditService } from '../services/auditService.js';

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== role) {
      auditService.logEvent({
        actorId: req.user.id,
        actorUsername: req.user.username,
        action: 'ACCESS_DENIED',
        targetType: 'role_endpoint',
        targetId: req.originalUrl,
        outcome: 'denied',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { requiredRole: role, userRole: req.user.role }
      });

      return res.status(403).json({
        error: `Access denied. Requires '${role}' privilege level.`
      });
    }

    next();
  };
}
