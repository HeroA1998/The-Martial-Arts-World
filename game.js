// 大江湖 · 第 1 步：可走動的小鎮（Phaser 3）
'use strict';

const MAP_W = 820, MAP_H = 660;
const SPEED = 115;      // 世界單位 / 秒
const HERO_H = 46;      // 主角在世界中的高度
const JOY_R = 60;       // 搖桿半徑（螢幕像素）
const WALK_FRAME_MS = 150;   // 走路動畫每幀的長度（毫秒，全速時）
const ACCEL_MS = 100;   // 起步約這麼久加到全速
const DECEL_MS = 120;   // 放手後約這麼久停下來
const JOY_DEAD = 6;     // 死區：拖不到這個距離不動
const JOY_FULL = 34;    // 拖到這個距離就是全速

// 戰鬥
const VERSION = 'v0.7.8';   // 每次更新請加一
const BTN_R = 42;           // 攻擊鍵半徑（螢幕像素）
const ATK_CD = 680;         // 兩次攻擊的最短間隔（毫秒）
const ATK_SWING = 360;      // 揮劍動作本身的長度
const ATK_DUR = 580;        // 揮劍總長度（揮完後還有硬直，期間不能移動與出招）
const ATK_HIT_FROM = 150, ATK_HIT_TO = 320;   // 動作中可以打到人的時間窗
const ATK_ROLL_CANCEL = 60;                  // 揮劍幾毫秒後就能用翻滾取消（越小越跟手）
const LOCK_RANGE = 80;      // 揮劍時自動鎖定這個距離內最近的目標
const ATK_REACH = 22;       // 劍的判定圈中心離身體多遠
const ATK_RADIUS = 26;      // 劍的判定圈半徑
const ATK_MOVE_MUL = 0;     // 揮劍時完全不能移動（只能用翻滾閃避）
// 翻滾攻擊：翻滾無敵結束後立刻按攻擊，出一刀較短較快的反擊
const QATK_COST = 16;
const QATK_SWING = 220, QATK_DUR = 380;
const QATK_HIT_FROM = 60, QATK_HIT_TO = 190;
const PLAYER_DMG_MIN = 10, PLAYER_DMG_RNG = 5;   // 傷害 10~14
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 木人樁（底部中心座標）
const DUMMIES = [
  { x: 240, y: 335 },
  { x: 580, y: 335 },
  { x: 410, y: 470 },
];
const DUMMY_HP = 60;

// 玩家
const PLAYER_HP = 100;
const INVULN_MS = 500;        // 被打中後的無敵時間
const PLAYER_KNOCK = 150;     // 被擊退的速度
const PLAYER_KNOCK_MS = 130;
const PLAYER_RESPAWN_MS = 2000;

// 耐力與翻滾（魂系核心：每個動作都要付出代價）
const STAM_MAX = 100;
const STAM_REGEN = 36;          // 每秒回復
const STAM_DELAY = 750;         // 用完耐力後多久才開始回復
const STAM_DELAY_EMPTY = 1300;  // 耐力見底時要等更久
const ATK_COST = 22;
// 黑魂式翻滾：固定短距離、方向鎖定、先快後慢、前段無敵、後段收招有破綻
const ROLL_COST = 26;
const ROLL_DUR = 520;           // 翻滾總長度（含收招）
const ROLL_MOVE = 380;          // 位移時間：速度由快漸慢，之後原地站穩
const ROLL_DIST = 58;           // 位移距離（約 1.3 個身位）
const ROLL_I_FROM = 30, ROLL_I_TO = 300;   // 無敵時間窗
// 沒推搖桿時的小退步：更短、更便宜
const BACK_COST = 18;
const BACK_DUR = 430, BACK_MOVE = 300, BACK_DIST = 34;
const BACK_I_FROM = 20, BACK_I_TO = 210;
const DG_R = 34;                // 閃避鍵半徑（螢幕像素）

// 敵人出生點與種類：左邊只有一個山賊頭目（武將），右邊是一群小兵與精兵
const ENEMY_SPAWNS = [
  { type: 'bandit', x: 170, y: 480 },
  { type: 'turban', x: 600, y: 310 }, { type: 'turban', x: 640, y: 335 },
  { type: 'turban', x: 600, y: 355 }, { type: 'turban', x: 680, y: 320 },
  { type: 'turban', x: 700, y: 355 }, { type: 'turban', x: 660, y: 300 },
  { type: 'hansoldier', x: 720, y: 305 }, { type: 'hansoldier', x: 570, y: 335 },
];

// 所有敵人共用同一套戰鬥規則，強弱只靠這張數值表決定（新增敵人填一行即可）
const ENEMY_TYPES = {
  bandit: {
    tex: 'bandit',            // 貼圖前綴：bandit_up / bandit_down / bandit_side_k
    name: '山賊頭目', showName: true,   // 武將：常駐名字與血條
    shadowColor: 0x000000,
    walkBright: { side: 0.87, front: 0.92, back: 0.94 },   // 走路圖亮度校正（與靜止圖一致）
    h: Math.round(HERO_H * 1.15),   // 武將放大約 15%
    hp: 50,
    speed: 82,
    aggro: 120,               // 玩家進入這個距離就會追
    lose: 260,                // 玩家跑超過這個距離就放棄
    range: 56,                // 這個距離內開始蓄力出刀
    stalkDist: 105,           // 進入這個距離先停下來盯著你繞步
    orbitR: 100,              // 輪不到進攻時在這個距離外繞圈等
    attackSlots: 1,           // 同時進攻的人數上限
    atkGap: 600,              // 一個敵人出完招後，其他人至少隔這麼久才能出手
    // 衝刺（紅線預告）
    windup: 800, windupFast: 820, aimLock: 220, strike: 200, hitAt: 130, lunge: 280, recover: 1300,
    dmgLunge: 22,
    // 普通揮砍（原地起手、不衝刺）
    slashWindup: 550, slashWindupFast: 400, slashAimLock: 150, slashStrike: 180, slashHitAt: 60,
    slashRecover: 900, slashReach: 18, slashR: 28, dmgSlash: 12,
    // 選招機率
    pSlashClose: 0.7, pLungeClose: 0.1,   // 貼身：揮砍 70%、衝刺 10%、其餘只繞步
    pLungeMid: 0.4,                        // 中距離：衝刺 40%，其餘走近再揮砍
    pCombo: 0.3,                           // 揮砍連揮兩下的機率
    rest: 1200,                            // 破綻結束後繞步的時間
    // 防禦與閃避
    reactRange: 90, reactCdMs: 2500, pGuard: 0.30, pDodge: 0.20, dodgeCdMs: 3000,
    guardDur: 700, guardDmgMul: 0.15, guardBreakHits: 3, guardBreakStun: 900, dodgeCounterWindup: 480,
    // 架勢與受擊
    poise: 36, stun: 600, knock: 120,
    respawnMs: 6000,
  },
};
// 小兵（黃巾軍）：血少、慢、很少防禦；可多人同時進攻
ENEMY_TYPES.turban = Object.assign({}, ENEMY_TYPES.bandit, {
  walkTex: 'turban', walkBright: { side: 1, front: 1, back: 1 },   // 黃巾走路圖（Codex 生成）
  name: '黃巾', showName: false, shadowColor: 0x000000,
  h: Math.round(HERO_H * 0.9),   // 小兵縮小約 10%
  hp: 12, speed: 50, aggro: 70, lose: 140, stalkDist: 0, orbitR: 90,
  attackSlots: 2, atkGap: 400,
  slashWindup: 900, slashWindupFast: 650, slashRecover: 1000, rest: 1800, dmgSlash: 4,
  fleeOnHit: false,          // 不退縮：被打中後照樣回來
  pSlashClose: 0.85, pLungeClose: 0, pLungeMid: 0, pCombo: 0.1,
  pGuard: 0.03, pDodge: 0, reactCdMs: 4000,
  poise: 10, stun: 500, knock: 140, respawnMs: 20000,
});
// 精兵（官軍）：血量中等，會用衝刺，偶爾防禦或閃避
ENEMY_TYPES.hansoldier = Object.assign({}, ENEMY_TYPES.bandit, {
  walkTex: 'hansoldier', walkBright: { side: 1, front: 1, back: 1 },   // 官軍走路圖（Codex 生成）
  name: '官軍', showName: false, shadowColor: 0x000000,
  h: HERO_H,   // 與主角等高
  hp: 28, speed: 78, aggro: 140, lose: 300, stalkDist: 90,
  attackSlots: 2, atkGap: 400,
  dmgLunge: 16, dmgSlash: 9, rest: 1400,
  pSlashClose: 0.65, pLungeClose: 0.1, pLungeMid: 0.25,
  pGuard: 0.15, pDodge: 0.08,
  poise: 28, stun: 500, respawnMs: 15000,
});
const REACT_DELAY = 100;      // 防禦/閃避生效前的小動作（提示）
const GUARD_FRONT = 0.3;      // 攻擊來自防禦方向的內積門檻，側面與背後擋不到
const DODGE_DUR = 220, DODGE_DIST = 36;

