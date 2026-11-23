const { HttpError } = require('../utils/httpError');

function getRecipes(db) {
  const recipes = new Map(
    db.prepare('SELECT id, name, minutes, serves, category FROM recipes ORDER BY id').all()
      .map((row) => [row.id, { ...row, ingredients: {} }])
  );
  for (const row of db.prepare('SELECT recipe_id, name, qty FROM recipe_ingredients').all()) {
    recipes.get(row.recipe_id).ingredients[row.name] = row.qty;
  }
  return [...recipes.values()];
}

const recipeMap = (db) => new Map(getRecipes(db).map((recipe) => [recipe.id, recipe]));

const getPantry = (db, userId) =>
  db.prepare('SELECT id, name, unit, qty, low, expiry, price FROM pantry_items WHERE user_id = ? ORDER BY id').all(userId);

const getMeals = (db, userId) =>
  db.prepare('SELECT id, day, session, recipe_id AS recipeId, done FROM plan_meals WHERE user_id = ? ORDER BY id')
    .all(userId)
    .map((meal) => ({ ...meal, done: Boolean(meal.done) }));

function getOwnedMeal(db, userId, mealId) {
  const meal = db.prepare('SELECT * FROM plan_meals WHERE id = ? AND user_id = ?').get(mealId, userId);
  if (!meal) throw new HttpError(404, 'Meal not found');
  return meal;
}

module.exports = { getRecipes, recipeMap, getPantry, getMeals, getOwnedMeal };
