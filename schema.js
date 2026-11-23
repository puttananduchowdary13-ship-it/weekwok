const seed = require('./seedData');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  minutes INTEGER NOT NULL,
  serves INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('T','M','C','S','D'))
);
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty REAL NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (recipe_id, name)
);
CREATE TABLE IF NOT EXISTS pantry_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g','ml','pcs')),
  qty REAL NOT NULL CHECK (qty >= 0),
  low REAL NOT NULL DEFAULT 0,
  expiry TEXT,
  price REAL NOT NULL DEFAULT 0,
  UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS plan_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  session TEXT NOT NULL,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id),
  done INTEGER NOT NULL DEFAULT 0
);
`;

function createSchema(db) {
  db.exec(SCHEMA);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM recipes').get();
  if (count > 0) return;
  db.runInTransaction(() => {
    const addRecipe = db.prepare('INSERT INTO recipes (name, minutes, serves, category) VALUES (?, ?, ?, ?)');
    const addIngredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, name, qty) VALUES (?, ?, ?)');
    for (const recipe of seed.recipes) {
      const { lastInsertRowid } = addRecipe.run(recipe.name, recipe.minutes, recipe.serves, recipe.category);
      recipe.ingredients.forEach((ing) => addIngredient.run(lastInsertRowid, ing.name, ing.qty));
    }
  });
}

const isoDateInDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Gives a user a fresh demo pantry and a sample Friday dinner. Replaces any existing data. */
function seedUserData(db, userId) {
  db.runInTransaction(() => {
    db.prepare('DELETE FROM pantry_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM plan_meals WHERE user_id = ?').run(userId);
    const addItem = db.prepare(
      'INSERT INTO pantry_items (user_id, name, unit, qty, low, expiry, price) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const item of seed.pantry) {
      const expiry = item.expiresInDays === null ? null : isoDateInDays(item.expiresInDays);
      addItem.run(userId, item.name, item.unit, item.qty, item.low, expiry, item.price);
    }
    const recipeId = (name) => db.prepare('SELECT id FROM recipes WHERE name = ?').get(name).id;
    const addMeal = db.prepare('INSERT INTO plan_meals (user_id, day, session, recipe_id) VALUES (?, ?, ?, ?)');
    addMeal.run(userId, 'Friday', 'Dinner', recipeId('Paneer Butter Masala'));
    addMeal.run(userId, 'Friday', 'Dinner', recipeId('Chapati'));
  });
}

module.exports = { createSchema, seedUserData };