// 小鎮配置：x、y 為底部中心；w 為顯示寬度
const PROPS = [
  { kind: 'house', x: 300, y: 255, w: 110 },
  { kind: 'house', x: 520, y: 255, w: 110 },
  { kind: 'house', x: 300, y: 610, w: 110 },
  { kind: 'house', x: 520, y: 610, w: 110 },
  { kind: 'tree', x: 90,  y: 130, w: 95 },
  { kind: 'tree', x: 730, y: 120, w: 95 },
  { kind: 'tree', x: 90,  y: 520, w: 90 },
  { kind: 'tree', x: 740, y: 540, w: 95 },
  { kind: 'tree', x: 300, y: 70,  w: 85 },
  { kind: 'tree', x: 520, y: 80,  w: 85 },
  { kind: 'tree', x: 330, y: 650, w: 85 },
  { kind: 'tree', x: 520, y: 690, w: 80 },
];

// 去掉洋紅背景（#FF00FF）並裁切到圖案範圍，回傳 canvas
function keyAndTrim(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (p[i] > 180 && p[i + 1] < 110 && p[i + 2] > 180) {
        p[i + 3] = 0;
      } else {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  g.putImageData(d, 0, 0);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return out;
}

// 動畫橫排圖：去洋紅背景，所有幀用同一個裁切框（保持幀與幀之間的位置一致）
function keyAndTrimFrames(img, n, bright = 1) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const cw = Math.floor(c.width / n);
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < cw * n; x++) {
      const i = (y * c.width + x) * 4;
      if (p[i] > 180 && p[i + 1] < 110 && p[i + 2] > 180) { p[i + 3] = 0; continue; }
      p[i] *= bright; p[i + 1] *= bright; p[i + 2] *= bright;   // 調整亮度，與靜止圖一致
      const lx = x % cw;
      if (lx < minX) minX = lx; if (lx > maxX) maxX = lx;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  g.putImageData(d, 0, 0);
  const w = maxX - minX + 1, h = maxY - minY + 1, out = [];
  for (let f = 0; f < n; f++) {
    const o = document.createElement('canvas');
    o.width = w; o.height = h;
    o.getContext('2d').drawImage(c, f * cw + minX, minY, w, h, 0, 0, w, h);
    out.push(o);
  }
  return out;
}

class VillageScene extends Phaser.Scene {
  constructor() { super('village'); }

  preload() {
    const A = 'assets/';
    this.load.image('hero_front', A + 'characters/hero_front.png');
    this.load.image('hero_back', A + 'characters/hero_back.png');
    this.load.image('hero_side', A + 'characters/hero_side.png');
    this.load.image('hero_walk_side', A + 'characters/hero_walk_side.png');
    this.load.image('hero_walk_front', A + 'characters/hero_walk_front.png');
    this.load.image('hero_walk_back', A + 'characters/hero_walk_back.png');
    this.load.image('bandit_walk_side', A + 'characters/bandit_walk_side.png');
    this.load.image('bandit_walk_front', A + 'characters/bandit_walk_front.png');
    this.load.image('bandit_walk_back', A + 'characters/bandit_walk_back.png');
    this.load.image('turban_walk_side', A + 'characters/turban_walk_side.png');
    this.load.image('turban_walk_front', A + 'characters/turban_walk_front.png');
    this.load.image('turban_walk_back', A + 'characters/turban_walk_back.png');
    this.load.image('hansoldier_walk_side', A + 'characters/hansoldier_walk_side.png');
    this.load.image('hansoldier_walk_front', A + 'characters/hansoldier_walk_front.png');
    this.load.image('hansoldier_walk_back', A + 'characters/hansoldier_walk_back.png');
    this.load.image('bandit_front', A + 'characters/bandit_front.png');
    this.load.image('bandit_back', A + 'characters/bandit_back.png');
    this.load.image('bandit_side', A + 'characters/bandit_side.png');
    this.load.image('stone', A + 'tiles/stone_floor.png');
    this.load.image('house', A + 'buildings/house_01.png');
    this.load.image('tree', A + 'props/tree_01.png');
  }

  create() {
    // 去背素材
    this.keyTex('hero_front', 'hero_down');
    this.keyTex('hero_back', 'hero_up');
    this.keyTex('hero_side', 'hero_side_k');
    // 側面走路動畫：4 幀
    keyAndTrimFrames(this.textures.get('hero_walk_side').getSourceImage(), 4, 0.85)
      .forEach((cv, i) => this.textures.addCanvas('hero_walk_side_' + i, cv));
    keyAndTrimFrames(this.textures.get('hero_walk_front').getSourceImage(), 4, 0.85)
      .forEach((cv, i) => this.textures.addCanvas('hero_walk_front_' + i, cv));
    keyAndTrimFrames(this.textures.get('hero_walk_back').getSourceImage(), 4, 0.94)
      .forEach((cv, i) => this.textures.addCanvas('hero_walk_back_' + i, cv));
    // 敵人走路動畫：依數值表的 tex 前綴建立 <tex>_walk_<side|front|back>_<0..3>
    for (const T of Object.values(ENEMY_TYPES)) {
      const wk = T.walkTex || T.tex;
      if (!T.walkBright || this.textures.exists(wk + '_walk_side_0')) continue;
      for (const dir of ['side', 'front', 'back']) {
        keyAndTrimFrames(this.textures.get(wk + '_walk_' + dir).getSourceImage(), 4, T.walkBright[dir])
          .forEach((cv, i) => this.textures.addCanvas(wk + '_walk_' + dir + '_' + i, cv));
      }
    }
    this.keyTex('bandit_front', 'bandit_down');
    this.keyTex('bandit_back', 'bandit_up');
    this.keyTex('bandit_side', 'bandit_side_k');
    this.keyTex('house', 'house_k');
    this.keyTex('tree', 'tree_k');

    this.world = [];   // 世界物件，會被鏡頭看到
    this.ui = [];      // 螢幕固定物件

    // 地面
    this.world.push(this.add.rectangle(0, 0, MAP_W, MAP_H, 0x33442f).setOrigin(0).setDepth(-20));
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 420; i++) {
      const r = 2 + rnd() * 4;
      this.world.push(this.add.rectangle(rnd() * MAP_W, rnd() * MAP_H, r, r * 0.6, 0x2a3828, 0.5 + rnd() * 0.4).setDepth(-19));
    }
    // 石板路（十字）
    for (const [x, y, w, h] of [[0, 280, MAP_W, 90], [360, 0, 100, MAP_H]]) {
      const ts = this.add.tileSprite(x, y, w, h, 'stone').setOrigin(0).setDepth(-15);
      ts.tileScaleX = 0.16; ts.tileScaleY = 0.16;
      this.world.push(ts);
    }

