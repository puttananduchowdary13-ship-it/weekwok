const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../services/planner');

const recipes = new Map([
  [1, { id: 1, name: 'Dosa', ingredients: { 'Dosa batter': 300, 'Cooking oil': 15 } }],
  [2, { id: 2, name: 'Upma', ingredients: { Sooji: 150, 'Cooking oil': 15 } }],
]);
const pantry = p.indexPantry([
  { id: 1, name: 'Dosa batter', unit: 'g', qty: 400, low: 100, price: 80 },
  { id: 2, name: 'Cooking oil', unit: 'ml', qty: 20, low: 10, price: 140 },
  { id: 3, name: 'Sooji', unit: 'g', qty: 0, low: 100, price: 55 },
]);

test('unit conversion to base units', () => {
  assert.equal(p.toBaseQuantity(2, 'kg'), 2000);
  assert.equal(p.toBaseQuantity(1.5, 'L'), 1500);
  assert.equal(p.toBaseQuantity(3, 'pcs'), 3);
  assert.equal(p.baseUnitOf('kg'), 'g');
});

test('needs skip meals that are already cooked', () => {
  const meals = [{ id: 1, recipeId: 1, done: false }, { id: 2, recipeId: 1, done: true }];
  assert.deepEqual(p.calculateNeeds(meals, recipes), { 'Dosa batter': 300, 'Cooking oil': 15 });
});

test('deficit is max(0, needed - stock)', () => {
  const needs = { 'Dosa batter': 500, 'Cooking oil': 10, Sooji: 150, Mystery: 5 };
  assert.deepEqual(p.calculateDeficits(needs, pantry), { 'Dosa batter': 100, Sooji: 150, Mystery: 5 });
});

test('later meals are flagged short once stock runs out', () => {
  const meals = [
    { id: 1, day: 'Monday', session: 'Breakfast', recipeId: 1, done: false },
    { id: 2, day: 'Monday', session: 'Lunch', recipeId: 1, done: false },
  ];
  const [first, second] = p.annotateShortMeals(meals, recipes, pantry);
  assert.equal(first.short, false);
  assert.equal(second.short, true);
});

test('shopping list prices per kg, litre or piece', () => {
  const list = p.buildShoppingList({ Sooji: 500 }, pantry);
  assert.deepEqual(list, [{ name: 'Sooji', quantity: 500, unit: 'g', cost: 28 }]);
});

test('deducting ingredients never goes below zero', () => {
  const updates = p.deductIngredients(recipes.get(2), pantry);
  assert.deepEqual(updates.map((u) => [u.name, u.qty]), [['Sooji', 0], ['Cooking oil', 5]]);
});

test('expiry countdown and stock status', () => {
  const today = new Date('2026-11-19T10:00:00');
  assert.equal(p.daysUntil('2026-11-21', today), 2);
  assert.equal(p.daysUntil(null, today), null);
  assert.equal(p.stockStatus({ qty: 0, low: 5 }), 'out');
  assert.equal(p.stockStatus({ qty: 5, low: 5 }), 'low');
  assert.equal(p.stockStatus({ qty: 6, low: 5 }), 'ok');
});
