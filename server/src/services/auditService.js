import crypto from 'node:crypto';
import { execute, query, queryOne } from '../db.js';

export const auditService = {
  /**
   * Records a security-relevant event into the append-only audit_logs table.
   */
  logEvent({
    actorId = null,
    actorUsername = null,
    action,
    targetType = null,
    targetId = null,
    outcome,
    ipAddress = null,
    userAgent = null,
    details = {},
    correlationId = null,
    timestamp = null
  }) {
    const id = crypto.randomUUID();
    const eventTimestamp = timestamp || new Date().toISOString();
    const detailsJson = JSON.stringify(details || {});

    execute(`
      INSERT INTO audit_logs (
        id, timestamp, actor_id, actor_username, action, 
        target_type, target_id, outcome, ip_address, user_agent, 
        details_json, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, eventTimestamp, actorId, actorUsername, action, targetType, targetId, outcome, ipAddress, userAgent, detailsJson, correlationId);

    return id;
  },

  /**
   * Retrieves paginated audit logs with optional filters.
   */
  getLogs({ limit = 50, offset = 0, action = null, outcome = null, actorUsername = null, targetType = null }) {
    let sql = `
      SELECT id, timestamp, actor_id, actor_username, action, 
             target_type, target_id, outcome, ip_address, user_agent, details_json, correlation_id
      FROM audit_logs
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (outcome) {
      sql += ' AND outcome = ?';
      params.push(outcome);
    }
    if (actorUsername) {
      sql += ' AND actor_username LIKE ?';
      params.push(`%${actorUsername}%`);
    }
    if (targetType) {
      sql += ' AND target_type = ?';
      params.push(targetType);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = query(sql, ...params);
    return rows.map(r => ({
      ...r,
      details: r.details_json ? JSON.parse(r.details_json) : {}
    }));
  },

  /**
   * Total count of audit logs matching filters.
   */
  getLogCount({ action = null, outcome = null, actorUsername = null }) {
    let sql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (outcome) {
      sql += ' AND outcome = ?';
      params.push(outcome);
    }
    if (actorUsername) {
      sql += ' AND actor_username LIKE ?';
      params.push(`%${actorUsername}%`);
    }

    const row = queryOne(sql, ...params);
    return row ? row.total : 0;
  }
};
