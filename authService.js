const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');
const { seedUserData } = require('../db/schema');

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + SESSION_MS);
  return token;
}

function register(db, { username, password }) {
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    throw new HttpError(409, 'That username is already taken');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)')
    .run(username, hashPassword(password, salt), salt);
  const userId = Number(lastInsertRowid);
  seedUserData(db, userId);
  return { token: createSession(db, userId), username };
}

function login(db, { username, password }) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()); // tidy expired sessions
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const expected = user ? Buffer.from(user.password_hash, 'hex') : null;
  const actual = user ? Buffer.from(hashPassword(password, user.salt), 'hex') : null;
  if (!user || !crypto.timingSafeEqual(expected, actual)) throw new HttpError(401, 'Wrong username or password');
  return { token: createSession(db, user.id), username: user.username };
}

function findUserByToken(db, token) {
  if (!token) return null;
  const row = db.prepare(
    'SELECT users.id, users.username, sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?'
  ).get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, username: row.username };
}

const logout = (db, token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

module.exports = { register, login, findUserByToken, logout };
