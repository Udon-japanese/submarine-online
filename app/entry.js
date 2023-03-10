'use strict';
import $ from 'jquery';
import crypto from 'crypto'
import io from 'socket.io-client';

const gameObj = {
  radarCanvasWidth: 500,
  radarCanvasHeight: 500,
  scoreCanvasWidth: 300,
  scoreCanvasHeight: 500,
  itemRadius: 4,
  airRadius: 5,
  screwRadius: 3,
  bomCellPx: 32,
  deg: 0,
  counter: 0,
  rotationDegreeByDirection: {
    'left': 0,// 180度回すと反転して見えてしまうため
    'up': 270,
    'down': 90,
    'right': 0
  },
  rotationDegreeByFlyingMissileDirection: {
    'left': 270,
    'up': 0,
    'down': 180,
    'right': 90
  },
  myDisplayName: $('#main').attr('data-displayName'),
  myThumbUrl: $('#main').attr('data-thumbUrl'),
  fieldWidth: null,
  fieldHeight: null,
  itemsMap: new Map(),
  airMap: new Map(),
  screwsMap: new Map(),
  flyingMissilesMap: new Map()
};

const socketQueryParameters = `displayName=${gameObj.myDisplayName}&thumbUrl=${gameObj.myThumbUrl}`;
const socket = io(`${$('#main').attr('data-ipAddress')}?${socketQueryParameters}`);

function init() {

  // ゲーム用のキャンバス
  const radarCanvas = $('#radar')[0];
  radarCanvas.width = gameObj.radarCanvasWidth;
  radarCanvas.height = gameObj.radarCanvasHeight;
  gameObj.ctxRadar = radarCanvas.getContext('2d');

  // ランキング用のキャンバス
  const scoreCanvas = $('#score')[0];
  scoreCanvas.width = gameObj.scoreCanvasWidth;
  scoreCanvas.height = gameObj.scoreCanvasHeight;
  gameObj.ctxScore = scoreCanvas.getContext('2d');

  // 潜水艦の画像
  gameObj.submarineImage = new Image();
  gameObj.submarineImage.src = '/images/submarine.png';

  // ミサイルの画像
  gameObj.missileImage = new Image();
  gameObj.missileImage.src = '/images/missile.png';

  // 爆発の画像集
  gameObj.bomListImage = new Image();
  gameObj.bomListImage.src = '/images/bomlist.png';

  // スクリューの画像
  gameObj.screwImage = new Image();
  gameObj.screwImage.src = '/images/screw.png';
}

init();

function ticker() {
  if (!(gameObj.myPlayerObj && gameObj.playersMap)) return;

  gameObj.ctxRadar.clearRect(0, 0, gameObj.radarCanvasWidth, gameObj.radarCanvasHeight);
  drawRadar(gameObj.ctxRadar);
  drawMap(gameObj);
  drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
  if (!gameObj.myPlayerObj.isAlive && gameObj.myPlayerObj.deadCount > 120) {
    drawGameOver(gameObj.ctxRadar);
    $('#backToTitle').removeClass('d-none');// タイトルに戻るボタン表示
  }

  gameObj.ctxScore.clearRect(0, 0, gameObj.scoreCanvasWidth, gameObj.scoreCanvasHeight);
  drawAirTimer(gameObj.ctxScore, gameObj.myPlayerObj.airTime);
  drawMissiles(gameObj.ctxScore, gameObj.myPlayerObj.missilesMany);
  drawScrews(gameObj.ctxScore, gameObj.myPlayerObj.screwsMany);
  drawScore(gameObj.ctxScore, gameObj.myPlayerObj.score);
  drawRanking(gameObj.ctxScore, gameObj.playersMap);

  moveInClient(gameObj.myPlayerObj, gameObj.flyingMissilesMap); // なるべく遅延を感じさせないためにクライアント側でも動かす

  gameObj.counter = (gameObj.counter + 1) % 10000;
}

setInterval(ticker, 33);

function drawGameOver(ctxRadar) {
  ctxRadar.font = 'bold 76px arial black';
  ctxRadar.fillStyle = 'rgb(0, 220, 250)';
  ctxRadar.fillText('Game Over', 20, 270);
  ctxRadar.strokeStyle = 'rgb(0, 0, 0)';
  ctxRadar.lineWidth = 3;
  ctxRadar.strokeText('Game Over', 20, 270);
}

