'use strict';
const crypto = require('crypto');

const gameObj = {
  playersMap: new Map(),
  itemsMap: new Map(),
  airMap: new Map(),
  NPCMap: new Map(),
  addingNPCPlayerNum: 9,
  flyingMissilesMap: new Map(),
  missileAliveFlame: 180, // ミサイルの生存時間(約6秒)
  missileSpeed: 3,
  missileWidth: 30,
  missileHeight: 30,
  directions: ['left', 'up', 'down', 'right'],
  fieldWidth: 1000,
  fieldHeight: 1000,
  itemTotal: 15,
  airTotal: 10,
  itemRadius: 4,
  airRadius: 5,
  addAirTime: 30,// 酸素をとった際に増える、自機の残酸素数
  itemPoint: 3,
  killPoint: 500,
  submarineImageWidth: 42
};

function init() {
  for (let i = 0; i < gameObj.itemTotal; i++) {
    addItem();
  }
  for (let i = 0; i < gameObj.airTotal; i++) {
    addAir();
  }
}

init();

const gameTicker = setInterval(() => {
  NPCMoveDecision(gameObj.NPCMap);
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  movePlayers(playersAndNPCMap);
  moveMissile(gameObj.flyingMissilesMap);
  checkGetItem(playersAndNPCMap, gameObj.itemsMap, gameObj.airMap, gameObj.flyingMissilesMap);
  addNPC();
}, 33);// だいたい30FPS

function NPCMoveDecision(NPCMap) {
  for (let [NPCId, NPCObj] of NPCMap) {

    switch (NPCObj.level) {
      case 1: // 標準
        if (Math.floor(Math.random() * 60) === 1) {
          NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
        }
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 90) === 0) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
      case 2: // あまり方向転換をしない代わりに、ミサイルを手に入れたらすぐ放つ
        if (Math.floor(Math.random() * 180) === 1) {
          NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
        }
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 15) === 0) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
      case 3:// 頻繁に方向転換をし、ミサイルもそこそこの頻度で放つ
        if (Math.floor(Math.random() * 5) === 1) {
          NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
        }
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 45) === 0) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
    }
  }
}

function newConnection(socketId, displayName, thumbUrl) {
  const playerX = Math.floor(Math.random() * gameObj.fieldWidth);
  const playerY = Math.floor(Math.random() * gameObj.fieldHeight);
  const playerId = crypto.createHash('sha1').update(socketId).digest('hex');

  const playerObj = {
    x: playerX,
    y: playerY,
    playerId: playerId,
    displayName: displayName,
    thumbUrl: thumbUrl,
    isAlive: true,
    direction: 'right',
    missilesMany: 0,
    airTime: 99,
    aliveTime: { 'clock': 0, 'seconds': 0 },
    deadCount: 0,
    score: 0
  };
  gameObj.playersMap.set(socketId, playerObj);

  const startObj = {
    playerObj: playerObj,
    fieldWidth: gameObj.fieldWidth,
    fieldHeight: gameObj.fieldHeight,
    missileSpeed: gameObj.missileSpeed
  };
  return startObj;
}

