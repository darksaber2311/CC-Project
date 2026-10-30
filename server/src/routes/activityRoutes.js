import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { auditService } from '../services/auditService.js';
import { query, queryOne } from '../db.js';

export const activityRouter = Router();

// GET /api/activity/stats - Overview metrics for dashboard
activityRouter.get('/stats', requireAuth, (req, res, next) => {
  try {
    const isUserAdmin = req.user.role === 'admin';

    // Total documents count (active)
    let docStats;
    if (isUserAdmin) {
      docStats = queryOne('SELECT COUNT(*) as count FROM documents WHERE is_deleted = 0');
    } else {
      // User sees documents they own or have permission to
      docStats = queryOne(`
        SELECT COUNT(DISTINCT d.id) as count
        FROM documents d
        LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
        WHERE d.is_deleted = 0 AND (d.owner_id = ? OR d.sensitivity_level = 'public' OR dp.id IS NOT NULL)
      `, req.user.id, req.user.id);
    }

    // Active users
    const userStats = queryOne('SELECT COUNT(*) as count FROM users WHERE is_active = 1');

    // Open security alerts counts (Admin only or 0 for standard user)
    const alertStats = isUserAdmin ? query(`
      SELECT severity, COUNT(*) as count
      FROM security_alerts
      WHERE status = 'open'
      GROUP BY severity
    `) : [];

    const alertsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0
    };

    alertStats.forEach(row => {
      alertsBySeverity[row.severity] = row.count;
      alertsBySeverity.total += row.count;
    });

    // Recent 5 security events
    let recentEvents;
    if (isUserAdmin) {
      recentEvents = query(`
        SELECT id, timestamp, actor_username, action, target_type, outcome, details_json
        FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT 6
      `);
    } else {
      recentEvents = query(`
        SELECT id, timestamp, actor_username, action, target_type, outcome, details_json
        FROM audit_logs
        WHERE actor_id = ?
        ORDER BY timestamp DESC
        LIMIT 6
      `, req.user.id);
    }

    // Activity timeline over the past 7 days for Recharts
    const activityTimeline = query(`
      SELECT strftime('%Y-%m-%d', timestamp) as date,
             COUNT(*) as total_events,
             SUM(CASE WHEN outcome = 'failure' OR outcome = 'denied' THEN 1 ELSE 0 END) as security_flags
      FROM audit_logs
      WHERE timestamp >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')
      GROUP BY strftime('%Y-%m-%d', timestamp)
      ORDER BY date ASC
    `);

    // Recent 4 alerts (Admin only)
    const recentAlerts = isUserAdmin ? query(`
      SELECT id, rule_id, title, severity, risk_score, status, detected_at, trigger_username
      FROM security_alerts
      ORDER BY detected_at DESC
      LIMIT 4
    `) : [];

    res.json({
      metrics: {
        totalDocuments: docStats?.count || 0,
        activeUsers: userStats?.count || 0,
        openAlerts: alertsBySeverity
      },
      recentEvents: recentEvents.map(e => ({
        ...e,
        details: e.details_json ? JSON.parse(e.details_json) : {}
      })),
      activityTimeline,
      recentAlerts
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity - Paginated and filterable audit logs (Admin only)
activityRouter.get('/', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit || '25', 10)));
    const offset = (page - 1) * limit;

    const action = req.query.action || null;
    const outcome = req.query.outcome || null;
    const actorUsername = req.query.actor || null;
    const targetType = req.query.targetType || null;

    const logs = auditService.getLogs({ limit, offset, action, outcome, actorUsername, targetType });
    const total = auditService.getLogCount({ action, outcome, actorUsername });

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});
