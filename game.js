// 大江湖 · 森林小道伏擊（Phaser 3）
'use strict';

const MAP_W = 460, MAP_H = 1120;   // 直向的森林小道

// ---------- 森林小道 ----------
// 小道中心線（略為彎曲）、中段的林間空地（戰場）、左右兩條側小徑（伏兵從這裡衝出）
const PATH_HW = 50;                                     // 小道半寬
const pathCX = y => 230 + 16 * Math.sin(y / 170);       // 小道中心 x
const CLEAR = { x: 230, y: 560, rx: 175, ry: 120 };     // 林間空地（橢圓）
const SIDE_Y0 = 535, SIDE_Y1 = 595;                     // 左右側小徑的上下緣
const START = { x: pathCX(1060), y: 1060 };             // 主角起點（小道最下方）
const AMBUSH_Y = 690;
const CINE_MS = 3900;                                   // 伏兵出場動畫長度（黑條、主角停住）                                   // 主角往上走到這裡（空地下緣）觸發伏擊
const EXIT_Y = 50;                                      // 擊退伏兵後，走到小道最上方＝本段結束
function walkable(x, y) {
  if (y < 6 || y > MAP_H - 6) return false;
  if (Math.abs(x - pathCX(y)) < PATH_HW) return true;
  if (((x - CLEAR.x) / CLEAR.rx) ** 2 + ((y - CLEAR.y) / CLEAR.ry) ** 2 < 1) return true;
  return y > SIDE_Y0 && y < SIDE_Y1 && x > 8 && x < MAP_W - 8;
}
const SPEED = 115;      // 世界單位 / 秒
const HERO_H = 46;      // 主角在世界中的高度
const ATK_SRC_BODY_H = 360;   // 揮刀圖裡，頭頂到腳底的像素高度（對應 HERO_H）
const JOY_R = 60;       // 搖桿半徑（螢幕像素）
const WALK_FRAME_MS = 150;   // 走路動畫每幀的長度（毫秒，全速時）
const ACCEL_MS = 100;   // 起步約這麼久加到全速
const DECEL_MS = 120;   // 放手後約這麼久停下來
const JOY_DEAD = 6;     // 死區：拖不到這個距離不動
const JOY_FULL = 34;    // 拖到這個距離就是全速

// 戰鬥
const VERSION = 'v0.9.0';   // 每次更新請加一
const BTN_R = 42;           // 攻擊鍵半徑（螢幕像素）
const ATK_CD = 680;         // 兩次攻擊的最短間隔（毫秒）
const ATK_SWING = 360;      // 揮劍動作本身的長度
const ATK_DUR = 580;        // 揮劍總長度（揮完後還有硬直，期間不能移動與出招）
const ATK_HIT_FROM = 150, ATK_HIT_TO = 320;   // 動作中可以打到人的時間窗
const ATK_ROLL_CANCEL = 60;                  // 揮劍幾毫秒後就能用翻滾取消（越小越跟手）
const LOCK_KEEP = 260;      // 手動鎖定的敵人離玩家超過這個距離就自動解除
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
const DUMMIES = [];   // 森林小道不放木人樁
const DUMMY_HP = 60;

// 玩家
const INVULN_MS = 500;        // 被打中後的無敵時間
const PLAYER_KNOCK = 150;     // 被擊退的速度
const PLAYER_KNOCK_MS = 130;
const PLAYER_RESPAWN_MS = 2000;
const HURT_ANIM_MS = 330;     // 主角受擊動畫長度

// 耐力與翻滾（魂系核心：每個動作都要付出代價）
const STAM_REGEN = 36;          // 每秒回復
const STAM_DELAY = 750;         // 用完耐力後多久才開始回復
const STAM_DELAY_EMPTY = 1300;  // 耐力見底時要等更久
const ATK_COST = 22;

// ---------- 能力型成長 ----------
// 等級上限 99；升下一級所需經驗 = 50 × 目前等級；每級 3 點能力點
const LV_CAP = 99, PTS_PER_LV = 3;
const xpNeed = lv => 50 * lv;
// 擊殺經驗：基礎值 × 敵人等級；玩家等級 ≥ 敵人等級 + 10 時，只剩 25%
const KILL_XP = { turban: 8, hansoldier: 25, bandit: 120 };
const CHAPTER_XP = [13860, 13860, 13860, 13860, 13860, 13860, 13860];   // 章節固定經驗（劇情結算時才發，尚未接上）
const STAT_KEYS = ['hp', 'sta', 'atk', 'def'];
const STAT_NAMES = { hp: '生命力', sta: '氣力', atk: '攻擊力', def: '防禦力' };
const STAT_DESC = {
  hp: p => '氣血上限 ' + statMaxHp(p),
  sta: p => '氣力上限 ' + statMaxStam(p),
  atk: p => '傷害 ×' + statAtk(p).toFixed(2),
  def: p => '減傷 ' + Math.round(statDef(p) * 100) + '%',
};
// p = 該項已投入的點數；前 50 點效果完整，之後遞減
const statMaxHp = p => 100 + 3 * Math.min(p, 50) + 2 * Math.max(0, p - 50);
const statMaxStam = p => 100 + 5 * Math.min(p, 50) + 2 * Math.max(0, p - 50);
const statAtk = p => 1 + 0.01 * Math.min(p, 50) + 0.005 * Math.max(0, p - 50);
const statDef = p => Math.min(0.40, 0.015 * p);
const SAVE_KEY = 'dajianghu_save_v1';
// 黑魂式翻滾：固定短距離、方向鎖定、先快後慢、前段無敵、後段收招有破綻
const ROLL_COST = 26;
const ROLL_DUR = 520;           // 翻滾總長度（含收招）
const ROLL_MOVE = 380;          // 位移時間：速度由快漸慢，之後原地站穩
const ROLL_DIST = 58;           // 位移距離（約 1.3 個身位）
const ROLL_I_FROM = 30, ROLL_I_TO = 300;   // 無敵時間窗
const ROLL_CROUCH_MS = 70;      // 翻滾動畫：前幾毫秒是蹲伏蹬地，之後進入翻滾
// 沒推搖桿時的小退步：更短、更便宜
const BACK_COST = 18;
const BACK_DUR = 430, BACK_MOVE = 300, BACK_DIST = 34;
const BACK_I_FROM = 20, BACK_I_TO = 210;
const DG_R = 34;                // 閃避鍵半徑（螢幕像素）

// 敵人出生點與種類：左邊只有一個黃巾渠帥（武將），右邊是一群小兵與精兵
// 伏兵：一開始藏在兩側樹林（看不到），主角走到空地時從左右側小徑衝出
// delay：觸發後幾毫秒才現身；ex, ey：衝進空地的落點
const ENEMY_SPAWNS = [
  { type: 'turban', x: 92,  y: 572, delay: 500,  ex: 150, ey: 590 },
  { type: 'bandit', x: 88,  y: 552, delay: 1700, ex: 165, ey: 555 },
  { type: 'turban', x: 368, y: 552, delay: 800,  ex: 300, ey: 548 },
  { type: 'turban', x: 372, y: 582, delay: 1100, ex: 310, ey: 600 },
];

// 所有敵人共用同一套戰鬥規則，強弱只靠這張數值表決定（新增敵人填一行即可）
const ENEMY_TYPES = {
  bandit: {
    tex: 'ytgeneral',         // 黃巾武將專屬圖（Codex 生成）：走路、站立、揮砍、受擊、倒下
    walkTex: 'ytgeneral', standTex: 'ytgeneral', animTex: 'ytgeneral',   // animTex：有揮砍／受擊／倒下動畫
    name: '黃巾渠帥', showName: true,   // 武將：常駐名字與血條
    shadowColor: 0x000000,
    walkBright: { side: 1, front: 1, back: 1 },            // 走路圖亮度校正（Codex 圖已與參考一致）
    h: Math.round(HERO_H * 1.2),    // 武將比主角大 20%
    hp: 50,
    speed: 82,
    aggro: 120,               // 玩家進入這個距離就會追
    lose: 260,                // 玩家跑超過這個距離就放棄
    range: 56,                // 這個距離內開始蓄力出刀
    stalkDist: 105,           // 進入這個距離先停下來盯著你繞步
    orbitR: 100,              // 輪不到進攻時在這個距離外繞圈等
    attackSlots: 1,           // 同時進攻的人數上限
    atkGap: 600,              // 一個敵人出完招後，其他人至少隔這麼久才能出手
    // 衝刺（紅線預告）：紅線長度＝實際衝刺距離（lunge×strike）＋刀尖 tip，判定就在這條線上，畫多長就打多遠
    windup: 800, windupFast: 820, aimLock: 220, strike: 200, hitAt: 130, lunge: 340, recover: 1300,
    laneHW: 20, tip: 24,
    dmgLunge: 33,
    // 普通揮砍（原地起手、不衝刺）
    slashWindup: 550, slashWindupFast: 400, slashAimLock: 150, slashStrike: 180, slashHitAt: 60,
    slashRecover: 900, slashReach: 18, slashR: 28, dmgSlash: 25,   // 等級 1：武將一刀約扣 1/4 血
    // 重劈：前搖最長、地上紅圈預告落點，範圍大、傷害高、破綻也長（前搖時可以搶進去打或翻滾）
    heavyWindup: 900, heavyWindupFast: 500, heavyAimLock: 260, heavyStrike: 240, heavyHitAt: 110,
    heavyRecover: 1500, heavyReach: 22, heavyR: 34, dmgHeavy: 33,
    // 連刺：前搖短、連續 2～3 下小幅前刺，每一下都重新瞄準；傷害小但很逼人
    thrustWindup: 420, thrustWindupFast: 230, thrustAimLock: 90, thrustStrike: 130, thrustHitAt: 50,
    thrustRecover: 1000, thrustSpeed: 260, thrustHW: 15, dmgThrust: 25,
    // 選招機率（varied＝武將專用的多招式選招；小兵、精兵維持原本的選招）
    varied: true,
    pSlashClose: 0.30, pThrustClose: 0.22, pHeavyClose: 0.18, pLungeClose: 0.05, pFeintClose: 0.25,   // 貼身（44 以內）
    pLungeMid: 0.34, pThrustMid: 0.24, pHeavyMid: 0.22, pSlashMid: 0.20,                               // 中距離
    pFeint: 0.18,                          // 揮砍／重劈起手後，有這個機率在前搖中途取消、後撤（假動作）
    pCombo: 0.5,                           // 揮砍連揮兩下的機率
    rest: 700,                             // 破綻結束後繞步的時間（短一點，不給玩家打了就退的空檔）
    // 防禦與閃避
    reactRange: 100, reactCdMs: 1300, pGuard: 0.35, pDodge: 0.35, dodgeCdMs: 2200,
    guardDur: 700, guardDmgMul: 0.15, guardBreakHits: 3, guardBreakStun: 900, dodgeCounterWindup: 480,
    // 架勢與受擊
    poise: 48, stun: 600, knock: 120,
    // 反制「打了就退」：被打中後有機率立刻轉向反擊（蓄力縮短，仍有預備動作）
    counterOnHit: 1, counterWindup: 320, counterRange: 70,
    recoverCounter: 0.6,   // 破綻期被打中：有這個機率打斷破綻、立刻反擊（玩家每刀都要承擔風險）
    // 搶先出刀：玩家快速逼近或已出刀時，距離內有機率先動手（蓄力時間不縮短，動作仍可辨識）
    preempt: true, preemptDist: 85, pPreempt: 1, preemptCdMs: 1800, preemptCloseSpd: 70,
    respawnMs: 6000,
  },
};
// 小兵（黃巾軍）：血少、慢、很少防禦；可多人同時進攻
ENEMY_TYPES.turban = Object.assign({}, ENEMY_TYPES.bandit, {
  walkTex: 'turban', standTex: 'turban', animTex: null, walkBright: { side: 1, front: 1, back: 1 },   // 黃巾走路圖、站立圖（Codex 生成）
  name: '黃巾', showName: false, shadowColor: 0x000000,
  h: HERO_H,   // 小兵與主角等高
  hp: 12, speed: 50, aggro: 70, lose: 140, stalkDist: 0, orbitR: 90,
  attackSlots: 2, atkGap: 400,
  slashWindup: 900, slashWindupFast: 650, slashRecover: 1000, rest: 1800, dmgSlash: 4,
  varied: false, pFeint: 0, reactRange: 90, dodgeCdMs: 3000,   // 小兵維持原本的選招與反應
  fleeOnHit: false,          // 不退縮：被打中後照樣回來
  pSlashClose: 0.85, pLungeClose: 0, pLungeMid: 0, pCombo: 0.1,
  pGuard: 0.03, pDodge: 0, reactCdMs: 4000,
  poise: 10, stun: 500, knock: 140, respawnMs: 20000,
  counterOnHit: 0, recoverCounter: 0, preempt: false,   // 小兵不反擊、不搶先出刀
});
// 精兵（官軍）：血量中等，會用衝刺，偶爾防禦或閃避
ENEMY_TYPES.hansoldier = Object.assign({}, ENEMY_TYPES.bandit, {
  walkTex: 'hansoldier', standTex: 'hansoldier', animTex: null, walkBright: { side: 1, front: 1, back: 1 },   // 官軍走路圖、站立圖（Codex 生成）
  name: '官軍', showName: true, shadowColor: 0x000000,   // 精兵：頭上顯示名字與血條
  h: HERO_H,   // 與主角等高
  hp: 28, speed: 78, aggro: 140, lose: 300, stalkDist: 90,
  attackSlots: 2, atkGap: 400,
  varied: false, pFeint: 0, reactRange: 90, dodgeCdMs: 3000,   // 精兵維持原本的選招與反應
  dmgLunge: 16, dmgSlash: 9, rest: 1400,
  pSlashClose: 0.65, pLungeClose: 0.1, pLungeMid: 0.25,
  pGuard: 0.15, pDodge: 0.08,
  poise: 28, stun: 500, respawnMs: 15000,
  reactCdMs: 2500,
  counterOnHit: 0, recoverCounter: 0, preempt: false, pCombo: 0.3,   // 精兵維持原本手感
});
const REACT_DELAY = 100;      // 防禦/閃避生效前的小動作（提示）
const GUARD_FRONT = 0.3;      // 攻擊來自防禦方向的內積門檻，側面與背後擋不到
const DODGE_DUR = 240, DODGE_DIST = 46;   // 敵人後閃：距離拉長一點，才看得出來

