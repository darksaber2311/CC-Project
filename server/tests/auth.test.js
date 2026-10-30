import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';
import { queryOne } from '../src/db.js';

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

  // --- USER REGISTRATION TESTS ---

  await t.test('POST /api/auth/register - succeeds with valid input and assigns role user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Dana Scully',
        username: 'scully',
        email: 'scully@securedocs.local',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        department: 'Forensic Investigation'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.username, 'scully');
    assert.equal(res.body.user.email, 'scully@securedocs.local');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.department, 'Forensic Investigation');
    assert.equal(res.body.user.password_hash, undefined, 'password_hash must never be returned in API response');
  });

  await t.test('POST /api/auth/register - rejects mismatched passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Fox Mulder',
        username: 'mulder',
        email: 'mulder@securedocs.local',
        password: 'Password@123',
        confirmPassword: 'DifferentPassword@123'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /passwords do not match/i);
  });

  await t.test('POST /api/auth/register - rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Fox Mulder',
        username: 'mulder',
        email: 'mulder@securedocs.local',
        password: 'short',
        confirmPassword: 'short'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /at least 8 characters/i);
  });

  await t.test('POST /api/auth/register - rejects invalid email address', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Fox Mulder',
        username: 'mulder',
        email: 'not-an-email',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid email/i);
  });

  await t.test('POST /api/auth/register - rejects invalid username format (<3 chars or illegal chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Fox Mulder',
        username: 'x',
        email: 'mulder@securedocs.local',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /username/i);
  });

  await t.test('POST /api/auth/register - rejects duplicate username (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Dana Imposter',
        username: 'SCULLY',
        email: 'other_email@securedocs.local',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /already taken/i);
  });

  await t.test('POST /api/auth/register - rejects duplicate email address (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Another Agent',
        username: 'another_agent',
        email: 'SCULLY@securedocs.local',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /already registered/i);
  });

  await t.test('POST /api/auth/register - prevents role escalation (ignores role: admin)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Walter Skinner',
        username: 'skinner',
        email: 'skinner@securedocs.local',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'admin',
        isAdmin: true
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');

    // Confirm directly in database that role is strictly 'user'
    const dbUser = queryOne("SELECT role FROM users WHERE username = 'skinner'");
    assert.equal(dbUser.role, 'user', 'Database must have role strictly set to user');
  });

  await t.test('Database verification - passwords are hashed with bcrypt (never plaintext)', async () => {
    const dbUser = queryOne("SELECT password_hash FROM users WHERE username = 'scully'");
    assert.ok(dbUser, 'User must exist in database');
    assert.notEqual(dbUser.password_hash, 'Password@123', 'Password must not be stored in plaintext');
    assert.ok(
      dbUser.password_hash.startsWith('$2a$') || dbUser.password_hash.startsWith('$2b$'),
      'Password hash must be a valid bcrypt hash'
    );
    assert.ok(bcrypt.compareSync('Password@123', dbUser.password_hash), 'bcrypt must match the original password');
  });

  await t.test('POST /api/auth/login - newly registered user can sign in and access user directory', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'scully',
        password: 'Password@123'
      });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    assert.equal(loginRes.body.user.username, 'scully');
    assert.equal(loginRes.body.user.role, 'user');

    const scullyCookie = loginRes.headers['set-cookie'][0];
    assert.ok(scullyCookie);

    // Verify newly registered user can access protected endpoints like /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', scullyCookie);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.username, 'scully');

    // Verify newly registered user appears in active users directory
    const activeUsersRes = await request(app)
      .get('/api/users/active')
      .set('Cookie', scullyCookie);

    assert.equal(activeUsersRes.status, 200);
    const foundUser = activeUsersRes.body.users.find((u) => u.username === 'scully');
    assert.ok(foundUser, 'Scully must appear in active users list');
    assert.equal(foundUser.role, 'user');
  });
});
