// 大江湖 · 第 1 步：可走動的小鎮（Phaser 3）
'use strict';

const MAP_W = 820, MAP_H = 660;
const SPEED = 200;      // 世界單位 / 秒
const HERO_H = 46;      // 主角在世界中的高度
const JOY_R = 60;       // 搖桿半徑（螢幕像素）

// 戰鬥
const BTN_R = 42;           // 攻擊鍵半徑（螢幕像素）
const ATK_CD = 380;         // 兩次攻擊的最短間隔（毫秒）
const ATK_DUR = 240;        // 揮劍動作長度
const ATK_HIT_FROM = 60, ATK_HIT_TO = 200;   // 動作中可以打到人的時間窗
const ATK_REACH = 22;       // 劍的判定圈中心離身體多遠
const ATK_RADIUS = 26;      // 劍的判定圈半徑
const ATK_MOVE_MUL = 0.35;  // 揮劍時移動速度倍率
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 木人樁（底部中心座標）
const DUMMIES = [
  { x: 240, y: 335 },
  { x: 580, y: 335 },
  { x: 410, y: 470 },
];
const DUMMY_HP = 60;

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
    this.load.image('stone', A + 'tiles/stone_floor.png');
    this.load.image('house', A + 'buildings/house_01.png');
    this.load.image('tree', A + 'props/tree_01.png');
  }

  create() {
    // 去背素材
    this.keyTex('hero_front', 'hero_down');
    this.keyTex('hero_back', 'hero_up');
    this.keyTex('hero_side', 'hero_side_k');
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

    // 戰鬥特效用的繪圖層（劍光、血條）
    this.slashGfx = this.add.graphics().setDepth(5000);
    this.barGfx = this.add.graphics().setDepth(6000);
    this.world.push(this.slashGfx, this.barGfx);
    this.atk = null;          // 目前的揮劍：{ start, dx, dy, hit:Set }
    this.lastAtk = -1e9;
    this.btn = { id: null, held: false };

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
    this.hintText = this.add.text(this.scale.width / 2, 14, '左半邊拖曳移動 · 右下角按「攻」出招\n電腦：WASD 移動、空白鍵攻擊', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#d8e0cf',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(1001);
    this.ui.push(this.joyGfx, this.btnGfx, this.btnText, this.hintText);
    this.hintTimer = this.time.delayedCall(6000, () => this.hintText.setVisible(false));

    cam.ignore(this.ui);
    this.uiCam.ignore(this.world);

    // 輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, x: 0, y: 0, active: false };
    this.atkKeys = this.input.keyboard.addKeys('SPACE,J');
    this.input.keyboard.on('keydown-SPACE', () => this.tryAttack(this.nowT || 0));
    this.input.keyboard.on('keydown-J', () => this.tryAttack(this.nowT || 0));
    this.input.on('pointerdown', p => {
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
    const { x, y, m } = this.readInput();

    // 出招：按住攻擊鍵或空白鍵會連續出招，但受冷卻限制
    if (this.btn.held || this.atkKeys.SPACE.isDown || this.atkKeys.J.isDown) this.tryAttack(time);
    if (this.atk && time - this.atk.start > ATK_DUR) this.atk = null;

    const speed = SPEED * (this.atk ? ATK_MOVE_MUL : 1);
    this.playerBody.body.setVelocity(x * speed, y * speed);

    if (m > 0.05) {
      if (!this.atk) {   // 揮劍中不改變朝向
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
    this.heroShadow.setPosition(fx, fy).setDisplaySize(HERO_H * 0.8, HERO_H * 0.22);

    this.processAttack(time, fx, fy);
    this.drawSlash(time, fx, fy);
    this.drawBars();
    this.drawUI();
  }

  // ---------- 戰鬥 ----------
  tryAttack(time) {
    if (time - this.lastAtk < ATK_CD) return;
    this.lastAtk = time;
    const [dx, dy] = DIRS[this.facing];
    this.atk = { start: time, dx, dy, hit: new Set() };
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
  }

  hitDummy(d, dx, dy) {
    const dmg = 10 + Math.floor(Math.random() * 6);
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

  spawnDamage(x, y, n) {
    const t = this.add.text(x, y, String(n), {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold',
      color: '#ffe9a8', stroke: '#000000', strokeThickness: 3, resolution: 3,
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
  }

  btnPos() {
    return { x: this.scale.width - 70, y: this.scale.height - 100 };
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
