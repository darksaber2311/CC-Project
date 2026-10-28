import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';

test('Authentication Module Tests', async (t) => {
  // Reset and seed database before running tests
  seedDatabase();

  await t.test('POST /api/auth/login - fails with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'WrongPassword!' });

    assert.equal(res.status, 401);
    assert.match(res.body.error, /invalid username or password/i);
  });

  let sessionCookie = '';

  await t.test('POST /api/auth/login - succeeds with correct credentials and returns session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'User@123456' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.username, 'alice');
    assert.equal(res.body.user.role, 'user');

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Set-Cookie header should be present');
    sessionCookie = cookies[0];
    assert.ok(sessionCookie.includes('securedocs_session='), 'Cookie should contain securedocs_session');
    assert.ok(sessionCookie.includes('HttpOnly'), 'Cookie should be HttpOnly');
  });

  await t.test('GET /api/auth/me - returns user data when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, 'alice');
  });

  await t.test('GET /api/auth/me - rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    assert.equal(res.status, 401);
    assert.match(res.body.error, /authentication required/i);
  });

  await t.test('POST /api/auth/logout - terminates session and clears cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify session is no longer valid
    const checkRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    assert.equal(checkRes.status, 401);
  });
});