function drawRadar(ctxRadar) {
  if (!gameObj.myPlayerObj.isAlive) return;
  const x = gameObj.radarCanvasWidth / 2;
  const y = gameObj.radarCanvasHeight / 2;
  const r = gameObj.radarCanvasWidth * 1.5 / 2;

  ctxRadar.save();

  ctxRadar.beginPath(); // 筆をおくような感じ
  ctxRadar.translate(x, y);
  ctxRadar.rotate(getRadian(gameObj.deg));

  ctxRadar.fillStyle = 'rgba(0, 220, 0, 0.5)';

  ctxRadar.arc(0, 0, r, getRadian(0), getRadian(-30), true);
  ctxRadar.lineTo(0, 0);

  ctxRadar.fill();

  ctxRadar.restore();
  gameObj.deg = (gameObj.deg + 5) % 360;
}

function drawSubmarine(ctxRadar, myPlayerObj) {
  if (!myPlayerObj.isAlive) {
    drawBom(ctxRadar, gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2, myPlayerObj.deadCount);
    return;
  }
  const rotationDegree = gameObj.rotationDegreeByDirection[myPlayerObj.direction];// オブジェクトの値を取得している

  ctxRadar.save();
  ctxRadar.translate(gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2);
  ctxRadar.rotate(getRadian(rotationDegree));
  if (myPlayerObj.direction === 'left') {
    ctxRadar.scale(-1, 1);// 反転させる
  }

  ctxRadar.drawImage(
    gameObj.submarineImage, -(gameObj.submarineImage.width / 2), -(gameObj.submarineImage.height / 2)
  );
  ctxRadar.restore();
}

