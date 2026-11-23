/**
 * Pure planning logic: no database or HTTP in here, so it is easy to unit test.
 * Quantities are always held in base units (g, ml, pcs).
 */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SESSIONS = ['Breakfast', '11 AM snack', 'Lunch', '4 PM snack', 'Dinner'];
const UNITS = ['g', 'kg', 'ml', 'L', 'pcs'];

const BASE_UNIT = { g: 'g', kg: 'g', ml: 'ml', L: 'ml', pcs: 'pcs' };
const UNIT_FACTOR = { g: 1, kg: 1000, ml: 1, L: 1000, pcs: 1 };

const toBaseQuantity = (quantity, unit) => quantity * (UNIT_FACTOR[unit] ?? 1);
const baseUnitOf = (unit) => BASE_UNIT[unit] ?? unit;

const indexPantry = (items) => new Map(items.map((item) => [item.name.toLowerCase(), item]));
const stockOf = (pantryByName, ingredient) => pantryByName.get(ingredient.toLowerCase())?.qty ?? 0;

/** Meals in the order they will be cooked: by day, then session, then insertion order. */
function sortMeals(meals) {
  return [...meals].sort(
    (a, b) =>
      DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
      SESSIONS.indexOf(a.session) - SESSIONS.indexOf(b.session) ||
      a.id - b.id
  );
}

/** Total ingredients required by every meal that has not been cooked yet. */
function calculateNeeds(meals, recipesById) {
  const needs = {};
  for (const meal of meals) {
    if (meal.done) continue;
    for (const [ingredient, amount] of Object.entries(recipesById.get(meal.recipeId).ingredients)) {
      needs[ingredient] = (needs[ingredient] || 0) + amount;
    }
  }
  return needs;
}

/** deficit = max(0, needed - in pantry) */
function calculateDeficits(needs, pantryByName) {
  const deficits = {};
  for (const [ingredient, needed] of Object.entries(needs)) {
    const missing = Math.max(0, needed - stockOf(pantryByName, ingredient));
    if (missing > 0) deficits[ingredient] = missing;
  }
  return deficits;
}

/** Flags meals that cannot be cooked given everything planned before them. */
function annotateShortMeals(meals, recipesById, pantryByName) {
  const running = {};
  return sortMeals(meals).map((meal) => {
    if (meal.done) return { ...meal, short: false };
    let short = false;
    for (const [ingredient, amount] of Object.entries(recipesById.get(meal.recipeId).ingredients)) {
      running[ingredient] = (running[ingredient] || 0) + amount;
      if (running[ingredient] > stockOf(pantryByName, ingredient)) short = true;
    }
    return { ...meal, short };
  });
}

function buildShoppingList(deficits, pantryByName) {
  return Object.entries(deficits).map(([name, quantity]) => {
    const item = pantryByName.get(name.toLowerCase());
    const unit = item?.unit ?? 'g';
    const price = item?.price ?? 0;
    const cost = unit === 'pcs' ? quantity * price : (quantity / 1000) * price;
    return { name, quantity, unit, cost: Math.round(cost) };
  });
}

function canCook(recipe, pantryByName) {
  return Object.entries(recipe.ingredients).every(([name, amount]) => stockOf(pantryByName, name) >= amount);
}

/** Returns the new stock level for every pantry item a recipe uses (never below zero). */
function deductIngredients(recipe, pantryByName) {
  const updates = [];
  for (const [name, amount] of Object.entries(recipe.ingredients)) {
    const item = pantryByName.get(name.toLowerCase());
    if (item) updates.push({ id: item.id, name: item.name, qty: Math.max(0, item.qty - amount) });
  }
  return updates;
}

function daysUntil(dateString, today = new Date()) {
  if (!dateString) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${dateString}T00:00:00`) - start) / 86_400_000);
}

function stockStatus(item) {
  if (item.qty <= 0) return 'out';
  return item.qty <= item.low ? 'low' : 'ok';
}

function describePantry(items, needs, today = new Date()) {
  return items.map((item) => ({
    ...item,
    status: stockStatus(item),
    daysLeft: daysUntil(item.expiry, today),
    afterPlan: item.qty - (needs[item.name] || 0),
  }));
}

module.exports = {
  DAYS, SESSIONS, UNITS, toBaseQuantity, baseUnitOf, indexPantry, sortMeals, calculateNeeds,
  calculateDeficits, annotateShortMeals, buildShoppingList, canCook, deductIngredients,
  daysUntil, stockStatus, describePantry,
};
