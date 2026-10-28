import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '../db.js';
import { config } from '../config.js';
import { auditService } from './auditService.js';
import { detectionEngine } from './detectionEngine.js';

export const authService = {
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

    execute(`
      INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, datetime('now', '+${expiryHours} hours', 'utc'))
    `, sessionId, user.id, ipAddress, userAgent);

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
      WHERE s.id = ? AND s.expires_at > datetime('now', 'utc')
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
