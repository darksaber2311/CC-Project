import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '../db.js';
import { config } from '../config.js';
import { auditService } from './auditService.js';
import { detectionEngine } from './detectionEngine.js';

export const authService = {
  /**
   * Register a new standard user account.
   */
  async register({ fullName, username, email, password, confirmPassword, department = null, ipAddress, userAgent }) {
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      const err = new Error('Full name must be at least 2 characters long.');
      err.status = 400;
      throw err;
    }

    if (!username || typeof username !== 'string') {
      const err = new Error('Username is required.');
      err.status = 400;
      throw err;
    }

    const trimmedUsername = username.trim().toLowerCase();
    const usernameRegex = /^[a-z0-9_.-]{3,30}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      const err = new Error('Username must be 3-30 characters and contain only letters, numbers, hyphens, dots, or underscores.');
      err.status = 400;
      throw err;
    }

    if (!email || typeof email !== 'string') {
      const err = new Error('Email address is required.');
      err.status = 400;
      throw err;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      const err = new Error('Please provide a valid email address.');
      err.status = 400;
      throw err;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      const err = new Error('Password must be at least 8 characters long.');
      err.status = 400;
      throw err;
    }

    if (password !== confirmPassword) {
      const err = new Error('Passwords do not match.');
      err.status = 400;
      throw err;
    }

    // Check duplicate username
    const existingUser = queryOne('SELECT id FROM users WHERE username = ?', trimmedUsername);
    if (existingUser) {
      const err = new Error('Username is already taken. Please choose another.');
      err.status = 409;
      throw err;
    }

    // Check duplicate email
    const existingEmail = queryOne('SELECT id FROM users WHERE email = ?', trimmedEmail);
    if (existingEmail) {
      const err = new Error('Email address is already registered. Please sign in or use another email.');
      err.status = 409;
      throw err;
    }

    // Hash password with bcryptjs (10 rounds) - never store plaintext
    const passwordHash = bcrypt.hashSync(password, 10);

    // Enforce role 'user' strictly on server - cannot be overridden by request
    const userId = crypto.randomUUID();
    const trimmedFullName = fullName.trim();
    const trimmedDept = department && typeof department === 'string' && department.trim().length > 0 
      ? department.trim() 
      : 'General';

    const nowIso = new Date().toISOString();

    try {
      execute(`
        INSERT INTO users (id, username, email, password_hash, role, full_name, department, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', ?, ?, 1, ?, ?)
      `, userId, trimmedUsername, trimmedEmail, passwordHash, trimmedFullName, trimmedDept, nowIso, nowIso);
    } catch (dbErr) {
      if (dbErr.message && dbErr.message.includes('UNIQUE constraint failed')) {
        const err = new Error('Username or email is already registered.');
        err.status = 409;
        throw err;
      }
      throw dbErr;
    }

    // Record audit event
    auditService.logEvent({
      actorId: userId,
      actorUsername: trimmedUsername,
      action: 'USER_REGISTER',
      targetType: 'user',
      targetId: userId,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: { role: 'user', email: trimmedEmail, department: trimmedDept }
    });

    return {
      id: userId,
      username: trimmedUsername,
      email: trimmedEmail,
      role: 'user',
      fullName: trimmedFullName,
      department: trimmedDept,
      isActive: true
    };
  },

  /**
   * Authenticate user with credentials, generate server-side session.
   */
  async login({ username, password, ipAddress, userAgent }) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const trimmedUsername = username.trim().toLowerCase();
    const user = queryOne('SELECT * FROM users WHERE username = ?', trimmedUsername);

    if (!user) {
      // Record failed login audit log
      const logId = auditService.logEvent({
        actorId: null,
        actorUsername: trimmedUsername,
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        outcome: 'failure',
        ipAddress,
        userAgent,
        details: { reason: 'User not found' }
      });

      // Run threat detection for failed logins
      detectionEngine.checkFailedLogins(trimmedUsername, logId);

      throw new Error('Invalid username or password');
    }

    if (user.is_active === 0) {
      auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: user.id,
        outcome: 'denied',
        ipAddress,
        userAgent,
        details: { reason: 'Account suspended' }
      });

      throw new Error('Account is suspended. Please contact administrator.');
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      const logId = auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: user.id,
        outcome: 'failure',
        ipAddress,
        userAgent,
        details: { reason: 'Incorrect password' }
      });

      // Check failed login threshold
      detectionEngine.checkFailedLogins(trimmedUsername, logId);

      throw new Error('Invalid username or password');
    }

    // Success - create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiryHours = config.sessionExpiryHours;
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
    const sessionCreatedAt = new Date().toISOString();

    execute(`
      INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, sessionId, user.id, ipAddress, userAgent, expiresAt, sessionCreatedAt);

    auditService.logEvent({
      actorId: user.id,
      actorUsername: user.username,
      action: 'LOGIN_SUCCESS',
      targetType: 'session',
      targetId: sessionId,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: { role: user.role }
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      department: user.department,
      isActive: Boolean(user.is_active),
      createdAt: user.created_at
    };

    return { sessionToken: sessionId, user: safeUser };
  },

  /**
   * Validate session token from cookie/header.
   */
  validateSession(sessionId) {
    if (!sessionId) return null;

    const row = queryOne(`
      SELECT s.id as session_id, s.expires_at,
             u.id, u.username, u.email, u.role, u.full_name, u.department, u.is_active, u.created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `, sessionId);

    if (!row) return null;
    if (row.is_active === 0) return null;

    return {
      sessionId: row.session_id,
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        fullName: row.full_name,
        department: row.department,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at
      }
    };
  },

  /**
   * Terminate active session.
   */
  logout(sessionId, user, ipAddress, userAgent) {
    if (sessionId) {
      execute('DELETE FROM sessions WHERE id = ?', sessionId);
    }

    if (user) {
      auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'LOGOUT',
        targetType: 'session',
        targetId: sessionId,
        outcome: 'success',
        ipAddress,
        userAgent
      });
    }
  }
};
