const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../db/connection');
const { createSchema } = require('../db/schema');
const { createApp } = require('../app');

// Starts the real Express app on a random port with an in-memory database.
async function startServer(options = { authLimit: { max: 1000 } }) {
  const db = openDatabase(':memory:');
  createSchema(db);
  const server = createApp(db, options).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { body, token } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
  };
  const signUp = async (username = 'asha') => (await call('POST', '/api/auth/register', { body: { username, password: 'secret1' } })).data.token;
  return { base, call, signUp, close: () => server.close() };
}

test('API requires sign-in and sends security headers', async () => {
  const s = await startServer();
  const res = await s.call('GET', '/api/pantry');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
  s.close();
});

test('register, login, me and logout', async () => {
  const s = await startServer();
  const token = await s.signUp();
  assert.equal((await s.call('GET', '/api/auth/me', { token })).data.username, 'asha');
  const login = await s.call('POST', '/api/auth/login', { body: { username: 'asha', password: 'secret1' } });
  assert.equal(login.status, 200);
  const bad = await s.call('POST', '/api/auth/login', { body: { username: 'asha', password: 'wrongpass' } });
  assert.equal(bad.status, 401);
  assert.equal((await s.call('POST', '/api/auth/logout', { token })).status, 204);
  assert.equal((await s.call('GET', '/api/auth/me', { token })).status, 401);
  s.close();
});

test('login is rate limited after too many attempts', async () => {
  const s = await startServer({ authLimit: { max: 3 } });
  const attempt = () => s.call('POST', '/api/auth/login', { body: { username: 'nobody', password: 'wrongpass' } });
  for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
  const blocked = await attempt();
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
  s.close();
});

test('pantry: add, top up, adjust and delete', async () => {
  const s = await startServer();
  const token = await s.signUp();
  assert.equal((await s.call('POST', '/api/pantry', { token, body: { name: 'Salt', quantity: 2, unit: 'kg', lowLevel: 0.5, price: 20 } })).status, 201);
  const salt = () => s.call('GET', '/api/pantry', { token }).then((r) => r.data.find((i) => i.name === 'Salt'));
  assert.equal((await salt()).qty, 2000); // kg converted to grams
  await s.call('POST', '/api/pantry', { token, body: { name: 'salt', quantity: 500, unit: 'g' } });
  assert.equal((await salt()).qty, 2500);
  const id = (await salt()).id;
  await s.call('PATCH', `/api/pantry/${id}`, { token, body: { delta: -100000 } });
  assert.equal((await salt()).qty, 0); // never below zero
  assert.equal((await s.call('DELETE', `/api/pantry/${id}`, { token })).status, 204);
  assert.equal((await s.call('DELETE', `/api/pantry/${id}`, { token })).status, 404);
  s.close();
});

test('pantry rejects bad input and bad JSON', async () => {
  const s = await startServer();
  const token = await s.signUp();
  assert.equal((await s.call('POST', '/api/pantry', { token, body: { name: 'Salt', quantity: -1, unit: 'g' } })).status, 400);
  assert.equal((await s.call('POST', '/api/pantry', { token, body: { name: 'Salt', quantity: 1, unit: 'lbs' } })).status, 400);
  const broken = await fetch(`${s.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(broken.status, 400);
  s.close();
});

test('plan: add a meal, see the shortfall, cook it, remove it', async () => {
  const s = await startServer();
  const token = await s.signUp();
  const recipes = (await s.call('GET', '/api/recipes', { token })).data;
  const biryani = recipes.find((r) => r.name === 'Chicken Biryani');
  const add = await s.call('POST', '/api/plan', { token, body: { day: 'Wednesday', session: 'Dinner', recipeId: biryani.id } });
  assert.equal(add.status, 201);
  const shop = (await s.call('GET', '/api/shopping', { token })).data;
  assert.ok(shop.items.find((i) => i.name === 'Chicken' && i.quantity === 500));
  assert.equal((await s.call('POST', '/api/plan', { token, body: { day: 'Funday', session: 'Dinner', recipeId: biryani.id } })).status, 400);
  assert.equal((await s.call('DELETE', `/api/plan/${add.data.id}`, { token })).status, 204);
  assert.equal((await s.call('DELETE', '/api/plan', { token })).status, 204);
  s.close();
});

test('users cannot see or change each other\'s data', async () => {
  const s = await startServer();
  const asha = await s.signUp('asha');
  const ravi = await s.signUp('ravi');
  const recipes = (await s.call('GET', '/api/recipes', { token: asha })).data;
  const meal = await s.call('POST', '/api/plan', { token: asha, body: { day: 'Monday', session: 'Lunch', recipeId: recipes[0].id } });
  assert.equal((await s.call('POST', `/api/plan/${meal.data.id}/cook`, { token: ravi })).status, 404);
  assert.equal((await s.call('DELETE', `/api/plan/${meal.data.id}`, { token: ravi })).status, 404);
  s.close();
});

test('demo reset restores the Friday paneer shortfall', async () => {
  const s = await startServer();
  const token = await s.signUp();
  await s.call('DELETE', '/api/plan', { token });
  assert.equal((await s.call('GET', '/api/shopping', { token })).data.items.length, 0);
  await s.call('POST', '/api/demo/reset', { token });
  const paneer = (await s.call('GET', '/api/shopping', { token })).data.items.find((i) => i.name === 'Paneer');
  assert.equal(paneer.quantity, 200);
  s.close();
});
