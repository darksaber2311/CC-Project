import crypto from 'node:crypto';
import { db, execute, query, queryOne, transaction } from '../db.js';
import { config } from '../config.js';
import { riskScoring } from './riskScoring.js';
import { auditService } from './auditService.js';

export const detectionEngine = {
  /**
   * Rule A: Repeated Failed Logins
   * Checks if >= 5 failed logins occurred for the same username within 5 minutes.
   */
  checkFailedLogins(username, triggeringLogId = null) {
    if (!username) return null;
    const rule = config.detection.failedLogins;

    // Find failed login logs within window
    const logs = query(`
      SELECT id, timestamp, actor_username, ip_address 
      FROM audit_logs
      WHERE action = 'LOGIN_FAILURE'
        AND actor_username = ?
        AND timestamp >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${rule.windowMinutes} minutes')
      ORDER BY timestamp DESC
    `, username);

    if (logs.length < rule.threshold) {
      return null;
    }

    // Deduplication: check if these logs are already associated with an alert for this rule
    const logIds = logs.map(l => l.id);
    const placeholders = logIds.map(() => '?').join(',');
    const alreadyAlerted = query(`
      SELECT DISTINCT audit_log_id 
      FROM alert_events ae
      JOIN security_alerts sa ON ae.alert_id = sa.id
      WHERE sa.rule_id = ? AND ae.audit_log_id IN (${placeholders})
    `, rule.ruleId, ...logIds);

    const alertedSet = new Set(alreadyAlerted.map(r => r.audit_log_id));
    const unalertedLogIds = logIds.filter(id => !alertedSet.has(id));

    // If an active alert already exists in the window, attach new events without creating duplicate alert
    const existingAlert = queryOne(`
      SELECT id FROM security_alerts 
      WHERE rule_id = ? AND trigger_username = ? AND status IN ('open', 'acknowledged')
        AND detected_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${rule.windowMinutes} minutes')
      ORDER BY detected_at DESC
    `, rule.ruleId, username);

    if (existingAlert) {
      for (const logId of unalertedLogIds) {
        execute('INSERT OR IGNORE INTO alert_events (alert_id, audit_log_id) VALUES (?, ?)', existingAlert.id, logId);
      }
      return null;
    }

    if (unalertedLogIds.length < rule.threshold) {
      return null;
    }

    const { riskScore, severity } = riskScoring.calculateScore([rule.ruleId]);
    const title = rule.title;
    const description = `Observed ${logs.length} failed login attempts for account '${username}' within a ${rule.windowMinutes}-minute window.`;

    return this.createAlert({
      ruleId: rule.ruleId,
      title,
      description,
      severity,
      riskScore,
      triggerUsername: username,
      triggerUserId: null,
      relatedDocumentId: null,
      triggeringLogIds: logIds
    });
  },

  /**
   * Rule B: Excessive Downloads
   * Checks if >= 10 document downloads occurred by the same user within 5 minutes.
   */
  checkExcessiveDownloads(userId, username, documentId = null, triggeringLogId = null) {
    if (!userId) return null;
    const rule = config.detection.excessiveDownloads;

    const logs = query(`
      SELECT id, timestamp, actor_id, target_id
      FROM audit_logs
      WHERE action = 'DOCUMENT_DOWNLOAD'
        AND outcome = 'success'
        AND actor_id = ?
        AND timestamp >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${rule.windowMinutes} minutes')
      ORDER BY timestamp DESC
    `, userId);

    if (logs.length < rule.threshold) {
      return null;
    }

    const logIds = logs.map(l => l.id);
    const placeholders = logIds.map(() => '?').join(',');
    const alreadyAlerted = query(`
      SELECT DISTINCT audit_log_id 
      FROM alert_events ae
      JOIN security_alerts sa ON ae.alert_id = sa.id
      WHERE sa.rule_id = ? AND ae.audit_log_id IN (${placeholders})
    `, rule.ruleId, ...logIds);

    const alertedSet = new Set(alreadyAlerted.map(r => r.audit_log_id));
    const unalertedLogIds = logIds.filter(id => !alertedSet.has(id));

    const existingAlert = queryOne(`
      SELECT id FROM security_alerts 
      WHERE rule_id = ? AND trigger_user_id = ? AND status IN ('open', 'acknowledged')
        AND detected_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${rule.windowMinutes} minutes')
      ORDER BY detected_at DESC
    `, rule.ruleId, userId);

    if (existingAlert) {
      for (const logId of unalertedLogIds) {
        execute('INSERT OR IGNORE INTO alert_events (alert_id, audit_log_id) VALUES (?, ?)', existingAlert.id, logId);
      }
      return null;
    }

    if (unalertedLogIds.length < rule.threshold) {
      return null;
    }

    const { riskScore, severity } = riskScoring.calculateScore([rule.ruleId]);
    const title = rule.title;
    const description = `User '${username}' performed ${logs.length} document downloads within ${rule.windowMinutes} minutes, exceeding velocity threshold.`;

    return this.createAlert({
      ruleId: rule.ruleId,
      title,
      description,
      severity,
      riskScore,
      triggerUsername: username,
      triggerUserId: userId,
      relatedDocumentId: documentId,
      triggeringLogIds: logIds
    });
  },

  /**
   * Rule C: Repeated Denied Access
   * Checks if >= 3 access denied events occurred for the same user within 5 minutes.
   */
  checkDeniedAccess(userId, username, documentId = null, sensitivity = 'internal', triggeringLogId = null) {
    if (!userId) return null;
    const rule = config.detection.repeatedDeniedAccess;

    const logs = query(`
      SELECT id, timestamp, actor_id, target_id
      FROM audit_logs
      WHERE outcome = 'denied'
        AND actor_id = ?
        AND timestamp >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${rule.windowMinutes} minutes')
      ORDER BY timestamp DESC
    `, userId);

    if (logs.length < rule.threshold) {
      return null;
    }

    const logIds = logs.map(l => l.id);
    const placeholders = logIds.map(() => '?').join(',');
    const alreadyAlerted = query(`
      SELECT DISTINCT audit_log_id 
      FROM alert_events ae
      JOIN security_alerts sa ON ae.alert_id = sa.id
      WHERE sa.rule_id = ? AND ae.audit_log_id IN (${placeholders})
    `, rule.ruleId, ...logIds);

    const alertedSet = new Set(alreadyAlerted.map(r => r.audit_log_id));
    const unalertedLogIds = logIds.filter(id => !alertedSet.has(id));

    const existingAlert = queryOne(`
      SELECT id FROM security_alerts 
      WHERE rule_id = ? AND trigger_user_id = ? AND status IN ('open', 'acknowledged')
        AND detected_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${rule.windowMinutes} minutes')
      ORDER BY detected_at DESC
    `, rule.ruleId, userId);

    if (existingAlert) {
      for (const logId of unalertedLogIds) {
        execute('INSERT OR IGNORE INTO alert_events (alert_id, audit_log_id) VALUES (?, ?)', existingAlert.id, logId);
      }
      return null;
    }

    if (unalertedLogIds.length < rule.threshold) {
      return null;
    }

    const rulesToScore = [rule.ruleId];
    if (sensitivity === 'confidential') {
      rulesToScore.push(config.detection.confidentialViolation.ruleId);
    }

    const { riskScore, severity } = riskScoring.calculateScore(rulesToScore, { sensitivityLevel: sensitivity });
    const title = rule.title;
    const description = `User '${username}' encountered ${logs.length} access denials within ${rule.windowMinutes} minutes.`;

    return this.createAlert({
      ruleId: rule.ruleId,
      title,
      description,
      severity,
      riskScore,
      triggerUsername: username,
      triggerUserId: userId,
      relatedDocumentId: documentId,
      triggeringLogIds: logIds
    });
  },

  /**
   * Rule D: Sensitive Document Access Violation
   * Immediately flags unauthorized attempt to access a Confidential document.
   */
  checkConfidentialViolation(userId, username, documentId, triggeringLogId) {
    const rule = config.detection.confidentialViolation;

    // Check if triggering log already alerted
    if (triggeringLogId) {
      const exists = queryOne('SELECT 1 FROM alert_events WHERE audit_log_id = ?', triggeringLogId);
      if (exists) return null;
    }

    const { riskScore, severity } = riskScoring.calculateScore([rule.ruleId], { sensitivityLevel: 'confidential' });
    const title = rule.title;
    const description = `Unauthorized user '${username}' attempted access to Confidential document '${documentId}'.`;

    return this.createAlert({
      ruleId: rule.ruleId,
      title,
      description,
      severity,
      riskScore,
      triggerUsername: username,
      triggerUserId: userId,
      relatedDocumentId: documentId,
      triggeringLogIds: triggeringLogId ? [triggeringLogId] : []
    });
  },

  /**
   * Creates an alert record and binds triggering audit logs inside a single transaction.
   */
  createAlert({
    ruleId,
    title,
    description,
    severity,
    riskScore,
    triggerUsername = null,
    triggerUserId = null,
    relatedDocumentId = null,
    triggeringLogIds = [],
    isSynthetic = 0
  }) {
    return transaction(() => {
      const alertId = crypto.randomUUID();
      const detectedAt = new Date().toISOString();

      execute(`
        INSERT INTO security_alerts (
          id, rule_id, title, description, severity, risk_score, 
          status, trigger_user_id, trigger_username, related_document_id, 
          detected_at, is_synthetic
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
      `, alertId, ruleId, title, description, severity, riskScore, triggerUserId, triggerUsername, relatedDocumentId, detectedAt, isSynthetic);

      for (const logId of triggeringLogIds) {
        execute(`
          INSERT OR IGNORE INTO alert_events (alert_id, audit_log_id)
          VALUES (?, ?)
        `, alertId, logId);
      }

      // Log alert creation with exact UTC timestamp
      auditService.logEvent({
        actorId: null,
        actorUsername: 'SYSTEM',
        action: 'ALERT_CREATED',
        targetType: 'alert',
        targetId: alertId,
        outcome: 'success',
        timestamp: detectedAt,
        details: { ruleId, severity, riskScore, title }
      });

      return {
        id: alertId,
        ruleId,
        title,
        description,
        severity,
        riskScore,
        status: 'open',
        triggerUsername,
        triggerUserId,
        relatedDocumentId,
        detectedAt,
        isSynthetic
      };
    });
  }
};
