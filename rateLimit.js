const { HttpError } = require('../utils/httpError');

/**
 * Small in-memory rate limiter (no extra dependency).
 * Allows `max` requests per `windowMs` for each client IP, then answers 429.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, 'Too many attempts. Please try again later.'));
    }
    if (hits.size > 10000) {
      for (const [ip, e] of hits) if (e.resetAt <= now) hits.delete(ip);
    }
    next();
  };
}

module.exports = { createRateLimiter };
