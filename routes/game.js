const express = require('express');
const router = express.Router();
require('dotenv').config();

router.get('/', (req, res, next) => {
  let displayName = 'マジゲスト';
  let thumbUrl = 'images/user-icons/guest.PNG';
  if (req.user) {
    displayName = req.user.displayName;
    thumbUrl = req.user.photos[0].value;
    
  } else if (req.query.name) {
    displayName = decodeURIComponent(req.query.name);
    thumbUrl = decodeURIComponent(req.query.icon);
  }

  if (displayName.match(/^NPC$/i)) {
    displayName += '(偽物)';
  }
  
  res.render('game', { displayName, thumbUrl, ipAddress: process.env.IP_ADDRESS });
});

module.exports = router;