// 固定擺設（森林小道的樹改由程式自動種，這裡留空）
const PROPS = [];

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

// 揮刀用：每格以「格子中心」為身體中心，裁成左右對稱，避免刀伸出去時身體跟著位移
function keyAndTrimFramesCentered(img, n, bright = 1) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const cw = Math.floor(c.width / n), mid = cw / 2;
  let minY = 1e9, maxY = -1, half = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < cw * n; x++) {
      const i = (y * c.width + x) * 4;
      if (p[i] > 180 && p[i + 1] < 110 && p[i + 2] > 180) { p[i + 3] = 0; continue; }
      p[i] *= bright; p[i + 1] *= bright; p[i + 2] *= bright;
      half = Math.max(half, Math.abs((x % cw) + 0.5 - mid));
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  g.putImageData(d, 0, 0);
  const hw = Math.ceil(half), w = hw * 2, h = maxY - minY + 1, out = [];
  for (let f = 0; f < n; f++) {
    const o = document.createElement('canvas');
    o.width = w; o.height = h;
    o.getContext('2d').drawImage(c, f * cw + Math.round(mid) - hw, minY, w, h, 0, 0, w, h);
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
    this.load.image('hero_attack_side', A + 'characters/hero_attack_side.png');
    this.load.image('hero_attack_front', A + 'characters/hero_attack_front.png');
    this.load.image('hero_attack_back', A + 'characters/hero_attack_back.png');
    this.load.image('hero_roll_side', A + 'characters/hero_roll_side.png');
    this.load.image('hero_roll_front', A + 'characters/hero_roll_front.png');
    this.load.image('hero_roll_back', A + 'characters/hero_roll_back.png');
    this.load.image('hero_hurt_side', A + 'characters/hero_hurt_side.png');
    this.load.image('hero_hurt_front', A + 'characters/hero_hurt_front.png');
    this.load.image('hero_hurt_back', A + 'characters/hero_hurt_back.png');
    this.load.image('hero_down_side', A + 'characters/hero_down_side.png');
    this.load.image('hero_down_front', A + 'characters/hero_down_front.png');
    // 黃巾武將；官兵武將圖 hangeneral_*、盜賊染色暫代圖 yturban_* 保留在資料夾，沒有在用
    for (const f of ['walk_side', 'walk_front', 'walk_back', 'stand_side', 'stand_front', 'stand_back',
                     'attack_side', 'attack_front', 'attack_back', 'hurt_side', 'down_side']) {
      this.load.image('ytgeneral_' + f, A + 'characters/ytgeneral_' + f + '.png');
    }
    // 森林素材
    for (const f of ['forest_tree_01', 'forest_tree_02', 'forest_tree_03', 'bush_01', 'rock_01', 'log_01']) this.load.image(f, A + 'props/' + f + '.png');
    this.load.image('forest_floor', A + 'tiles/forest_floor.png');
    this.load.image('dirt_path', A + 'tiles/dirt_path.png');
    for (const p of ['turban', 'hansoldier']) {
      for (const d of ['side', 'front', 'back']) this.load.image(p + '_stand_' + d, A + 'characters/' + p + '_stand_' + d + '.png');
    }
    this.load.image('turban_walk_side', A + 'characters/turban_walk_side.png');
    this.load.image('turban_walk_front', A + 'characters/turban_walk_front.png');
    this.load.image('turban_walk_back', A + 'characters/turban_walk_back.png');
    this.load.image('hansoldier_walk_side', A + 'characters/hansoldier_walk_side.png');
    this.load.image('hansoldier_walk_front', A + 'characters/hansoldier_walk_front.png');
    this.load.image('hansoldier_walk_back', A + 'characters/hansoldier_walk_back.png');
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
    // 揮刀動畫（側面、正面、背面各 3 幀：舉刀 → 出刀 → 收刀）
    keyAndTrimFramesCentered(this.textures.get('hero_attack_side').getSourceImage(), 3, 0.85)
      .forEach((cv, i) => this.textures.addCanvas('hero_atk_side_' + i, cv));
    keyAndTrimFramesCentered(this.textures.get('hero_attack_front').getSourceImage(), 3, 0.85)
      .forEach((cv, i) => this.textures.addCanvas('hero_atk_front_' + i, cv));
    keyAndTrimFramesCentered(this.textures.get('hero_attack_back').getSourceImage(), 3, 0.94)
      .forEach((cv, i) => this.textures.addCanvas('hero_atk_back_' + i, cv));
    // 翻滾動畫（側面、正面、背面各 3 幀：蹲伏蹬地 → 翻滾 → 起身）；小退步沒有圖，沿用壓扁表現
    keyAndTrimFramesCentered(this.textures.get('hero_roll_side').getSourceImage(), 3, 0.85)
      .forEach((cv, i) => this.textures.addCanvas('hero_roll_side_' + i, cv));
    keyAndTrimFramesCentered(this.textures.get('hero_roll_front').getSourceImage(), 3, 0.85)
      .forEach((cv, i) => this.textures.addCanvas('hero_roll_front_' + i, cv));
    keyAndTrimFramesCentered(this.textures.get('hero_roll_back').getSourceImage(), 3, 0.94)
      .forEach((cv, i) => this.textures.addCanvas('hero_roll_back_' + i, cv));
    // 主角受擊（三方向）、倒下（側面、正面）：各 3 幀
    for (const [src, dst, br] of [['hero_hurt_side', 'hero_hurt_side', 0.85], ['hero_hurt_front', 'hero_hurt_front', 0.85], ['hero_hurt_back', 'hero_hurt_back', 0.94],
                                  ['hero_down_side', 'hero_down_side', 0.85], ['hero_down_front', 'hero_down_front', 0.85]]) {
      keyAndTrimFramesCentered(this.textures.get(src).getSourceImage(), 3, br)
        .forEach((cv, i) => this.textures.addCanvas(dst + '_' + i, cv));
    }
    // 敵人走路動畫：依數值表的 tex 前綴建立 <tex>_walk_<side|front|back>_<0..3>
    for (const T of Object.values(ENEMY_TYPES)) {
      const wk = T.walkTex || T.tex;
      if (!T.walkBright || this.textures.exists(wk + '_walk_side_0')) continue;
      for (const dir of ['side', 'front', 'back']) {
        keyAndTrimFrames(this.textures.get(wk + '_walk_' + dir).getSourceImage(), 4, T.walkBright[dir])
          .forEach((cv, i) => this.textures.addCanvas(wk + '_walk_' + dir + '_' + i, cv));
      }
    }
    // 敵人站立圖：<前綴>_standk_<side|front|back>
    for (const T of Object.values(ENEMY_TYPES)) {
      if (!T.standTex || this.textures.exists(T.standTex + '_standk_side')) continue;
      for (const dir of ['side', 'front', 'back']) this.keyTex(T.standTex + '_stand_' + dir, T.standTex + '_standk_' + dir);
    }
    // 武將的揮砍（三方向）、受擊、倒下（側面）：各 3 幀，以格子中心為身體中心
    for (const T of Object.values(ENEMY_TYPES)) {
      const P = T.animTex;
      if (!P || this.textures.exists(P + '_atk_side_0')) continue;
      for (const [src, dst] of [['attack_side', 'atk_side'], ['attack_front', 'atk_front'], ['attack_back', 'atk_back'], ['hurt_side', 'hurt_side'], ['down_side', 'down_side']]) {
        keyAndTrimFramesCentered(this.textures.get(P + '_' + src).getSourceImage(), 3, 1)
          .forEach((cv, i) => this.textures.addCanvas(P + '_' + dst + '_' + i, cv));
      }
    }
    for (const f of ['forest_tree_01', 'forest_tree_02', 'forest_tree_03', 'bush_01', 'rock_01', 'log_01']) this.keyTex(f, f + '_k');
    // 去背完成：原始大圖（共約 100MB）之後不會再用，釋放掉，減輕手機（尤其 iPhone）的記憶體壓力；地磚 stone 要保留
    for (const k of this.textures.getTextureKeys()) {
      if (k.startsWith('__') || k === 'forest_floor' || k === 'dirt_path') continue;   // 兩張地面圖要留到 buildForest 用完再釋放
      if (this.textures.get(k).getSourceImage() instanceof HTMLImageElement) this.textures.remove(k);
    }

    this.world = [];   // 世界物件，會被鏡頭看到
    this.ui = [];      // 螢幕固定物件

    this.buildForest();

    // 固定擺設（目前沒有）：障礙、陰影、排序；this.obstacles 已在 buildForest 建好
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
    this.playerBody = this.add.zone(START.x, START.y, 14, 8);
    this.physics.add.existing(this.playerBody);
    this.playerBody.body.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.physics.add.collider(this.playerBody, this.obstacles);

    this.heroShadow = this.add.ellipse(0, 0, 40, 12, 0x000000, 0.28).setDepth(-10);
    this.hero = this.add.image(0, 0, 'hero_down').setOrigin(0.5, 1).setDepth(0);
    // 主角頭頂的紅色驚嘆號（發現埋伏時）
    this.heroAlert = this.add.text(0, 0, '!', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: '#ff4a3a', stroke: '#000000', strokeThickness: 4, resolution: 3,
    }).setOrigin(0.5, 1).setDepth(8600).setVisible(false);
    this.heroAlertUntil = 0;
    this.facing = 'down';
    this.walk = 0; this.walkT = 0;
    this.setHeroTexture('hero_down');
    this.world.push(this.heroShadow, this.hero, this.heroAlert);

    // 玩家狀態
    this.loadGrowth();
    this.php = this.maxHp();
    this.invulnUntil = 0;
    this.mv = { x: 0, y: 0 };               // 目前的走路速度（有慣性）
    this.pk = { vx: 0, vy: 0, until: 0 };   // 被擊退
    this.heroFlashUntil = 0;
    this.down = false;
    this.respawnAt = 0;

    // 山賊：追擊、出刀、受傷、倒下、重生
    this.bandits = [];
    for (const h of ENEMY_SPAWNS) {
      // 伏擊戰：被觸發後一路追到底（不會因距離放棄），倒下不重生
      const T = Object.assign({}, ENEMY_TYPES[h.type], { aggro: 600, lose: 1200, respawnMs: Infinity });
      const shadow = this.add.ellipse(h.x, h.y, 42, 12, T.shadowColor, 0.28).setDepth(-10);
      const sprite = this.add.image(h.x, h.y, T.walkTex ? T.walkTex + '_walk_front_1' : T.tex + '_down').setOrigin(0.5, 1).setDepth(h.y);
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
      this.setSpriteTex(sprite, T.walkTex ? T.walkTex + '_walk_front_1' : T.tex + '_down', T.h);
      this.bandits.push({
        home: { x: h.x, y: h.y }, body, sprite, shadow, alert,
        t: T, nameTag, hp: T.hp, state: 'idle', facing: 'down', dead: false,
        t0: 0, until: 0, kx: 0, ky: 0, flashUntil: 0,
        strikeAt: -1e9, did: false, adx: 0, ady: 1, respawnAt: 0,
        poise: T.poise, lastHit: 0, windup: T.windup, combo: 0,
        reactCd: 0, dodgeCd: 0, guardHits: 0, gdx: 0, gdy: 1,
        preemptCd: 0, pRoll: false, pd: undefined, pt: 0,
        lastKind: null, feintAt: 0, sx: h.x, sy: h.y, ghostT: 0,
        spawn: h, hidden: false,
      });
    }
    for (const b of this.bandits) this.hideBandit(b);
    this.stage = { phase: 'walk', t0: 0 };   // walk：往上走 → fight：伏兵出現 → cleared：擊退 → end：本段結束
    for (let i = 0; i < this.bandits.length; i++) {
      for (let j = i + 1; j < this.bandits.length; j++) {
        this.physics.add.collider(this.bandits[i].body, this.bandits[j].body);
      }
    }
    this.enemyGfx = this.add.graphics().setDepth(5000);
    this.laneGfx = this.add.graphics().setDepth(-5);     // 山賊衝刺路線預告（畫在地上）
    this.lockGfx = this.add.graphics().setDepth(8500);     // 鎖定標記（紅色倒三角＋腳下圈）
    this.lockTarget = null; this.lockDrawn = false;
    this.world.push(this.enemyGfx, this.laneGfx, this.lockGfx);

    // 戰鬥特效用的繪圖層（劍光、血條）
    this.slashGfx = this.add.graphics().setDepth(5000);
    this.barGfx = this.add.graphics().setDepth(6000);
    this.world.push(this.slashGfx, this.barGfx);
    this.atk = null;          // 目前的揮劍：{ start, dx, dy, hit:Set }
    this.lastAtk = -1e9;
    this.btn = { id: null, held: false };
    this.vt = 0; this.realT = 0; this.hitstopUntil = 0;   // 遊戲時間（打擊停頓時不前進）
    this.btn2 = { id: null };              // 閃避鍵
    this.stam = this.maxStam(); this.stamRegenAt = 0; this.stamFlash = 0;
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
    // 出場動畫的上下黑條（平常收在畫面外）
    this.barTop = this.add.rectangle(0, 0, 10, 10, 0x000000, 1).setOrigin(0, 0).setDepth(990);
    this.barBot = this.add.rectangle(0, 0, 10, 10, 0x000000, 1).setOrigin(0, 0).setDepth(990);
    this.cineK = 0;   // 黑條展開程度 0～1
    this.bannerText = this.add.text(this.scale.width / 2, this.scale.height * 0.3, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#f0d890',
      stroke: '#000000', strokeThickness: 5, align: 'center',
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
                 this.hpGfx, this.hpText, this.downText, this.dgGfx, this.dgText, this.bannerText, this.barTop, this.barBot);
    this.hintTimer = this.time.delayedCall(6000, () => this.hintText.setVisible(false));

    cam.ignore(this.ui);
    this.uiCam.ignore(this.world);
    this.buildPanel();

    // 輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, x: 0, y: 0, active: false };
    this.input.addPointer(2);   // 允許左手搖桿、右手攻擊同時按
    this.atkKeys = this.input.keyboard.addKeys('SPACE,J');
    this.input.keyboard.on('keydown-SPACE', () => this.pressAttack());
    this.input.keyboard.on('keydown-J', () => this.pressAttack());
    const dodgeKey = () => { if (this.panelOpen) return; const t = this.nowT || 0; if (!this.tryRoll(t)) this.rollBuf = t + 400; };
    this.input.keyboard.on('keydown-SHIFT', dodgeKey);
    this.input.keyboard.on('keydown-K', dodgeKey);
    this.input.on('pointerdown', p => {
      if (this.panelPointer(p)) return;
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
      if (this.joy.id === null && p.x < this.scale.width * 0.5) {   // 搖桿；若只是輕點，放開時改當作「點擊鎖定」
        this.joy.id = p.id; this.joy.active = true;
        this.joy.ox = p.x; this.joy.oy = p.y;
        this.setJoy(p);
      }
    });
    this.input.on('pointermove', p => { if (!this.panelOpen && p.id === this.joy.id) this.setJoy(p); });
    const endJoy = p => {
      if (p.id === this.btn.id) { this.btn.id = null; this.btn.held = false; return; }
      if (p.id === this.btn2.id) { this.btn2.id = null; return; }
      if (p.id !== this.joy.id) return;
      this.joy.id = null; this.joy.active = false;
      this.joy.x = 0; this.joy.y = 0; this.joy.dx = 0; this.joy.dy = 0;
    };
    this.input.on('pointerup', endJoy);
    this.input.on('pointerupoutside', endJoy);
    // 點擊敵人：鎖定／取消／換目標（很快的輕點、幾乎沒移動才算；按鈕上的觸碰不算）
    this.input.on('pointerup', p => {
      if (this.down || this.panelOpen || p.getDuration() > 260 || p.getDistance() > 14) return;
      const bp = this.btnPos(), dg = this.dodgePos();
      if (Math.hypot(p.x - bp.x, p.y - bp.y) <= BTN_R * 1.4 || Math.hypot(p.x - dg.x, p.y - dg.y) <= DG_R * 1.4) return;
      this.tapLock(p);
    });

    this.scale.on('resize', () => {
      this.uiCam.setSize(this.scale.width, this.scale.height);
      this.applyZoom();
      this.hintText.setX(this.scale.width / 2);
      this.verText.setX(this.scale.width - 6);
      this.downText.setPosition(this.scale.width / 2, this.scale.height / 2 - 40);
      this.bannerText.setPosition(this.scale.width / 2, this.scale.height * 0.3);
      this.layoutPanel();
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
    // 揮刀圖的裁切框比身體高（刀舉高），要用「身體 360px = HERO_H」的同一比例，主角才不會縮小
    const H = (key.startsWith('hero_atk_') || key.startsWith('hero_roll_') || key.startsWith('hero_hurt_') || key.startsWith('hero_down_')) ? HERO_H * tex.height / ATK_SRC_BODY_H : HERO_H;
    this.hero.setDisplaySize(H * tex.width / tex.height, H);
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
    if (this.panelOpen) {   // 能力面板開著：整個遊戲暫停
      this.playerBody.body.setVelocity(0, 0);
      for (const b of this.bandits) b.body.body.setVelocity(0, 0);
      this.nowT = this.vt;
      this.drawUI();
      return;
    }
    this.vt += delta;
    const time = this.vt;
    this.nowT = time;
    const { x, y, m } = this.down || this.cine ? { x: 0, y: 0, m: 0 } : this.readInput();

    // 出招：按住攻擊鍵或空白鍵會連續出招，但受冷卻限制
    if (!this.down && (this.btn.held || this.atkKeys.SPACE.isDown || this.atkKeys.J.isDown)) this.tryAttack(time);
    if (this.atkBuf > time && this.tryAttack(time)) this.atkBuf = 0;
    if (this.atk && time - this.atk.start > this.atk.dur) this.atk = null;

    // 耐力回復（翻滾中不回復）
    if (time >= this.stamRegenAt && !this.roll) this.stam = Math.min(this.maxStam(), this.stam + STAM_REGEN * delta / 1000);

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
    // 揮刀：依時間選幀（舉刀 → 出刀（判定時間窗）→ 收刀）
    let atkFrame = -1;
    if (this.atk) {
      const at = time - this.atk.start;
      atkFrame = at < this.atk.hitFrom ? 0 : at <= this.atk.hitTo ? 1 : 2;
    }
    // 翻滾（四個方向）：蹲伏 → 無敵時間內翻滾 → 起身；小退步沒有圖，仍用靜止圖壓扁
    const rollSprite = !!this.roll && !this.roll.back;
    let rollFrame = 0;
    if (rollSprite) {
      const rt = time - this.roll.start;
      rollFrame = rt < ROLL_CROUCH_MS ? 0 : rt < this.roll.iTo ? 1 : 2;
    }
    // 倒下（側面、正面；朝上時用正面）與受擊（被打中後約 0.33 秒）
    let downFrame = -1, hurtFrame = -1;
    if (this.down) {
      const dt = time - (this.downStart === undefined ? time : this.downStart);
      downFrame = dt < 150 ? 0 : dt < 330 ? 1 : 2;
    } else if (!this.atk && !this.roll && this.hurtStart !== undefined && time - this.hurtStart < HURT_ANIM_MS) {
      const ht = time - this.hurtStart;
      hurtFrame = ht < 110 ? 0 : ht < 220 ? 1 : 2;
    }
    const key = downFrame >= 0 ? 'hero_down_' + (side ? 'side_' : 'front_') + downFrame
              : atkFrame >= 0 ? 'hero_atk_' + (side ? 'side_' : this.facing === 'down' ? 'front_' : 'back_') + atkFrame
              : rollSprite ? 'hero_roll_' + (side ? 'side_' : this.facing === 'down' ? 'front_' : 'back_') + rollFrame
              : hurtFrame >= 0 ? 'hero_hurt_' + (side ? 'side_' : this.facing === 'down' ? 'front_' : 'back_') + hurtFrame
              : this.facing === 'up' ? (walking ? 'hero_walk_back_' + walkFrame : 'hero_up')
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
    if (this.heroAlert.visible) {
      if (time >= this.heroAlertUntil) this.heroAlert.setVisible(false);
      else {
        const at = time - (this.heroAlertUntil - 1400);   // 跳出來：先放大再縮回
        this.heroAlert.setPosition(fx, fy - HERO_H - 4).setScale(at < 120 ? 0.6 + at / 120 * 0.8 : Math.max(1, 1.4 - (at - 120) / 150 * 0.4));
      }
    }
    // 翻滾：身體壓扁並留下殘影
    if (this.roll) {
      const sx = rollSprite ? this.heroSx : this.heroSx * 1.1, sy = rollSprite ? this.heroSy : this.heroSy * 0.72;
      this.hero.setScale(sx, sy);
      if (time - this.roll.lastGhost > 55) {
        this.roll.lastGhost = time;
        const gh = this.add.image(fx, fy, this.hero.texture.key).setOrigin(0.5, 1)
          .setScale(sx, sy).setFlipX(this.facing === 'left')
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
    this.updateStage(time);
    this.fadeTrees(time);
    this.updateBandits(time);
    if (this.down && time >= this.respawnAt) this.respawnPlayer(time);
    this.drawEnemyFx(time);
    this.drawLock(time);
    this.drawSlash(time, fx, fy);
    this.drawBars();
    this.drawUI();
    // 版本號旁顯示幀率（每 0.5 秒更新一次），方便在手機上判斷是否掉幀
    this.fpsN = (this.fpsN || 0) + 1;
    if (realTime - (this.fpsT || realTime) >= 500) {
      this.verText.setText(VERSION + ' · ' + Math.round(this.fpsN * 1000 / (realTime - this.fpsT)) + 'fps');
      this.fpsN = 0; this.fpsT = realTime;
    } else if (!this.fpsT) { this.fpsT = realTime; }
  }

  // ---------- 戰鬥 ----------
  // 按下攻擊：不能立刻出招時（翻滾無敵中、揮劍中）先記著，時機一到自動接上
  pressAttack() {
    if (this.panelOpen) return;
    const t = this.nowT || 0;
    if (!this.tryAttack(t) && !this.down && (this.roll || this.atk)) this.atkBuf = t + 350;
  }

  tryAttack(time) {
    if (this.down || this.atk || this.cine) return false;
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

  // 點擊選取敵人：點在敵人身上（含一點餘裕）就鎖定；再點同一個取消；點空地不變
  tapLock(p) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    let best = null, bd = 1e9;
    for (const b of this.bandits) {
      if (b.dead || Math.hypot(b.body.x - this.playerBody.x, b.body.y - this.playerBody.y) > LOCK_KEEP) continue;   // 太遠的不能選
      const by = b.body.y + 4, hw = b.sprite.displayWidth * 0.45 + 10;
      if (Math.abs(w.x - b.body.x) > hw || w.y < by - b.t.h - 10 || w.y > by + 12) continue;
      const d = Math.hypot(w.x - b.body.x, w.y - (by - b.t.h / 2));
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    this.lockTarget = this.lockTarget === best ? null : best;
  }

  // 鎖定標記：目標頭上紅色倒三角（上下浮動）＋腳下紅圈；沒鎖定時只在剛解除那一刻清掉
  drawLock(time) {
    const lt = this.lockTarget;
    if (lt && (lt.dead || Math.hypot(lt.body.x - this.playerBody.x, lt.body.y - this.playerBody.y) > LOCK_KEEP)) this.lockTarget = null;
    const g = this.lockGfx;
    if (!this.lockTarget) { if (this.lockDrawn) { g.clear(); this.lockDrawn = false; } return; }
    const b = this.lockTarget, by = b.body.y + 4;
    const tip = by - b.t.h - (b.t.showName ? 32 : 14) - (Math.sin(time / 160) + 1) * 1.2;
    g.clear();
    g.lineStyle(1, 0xff6a5a, 0.7); g.strokeEllipse(b.body.x, by, b.t.h * 0.55, b.t.h * 0.18);
    g.fillStyle(0x000000, 0.7); g.fillTriangle(b.body.x - 6, tip - 9, b.body.x + 6, tip - 9, b.body.x, tip + 1);
    g.fillStyle(0xff4a3a, 1); g.fillTriangle(b.body.x - 5, tip - 8, b.body.x + 5, tip - 8, b.body.x, tip);
    this.lockDrawn = true;
  }

  // 找距離內最近、還活著的目標（山賊或木人樁）；手動鎖定中就只看鎖定的目標，不被旁邊的敵人吸引
  pickTarget(range) {
    const fx = this.playerBody.x, fy = this.playerBody.y + 4;
    if (this.lockTarget && !this.lockTarget.dead) return { x: this.lockTarget.body.x, y: this.lockTarget.body.y + 4 };
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
    if (this.down || this.roll || this.cine) return false;
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
          // 閃躲中：這刀落空（「閃」字在敵人起閃的當下已經顯示）
        } else if (b.state === 'guard' && live && -this.atk.dx * b.gdx - this.atk.dy * b.gdy > GUARD_FRONT) {
          this.blockBandit(b, this.atk.dx, this.atk.dy, time);
        } else {
          this.hitBandit(b, this.atk.dx, this.atk.dy, time);
        }
      }
    }
  }

  // ---------- 山賊 ----------
  // 敵人靜止時的貼圖：有自己走路圖的種類用走路圖第 2 幀（雙腳併攏），不再誤用山賊的圖
  stillKey(T, facing) {
    const dir = facing === 'up' ? 'back' : (facing === 'left' || facing === 'right') ? 'side' : 'front';
    if (T.standTex) return T.standTex + '_standk_' + dir;
    if (T.walkTex) return T.walkTex + '_walk_' + dir + '_1';
    return facing === 'up' ? T.tex + '_up' : (facing === 'left' || facing === 'right') ? T.tex + '_side_k' : T.tex + '_down';
  }

  // 揮砍、受擊、倒下的幀：裁切框比身體大，用「身體 360px = h」的同一比例（與主角相同做法）
  setSpriteBodyTex(sprite, key, h) {
    const tex = this.textures.get(key).getSourceImage();
    sprite.setTexture(key);
    const k = h / ATK_SRC_BODY_H;
    sprite.setDisplaySize(tex.width * k, tex.height * k);
  }

  setSpriteTex(sprite, key, h) {
    const tex = this.textures.get(key).getSourceImage();
    sprite.setTexture(key);
    sprite.setDisplaySize(h * tex.width / tex.height, h);
  }

  updateBandits(time) {
    const px = this.playerBody.x, py = this.playerBody.y + 4;
    for (const b of this.bandits) {
      const bd = b.body.body;
      if (b.state === 'hidden') { bd.setVelocity(0, 0); continue; }   // 還藏在樹林裡
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

      // 搶先出刀：玩家快速朝我逼近時，進入距離內擲一次骰，過了就直接蓄力（不走「頓一下」）
      const closing = b.pd !== undefined && time > b.pt ? (b.pd - dist) / ((time - b.pt) / 1000) : 0;
      b.pd = dist; b.pt = time;
      if (b.t.preempt) {
        if (dist > b.t.preemptDist + 25) b.pRoll = false;
        if (!this.down && !b.pRoll && dist < b.t.preemptDist && closing > b.t.preemptCloseSpd
            && (b.state === 'chase' || b.state === 'stalk' || b.state === 'rest')
            && time >= b.preemptCd && this.tokenFree(b)) {
          b.pRoll = true;
          const pk = Math.random() < b.t.pPreempt ? this.preemptKind(b, dist) : null;
          if (pk) {
            b.preemptCd = time + b.t.preemptCdMs;
            this.startWindup(b, time, false, ux, uy, pk);
          }
        }
      }

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
      } else if (b.state === 'enter') {
        // 從側小徑衝進空地：朝落點跑，到了（或跑太久）就開始圍攻
        const ex = b.spawn.ex - bx, ey = b.spawn.ey - by, ed = Math.hypot(ex, ey) || 1;
        const spd = b.t.speed * (this.cine ? 0.7 : 1.25);   // 出場動畫中慢慢走出來
        if (ed > 6) { vx = ex / ed * spd; vy = ey / ed * spd; b.facing = Math.abs(ex) > Math.abs(ey) ? (ex > 0 ? 'right' : 'left') : (ey > 0 ? 'down' : 'up'); }
        else faceToward();                                  // 到位後盯著主角，等動畫結束
        if (!this.cine && (ed < 10 || time - b.t0 > 3000)) { b.state = this.down ? 'idle' : 'chase'; b.stalked = false; b.closeIn = false; b.nextKind = null; }
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
              if (b.t.varied) {
                kind = this.pickKind(b, dist, false) || 'feint';   // 武將：多招式，依距離抽籤
              } else {
                const r = Math.random();
                kind = dist <= 40 ? (r < b.t.pSlashClose ? 'slash' : r < b.t.pSlashClose + b.t.pLungeClose ? 'lunge' : 'feint') : (r < b.t.pLungeMid ? 'lunge' : 'slash');
              }
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
          else {
            // 閃完立刻反擊：武將依距離換招（遠用衝刺，近用連刺或揮砍），不再固定衝刺
            let ck = 'lunge';
            if (b.t.varied && dist <= 64) {
              const r = Math.random();
              ck = r < 0.4 ? 'lunge' : r < 0.75 ? 'thrust' : (dist <= 52 ? 'slash' : 'thrust');
            }
            this.startWindup(b, time, true, ux, uy, ck); b.windup = b.t.dodgeCounterWindup;
          }
        }
        // 閃躲殘影
        if (dt >= REACT_DELAY && time - b.ghostT > 50) { b.ghostT = time; this.spawnGhost(b); }
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
        const mv = this.moveStats(b);
        if (wt < b.windup - mv.aimLock) { b.adx = ux; b.ady = uy; }
        b.facing = Math.abs(b.adx) > Math.abs(b.ady) ? (b.adx > 0 ? 'right' : 'left') : (b.ady > 0 ? 'down' : 'up');
        if (b.feintAt && time >= b.feintAt) {
          // 假動作：起手到一半收招、往後撤一步，逼你白翻滾（只有武將）
          b.feintAt = 0; b.combo = 0; b.state = 'feint'; b.t0 = time;
        } else if (wt >= b.windup) { b.state = 'strike'; b.t0 = time; b.strikeAt = time; b.did = false; b.sx = bx; b.sy = by; }
      } else if (b.state === 'feint') {
        if (this.down) b.state = 'idle';
        else {
          if (time - b.t0 < 200) { vx = -b.adx * 130; vy = -b.ady * 130; }
          else { b.state = 'rest'; b.t0 = time; b.stalked = true; b.orbitDir = Math.random() < 0.5 ? 1 : -1; }
        }
      } else if (b.state === 'strike') {
        const mv = this.moveStats(b), st = time - b.t0;
        if (mv.kind === 'slash') { if (st < 80) { vx = b.adx * 40; vy = b.ady * 40; } }   // 普通揮砍：只踏半步
        else if (mv.lane) { vx = b.adx * mv.speed; vy = b.ady * mv.speed; }              // 衝刺、連刺：沿紅線往前推進
        // 重劈：原地劈下，不移動
        if (!b.did && st >= mv.hitAt) {
          let hit;
          if (mv.lane) {
            // 紅線判定：玩家在紅線寬度內，且刀尖已經推進到玩家的位置（畫多長就打多遠）
            const ex = px - b.sx, ey = py - b.sy;
            const s = ex * b.adx + ey * b.ady, lat = Math.abs(-ex * b.ady + ey * b.adx);
            hit = s > -8 && s <= Math.hypot(bx - b.sx, by - b.sy) + mv.tip + 8 && lat < mv.hw + 7;   // +7：主角身體半寬，身體碰到紅線就算中
          } else {
            const cx = bx + b.adx * mv.reach, cy = by - 14 + b.ady * mv.reach;
            hit = Math.hypot(cx - px, cy - (py - 14)) < mv.r;
          }
          if (hit && this.hurtPlayer(mv.dmg, bx, by, time)) b.did = true;
        }
        if (st >= mv.strike) {
          if (b.combo > 0 && !this.down) { b.combo--; this.startWindup(b, time, true, ux, uy); }
          else { b.state = 'recover'; b.t0 = time; }
        }
      } else if (b.state === 'recover') {
        if (time - b.t0 >= this.moveStats(b).recover) {
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
        const walkable = b.state === 'enter' || b.state === 'chase' || b.state === 'stalk' || b.state === 'rest' || b.state === 'pause' || b.state === 'flee';
        if (!walkable) b.moveOn = false;
        else if (sp > 8) b.moveOn = true;
        else if (sp < 3) b.moveOn = false;
        const moving = !!b.moveOn;
        if (moving) b.walkT = (b.walkT || 0) + wdt * Math.max(0.5, Math.min(1, sp / b.t.speed));
        const wf = Math.floor(b.walkT / WALK_FRAME_MS) % 4;
        const wdir = b.facing === 'up' ? 'back' : (b.facing === 'left' || b.facing === 'right') ? 'side' : 'front';
        // 有專屬動畫的敵人（武將）：蓄力＝舉刀、出刀＝揮出、破綻＝收刀；破勢時播受擊；倒下時播倒下
        if (b.facing === 'left' || b.facing === 'right') b.lastLeft = b.facing === 'left';
        const AT = b.t.animTex;
        let key, bodyFrame = false, flipLeft = b.facing === 'left';
        if (AT && (b.state === 'windup' || b.state === 'strike' || b.state === 'recover')) {
          key = AT + '_atk_' + wdir + '_' + (b.state === 'windup' ? 0 : b.state === 'strike' ? 1 : 2); bodyFrame = true;
        } else if (AT && b.state === 'hurt') {
          const ht = Math.min(0.999, (time - (b.hurtT0 === undefined ? time : b.hurtT0)) / (b.hurtDur || 600));
          key = AT + '_hurt_side_' + (ht < 0.3 ? 0 : ht < 0.7 ? 1 : 2); bodyFrame = true; flipLeft = !!b.lastLeft;
        } else if (AT && b.state === 'dead') {
          const dt = time - (b.deadT0 === undefined ? time : b.deadT0);
          key = AT + '_down_side_' + (dt < 150 ? 0 : dt < 330 ? 1 : 2); bodyFrame = true; flipLeft = (b.deadDir || 1) > 0;
        } else {
          key = moving ? (b.t.walkTex || b.t.tex) + '_walk_' + wdir + '_' + wf : this.stillKey(b.t, b.facing);
        }
        if (b.sprite.texture.key !== key) {
          if (bodyFrame) this.setSpriteBodyTex(b.sprite, key, b.t.h); else this.setSpriteTex(b.sprite, key, b.t.h);
        }
        b.sprite.setFlipX(flipLeft);

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
        b.shadow.setAlpha(b.state === 'dead' ? 0 : b.state === 'enter' ? Math.min(1, (time - b.t0) / 600) : 1);

        if (b.state === 'dead') b.sprite.clearTint();
        else if (b.state === 'recover' && time - b.t0 < 160) b.sprite.setTintFill(0xffffff);   // 破綻提示：白光一閃
        else if (b.state === 'feint' && time - b.t0 < 120) b.sprite.setTintFill(0xffffff);      // 假動作：收招時白光一閃
        else if ((b.state === 'guard' || b.state === 'dodge') && time - b.t0 < REACT_DELAY) b.sprite.setTintFill(0xffffff);   // 反應前的提示
        else if (b.state === 'guard') b.sprite.setTint(0x9fb8d8);
        else if (time < b.flashUntil) b.sprite.setTint(0xff9a8a);
        else if (b.state === 'windup' && Math.floor(time / 70) % 2) b.sprite.setTint(0xffd27a);
        else if (b.t.tint) b.sprite.setTint(b.t.tint);   // 種類色調（暫代用）
        else b.sprite.clearTint();

        const fadeIn = b.state === 'enter' ? Math.min(1, (time - b.t0) / 600) : 1;
        if (b.state !== 'dead') b.sprite.setAlpha((b.state === 'dodge' && time - b.t0 >= REACT_DELAY ? 0.45 : 1) * fadeIn);
        b.alert.setVisible(b.state === 'windup' && (b.kind === 'lunge' || b.kind === 'heavy')).setPosition(bx, by - b.t.h - 2);
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
    const T = b.t;
    b.feintAt = 0;
    if (!fast) b.lastKind = b.kind;
    if (b.kind === 'slash') {
      b.windup = fast ? T.slashWindupFast : T.slashWindup;
      if (!fast) b.combo = Math.random() < T.pCombo ? 1 : 0;       // 偶爾連揮兩下
    } else if (b.kind === 'heavy') {
      b.windup = fast ? T.heavyWindupFast : T.heavyWindup;
      b.combo = 0;
    } else if (b.kind === 'thrust') {
      b.windup = fast ? T.thrustWindupFast : T.thrustWindup;
      if (!fast) b.combo = Math.random() < 0.5 ? 2 : 1;            // 連刺共 2 或 3 下
    } else {
      b.windup = fast ? T.windupFast : T.windup;
      b.combo = 0;                                             // 衝刺不連擊
    }
    // 假動作：普通起手（不是反擊的快速起手）的揮砍與重劈，有機率在前搖 60% 處取消
    if (!fast && T.pFeint && (b.kind === 'slash' || b.kind === 'heavy') && Math.random() < T.pFeint) b.feintAt = time + b.windup * 0.6;
    b.adx = ux; b.ady = uy;
  }

  // 各招式的參數（lane＝沿紅線往前推進的招式；其餘為原地範圍判定）
  moveStats(b) {
    const T = b.t;
    switch (b.kind) {
      case 'slash': return { kind: 'slash', aimLock: T.slashAimLock, strike: T.slashStrike, hitAt: T.slashHitAt, recover: T.slashRecover, reach: T.slashReach, r: T.slashR, dmg: T.dmgSlash };
      case 'heavy': return { kind: 'heavy', aimLock: T.heavyAimLock, strike: T.heavyStrike, hitAt: T.heavyHitAt, recover: T.heavyRecover, reach: T.heavyReach, r: T.heavyR, dmg: T.dmgHeavy };
      case 'thrust': return { kind: 'thrust', lane: true, aimLock: T.thrustAimLock, strike: T.thrustStrike, hitAt: T.thrustHitAt, recover: T.thrustRecover, speed: T.thrustSpeed, tip: T.tip, hw: T.thrustHW, dmg: T.dmgThrust };
      default: return { kind: 'lunge', lane: true, aimLock: T.aimLock, strike: T.strike, hitAt: T.hitAt, recover: T.recover, speed: T.lunge, tip: T.tip, hw: T.laneHW, dmg: T.dmgLunge };
    }
  }

  // 武將選招：依距離抽籤；上一招的權重打折，避免連續重複；打不到的招不選。回傳 null＝這次不出手
  pickKind(b, dist, preempt) {
    const T = b.t;
    const w = dist <= 44
      ? { slash: T.pSlashClose, thrust: T.pThrustClose, heavy: T.pHeavyClose, lunge: T.pLungeClose, feint: preempt ? 0 : T.pFeintClose }
      : { lunge: T.pLungeMid, thrust: T.pThrustMid, heavy: T.pHeavyMid, slash: T.pSlashMid, feint: 0 };
    if (dist > 54) w.slash = 0;                         // 揮砍夠不到
    if (dist > 64) { w.heavy = 0; w.thrust = 0; }       // 重劈與連刺也夠不到，只剩衝刺
    if (dist > 70) w.lunge = Math.max(w.lunge, 0.1);
    if (b.lastKind && w[b.lastKind]) w[b.lastKind] *= 0.4;
    let total = 0;
    for (const k in w) total += w[k] || 0;
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const k in w) { r -= w[k] || 0; if (r <= 0) return k; }
    return null;
  }

  // 搶先出刀選招：小兵精兵維持原樣（近揮砍、遠衝刺）；武將依距離抽籤，但一定是打得到的招
  preemptKind(b, dist) {
    if (!b.t.varied) return dist <= 60 ? 'slash' : 'lunge';
    return this.pickKind(b, dist, true);
  }

  // 閃躲殘影
  spawnGhost(b) {
    const s = b.sprite;
    const gh = this.add.image(s.x, s.y, s.texture.key).setOrigin(s.originX, s.originY)
      .setDisplaySize(s.displayWidth, s.displayHeight).setFlipX(s.flipX)
      .setAlpha(0.5).setTint(0x9fc7ff).setDepth(s.depth - 1);
    this.uiCam.ignore(gh);
    this.tweens.add({ targets: gh, alpha: 0, duration: 320, onComplete: () => gh.destroy() });
  }

  hitBandit(b, dx, dy, time) {
    const dmg = this.playerDmg();
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
      b.state = 'hurt'; b.until = time + b.t.stun; b.hurtT0 = time; b.hurtDur = b.t.stun;
      const m = Math.hypot(dx, dy) || 1;
      b.kx = dx / m * b.t.knock; b.ky = dy / m * b.t.knock;
      this.spawnDamage(b.body.x, b.body.y - b.t.h - 18, '破勢', '#9fd8ff');
    } else if (b.t.counterOnHit && (b.state === 'chase' || b.state === 'stalk' || b.state === 'rest' || b.state === 'pause')
               && Math.random() < b.t.counterOnHit && this.tokenFree(b)) {
      // 被打中沒破勢：立刻轉向反擊，反制打一刀就退
      const cx = this.playerBody.x - b.body.x, cy = this.playerBody.y + 4 - (b.body.y + 4), cd = Math.hypot(cx, cy) || 1;
      if (cd < b.t.counterRange) {
        this.startWindup(b, time, true, cx / cd, cy / cd, 'slash');
        b.windup = b.t.counterWindup; b.combo = 0;
      }
    } else if (b.state === 'recover' && b.t.recoverCounter && Math.random() < b.t.recoverCounter && this.tokenFree(b)) {
      // 破綻期被打中：打斷破綻，立刻反擊（只有武將；小兵精兵的 recoverCounter 為 0）
      const cx = this.playerBody.x - b.body.x, cy = this.playerBody.y + 4 - (b.body.y + 4), cd = Math.hypot(cx, cy) || 1;
      if (cd < b.t.counterRange) {
        this.startWindup(b, time, true, cx / cd, cy / cd, 'slash');
        b.windup = b.t.counterWindup; b.combo = 0;
      }
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
        this.spawnDamage(b.body.x, b.body.y - b.t.h - 4, '閃', '#bcd0e0');   // 讓你一眼看出他在閃
        b.reactCd = time + b.t.reactCdMs; b.dodgeCd = time + b.t.dodgeCdMs;
      } else if (b.t.preempt && time >= b.preemptCd && d <= b.t.preemptDist && this.tokenFree(b) && Math.random() < b.t.pPreempt) {
        // 沒防禦也沒閃：玩家出刀的當下，有機率搶先動手
        const pk = this.preemptKind(b, d);
        if (pk) {
          b.preemptCd = time + b.t.preemptCdMs;
          this.startWindup(b, time, false, dx / d, dy / d, pk);
        }
      }
    }
  }

  // 防禦擋住一下：傷害很少、玩家被彈開；擋滿三下破防
  blockBandit(b, dx, dy, time) {
    const dmg = Math.max(1, Math.round(this.playerDmg() * b.t.guardDmgMul));
    b.hp = Math.max(1, b.hp - dmg);
    b.guardHits++;
    this.hitstop(70);
    this.cameras.main.shake(60, 0.002);
    this.spawnDamage(b.body.x, b.body.y - b.t.h - 4, '擋 ' + dmg, '#bcd0e0');
    this.pk = { vx: -dx * 120, vy: -dy * 120, until: time + 110 };
    if (b.guardHits >= b.t.guardBreakHits) {
      b.state = 'hurt'; b.until = time + b.t.guardBreakStun; b.hurtT0 = time; b.hurtDur = b.t.guardBreakStun;
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
    this.gainKillXp(b);
    b.body.body.setVelocity(0, 0);
    b.body.body.enable = false;
    b.alert.setVisible(false); b.nameTag.setVisible(false);
    b.respawnAt = time + b.t.respawnMs;
    const dir = dx >= 0 ? 1 : -1;
    b.deadT0 = time; b.deadDir = dir;
    if (!b.t.animTex) this.tweens.add({ targets: b.sprite, angle: dir * 85, duration: 280, ease: 'Quad.easeIn' });   // 有倒下動畫的敵人不再用旋轉
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

  // ---------- 能力型成長 ----------
  loadGrowth() {
    this.lv = 1; this.xp = 0; this.pts = 0;
    this.stats = { hp: 0, sta: 0, atk: 0, def: 0 };
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && d.lv >= 1 && d.lv <= LV_CAP) {
        this.lv = d.lv; this.xp = Math.max(0, d.xp | 0);
        for (const k of STAT_KEYS) this.stats[k] = Math.max(0, (d.stats && d.stats[k]) | 0);
        const spent = STAT_KEYS.reduce((a, k) => a + this.stats[k], 0);
        this.pts = Math.max(0, (this.lv - 1) * PTS_PER_LV - spent);   // 以等級反推，防止存檔被改壞
      }
    } catch (e) {}
  }

  saveGrowth() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ lv: this.lv, xp: this.xp, stats: this.stats })); } catch (e) {}
  }

  maxHp() { return statMaxHp(this.stats.hp); }
  maxStam() { return statMaxStam(this.stats.sta); }
  playerDmg() {
    return Math.max(1, Math.round((PLAYER_DMG_MIN + Math.floor(Math.random() * PLAYER_DMG_RNG)) * statAtk(this.stats.atk)));
  }

  // 給經驗；回傳升了幾級
  addXp(n) {
    if (this.lv >= LV_CAP) return 0;
    this.xp += Math.round(n);
    let up = 0;
    while (this.lv < LV_CAP && this.xp >= xpNeed(this.lv)) {
      this.xp -= xpNeed(this.lv); this.lv++; this.pts += PTS_PER_LV; up++;
    }
    if (this.lv >= LV_CAP) this.xp = 0;
    if (up) this.banner('升級！等級 ' + this.lv + '\n+' + (up * PTS_PER_LV) + ' 能力點（安全時按左上「能力」）', 2400);
    this.saveGrowth();
    return up;
  }

  // 章節固定經驗（劇情結算時呼叫；不受等級影響）
  grantChapterXp(i) { return this.addXp(CHAPTER_XP[i] || 0); }

  gainKillXp(b) {
    const type = b.spawn.type, enemyLv = b.spawn.lv || 1;
    let xp = (KILL_XP[type] || 5) * enemyLv;
    if (this.lv >= enemyLv + 10) xp *= 0.25;
    xp = Math.max(1, Math.round(xp));
    this.spawnDamage(b.body.x, b.body.y - b.t.h - 18, '+' + xp + ' 經驗', '#e8d890');
    this.addXp(xp);
  }

  // 能力面板：只在安全時（走路中、擊退伏兵後）可開
  canOpenPanel() {
    const ph = this.stage && this.stage.phase;
    return !this.down && !this.cine && (ph === 'walk' || ph === 'cleared') && !this.atk && !this.roll;
  }

  panelBtnRect() { return { x: 13, y: 42, w: 64, h: 24 }; }

  buildPanel() {
    const mk = (o) => { o.setDepth(1100); this.ui.push(o); this.cameras.main.ignore(o); return o; };
    const tx = (size, color) => ({ fontFamily: 'system-ui, sans-serif', fontSize: size + 'px', color, stroke: '#000000', strokeThickness: 3 });
    this.lvText = mk(this.add.text(82, 45, '', tx(13, '#e8d890')).setDepth(1001));
    this.lvText.setDepth(1001);
    this.pnGfx = mk(this.add.graphics());
    this.pnBtnText = mk(this.add.text(0, 0, '能力', tx(14, '#e6f0dc')).setOrigin(0.5).setDepth(1001));
    this.pnTitle = mk(this.add.text(0, 0, '', tx(18, '#f0d890')).setOrigin(0.5, 0));
    this.pnRows = STAT_KEYS.map(k => ({
      k,
      name: mk(this.add.text(0, 0, STAT_NAMES[k], tx(17, '#e6f0dc'))),
      val: mk(this.add.text(0, 0, '', tx(13, '#c8d8c0'))),
      plus: mk(this.add.text(0, 0, '＋', Object.assign(tx(26, '#16201a'), { strokeThickness: 0 })).setOrigin(0.5)),
      minus: mk(this.add.text(0, 0, '－', Object.assign(tx(26, '#16201a'), { strokeThickness: 0 })).setOrigin(0.5)),
    }));
    this.pnReset = mk(this.add.text(0, 0, '重置', Object.assign(tx(16, '#16201a'), { strokeThickness: 0 })).setOrigin(0.5));
    this.pnClose = mk(this.add.text(0, 0, '關閉', Object.assign(tx(16, '#16201a'), { strokeThickness: 0 })).setOrigin(0.5));
    this.pnNote = mk(this.add.text(0, 0, '重置不用錢；點數可隨時重新分配', tx(12, '#a8b8a0')).setOrigin(0.5, 0));
    this.panelOpen = false;
    this.layoutPanel();
    this.setPanelVisible(false);
  }

  setPanelVisible(v) {
    this.pnGfx.setVisible(v); this.pnTitle.setVisible(v); this.pnReset.setVisible(v); this.pnClose.setVisible(v); this.pnNote.setVisible(v);
    for (const r of this.pnRows) { r.name.setVisible(v); r.val.setVisible(v); r.plus.setVisible(v); r.minus.setVisible(v); }
  }

  // 面板版面（置中；幾何用於繪製與點擊判定）
  layoutPanel() {
    const W = this.scale.width, H = this.scale.height;
    const pw = Math.min(W - 24, 360), rowH = 54, ph = 96 + rowH * 4 + 70;
    const px = (W - pw) / 2, py = Math.max(12, (H - ph) / 2);
    this.pn = { px, py, pw, ph, rowH, rows: [] };
    this.pnTitle.setPosition(W / 2, py + 12);
    STAT_KEYS.forEach((k, i) => {
      const y = py + 62 + i * rowH, r = this.pnRows[i];
      const bx = px + pw - 28, mx = px + pw - 28 - 60;
      this.pn.rows.push({ k, y, plus: { x: bx, y: y + 20, r: 22 }, minus: { x: mx, y: y + 20, r: 22 } });
      r.name.setPosition(px + 16, y); r.val.setPosition(px + 16, y + 24);
      r.plus.setPosition(bx, y + 20); r.minus.setPosition(mx, y + 20);
    });
    const by = py + 62 + rowH * 4 + 10;
    this.pn.reset = { x: px + pw * 0.27, y: by + 18, w: 100, h: 36 };
    this.pn.close = { x: px + pw * 0.73, y: by + 18, w: 100, h: 36 };
    this.pnReset.setPosition(this.pn.reset.x, this.pn.reset.y);
    this.pnClose.setPosition(this.pn.close.x, this.pn.close.y);
    this.pnNote.setPosition(W / 2, by + 44);
    this.pnBtnText.setPosition(13 + 32, 42 + 12);
  }

  openPanel() { this.panelOpen = true; this.joy.id = null; this.joy.active = false; this.joy.x = this.joy.y = this.joy.dx = this.joy.dy = 0; this.btn.held = false; this.layoutPanel(); this.setPanelVisible(true); }
  closePanel() { this.panelOpen = false; this.setPanelVisible(false); this.saveGrowth(); }

  // 回傳 true 表示這次點擊被面板／能力鈕吃掉
  panelPointer(p) {
    if (this.panelOpen) {
      const hit = (c) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r;
      const inRect = (r) => Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.y - r.y) <= r.h / 2;
      for (const r of this.pn.rows) {
        if (hit(r.plus) && this.pts > 0) { this.stats[r.k]++; this.pts--; this.afterStatChange(r.k, true); }
        else if (hit(r.minus) && this.stats[r.k] > 0) { this.stats[r.k]--; this.pts++; this.afterStatChange(r.k, false); }
      }
      if (inRect(this.pn.reset)) {
        for (const k of STAT_KEYS) { this.pts += this.stats[k]; this.stats[k] = 0; }
        this.php = Math.min(this.php, this.maxHp()); this.stam = Math.min(this.stam, this.maxStam());
      }
      if (inRect(this.pn.close)) this.closePanel();
      return true;
    }
    const r = this.panelBtnRect();
    if (this.canOpenPanel() && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.openPanel(); return true; }
    return false;
  }

  afterStatChange(k, plus) {
    if (k === 'hp') { if (plus) this.php += 3; this.php = Math.min(this.php, this.maxHp()); }   // 加點時順便補上增加的上限
    if (k === 'sta') { if (plus) this.stam += 5; this.stam = Math.min(this.stam, this.maxStam()); }
  }

  drawPanelUI() {
    const g = this.pnGfx, t = this.nowT || 0;
    g.clear();
    // 等級與經驗條（耐力條下方）
    const hg = this.hpGfx, can = this.canOpenPanel();
    const xr = this.lv >= LV_CAP ? 1 : this.xp / xpNeed(this.lv);
    hg.fillStyle(0x000000, 0.55); hg.fillRect(13, 38, 62, 4);
    hg.fillStyle(0x6a8fb8, 1); hg.fillRect(14, 39, 60 * xr, 2);
    this.lvText.setText('Lv ' + this.lv + (this.pts > 0 ? '  ★' + this.pts : ''));
    const r = this.panelBtnRect();
    g.fillStyle(0x16201a, can ? 0.6 : 0.25); g.fillRoundedRect(r.x, r.y, r.w, r.h, 6);
    g.lineStyle(2, 0xe6f0dc, can ? (this.pts > 0 && Math.floor(t / 500) % 2 ? 1 : 0.6) : 0.25); g.strokeRoundedRect(r.x, r.y, r.w, r.h, 6);
    this.pnBtnText.setAlpha((can ? 1 : 0.35) * (1 - this.cineK));
    g.setAlpha(1 - this.cineK);
    if (!this.panelOpen) return;
    const P = this.pn;
    g.fillStyle(0x000000, 0.55); g.fillRect(0, 0, this.scale.width, this.scale.height);
    g.fillStyle(0x16201a, 0.96); g.fillRoundedRect(P.px, P.py, P.pw, P.ph, 10);
    g.lineStyle(2, 0xe6f0dc, 0.7); g.strokeRoundedRect(P.px, P.py, P.pw, P.ph, 10);
    this.pnTitle.setText('能力　Lv ' + this.lv + '　剩餘點數 ' + this.pts);
    for (const row of P.rows) {
      const rr = this.pnRows.find(o => o.k === row.k), p = this.stats[row.k];
      rr.val.setText(p + ' 點　' + STAT_DESC[row.k](p));
      g.lineStyle(1, 0xe6f0dc, 0.15); g.lineBetween(P.px + 12, row.y - 4, P.px + P.pw - 12, row.y - 4);
      const okP = this.pts > 0, okM = p > 0;
      g.fillStyle(okP ? 0xd9b45a : 0x555044, 1); g.fillCircle(row.plus.x, row.plus.y, row.plus.r);
      g.fillStyle(okM ? 0xa8b8a0 : 0x444a40, 1); g.fillCircle(row.minus.x, row.minus.y, row.minus.r);
    }
    g.fillStyle(0xa8b8a0, 1); g.fillRoundedRect(P.reset.x - 50, P.reset.y - 18, 100, 36, 8);
    g.fillStyle(0xd9b45a, 1); g.fillRoundedRect(P.close.x - 50, P.close.y - 18, 100, 36, 8);
  }

  // ---------- 玩家受傷與倒下 ----------
  hurtPlayer(dmg, sx, sy, time) {
    if (this.down || this.cine || time < this.invulnUntil || (time >= this.rollIFrom && time < this.rollIUntil)) return false;
    dmg = Math.max(1, Math.round(dmg * (1 - statDef(this.stats.def))));
    this.php = Math.max(0, this.php - dmg);
    this.roll = null;
    this.invulnUntil = time + INVULN_MS;
    this.heroFlashUntil = time + 140;
    this.hurtStart = time;
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
      this.downStart = time;
      this.downText.setVisible(true);
    }
    return true;
  }

  respawnPlayer(time) {
    this.down = false; this.hurtStart = undefined;
    this.lockTarget = null;
    this.php = this.maxHp();
    this.invulnUntil = time + 1500;
    this.stam = this.maxStam(); this.roll = null;
    this.hero.setAngle(0);
    this.downText.setVisible(false);
    this.playerBody.body.reset(START.x, START.y);
    // 倒下＝整段重來：伏兵全部回到樹林裡，重新往上走
    for (const b of this.bandits) this.hideBandit(b);
    this.stage = { phase: 'walk', t0: 0 };
    this.bannerText.setVisible(false);
    this.cine = false; this.heroAlert.setVisible(false);
  }

  // ---------- 森林小道：伏擊流程 ----------
  updateStage(time) {
    const st = this.stage, py = this.playerBody.y;
    if (st.phase === 'walk' && !this.down && py < AMBUSH_Y) {
      // 出場動畫：黑條滑入、主角停住（無敵、不能操作），頭頂跳出紅色驚嘆號，伏兵慢慢走出來
      st.phase = 'intro'; st.t0 = time;
      this.cine = true; this.atk = null; this.roll = null; this.atkBuf = 0; this.rollBuf = 0;
      this.heroAlert.setVisible(true).setScale(0.6); this.heroAlertUntil = time + 1400;
      this.hintText.setVisible(false);
    }
    if (st.phase === 'intro' || st.phase === 'fight') {
      for (const b of this.bandits) if (b.hidden && time - st.t0 >= b.spawn.delay) this.revealBandit(b, time);
    }
    if (st.phase === 'intro' && time - st.t0 >= CINE_MS) { st.phase = 'fight'; this.cine = false; }
    // 黑條與操作介面跟著 cine 淡入淡出
    const k = this.cineK = Math.max(0, Math.min(1, this.cineK + (this.cine ? 1 : -1) * 0.06));
    const bh = Math.round(this.scale.height * 0.11 * k), W = this.scale.width;
    this.barTop.setSize(W, bh).setVisible(bh > 0); this.barBot.setPosition(0, this.scale.height - bh).setSize(W, bh).setVisible(bh > 0);
    for (const o of [this.joyGfx, this.btnGfx, this.btnText, this.dgGfx, this.dgText, this.hpGfx, this.hpText, this.lvText, this.pnBtnText]) o.setAlpha(1 - k);
    if (st.phase === 'fight') {
      if (this.bandits.every(b => !b.hidden && b.dead)) { st.phase = 'cleared'; this.banner('擊退伏兵\n往北前進', 2800); }
    }
    if (st.phase === 'cleared' && !this.down && py < EXIT_Y) {
      st.phase = 'end'; st.t0 = time;
      this.banner('本段結束', 3000);
    }
    if (st.phase === 'end' && time - st.t0 > 3400) this.respawnPlayer(time);   // 自動重來，方便反覆測試
  }

  // 擋在角色前面的樹變半透明，打鬥時看得到人（每 0.1 秒檢查一次）
  fadeTrees(time) {
    if (time - (this.fadeT || 0) < 100) return;
    this.fadeT = time;
    const who = [{ x: this.playerBody.x, y: this.playerBody.y + 4, h: HERO_H }];
    for (const b of this.bandits) if (!b.hidden && b.state !== 'dead') who.push({ x: b.body.x, y: b.body.y + 4, h: b.t.h });
    for (const t of this.forestTrees) {
      let cover = false;
      for (const u of who) {
        if (u.y < t.y && u.y > t.y - t.h - 4 && Math.abs(u.x - t.x) < t.hw + 8) { cover = true; break; }
      }
      if (cover !== t.faded) { t.faded = cover; t.img.setAlpha(cover ? 0.4 : 1); }
    }
  }

  banner(msg, ms) {
    const t = this.bannerText;
    this.tweens.killTweensOf(t);
    t.setText(msg).setAlpha(1).setVisible(true);
    this.hintText.setVisible(false);   // 不和操作說明疊在一起
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 500, onComplete: () => t.setVisible(false) });
  }

  // 伏兵藏起來：看不到、碰不到、打不到（dead 旗標讓所有鎖定與判定都跳過）
  hideBandit(b) {
    this.tweens.killTweensOf(b.sprite);
    b.hidden = true; b.dead = true; b.state = 'hidden';
    b.hp = b.t.hp; b.poise = b.t.poise; b.combo = 0; b.feintAt = 0; b.lastKind = null;
    b.body.body.reset(b.spawn.x, b.spawn.y - 4); b.body.body.enable = false;
    b.sprite.setVisible(false).setAngle(0).setAlpha(1).clearTint();
    b.shadow.setVisible(false);
    b.alert.setVisible(false); b.nameTag.setVisible(false);
    b.respawnAt = Infinity;
    if (this.lockTarget === b) this.lockTarget = null;
  }

  revealBandit(b, time) {
    b.hidden = false; b.dead = false; b.state = 'enter'; b.t0 = time;
    b.body.body.enable = true; b.body.body.reset(b.spawn.x, b.spawn.y - 4);
    b.sprite.setVisible(true).setAlpha(0); b.shadow.setVisible(true).setAlpha(0);   // 從樹林陰影裡慢慢浮現（見 updateBandits 的 fadeIn）
    b.reactCd = time + 600; b.preemptCd = time + 600;   // 剛衝出來先不防禦、不搶先出刀
  }

  // ---------- 森林小道：地面、樹、看不見的牆 ----------
  buildForest() {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // 1. 先決定樹的位置：小道與空地以外，錯開的格子＋隨機偏移
    const trees = [];
    for (let gy = 10, row = 0; gy < MAP_H + 60; gy += 34, row++) {
      for (let gx = (row % 2) * 22 - 10; gx < MAP_W + 30; gx += 44) {
        const x = gx + (rnd() - 0.5) * 22, y = gy + (rnd() - 0.5) * 16;
        if (walkable(x, y) || walkable(x, y - 8) || walkable(x - 10, y) || walkable(x + 10, y)) continue;
        const r = rnd(), kind = r < 0.38 ? 0 : r < 0.72 ? 1 : 2;           // 松、櫟、柏
        const baseH = [104, 98, 118][kind] * (0.88 + rnd() * 0.26);
        trees.push({ x, y, kind, h: baseH, flip: rnd() < 0.5, shade: 0.74 + rnd() * 0.26 });
      }
    }
    // 2. 地面：林地與泥土兩張圖鋪滿，小道與林地交界用噪點做出不規則的草泥過渡（只畫一次、之後當一張圖，手機比較省）
    const C = 2, cw = Math.ceil(MAP_W / C), ch = Math.ceil(MAP_H / C), TW = 72;   // 一格地磚在世界裡約 144 單位
    const tileData = key => {
      const c = document.createElement('canvas'); c.width = c.height = TW;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(this.textures.get(key).getSourceImage(), 0, 0, TW, TW);
      return x.getImageData(0, 0, TW, TW).data;
    };
    const fl = tileData('forest_floor'), dt = tileData('dirt_path');
    // 「可走」遮罩：每 4 單位一格，模糊後當作泥土比例
    const M = 4, mw = Math.ceil(MAP_W / M), mh = Math.ceil(MAP_H / M);
    let m = new Float32Array(mw * mh);
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) m[j * mw + i] = walkable(i * M + 2, j * M + 2) ? 1 : 0;
    const blur = (src, r) => {
      const a = new Float32Array(src.length), b = new Float32Array(src.length);
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const q = i + k; if (q >= 0 && q < mw) { t += src[j * mw + q]; n++; } } a[j * mw + i] = t / n; }
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const q = j + k; if (q >= 0 && q < mh) { t += a[q * mw + i]; n++; } } b[j * mw + i] = t / n; }
      return b;
    };
    m = blur(blur(m, 2), 2);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d'), img = g.createImageData(cw, ch), od = img.data;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const v = m[Math.min(mh - 1, Math.floor(j * C / M)) * mw + Math.min(mw - 1, Math.floor(i * C / M))];
        const dirt = v + (rnd() - 0.5) * 0.55 > 0.5;
        const src = dirt ? dt : fl, o = ((j % TW) * TW + (i % TW)) * 4, d = (j * cw + i) * 4;
        // 林地越靠樹林深處越暗一點
        const k = dirt ? 1 : 0.78 + 0.22 * Math.min(1, v * 3);
        od[d] = src[o] * k; od[d + 1] = src[o + 1] * k; od[d + 2] = src[o + 2] * k; od[d + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // 樹下的陰影
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (const t of trees) { const w = t.h * 0.7; g.beginPath(); g.ellipse(t.x / C, t.y / C, w * 0.42 / C, w * 0.15 / C, 0, 0, Math.PI * 2); g.fill(); }
    this.textures.addCanvas('forest_ground', cv).setFilter(Phaser.Textures.FilterMode.NEAREST);   // 放大時保持像素硬邊
    this.world.push(this.add.image(0, 0, 'forest_ground').setOrigin(0).setScale(C).setDepth(-20));
    this.textures.remove('forest_floor'); this.textures.remove('dirt_path');   // 原圖用完就釋放
    // 3. 樹：依腳底 y 排前後
    this.forestTrees = [];
    for (const t of trees) {
      const key = 'forest_tree_0' + (t.kind + 1) + '_k', tex = this.textures.get(key).getSourceImage(), h = t.h, w = h * tex.width / tex.height;
      const v = Math.round(255 * t.shade), tint = (v << 16) | (v << 8) | v;
      const img = this.add.image(t.x, t.y, key).setOrigin(0.5, 1).setDisplaySize(w, h)
        .setFlipX(t.flip).setTint(tint).setDepth(t.y);
      this.world.push(img);
      this.forestTrees.push({ img, x: t.x, y: t.y, hw: w * 0.42, h: h * 0.92, faded: false });
    }
    // 3b. 灌木、石頭、倒木：林緣散放（不擋路）；空地邊緣另放幾個會擋路的石頭與倒木
    this.propBlocks = [];
    const place = (key, x, y, h, block, flip) => {
      const tex = this.textures.get(key).getSourceImage(), w = h * tex.width / tex.height;
      const img = this.add.image(x, y, key).setOrigin(0.5, 1).setDisplaySize(w, h).setFlipX(!!flip).setDepth(y);
      this.world.push(img);
      if (block) this.propBlocks.push({ x, y: y - 3, w: w * 0.8, h: 8 });
    };
    const rim = [];   // 緊貼小道與空地外緣的林地點
    for (let y = 20; y < MAP_H - 20; y += 12) for (let x = 14; x < MAP_W - 14; x += 12) {
      if (walkable(x, y)) continue;
      if (walkable(x - 14, y) || walkable(x + 14, y) || walkable(x, y - 14) || walkable(x, y + 14)) rim.push([x, y]);
    }
    const pick = () => rim.splice(Math.floor(rnd() * rim.length), 1)[0];
    for (let n = 0; n < 26 && rim.length; n++) { const [x, y] = pick(); place('bush_01_k', x + (rnd() - 0.5) * 8, y, 26 + rnd() * 10, false, rnd() < 0.5); }
    for (let n = 0; n < 8 && rim.length; n++) { const [x, y] = pick(); place('rock_01_k', x, y, 18 + rnd() * 8, false, rnd() < 0.5); }
    for (let n = 0; n < 4 && rim.length; n++) { const [x, y] = pick(); place('log_01_k', x, y, 18, false, rnd() < 0.5); }
    // 空地邊緣：擋路的石頭與倒木（避開小道出入口與伏兵衝出的位置）
    place('rock_01_k', 100, 505, 26, true, false);
    place('rock_01_k', 362, 500, 24, true, true);
    place('rock_01_k', 322, 655, 22, true, false);
    place('log_01_k', 118, 628, 20, true, false);
    place('bush_01_k', 372, 628, 30, false, true);

    // 4. 看不見的牆：小道、空地、側小徑以外都走不進去（每列連續的區段合併，再把上下相同的合併）
    this.obstacles = this.physics.add.staticGroup();
    const S = 8, open = [];
    for (let y = 0; y < MAP_H; y += S) {
      const runs = []; let x0 = null;
      for (let x = 0; x <= MAP_W; x += S) {
        const blocked = x < MAP_W && !walkable(x + S / 2, y + S / 2);
        if (blocked && x0 === null) x0 = x;
        if (!blocked && x0 !== null) { runs.push([x0, x]); x0 = null; }
      }
      const next = [];
      for (const r of runs) {
        const o = open.find(q => q.x0 === r[0] && q.x1 === r[1] && q.y1 === y);
        if (o) { o.y1 = y + S; next.push(o); } else { const q = { x0: r[0], x1: r[1], y0: y, y1: y + S }; open.push(q); next.push(q); }
      }
    }
    for (const q of open) {
      const z = this.add.zone((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.x1 - q.x0, q.y1 - q.y0);
      this.physics.add.existing(z, true);
      this.obstacles.add(z);
    }
    for (const b of this.propBlocks) {   // 空地裡擋路的石頭與倒木
      const z = this.add.zone(b.x, b.y, b.w, b.h);
      this.physics.add.existing(z, true);
      this.obstacles.add(z);
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
      if (b.state === 'windup' && (b.kind === 'lunge' || b.kind === 'thrust' || b.kind === 'heavy')) {
        const mv = this.moveStats(b);
        const wt = time - b.t0, k = Math.min(1, wt / b.windup);
        const locked = wt >= b.windup - mv.aimLock;
        lg.fillStyle(locked ? 0xffffff : 0xe8604a, locked ? 0.45 : 0.10 + 0.22 * k);
        if (mv.lane) {
          // 紅線長度與寬度＝實際判定（衝刺距離＋刀尖、紅線半寬），畫多長就打多遠
          const len = mv.speed * mv.strike / 1000 + mv.tip;
          const bx0 = b.body.x, by0 = b.body.y + 4, hw = mv.hw;
          const nx = -b.ady, ny = b.adx;
          const x1 = bx0 + b.adx * len, y1 = by0 + b.ady * len;
          lg.fillPoints([
            { x: bx0 + nx * hw, y: by0 + ny * hw }, { x: x1 + nx * hw, y: y1 + ny * hw },
            { x: x1 - nx * hw, y: y1 - ny * hw }, { x: bx0 - nx * hw, y: by0 - ny * hw },
          ], true);
        } else {
          // 重劈：地上一個紅圈，就是落刀的範圍
          lg.fillCircle(b.body.x + b.adx * mv.reach, b.body.y + 4 + b.ady * mv.reach, mv.r);
        }
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
    const dmg = this.playerDmg();
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
    const k = this.facing === 'up' ? 1 : 0.5;   // 有揮刀圖的方向，劍光淡一點，不蓋住刀
    g.lineStyle(8, 0xcfe8d8, (1 - t) * 0.35 * k);
    g.beginPath(); g.arc(cx, cy, r, startA, curA, false); g.strokePath();
    g.lineStyle(3, 0xffffff, (1 - t) * k);
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
    hg.fillStyle(this.php / this.maxHp() > 0.3 ? 0x7fae5a : 0xc0503a, 1);
    hg.fillRect(14, 14, hw * Math.max(0, this.php) / this.maxHp(), 12);

    // 耐力條（血條下方）：見底時閃紅
    const nt = this.nowT || 0, sw = 90;
    hg.fillStyle(0x000000, 0.55); hg.fillRect(13, 29, sw + 2, 9);
    hg.fillStyle(0x3a3520, 1); hg.fillRect(14, 30, sw, 7);
    const flash = nt < this.stamFlash && Math.floor(nt / 80) % 2;
    hg.fillStyle(flash ? 0xc0503a : 0xd9b45a, 1);
    hg.fillRect(14, 30, sw * Math.max(0, this.stam) / this.maxStam(), 7);

    this.drawPanelUI();

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
    this.dgText.setPosition(dp.x, dp.y).setAlpha((tired ? 0.5 : 1) * (1 - this.cineK));

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
