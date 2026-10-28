// Simple in-memory sliding window rate limiter
const ipRequests = new Map();

export function loginRateLimiter({ windowMs = 60 * 1000, maxRequests = 20 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();
    
    let record = ipRequests.get(ip);
    if (!record) {
      record = [];
      ipRequests.set(ip, record);
    }

    // Filter requests outside window
    record = record.filter(timestamp => now - timestamp < windowMs);
    ipRequests.set(ip, record);

    if (record.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many login attempts from this network. Please wait a minute before retrying.'
      });
    }

    record.push(now);
    next();
  };
}