function getMapData() {
  const playersArray = [];
  const itemsArray = [];
  const airArray = [];
  const flyingMissilesArray = [];
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));

  for (let [socketId, player] of playersAndNPCMap) {
    const playerDataForSend = [];

    playerDataForSend.push(player.x);
    playerDataForSend.push(player.y);
    playerDataForSend.push(player.playerId);
    playerDataForSend.push(player.displayName);
    playerDataForSend.push(player.score);
    playerDataForSend.push(player.isAlive);
    playerDataForSend.push(player.direction);
    playerDataForSend.push(player.missilesMany);
    playerDataForSend.push(player.airTime);
    playerDataForSend.push(player.deadCount);
    playerDataForSend.push(player.thumbUrl);

    playersArray.push(playerDataForSend);
  }

  for (let [id, item] of gameObj.itemsMap) {
    const itemDataForSend = [];

    itemDataForSend.push(item.x);
    itemDataForSend.push(item.y);

    itemsArray.push(itemDataForSend);
  }

  for (let [id, air] of gameObj.airMap) {
    const airDataForSend = [];

    airDataForSend.push(air.x);
    airDataForSend.push(air.y);

    airArray.push(airDataForSend);
  }

  for (let [id, flyingMissile] of gameObj.flyingMissilesMap) {
    const flyingMissileDataForSend = [];
    
    flyingMissileDataForSend.push(id);
    flyingMissileDataForSend.push(flyingMissile.x);
    flyingMissileDataForSend.push(flyingMissile.y);
    flyingMissileDataForSend.push(flyingMissile.direction);
    flyingMissileDataForSend.push(flyingMissile.emitPlayerId);
    flyingMissileDataForSend.push(flyingMissile.interceptedMissileId);
    flyingMissileDataForSend.push(flyingMissile.deadCount);

    flyingMissilesArray.push(flyingMissileDataForSend);
  }

  return [playersArray, itemsArray, airArray, flyingMissilesArray];// 処理を軽くするため、オブジェクトをすべて配列に変換して送る
}

function updatePlayerDirection(socketId, direction) {
  const playerObj = gameObj.playersMap.get(socketId);
  playerObj.direction = direction;
}

function missileEmit(socketId, direction) {
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  if (!playersAndNPCMap.has(socketId)) return;

  let emitPlayerObj = playersAndNPCMap.get(socketId);

  if (emitPlayerObj.missilesMany <= 0) return;
  if (!emitPlayerObj.isAlive) return;

  emitPlayerObj.missilesMany -= 1;
  const missileId = `${crypto.randomBytes(8).toString('hex')},${socketId},${emitPlayerObj.x},${emitPlayerObj.y}`;

  const missileObj = {
    emitPlayerId: emitPlayerObj.playerId,
    emitPlayerSocketId: socketId,
    x: emitPlayerObj.x,
    y: emitPlayerObj.y,
    aliveFlame: gameObj.missileAliveFlame,
    direction: direction,
    id: missileId,
    interceptedMissileId: null,
    deadCount: 0,
  };
  gameObj.flyingMissilesMap.set(missileId, missileObj);
}

function disconnect(socketId) {
  gameObj.playersMap.delete(socketId);
}

function addItem() {
  const itemX = Math.floor(Math.random() * gameObj.fieldWidth);
  const itemY = Math.floor(Math.random() * gameObj.fieldHeight);
  const itemKey = `${itemX},${itemY}`;

  if (gameObj.itemsMap.has(itemKey)) {
    return addItem();
  }

  const itemObj = {
    x: itemX,
    y: itemY
  };
  gameObj.itemsMap.set(itemKey, itemObj);
}

function addAir() {
  const airX = Math.floor(Math.random() * gameObj.fieldWidth);
  const airY = Math.floor(Math.random() * gameObj.fieldHeight);
  const airKey = `${airX},${airY}`;

  if (gameObj.airMap.has(airKey)) { // アイテムの位置が被ってしまった場合は
    return addAir(); // 別の位置に置くまで作り直し
  }

  const airObj = {
    x: airX,
    y: airY,
  };
  gameObj.airMap.set(airKey, airObj);
}

