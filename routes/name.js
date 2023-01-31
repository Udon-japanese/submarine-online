const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

router.get('/', csrfProtection, (req, res, next) => {
  res.render('name', { csrfToken: req.csrfToken() });
});

router.post('/', csrfProtection, (req, res, next) => {
  const playerName = req.body.name || `ゲストNo.${Math.floor(Math.random() * 2000 + 1)}`;
  const encodedName = encodeURIComponent(playerName);
  res.redirect(`/?name=${encodedName}`);
});

module.exports = router;