import { authService } from '../services/authService.js';

export function authenticateSession(req, res, next) {
  // Check cookie or Authorization header
  let sessionId = req.cookies?.securedocs_session;
  
  if (!sessionId && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      sessionId = parts[1];
    }
  }

  if (sessionId) {
    const sessionData = authService.validateSession(sessionId);
    if (sessionData) {
      req.user = sessionData.user;
      req.sessionId = sessionData.sessionId;
    }
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in.'
    });
  }
  next();
}
