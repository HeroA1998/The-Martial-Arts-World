// 大江湖 · 第 1 步：可走動的小鎮（Phaser 3）
'use strict';

const MAP_W = 820, MAP_H = 660;
const SPEED = 150;      // 世界單位 / 秒
const HERO_H = 46;      // 主角在世界中的高度
const JOY_R = 60;       // 搖桿半徑（螢幕像素）

// 戰鬥
const VERSION = 'v0.4.4';   // 每次更新請加一
const BTN_R = 42;           // 攻擊鍵半徑（螢幕像素）
const ATK_CD = 540;         // 兩次攻擊的最短間隔（毫秒）
const ATK_SWING = 300;      // 揮劍動作本身的長度
const ATK_DUR = 480;        // 揮劍總長度（揮完後還有硬直，期間不能移動與出招）
const ATK_HIT_FROM = 120, ATK_HIT_TO = 280;   // 動作中可以打到人的時間窗
const ATK_ROLL_CANCEL = 60;                  // 揮劍幾毫秒後就能用翻滾取消（越小越跟手）
const ATK_REACH = 22;       // 劍的判定圈中心離身體多遠
const ATK_RADIUS = 26;      // 劍的判定圈半徑
const ATK_MOVE_MUL = 0.4;   // 揮劍時移動速度倍率
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
const STAM_REGEN = 45;          // 每秒回復
const STAM_DELAY = 600;         // 用完耐力後多久才開始回復
const STAM_DELAY_EMPTY = 1100;  // 耐力見底時要等更久
const ATK_COST = 20;
const ROLL_COST = 24;
const ROLL_DUR = 480;           // 翻滾總長度
const ROLL_IFRAMES = 320;       // 翻滾前段無敵時間，之後是收招硬直
const ROLL_SPEED = 330;
const DG_R = 34;                // 閃避鍵半徑（螢幕像素）

// 山賊
const BANDITS = [
  { x: 650, y: 200 },
  { x: 170, y: 480 },
];
const BANDIT_H = HERO_H;      // 與主角等高
const BANDIT_HP = 70;
const BANDIT_SPEED = 95;
const BANDIT_AGGRO = 120;     // 玩家進入這個距離就會追
const BANDIT_LOSE = 260;      // 玩家跑超過這個距離就放棄
const BANDIT_RANGE = 56;      // 這個距離內開始蓄力出刀
const BANDIT_WINDUP = 650;    // 蓄力時間：看清楚、閃避的時機
const BANDIT_WINDUP_FAST = 700;   // 連擊第二刀的蓄力（節奏不同，亂翻會吃到）
const BANDIT_AIM_LOCK = 200;  // 出刀前最後這段時間鎖定方向
const BANDIT_STRIKE = 200;    // 出刀（衝刺）時間
const BANDIT_HIT_AT = 130;     // 出刀後幾毫秒才判定命中（留給你的反應時間）
const BANDIT_LUNGE = 280;     // 出刀時往前衝的速度
const BANDIT_RECOVER = 1300;  // 出完刀的破綻，是你反擊的機會
const BANDIT_COMBO_P = 0.2;    // 連擊兩刀的機率
const BANDIT_DMG = 16;
const BANDIT_POISE = 36;      // 架勢值：被打到會減少，歸零才會被打斷
const BANDIT_STUN = 600;      // 架勢被打破後的僵直
const BANDIT_KNOCK = 120;     // 被打破架勢時的後退速度
const BANDIT_RESPAWN_MS = 6000;

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

class VillageScene extends Phaser.Scene {
  constructor() { super('village'); }

