const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../db/connection');
const { createSchema } = require('../db/schema');
const auth = require('../services/authService');
const plan = require('../services/planService');
const { getPantry, getRecipes } = require('../db/queries');
const { validateCredentials, validatePantryItem } = require('../utils/validators');

function freshDb() {
  const db = openDatabase(':memory:');
  createSchema(db);
  return db;
}
const userIdOf = (db, name) => db.prepare('SELECT id FROM users WHERE username = ?').get(name).id;

test('register, login and session lookup', () => {
  const db = freshDb();
  const { token } = auth.register(db, { username: 'asha', password: 'secret1' });
  assert.equal(auth.findUserByToken(db, token).username, 'asha');
  assert.throws(() => auth.login(db, { username: 'asha', password: 'wrongpass' }), /Wrong username/);
  assert.throws(() => auth.register(db, { username: 'asha', password: 'secret1' }), /already taken/);
  auth.logout(db, token);
  assert.equal(auth.findUserByToken(db, token), null);
});

test('cooking a meal deducts stock and marks it done', () => {
  const db = freshDb();
  auth.register(db, { username: 'asha', password: 'secret1' });
  const userId = userIdOf(db, 'asha');
  const chapati = getRecipes(db).find((r) => r.name === 'Chapati');
  const mealId = plan.addMeal(db, userId, { day: 'Monday', session: 'Dinner' }, chapati.id);
  const flour = () => getPantry(db, userId).find((i) => i.name === 'Wheat flour').qty;
  assert.equal(flour(), 2000);
  plan.cookMeal(db, userId, mealId);
  assert.equal(flour(), 1800);
  assert.throws(() => plan.cookMeal(db, userId, mealId), /already cooked/);
});

test('users cannot touch each other\'s meals', () => {
  const db = freshDb();
  auth.register(db, { username: 'asha', password: 'secret1' });
  auth.register(db, { username: 'ravi', password: 'secret2' });
  const mealId = plan.addMeal(db, userIdOf(db, 'asha'), { day: 'Monday', session: 'Lunch' }, 1);
  assert.throws(() => plan.cookMeal(db, userIdOf(db, 'ravi'), mealId), /not found/);
});

test('shopping list covers the seeded Friday dinner shortfall', () => {
  const db = freshDb();
  auth.register(db, { username: 'asha', password: 'secret1' });
  const { items, total } = plan.getShoppingView(db, userIdOf(db, 'asha'));
  const paneer = items.find((i) => i.name === 'Paneer');
  assert.equal(paneer.quantity, 200);
  assert.ok(total > 0);
});

test('input validation rejects bad data', () => {
  assert.throws(() => validateCredentials({ username: 'a b', password: 'secret1' }), /letters, numbers/);
  assert.throws(() => validateCredentials({ username: 'asha', password: '123' }), /Password/);
  assert.throws(() => validatePantryItem({ name: 'Salt', quantity: -5, unit: 'g' }), /between/);
  assert.throws(() => validatePantryItem({ name: 'Salt', quantity: 'abc', unit: 'g' }), /number/);
  assert.throws(() => validatePantryItem({ name: 'Salt', quantity: 5, unit: 'lbs' }), /Unit/);
  assert.throws(() => validatePantryItem({ name: 'Salt', quantity: 5, unit: 'g', expiry: '31-12-2026' }), /date/);
  assert.equal(validatePantryItem({ name: ' Salt ', quantity: '5', unit: 'kg' }).quantity, 5);
});
