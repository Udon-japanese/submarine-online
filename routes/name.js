const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

router.get('/', csrfProtection, (req, res, next) => {
  res.render('name', { csrfToken: req.csrfToken() });// CSRF脆弱性対策
});

router.post('/', csrfProtection, (req, res, next) => {
  const playerName = req.body.name || `ゲストNo.${Math.floor(Math.random() * 2000 + 1)}`;// 名前が未入力なら、名前を「ゲストNo.（1~2000の乱数）」にする
  const encodedName = encodeURIComponent(playerName);
  res.redirect(`/?name=${encodedName}`);// アイコンはリダイレクトしてから設定
});

module.exports = router;