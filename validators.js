const { HttpError } = require('./httpError');
const { DAYS, SESSIONS, UNITS } = require('../services/planner');

const bad = (message) => new HttpError(400, message);

function requireNumber(value, label, { min = 0, max = 1_000_000 } = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) throw bad(`${label} must be a number`);
  if (number < min || number > max) throw bad(`${label} must be between ${min} and ${max}`);
  return number;
}

function requireString(value, label, { min = 1, max = 60 } = {}) {
  if (typeof value !== 'string') throw bad(`${label} is required`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw bad(`${label} must be ${min}-${max} characters`);
  return text;
}

function optionalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw bad('Expiry must be a valid date (YYYY-MM-DD)');
  }
  return value;
}

function validateCredentials(body = {}) {
  const username = requireString(body.username, 'Username', { min: 3, max: 30 });
  if (!/^[A-Za-z0-9_]+$/.test(username)) throw bad('Username may only use letters, numbers and underscores');
  const password = requireString(body.password, 'Password', { min: 6, max: 100 });
  return { username: username.toLowerCase(), password };
}

function validatePantryItem(body = {}) {
  if (!UNITS.includes(body.unit)) throw bad(`Unit must be one of ${UNITS.join(', ')}`);
  const blank = (v) => v === undefined || v === null || v === '';
  return {
    name: requireString(body.name, 'Item name'),
    quantity: requireNumber(body.quantity, 'Quantity'),
    unit: body.unit,
    lowLevel: blank(body.lowLevel) ? 0 : requireNumber(body.lowLevel, 'Low-stock level'),
    expiry: optionalDate(body.expiry),
    price: blank(body.price) ? 0 : requireNumber(body.price, 'Price'),
  };
}

function validateMealSlot(body = {}) {
  if (!DAYS.includes(body.day)) throw bad('Day must be Monday to Sunday');
  if (!SESSIONS.includes(body.session)) throw bad(`Session must be one of ${SESSIONS.join(', ')}`);
  return { day: body.day, session: body.session };
}

function validateId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw bad(`Invalid ${label}`);
  return id;
}

module.exports = { requireNumber, validateCredentials, validatePantryItem, validateMealSlot, validateId };