function drawBom(ctxRadar, drawX, drawY, deadCount) {
  if (deadCount >= 60) return;

  const drawBomNumber = Math.floor(deadCount / 6);
  const cropX = (drawBomNumber % (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;
  const cropY = Math.floor(drawBomNumber / (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;

  ctxRadar.drawImage(
    gameObj.bomListImage,
    cropX, cropY,
    gameObj.bomCellPx, gameObj.bomCellPx,
    drawX - gameObj.bomCellPx / 2, drawY - gameObj.bomCellPx / 2,
    gameObj.bomCellPx, gameObj.bomCellPx
  ); // 画像データ、切り抜き左、切り抜き上、幅、幅、表示x、表示y、幅、幅
}

function drawMissiles(ctxScore, missilesMany) {
  for (let i = 0; i < missilesMany; i++) {
    ctxScore.drawImage(gameObj.missileImage, 50 * i, 80);
  }
}

function drawScrews(ctxScore, screwsMany) {
  for (let i = 0; i < screwsMany; i++) {
    ctxScore.drawImage(gameObj.screwImage, 50 * i + 220, 20);// 1個しか描画できないが、拡張性を持たせるためにあえてループ文の中に入れた
  }
}

function drawAirTimer(ctxScore, airTime) {
  ctxScore.fillStyle = 'rgb(0, 220, 250)';
  ctxScore.font = 'bold 40px Arial';
  ctxScore.fillText(airTime, 110, 50);
}

function drawScore(ctxScore, score) {
  ctxScore.fillStyle = "rgb(26, 26, 26)";
  ctxScore.font = '28px Arial';
  ctxScore.fillText(`あなたのスコア: ${score}`, 10, 180);
}

function drawRanking(ctxScore, playersMap) {
  const playersArray = [].concat(Array.from(playersMap));
  playersArray.sort((a, b) => b[1].score - a[1].score);

  gameObj.thumbsMap = gameObj.thumbsMap ?? new Map();

  ctxScore.fillStyle = "rgb(0, 0, 0)";
  ctxScore.fillRect(0, 220, gameObj.scoreCanvasWidth, 3);

  ctxScore.fillStyle = "rgb(26, 26, 26)";
  ctxScore.font = '20px Arial';

  for (let i = 0; i < 10; i++) {// 1, 2, 3, 4以降で表記を分ける
    if (!playersArray[i]) return;

    const rank = i + 1;
    let rankString = null;

    switch (rank) {
      case 1:
        rankString = `${rank}st`;
        break;
      case 2:
        rankString = `${rank}nd`;
        break;
      case 3:
        rankString = `${rank}rd`;
        break;
      default:
        rankString = `${rank}th`;
        break;
    }
    const x = 10, y = 220 + (rank * 28);

    const { playerId, thumbUrl, displayName, score } = playersArray[i][1];

    if (/twimg\.com/.test(thumbUrl) || /^images\/user-icons\//.test(thumbUrl)) {// Twitter の 画像URL と images/user-icons から始まるパスにマッチしないものは除外
      const thumbWidth = 23, thumbHeight = 23;
      const rankWidth = ctxScore.measureText(rankString).width;

      let thumb = null;

      if (gameObj.thumbsMap.has(playerId)) {
        thumb = gameObj.thumbsMap.get(playerId);
        draw();
      } else {
        thumb = new Image();
        thumb.src = thumbUrl;
        thumb.onload = draw;
        gameObj.thumbsMap.set(playerId, thumb);
      }

      function draw() {
        ctxScore.fillText(rankString, x, y);
        ctxScore.drawImage(thumb, x + rankWidth, y - thumbHeight, thumbWidth, thumbHeight);
        ctxScore.fillText(`${displayName}: ${score}`, x + rankWidth + thumbWidth, y);
      };

      continue;
    }

    ctxScore.fillText(`${rankString} ${displayName}: ${score}`, x, y);
  }
}

socket.on('start data', (startObj) => {
  gameObj.fieldWidth = startObj.fieldWidth;
  gameObj.fieldHeight = startObj.fieldHeight;
  gameObj.myPlayerObj = startObj.playerObj;
  gameObj.missileSpeed = startObj.missileSpeed;
});

socket.on('map data', (compressed) => {
  const playersArray = compressed[0];
  const itemsArray = compressed[1];
  const airArray = compressed[2];
  const screwsArray = compressed[3];
  const flyingMissilesArray = compressed[4];

  gameObj.playersMap = new Map();
  for (let compressedPlayerData of playersArray) {

    const player = {};
    player.x = compressedPlayerData[0];
    player.y = compressedPlayerData[1];
    player.playerId = compressedPlayerData[2];
    player.displayName = compressedPlayerData[3];
    player.score = compressedPlayerData[4];
    player.isAlive = compressedPlayerData[5];
    player.direction = compressedPlayerData[6];
    player.missilesMany = compressedPlayerData[7];
    player.screwsMany = compressedPlayerData[8];
    player.isUsingScrew = compressedPlayerData[9];
    player.airTime = compressedPlayerData[10];
    player.deadCount = compressedPlayerData[11];
    player.thumbUrl = compressedPlayerData[12];

    gameObj.playersMap.set(player.playerId, player);

    // 自分の情報も更新(自分とそれ以外の、クライアント側での描写を分けるため)
    if (player.playerId === gameObj.myPlayerObj.playerId) {
      gameObj.myPlayerObj.x = compressedPlayerData[0];
      gameObj.myPlayerObj.y = compressedPlayerData[1];
      gameObj.myPlayerObj.displayName = compressedPlayerData[3];
      gameObj.myPlayerObj.score = compressedPlayerData[4];
      gameObj.myPlayerObj.isAlive = compressedPlayerData[5];
      gameObj.myPlayerObj.missilesMany = compressedPlayerData[7];
      gameObj.myPlayerObj.screwsMany = compressedPlayerData[8];
      gameObj.myPlayerObj.isUsingScrew = compressedPlayerData[9];
      gameObj.myPlayerObj.airTime = compressedPlayerData[10];
      gameObj.myPlayerObj.deadCount = compressedPlayerData[11];
      gameObj.myPlayerObj.thumbUrl = compressedPlayerData[12];
    }
  }

  gameObj.itemsMap = new Map();
  itemsArray.forEach((compressedItemData, index) => {// クライアント側ではサーバから受け取ったデータを描写するだけなので、キーは0,1,2...でよい
    gameObj.itemsMap.set(index, { x: compressedItemData[0], y: compressedItemData[1] });
  });

  gameObj.airMap = new Map();
  airArray.forEach((compressedAirData, index) => {
    gameObj.airMap.set(index, { x: compressedAirData[0], y: compressedAirData[1] });
  });

  gameObj.screwsMap = new Map();
  screwsArray.forEach((compressedScrewData, index) => {
    gameObj.screwsMap.set(index, { x: compressedScrewData[0], y: compressedScrewData[1] });
  });

  gameObj.flyingMissilesMap = new Map();
  for (let compressedFlyingMissileData of flyingMissilesArray) {

    const flyingMissile = {};
    flyingMissile.missileId = compressedFlyingMissileData[0];// 一応クライアント側でも、迎撃されたミサイルidと同じかどうか確認したいため、 id も受け取る
    flyingMissile.x = compressedFlyingMissileData[1];
    flyingMissile.y = compressedFlyingMissileData[2];
    flyingMissile.direction = compressedFlyingMissileData[3];
    flyingMissile.emitPlayerId = compressedFlyingMissileData[4];
    flyingMissile.interceptedMissileId = compressedFlyingMissileData[5];// 迎撃されたミサイルのid（中身は flyingMissile.missileId と同じ）
    flyingMissile.deadCount = compressedFlyingMissileData[6];// ミサイルの爆発を描画するのに必要なカウンター

    gameObj.flyingMissilesMap.set(flyingMissile.missileId, flyingMissile);
  }
});

function getRadian(deg) {
  return deg * Math.PI / 180
}

function drawMap(gameObj) {
  // 敵プレイヤーと NPC の描画
  for (let [key, enemyPlayerObj] of gameObj.playersMap) {
    if (key === gameObj.myPlayerObj.playerId) continue; // 自分は描画しない

    const distanceObj = calculationBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      enemyPlayerObj.x, enemyPlayerObj.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );

    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {

      if (!enemyPlayerObj.isAlive) {
        drawBom(gameObj.ctxRadar, distanceObj.drawX, distanceObj.drawY, enemyPlayerObj.deadCount);
        continue;
      }

      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);

      const drawRadius = gameObj.counter % 12 + 2 + 12;
      const clearRadius = drawRadius - 2;
      const drawRadius2 = gameObj.counter % 12 + 2;
      const clearRadius2 = drawRadius2 - 2;

      gameObj.ctxRadar.fillStyle = `rgba(0, 0, 255, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      gameObj.ctxRadar.fillStyle = `rgb(0, 20, 50)`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      gameObj.ctxRadar.fillStyle = `rgba(0, 0, 255, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      gameObj.ctxRadar.fillStyle = `rgb(0, 20, 50)`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      if (enemyPlayerObj.displayName) {

        gameObj.ctxRadar.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.fillStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '8px Arial';
        gameObj.ctxRadar.fillText(enemyPlayerObj.displayName, distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

      }
    }
  }

  drawObj(gameObj.itemsMap, 255, 0, 0);
  drawObj(gameObj.airMap, 0, 220, 255);
  drawObj(gameObj.screwsMap, 230, 180, 34);

  // 飛んでいるミサイルの描画
  for (let [missileId, flyingMissile] of gameObj.flyingMissilesMap) {

    const distanceObj = calculationBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      flyingMissile.x, flyingMissile.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );

    if (
      distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2 + 50) &&
      distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2 + 50)
    ) {

      if (missileId === flyingMissile.interceptedMissileId) {// 迎撃されたミサイルなら爆発を描画
        drawBom(gameObj.ctxRadar, distanceObj.drawX, distanceObj.drawY, flyingMissile.deadCount);
        continue;
      }

      if (flyingMissile.emitPlayerId === gameObj.myPlayerObj.playerId) { // 自分自身のミサイルの描画

        const rotationDegree = gameObj.rotationDegreeByFlyingMissileDirection[flyingMissile.direction];
        gameObj.ctxRadar.save();
        gameObj.ctxRadar.translate(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.rotate(getRadian(rotationDegree));
        gameObj.ctxRadar.drawImage(
          gameObj.missileImage, -gameObj.missileImage.width / 2, -gameObj.missileImage.height / 2
        );
        gameObj.ctxRadar.restore();

        gameObj.ctxRadar.strokeStyle = "rgba(250, 250, 250, 0.9)";
        gameObj.ctxRadar.fillStyle = "rgba(250, 250, 250, 0.9)";
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20 + 35, distanceObj.drawY - 20);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '11px Arial';
        gameObj.ctxRadar.fillText('missile', distanceObj.drawX + 20, distanceObj.drawY - 20 - 2);

      } else { // 他人のミサイルの描画

        const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
        const opacity = calcOpacity(degreeDiff);

        const drawRadius1 = gameObj.counter % 8 + 2 + 20;
        const clearRadius1 = drawRadius1 - 2;
        const drawRadius2 = gameObj.counter % 8 + 2 + 10;
        const clearRadius2 = drawRadius2 - 2;
        const drawRadius3 = gameObj.counter % 8 + 2 + 0;
        const clearRadius3 = drawRadius3 - 2;

        gameObj.ctxRadar.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius1, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = "rgb(0, 20, 50)";
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius1, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = "rgb(0, 20, 50)";
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius3, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = "rgb(0, 20, 50)";
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius3, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.fillStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 30, distanceObj.drawY - 30);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 30 + 35, distanceObj.drawY - 30);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '11px Arial';
        gameObj.ctxRadar.fillText('missile', distanceObj.drawX + 30, distanceObj.drawY - 30 - 2);// ミサイルを放った人の名前は、載せない方が面白そうなので、描画しないようにした
      }
    }
  }
}

