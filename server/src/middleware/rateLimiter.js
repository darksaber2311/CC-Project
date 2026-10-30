// Simple in-memory sliding window rate limiter
const ipLoginRequests = new Map();
const ipRegisterRequests = new Map();

function createLimiter(map, windowMs, maxRequests, message) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();
    
    let record = map.get(ip);
    if (!record) {
      record = [];
      map.set(ip, record);
    }

    // Filter requests outside window
    record = record.filter(timestamp => now - timestamp < windowMs);
    map.set(ip, record);

    if (record.length >= maxRequests) {
      return res.status(429).json({
        error: message
      });
    }

    record.push(now);
    next();
  };
}

export function loginRateLimiter({ windowMs = 60 * 1000, maxRequests = 20 } = {}) {
  return createLimiter(
    ipLoginRequests,
    windowMs,
    maxRequests,
    'Too many login attempts from this network. Please wait a minute before retrying.'
  );
}

export function registerRateLimiter({ windowMs = 60 * 1000, maxRequests = 10 } = {}) {
  return createLimiter(
    ipRegisterRequests,
    windowMs,
    maxRequests,
    'Too many registration attempts from this network. Please wait a minute before retrying.'
  );
}
