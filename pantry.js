const express = require('express');
const planner = require('../services/planner');
const { recipeMap, getPantry, getMeals } = require('../db/queries');
const { HttpError } = require('../utils/httpError');
const { validatePantryItem, validateId, requireNumber } = require('../utils/validators');

module.exports = (db) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    const needs = planner.calculateNeeds(getMeals(db, req.user.id), recipeMap(db));
    res.json(planner.describePantry(getPantry(db, req.user.id), needs));
  });

  router.post('/', (req, res) => {
    const input = validatePantryItem(req.body);
    const unit = planner.baseUnitOf(input.unit);
    const qty = planner.toBaseQuantity(input.quantity, input.unit);
    const existing = db.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND name = ? COLLATE NOCASE').get(req.user.id, input.name);
    if (existing && existing.unit === unit) {
      db.prepare('UPDATE pantry_items SET qty = qty + ? WHERE id = ?').run(qty, existing.id);
    } else if (existing) {
      throw new HttpError(409, `${existing.name} is tracked in ${existing.unit}. Use the same unit.`);
    } else {
      db.prepare('INSERT INTO pantry_items (user_id, name, unit, qty, low, expiry, price) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(req.user.id, input.name, unit, qty, planner.toBaseQuantity(input.lowLevel, input.unit), input.expiry, input.price);
    }
    res.status(201).json({ ok: true });
  });

  // Adjust stock by a positive or negative amount, never below zero.
  router.patch('/:id', (req, res) => {
    const id = validateId(req.params.id);
    const delta = requireNumber(req.body.delta, 'Change', { min: -100000, max: 100000 });
    const item = db.prepare('SELECT * FROM pantry_items WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!item) throw new HttpError(404, 'Pantry item not found');
    db.prepare('UPDATE pantry_items SET qty = ? WHERE id = ?').run(Math.max(0, item.qty + delta), id);
    res.json({ ok: true });
  });

  router.delete('/:id', (req, res) => {
    const { changes } = db.prepare('DELETE FROM pantry_items WHERE id = ? AND user_id = ?').run(validateId(req.params.id), req.user.id);
    if (!changes) throw new HttpError(404, 'Pantry item not found');
    res.status(204).end();
  });

  return router;
};
