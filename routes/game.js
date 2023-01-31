const express = require('express');
const router = express.Router();
require('dotenv').config();

router.get('/', (req, res, next) => {
  let displayName = 'マジゲスト';
  let thumbUrl = 'images/user-icons/guest.PNG';// 直接 /game にジャンプしてきた人用画像・名前
  if (req.user) {// Twitter ログインしているなら
    displayName = req.user.displayName;
    thumbUrl = req.user.photos[0].value;
    
  } else if (req.query.name) {// プレイヤーネームを設定しているなら
    displayName = decodeURIComponent(req.query.name);
    thumbUrl = decodeURIComponent(req.query.icon);
  }

  if (displayName.match(/^NPC$/i)) {// NPC に偽装している人の名前の後ろに、(偽物)と付ける機能(大文字小文字関係なくマッチする)
    displayName += '(偽物)';
  }
  
  res.render('game', { displayName, thumbUrl, ipAddress: process.env.IP_ADDRESS });
});

module.exports = router;