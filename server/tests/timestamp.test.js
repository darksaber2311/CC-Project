import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';
import { queryOne, execute } from '../src/db.js';
import { parseUtcDate, formatDateTime, formatDate, formatTime } from '../src/utils/dateFormatter.js';
import { detectionEngine } from '../src/services/detectionEngine.js';
import { auditService } from '../src/services/auditService.js';

test('Comprehensive Timestamp and Timezone Consistency Audit', async (t) => {
  seedDatabase();

  await t.test('1. Database schema defaults produce valid ISO 8601 UTC strings with Z suffix', () => {
    // Insert a dummy log using DEFAULT timestamp
    execute(`
      INSERT INTO audit_logs (id, actor_id, actor_username, action, target_type, outcome, ip_address, user_agent)
      VALUES ('test-ts-default', 'user-0001', 'alice', 'TIMESTAMP_TEST', 'test', 'success', '127.0.0.1', 'NodeTest')
    `);

    const row = queryOne("SELECT timestamp FROM audit_logs WHERE id = 'test-ts-default'");
    assert.ok(row, 'Row should be found');
    assert.match(row.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'Default timestamp must be ISO 8601 with Z');

    // Clean up
    execute("DELETE FROM audit_logs WHERE id = 'test-ts-default'");
  });

  await t.test('2. Event creation generates ISO 8601 UTC string matching DB and API serialization', async () => {
    const beforeIso = new Date().toISOString();
    
    // Log an event through audit service
    const logId = auditService.logEvent({
      action: 'DOCUMENT_VIEW',
      actorId: 'user-0001',
      actorUsername: 'alice',
      targetType: 'document',
      targetId: 'doc-0001',
      outcome: 'success',
      ipAddress: '127.0.0.1',
      userAgent: 'NodeTest/1.0',
      details: { test: true }
    });

    const afterIso = new Date().toISOString();

    // Query raw DB row
    const dbRow = queryOne('SELECT timestamp FROM audit_logs WHERE id = ?', logId);
    assert.ok(dbRow, 'Audit log row must exist in SQLite');
    assert.ok(dbRow.timestamp.endsWith('Z'), 'Stored timestamp must end with Z');
    assert.ok(dbRow.timestamp >= beforeIso && dbRow.timestamp <= afterIso, 'Timestamp should be bounded by test execution time');

    // Query via API (login as admin first)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin@123456' });
    const adminCookie = loginRes.headers['set-cookie'][0];

    const apiRes = await request(app)
      .get(`/api/activity?action=DOCUMENT_VIEW&limit=5`)
      .set('Cookie', adminCookie);

    assert.equal(apiRes.status, 200);
    const returnedLog = apiRes.body.logs.find(l => l.id === logId);
    assert.ok(returnedLog, 'Created log must be returned by API');
    assert.equal(returnedLog.timestamp, dbRow.timestamp, 'API response must serialize exact raw ISO timestamp');
  });

  await t.test('3. Alerts preserve original detected_at on acknowledge and resolve', async () => {
    // Create an alert directly to test timestamp preservation
    const alertId = 'test-alert-ts-' + Date.now();
    const originalDetectedAt = '2026-10-28T09:00:00.000Z';

    const bobUser = queryOne("SELECT id FROM users WHERE username = 'bob'");
    const bobId = bobUser?.id || null;

    execute(`
      INSERT INTO security_alerts (id, rule_id, title, description, severity, risk_score, status, trigger_user_id, trigger_username, detected_at)
      VALUES (?, 'RULE_FAILED_LOGINS', 'Repeated Failed Logins', 'Multiple failed logins detected', 'high', 80, 'open', ?, 'bob', ?)
    `, alertId, bobId, originalDetectedAt);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin@123456' });
    const adminCookie = loginRes.headers['set-cookie'][0];

    // Acknowledge alert
    const ackRes = await request(app)
      .patch(`/api/alerts/${alertId}/acknowledge`)
      .set('Cookie', adminCookie);
    assert.equal(ackRes.status, 200);

    const alertAfterAck = queryOne('SELECT detected_at, acknowledged_at, status FROM security_alerts WHERE id = ?', alertId);
    assert.equal(alertAfterAck.status, 'acknowledged');
    assert.equal(alertAfterAck.detected_at, originalDetectedAt, 'detected_at must not be mutated on acknowledge');
    assert.ok(alertAfterAck.acknowledged_at, 'acknowledged_at must be populated');
    assert.ok(alertAfterAck.acknowledged_at.endsWith('Z'), 'acknowledged_at must be ISO UTC');

    // Resolve alert
    const resolveRes = await request(app)
      .patch(`/api/alerts/${alertId}/resolve`)
      .set('Cookie', adminCookie)
      .send({ resolutionNote: 'Verified legitimate login attempt' });
    assert.equal(resolveRes.status, 200);

    const alertAfterResolve = queryOne('SELECT detected_at, acknowledged_at, resolved_at, status FROM security_alerts WHERE id = ?', alertId);
    assert.equal(alertAfterResolve.status, 'resolved');
    assert.equal(alertAfterResolve.detected_at, originalDetectedAt, 'detected_at must not be mutated on resolve');
    assert.ok(alertAfterResolve.resolved_at, 'resolved_at must be populated');
    assert.ok(alertAfterResolve.resolved_at.endsWith('Z'), 'resolved_at must be ISO UTC');

    // Clean up
    execute("DELETE FROM security_alerts WHERE id = ?", alertId);
  });

  await t.test('4. DateFormatter converts UTC to IST accurately across midnight and day boundaries', () => {
    // Case A: UTC 18:30:00 is exactly 00:00:00 IST of the NEXT day (+5:30)
    const midnightUtc = '2026-10-28T18:30:00Z';
    const formattedMidnight = formatDateTime(midnightUtc);
    assert.ok(formattedMidnight.includes('29 Oct 2026'), `Should cross to next date (29 Oct 2026), got: ${formattedMidnight}`);
    assert.ok(formattedMidnight.includes('12:00:00 AM'), `Should be 12:00:00 AM, got: ${formattedMidnight}`);
    assert.ok(formattedMidnight.endsWith('IST'), `Should end with IST timezone marker, got: ${formattedMidnight}`);

    // Case B: UTC 23:45:00 is 05:15:00 AM IST of the NEXT day
    const lateUtc = '2026-10-28T23:45:00Z';
    const formattedLate = formatDateTime(lateUtc);
    assert.ok(formattedLate.includes('29 Oct 2026') && formattedLate.includes('5:15:00 AM'), `Got: ${formattedLate}`);

    // Case C: UTC 02:00:00 is 07:30:00 AM IST same day
    const morningUtc = '2026-10-28T02:00:00Z';
    const formattedMorning = formatDateTime(morningUtc);
    assert.ok(formattedMorning.includes('28 Oct 2026') && formattedMorning.includes('7:30:00 AM'), `Got: ${formattedMorning}`);

    // Case D: formatDate and formatTime utilities
    assert.equal(formatDate(midnightUtc), '29 Oct 2026');
    assert.equal(formatTime(midnightUtc), '12:00:00 AM IST');
  });

  await t.test('5. DateFormatter handles legacy space-separated SQLite UTC timestamps without 5.5 hour lag', () => {
    // Legacy SQLite output: "2026-10-28 08:30:00" (which is UTC)
    // In UTC+5:30 (IST), 08:30 UTC = 14:00 IST (2:00:00 PM)
    const legacySqliteUtc = '2026-10-28 08:30:00';
    const formatted = formatDateTime(legacySqliteUtc);
    assert.ok(formatted.includes('2:00:00 PM'), `Legacy string should convert 08:30 UTC to 2:00 PM IST, got: ${formatted}`);
    assert.ok(formatted.endsWith('IST'));
  });

  await t.test('6. No duplicate timezone strings (no "IST IST") or "Invalid Date"', () => {
    const formatted1 = formatDateTime('2026-10-28T14:30:00Z');
    assert.equal((formatted1.match(/IST/g) || []).length, 1, 'IST must appear exactly once');
    assert.ok(!formatted1.includes('Invalid Date'), 'Must not contain Invalid Date');

    // Invalid inputs return safe fallback
    assert.equal(formatDateTime(null), '—');
    assert.equal(formatDateTime(''), '—');
    assert.equal(formatDateTime('not-a-date'), '—');
    assert.equal(formatDate('not-a-date'), '—');
    assert.equal(formatTime('not-a-date'), '—');
  });

  await t.test('7. Detection engine sliding window respects ISO 8601 UTC chronological ordering', async () => {
    const testUser = 'user_ts_window_test_' + Date.now();

    // Insert 5 failed logins within the last 2 minutes
    let lastLogId = null;
    for (let i = 0; i < 5; i++) {
      lastLogId = `log-win-${i}-${Date.now()}`;
      execute(`
        INSERT INTO audit_logs (id, actor_id, actor_username, action, target_type, outcome, ip_address, user_agent, timestamp)
        VALUES (?, 'test-id', ?, 'LOGIN_FAILURE', 'session', 'failure', '192.168.1.100', 'TestAgent', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${i} minutes'))
      `, lastLogId, testUser);
    }

    const alert = detectionEngine.checkFailedLogins(testUser, lastLogId);

    assert.ok(alert, 'Alert should trigger for 5 failures in 5-minute window');
    assert.equal(alert.ruleId, 'RULE_FAILED_LOGINS', 'Rule ID should match');
    assert.ok(alert.detectedAt.endsWith('Z'), 'detectedAt should be ISO UTC with Z');

    // Clean up
    execute("DELETE FROM audit_logs WHERE actor_username = ?", testUser);
    execute("DELETE FROM security_alerts WHERE trigger_username = ?", testUser);
  });
});