  preload() {
    const A = 'assets/';
    this.load.image('hero_front', A + 'characters/hero_front.png');
    this.load.image('hero_back', A + 'characters/hero_back.png');
    this.load.image('hero_side', A + 'characters/hero_side.png');
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
    this.walk = 0;
    this.setHeroTexture('hero_down');
    this.world.push(this.heroShadow, this.hero);

    // 玩家狀態
    this.php = PLAYER_HP;
    this.invulnUntil = 0;
    this.pk = { vx: 0, vy: 0, until: 0 };   // 被擊退
    this.heroFlashUntil = 0;
    this.down = false;
    this.respawnAt = 0;

    // 山賊：追擊、出刀、受傷、倒下、重生
    this.bandits = [];
    for (const h of BANDITS) {
      const shadow = this.add.ellipse(h.x, h.y, 42, 12, 0x000000, 0.28).setDepth(-10);
      const sprite = this.add.image(h.x, h.y, 'bandit_down').setOrigin(0.5, 1).setDepth(h.y);
      const alert = this.add.text(h.x, h.y - BANDIT_H - 4, '!', {
        fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold',
        color: '#ff7a5a', stroke: '#000000', strokeThickness: 3, resolution: 3,
      }).setOrigin(0.5, 1).setDepth(8000).setVisible(false);
      const body = this.add.zone(h.x, h.y - 4, 14, 8);
      this.physics.add.existing(body);
      body.body.setImmovable(true);
      body.body.setCollideWorldBounds(true);
      this.physics.add.collider(body, this.obstacles);
      this.physics.add.collider(this.playerBody, body);
      this.world.push(shadow, sprite, alert);
      this.setSpriteTex(sprite, 'bandit_down', BANDIT_H);
      this.bandits.push({
        home: { x: h.x, y: h.y }, body, sprite, shadow, alert,
        hp: BANDIT_HP, state: 'idle', facing: 'down', dead: false,
        t0: 0, until: 0, kx: 0, ky: 0, flashUntil: 0,
        strikeAt: -1e9, did: false, adx: 0, ady: 1, respawnAt: 0,
        poise: BANDIT_POISE, lastHit: 0, windup: BANDIT_WINDUP, combo: 0,
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
    this.btn2 = { id: null };              // 閃避鍵
    this.stam = STAM_MAX; this.stamRegenAt = 0; this.stamFlash = 0;
    this.roll = null;                      // 翻滾中：{ start, dx, dy, lastGhost }
    this.rollIUntil = 0;                   // 翻滾無敵到什麼時候
    this.rollBuf = 0;                      // 翻滾輸入緩衝（揮劍中按了，收招後自動接上）

    // 鏡頭
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W, MAP_H);
    cam.setBackgroundColor('#16201a');
    cam.startFollow(this.playerBody, true, 0.12, 0.12);
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
    this.hintText = this.add.text(this.scale.width / 2, 52, '左半邊拖曳移動 · 右下「攻」揮劍 · 「閃」翻滾（無敵）\n電腦：WASD 移動、空白鍵攻擊、Shift 翻滾', {
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
    this.input.keyboard.on('keydown-SPACE', () => this.tryAttack(this.nowT || 0));
    this.input.keyboard.on('keydown-J', () => this.tryAttack(this.nowT || 0));
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
        this.tryAttack(this.nowT || 0);   // 按下當下就出招，輕點也不會漏
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
    const z = Math.max(1.0, Math.min(2.2, Math.min(this.scale.width / 330, this.scale.height / 480)));
    this.cameras.main.setZoom(z);
  }

  setJoy(p) {
    const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy;
    const m = Math.hypot(dx, dy), k = m > JOY_R ? JOY_R / m : 1;
    this.joy.dx = dx * k; this.joy.dy = dy * k;
    this.joy.x = this.joy.dx / JOY_R; this.joy.y = this.joy.dy / JOY_R;
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

  update(time, delta) {
    this.nowT = time;
    const { x, y, m } = this.down ? { x: 0, y: 0, m: 0 } : this.readInput();

    // 出招：按住攻擊鍵或空白鍵會連續出招，但受冷卻限制
    if (!this.down && (this.btn.held || this.atkKeys.SPACE.isDown || this.atkKeys.J.isDown)) this.tryAttack(time);
    if (this.atk && time - this.atk.start > ATK_DUR) this.atk = null;

    // 耐力回復（翻滾中不回復）
    if (time >= this.stamRegenAt && !this.roll) this.stam = Math.min(STAM_MAX, this.stam + STAM_REGEN * delta / 1000);

    // 翻滾：緩衝輸入、結束判定
    if (!this.roll && this.rollBuf > time) this.tryRoll(time);
    if (this.roll && time - this.roll.start >= ROLL_DUR) this.roll = null;

    if (time < this.pk.until) {          // 被擊退中：不受操作影響
      this.playerBody.body.setVelocity(this.pk.vx, this.pk.vy);
    } else if (this.roll) {              // 翻滾：前段快速位移，後段是收招的小滑行
      const f = time - this.roll.start < ROLL_IFRAMES ? 1 : 0.35;
      this.playerBody.body.setVelocity(this.roll.dx * ROLL_SPEED * f, this.roll.dy * ROLL_SPEED * f);
    } else {
      const stiff = this.atk && time - this.atk.start > ATK_SWING;   // 揮完刀的硬直
    const speed = stiff ? 0 : SPEED * (this.atk ? ATK_MOVE_MUL : 1);
      this.playerBody.body.setVelocity(x * speed, y * speed);
    }

    if (m > 0.05) {
      if (!this.atk && !this.roll) {   // 揮劍、翻滾中不改變朝向
        if (Math.abs(x) > Math.abs(y)) this.facing = x > 0 ? 'right' : 'left';
        else this.facing = y > 0 ? 'down' : 'up';
      }
      this.walk += delta / 80;
    } else {
      this.walk = 0;
    }

    // 圖片跟著腳底框；朝向換貼圖
    const fx = this.playerBody.x, fy = this.playerBody.y + 4;
    const bob = m > 0.05 ? Math.abs(Math.sin(this.walk * Math.PI)) * 1.5 : 0;
    const key = this.facing === 'up' ? 'hero_up'
              : (this.facing === 'left' || this.facing === 'right') ? 'hero_side_k'
              : 'hero_down';
    if (this.hero.texture.key !== key) this.setHeroTexture(key);
    this.hero.setFlipX(this.facing === 'left');

    // 揮劍時身體往前頂一下
    let lx = 0, ly = 0;
    if (this.atk) {
      const t = (time - this.atk.start) / ATK_DUR;
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
  tryAttack(time) {
    if (this.down || this.roll || this.atk || time - this.lastAtk < ATK_CD) return false;
    if (this.stam <= 0) { this.stamFlash = time + 300; return false; }
    this.useStamina(ATK_COST, time);
    this.lastAtk = time;
    const [dx, dy] = DIRS[this.facing];
    this.atk = { start: time, dx, dy, hit: new Set() };
    return true;
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
    let dx = inp.x, dy = inp.y;
    if (inp.m < 0.2) { const f = DIRS[this.facing]; dx = -f[0]; dy = -f[1]; }
    const m = Math.hypot(dx, dy) || 1;
    dx /= m; dy /= m;
    this.atk = null;
    this.useStamina(ROLL_COST, time);
    this.roll = { start: time, dx, dy, lastGhost: -1e9 };
    this.rollIUntil = time + ROLL_IFRAMES;
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
    if (t < ATK_HIT_FROM || t > ATK_HIT_TO) return;
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
        this.hitBandit(b, this.atk.dx, this.atk.dy, time);
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
        b.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      };
      let vx = 0, vy = 0;

      if (b.state !== 'hurt' && b.poise < BANDIT_POISE && time - b.lastHit > 2500) b.poise = BANDIT_POISE;

      if (b.state === 'dead') {
        if (time >= b.respawnAt) this.reviveBandit(b);
      } else if (b.state === 'hurt') {
        vx = b.kx; vy = b.ky;
        if (time >= b.until) { b.state = this.down ? 'idle' : 'chase'; b.poise = BANDIT_POISE; }
      } else if (b.state === 'idle') {
        if (!this.down && dist < BANDIT_AGGRO) b.state = 'chase';
      } else if (b.state === 'chase') {
        if (this.down || dist > BANDIT_LOSE) {
          b.state = 'idle';
        } else {
          faceToward();
          if (dist > BANDIT_RANGE) {
            vx = ux * BANDIT_SPEED; vy = uy * BANDIT_SPEED;
          } else {
            this.startWindup(b, time, false, ux, uy);
          }
        }
      } else if (b.state === 'windup') {
        // 蓄力：持續瞄準玩家，出刀前最後一小段鎖定方向，之後朝鎖定方向衝出去
        const wt = time - b.t0;
        if (wt < b.windup - BANDIT_AIM_LOCK) { b.adx = ux; b.ady = uy; }
        b.facing = Math.abs(b.adx) > Math.abs(b.ady) ? (b.adx > 0 ? 'right' : 'left') : (b.ady > 0 ? 'down' : 'up');
        if (wt >= b.windup) { b.state = 'strike'; b.t0 = time; b.strikeAt = time; b.did = false; }
      } else if (b.state === 'strike') {
        vx = b.adx * BANDIT_LUNGE; vy = b.ady * BANDIT_LUNGE;
        if (!b.did && time - b.t0 >= BANDIT_HIT_AT) {
          const cx = bx + b.adx * 14, cy = by - 14 + b.ady * 14;
          if (Math.hypot(cx - px, cy - (py - 14)) < 29 && this.hurtPlayer(BANDIT_DMG, bx, by, time)) b.did = true;
        }
        if (time - b.t0 >= BANDIT_STRIKE) {
          if (b.combo > 0 && !this.down) { b.combo--; this.startWindup(b, time, true, ux, uy); }
          else { b.state = 'recover'; b.t0 = time; }
        }
      } else if (b.state === 'recover') {
        if (time - b.t0 >= BANDIT_RECOVER) b.state = this.down ? 'idle' : 'chase';
      }

      bd.setVelocity(vx, vy);

      // 圖片、陰影、驚嘆號
      if (b.state !== 'dead' || b.sprite.alpha > 0) {
        const key = b.facing === 'up' ? 'bandit_up'
                  : (b.facing === 'left' || b.facing === 'right') ? 'bandit_side_k'
                  : 'bandit_down';
        if (b.sprite.texture.key !== key) this.setSpriteTex(b.sprite, key, BANDIT_H);
        b.sprite.setFlipX(b.facing === 'left');

        let ox = 0, oy = 0;
        const [fdx, fdy] = DIRS[b.facing];
        if (b.state === 'windup') {                       // 蓄力：身體微微後仰
          const k = Math.min(1, (time - b.t0) / BANDIT_WINDUP);
          ox = -fdx * 3 * k; oy = -fdy * 2 * k;
        } else if (b.state === 'strike') {                // 出刀：往前一頂
          ox = b.adx * 6; oy = b.ady * 4;
        }
        if (b.state !== 'dead') b.sprite.setPosition(bx + ox, by + oy).setDepth(by);
        b.shadow.setPosition(bx, by);
        b.shadow.setAlpha(b.state === 'dead' ? 0 : 1);

        if (b.state === 'dead') b.sprite.clearTint();
        else if (time < b.flashUntil) b.sprite.setTint(0xff9a8a);
        else if (b.state === 'windup' && Math.floor(time / 70) % 2) b.sprite.setTint(0xffd27a);
        else b.sprite.clearTint();

        b.alert.setVisible(b.state === 'windup').setPosition(bx, by - BANDIT_H - 2);
      }
    }
  }

  startWindup(b, time, fast, ux, uy) {
    b.state = 'windup'; b.t0 = time;
    b.windup = fast ? BANDIT_WINDUP_FAST : BANDIT_WINDUP;
    if (!fast) b.combo = Math.random() < BANDIT_COMBO_P ? 1 : 0;
    b.adx = ux; b.ady = uy;
  }

  hitBandit(b, dx, dy, time) {
    const dmg = 8 + Math.floor(Math.random() * 5);
    b.hp -= dmg;
    b.lastHit = time;
    this.spawnDamage(b.body.x, b.body.y - BANDIT_H - 4, dmg);
    b.flashUntil = time + 110;
    if (b.hp <= 0) { this.killBandit(b, dx, time); return; }
    this.cameras.main.shake(60, 0.002);
    // 架勢值：連續被打才會破勢；破勢之前他不會被打斷，仍會出刀
    b.poise -= dmg;
    if (b.poise <= 0) {
      b.state = 'hurt'; b.until = time + BANDIT_STUN;
      const m = Math.hypot(dx, dy) || 1;
      b.kx = dx / m * BANDIT_KNOCK; b.ky = dy / m * BANDIT_KNOCK;
      this.spawnDamage(b.body.x, b.body.y - BANDIT_H - 18, '破勢', '#9fd8ff');
    }
  }

  killBandit(b, dx, time) {
    b.state = 'dead'; b.dead = true;
    b.body.body.setVelocity(0, 0);
    b.body.body.enable = false;
    b.alert.setVisible(false);
    b.respawnAt = time + BANDIT_RESPAWN_MS;
    const dir = dx >= 0 ? 1 : -1;
    this.tweens.add({ targets: b.sprite, angle: dir * 85, duration: 280, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: b.sprite, alpha: 0, delay: 2600, duration: 900 });
  }

  reviveBandit(b) {
    this.tweens.killTweensOf(b.sprite);
    b.body.body.reset(b.home.x, b.home.y - 4);
    b.body.body.enable = true;
    b.sprite.setAngle(0).setAlpha(1);
    b.hp = BANDIT_HP; b.dead = false; b.state = 'idle'; b.facing = 'down';
    b.sprite.setPosition(b.home.x, b.home.y);
  }

  // ---------- 玩家受傷與倒下 ----------
  hurtPlayer(dmg, sx, sy, time) {
    if (this.down || time < this.invulnUntil || time < this.rollIUntil) return false;
    this.php = Math.max(0, this.php - dmg);
    this.roll = null;
    this.invulnUntil = time + INVULN_MS;
    this.heroFlashUntil = time + 140;
    this.atk = null;                                  // 被打中會打斷自己的揮劍
    const px = this.playerBody.x, py = this.playerBody.y + 4;
    const m = Math.hypot(px - sx, py - sy) || 1;
    this.pk = { vx: (px - sx) / m * PLAYER_KNOCK, vy: (py - sy) / m * PLAYER_KNOCK, until: time + PLAYER_KNOCK_MS };
    this.spawnDamage(px, py - HERO_H - 4, dmg, '#ff9a8a');
    this.cameras.main.shake(120, 0.005);
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
      if (!b.dead) { b.state = 'idle'; b.hp = BANDIT_HP; }
    }
  }

  // 山賊出刀的紅色劍光
  drawEnemyFx(time) {
    const g = this.enemyGfx, lg = this.laneGfx;
    g.clear(); lg.clear();
    for (const b of this.bandits) {
      // 蓄力時在地上畫出衝刺路線；最後一小段鎖定後變白，這時才是翻滾的時機
      if (b.state === 'windup') {
        const wt = time - b.t0, k = Math.min(1, wt / b.windup);
        const locked = wt >= b.windup - BANDIT_AIM_LOCK;
        const len = BANDIT_LUNGE * BANDIT_STRIKE / 1000 + 14 + 22;
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
    const dmg = 8 + Math.floor(Math.random() * 5);
    d.hp -= dmg;
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
    const t = (time - this.atk.start) / ATK_DUR;
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
      if (b.dead || b.hp >= BANDIT_HP) continue;
      const w = 28, x = b.body.x - w / 2, y = b.body.y + 4 - BANDIT_H - 10;
      g.fillStyle(0x000000, 0.6); g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0xc0503a, 1); g.fillRect(x, y, w * Math.max(0, b.hp) / BANDIT_HP, 3);
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
