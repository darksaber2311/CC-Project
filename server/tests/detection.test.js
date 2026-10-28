import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'node:crypto';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';
import { query, execute } from '../src/db.js';
import { detectionEngine } from '../src/services/detectionEngine.js';

test('Threat Detection Rules & Alert Lifecycle Verification', async (t) => {
  seedDatabase();

  async function loginAs(username, password) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    return res.headers['set-cookie']?.[0];
  }

  const adminCookie = await loginAs('admin', 'Admin@123456');
  const bobCookie = await loginAs('bob', 'User@123456');
  const aliceCookie = await loginAs('alice', 'User@123456');

  // --- RULE A: REPEATED FAILED LOGINS ---
  await t.test('Rule A - Below Threshold: 4 failed logins does NOT trigger alert', async () => {
    const testUser = 'user_below_thresh_a';
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: testUser, password: 'WrongPassword!' });
    }

    const alerts = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_FAILED_LOGINS' AND trigger_username = ?", testUser);
    assert.equal(alerts.length, 0, 'No alert should be created for 4 failed logins (threshold is 5)');
  });

  await t.test('Rule A - Threshold Trigger: 5th failed login triggers RULE_FAILED_LOGINS alert', async () => {
    const testUser = 'user_below_thresh_a';
    // 5th attempt
    await request(app)
      .post('/api/auth/login')
      .send({ username: testUser, password: 'WrongPassword!' });

    const alerts = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_FAILED_LOGINS' AND trigger_username = ?", testUser);
    assert.equal(alerts.length, 1, 'Exactly 1 alert should be created for 5 failed logins');
    assert.equal(alerts[0].risk_score, 30);
    assert.equal(alerts[0].severity, 'medium');
    assert.equal(alerts[0].status, 'open');
  });

  await t.test('Rule A - Deduplication: 6th failed login appends to existing open alert without creating duplicate', async () => {
    const testUser = 'user_below_thresh_a';
    await request(app)
      .post('/api/auth/login')
      .send({ username: testUser, password: 'WrongPassword!' });

    const alerts = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_FAILED_LOGINS' AND trigger_username = ?", testUser);
    assert.equal(alerts.length, 1, 'Deduplication should keep count at 1 alert');
  });

  await t.test('Rule A - Outside Time Window: 5 failed logins older than 5 minutes do NOT trigger alert', async () => {
    const testUser = 'user_expired_a';
    // Insert 5 failed logins timestamped 10 minutes ago
    for (let i = 0; i < 5; i++) {
      execute(`
        INSERT INTO audit_logs (id, timestamp, actor_username, action, outcome)
        VALUES (?, datetime('now', '-10 minutes', 'utc'), ?, 'LOGIN_FAILURE', 'failure')
      `, crypto.randomUUID(), testUser);
    }

    const alert = detectionEngine.checkFailedLogins(testUser);
    assert.equal(alert, null, 'Events older than 5 minutes should not trigger an alert');

    const alertsInDb = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_FAILED_LOGINS' AND trigger_username = ?", testUser);
    assert.equal(alertsInDb.length, 0);
  });

  // --- RULE B: EXCESSIVE DOWNLOADS ---
  await t.test('Rule B - Below Threshold: 9 downloads does NOT trigger alert', async () => {
    const testUserId = '33333333-3333-4333-8333-333333333333'; // Bob
    // Clear any previous logs for Bob
    execute("DELETE FROM audit_logs WHERE actor_id = ? AND action = 'DOCUMENT_DOWNLOAD'", testUserId);

    for (let i = 0; i < 9; i++) {
      const logId = crypto.randomUUID();
      execute(`
        INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
        VALUES (?, datetime('now', 'utc'), ?, 'bob', 'DOCUMENT_DOWNLOAD', 'success')
      `, logId, testUserId);
    }

    const alert = detectionEngine.checkExcessiveDownloads(testUserId, 'bob');
    assert.equal(alert, null, '9 downloads should not trigger Rule B (threshold is 10)');
  });

  await t.test('Rule B - Threshold Trigger: 10th download triggers RULE_EXCESSIVE_DOWNLOADS alert', async () => {
    const testUserId = '33333333-3333-4333-8333-333333333333';
    const logId = crypto.randomUUID();
    execute(`
      INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
      VALUES (?, datetime('now', 'utc'), ?, 'bob', 'DOCUMENT_DOWNLOAD', 'success')
    `, logId, testUserId);

    const alert = detectionEngine.checkExcessiveDownloads(testUserId, 'bob');
    assert.ok(alert, '10th download must trigger an alert');
    assert.equal(alert.ruleId, 'RULE_EXCESSIVE_DOWNLOADS');
    assert.equal(alert.riskScore, 25);
    assert.equal(alert.severity, 'medium');
  });

  await t.test('Rule B - Deduplication: 11th download does not create duplicate alert', async () => {
    const testUserId = '33333333-3333-4333-8333-333333333333';
    const logId = crypto.randomUUID();
    execute(`
      INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
      VALUES (?, datetime('now', 'utc'), ?, 'bob', 'DOCUMENT_DOWNLOAD', 'success')
    `, logId, testUserId);

    const alert = detectionEngine.checkExcessiveDownloads(testUserId, 'bob');
    assert.equal(alert, null, 'Deduplication must prevent duplicate alert');

    const totalAlerts = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_EXCESSIVE_DOWNLOADS' AND trigger_user_id = ?", testUserId);
    assert.equal(totalAlerts.length, 1);
  });

  await t.test('Rule B - Outside Time Window: 10 downloads older than 5 minutes do NOT trigger alert', async () => {
    const testUserId = '44444444-4444-4444-8444-444444444444'; // Charlie
    for (let i = 0; i < 10; i++) {
      execute(`
        INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
        VALUES (?, datetime('now', '-10 minutes', 'utc'), ?, 'charlie', 'DOCUMENT_DOWNLOAD', 'success')
      `, crypto.randomUUID(), testUserId);
    }

    const alert = detectionEngine.checkExcessiveDownloads(testUserId, 'charlie');
    assert.equal(alert, null, 'Old downloads outside 5-min window must not trigger an alert');
  });

  // --- RULE C: REPEATED DENIED ACCESS ---
  await t.test('Rule C - Below Threshold: 2 access denials does NOT trigger alert', async () => {
    const testUserId = '44444444-4444-4444-8444-444444444444';
    execute("DELETE FROM audit_logs WHERE actor_id = ? AND outcome = 'denied'", testUserId);

    for (let i = 0; i < 2; i++) {
      execute(`
        INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
        VALUES (?, datetime('now', 'utc'), ?, 'charlie', 'ACCESS_DENIED', 'denied')
      `, crypto.randomUUID(), testUserId);
    }

    const alert = detectionEngine.checkDeniedAccess(testUserId, 'charlie', null, 'internal');
    assert.equal(alert, null, '2 denials should not trigger Rule C (threshold is 3)');
  });

  await t.test('Rule C - Threshold Trigger: 3rd access denial triggers RULE_REPEATED_DENIED_ACCESS alert', async () => {
    const testUserId = '44444444-4444-4444-8444-444444444444';
    execute(`
      INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
      VALUES (?, datetime('now', 'utc'), ?, 'charlie', 'ACCESS_DENIED', 'denied')
    `, crypto.randomUUID(), testUserId);

    const alert = detectionEngine.checkDeniedAccess(testUserId, 'charlie', null, 'internal');
    assert.ok(alert, '3rd denial must trigger Rule C alert');
    assert.equal(alert.ruleId, 'RULE_REPEATED_DENIED_ACCESS');
    assert.equal(alert.riskScore, 25);
    assert.equal(alert.severity, 'medium');
  });

  await t.test('Rule C - Deduplication: 4th access denial does not create duplicate alert', async () => {
    const testUserId = '44444444-4444-4444-8444-444444444444';
    execute(`
      INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
      VALUES (?, datetime('now', 'utc'), ?, 'charlie', 'ACCESS_DENIED', 'denied')
    `, crypto.randomUUID(), testUserId);

    const alert = detectionEngine.checkDeniedAccess(testUserId, 'charlie', null, 'internal');
    assert.equal(alert, null, '4th denial should be suppressed by deduplication');

    const totalAlerts = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_REPEATED_DENIED_ACCESS' AND trigger_user_id = ?", testUserId);
    assert.equal(totalAlerts.length, 1);
  });

  await t.test('Rule C - Outside Time Window: 3 access denials older than 5 minutes do NOT trigger alert', async () => {
    const testUser2 = '22222222-2222-4222-8222-222222222222';
    for (let i = 0; i < 3; i++) {
      execute(`
        INSERT INTO audit_logs (id, timestamp, actor_id, actor_username, action, outcome)
        VALUES (?, datetime('now', '-10 minutes', 'utc'), ?, 'alice', 'ACCESS_DENIED', 'denied')
      `, crypto.randomUUID(), testUser2);
    }

    const alert = detectionEngine.checkDeniedAccess(testUser2, 'alice', null, 'internal');
    assert.equal(alert, null, 'Expired access denials must not trigger an alert');
  });

  // --- RULE D: CONFIDENTIAL VIOLATION ---
  await t.test('Rule D - Unauthorized access to Confidential document triggers RULE_CONFIDENTIAL_VIOLATION immediately', async () => {
    // Bob attempts to download Alice's confidential document
    const res = await request(app)
      .get('/api/documents/doc-0001-alice-confidential/download')
      .set('Cookie', bobCookie);

    assert.equal(res.status, 403);

    const alerts = query("SELECT * FROM security_alerts WHERE rule_id = 'RULE_CONFIDENTIAL_VIOLATION' AND trigger_username = 'bob'");
    assert.ok(alerts.length >= 1);
    const alert = alerts[0];
    assert.equal(alert.risk_score, 40);
    assert.equal(alert.severity, 'medium');
  });

  await t.test('Rule D - Deduplication: Same audit log ID does not create a second alert', async () => {
    const alertsBefore = query("SELECT COUNT(*) as count FROM security_alerts WHERE rule_id = 'RULE_CONFIDENTIAL_VIOLATION'").count;
    
    // Find the latest log for bob confidential access
    const latestLog = query("SELECT id FROM audit_logs WHERE actor_username = 'bob' AND action = 'ACCESS_DENIED' ORDER BY timestamp DESC LIMIT 1")[0];
    
    const duplicateCheck = detectionEngine.checkConfidentialViolation('33333333-3333-4333-8333-333333333333', 'bob', 'doc-0001-alice-confidential', latestLog.id);
    assert.equal(duplicateCheck, null, 'Should return null for already alerted log ID');
  });

  // --- ALERT TRIAGE & MANAGEMENT ---
  await t.test('Admin alert triage: acknowledge and resolve with note', async () => {
    const openAlerts = query("SELECT id FROM security_alerts WHERE status = 'open' LIMIT 1");
    assert.ok(openAlerts.length > 0);
    const alertId = openAlerts[0].id;

    // Acknowledge
    const ackRes = await request(app)
      .patch(`/api/alerts/${alertId}/acknowledge`)
      .set('Cookie', adminCookie);
    assert.equal(ackRes.status, 200);

    // Resolve
    const resRes = await request(app)
      .patch(`/api/alerts/${alertId}/resolve`)
      .set('Cookie', adminCookie)
      .send({ resolutionNote: 'Audited and verified. Mitigated successfully.' });
    assert.equal(resRes.status, 200);

    const verified = query('SELECT status, resolution_note FROM security_alerts WHERE id = ?', alertId)[0];
    assert.equal(verified.status, 'resolved');
    assert.match(verified.resolution_note, /Mitigated/i);
  });
});