function movePlayers(playersMap) {
  for (let [playerId, player] of playersMap) {

    if (!player.isAlive) {
      if (player.deadCount < 130) {
        player.deadCount += 2;
      } else {
        gameObj.playersMap.delete(playerId);
        gameObj.NPCMap.delete(playerId);
      }
      continue;
    }

    switch (player.direction) {
      case 'left':
        player.x -= 1;
        break;
      case 'up':
        player.y -= 1;
        break;
      case 'down':
        player.y += 1;
        break;
      case 'right':
        player.x += 1;
        break;
    }
    if (player.x > gameObj.fieldWidth) player.x -= gameObj.fieldWidth;// 右端より右に行ったら、左端に座標を移動する
    if (player.x < 0) player.x += gameObj.fieldWidth;// 左端より左に行ったら、右端に座標を移動する。以下同様。
    if (player.y < 0) player.y += gameObj.fieldHeight;
    if (player.y > gameObj.fieldHeight) player.y -= gameObj.fieldHeight;

    player.aliveTime.clock += 1;
    if (player.aliveTime.clock === 30) {
      player.aliveTime.clock = 0;
      player.aliveTime.seconds += 1;// 約990ミリ秒（1秒）生き残ったら、プラス1する
      decreaseAir(player);// 約990ミリ秒（1秒）生き残ったら、残酸素数を1減らす
      player.score += 1;
    }
  }
}

