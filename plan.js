const express = require('express');
const plan = require('../services/planService');
const { seedUserData } = require('../db/schema');
const { getRecipes } = require('../db/queries');
const { validateMealSlot, validateId } = require('../utils/validators');
const { getOwnedMeal } = require('../db/queries');

module.exports = (db) => {
  const router = express.Router();

  router.get('/recipes', (_req, res) => res.json(getRecipes(db)));
  router.get('/plan', (req, res) => res.json(plan.getPlanView(db, req.user.id)));
  router.get('/shopping', (req, res) => res.json(plan.getShoppingView(db, req.user.id)));

  router.post('/plan', (req, res) => {
    const slot = validateMealSlot(req.body);
    const id = plan.addMeal(db, req.user.id, slot, validateId(req.body.recipeId, 'recipe id'));
    res.status(201).json({ id });
  });

  router.patch('/plan/:id', (req, res) => {
    plan.moveMeal(db, req.user.id, validateId(req.params.id), validateMealSlot(req.body));
    res.json({ ok: true });
  });

  router.post('/plan/:id/cook', (req, res) => res.json(plan.cookMeal(db, req.user.id, validateId(req.params.id))));

  router.delete('/plan/:id', (req, res) => {
    const id = validateId(req.params.id);
    getOwnedMeal(db, req.user.id, id);
    db.prepare('DELETE FROM plan_meals WHERE id = ?').run(id);
    res.status(204).end();
  });

  router.delete('/plan', (req, res) => {
    db.prepare('DELETE FROM plan_meals WHERE user_id = ?').run(req.user.id);
    res.status(204).end();
  });

  router.post('/demo/reset', (req, res) => {
    seedUserData(db, req.user.id);
    res.json({ ok: true });
  });

  return router;
};
