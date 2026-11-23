/**
 * Opens SQLite using better-sqlite3 when installed, otherwise Node's built-in node:sqlite (Node 22+).
 * Both expose the same prepare().run/get/all API, so the rest of the app does not care which is used.
 */
function openDatabase(file) {
  let db;
  try {
    const BetterSqlite = require('better-sqlite3');
    db = new BetterSqlite(file);
    db.pragma('journal_mode = WAL');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(file);
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.runInTransaction = (work) => {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return db;
}

module.exports = { openDatabase };
