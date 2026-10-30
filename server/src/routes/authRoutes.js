import { Router } from 'express';
import { authService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config.js';
import { execute, query, queryOne } from '../db.js';

export const authRouter = Router();

authRouter.post('/register', registerRateLimiter(), async (req, res, next) => {
  try {
    const { fullName, username, email, password, confirmPassword, department } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const user = await authService.register({
      fullName,
      username,
      email,
      password,
      confirmPassword,
      department,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please sign in with your credentials.',
      user
    });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

authRouter.post('/login', loginRateLimiter(), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const { sessionToken, user } = await authService.login({
      username,
      password,
      ipAddress,
      userAgent
    });

    res.cookie('securedocs_session', sessionToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      maxAge: config.sessionExpiryHours * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      user,
      token: sessionToken // Also return for tests/clients that use Bearer token
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

authRouter.post('/logout', (req, res, next) => {
  try {
    const sessionId = req.cookies?.securedocs_session || req.sessionId;
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    authService.logout(sessionId, req.user, ipAddress, userAgent);

    res.clearCookie('securedocs_session', { path: '/' });
    res.json({ success: true, message: 'Session terminated successfully' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.get('/profile', requireAuth, (req, res) => {
  const docStats = queryOne(`
    SELECT COUNT(*) as doc_count, COALESCE(SUM(file_size), 0) as total_storage
    FROM documents
    WHERE owner_id = ? AND is_deleted = 0
  `, req.user.id);

  const recentLogs = query(`
    SELECT action, timestamp, outcome, details_json
    FROM audit_logs
    WHERE actor_id = ?
    ORDER BY timestamp DESC
    LIMIT 5
  `, req.user.id);

  res.json({
    user: req.user,
    stats: {
      documentsOwned: docStats?.doc_count || 0,
      totalStorageBytes: docStats?.total_storage || 0
    },
    recentActivity: recentLogs.map(r => ({
      ...r,
      details: r.details_json ? JSON.parse(r.details_json) : {}
    }))
  });
});

authRouter.put('/profile', requireAuth, (req, res) => {
  const { fullName, department } = req.body;
  if (!fullName || typeof fullName !== 'string') {
    return res.status(400).json({ error: 'Full name is required' });
  }

  execute(`
    UPDATE users 
    SET full_name = ?, department = ?, updated_at = ?
    WHERE id = ?
  `, fullName.trim(), (department || '').trim(), new Date().toISOString(), req.user.id);

  const updatedUser = queryOne('SELECT id, username, email, role, full_name, department, is_active, created_at FROM users WHERE id = ?', req.user.id);

  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      fullName: updatedUser.full_name,
      department: updatedUser.department,
      isActive: Boolean(updatedUser.is_active),
      createdAt: updatedUser.created_at
    }
  });
});
