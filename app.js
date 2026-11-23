const path = require('path');
const express = require('express');
const { requireAuth } = require('./middleware/auth');
const { createRateLimiter } = require('./middleware/rateLimit');

function createApp(db, options = {}) {
  const app = express();
  const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, ...options.authLimit });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'",
    });
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/auth', require('./routes/auth')(db, authLimiter));
  app.use('/api/pantry', requireAuth(db), require('./routes/pantry')(db));
  app.use('/api', requireAuth(db), require('./routes/plan')(db));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(express.static(path.join(__dirname, 'public')));

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong on the server' });
  });
  return app;
}

module.exports = { createApp };