function drawObj(obj, r, g, b) {// マップ上のミサイルと空気の描画を行う
  for (let [key, item] of obj) {

    const distanceObj = calculationBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      item.x, item.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );

    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {

      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);

      gameObj.ctxRadar.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, gameObj.itemRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();
    }
  }
}

function calculationBetweenTwoPoints(pX, pY, oX, oY, gameWidth, gameHeight, radarCanvasWidth, radarCanvasHeight) {
  let distanceX = 99999999;
  let distanceY = 99999999;
  let drawX = null;
  let drawY = null;

  if (pX <= oX) {
    // 右から
    distanceX = oX - pX;
    drawX = (radarCanvasWidth / 2) + distanceX;
    // 左から
    let tmpDistance = pX + gameWidth - oX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
      drawX = (radarCanvasWidth / 2) - distanceX;
    }

  } else {
    // 右から
    distanceX = pX - oX;
    drawX = (radarCanvasWidth / 2) - distanceX;
    // 左から
    let tmpDistance = oX + gameWidth - pX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
      drawX = (radarCanvasWidth / 2) + distanceX;
    }
  }

  if (pY <= oY) {
    // 下から
    distanceY = oY - pY;
    drawY = (radarCanvasHeight / 2) + distanceY;
    // 上から
    let tmpDistance = pY + gameHeight - oY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
      drawY = (radarCanvasHeight / 2) - distanceY;
    }

  } else {
    // 上から
    distanceY = pY - oY;
    drawY = (radarCanvasHeight / 2) - distanceY;
    // 下から
    let tmpDistance = oY + gameHeight - pY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
      drawY = (radarCanvasHeight / 2) + distanceY;
    }
  }

  const degree = calcTwoPointsDegree(drawX, drawY, radarCanvasWidth / 2, radarCanvasHeight / 2);

  return {
    distanceX,
    distanceY,
    drawX,
    drawY,
    degree
  };
}