    // 建築與大樹：障礙、陰影、排序
    this.obstacles = this.physics.add.staticGroup();
    for (const p of PROPS) {
      const isHouse = p.kind === 'house';
      const key = isHouse ? 'house_k' : 'tree_k';
      const tex = this.textures.get(key).getSourceImage();
      const h = p.w * tex.height / tex.width;

      this.world.push(this.add.ellipse(p.x, p.y, p.w * 0.85, p.w * 0.36, 0x000000, 0.28).setDepth(-10));
      this.world.push(this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDisplaySize(p.w, h).setDepth(p.y));

      // 碰撞框：房屋取底部 30%，大樹取樹幹基部
      const rect = isHouse
        ? { x0: p.x - p.w * 0.45, x1: p.x + p.w * 0.45, y0: p.y - h * 0.30, y1: p.y }
        : { x0: p.x - p.w * 0.07, x1: p.x + p.w * 0.07, y0: p.y - p.w * 0.10, y1: p.y };
      const z = this.add.zone((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2,
                              rect.x1 - rect.x0, rect.y1 - rect.y0);
      this.physics.add.existing(z, true);
      this.obstacles.add(z);
    }

    // 木人樁：練習目標，可被打、可擋路
    this.makeDummyTexture();
    this.dummies = [];
    for (const d of DUMMIES) {
      const shadow = this.add.ellipse(d.x, d.y, 30, 10, 0x000000, 0.28).setDepth(-10);
      const sprite = this.add.image(d.x, d.y, 'dummy').setOrigin(0.5, 1).setDepth(d.y);
      const z = this.add.zone(d.x, d.y - 4, 14, 8);
      this.physics.add.existing(z, true);
      this.obstacles.add(z);
      this.world.push(shadow, sprite);
      this.dummies.push({ x: d.x, y: d.y, sprite, hp: DUMMY_HP, dead: false });
    }

    // 主角：物理碰撞用的腳底框（看不見），圖片跟著它走
    this.playerBody = this.add.zone(410, 330, 14, 8);
    this.physics.add.existing(this.playerBody);
    this.playerBody.body.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.physics.add.collider(this.playerBody, this.obstacles);

    this.heroShadow = this.add.ellipse(0, 0, 40, 12, 0x000000, 0.28).setDepth(-10);
    this.hero = this.add.image(0, 0, 'hero_down').setOrigin(0.5, 1).setDepth(0);
    this.facing = 'down';
    this.walk = 0; this.walkT = 0;
    this.setHeroTexture('hero_down');
    this.world.push(this.heroShadow, this.hero);

    // 玩家狀態
    this.php = PLAYER_HP;
    this.invulnUntil = 0;
    this.mv = { x: 0, y: 0 };               // 目前的走路速度（有慣性）
    this.pk = { vx: 0, vy: 0, until: 0 };   // 被擊退
    this.heroFlashUntil = 0;
    this.down = false;
    this.respawnAt = 0;

    // 山賊：追擊、出刀、受傷、倒下、重生
    this.bandits = [];
    for (const h of ENEMY_SPAWNS) {
      const T = ENEMY_TYPES[h.type];
      const shadow = this.add.ellipse(h.x, h.y, 42, 12, T.shadowColor, 0.28).setDepth(-10);
      const sprite = this.add.image(h.x, h.y, T.tex + '_down').setOrigin(0.5, 1).setDepth(h.y);
      const alert = this.add.text(h.x, h.y - T.h - 4, '!', {
        fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold',
        color: '#ff7a5a', stroke: '#000000', strokeThickness: 3, resolution: 3,
      }).setOrigin(0.5, 1).setDepth(8000).setVisible(false);
      const nameTag = this.add.text(h.x, h.y - T.h - 16, T.name || '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: '#f0e6c8', stroke: '#000000', strokeThickness: 3, resolution: 3,
      }).setOrigin(0.5, 1).setDepth(8000).setVisible(!!T.showName);
      const body = this.add.zone(h.x, h.y - 4, 14, 8);
      this.physics.add.existing(body);
      body.body.setImmovable(true);
      body.body.setCollideWorldBounds(true);
      this.physics.add.collider(body, this.obstacles);
      this.physics.add.collider(this.playerBody, body);
      this.world.push(shadow, sprite, alert, nameTag);
      this.setSpriteTex(sprite, T.tex + '_down', T.h);
      this.bandits.push({
        home: { x: h.x, y: h.y }, body, sprite, shadow, alert,
        t: T, nameTag, hp: T.hp, state: 'idle', facing: 'down', dead: false,
        t0: 0, until: 0, kx: 0, ky: 0, flashUntil: 0,
        strikeAt: -1e9, did: false, adx: 0, ady: 1, respawnAt: 0,
        poise: T.poise, lastHit: 0, windup: T.windup, combo: 0,
        reactCd: 0, dodgeCd: 0, guardHits: 0, gdx: 0, gdy: 1,
      });
    }
    for (let i = 0; i < this.bandits.length; i++) {
      for (let j = i + 1; j < this.bandits.length; j++) {
        this.physics.add.collider(this.bandits[i].body, this.bandits[j].body);
      }
    }
    this.enemyGfx = this.add.graphics().setDepth(5000);
    this.laneGfx = this.add.graphics().setDepth(-5);     // 山賊衝刺路線預告（畫在地上）
    this.world.push(this.enemyGfx, this.laneGfx);

    // 戰鬥特效用的繪圖層（劍光、血條）
    this.slashGfx = this.add.graphics().setDepth(5000);
    this.barGfx = this.add.graphics().setDepth(6000);
    this.world.push(this.slashGfx, this.barGfx);
    this.atk = null;          // 目前的揮劍：{ start, dx, dy, hit:Set }
    this.lastAtk = -1e9;
    this.btn = { id: null, held: false };
    this.vt = 0; this.realT = 0; this.hitstopUntil = 0;   // 遊戲時間（打擊停頓時不前進）
    this.btn2 = { id: null };              // 閃避鍵
    this.stam = STAM_MAX; this.stamRegenAt = 0; this.stamFlash = 0;
    this.roll = null;                      // 翻滾中：{ start, dx, dy, lastGhost }
    this.rollIFrom = 0; this.rollIUntil = 0;   // 翻滾無敵的時間窗
    this.atkBuf = 0;                       // 攻擊輸入緩衝（翻滾或揮劍中按下，時機到了自動出招）
    this.rollBuf = 0;                      // 翻滾輸入緩衝（揮劍中按了，收招後自動接上）

