const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../middleware/rateLimit');

const run = (limiter, ip) => {
  const headers = {};
  let error = null;
  limiter({ ip }, { set: (k, v) => { headers[k] = v; } }, (e) => { error = e || null; });
  return { error, headers };
};

test('allows requests up to the limit, then answers 429 with Retry-After', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
  assert.equal(run(limiter, '1.1.1.1').error, null);
  assert.equal(run(limiter, '1.1.1.1').error, null);
  const blocked = run(limiter, '1.1.1.1');
  assert.equal(blocked.error.status, 429);
  assert.ok(Number(blocked.headers['Retry-After']) > 0);
});

test('limits each client separately', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
  assert.equal(run(limiter, '1.1.1.1').error, null);
  assert.equal(run(limiter, '2.2.2.2').error, null);
  assert.equal(run(limiter, '1.1.1.1').error.status, 429);
});

test('the window resets after it expires', async () => {
  const limiter = createRateLimiter({ windowMs: 30, max: 1 });
  run(limiter, '3.3.3.3');
  assert.equal(run(limiter, '3.3.3.3').error.status, 429);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(run(limiter, '3.3.3.3').error, null);
});
