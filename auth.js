const express = require('express');
const auth = require('../services/authService');
const { validateCredentials } = require('../utils/validators');
const { requireAuth } = require('../middleware/auth');

module.exports = (db, limiter) => {
  const router = express.Router();
  router.post('/register', limiter, (req, res) => res.status(201).json(auth.register(db, validateCredentials(req.body))));
  router.post('/login', limiter, (req, res) => res.json(auth.login(db, validateCredentials(req.body))));
  router.post('/logout', requireAuth(db), (req, res) => {
    auth.logout(db, req.token);
    res.status(204).end();
  });
  router.get('/me', requireAuth(db), (req, res) => res.json({ username: req.user.username }));
  return router;
};
