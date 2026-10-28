import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { execute, query, queryOne } from '../db.js';
import { auditService } from '../services/auditService.js';

export const alertRouter = Router();

// All alert routes require Admin role
alertRouter.use(requireAuth);
alertRouter.use(requireRole('admin'));

// GET /api/alerts - List alerts with filters
alertRouter.get('/', (req, res, next) => {
  try {
    const { severity, status, ruleId, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT id, rule_id, title, description, severity, risk_score, 
             status, trigger_user_id, trigger_username, related_document_id,
             detected_at, acknowledged_at, resolved_at, resolution_note, is_synthetic
      FROM security_alerts
      WHERE 1=1
    `;
    const params = [];

    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (ruleId) {
      sql += ' AND rule_id = ?';
      params.push(ruleId);
    }

    sql += ' ORDER BY detected_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const alerts = query(sql, ...params);

    // Get count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM security_alerts WHERE 1=1';
    const countParams = [];
    if (severity) {
      countSql += ' AND severity = ?';
      countParams.push(severity);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (ruleId) {
      countSql += ' AND rule_id = ?';
      countParams.push(ruleId);
    }

    const totalRow = queryOne(countSql, ...countParams);
    const total = totalRow?.total || 0;

    res.json({
      alerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/:id - Detailed alert view with contributing audit events
alertRouter.get('/:id', (req, res, next) => {
  try {
    const alert = queryOne(`
      SELECT sa.*, 
             u_ack.username as acknowledged_by_username,
             u_res.username as resolved_by_username,
             d.original_filename as document_name,
             d.sensitivity_level as document_sensitivity
      FROM security_alerts sa
      LEFT JOIN users u_ack ON sa.acknowledged_by = u_ack.id
      LEFT JOIN users u_res ON sa.resolved_by = u_res.id
      LEFT JOIN documents d ON sa.related_document_id = d.id
      WHERE sa.id = ?
    `, req.params.id);

    if (!alert) {
      return res.status(404).json({ error: 'Security alert not found' });
    }

    // Retrieve contributing audit logs
    const contributingEvents = query(`
      SELECT al.id, al.timestamp, al.actor_id, al.actor_username, al.action, 
             al.outcome, al.ip_address, al.user_agent, al.details_json
      FROM audit_logs al
      JOIN alert_events ae ON al.id = ae.audit_log_id
      WHERE ae.alert_id = ?
      ORDER BY al.timestamp DESC
    `, req.params.id);

    res.json({
      alert: {
        ...alert,
        contributingEvents: contributingEvents.map(e => ({
          ...e,
          details: e.details_json ? JSON.parse(e.details_json) : {}
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/acknowledge
alertRouter.patch('/:id/acknowledge', (req, res, next) => {
  try {
    const alert = queryOne('SELECT id, status, title FROM security_alerts WHERE id = ?', req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.status !== 'open') {
      return res.status(400).json({ error: `Alert is already marked as ${alert.status}` });
    }

    execute(`
      UPDATE security_alerts 
      SET status = 'acknowledged', acknowledged_at = datetime('now', 'utc'), acknowledged_by = ?
      WHERE id = ?
    `, req.user.id, req.params.id);

    auditService.logEvent({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: 'ALERT_ACKNOWLEDGED',
      targetType: 'alert',
      targetId: req.params.id,
      outcome: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { title: alert.title }
    });

    res.json({ success: true, message: 'Alert successfully marked as acknowledged' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/resolve
alertRouter.patch('/:id/resolve', (req, res, next) => {
  try {
    const { resolutionNote } = req.body;
    if (!resolutionNote || typeof resolutionNote !== 'string' || resolutionNote.trim().length === 0) {
      return res.status(400).json({ error: 'A resolution note explaining the mitigation or outcome is required' });
    }

    const alert = queryOne('SELECT id, status, title FROM security_alerts WHERE id = ?', req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({ error: 'Alert is already resolved' });
    }

    execute(`
      UPDATE security_alerts 
      SET status = 'resolved', 
          resolved_at = datetime('now', 'utc'), 
          resolved_by = ?, 
          resolution_note = ?
      WHERE id = ?
    `, req.user.id, resolutionNote.trim(), req.params.id);

    auditService.logEvent({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: 'ALERT_RESOLVED',
      targetType: 'alert',
      targetId: req.params.id,
      outcome: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        title: alert.title,
        resolutionNote: resolutionNote.trim()
      }
    });

    res.json({ success: true, message: 'Alert marked as resolved' });
  } catch (err) {
    next(err);
  }
});
