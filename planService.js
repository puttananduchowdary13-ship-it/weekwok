const { HttpError } = require('../utils/httpError');
const planner = require('./planner');
const { recipeMap, getPantry, getMeals, getOwnedMeal } = require('../db/queries');

/** Adds a recipe to a day/session. A session can hold several items. */
function addMeal(db, userId, { day, session }, recipeId) {
  if (!recipeMap(db).has(recipeId)) throw new HttpError(404, 'Recipe not found');
  const { lastInsertRowid } = db.prepare('INSERT INTO plan_meals (user_id, day, session, recipe_id) VALUES (?, ?, ?, ?)')
    .run(userId, day, session, recipeId);
  return Number(lastInsertRowid);
}

function moveMeal(db, userId, mealId, { day, session }) {
  getOwnedMeal(db, userId, mealId);
  db.prepare('UPDATE plan_meals SET day = ?, session = ? WHERE id = ?').run(day, session, mealId);
}

/** Marks a meal cooked and deducts its ingredients from the pantry, atomically. */
function cookMeal(db, userId, mealId) {
  return db.runInTransaction(() => {
    const meal = getOwnedMeal(db, userId, mealId);
    if (meal.done) throw new HttpError(409, 'This meal is already cooked');
    const recipe = recipeMap(db).get(meal.recipe_id);
    const updates = planner.deductIngredients(recipe, planner.indexPantry(getPantry(db, userId)));
    const save = db.prepare('UPDATE pantry_items SET qty = ? WHERE id = ? AND user_id = ?');
    updates.forEach((update) => save.run(update.qty, update.id, userId));
    db.prepare('UPDATE plan_meals SET done = 1 WHERE id = ?').run(mealId);
    return { recipe: recipe.name, updatedItems: updates.length };
  });
}

function getPlanView(db, userId) {
  const recipes = recipeMap(db);
  const pantry = planner.indexPantry(getPantry(db, userId));
  return planner.annotateShortMeals(getMeals(db, userId), recipes, pantry);
}

function getShoppingView(db, userId) {
  const recipes = recipeMap(db);
  const pantry = planner.indexPantry(getPantry(db, userId));
  const needs = planner.calculateNeeds(getMeals(db, userId), recipes);
  const items = planner.buildShoppingList(planner.calculateDeficits(needs, pantry), pantry);
  return { items, total: items.reduce((sum, item) => sum + item.cost, 0) };
}

module.exports = { addMeal, moveMeal, cookMeal, getPlanView, getShoppingView };
