import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';

test('Research Evaluation Module Tests', async (t) => {
  seedDatabase();

  async function loginAs(username, password) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    return res.headers['set-cookie']?.[0];
  }

  const adminCookie = await loginAs('admin', 'Admin@123456');
  const userCookie = await loginAs('alice', 'User@123456');

  await t.test('POST /api/evaluation/run - Admin can run ground-truth evaluation harness', async () => {
    const res = await request(app)
      .post('/api/evaluation/run')
      .set('Cookie', adminCookie);

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.totalScenarios, 'number');
    assert.ok(res.body.totalScenarios >= 8);
    assert.ok(res.body.securedocs);
    assert.ok(res.body.baseline);

    // Verify metrics exist and are numbers
    const metrics = res.body.securedocs.metrics;
    assert.equal(typeof metrics.precision, 'number');
    assert.equal(typeof metrics.recall, 'number');
    assert.equal(typeof metrics.f1, 'number');
    assert.equal(typeof metrics.fpr, 'number');
    assert.equal(typeof metrics.balancedAccuracy, 'number');
    assert.equal(metrics.balancedAccuracy, 1.0);

    const bMetrics = res.body.baseline.metrics;
    assert.equal(typeof bMetrics.balancedAccuracy, 'number');
    assert.equal(bMetrics.balancedAccuracy, 0.75);

    // Confirm latency was measured
    assert.equal(typeof res.body.meanDetectionLatencyMs, 'number');
    assert.ok(res.body.meanDetectionLatencyMs >= 0);

    // Confirm scenarios array has results
    assert.ok(Array.isArray(res.body.scenarios));
    assert.equal(res.body.scenarios.length, res.body.totalScenarios);
  });

  await t.test('POST /api/evaluation/run - Standard user is denied access (403)', async () => {
    const res = await request(app)
      .post('/api/evaluation/run')
      .set('Cookie', userCookie);

    assert.equal(res.status, 403);
  });
});
