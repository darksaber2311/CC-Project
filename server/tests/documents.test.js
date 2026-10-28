import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';
import { validateFilename } from '../src/utils/fileValidator.js';

test('Document Management & RBAC Tests', async (t) => {
  seedDatabase();

  // Helper to login and get cookie
  async function loginAs(username, password) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    return res.headers['set-cookie'][0];
  }

  const aliceCookie = await loginAs('alice', 'User@123456');
  const bobCookie = await loginAs('bob', 'User@123456');
  const adminCookie = await loginAs('admin', 'Admin@123456');

  await t.test('POST /api/documents/upload - uploads valid text file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Cookie', aliceCookie)
      .field('sensitivityLevel', 'internal')
      .field('description', 'Test upload file')
      .attach('file', Buffer.from('Valid text file content for SecureDocs test'), 'test_doc.txt');

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.document.original_filename, 'test_doc.txt');
    assert.equal(res.body.document.sensitivity_level, 'internal');
  });

  await t.test('POST /api/documents/upload - rejects disallowed file extension (.exe)', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Cookie', aliceCookie)
      .attach('file', Buffer.from('binary data'), 'malicious.exe');

    assert.equal(res.status, 400);
    assert.match(res.body.error, /not permitted/i);
  });

  await t.test('POST /api/documents/upload - rejects path traversal in filename', async () => {
    assert.throws(() => {
      validateFilename('../../etc/passwd.txt');
    }, /path traversal/i);
    assert.throws(() => {
      validateFilename('..\\..\\windows\\system32\\cmd.txt');
    }, /path traversal/i);
  });

  await t.test('GET /api/documents/:id - Alice can view her own confidential document', async () => {
    const res = await request(app)
      .get('/api/documents/doc-0001-alice-confidential')
      .set('Cookie', aliceCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.document.id, 'doc-0001-alice-confidential');
    assert.equal(res.body.permissions.isOwner, true);
  });

  await t.test('GET /api/documents/:id - Bob is DENIED access to Alice confidential document', async () => {
    const res = await request(app)
      .get('/api/documents/doc-0001-alice-confidential')
      .set('Cookie', bobCookie);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /access denied/i);
  });

  await t.test('GET /api/documents/:id/download - Bob is DENIED download of Alice confidential document', async () => {
    const res = await request(app)
      .get('/api/documents/doc-0001-alice-confidential/download')
      .set('Cookie', bobCookie);

    assert.equal(res.status, 403);
  });

  await t.test('POST /api/documents/:id/permissions - Alice grants Bob permission', async () => {
    // Get Bob's user ID
    const usersRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', bobCookie);
    const bobId = usersRes.body.user.id;

    const grantRes = await request(app)
      .post('/api/documents/doc-0001-alice-confidential/permissions')
      .set('Cookie', aliceCookie)
      .send({
        targetUserId: bobId,
        permissionType: 'download'
      });

    assert.equal(grantRes.status, 201);
    assert.equal(grantRes.body.success, true);

    // Now Bob downloads successfully!
    const downloadRes = await request(app)
      .get('/api/documents/doc-0001-alice-confidential/download')
      .set('Cookie', bobCookie);

    assert.equal(downloadRes.status, 200);
  });

  await t.test('DELETE /api/documents/:id - Bob cannot delete Alice document', async () => {
    const res = await request(app)
      .delete('/api/documents/doc-0001-alice-confidential')
      .set('Cookie', bobCookie);

    assert.equal(res.status, 403);
  });
});
