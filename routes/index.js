var express = require('express');
var router = express.Router();

const iconsPath = 'images/user-icons';
const playerIcons = [
  '/cbl.PNG', '/cda.PNG', '/cgr.PNG', '/cor.PNG', '/cpi.PNG', '/cpu.PNG', '/cre.PNG', '/csk.PNG', '/cye.PNG', '/cygre.PNG',
  '/sbl.PNG', '/sda.PNG', '/sgr.PNG', '/sor.PNG', '/spi.PNG', '/spu.PNG', '/sre.PNG', '/ssk.PNG', '/sye.PNG', '/sygre.PNG'
];// プレイヤーネームを設定する人用のアイコンパス

/* GET home page. */
router.get('/', (req, res, next) => {
  if (req.query.name && req.query.icon && !req.user) {// もう一度名前を入力する必要がないように
    const displayName = decodeURIComponent(req.query.name);
    const thumbUrl = decodeURIComponent(req.query.icon);

    res.render('index', { displayName, thumbUrl });

  } else if (req.query.name && !req.user) {// 初回の名前入力時
    const displayName = decodeURIComponent(req.query.name);
    const thumbUrl = iconsPath + playerIcons[Math.floor(Math.random() * 20)];
    
    res.render('index', { displayName, thumbUrl });

  } else {// Twitter ログインしている場合
    res.render('index', { user: req.user })
  }
});

module.exports = router;