function calcTwoPointsDegree(x1, y1, x2, y2) {
  const radian = Math.atan2(y2 - y1, x2 - x1);
  const degree = radian * 180 / Math.PI + 180;
  return degree;
}

function calcDegreeDiffFromRadar(degRadar, degItem) {
  let diff = degRadar - degItem;
  if (diff < 0) {
    diff += 360;
  }

  return diff;
}

function calcOpacity(degreeDiff) {
  const deleteDeg = 270;
  degreeDiff = degreeDiff > deleteDeg ? deleteDeg : degreeDiff;
  return (1 - degreeDiff / deleteDeg).toFixed(2);
}

$(window).on("keydown", (event) => {
  if (!(gameObj.myPlayerObj && gameObj.myPlayerObj.isAlive)) return;

  switch (event.key) {
    case 'ArrowLeft':
      if (gameObj.myPlayerObj.direction === 'left') break; // 変わってない
      gameObj.myPlayerObj.direction = 'left';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj); // より瞬時にクライアント側で向きを変化させるため
      sendChangeDirection(socket, 'left');
      break;
    case 'ArrowUp':
      if (gameObj.myPlayerObj.direction === 'up') break; // 変わってない
      gameObj.myPlayerObj.direction = 'up';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'up');
      break;
    case 'ArrowDown':
      if (gameObj.myPlayerObj.direction === 'down') break; // 変わってない
      gameObj.myPlayerObj.direction = 'down';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'down');
      break;
    case 'ArrowRight':
      if (gameObj.myPlayerObj.direction === 'right') break; // 変わってない
      gameObj.myPlayerObj.direction = 'right';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'right');
      break;
    case ' ':
      if (gameObj.myPlayerObj.missilesMany <= 0) break;

      gameObj.myPlayerObj.missilesMany -= 1;
      const missileId = `${crypto.randomBytes(8).toString('hex')},${gameObj.myPlayerObj.socketId},${gameObj.myPlayerObj.x},${gameObj.myPlayerObj.y}`;// より id が被らないよう、16進数の文字列で設定

      const missileObj = {
        emitPlayerId: gameObj.myPlayerObj.playerId,
        x: gameObj.myPlayerObj.x,
        y: gameObj.myPlayerObj.y,
        direction: gameObj.myPlayerObj.direction,
        id: missileId,
        interceptedMissileId: null,// 最初は空っぽにしておく
        deadCount: 0
      };
      gameObj.flyingMissilesMap.set(missileId, missileObj);
      sendMissileEmit(socket, gameObj.myPlayerObj.direction);
      break;
    case 's':
    case 'S':
      if (gameObj.myPlayerObj.screwsMany <= 0 || gameObj.myPlayerObj.isUsingScrew) break;// スクリューを一つも持っていないか、スクリュー使用済みの場合か、その両方
      gameObj.myPlayerObj.screwsMany -= 1;
      sendScrewState(socket);
      break;
  }
});

