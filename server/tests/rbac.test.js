import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';
import { query } from '../src/db.js';

test('Comprehensive RBAC & Authorization Boundary Verification', async (t) => {
  seedDatabase();

  async function loginAs(username, password) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    return res.headers['set-cookie']?.[0];
  }

  const adminCookie = await loginAs('admin', 'Admin@123456');
  const aliceCookie = await loginAs('alice', 'User@123456');
  const bobCookie = await loginAs('bob', 'User@123456');
  const charlieCookie = await loginAs('charlie', 'User@123456');

  // --- DOCUMENT CONTENT PRIVACY FOR ADMINISTRATOR ---
  await t.test('Admin Privacy Enforcement: Admin cannot download private document without explicit grant', async () => {
    // Admin attempts to download Alice's confidential document
    const res = await request(app)
      .get('/api/documents/doc-0001-alice-confidential/download')
      .set('Cookie', adminCookie);

    assert.equal(res.status, 403, 'Admin without grant must be denied document content download (Privacy-by-Design)');
    assert.match(res.body.error, /access denied/i);
  });

  // --- PUBLIC DOCUMENT ACCESS ---
  await t.test('Public Document Access: Any authenticated user can view and download public documents', async () => {
    // doc-0003-alice-public is public
    const viewRes = await request(app)
      .get('/api/documents/doc-0003-alice-public')
      .set('Cookie', bobCookie);
    assert.equal(viewRes.status, 200);

    const downloadRes = await request(app)
      .get('/api/documents/doc-0003-alice-public/download')
      .set('Cookie', bobCookie);
    assert.equal(downloadRes.status, 200);
  });

  // --- CROSS-USER UNAUTHORIZED PERMISSION DELEGATION ---
  await t.test('Permission Delegation Guard: Non-owner/non-admin cannot grant permissions on someone else document', async () => {
    // Charlie tries to grant Bob permission on Alice's document
    const res = await request(app)
      .post('/api/documents/doc-0001-alice-confidential/permissions')
      .set('Cookie', charlieCookie)
      .send({
        targetUserId: '33333333-3333-4333-8333-333333333333', // Bob
        permissionType: 'download'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /only the document owner/i);
  });

  // --- PERMISSION GRANT AND REVOKE LIFECYCLE ---
  await t.test('Permission Lifecycle: Owner grants access, grantee downloads, owner revokes, grantee blocked', async () => {
    const bobId = '33333333-3333-4333-8333-333333333333';
    const charlieDocId = 'doc-0005-charlie-internal';

    // 1. Bob cannot download Charlie's internal budget
    const beforeRes = await request(app)
      .get(`/api/documents/${charlieDocId}/download`)
      .set('Cookie', bobCookie);
    assert.equal(beforeRes.status, 403);

    // 2. Charlie grants Bob download permission
    const grantRes = await request(app)
      .post(`/api/documents/${charlieDocId}/permissions`)
      .set('Cookie', charlieCookie)
      .send({
        targetUserId: bobId,
        permissionType: 'download'
      });
    assert.equal(grantRes.status, 201);
    const permId = grantRes.body.permissionId;

    // 3. Bob can now download
    const duringRes = await request(app)
      .get(`/api/documents/${charlieDocId}/download`)
      .set('Cookie', bobCookie);
    assert.equal(duringRes.status, 200);

    // 4. Charlie revokes the permission
    const revokeRes = await request(app)
      .delete(`/api/documents/${charlieDocId}/permissions/${permId}`)
      .set('Cookie', charlieCookie);
    assert.equal(revokeRes.status, 200);

    // 5. Bob is blocked again
    const afterRes = await request(app)
      .get(`/api/documents/${charlieDocId}/download`)
      .set('Cookie', bobCookie);
    assert.equal(afterRes.status, 403);
  });

  // --- ADMINISTRATOR-ONLY ENDPOINT GUARDS ---
  await t.test('RBAC Endpoint Guard: Standard users are blocked from all administrative endpoints', async () => {
    // 1. Alerts list
    const alertsRes = await request(app)
      .get('/api/alerts')
      .set('Cookie', aliceCookie);
    assert.equal(alertsRes.status, 403);

    // 2. Audit logs explorer
    const activityRes = await request(app)
      .get('/api/activity')
      .set('Cookie', aliceCookie);
    assert.equal(activityRes.status, 403);

    // 3. User directory management
    const usersRes = await request(app)
      .get('/api/users')
      .set('Cookie', aliceCookie);
    assert.equal(usersRes.status, 403);

    // 4. User status modification
    const statusRes = await request(app)
      .patch('/api/users/33333333-3333-4333-8333-333333333333/status')
      .set('Cookie', aliceCookie)
      .send({ isActive: false });
    assert.equal(statusRes.status, 403);

    // 5. Research evaluation harness
    const evalRes = await request(app)
      .post('/api/evaluation/run')
      .set('Cookie', aliceCookie);
    assert.equal(evalRes.status, 403);
  });

  // --- UNEMPLOYED/SUSPENDED ACCOUNT ENFORCEMENT ---
  await t.test('Account Suspension Enforcement: Suspended user sessions are invalidated and blocked', async () => {
    const bobId = '33333333-3333-4333-8333-333333333333';

    // Admin suspends Bob
    const suspendRes = await request(app)
      .patch(`/api/users/${bobId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false });
    assert.equal(suspendRes.status, 200);

    // Bob's existing session cookie should now be rejected
    const testSessionRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', bobCookie);
    assert.equal(testSessionRes.status, 401);

    // Bob cannot log in while suspended
    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'User@123456' });
    assert.equal(loginAttempt.status, 401);
    assert.match(loginAttempt.body.error, /suspended/i);

    // Reactivate Bob for subsequent tests
    await request(app)
      .patch(`/api/users/${bobId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: true });
  });
});