    // 鏡頭
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W, MAP_H);
    cam.setBackgroundColor('#16201a');
    cam.startFollow(this.playerBody, true, 0.22, 0.22);
    this.applyZoom();

    // 螢幕固定的 UI 用另一個鏡頭，避免被縮放
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.joyGfx = this.add.graphics().setDepth(1000);
    this.btnGfx = this.add.graphics().setDepth(1000);
    this.btnText = this.add.text(0, 0, '攻', {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#e6f0dc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1001);
    this.dgGfx = this.add.graphics().setDepth(1000);
    this.dgText = this.add.text(0, 0, '閃', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#e6f0dc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1001);
    this.hpGfx = this.add.graphics().setDepth(1000);
    this.hpText = this.add.text(130, 12, '氣血', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#e6f0dc',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(1001);
    this.downText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, '倒下了…', {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#e8c8b8',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(1002).setVisible(false);
    this.hintText = this.add.text(this.scale.width / 2, 52, '左半邊拖曳移動 · 右下「攻」揮劍 · 「閃」翻滾（前段無敵）\n翻滾後立刻按「攻」＝翻滾攻擊\n電腦：WASD 移動、空白鍵攻擊、Shift 翻滾', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#d8e0cf',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(1001);
    this.verText = this.add.text(this.scale.width - 6, 6, VERSION, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#d8e0cf', alpha: 0.6,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(1001);
    this.ui.push(this.joyGfx, this.btnGfx, this.btnText, this.hintText, this.verText,
                 this.hpGfx, this.hpText, this.downText, this.dgGfx, this.dgText);
    this.hintTimer = this.time.delayedCall(6000, () => this.hintText.setVisible(false));

    cam.ignore(this.ui);
    this.uiCam.ignore(this.world);

    // 輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, x: 0, y: 0, active: false };
    this.input.addPointer(2);   // 允許左手搖桿、右手攻擊同時按
    this.atkKeys = this.input.keyboard.addKeys('SPACE,J');
    this.input.keyboard.on('keydown-SPACE', () => this.pressAttack());
    this.input.keyboard.on('keydown-J', () => this.pressAttack());
    const dodgeKey = () => { const t = this.nowT || 0; if (!this.tryRoll(t)) this.rollBuf = t + 400; };
    this.input.keyboard.on('keydown-SHIFT', dodgeKey);
    this.input.keyboard.on('keydown-K', dodgeKey);
    this.input.on('pointerdown', p => {
      const dg = this.dodgePos();
      if (this.btn2.id === null && Math.hypot(p.x - dg.x, p.y - dg.y) <= DG_R * 1.4) {
        this.btn2.id = p.id;
        dodgeKey();
        return;
      }
      const b = this.btnPos();
      if (this.btn.id === null && Math.hypot(p.x - b.x, p.y - b.y) <= BTN_R * 1.4) {
        this.btn.id = p.id; this.btn.held = true;
        this.pressAttack();   // 按下當下就出招，輕點也不會漏
        return;
      }
      if (this.joy.id === null && p.x < this.scale.width * 0.5) {
        this.joy.id = p.id; this.joy.active = true;
        this.joy.ox = p.x; this.joy.oy = p.y;
        this.setJoy(p);
      }
    });
    this.input.on('pointermove', p => { if (p.id === this.joy.id) this.setJoy(p); });
    const endJoy = p => {
      if (p.id === this.btn.id) { this.btn.id = null; this.btn.held = false; return; }
      if (p.id === this.btn2.id) { this.btn2.id = null; return; }
      if (p.id !== this.joy.id) return;
      this.joy.id = null; this.joy.active = false;
      this.joy.x = 0; this.joy.y = 0; this.joy.dx = 0; this.joy.dy = 0;
    };
    this.input.on('pointerup', endJoy);
    this.input.on('pointerupoutside', endJoy);

    this.scale.on('resize', () => {
      this.uiCam.setSize(this.scale.width, this.scale.height);
      this.applyZoom();
      this.hintText.setX(this.scale.width / 2);
      this.verText.setX(this.scale.width - 6);
      this.downText.setPosition(this.scale.width / 2, this.scale.height / 2 - 40);
    });
  }

  // 把去背後的素材存成新的貼圖
  keyTex(srcKey, newKey) {
    const src = this.textures.get(srcKey).getSourceImage();
    this.textures.addCanvas(newKey, keyAndTrim(src));
  }

  setHeroTexture(key) {
    const tex = this.textures.get(key).getSourceImage();
    this.hero.setTexture(key);
    this.hero.setDisplaySize(HERO_H * tex.width / tex.height, HERO_H);
    this.heroSx = this.hero.scaleX; this.heroSy = this.hero.scaleY;
  }

  applyZoom() {
    // 視野約寬 230、高 460（世界單位）：拉近，上下也會跟著移動
    const z = Math.max(1.0, Math.min(2.2, Math.min(this.scale.width / 230, this.scale.height / 460)));
    this.cameras.main.setZoom(z);
  }

  setJoy(p) {
    const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy;
    const m = Math.hypot(dx, dy), k = m > JOY_R ? JOY_R / m : 1;
    this.joy.dx = dx * k; this.joy.dy = dy * k;       // 畫面上搖桿頭的位置
    // 速度：小死區之後很快加到全速，輕輕一拖就起步
    const mag = Math.max(0, Math.min(1, (m - JOY_DEAD) / (JOY_FULL - JOY_DEAD)));
    const ux = m > 0 ? dx / m : 0, uy = m > 0 ? dy / m : 0;
    this.joy.x = ux * mag; this.joy.y = uy * mag;
  }

  readInput() {
    const c = this.cursors, w = this.wasd;
    let x = 0, y = 0;
    if (c.left.isDown || w.A.isDown) x -= 1;
    if (c.right.isDown || w.D.isDown) x += 1;
    if (c.up.isDown || w.W.isDown) y -= 1;
    if (c.down.isDown || w.S.isDown) y += 1;
    if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.hypot(x, y) };
  }

  update(realTime, delta) {
    this.realT = realTime;
    if (realTime < this.hitstopUntil) {   // 打擊停頓：全場凍結一瞬間，動作計時也一起停
      this.playerBody.body.setVelocity(0, 0);
      for (const b of this.bandits) b.body.body.setVelocity(0, 0);
      return;
    }
    this.vt += delta;
    const time = this.vt;
    this.nowT = time;
    const { x, y, m } = this.down ? { x: 0, y: 0, m: 0 } : this.readInput();

    // 出招：按住攻擊鍵或空白鍵會連續出招，但受冷卻限制
    if (!this.down && (this.btn.held || this.atkKeys.SPACE.isDown || this.atkKeys.J.isDown)) this.tryAttack(time);
    if (this.atkBuf > time && this.tryAttack(time)) this.atkBuf = 0;
    if (this.atk && time - this.atk.start > this.atk.dur) this.atk = null;

    // 耐力回復（翻滾中不回復）
    if (time >= this.stamRegenAt && !this.roll) this.stam = Math.min(STAM_MAX, this.stam + STAM_REGEN * delta / 1000);

    // 翻滾：緩衝輸入、結束判定
    if (!this.roll && this.rollBuf > time) this.tryRoll(time);
    if (this.roll && time - this.roll.start >= this.roll.dur) this.roll = null;

    if (time < this.pk.until) {          // 被擊退中：不受操作影響
      this.mv.x = 0; this.mv.y = 0;
      this.playerBody.body.setVelocity(this.pk.vx, this.pk.vy);
    } else if (this.roll) {              // 翻滾：方向鎖定，速度由快漸慢，之後原地收招
      this.mv.x = 0; this.mv.y = 0;
      const r = this.roll, rt = time - r.start;
      const v = rt < r.move ? r.v0 * (1 - rt / r.move) : 0;
      this.playerBody.body.setVelocity(r.dx * v, r.dy * v);
    } else {
      if (this.atk) {                    // 揮劍、硬直中不能移動
        this.mv.x = 0; this.mv.y = 0;
        this.playerBody.body.setVelocity(0, 0);
      } else {
        // 起步、停步、轉向都有一點慣性：速度朝目標速度逐步靠近
        const tx = x * SPEED, ty = y * SPEED;
        const rate = SPEED / ((m > 0.05 ? ACCEL_MS : DECEL_MS) / 1000);   // 每秒可改變的速度
        const dvx = tx - this.mv.x, dvy = ty - this.mv.y, dm = Math.hypot(dvx, dvy);
        const step = rate * delta / 1000;
        if (dm <= step) { this.mv.x = tx; this.mv.y = ty; }
        else { this.mv.x += dvx / dm * step; this.mv.y += dvy / dm * step; }
        this.playerBody.body.setVelocity(this.mv.x, this.mv.y);
      }
    }

    if (m > 0.05) {
      if (!this.atk && !this.roll) {   // 揮劍、翻滾中不改變朝向
        if (Math.abs(x) > Math.abs(y)) this.facing = x > 0 ? 'right' : 'left';
        else this.facing = y > 0 ? 'down' : 'up';
      }
      this.walk += delta / 80 * (0.5 + 0.5 * Math.min(1, Math.hypot(this.mv.x, this.mv.y) / SPEED));
    } else {
      this.walk = 0;
    }

    // 圖片跟著腳底框；朝向換貼圖
    const fx = this.playerBody.x, fy = this.playerBody.y + 4;
    const spd = Math.min(1, Math.hypot(this.mv.x, this.mv.y) / SPEED);
    const bob = spd > 0.1 ? Math.abs(Math.sin(this.walk * Math.PI)) * 1 * spd : 0;   // 踏步頓挫（走路圖本身已有起伏，這裡只加一點點）
    const side = this.facing === 'left' || this.facing === 'right';
    // 側面走路用 4 幀動畫（速度越快播得越快）；其他情況用靜止圖
    const walking = (side || this.facing === 'down' || this.facing === 'up') && spd > 0.1 && !this.atk && !this.roll && !this.down && time >= this.pk.until;
    if (walking) this.walkT = (this.walkT || 0) + delta * spd; else this.walkT = 0;
    const walkFrame = Math.floor(this.walkT / WALK_FRAME_MS) % 4;
    const key = this.facing === 'up' ? (walking ? 'hero_walk_back_' + walkFrame : 'hero_up')
              : walking && this.facing === 'down' ? 'hero_walk_front_' + walkFrame
              : walking ? 'hero_walk_side_' + walkFrame
              : side ? 'hero_side_k'
              : 'hero_down';
    if (this.hero.texture.key !== key) this.setHeroTexture(key);
    this.hero.setFlipX(this.facing === 'left');

    // 揮劍時身體往前頂一下
    let lx = 0, ly = 0;
    if (this.atk) {
      const t = (time - this.atk.start) / this.atk.dur;
      const lunge = Math.sin(Math.min(1, t * 1.6) * Math.PI) * 4;
      lx = this.atk.dx * lunge; ly = this.atk.dy * lunge * 0.6;
    }
    this.hero.setPosition(fx + lx, fy - bob + ly).setDepth(fy);
    // 翻滾：身體壓扁並留下殘影
    if (this.roll) {
      this.hero.setScale(this.heroSx * 1.1, this.heroSy * 0.72);
      if (time - this.roll.lastGhost > 55) {
        this.roll.lastGhost = time;
        const gh = this.add.image(fx, fy, this.hero.texture.key).setOrigin(0.5, 1)
          .setScale(this.heroSx * 1.1, this.heroSy * 0.72).setFlipX(this.facing === 'left')
          .setAlpha(0.4).setTint(0x9fc7b0).setDepth(fy - 1);
        this.uiCam.ignore(gh);
        this.tweens.add({ targets: gh, alpha: 0, duration: 260, onComplete: () => gh.destroy() });
      }
    } else {
      this.hero.setScale(this.heroSx, this.heroSy);
    }
    this.heroShadow.setPosition(fx, fy).setDisplaySize(HERO_H * 0.8, HERO_H * 0.22);

    // 受傷表現：閃紅、無敵時間內閃爍
    if (time < this.heroFlashUntil) this.hero.setTint(0xff7a6a); else this.hero.clearTint();
    this.hero.setAlpha(!this.down && time < this.invulnUntil && Math.floor(time / 80) % 2 ? 0.45 : 1);

    this.processAttack(time, fx, fy);
    this.updateBandits(time);
    if (this.down && time >= this.respawnAt) this.respawnPlayer(time);
    this.drawEnemyFx(time);
    this.drawSlash(time, fx, fy);
    this.drawBars();
    this.drawUI();
  }

  // ---------- 戰鬥 ----------
  // 按下攻擊：不能立刻出招時（翻滾無敵中、揮劍中）先記著，時機一到自動接上
  pressAttack() {
    const t = this.nowT || 0;
    if (!this.tryAttack(t) && !this.down && (this.roll || this.atk)) this.atkBuf = t + 350;
  }

  tryAttack(time) {
    if (this.down || this.atk) return false;
    let quick = false;
    if (this.roll) {
      if (time - this.roll.start < this.roll.iTo) return false;   // 翻滾無敵還沒結束
      quick = true;                                                // 翻滾攻擊
    } else if (time - this.lastAtk < ATK_CD) {
      return false;
    }
    if (this.stam <= 0) { this.stamFlash = time + 300; return false; }
    this.useStamina(quick ? QATK_COST : ATK_COST, time);
    this.lastAtk = quick ? time - (ATK_CD - QATK_DUR) : time;
    // 軟鎖定：附近有目標就自動轉向它，沒有才朝面對（或翻滾）的方向揮
    let dx, dy;
    const tg = this.pickTarget(LOCK_RANGE);
    if (tg) {
      const fx = this.playerBody.x, fy = this.playerBody.y + 4;
      const vx = tg.x - fx, vy = tg.y - fy, m = Math.hypot(vx, vy) || 1;
      dx = vx / m; dy = vy / m;
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    } else if (this.roll && !this.roll.back) {
      dx = this.roll.dx; dy = this.roll.dy;
    } else {
      [dx, dy] = DIRS[this.facing];
    }
    this.roll = null;
    this.atk = quick
      ? { start: time, dx, dy, hit: new Set(), quick, dur: QATK_DUR, swing: QATK_SWING, hitFrom: QATK_HIT_FROM, hitTo: QATK_HIT_TO }
      : { start: time, dx, dy, hit: new Set(), quick, dur: ATK_DUR, swing: ATK_SWING, hitFrom: ATK_HIT_FROM, hitTo: ATK_HIT_TO };
    this.banditReact(time);
    return true;
  }

  // 找距離內最近、還活著的目標（山賊或木人樁）
  pickTarget(range) {
    const fx = this.playerBody.x, fy = this.playerBody.y + 4;
    let best = null, bd = range;
    for (const b of this.bandits) {
      if (b.dead) continue;
      const d = Math.hypot(b.body.x - fx, b.body.y + 4 - fy);
      if (d < bd) { bd = d; best = { x: b.body.x, y: b.body.y + 4 }; }
    }
    for (const d of this.dummies) {
      if (d.dead) continue;
      const dd = Math.hypot(d.x - fx, d.y - fy);
      if (dd < bd) { bd = dd; best = { x: d.x, y: d.y }; }
    }
    return best;
  }

  // 打擊停頓：命中的瞬間凍結一下，打擊感的關鍵
  hitstop(ms) {
    this.hitstopUntil = Math.max(this.hitstopUntil, this.realT + ms);
  }

  useStamina(n, time) {
    this.stam = Math.max(0, this.stam - n);
    this.stamRegenAt = time + (this.stam <= 0 ? STAM_DELAY_EMPTY : STAM_DELAY);
  }

  // 翻滾：往搖桿方向；沒推搖桿就往後退。前段無敵，亂翻會耗光耐力
  tryRoll(time) {
    if (this.down || this.roll) return false;
    if (this.atk && time - this.atk.start < ATK_ROLL_CANCEL) return false;
    if (this.stam <= 0) { this.stamFlash = time + 300; return false; }
    const inp = this.readInput();
    const back = inp.m < 0.2;
    let dx = inp.x, dy = inp.y;
    if (back) { const f = DIRS[this.facing]; dx = -f[0]; dy = -f[1]; }
    const m = Math.hypot(dx, dy) || 1;
    dx /= m; dy /= m;
    this.atk = null;
    this.useStamina(back ? BACK_COST : ROLL_COST, time);
    const dur = back ? BACK_DUR : ROLL_DUR, move = back ? BACK_MOVE : ROLL_MOVE;
    const dist = back ? BACK_DIST : ROLL_DIST;
    const iFrom = back ? BACK_I_FROM : ROLL_I_FROM, iTo = back ? BACK_I_TO : ROLL_I_TO;
    // 速度由快漸慢（線性遞減），總位移 = v0 * move / 2 = dist
    this.roll = { start: time, dx, dy, back, dur, move, iTo, v0: 2 * dist / (move / 1000), lastGhost: -1e9 };
    this.rollIFrom = time + iFrom;
    this.rollIUntil = time + iTo;
    this.rollBuf = 0;
    if (inp.m >= 0.2) {
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    return true;
  }

  // 揮劍的有效時間窗內，判定圈碰到的木人樁會受傷（一次揮劍每個目標只打一次）
  processAttack(time, fx, fy) {
    if (!this.atk) return;
    const t = time - this.atk.start;
    if (t < this.atk.hitFrom || t > this.atk.hitTo) return;
    const cx = fx + this.atk.dx * ATK_REACH;
    const cy = fy - 14 + this.atk.dy * ATK_REACH;
    for (const d of this.dummies) {
      if (d.dead || this.atk.hit.has(d)) continue;
      if (Math.hypot(cx - d.x, cy - (d.y - 18)) < ATK_RADIUS + 11) {
        this.atk.hit.add(d);
        this.hitDummy(d, this.atk.dx, this.atk.dy);
      }
    }
    for (const b of this.bandits) {
      if (b.dead || this.atk.hit.has(b)) continue;
      const bx = b.body.x, by = b.body.y + 4;     // 山賊腳底
      if (Math.hypot(cx - bx, cy - (by - 20)) < ATK_RADIUS + 12) {
        this.atk.hit.add(b);
        const live = time >= b.t0 + REACT_DELAY;   // 提示動作之後，防禦/閃避才生效
        if (b.state === 'dodge' && live) {
          this.spawnDamage(bx, by - b.t.h - 4, '閃', '#bcd0e0');
        } else if (b.state === 'guard' && live && -this.atk.dx * b.gdx - this.atk.dy * b.gdy > GUARD_FRONT) {
          this.blockBandit(b, this.atk.dx, this.atk.dy, time);
        } else {
          this.hitBandit(b, this.atk.dx, this.atk.dy, time);
        }
      }
    }
  }

  // ---------- 山賊 ----------
  setSpriteTex(sprite, key, h) {
    const tex = this.textures.get(key).getSourceImage();
    sprite.setTexture(key);
    sprite.setDisplaySize(h * tex.width / tex.height, h);
  }

  updateBandits(time) {
    const px = this.playerBody.x, py = this.playerBody.y + 4;
    for (const b of this.bandits) {
      const bd = b.body.body;
      const bx = b.body.x, by = b.body.y + 4;
      const dx = px - bx, dy = py - by, dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const faceToward = () => {
        if (time - (b.faceT || 0) < 250) return;   // 朝向至少維持 250 毫秒
        const want = Math.abs(dx) > Math.abs(dy) * 1.25 ? (dx > 0 ? 'right' : 'left')
                   : Math.abs(dy) > Math.abs(dx) * 1.25 ? (dy > 0 ? 'down' : 'up') : b.facing;
        if (want !== b.facing) { b.facing = want; b.faceT = time; }
      };
      let vx = 0, vy = 0;

      if (b.state !== 'hurt' && b.poise < b.t.poise && time - b.lastHit > 2500) b.poise = b.t.poise;

      if (b.state === 'dead') {
        if (time >= b.respawnAt) this.reviveBandit(b);
      } else if (b.state === 'hurt') {
        vx = b.kx; vy = b.ky;
        if (time >= b.until) {
          b.poise = b.t.poise;
          if (this.down) b.state = 'idle';
          else b.state = 'chase';
        }
      } else if (b.state === 'flee') {
        // 怕你：背對你快步後退，退夠了才繞步觀望
        if (this.down || dist > b.t.lose) b.state = 'idle';
        else {
          vx = -ux * b.t.speed * 1.3; vy = -uy * b.t.speed * 1.3;
          b.facing = Math.abs(ux) > Math.abs(uy) ? (ux > 0 ? 'left' : 'right') : (uy > 0 ? 'up' : 'down');
          if (time - b.t0 >= b.fleeFor) { b.state = 'rest'; b.t0 = time; b.orbitDir = Math.random() < 0.5 ? 1 : -1; b.stalked = true; }
        }
      } else if (b.state === 'idle') {
        if (!this.down && dist < b.t.aggro) { b.state = 'chase'; b.stalked = false; b.closeIn = false; b.nextKind = null; }
      } else if (b.state === 'chase') {
        if (this.down || dist > b.t.lose) {
          b.state = 'idle';
        } else {
          faceToward();
          const busy = !this.tokenFree(b);
          if (busy && dist < b.t.orbitR + 20) {
            // 同伴正在進攻：我在外圈繞著等，輪到我才上
            [vx, vy] = this.orbit(b, ux, uy, dist, b.t.orbitR, b.t.speed * 0.6);
          } else if (!b.stalked && dist < b.t.stalkDist && dist > b.t.range) {
            // 逼近後先停下來盯著你繞步，不直接衝上來
            b.state = 'stalk'; b.t0 = time; b.stalkFor = 700 + Math.random() * 700;
            b.orbitDir = Math.random() < 0.5 ? 1 : -1;
          } else if (dist > (b.closeIn ? 38 : b.t.range)) {
            vx = ux * b.t.speed; vy = uy * b.t.speed;
          } else {
            // 選招：貼身多半普通揮砍，偶爾衝刺或只是繞步；中距離才常用衝刺拉近
            let kind = b.nextKind; b.nextKind = null;
            if (!kind) {
              const r = Math.random();
              kind = dist <= 40 ? (r < b.t.pSlashClose ? 'slash' : r < b.t.pSlashClose + b.t.pLungeClose ? 'lunge' : 'feint') : (r < b.t.pLungeMid ? 'lunge' : 'slash');
            }
            b.closeIn = false;
            if (kind === 'feint') {
              b.state = 'rest'; b.t0 = time; b.stalked = true; b.orbitDir = Math.random() < 0.5 ? 1 : -1;
            } else if (kind === 'slash' && dist > 40) {
              b.nextKind = 'slash'; b.closeIn = true;      // 先走近再揮
            } else {
              // 先頓一下（長度不固定）才蓄力，沒辦法靠節奏背時機
              b.kind = kind; b.state = 'pause'; b.t0 = time; b.pauseFor = 60 + Math.random() * 420;
            }
          }
        }
      } else if (b.state === 'guard') {
        // 舉手防禦：原地不動，面向鎖定的方向
        b.facing = Math.abs(b.gdx) > Math.abs(b.gdy) ? (b.gdx > 0 ? 'right' : 'left') : (b.gdy > 0 ? 'down' : 'up');
        if (this.down) b.state = 'idle';
        else if (time >= b.until) { b.state = 'chase'; b.stalked = true; }
      } else if (b.state === 'dodge') {
        // 先有一小段提示動作，再往後一躍（躍的期間無敵）；閃完立刻反擊
        faceToward();
        const dt = time - b.t0;
        if (dt >= REACT_DELAY) { const sp = DODGE_DIST / (DODGE_DUR / 1000); vx = b.gdx * sp; vy = b.gdy * sp; }
        if (time >= b.until) {
          if (this.down) b.state = 'idle';
          else { this.startWindup(b, time, true, ux, uy, 'lunge'); b.windup = b.t.dodgeCounterWindup; }
        }
      } else if (b.state === 'stalk') {
        faceToward();
        if (this.down || dist > b.t.lose) b.state = 'idle';
        else if (dist <= b.t.range || time - b.t0 >= b.stalkFor) { b.state = 'chase'; b.stalked = true; }
        else [vx, vy] = this.orbit(b, ux, uy, dist, 88, b.t.speed * 0.5);
      } else if (b.state === 'pause') {
        faceToward();
        if (this.down || dist > b.t.lose) b.state = 'idle';
        else if (dist > b.t.range + 14) b.state = 'chase';
        else if (!this.tokenFree(b)) [vx, vy] = this.orbit(b, ux, uy, dist, b.t.orbitR, b.t.speed * 0.6);
        else if (time - b.t0 >= b.pauseFor) this.startWindup(b, time, false, ux, uy, b.kind);
      } else if (b.state === 'windup') {
        // 蓄力：持續瞄準玩家，出刀前最後一小段鎖定方向，之後朝鎖定方向衝出去
        const wt = time - b.t0;
        if (wt < b.windup - (b.kind === 'slash' ? b.t.slashAimLock : b.t.aimLock)) { b.adx = ux; b.ady = uy; }
        b.facing = Math.abs(b.adx) > Math.abs(b.ady) ? (b.adx > 0 ? 'right' : 'left') : (b.ady > 0 ? 'down' : 'up');
        if (wt >= b.windup) { b.state = 'strike'; b.t0 = time; b.strikeAt = time; b.did = false; }
      } else if (b.state === 'strike') {
        const slash = b.kind === 'slash';
        if (slash) { if (time - b.t0 < 80) { vx = b.adx * 40; vy = b.ady * 40; } }   // 普通揮砍：只踏半步
        else { vx = b.adx * b.t.lunge; vy = b.ady * b.t.lunge; }
        if (!b.did && time - b.t0 >= (slash ? b.t.slashHitAt : b.t.hitAt)) {
          const off = slash ? b.t.slashReach : 14;
          const cx = bx + b.adx * off, cy = by - 14 + b.ady * off;
          if (Math.hypot(cx - px, cy - (py - 14)) < (slash ? b.t.slashR : 29)
              && this.hurtPlayer(slash ? b.t.dmgSlash : b.t.dmgLunge, bx, by, time)) b.did = true;
        }
        if (time - b.t0 >= (slash ? b.t.slashStrike : b.t.strike)) {
          if (b.combo > 0 && !this.down) { b.combo--; this.startWindup(b, time, true, ux, uy); }
          else { b.state = 'recover'; b.t0 = time; }
        }
      } else if (b.state === 'recover') {
        if (time - b.t0 >= (b.kind === 'slash' ? b.t.slashRecover : b.t.recover)) {
          if (this.down) b.state = 'idle';
          else { this.atkGapUntil = time + b.t.atkGap; b.state = 'rest'; b.t0 = time; b.orbitDir = Math.random() < 0.5 ? 1 : -1; }
        }
      } else if (b.state === 'rest') {
        // 喘息：出完刀後繞著玩家走，給雙方空檔；不佔用進攻名額
        faceToward();
        if (this.down || dist > b.t.lose) b.state = 'idle';
        else {
          [vx, vy] = this.orbit(b, ux, uy, dist, 72, b.t.speed * 0.55);
          if (time - b.t0 >= b.t.rest) { b.state = 'chase'; b.stalked = true; }
        }
      }

      bd.setVelocity(vx, vy);

      // 圖片、陰影、驚嘆號
      if (b.state !== 'dead' || b.sprite.alpha > 0) {
        // 移動中（追、繞、逼近）播走路動畫；蓄力、出刀、防禦等維持原本姿勢
        const wdt = time - (b.lastT === undefined ? time : b.lastT); b.lastT = time;
        const sp = Math.hypot(vx, vy);
        const walkable = b.state === 'chase' || b.state === 'stalk' || b.state === 'rest' || b.state === 'pause' || b.state === 'flee';
        if (!walkable) b.moveOn = false;
        else if (sp > 8) b.moveOn = true;
        else if (sp < 3) b.moveOn = false;
        const moving = !!b.moveOn;
        if (moving) b.walkT = (b.walkT || 0) + wdt * Math.max(0.5, Math.min(1, sp / b.t.speed));
        const wf = Math.floor(b.walkT / WALK_FRAME_MS) % 4;
        const wdir = b.facing === 'up' ? 'back' : (b.facing === 'left' || b.facing === 'right') ? 'side' : 'front';
        const key = moving ? (b.t.walkTex || b.t.tex) + '_walk_' + wdir + '_' + wf
                  : b.facing === 'up' ? b.t.tex + '_up'
                  : (b.facing === 'left' || b.facing === 'right') ? b.t.tex + '_side_k'
                  : b.t.tex + '_down';
        if (b.sprite.texture.key !== key) this.setSpriteTex(b.sprite, key, b.t.h);
        b.sprite.setFlipX(b.facing === 'left');

        let ox = 0, oy = 0;
        const [fdx, fdy] = DIRS[b.facing];
        if (b.state === 'windup') {                       // 蓄力：身體微微後仰
          const k = Math.min(1, (time - b.t0) / b.windup);
          ox = -fdx * 3 * k; oy = -fdy * 2 * k;
        } else if (b.state === 'strike') {                // 出刀：往前一頂
          ox = b.adx * 6; oy = b.ady * 4;
        }
        if (b.state !== 'dead') b.sprite.setPosition(bx + ox, by + oy).setDepth(by);
        b.shadow.setPosition(bx, by);
        b.shadow.setAlpha(b.state === 'dead' ? 0 : 1);

        if (b.state === 'dead') b.sprite.clearTint();
        else if (b.state === 'recover' && time - b.t0 < 160) b.sprite.setTintFill(0xffffff);   // 破綻提示：白光一閃
        else if ((b.state === 'guard' || b.state === 'dodge') && time - b.t0 < REACT_DELAY) b.sprite.setTintFill(0xffffff);   // 反應前的提示
        else if (b.state === 'guard') b.sprite.setTint(0x9fb8d8);
        else if (time < b.flashUntil) b.sprite.setTint(0xff9a8a);
        else if (b.state === 'windup' && Math.floor(time / 70) % 2) b.sprite.setTint(0xffd27a);
        else if (b.t.tint) b.sprite.setTint(b.t.tint);   // 種類色調（暫代用）
        else b.sprite.clearTint();

        if (b.state !== 'dead') b.sprite.setAlpha(b.state === 'dodge' && time - b.t0 >= REACT_DELAY ? 0.45 : 1);
        b.alert.setVisible(b.state === 'windup' && b.kind === 'lunge').setPosition(bx, by - b.t.h - 2);
        b.nameTag.setVisible(!b.dead && b.t.showName).setPosition(bx, by - b.t.h - 16);
      }
    }
  }

  // 一次只讓一個山賊進攻（蓄力、出刀、破綻都算進攻中）
  tokenFree(b) {
    if ((this.nowT || 0) < (this.atkGapUntil || 0)) return false;
    const n = this.bandits.filter(o => o !== b && (o.state === 'windup' || o.state === 'strike' || o.state === 'recover')).length;
    return n < b.t.attackSlots;
  }

  // 繞著玩家走：切線方向 + 保持在指定距離
  orbit(b, ux, uy, dist, r, spd) {
    if (!b.orbitDir) b.orbitDir = Math.random() < 0.5 ? 1 : -1;
    const tx = -uy * b.orbitDir, ty = ux * b.orbitDir;
    const rad = Math.max(-1, Math.min(1, (dist - r) / 30));
    let vx = tx * spd * 0.8 + ux * spd * rad, vy = ty * spd * 0.8 + uy * spd * rad;
    const m = Math.hypot(vx, vy);
    if (m > spd) { vx *= spd / m; vy *= spd / m; }
    return [vx, vy];
  }

  startWindup(b, time, fast, ux, uy, kind) {
    b.state = 'windup'; b.t0 = time;
    if (kind) b.kind = kind;
    if (!b.kind) b.kind = 'lunge';
    if (b.kind === 'slash') {
      b.windup = fast ? b.t.slashWindupFast : b.t.slashWindup;
      if (!fast) b.combo = Math.random() < b.t.pCombo ? 1 : 0;       // 偶爾連揮兩下
    } else {
      b.windup = fast ? b.t.windupFast : b.t.windup;
      b.combo = 0;                                             // 衝刺不連擊
    }
    b.adx = ux; b.ady = uy;
  }

  hitBandit(b, dx, dy, time) {
    const dmg = PLAYER_DMG_MIN + Math.floor(Math.random() * PLAYER_DMG_RNG);
    b.hp -= dmg;
    b.lastHit = time;
    this.hitstop(b.hp <= 0 ? 170 : 105);
    this.spawnDamage(b.body.x, b.body.y - b.t.h - 4, dmg);
    b.flashUntil = time + 110;
    if (b.hp <= 0) { this.killBandit(b, dx, time); return; }
    if (b.state === 'guard') { b.state = 'chase'; b.stalked = true; }   // 從側面被打中，防禦解除
    this.cameras.main.shake(90, 0.003);
    // 架勢值：連續被打才會破勢；破勢之前他不會被打斷，仍會出刀
    b.poise -= dmg;
    if (b.poise <= 0) {
      b.state = 'hurt'; b.until = time + b.t.stun;
      const m = Math.hypot(dx, dy) || 1;
      b.kx = dx / m * b.t.knock; b.ky = dy / m * b.t.knock;
      this.spawnDamage(b.body.x, b.body.y - b.t.h - 18, '破勢', '#9fd8ff');
    }
  }

  // 玩家出刀的當下，附近沒在進攻的山賊有機會舉手防禦或往後閃
  banditReact(time) {
    const px = this.playerBody.x, py = this.playerBody.y + 4;
    for (const b of this.bandits) {
      if (b.dead || time < b.reactCd) continue;
      if (!(b.state === 'chase' || b.state === 'stalk' || b.state === 'rest' || b.state === 'pause')) continue;
      const dx = px - b.body.x, dy = py - (b.body.y + 4), d = Math.hypot(dx, dy) || 1;
      if (d > b.t.reactRange) continue;
      const r = Math.random();
      if (r < b.t.pGuard) {
        b.state = 'guard'; b.t0 = time; b.until = time + b.t.guardDur; b.guardHits = 0;
        b.gdx = dx / d; b.gdy = dy / d; b.reactCd = time + b.t.reactCdMs;
      } else if (r < b.t.pGuard + b.t.pDodge && time >= b.dodgeCd) {
        b.state = 'dodge'; b.t0 = time; b.until = time + REACT_DELAY + DODGE_DUR;
        b.gdx = -dx / d; b.gdy = -dy / d;          // 往離開玩家的方向閃
        b.reactCd = time + b.t.reactCdMs; b.dodgeCd = time + b.t.dodgeCdMs;
      }
    }
  }

  // 防禦擋住一下：傷害很少、玩家被彈開；擋滿三下破防
  blockBandit(b, dx, dy, time) {
    const dmg = Math.max(1, Math.round((PLAYER_DMG_MIN + Math.floor(Math.random() * PLAYER_DMG_RNG)) * b.t.guardDmgMul));
    b.hp = Math.max(1, b.hp - dmg);
    b.guardHits++;
    this.hitstop(70);
    this.cameras.main.shake(60, 0.002);
    this.spawnDamage(b.body.x, b.body.y - b.t.h - 4, '擋 ' + dmg, '#bcd0e0');
    this.pk = { vx: -dx * 120, vy: -dy * 120, until: time + 110 };
    if (b.guardHits >= b.t.guardBreakHits) {
      b.state = 'hurt'; b.until = time + b.t.guardBreakStun;
      b.kx = dx * 25; b.ky = dy * 25;
      this.hitstop(130);
      this.spawnDamage(b.body.x, b.body.y - b.t.h - 18, '破防', '#9fd8ff');
    }
  }

  killBandit(b, dx, time) {
    for (const o of this.bandits) {   // 身邊同伴倒下，膽小的敵人嚇得後退
      // 不再因同伴倒下而退縮
    }
    b.state = 'dead'; b.dead = true;
    b.body.body.setVelocity(0, 0);
    b.body.body.enable = false;
    b.alert.setVisible(false); b.nameTag.setVisible(false);
    b.respawnAt = time + b.t.respawnMs;
    const dir = dx >= 0 ? 1 : -1;
    this.tweens.add({ targets: b.sprite, angle: dir * 85, duration: 280, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: b.sprite, alpha: 0, delay: 2600, duration: 900 });
  }

  reviveBandit(b) {
    this.tweens.killTweensOf(b.sprite);
    b.body.body.reset(b.home.x, b.home.y - 4);
    b.body.body.enable = true;
    b.sprite.setAngle(0).setAlpha(1);
    b.hp = b.t.hp; b.dead = false; b.state = 'idle'; b.facing = 'down';
    b.sprite.setPosition(b.home.x, b.home.y);
  }

  // ---------- 玩家受傷與倒下 ----------
  hurtPlayer(dmg, sx, sy, time) {
    if (this.down || time < this.invulnUntil || (time >= this.rollIFrom && time < this.rollIUntil)) return false;
    this.php = Math.max(0, this.php - dmg);
    this.roll = null;
    this.invulnUntil = time + INVULN_MS;
    this.heroFlashUntil = time + 140;
    this.atk = null;                                  // 被打中會打斷自己的揮劍
    const px = this.playerBody.x, py = this.playerBody.y + 4;
    const m = Math.hypot(px - sx, py - sy) || 1;
    this.pk = { vx: (px - sx) / m * PLAYER_KNOCK, vy: (py - sy) / m * PLAYER_KNOCK, until: time + PLAYER_KNOCK_MS };
    this.spawnDamage(px, py - HERO_H - 4, dmg, '#ff9a8a');
    this.hitstop(120);
    this.cameras.main.shake(130, 0.006);
    if (this.php <= 0) {
      this.down = true;
      this.respawnAt = time + PLAYER_RESPAWN_MS;
      this.hero.setAngle(this.facing === 'left' ? -85 : 85);
      this.downText.setVisible(true);
    }
    return true;
  }

  respawnPlayer(time) {
    this.down = false;
    this.php = PLAYER_HP;
    this.invulnUntil = time + 1500;
    this.stam = STAM_MAX; this.roll = null;
    this.hero.setAngle(0);
    this.downText.setVisible(false);
    this.playerBody.body.reset(410, 330);
    for (const b of this.bandits) {
      if (!b.dead) { b.state = 'idle'; b.hp = b.t.hp; }
    }
  }

  // 山賊出刀的紅色劍光
  drawEnemyFx(time) {
    const g = this.enemyGfx, lg = this.laneGfx;
    g.clear(); lg.clear();
    for (const b of this.bandits) {
      if (b.state === 'guard' && time - b.t0 >= REACT_DELAY) {
        const gx = b.body.x + b.gdx * 12, gy = b.body.y - 12 + b.gdy * 8, mid = Math.atan2(b.gdy, b.gdx);
        g.setDepth(b.body.y + 5);
        g.lineStyle(4, 0xbcd0e0, 0.9);
        g.beginPath(); g.arc(gx, gy, 16, mid - 0.95, mid + 0.95, false); g.strokePath();
      }
      // 蓄力時在地上畫出衝刺路線；最後一小段鎖定後變白，這時才是翻滾的時機
      if (b.state === 'windup' && b.kind === 'lunge') {
        const wt = time - b.t0, k = Math.min(1, wt / b.windup);
        const locked = wt >= b.windup - b.t.aimLock;
        const len = b.t.lunge * b.t.strike / 1000 + 14 + 22;
        const bx0 = b.body.x, by0 = b.body.y + 2, hw = 9;
        const nx = -b.ady, ny = b.adx;
        const x1 = bx0 + b.adx * len, y1 = by0 + b.ady * len;
        lg.fillStyle(locked ? 0xffffff : 0xe8604a, locked ? 0.45 : 0.10 + 0.22 * k);
        lg.fillPoints([
          { x: bx0 + nx * hw, y: by0 + ny * hw }, { x: x1 + nx * hw, y: y1 + ny * hw },
          { x: x1 - nx * hw, y: y1 - ny * hw }, { x: bx0 - nx * hw, y: by0 - ny * hw },
        ], true);
      }
      const t = (time - b.strikeAt) / 240;
      if (b.dead || t < 0 || t > 1) continue;
      const bx = b.body.x, by = b.body.y + 4;
      const mid = Math.atan2(b.ady, b.adx), span = 2.2, startA = mid - span / 2;
      const p = Math.min(1, t / 0.5);
      const curA = startA + span * (1 - (1 - p) * (1 - p));
      const cx = bx + b.adx * 6, cy = by - 14 + b.ady * 6, r = 26;
      g.setDepth(by + 1);
      g.lineStyle(7, 0xe8a090, (1 - t) * 0.35);
      g.beginPath(); g.arc(cx, cy, r, startA, curA, false); g.strokePath();
      g.lineStyle(3, 0xffe2d8, 1 - t);
      g.beginPath(); g.arc(cx, cy, r, startA, curA, false); g.strokePath();
    }
  }

  hitDummy(d, dx, dy) {
    const dmg = PLAYER_DMG_MIN + Math.floor(Math.random() * PLAYER_DMG_RNG);
    d.hp -= dmg;
    this.hitstop(80);
    this.spawnDamage(d.x, d.y - 52, dmg);

    // 受擊：往後晃一下並閃紅
    this.tweens.add({ targets: d.sprite, x: d.x + dx * 3, duration: 50, yoyo: true });
    d.sprite.setTint(0xff9a8a);
    this.time.delayedCall(90, () => d.sprite.clearTint());

    if (d.hp <= 0) {
      d.dead = true;
      const dir = dx >= 0 ? 1 : -1;
      this.tweens.add({ targets: d.sprite, angle: dir * 85, duration: 260, ease: 'Quad.easeIn' });
      this.time.delayedCall(1800, () => {
        d.sprite.setAngle(0);
        d.hp = DUMMY_HP;
        d.dead = false;
      });
    }
  }

  spawnDamage(x, y, n, color = '#ffe9a8') {
    const t = this.add.text(x, y, String(n), {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold',
      color, stroke: '#000000', strokeThickness: 3, resolution: 3,
    }).setOrigin(0.5).setDepth(7000);
    this.uiCam.ignore(t);
    this.tweens.add({
      targets: t, y: y - 22, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // 劍光：沿面對的方向掃過一道弧線
  drawSlash(time, fx, fy) {
    const g = this.slashGfx;
    g.clear();
    if (!this.atk) return;
    const t = (time - this.atk.start) / this.atk.dur;
    if (t < 0 || t > 1) return;
    const { dx, dy } = this.atk;
    const mid = Math.atan2(dy, dx);
    const span = 2.4;
    const startA = mid - span / 2;
    const p = Math.min(1, t / 0.55);
    const curA = startA + span * (1 - (1 - p) * (1 - p));
    const cx = fx + dx * 6, cy = fy - 14 + dy * 6, r = ATK_REACH + 8;
    g.setDepth(this.facing === 'up' ? fy - 1 : fy + 1);
    g.lineStyle(8, 0xcfe8d8, (1 - t) * 0.35);
    g.beginPath(); g.arc(cx, cy, r, startA, curA, false); g.strokePath();
    g.lineStyle(3, 0xffffff, 1 - t);
    g.beginPath(); g.arc(cx, cy, r, startA, curA, false); g.strokePath();
  }

  drawBars() {
    const g = this.barGfx;
    g.clear();
    for (const d of this.dummies) {
      if (d.dead || d.hp >= DUMMY_HP) continue;
      const w = 24, x = d.x - w / 2, y = d.y - 60;
      g.fillStyle(0x000000, 0.6); g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0xc0503a, 1); g.fillRect(x, y, w * Math.max(0, d.hp) / DUMMY_HP, 3);
    }
    for (const b of this.bandits) {
      if (b.dead || (b.hp >= b.t.hp && !b.t.showName)) continue;   // 武將常駐血條
      const w = 28, x = b.body.x - w / 2, y = b.body.y + 4 - b.t.h - 10;
      g.fillStyle(0x000000, 0.6); g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0xc0503a, 1); g.fillRect(x, y, w * Math.max(0, b.hp) / b.t.hp, 3);
    }
  }

  btnPos() {
    return { x: this.scale.width - 70, y: this.scale.height - 110 };
  }

  dodgePos() {
    return { x: this.scale.width - 160, y: this.scale.height - 62 };
  }

  // 用程式畫一個低彩度像素風的木人樁
  makeDummyTexture() {
    const c = document.createElement('canvas');
    c.width = 28; c.height = 46;
    const g = c.getContext('2d');
    const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R('#2f322d', 6, 42, 16, 4); R('#4d514a', 7, 41, 14, 2);        // 石座
    R('#2a2018', 11, 10, 6, 32); R('#6b5238', 12, 10, 4, 32);      // 立柱
    R('#8a6b48', 12, 10, 1, 32);
    R('#2a2018', 3, 18, 22, 6); R('#6b5238', 4, 19, 20, 4);        // 橫木
    R('#8a6b48', 4, 19, 20, 1);
    R('#2a2018', 9, 1, 10, 10); R('#8b7a50', 10, 2, 8, 8);         // 草人頭
    R('#a8966a', 10, 2, 8, 2);
    R('#4a3a22', 10, 9, 8, 2);                                      // 繩結
    R('#9c8a56', 2, 24, 3, 4); R('#9c8a56', 23, 24, 3, 4);         // 草束
    this.textures.addCanvas('dummy', c);
    this.textures.get('dummy').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  drawUI() {
    // 玩家血條（左上角）
    const hg = this.hpGfx, hw = 110;
    hg.clear();
    hg.fillStyle(0x000000, 0.55); hg.fillRect(13, 13, hw + 2, 14);
    hg.fillStyle(0x4a2a24, 1); hg.fillRect(14, 14, hw, 12);
    hg.fillStyle(this.php / PLAYER_HP > 0.3 ? 0x7fae5a : 0xc0503a, 1);
    hg.fillRect(14, 14, hw * Math.max(0, this.php) / PLAYER_HP, 12);

    // 耐力條（血條下方）：見底時閃紅
    const nt = this.nowT || 0, sw = 90;
    hg.fillStyle(0x000000, 0.55); hg.fillRect(13, 29, sw + 2, 9);
    hg.fillStyle(0x3a3520, 1); hg.fillRect(14, 30, sw, 7);
    const flash = nt < this.stamFlash && Math.floor(nt / 80) % 2;
    hg.fillStyle(flash ? 0xc0503a : 0xd9b45a, 1);
    hg.fillRect(14, 30, sw * Math.max(0, this.stam) / STAM_MAX, 7);

    // 攻擊鍵
    const b = this.btnPos(), bg = this.btnGfx;
    bg.clear();
    bg.fillStyle(0x16201a, this.btn.held ? 0.7 : 0.45); bg.fillCircle(b.x, b.y, BTN_R);
    bg.lineStyle(3, 0xe6f0dc, this.btn.held ? 0.9 : 0.55); bg.strokeCircle(b.x, b.y, BTN_R);
    const left = Math.max(0, ATK_CD - ((this.nowT || 0) - this.lastAtk)) / ATK_CD;
    if (left > 0 && left <= 1) {
      bg.lineStyle(4, 0xd9b45a, 0.9);
      bg.beginPath();
      bg.arc(b.x, b.y, BTN_R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false);
      bg.strokePath();
    }
    this.btnText.setPosition(b.x, b.y);

    // 閃避鍵
    const dp = this.dodgePos(), dg = this.dgGfx;
    const rolling = !!this.roll, tired = this.stam <= 0;
    dg.clear();
    dg.fillStyle(0x16201a, rolling || this.btn2.id !== null ? 0.7 : 0.45); dg.fillCircle(dp.x, dp.y, DG_R);
    dg.lineStyle(3, tired ? 0xc0503a : 0xe6f0dc, rolling ? 0.95 : 0.55); dg.strokeCircle(dp.x, dp.y, DG_R);
    this.dgText.setPosition(dp.x, dp.y).setAlpha(tired ? 0.5 : 1);

    // 搖桿
    const g = this.joyGfx;
    g.clear();
    if (this.joy.active) {
      g.lineStyle(2, 0xe6f0dc, 0.5);
      g.strokeCircle(this.joy.ox, this.joy.oy, JOY_R);
      g.fillStyle(0xe6f0dc, 0.45);
      g.fillCircle(this.joy.ox + this.joy.dx, this.joy.oy + this.joy.dy, 22);
    } else {
      g.lineStyle(2, 0xe6f0dc, 0.18);
      g.strokeCircle(90, this.scale.height - 110, JOY_R);
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#16201a',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [VillageScene],
});
