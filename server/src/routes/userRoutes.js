import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { execute, query, queryOne } from '../db.js';
import { auditService } from '../services/auditService.js';

export const userRouter = Router();

// GET /api/users/active - Accessible to any authenticated user to pick users for document sharing
userRouter.get('/active', requireAuth, (req, res) => {
  const users = query(`
    SELECT id, username, full_name, role, department
    FROM users
    WHERE is_active = 1
    ORDER BY full_name ASC
  `);
  res.json({ users });
});

// GET /api/users - List all users with pagination and stats (Admin only)
userRouter.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const users = query(`
    SELECT u.id, u.username, u.email, u.role, u.full_name, u.department, u.is_active, u.created_at,
           COUNT(DISTINCT d.id) as documents_count
    FROM users u
    LEFT JOIN documents d ON u.id = d.owner_id AND d.is_deleted = 0
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);
  res.json({ users });
});

// PATCH /api/users/:id/status - Toggle active/inactive status (Admin only)
userRouter.patch('/:id/status', requireAuth, requireRole('admin'), (req, res) => {
  const { isActive } = req.body;
  const targetId = req.params.id;

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Administrators cannot deactivate their own active account' });
  }

  const target = queryOne('SELECT id, username, is_active FROM users WHERE id = ?', targetId);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newStatus = isActive ? 1 : 0;
  execute("UPDATE users SET is_active = ?, updated_at = datetime('now', 'utc') WHERE id = ?", newStatus, targetId);

  // Terminate active sessions if suspended
  if (newStatus === 0) {
    execute('DELETE FROM sessions WHERE user_id = ?', targetId);
  }

  // Record audit log
  auditService.logEvent({
    actorId: req.user.id,
    actorUsername: req.user.username,
    action: 'USER_STATUS_CHANGE',
    targetType: 'user',
    targetId,
    outcome: 'success',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: {
      targetUsername: target.username,
      newStatus: newStatus === 1 ? 'active' : 'suspended'
    }
  });

  res.json({
    success: true,
    message: `User '${target.username}' is now ${newStatus === 1 ? 'active' : 'suspended'}`
  });
});