function sendChangeDirection(socket, direction) {
  socket.emit('change direction', direction);
}

function sendMissileEmit(socket, direction) {
  socket.emit('missile emit', direction);
}

function sendScrewState(socket, screwState) {
  socket.emit('change screw state', screwState);
}

function moveInClient(myPlayerObj, flyingMissilesMap) {// サーバからflyingMissilesMap を受け取るまでの、プレイヤーとミサイルの移動
  let moveDistance = 1;

  if (!myPlayerObj.isAlive) {
    if (myPlayerObj.deadCount < 60) {
      myPlayerObj.deadCount += 1;
    }
    return;
  }

  if (myPlayerObj.isUsingScrew) {
    moveDistance = Math.floor(Math.random() * 4 + 2);
  }

  // 移動
  switch (myPlayerObj.direction) {
    case 'left':
      myPlayerObj.x -= moveDistance;
      break;
    case 'up':
      myPlayerObj.y -= moveDistance;
      break;
    case 'down':
      myPlayerObj.y += moveDistance;
      break;
    case 'right':
      myPlayerObj.x += moveDistance;
      break;
  }
  if (myPlayerObj.x > gameObj.fieldWidth) myPlayerObj.x -= gameObj.fieldWidth;
  if (myPlayerObj.x < 0) myPlayerObj.x += gameObj.fieldWidth;
  if (myPlayerObj.y < 0) myPlayerObj.y += gameObj.fieldHeight;
  if (myPlayerObj.y > gameObj.fieldHeight) myPlayerObj.y -= gameObj.fieldHeight;

  myPlayerObj.aliveTime.clock += 1;
  if (myPlayerObj.aliveTime.clock === 30) {
    myPlayerObj.aliveTime.clock = 0;
    myPlayerObj.aliveTime.seconds += 1;
  }

  // 飛んでいるミサイルの移動
  for (let [missileId, flyingMissile] of flyingMissilesMap) {

    if (missileId === flyingMissile.interceptedMissileId) {
      if (flyingMissile.deadCount < 70) {
        flyingMissile.deadCount += 2;
      }
      continue;
    }

    switch (flyingMissile.direction) {
      case 'left':
        flyingMissile.x -= gameObj.missileSpeed;
        break;
      case 'up':
        flyingMissile.y -= gameObj.missileSpeed;
        break;
      case 'down':
        flyingMissile.y += gameObj.missileSpeed;
        break;
      case 'right':
        flyingMissile.x += gameObj.missileSpeed;
        break;
    }
    if (flyingMissile.x > gameObj.fieldWidth) flyingMissile.x -= gameObj.fieldWidth;
    if (flyingMissile.x < 0) flyingMissile.x += gameObj.fieldWidth;
    if (flyingMissile.y < 0) flyingMissile.y += gameObj.fieldHeight;
    if (flyingMissile.y > gameObj.fieldHeight) flyingMissile.y -= gameObj.fieldHeight;
  }
}