function moveMissile(flyingMissilesMap) { // ミサイルの移動
  for (let [missileId, flyingMissile] of flyingMissilesMap) {

    if (missileId === flyingMissile.interceptedMissileId) {// 迎撃されていたら
      if (flyingMissile.deadCount < 70) {
        flyingMissile.deadCount += 2;// 爆発の描画に必要なカウンターを更新
      } else {
        flyingMissilesMap.delete(missileId);
      }
      continue;
    }

    if (flyingMissile.aliveFlame === 0) {
      flyingMissilesMap.delete(missileId);
      continue;
    }

    flyingMissile.aliveFlame -= 1;

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

function decreaseAir(playerObj) {
  playerObj.airTime -= 1;
  if (playerObj.airTime === 0) {
    playerObj.isAlive = false;
  }
}

function checkGetItem(playersMap, itemsMap, airMap, flyingMissilesMap) {
  for (let [hashKey, playerObj] of playersMap) {
    if (!playerObj.isAlive) continue;

    // アイテムの魚雷（赤色）
    for (let [itemKey, itemObj] of itemsMap) {

      const distanceObj = calculationBetweenTwoPoints(
        playerObj.x, playerObj.y, itemObj.x, itemObj.y, gameObj.fieldWidth, gameObj.fieldHeight
      );

      if (
        distanceObj.distanceX <= (gameObj.submarineImageWidth / 2 + gameObj.itemRadius) &&
        distanceObj.distanceY <= (gameObj.submarineImageWidth / 2 + gameObj.itemRadius)
      ) {

        gameObj.itemsMap.delete(itemKey);
        playerObj.missilesMany = playerObj.missilesMany > 5 ? 6 : playerObj.missilesMany + 1;
        playerObj.score += gameObj.itemPoint;
        addItem();
      }
    }

    // アイテムの空気（青色）
    for (let [airKey, airObj] of airMap) {

      const distanceObj = calculationBetweenTwoPoints(
        playerObj.x, playerObj.y, airObj.x, airObj.y, gameObj.fieldWidth, gameObj.fieldHeight
      );

      if (
        distanceObj.distanceX <= (gameObj.submarineImageWidth / 2 + gameObj.airRadius) &&
        distanceObj.distanceY <= (gameObj.submarineImageWidth / 2 + gameObj.airRadius)
      ) {

        gameObj.airMap.delete(airKey);
        if (playerObj.airTime + gameObj.addAirTime > 99) {
          playerObj.airTime = 99;
        } else {
          playerObj.airTime += gameObj.addAirTime;
        }
        playerObj.score += gameObj.itemPoint;
        addAir();
      }
    }

    // 撃ち放たれているミサイル
    for (let [missileId, flyingMissile] of flyingMissilesMap) {

      const distanceObj = calculationBetweenTwoPoints(
        playerObj.x, playerObj.y, flyingMissile.x, flyingMissile.y, gameObj.fieldWidth, gameObj.fieldHeight
      );

      if (
        distanceObj.distanceX <= (gameObj.submarineImageWidth / 2 + gameObj.missileWidth / 2) &&
        distanceObj.distanceY <= (gameObj.submarineImageWidth / 2 + gameObj.missileHeight / 2) &&
        playerObj.playerId !== flyingMissile.emitPlayerId &&
        missileId !== flyingMissile.interceptedMissileId// プレイヤーとミサイルが当たっていてかつ自分のミサイルでなく、迎撃されていないミサイルなら
      ) {
        playerObj.isAlive = false;
        // 得点の更新
        if (playersMap.has(flyingMissile.emitPlayerSocketId)) {
          const emitPlayer = playersMap.get(flyingMissile.emitPlayerSocketId);
          emitPlayer.score += gameObj.killPoint;
          playersMap.set(flyingMissile.emitPlayerSocketId, emitPlayer)
        }
        flyingMissilesMap.delete(missileId);
      }

      for (let [anotherMissileId, anotherFlyingMissile] of flyingMissilesMap) {
        if (missileId !== anotherMissileId) {
          const distanceObj = calculationBetweenTwoPoints(
            flyingMissile.x, flyingMissile.y, anotherFlyingMissile.x, anotherFlyingMissile.y,
            gameObj.fieldWidth, gameObj.fieldHeight
          );

          if (
            distanceObj.distanceX <= gameObj.missileWidth &&
            distanceObj.distanceY <= gameObj.missileHeight &&// ミサイル同士が当たっていてかつ、
            flyingMissile.emitPlayerId !== anotherFlyingMissile.emitPlayerId &&// 2つのミサイルが同じ人の放ったミサイルではなく、
            missileId !== flyingMissile.interceptedMissileId &&
            anotherMissileId !== anotherFlyingMissile.interceptedMissileId// 両方のミサイルがともに迎撃されていないなら
          ) {
            flyingMissile.interceptedMissileId = missileId;
            anotherFlyingMissile.interceptedMissileId = anotherMissileId;// 迎撃されたミサイルにidを代入
          }
        }
        continue;
      }
    }
  }
}

function addNPC() {
  if (gameObj.addingNPCPlayerNum === 0) return;
  if (gameObj.playersMap.size + gameObj.NPCMap.size <= gameObj.addingNPCPlayerNum) {
    const addMany = gameObj.addingNPCPlayerNum - gameObj.playersMap.size - gameObj.NPCMap.size + 1;

    for (let i = 0; i < addMany; i++) {

      const playerX = Math.floor(Math.random() * gameObj.fieldWidth);
      const playerY = Math.floor(Math.random() * gameObj.fieldHeight);
      const level = Math.floor(Math.random() * 1) + 1;
      const id = Math.floor(Math.random() * 100000) + ',' + playerX + ',' + playerY + ',' + level;
      const playerObj = {
        x: playerX,
        y: playerY,
        isAlive: true,
        deadCount: 0,
        direction: 'right',
        missilesMany: 0,
        airTime: 99,
        aliveTime: { 'clock': 0, 'seconds': 0 },
        score: 0,
        level: level,
        displayName: 'NPC',
        thumbUrl: 'images/user-icons/npc.PNG',
        playerId: id
      };
      gameObj.NPCMap.set(id, playerObj);
    }
  }
}

function calculationBetweenTwoPoints(pX, pY, oX, oY, gameWidth, gameHeight) {
  let distanceX = 99999999;
  let distanceY = 99999999;

  if (pX <= oX) {
    // 右から
    distanceX = oX - pX;
    // 左から
    let tmpDistance = pX + gameWidth - oX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
    }

  } else {
    // 右から
    distanceX = pX - oX;
    // 左から
    let tmpDistance = oX + gameWidth - pX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
    }
  }

  if (pY <= oY) {
    // 下から
    distanceY = oY - pY;
    // 上から
    let tmpDistance = pY + gameHeight - oY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
    }

  } else {
    // 上から
    distanceY = pY - oY;
    // 下から
    let tmpDistance = oY + gameHeight - pY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
    }
  }

  return {
    distanceX,
    distanceY
  };
}
module.exports = {
  newConnection,
  getMapData,
  updatePlayerDirection,
  missileEmit,
  disconnect
};