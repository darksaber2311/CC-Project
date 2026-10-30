import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/server.js';
import { query } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

async function runE2EWorkflow() {
  seedDatabase();
  console.log('=== STARTING COMPLETE AUDIT DEMONSTRATION WORKFLOW ===');

  // Step 1: Login as Alice
  const aliceRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'User@123456' });
  assert.equal(aliceRes.status, 200);
  console.log('✓ 1. Alice authentication successful (session cookie received)');
  const aliceCookie = aliceRes.headers['set-cookie'][0];

  // Step 2: Upload new confidential document
  const uploadRes = await request(app)
    .post('/api/documents/upload')
    .set('Cookie', aliceCookie)
    .field('sensitivityLevel', 'confidential')
    .field('description', 'Quantum teleportation protocol specification')
    .attach('file', Buffer.from('%PDF-1.4\nConfidential Teleportation Spec\n%%EOF'), 'teleportation_spec.pdf');
  assert.equal(uploadRes.status, 201);
  const docId = uploadRes.body.document.id;
  console.log(`✓ 2. Alice uploaded confidential document: ${uploadRes.body.document.original_filename} (ID: ${docId})`);

  // Step 3: Login as Bob
  const bobRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'User@123456' });
  assert.equal(bobRes.status, 200);
  console.log('✓ 3. Bob authentication successful');
  const bobCookie = bobRes.headers['set-cookie'][0];

  // Step 4: Bob attempts to download Alice's confidential doc -> Expect HTTP 403 Forbidden
  const bobAttempt = await request(app)
    .get(`/api/documents/${docId}/download`)
    .set('Cookie', bobCookie);
  assert.equal(bobAttempt.status, 403);
  console.log('✓ 4. Bob unauthorized download blocked server-side with HTTP 403 Forbidden');

  // Step 5: Verify security alert generated on the backend
  const alertRow = query('SELECT * FROM security_alerts WHERE related_document_id = ? ORDER BY detected_at DESC LIMIT 1', docId)[0];
  assert.ok(alertRow);
  assert.equal(alertRow.rule_id, 'RULE_CONFIDENTIAL_VIOLATION');
  assert.equal(alertRow.trigger_username, 'bob');
  assert.equal(alertRow.risk_score, 40);
  assert.equal(alertRow.status, 'open');
  console.log(`✓ 5. Security alert generated: ${alertRow.rule_id} for user '${alertRow.trigger_username}', Risk Score: ${alertRow.risk_score}, Severity: ${alertRow.severity}`);

  // Step 6: Login as Admin
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'Admin@123456' });
  assert.equal(adminRes.status, 200);
  console.log('✓ 6. Administrator authenticated');
  const adminCookie = adminRes.headers['set-cookie'][0];

  // Step 7: Admin triage - acknowledge alert
  const ackRes = await request(app)
    .patch(`/api/alerts/${alertRow.id}/acknowledge`)
    .set('Cookie', adminCookie);
  assert.equal(ackRes.status, 200);
  console.log(`✓ 7. Administrator acknowledged alert #${alertRow.id.substring(0, 8)}`);

  // Step 8: Admin triage - resolve alert with note
  const resolveRes = await request(app)
    .patch(`/api/alerts/${alertRow.id}/resolve`)
    .set('Cookie', adminCookie)
    .send({ resolutionNote: 'Audited during viva verification. Accidental access attempt.' });
  assert.equal(resolveRes.status, 200);
  console.log('✓ 8. Administrator resolved alert with recorded mitigation note');

  // Step 9: Run research evaluation benchmark
  const evalRes = await request(app)
    .post('/api/evaluation/run')
    .set('Cookie', adminCookie);
  assert.equal(evalRes.status, 200);
  console.log(`✓ 9. Research benchmark executed: ${evalRes.body.totalScenarios} scenarios, F1=${evalRes.body.securedocs.metrics.f1}, BalancedAccuracy=${evalRes.body.securedocs.metrics.balancedAccuracy}, Latency=${evalRes.body.meanDetectionLatencyMs}ms`);

  console.log('=== ALL 9 DEMONSTRATION WORKFLOW STEPS VERIFIED END-TO-END ===');
  process.exit(0);
}

runE2EWorkflow().catch((err) => {
  console.error('E2E Workflow Error:', err);
  process.exit(1);
});
