var express = require('express');
var router = express.Router();

const iconsPath = 'images/user-icons';
const playerIcons = [// ファイル名・・・ 四角か丸の頭文字(英語)　＋　色の先頭(一部例外あり)2〜4文字
  '/cbl.PNG', '/cda.PNG', '/cgr.PNG', '/cor.PNG', '/cpi.PNG', '/cpu.PNG', '/cre.PNG', '/csk.PNG', '/cye.PNG', '/cygre.PNG',
  '/sbl.PNG', '/sda.PNG', '/sgr.PNG', '/sor.PNG', '/spi.PNG', '/spu.PNG', '/sre.PNG', '/ssk.PNG', '/sye.PNG', '/sygre.PNG'
];// プレイヤーネームを設定する人用のアイコンパス

/* GET home page. */
router.get('/', (req, res, next) => {
  if (req.query.name && req.query.icon && !req.user) {// トップページに戻った際に、もう一度名前を入力する必要がないように
    let displayName = decodeURIComponent(req.query.name);
    let thumbUrl = decodeURIComponent(req.query.icon);

    if (thumbUrl.match(/twimg\.com/)) {// Twitter 認証を完了していない人が Twitter ログイン後の URL でアクセスしてきた際の対策
      displayName = null;
      thumbUrl = null;
    }

    res.render('index', { displayName, thumbUrl });

  } else if (req.query.name && !req.user) {// 初回の名前入力時
    const displayName = decodeURIComponent(req.query.name);
    const thumbUrl = iconsPath + playerIcons[Math.floor(Math.random() * 20)];
    
    res.render('index', { displayName, thumbUrl });

  } else {// Twitter 認証をしている場合と、Twitter 認証をしておらず、プレイヤーネームも設定していない場合
    res.render('index', { user: req.user })
  }
});

module.exports = router;