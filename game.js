// 大江湖 · 森林小道伏擊（Phaser 3）
'use strict';

let MAP_W = 460, MAP_H = 1120;   // 目前區域的大小（切換區域時改變）
const AREAS = {
  forest: { w: 460, h: 1120, bg: '#16201a', name: '森林小道' },
  town:   { w: 1400, h: 420,  bg: '#1c1a16', name: '鎮內' },
  field:  { w: 760, h: 1000, bg: '#16201a', name: '幽州 · 討黃巾' },
};

// ---------- 室內（祠堂、之後的店舖）----------
// 一種室內 = 一份版面（座標，單位和世界一樣）＋多個城市版本（只指定圖檔）。
// 主角在哪個城市進門，就載入那個城市的版本；找不到就用 'town' 版。
// 某個城市的格局真的不同時，在該版本加 layout: { ... }，只覆蓋要改的欄位。
// 圖片規格：高清、每單位約 7 像素（和主角、建築同密度），洋紅 #FF00FF 當透明；圖的長寬比要等於 w:h。
let CURRENT_CITY = 'town';       // 目前所在城市（之後有別的城市時，進城時改這個）
const INTERIORS = {
  shrine: {
    name: '祠堂', bg: '#0c0a08',
    w: 210, h: 308,
    doorLight: { x: 74, y: 277, w: 62 },                          // 門洞外透進來的亮光（到房間底邊）
    blocks: [                                                     // 碰撞方塊 [x0, y0, x1, y1]；x1 = 'W'、y1 = 'H' 代表到邊
      [0, 0, 26, 'H'], [184, 0, 'W', 'H'],                        // 左右牆
      [0, 0, 'W', 117],                                           // 後牆、供桌與桌腳（含牌位、香爐）
      [0, 273, 74, 'H'], [136, 273, 'W', 'H'],                    // 門兩側的牆
    ],
    camps: [{ x: 105, y: 138 }],                                  // 參拜的位置（供桌前、小香爐正前方）
    exit: { x0: 77, x1: 133, y0: 288, to: 'town', spawn: () => ({ x: SHRINE_POS.x, y: SHRINE_POS.y + 34 }), facing: 'down' },
    fx: [{ type: 'incense', x: 106, y: 79 }],                     // 小香爐的煙（向左飄）
    variants: {
      town: { image: 'shrine_interior_v5.png' },
    },
  },
};
const isInterior = a => !!INTERIORS[a];
// 取得某種室內在某個城市的完整版面（共用版面＋該版本的覆蓋）
function interiorLayout(type, city = CURRENT_CITY) {
  const I = INTERIORS[type], key = I.variants[city] ? city : 'town', v = I.variants[key];
  return Object.assign({}, I, v.layout || {}, { variantKey: key, image: v.image, texKey: 'int_' + type + '_' + key + '_k' });
}
// 區域資訊（森林、鎮內、室內都從這裡拿大小、背景色、名稱）
function areaInfo(a) {
  if (isInterior(a)) { const L = interiorLayout(a); return { w: L.w, h: L.h, bg: L.bg, name: L.name }; }
  return AREAS[a];
}
// 進門時主角出現的位置（預設在房間下方正中）
function interiorEntry(type) { const L = interiorLayout(type); return L.entry || { x: L.w / 2, y: L.h * 0.83 }; }
// 香煙：算出每一縷煙在某一刻的位置、大小、透明度（越往上越偏左、越淡）
function incensePuffs(time, fx) {
  const N = 7, LIFE = 3600, out = [];
  for (let i = 0; i < N; i++) {
    const t = ((time + i * LIFE / N) % LIFE) / LIFE;          // 0→1
    out.push({
      x: fx.x + Math.sin(t * 6 + i * 1.7) * (0.8 + 2 * t) - 12 * t,
      y: fx.y - t * 26,
      r: 0.9 + t * 2.6,
      a: 0.6 * (1 - t) * Math.min(1, t * 8),
    });
  }
  return out;
}

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
// ---------- 幽州戰場（討黃巾）：大片林間空地，下方一條小路從森林小道接進來 ----------
const FIELD_C = { x: 380, y: 470, rx: 320, ry: 370 };   // 戰場空地（不規則橢圓）
const FIELD_START = { x: 380, y: 960 };                  // 從森林小道上來的位置
const FIELD_TRIGGER_Y = 820;                             // 走進空地就開戰
function fieldWalkable(x, y) {
  if (y < 6 || y > MAP_H - 6 || x < 6 || x > MAP_W - 6) return false;
  const dx = (x - FIELD_C.x) / FIELD_C.rx, dy = (y - FIELD_C.y) / FIELD_C.ry, a = Math.atan2(dy, dx);
  const edge = 1 + 0.07 * Math.sin(a * 5 + 0.6) + 0.04 * Math.sin(a * 9 + 2.1);   // 邊緣起伏，不要正圓
  if (dx * dx + dy * dy < edge * edge) return true;
  return y > FIELD_C.y + FIELD_C.ry * 0.7 && Math.abs(x - (FIELD_C.x + 10 * Math.sin(y / 60))) < 46;   // 下方小路
}
// 黃巾從空地邊緣的樹林裡冒出來（下方入口那一側不出兵）；x,y：現身處，ex,ey：衝進空地的落點
const FIELD_SPAWNS = [-170, -150, -130, -110, -90, -70, -50, -30, -10, 10, 30, 150, 170].map(d => {
  const a = d * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
  return { x: FIELD_C.x + c * FIELD_C.rx * 0.84, y: FIELD_C.y + si * FIELD_C.ry * 0.84,
           ex: FIELD_C.x + c * FIELD_C.rx * 0.55, ey: FIELD_C.y + si * FIELD_C.ry * 0.55 };
});
// 戰場生成器：同時活躍的敵人有上限（手機效能保證），其餘在待命隊列，有人倒下或時間到才補入
const FIELD_BATTLE = {
  name: '幽州 · 討黃巾',
  cap: 12,            // 同時在場上的敵人上限
  startActive: 6,     // 開戰時先上幾個
  rampMs: 5000,       // 之後每隔這麼久，場上人數上限 +1，直到 cap
  gapMs: 700,         // 兩個敵人現身至少隔這麼久
  roster: [].concat(Array(8).fill('turban'), ['bandit'], Array(12).fill('turban'), ['bandit']),   // 出場順序（共 22）
};
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
const VERSION = 'v0.15.0';   // 每次更新請加一
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

// ---------- 能力型成長（黑魂式：在祠堂花經驗升級）----------
// 等級 = 1 + 四項能力投入點數總和；每項最高 50 點，總等級最高 201
// 升級（加 1 點）所需經驗 = 50 × 目前等級；經驗是貨幣，只能在祠堂花用
const STAT_CAP = 50;
const STAT_KEYS = ['hp', 'sta', 'atk', 'def'];
const MAX_LV = 1 + STAT_KEYS.length * STAT_CAP;
const xpNeed = lv => 50 * lv;
// 擊殺經驗：基礎值 × 敵人等級；玩家等級 ≥ 敵人等級 + 10 時，只剩 25%。整場戰鬥結束才結算
const KILL_XP = { turban: 8, hansoldier: 25, bandit: 120 };
const CHAPTER_XP = [13860, 13860, 13860, 13860, 13860, 13860, 13860];   // 章節固定經驗（劇情結算時才發，尚未接上）
const STAT_NAMES = { hp: '生命力', sta: '氣力', atk: '攻擊力', def: '防禦力' };
const statMaxHp = p => 100 + 3 * p;
const statMaxStam = p => 100 + 5 * p;
const statAtk = p => 1 + 0.01 * p;
const statDef = p => 0.008 * p;
const STAT_DESC = {
  hp: p => '氣血上限 ' + statMaxHp(p),
  sta: p => '氣力上限 ' + statMaxStam(p),
  atk: p => '傷害 ×' + statAtk(p).toFixed(2),
  def: p => '減傷 ' + (statDef(p) * 100).toFixed(1).replace('.0', '') + '%',
};
// 升級的地方：祠堂內的祭壇（參拜）
const CAMP_R = 70;

// 鎮內（橫向地圖）：只有一條橫向大街；街的上方與下方都排滿緊貼的建築
const TOWN_ROAD = { y: 300, hw: 28 };
const TOWN_START = { x: 90, y: 300 };         // 出生點：大街西端
const TOWN_GATE = { x: 1330, y: 300 };        // 鎮門：大街東端（往森林）；從森林回來也站這裡
// 鎮內 NPC：暫用官軍站立圖（tint 區分），之後換正式美術；對話文字為測試用
const NPC_R = 44;   // 走到這個距離內才出現「對話」鈕
const NPCS = [   // look＝外觀（assets/characters/npc_<look>_walk_*.png）；lines＝第一次對話；chat＝之後隨機說的閒話；shop＝商店
  { id: 'guard', name: '鎮門守衛', x: 1290, y: 274, look: 'hunter', face: 'left',
    lines: ['站住……啊，是本鎮的人。',
            '東邊鎮門外就是林間小道，聽說最近黃巾賊常在那一帶出沒。',
            '前幾天有個貨郎說，林子裡的賊人不只一夥，還有個領頭的，使一手好刀。',
            '要出去的話，先到祠堂拜一拜，補足精神再走。'],
    chat: ['這道門我守了五年，從沒像今年這樣不安心。',
           '夜裡聽見林子裡有動靜，我也不敢睡死。',
           '遇到賊人別硬拚，看準他出手的空檔再還手。',
           '聽說外頭有人在招義勇……算了，當我沒說。',
           '鎮上有祠堂、有藥鋪，比外頭安穩多了。'] },
  { id: 'elder', name: '老村民', x: 480, y: 326, look: 'elder_man', face: 'right',
    lines: ['年輕人，亂世不太平啊。',
            '今年的收成又被官差收走一半，剩下的連過冬都不夠。',
            '祠堂在大街正中。進去參拜，能把身子骨練得更結實。',
            '藥壺用完也別慌，拜過祠堂就會補滿。'],
    chat: ['我這雙手種了一輩子地，如今連地都快守不住了。',
           '黃巾賊多半也是窮苦人出身，只是走錯了路。',
           '大街上人來人往，聽聽各家的閒話，總有用得上的。',
           '出門在外，肚子餓了就吃，別硬撐。',
           '年輕人，路上小心，這世道不比從前。'] },
  { id: 'merchant', name: '雜貨商販', x: 900, y: 326, look: 'vendor', face: 'right',
    lines: ['客官，要買點傷藥還是丹藥？',
            '金創藥止血療傷，行氣丹提振氣力，都是我親手配的。'],
    chat: ['小本生意，童叟無欺，客官隨便看。',
           '這年頭路不好走，貨也難進，價錢只能這樣了。',
           '前幾天過林子差點被劫，貨全靠運氣保住的。',
           '要什麼自己挑，缺了什麼我下回進貨幫你留意。'],
    shop: [{ id: 'jc', price: 10 }, { id: 'xq', price: 15 }] },
];
const TALKED = {};   // 本次遊戲已經跟哪些 NPC 說過話（第一次說完整對話，之後隨機閒話）
// ---------- 分層路人：基礎人偶＋零件（淺灰單色），執行時染色、疊合 ----------
// 檔案：assets/characters/npc_<零件名>_walk_<front|back|side>.png（2048×512，4 格）。新增零件：把檔名（不含 npc_ 與方向）加進下面欄位即可
const PED_PARTS = {
  bottom: ['bottom_a'],
  top:    ['top_a'],
  hair:   ['hair_a'],
  // 之後：face: ['face_a'…]、beard: ['beard_a'…]、hat: ['hat_a'…]、top 加 robe_a / vest_a / cape_a 等
};
const PED_ORDER = ['base', 'bottom', 'top', 'face', 'beard', 'hair', 'hat'];   // 由下往上疊
const PED_COLORS = {   // 欄位 → 可選染色（RGB）
  skin:  [[244, 206, 168], [228, 186, 142], [204, 154, 112], [176, 124, 88], [250, 224, 200]],
  cloth: [[110, 140, 190], [190, 110, 80], [120, 160, 110], [205, 185, 140], [160, 150, 135], [210, 170, 80], [150, 110, 70], [90, 110, 150], [190, 170, 130], [120, 125, 118]],
  hair:  [[50, 40, 38], [90, 60, 45], [70, 55, 45], [110, 105, 100], [30, 28, 28]],
  hat:   [[200, 175, 110], [150, 120, 80], [180, 170, 150]],
};
const PED_SLOT_COLOR = { base: 'skin', face: 'skin', bottom: 'cloth', top: 'cloth', beard: 'hair', hair: 'hair', hat: 'hat' };
const NPC_MEN = ['farmer', 'porter', 'fisher', 'smith', 'vendor', 'scholar', 'hunter', 'refugee'];
const NPC_WOMEN = ['farmwife', 'vegseller', 'washerwoman', 'innkeeper', 'maiden', 'villager_girl', 'maid'];
const NPC_OLD = ['elder_man', 'elder_woman', 'old_fisher', 'old_sage'];
const NPC_KIDS = ['child_boy', 'child_girl', 'child_beggar', 'child_shepherd'];   // 孩童在遊戲裡縮到 0.7 倍
const ALL_NPC_IDS = [...NPC_MEN, ...NPC_WOMEN, ...NPC_OLD, ...NPC_KIDS];   // 要載入的單一角色（assets/characters/npc_<id>_walk_<方向>.png）
// 在大街上走動的路人：固定 NPC 用掉的（elder_man、vendor、hunter）不再重複出現
const WALKER_IDS = ['porter', 'fisher', 'smith', 'scholar', 'refugee', 'farmer', ...NPC_WOMEN, 'elder_woman', 'old_fisher', 'old_sage', ...NPC_KIDS];
const PED_COUNT = 0;   // 分層路人暫停（品質不如敵人）；改用單一角色後再開
const PED_DIRS = ['front', 'back', 'side'];
const PED_KEYED = {};   // 去洋紅後的零件圖快取（跨場景重啟共用）
// 貨幣「五銖」：平常不顯示，只在商店裡顯示；敵人倒下固定掉落一小袋
// 五銖掉落：[機率, 最少, 最多]，數量在範圍內隨機
const WZ_DROP = { turban: [0.4, 1, 1], hansoldier: [0.6, 2, 4], bandit: [0.8, 8, 12] };
const SHRINE_POS = { x: 700, y: 268 };        // 祠堂底邊中心（台階前緣），在大街北側正中
// ---------- 背包與道具 ----------
const FLASK_MAX = 3;                    // 藥壺容量與初始數量，參拜祠堂補滿
const DRINK_MS = 900, DRINK_HEAL_AT = 600;   // 喝藥時間；中途被打中會中斷、不回血
const DRINK_MOVE = 0.35;                // 喝藥時移動速度倍率
const ITEM_ORDER = ['flask', 'jc', 'xq', 'cloth'];
const ITEMS = {
  flask: { name: '藥壺', desc: '回復氣血 40%；參拜祠堂補滿', kind: 'hp', pct: 0.4 },
  jc:    { name: '金創藥', desc: '回復氣血 30%', kind: 'hp', pct: 0.3 },
  xq:    { name: '行氣丹', desc: '回復氣力 60%', kind: 'stam', pct: 0.6 },
  cloth: { name: '破布', desc: '沒什麼用的雜物', kind: 'misc' },
};
// 掉落：[道具, 機率]，每個敵人倒下時各擲一次
const DROPS = {
  // 全部為機率制，沒有保證掉落
  turban: [['jc', 0.08], ['xq', 0.03]],
  hansoldier: [['jc', 0.15], ['xq', 0.05]],
  bandit: [['jc', 0.7], ['jc', 0.25], ['xq', 0.25]],
};
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

  init(data) {
    this.boot = !data || !data.area;
    this.area = (data && data.area) || 'town';
    this.spawnAt = (data && data.spawn) || null;
    this.spawnFacing = (data && data.facing) || 'up';
    this.carry = (data && data.carry) || null;
    this.transitioning = false;
    MAP_W = areaInfo(this.area).w; MAP_H = areaInfo(this.area).h;
  }

  preload() {
    const A = 'assets/';
    this.load.image('hero_front', A + 'characters/hero_front.png');
    this.load.image('hero_back', A + 'characters/hero_back.png');
    this.load.image('hero_side', A + 'characters/hero_side.png');
    this.load.image('hero_walk_side', A + 'characters/hero_walk_side.png');
    this.load.image('hero_walk_front', A + 'characters/hero_walk_front.png');
    this.load.image('hero_walk_back', A + 'characters/hero_walk_back.png');
    for (const id of ALL_NPC_IDS) for (const d of PED_DIRS) this.load.image('npcsrc_' + id + '_' + d, A + 'characters/npc_' + id + '_walk_' + d + '.png');
    if (PED_COUNT > 0) for (const nm of ['base', ...Object.values(PED_PARTS).flat()])
      for (const d of PED_DIRS) this.load.image('npc_' + nm + '_' + d, A + 'characters/npc_' + nm + '_walk_' + d + '.png');
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
    this.load.image('shrine_exterior', A + 'buildings/shrine_exterior_v4.png');
    for (const t of Object.keys(INTERIORS)) { const L = interiorLayout(t); this.load.image('int_' + t + '_' + L.variantKey, A + L.image); }   // 只載入目前城市的版本
    for (const n of ['house_a', 'house_b', 'shop', 'courtyard_gate']) this.load.image(n, A + 'buildings/' + n + '.png');
    this.load.image('stone_floor', A + 'tiles/stone_floor.png');
    for (let k = 1; k <= 4; k++) this.load.image('road_t' + k, A + 'tiles/town_road_tile_0' + k + '.png');
    this.load.image('town_grass', A + 'tiles/town_grass.png');
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
    if (!this.game.texReady) this.prepareTextures();
    this.buildScene();
  }

  // 室內圖：去洋紅但不裁切（尺寸要和地圖一樣）。已做過就直接回傳貼圖名稱
  keyInterior(type) {
    const L = interiorLayout(type);
    if (this.textures.exists(L.texKey)) return L.texKey;
    const im = this.textures.get('int_' + type + '_' + L.variantKey).getSourceImage(), c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i] > 180 && p[i + 1] < 110 && p[i + 2] > 180) p[i + 3] = 0;
    g.putImageData(d, 0, 0);
    this.textures.addCanvas(L.texKey, c);
    return L.texKey;
  }

  // 去背素材（只做一次；切換區域重啟場景時不用重做）
  prepareTextures() {
    this.keyTex('shrine_exterior', 'shrine_ext_k');
    for (const t of Object.keys(INTERIORS)) this.keyInterior(t);
    for (const n of ['house_a', 'house_b', 'shop', 'courtyard_gate']) this.keyTex(n, n + '_k');
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
    for (const id of ALL_NPC_IDS) for (const d of PED_DIRS)   // 單一角色：去洋紅並裁成 4 格
    { keyAndTrimFrames(this.textures.get('npcsrc_' + id + '_' + d).getSourceImage(), 4, 1)
        .forEach((cv, i) => this.textures.addCanvas('npcw_' + id + '_' + d + '_' + i, cv));
      this.textures.remove('npcsrc_' + id + '_' + d); }   // 處理完馬上釋放原圖，手機記憶體才不會爆
    this.makePeds();   // 分層路人：先疊好染色後的貼圖，零件原圖隨後釋放
    // 去背完成：原始大圖（共約 100MB）之後不會再用，釋放掉，減輕手機（尤其 iPhone）的記憶體壓力；地磚 stone 要保留
    for (const k of this.textures.getTextureKeys()) {
      if (k.startsWith('__') || k.startsWith('road_t') || k === 'forest_floor' || k === 'dirt_path' || k === 'stone_floor' || k === 'town_grass') continue;   // 路磚留到 buildTown 用完再釋放   // 兩張地面圖要留到 buildForest 用完再釋放
      if (this.textures.get(k).getSourceImage() instanceof HTMLImageElement) this.textures.remove(k);
    }

    this.game.texReady = true;
  }

  buildScene() {
    this.world = [];   // 世界物件，會被鏡頭看到
    this.bandImgs = [];
    this.ui = [];      // 螢幕固定物件
    this.forestTrees = []; this.camps = []; this.exits = []; this.npcs = []; this.walkers = []; this.dlg = null; this.shop = null;
    this.obstacles = this.physics.add.staticGroup();
    if (this.area === 'forest') this.buildForest();
    else if (this.area === 'field') this.buildField();
    else if (this.area === 'town') { this.buildTown(); this.buildNpcs(); this.buildWalkers(); }
    else this.buildInterior(this.area);

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
    const sp = this.spawnAt || (this.area === 'forest' ? START : this.area === 'field' ? FIELD_START : this.area === 'town' ? { x: TOWN_START.x, y: TOWN_START.y } : { x: 150, y: 380 });
    this.playerBody = this.add.zone(sp.x, sp.y, 14, 8);
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
    this.facing = this.spawnFacing;
    this.walk = 0; this.walkT = 0;
    this.setHeroTexture(this.facing === 'up' ? 'hero_up' : 'hero_down');
    this.world.push(this.heroShadow, this.hero, this.heroAlert);

    // 玩家狀態
    this.loadGrowth();
    this.php = this.maxHp();
    if (this.carry && (this.area === 'forest' || this.area === 'field')) this.php = Math.max(1, Math.min(this.maxHp(), this.carry.php));   // 鎮內與祠堂是安全區，進去會補滿；進森林帶著現有氣血
    this.invulnUntil = 0;
    this.mv = { x: 0, y: 0 };               // 目前的走路速度（有慣性）
    this.pk = { vx: 0, vy: 0, until: 0 };   // 被擊退
    this.heroFlashUntil = 0;
    this.down = false;
    this.hurtStart = undefined; this.downStart = undefined;   // 切換區域時舊場景的計時不能留下來（遊戲時間會歸零）
    this.cine = false; this.atk = null; this.roll = null; this.lockTarget = null;
    this.respawnAt = 0;

    // 山賊：追擊、出刀、受傷、倒下、重生
    this.bandits = [];
    const f0 = FIELD_SPAWNS[0];
    const spawns = this.area === 'forest' ? ENEMY_SPAWNS
      : this.area === 'field' ? FIELD_BATTLE.roster.map(type => ({ type, x: f0.x, y: f0.y, ex: f0.ex, ey: f0.ey, delay: 0 }))
      : [];
    for (const h of spawns) {
      // 伏擊戰、戰場：被觸發後一路追到底（不會因距離放棄），倒下不重生
      const T = Object.assign({}, ENEMY_TYPES[h.type], this.area === 'field'
        ? { aggro: 2000, lose: 3000, respawnMs: Infinity }
        : { aggro: 600, lose: 1200, respawnMs: Infinity });
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
    if (this.area === 'forest') this.exits.push({ x0: START.x - 60, x1: START.x + 60, y0: MAP_H - 30, y1: MAP_H + 5, to: 'town', spawn: { x: TOWN_GATE.x, y: TOWN_GATE.y }, facing: 'left' });
    if (this.area === 'field') this.exits.push({ x0: FIELD_START.x - 60, x1: FIELD_START.x + 60, y0: MAP_H - 30, y1: MAP_H + 5, to: 'town', spawn: { x: TOWN_GATE.x, y: TOWN_GATE.y }, facing: 'left', when: 'walk' });   // 開戰前可以退回鎮內
    this.stage = { phase: 'walk', t0: 0 };   // walk：往上走 → fight：伏兵出現 → cleared：擊退 → end：本段結束
    if (this.area === 'field') this.resetBattle();
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
    cam.setBackgroundColor(areaInfo(this.area).bg);
    cam.fadeIn(260, 0, 0, 0);
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
    this.hintText = this.add.text(this.scale.width / 2, 66, '左半邊拖曳移動 · 右下「攻」揮劍 · 「閃」翻滾（前段無敵）\n翻滾後立刻按「攻」＝翻滾攻擊\n電腦：WASD 移動、空白鍵攻擊、Shift 翻滾', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#d8e0cf',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(1001);
    this.verText = this.add.text(this.scale.width - 6, 6, VERSION, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#d8e0cf', alpha: 0.6,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(1001);
    this.objText = this.add.text(this.scale.width / 2, 30, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#f0d890',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(1001).setVisible(false);
    this.ui.push(this.objText);
    this.ui.push(this.joyGfx, this.btnGfx, this.btnText, this.hintText, this.verText,
                 this.hpGfx, this.hpText, this.downText, this.dgGfx, this.dgText, this.bannerText, this.barTop, this.barBot);
    this.hintTimer = this.time.delayedCall(6000, () => this.hintText.setVisible(false));

    cam.ignore(this.ui);
    this.uiCam.ignore(this.world);
    this.buildPanel();
    this.buildInv();
    this.buildDialog();
    this.buildShop();

    // 輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, x: 0, y: 0, active: false };
    this.input.addPointer(2);   // 允許左手搖桿、右手攻擊同時按
    this.atkKeys = this.input.keyboard.addKeys('SPACE,J');
    this.input.keyboard.on('keydown-SPACE', () => this.pressAttack());
    this.input.keyboard.on('keydown-J', () => this.pressAttack());
    const dodgeKey = () => { if (this.modal()) return; const t = this.nowT || 0; if (!this.tryRoll(t)) this.rollBuf = t + 400; };
    this.input.keyboard.on('keydown-SHIFT', dodgeKey);
    this.input.keyboard.on('keydown-E', () => this.pressDrink());
    this.input.keyboard.on('keydown-K', dodgeKey);
    this.input.keyboard.on('keydown-F', () => this.talkKey());
    this.input.keyboard.on('keydown-ENTER', () => this.talkKey());
    this.input.on('pointerdown', p => {
      if (this.invPointer(p)) return;
      if (this.panelPointer(p)) return;
      if (this.shopPointer(p)) return;
      if (this.dlgPointer(p)) return;
      { const pp = this.potPos(); if (Math.hypot(p.x - pp.x, p.y - pp.y) <= 40) { this.pressDrink(); return; } }
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
    this.input.on('pointermove', p => { if (!this.modal() && p.id === this.joy.id) this.setJoy(p); });
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
      if (this.down || this.modal() || p.getDuration() > 260 || p.getDistance() > 14) return;
      const bp = this.btnPos(), dg = this.dodgePos();
      if (Math.hypot(p.x - bp.x, p.y - bp.y) <= BTN_R * 1.4 || Math.hypot(p.x - dg.x, p.y - dg.y) <= DG_R * 1.4) return;
      this.tapLock(p);
    });

    this.onResize = () => {
      this.uiCam.setSize(this.scale.width, this.scale.height);
      this.applyZoom();
      this.hintText.setX(this.scale.width / 2);
      this.verText.setX(this.scale.width - 6);
      this.objText.setX(this.scale.width / 2);
      this.downText.setPosition(this.scale.width / 2, this.scale.height / 2 - 40);
      this.bannerText.setPosition(this.scale.width / 2, this.scale.height * 0.3);
      this.layoutPanel(); this.layoutInv();
    };
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    if (!this.boot) this.hintText.setVisible(false); else this.hintText.setVisible(true);
    if (!this.boot) this.time.delayedCall(60, () => this.banner(areaInfo(this.area).name, 1400));
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
    const town = this.area === 'town';   // 鎮內拉得更近
    const z = Math.max(1.0, Math.min(town ? 2.7 : 2.2, Math.min(this.scale.width / (town ? 175 : 230), this.scale.height / (town ? 370 : 460))));
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
    if (this.transitioning) {   // 切換區域中：淡出，停住不動
      this.playerBody.body.setVelocity(0, 0);
      return;
    }
    if (this.modal()) {   // 面板或對話開著：整個遊戲暫停
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
        const dm0 = this.drink ? DRINK_MOVE : 1;
        const tx = x * SPEED * dm0, ty = y * SPEED * dm0;
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
    if (time < this.heroFlashUntil) this.hero.setTint(0xff7a6a); else if (this.drink) this.hero.setTint(0xbfe8a8); else this.hero.clearTint();
    this.hero.setAlpha(!this.down && time < this.invulnUntil && Math.floor(time / 80) % 2 ? 0.45 : 1);

    this.updateDrink(time);
    this.updateDrops(time);
    this.processAttack(time, fx, fy);
    this.updateStage(time);
    this.checkExits();
    this.fadeSils();
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
    if (this.modal()) return;
    const t = this.nowT || 0;
    if (!this.tryAttack(t) && !this.down && (this.roll || this.atk)) this.atkBuf = t + 350;
  }

  tryAttack(time) {
    if (this.down || this.atk || this.cine || this.drink) return false;
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
    if (this.down || this.roll || this.cine || this.drink) return false;
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
    this.rollDrops(b);
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
    this.xp = 0; this.pending = 0; this.wz = 0;
    this.inv = { flask: FLASK_MAX, jc: 0, xq: 0, cloth: 0 }; this.quick = 'flask';
    this.stats = { hp: 0, sta: 0, atk: 0, def: 0 };
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && d.stats) {
        this.xp = Math.max(0, d.xp | 0);
        for (const k of STAT_KEYS) this.stats[k] = Math.min(STAT_CAP, Math.max(0, d.stats[k] | 0));
      }
      if (d) this.wz = Math.max(0, d.wz | 0);
      if (d && d.inv) { for (const k of ITEM_ORDER) this.inv[k] = Math.max(0, d.inv[k] | 0); this.inv.flask = Math.min(FLASK_MAX, this.inv.flask); if (ITEMS[d.quick]) this.quick = d.quick; }
    } catch (e) {}
    this.calcLv();
  }

  calcLv() { this.lv = 1 + STAT_KEYS.reduce((a, k) => a + this.stats[k], 0); }

  saveGrowth() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ xp: this.xp, stats: this.stats, inv: this.inv, quick: this.quick, wz: this.wz })); } catch (e) {}
  }

  maxHp() { return statMaxHp(this.stats.hp); }
  maxStam() { return statMaxStam(this.stats.sta); }
  playerDmg() {
    return Math.max(1, Math.round((PLAYER_DMG_MIN + Math.floor(Math.random() * PLAYER_DMG_RNG)) * statAtk(this.stats.atk)));
  }

  // 章節固定經驗（劇情結算時呼叫；直接入帳，不受等級影響）
  grantChapterXp(i) { this.xp += CHAPTER_XP[i] || 0; this.saveGrowth(); }

  // 擊殺：先記進「待結算」，整場戰鬥結束才算數；結算前倒下就沒了
  gainKillXp(b) {
    const type = b.spawn.type, enemyLv = b.spawn.lv || 1;
    let xp = (KILL_XP[type] || 5) * enemyLv;
    if (this.lv >= enemyLv + 10) xp *= 0.25;
    xp = Math.max(1, Math.round(xp));
    this.pending += xp;
    this.spawnDamage(b.body.x, b.body.y - b.t.h - 18, '+' + xp, '#e8d890');
  }

  settleXp() {
    const n = this.pending; this.pending = 0;
    this.xp += n; this.saveGrowth();
    return n;
  }

  buyStat(k) {
    const need = xpNeed(this.lv);
    if (this.stats[k] >= STAT_CAP || this.lv >= MAX_LV || this.xp < need) return false;
    this.xp -= need; this.stats[k]++; this.calcLv();
    if (k === 'hp') this.php += 3;      // 加點時順便補上增加的上限
    if (k === 'sta') this.stam += 5;
    this.php = Math.min(this.php, this.maxHp()); this.stam = Math.min(this.stam, this.maxStam());
    this.saveGrowth();
    return true;
  }

  // ---------- 區域切換 ----------
  gotoArea(area, spawn, facing) {
    if (this.transitioning) return;
    this.transitioning = true; this.saveGrowth();
    this.playerBody.body.setVelocity(0, 0);
    this.joy.id = null; this.joy.active = false; this.joy.x = this.joy.y = this.joy.dx = this.joy.dy = 0; this.btn.held = false;
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.time.delayedCall(290, () => this.scene.restart({ area, spawn, facing: facing || 'up', carry: { php: this.php, stam: this.stam } }));
  }

  checkExits() {
    if (this.transitioning || this.down || this.cine) return;
    const px = this.playerBody.x, py = this.playerBody.y;
    for (const e of this.exits) {
      if (e.when && this.stage.phase !== e.when) continue;   // 例如戰場：開戰後不能從入口離開
      if (px >= e.x0 && px <= e.x1 && py >= e.y0 && py <= e.y1) { this.gotoArea(e.to, e.spawn, e.facing); return; }
    }
  }

  // 地上的一塊擋路區域
  block(x0, y0, x1, y1) {
    const z = this.add.zone((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
    this.physics.add.existing(z, true);
    this.obstacles.add(z);
  }

  // 噪點地面（只做一次，之後以 key 快取）
  makeGround(key, w, h, C, fn) {
    if (!this.textures.exists(key)) {
      const cw = Math.ceil(w / C), ch = Math.ceil(h / C);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d'), img = g.createImageData(cw, ch), d = img.data;
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const c = fn(i * C, j * C, rnd), o = (j * cw + i) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.textures.addCanvas(key, cv).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const C2 = C;
    this.world.push(this.add.image(0, 0, key).setOrigin(0).setScale(C2).setDepth(-20));
  }

  // 暫代建築（之後換成 Codex 的圖）：x＝中心，baseY＝底邊
  drawHouse(x, baseY, w, h, o = {}) {
    const g = this.add.graphics().setDepth(baseY); this.world.push(g);
    const L = x - w / 2, wallTop = baseY - h * 0.55;
    g.fillStyle(0x000000, 0.3); g.fillEllipse(x, baseY + 1, w * 1.02, 12);
    g.fillStyle(o.wall || 0x9a8e78, 1); g.fillRect(L + 3, wallTop, w - 6, baseY - wallTop);        // 牆
    g.fillStyle(0x000000, 0.18); g.fillRect(L + 3, baseY - 8, w - 6, 8);
    // 屋頂：深灰瓦片，兩端微微翹起
    const rt = baseY - h, eave = 7;
    g.fillStyle(o.roof || 0x3c4042, 1);
    g.fillTriangle(L - eave, wallTop + 2, L + w + eave, wallTop + 2, x, rt);
    g.fillRect(L - eave, wallTop - 4, w + eave * 2, 8);
    g.fillStyle(0x000000, 0.18);
    for (let k = 1; k < 5; k++) g.fillRect(L - eave + k * 3, wallTop - 2 - k * ((wallTop - rt) / 6), (w + eave * 2) - k * 6, 1);
    g.fillStyle(o.ridge || 0x24282a, 1); g.fillRect(x - w * 0.12, rt - 2, w * 0.24, 4);
    if (o.shrine) {
      g.fillStyle(0x8a2a22, 1);   // 紅柱
      for (const px of [L + 10, L + w * 0.34, L + w * 0.66 - 4, L + w - 14]) g.fillRect(px, wallTop + 2, 4, baseY - wallTop - 2);
      g.fillStyle(0x6a1e18, 1); g.fillRect(x - 17, baseY - h * 0.38, 34, h * 0.38);                    // 門
      g.fillStyle(0xc9a43a, 1); g.fillRect(x - 15, wallTop - 14, 30, 11);                              // 匾
      g.fillStyle(0x6e6a64, 1); g.fillRect(x - 24, baseY - 4, 48, 4); g.fillRect(x - 20, baseY - 8, 40, 4);   // 台階
      const t = this.add.text(x, wallTop - 8.5, '祠堂', { fontFamily: 'system-ui, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#3a1a10', resolution: 3 }).setOrigin(0.5).setDepth(baseY + 1);
      this.world.push(t);
    } else {
      g.fillStyle(0x4a3a2a, 1); g.fillRect(x - 7, baseY - h * 0.3, 14, h * 0.3);                        // 門
      g.fillStyle(0x2a2a28, 1); g.fillRect(L + 12, wallTop + 8, 12, 10); g.fillRect(L + w - 24, wallTop + 8, 12, 10);   // 窗
    }
    this.block(L + 4, baseY - h * 0.5, L + w - 4, baseY - 6);
  }

  // ---------- 鎮內 ----------
  buildTown() {
    const W = MAP_W, H = MAP_H, BOT = 396, R = TOWN_ROAD, top = R.y - R.hw, bot = R.y + R.hw;
    // 地面：大街用石板圖、其餘用泥地圖（只做一次，之後以 key 快取）
    if (!this.textures.exists('town_ground7')) {
      const C = 2, TW = 72, cw = Math.ceil(W / C), ch = Math.ceil(H / C);
      const tileData = key => {
        const c = document.createElement('canvas'); c.width = c.height = TW;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(this.textures.get(key).getSourceImage(), 0, 0, TW, TW);
        return x.getImageData(0, 0, TW, TW).data;
      };
      const gr = tileData('dirt_path');
      // 大街：32px 路磚四種變化，依格子位置隨機挑一種（固定種子，每次開game都一樣）
      const RT = 32, roadData = [1, 2, 3, 4].map(k => {
        const c = document.createElement('canvas'); c.width = c.height = RT;
        const x = c.getContext('2d'); x.drawImage(this.textures.get('road_t' + k).getSourceImage(), 0, 0, RT, RT);
        return x.getImageData(0, 0, RT, RT).data;
      });
      const pickRoad = (wx, wy) => { const h = ((Math.floor(wx / RT) * 73856093) ^ (Math.floor(wy / RT) * 19349663)) >>> 0; return roadData[h % 4]; };
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d'), img = g.createImageData(cw, ch), od = img.data;
      let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const street = Math.abs(j * C - R.y + (rnd() - 0.5) * 6) < R.hw;
        const d = (j * cw + i) * 4, kr = street ? 1.1 : 1.25, kg = street ? 1.1 : 1.2, kb = street ? 1.1 : 1.05;
        let src, o;
        if (street) { const wx = i * C, wy = j * C; src = pickRoad(wx, wy); o = (((wy % RT) * RT) + (wx % RT)) * 4; }
        else { src = gr; o = ((j % TW) * TW + (i % TW)) * 4; }
        od[d] = Math.min(255, src[o] * kr); od[d + 1] = Math.min(255, src[o + 1] * kg); od[d + 2] = Math.min(255, src[o + 2] * kb); od[d + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.textures.addCanvas('town_ground7', cv).setFilter(Phaser.Textures.FilterMode.NEAREST);
      if (this.textures.exists('stone_floor')) this.textures.remove('stone_floor');
      for (let k = 1; k <= 4; k++) if (this.textures.exists('road_t' + k)) this.textures.remove('road_t' + k);
      if (this.textures.exists('town_grass')) this.textures.remove('town_grass');
    }
    this.world.push(this.add.image(0, 0, 'town_ground7').setOrigin(0).setScale(2).setDepth(-20));

    // 外牆：四周；鎮門在東牆、大街高度
    const gy0 = TOWN_GATE.y - R.hw, gy1 = TOWN_GATE.y + R.hw;
    const wg = this.add.graphics().setDepth(-5); this.world.push(wg);
    wg.fillStyle(0x4a4640, 1); wg.fillRect(0, 0, 14, H); wg.fillRect(0, 0, W, 22); wg.fillRect(0, BOT, W, H - BOT);
    wg.fillRect(W - 14, 0, 14, gy0); wg.fillRect(W - 14, gy1, 14, H - gy1);
    this.block(0, 0, 14, H); this.block(0, 0, W, 22); this.block(0, BOT, W, H);
    this.block(W - 14, 0, W, gy0); this.block(W - 14, gy1, W, H);
    const gt = this.add.graphics().setDepth(TOWN_GATE.y + 60); this.world.push(gt);
    gt.fillStyle(0x6a4a30, 1); gt.fillRect(W - 26, gy0 - 8, 22, 12); gt.fillRect(W - 26, gy1 - 4, 22, 12);
    gt.fillStyle(0x3c4042, 1); gt.fillRect(W - 30, gy0 - 14, 30, 8); gt.fillRect(W - 30, gy1 + 6, 30, 8);
    this.block(W - 26, gy0 - 8, W, gy0 + 4); this.block(W - 26, gy1 - 4, W, gy1 + 8);
    this.exits.push({ x0: W - 34, x1: W + 6, y0: gy0 + 2, y1: gy1 - 2, to: 'forest', spawn: { x: START.x, y: START.y }, facing: 'up' });
    // 大街上下兩側整片擋住，只有大街可走（祠堂門口除外）
    this.block(14, 22, W - 14, top - 2); this.block(14, bot + 2, W - 14, BOT);

    // 建築與風景：街北第一排門朝南、緊貼大街，建築之間偶爾夾樹與灌木，後面是樹林；街南是疏落的屋後，之間有樹、柵欄、矮牆，再後面是樹林
    const SPR = { A: ['house_a_k', 108], B: ['house_b_k', 110], S: ['shop_k', 138], G: ['courtyard_gate_k', 118], H: ['shrine_ext_k', 172] };
    let seed = 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const codes = 'ABSAGBSAB';   // 祠堂 H 不放進隨機建築池（只在大街正中放一座）
    const shade = v => { const c = Math.round(255 * v); return (c << 16) | (c << 8) | c; };
    const tree = (x, baseY, h, sh, depth) => {
      const key = 'forest_tree_0' + (1 + Math.floor(rnd() * 3)) + '_k', tex = this.textures.get(key).getSourceImage(), w = h * tex.width / tex.height;
      this.world.push(this.add.image(x, baseY, key).setOrigin(0.5, 1).setDisplaySize(w, h).setFlipX(rnd() < 0.5).setTint(shade(sh)).setDepth(depth === undefined ? baseY : depth));
    };
    const prop = (key, x, baseY, h, depth) => {
      const tex = this.textures.get(key).getSourceImage(), w = h * tex.width / tex.height;
      this.world.push(this.add.image(x, baseY, key).setOrigin(0.5, 1).setDisplaySize(w, h).setFlipX(rnd() < 0.5).setDepth(depth === undefined ? baseY : depth));
    };
    const draw = (c, x, y, sc, crop, depth) => {
      const [key, bw] = SPR[c], w = bw * sc, tex = this.textures.get(key).getSourceImage(), h = w * tex.height / tex.width;
      const img = this.add.image(x + w / 2, y, key).setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(depth);
      if (crop) img.setCrop(0, 0, tex.width, tex.height * crop);
      this.world.push(img);
      return img;
    };
    // 沿一段橫向範圍排建築；每棟之後有機會留一段空隙（gap 由呼叫端決定放什麼）
    const fillRow = (x0, x1, put, gap, gapChance = 0.5, ov = 2) => {
      if (gapChance === 0) {   // 排滿：先挑一串建築，再整體等比縮放，剛好填滿 x0..x1，不留零頭
        const picks = []; let tot = 0, prev = '';
        while (tot < x1 - x0 + ov) {
          let c; do { c = codes[Math.floor(rnd() * codes.length)]; } while (c === prev); prev = c;
          const sc = 0.92 + rnd() * 0.16; picks.push([c, sc]); tot += SPR[c][1] * sc - ov;
        }
        // 最後一棟若會超出太多，就丟掉它再縮放（縮放比例不超出 0.85–1.25）
        const fit = list => { let t = ov; for (const [c, sc] of list) t += SPR[c][1] * sc - ov; return (x1 - x0 + ov) / (t); };
        let k = fit(picks); if (k < 0.85 && picks.length > 1) { picks.pop(); k = fit(picks); }
        let x = x0;
        for (const [c, sc0] of picks) { const sc = sc0 * k, w = SPR[c][1] * sc; put(c, x, sc, w); x += w - ov; }
        return;
      }
      let x = x0, prev = '';
      while (x < x1 - 70) {
        let c; do { c = codes[Math.floor(rnd() * codes.length)]; } while (c === prev); prev = c;
        const sc = 0.92 + rnd() * 0.16, w = SPR[c][1] * sc;
        if (x + w > x1) break;
        put(c, x, sc, w);
        x += w - ov;
        if (rnd() < gapChance && x + 40 < x1) { const gw = 30 + rnd() * 26; gap(x, x + gw); x += gw; }
      }
      if (x < x1) gap(x, x1);
    };
    const shrineL = SHRINE_POS.x - 86, shrineR = SHRINE_POS.x + 86;
    // 北側第一排（有影子；祠堂佔住中間）
    const SIGNS = ['布莊', '藥鋪', '酒家', '茶館', '鐵匠', '米行', '客棧', '雜貨'];
    let signN = 0;
    const northPut = (c, x, sc, w) => {
      this.world.push(this.add.ellipse(x + w / 2, top - 2, w * 0.95, 8, 0x000000, 0.25).setDepth(top - 3));
      const img = draw(c, x, top - 4, sc, 0, top - 4);
      if (c !== 'S' && c !== 'H' && rnd() < 0.7) {   // 木招牌掛在門旁（商店圖本身已有招牌）
        const txt = SIGNS[signN++ % SIGNS.length], sx = x + w * (rnd() < 0.5 ? 0.13 : 0.87), sy = top - 4 - img.displayHeight * 0.3;
        const sg = this.add.graphics().setDepth(top - 3); this.world.push(sg);
        sg.fillStyle(0x2a1a10, 1); sg.fillRect(sx - 7, sy - 14, 14, 30); sg.fillStyle(0xb98a3e, 1); sg.fillRect(sx - 6, sy - 13, 12, 28);
        this.world.push(this.add.text(sx, sy + 1, txt[0] + '\n' + txt[1], { fontFamily: 'system-ui, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#2a1408', align: 'center', lineSpacing: 1, resolution: 3 }).setOrigin(0.5).setDepth(top - 2));
      }
    };
    const northGap = (a, b) => {   // 排不下的零頭：補一小段磚牆，不留空地、不放植物
      if (b - a < 4) return;
      const wg2 = this.add.graphics().setDepth(top - 4); this.world.push(wg2);
      wg2.fillStyle(0x59534a, 1); wg2.fillRect(a, top - 46, b - a, 44); wg2.fillStyle(0x3a352f, 1); wg2.fillRect(a, top - 46, b - a, 4);
      wg2.fillStyle(0x45403a, 1); for (let py = top - 38; py < top - 4; py += 9) wg2.fillRect(a, py, b - a, 1);
    };
    fillRow(14, shrineL - 10, northPut, northGap, 0, 14);
    fillRow(shrineR + 10, W - 14, northPut, northGap, 0, 14);
    {   // 祠堂（陳家祠風格 v4）
      const x = SHRINE_POS.x, by = SHRINE_POS.y, w = 172, tex = this.textures.get('shrine_ext_k').getSourceImage(), h = w * tex.height / tex.width;
      this.world.push(this.add.image(x, by, 'shrine_ext_k').setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(by));
      this.world.push(this.add.text(x, by - h * 0.533, '祠堂', { fontFamily: 'system-ui, sans-serif', fontSize: '7px', fontStyle: 'bold', color: '#e8c55a', resolution: 4 }).setOrigin(0.5).setDepth(by + 1));
      this.exits.push({ x0: x - 18, x1: x + 18, y0: by - 2, y1: by + 18, to: 'shrine', spawn: interiorEntry('shrine'), facing: 'up' });
    }
    // 北側後面：天空（陰天、薄霧、遠山），建築與樹站在天空前；大街上緣有一條暗色地平帶接住天空
    if (!this.textures.exists('town_sky2')) {
      const cv = document.createElement('canvas'); cv.width = 700; cv.height = 135;
      const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 135);
      gr.addColorStop(0, '#6d93a6'); gr.addColorStop(0.55, '#a8c0bb'); gr.addColorStop(1, '#e2d9b8');
      g.fillStyle = gr; g.fillRect(0, 0, 700, 135);
      let sd = 7; const r2 = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let n = 0; n < 26; n++) {   // 雲：橫向壓扁的柔和橢圓
        const x = r2() * 700, y = 10 + r2() * 95, w = 40 + r2() * 90, h = 5 + r2() * 9;
        const rg = g.createRadialGradient(x, y, 0, x, y, w);
        rg.addColorStop(0, 'rgba(245,244,235,0.32)'); rg.addColorStop(1, 'rgba(245,244,235,0)');
        g.save(); g.translate(x, y); g.scale(1, h / w); g.translate(-x, -y); g.fillStyle = rg; g.beginPath(); g.arc(x, y, w, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.fillStyle = 'rgba(86,112,98,0.7)'; g.beginPath(); g.moveTo(0, 135);   // 遠山剪影
      for (let x = 0; x <= 700; x += 14) g.lineTo(x, 108 - 12 * Math.sin(x / 53) - 8 * Math.sin(x / 21 + 1));
      g.lineTo(700, 135); g.fill();
      this.textures.addCanvas('town_sky2', cv).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.world.push(this.add.image(0, 0, 'town_sky2').setOrigin(0).setScale(2).setDepth(-4));
    { const hz = this.add.graphics().setDepth(top - 6); this.world.push(hz);
      hz.fillStyle(0x5a4a38, 1); hz.fillRect(0, top - 10, W, 12); hz.fillStyle(0x7a6850, 1); hz.fillRect(0, top - 10, W, 2); }
    {   // 上排建築背後的圍牆：青灰磚牆，頂上瓦片壓頂，從西到東連續；建築與招牌疊在它前面，天空只剩牆上一條
      const wTop = top - 8 - 84, wb = top - 8, wl = this.add.graphics().setDepth(top - 7); this.world.push(wl);
      wl.fillStyle(0x6f7b73, 1); wl.fillRect(0, wTop, W, wb - wTop);
      wl.fillStyle(0x58645d, 1);
      for (let py = wTop + 10, row = 0; py < wb; py += 9, row++) {
        wl.fillRect(0, py, W, 1);
        for (let px = (row % 2) * 14; px < W; px += 28) wl.fillRect(px, py - 9, 1, 9);
      }
      wl.fillStyle(0x84918a, 1); for (let px = 3; px < W; px += 41) wl.fillRect(px, wTop + 14 + (px % 4) * 9, 12, 2);   // 磚面淺色斑塊
      wl.fillStyle(0x464f50, 1); wl.fillRect(-2, wTop - 7, W + 4, 9);      // 瓦頂
      wl.fillStyle(0x333b3c, 1); for (let px = 0; px < W; px += 6) wl.fillRect(px, wTop - 6, 1, 8);   // 瓦楞
      wl.fillStyle(0x5a6667, 1); wl.fillRect(-2, wTop - 8, W + 4, 2);
      wl.fillStyle(0x2f3638, 1); wl.fillRect(-2, wTop + 2, W + 4, 2);      // 壓頂陰影
    }
    // 南側：不放實體建築。畫面最底部貼一排建築的上半截（半透明黑影，像前景遮擋），上下不動、只隨左右捲動
    this.bandImgs = [];
    {
      const CROP = 0.5;
      fillRow(-20, W + 40, (c, x, sc, w) => {
        const img = draw(c, x, 0, sc * 2.5, CROP, 900);
        img.setOrigin(0.5, CROP).setTint(0x1f2a24).setAlpha(0.66);
        this.bandImgs.push(img);
      }, () => {}, 0, 18);
    }
    this.sils = [];
    this.stage = { phase: 'walk', t0: 0 };
  }

  // 前景黑影：主角靠近或走到後面時變透明
  fadeSils() {
    if (this.bandImgs && this.bandImgs.length) { const vb = this.cameras.main.worldView; for (const im of this.bandImgs) im.y = vb.bottom; }
    if (!this.sils) return;
    const px = this.playerBody.x, py = this.playerBody.y;
    for (const o of this.sils) {
      const near = px > o.x0 - 14 && px < o.x1 + 14 && py > o.y0 - 20 && py < o.y1 + 14;
      const target = near ? 0.22 : 1;
      o.g.setAlpha(o.g.alpha + (target - o.g.alpha) * 0.15);
    }
  }

  // ---------- 室內（祠堂、之後的店舖）----------
  // 版面與版本都在檔案上方的 INTERIORS；這裡只負責依資料把房間蓋起來
  buildInterior(type) {
    const L = interiorLayout(type), W = MAP_W, H = MAP_H;
    const edge = v => v === 'W' ? W : v === 'H' ? H : v;
    const g = this.add.graphics().setDepth(-6); this.world.push(g);
    g.fillStyle(0x16120e, 1); g.fillRect(0, 0, W, H);
    if (L.doorLight) { g.fillStyle(0xcdbf9a, 1); g.fillRect(L.doorLight.x, L.doorLight.y, L.doorLight.w, H - L.doorLight.y); }   // 門洞外透進來的亮光
    this.world.push(this.add.image(0, 0, this.keyInterior(type)).setOrigin(0).setDisplaySize(W, H).setDepth(-5));
    for (const b of L.blocks) this.block(edge(b[0]), edge(b[1]), edge(b[2]), edge(b[3]));
    this.altarFx = this.add.graphics().setDepth(119); this.world.push(this.altarFx);
    this.camps = (L.camps || []).map(c => ({ x: c.x, y: c.y }));
    const e = L.exit;
    this.exits.push({ x0: e.x0, x1: e.x1, y0: e.y0, y1: H + 5, to: e.to, spawn: e.spawn(), facing: e.facing });
    this.stage = { phase: 'walk', t0: 0 };
  }

  // 室內的動態效果（目前只有香煙；之後店舖的效果也加在 fx 清單裡）
  drawCamps(time) {
    if (!isInterior(this.area) || !this.altarFx) return;
    const g = this.altarFx; g.clear();
    for (const fx of interiorLayout(this.area).fx || []) {
      if (fx.type !== 'incense') continue;
      for (const p of incensePuffs(time, fx)) { g.fillStyle(0xe6e2d8, p.a); g.fillCircle(p.x, p.y, p.r); }
    }
  }

  nearCamp() {
    for (const c of this.camps) if (Math.hypot(this.playerBody.x - c.x, this.playerBody.y - c.y) <= CAMP_R) return c;
    return null;
  }

  // ---------- 背包、藥、掉落 ----------
  invCount(id) { return this.inv[id] | 0; }
  itemUseful(id) {
    const T = ITEMS[id];
    if (!T || this.invCount(id) <= 0) return false;
    if (T.kind === 'hp') return this.php < this.maxHp();
    if (T.kind === 'stam') return this.stam < this.maxStam();
    return false;
  }
  applyItem(id) {
    const T = ITEMS[id], px = this.playerBody.x, py = this.playerBody.y + 4;
    this.inv[id]--;
    if (T.kind === 'hp') {
      const n = Math.round(this.maxHp() * T.pct); this.php = Math.min(this.maxHp(), this.php + n);
      this.spawnDamage(px, py - HERO_H - 4, '+' + n, '#9ad98a');
    } else if (T.kind === 'stam') {
      const n = Math.round(this.maxStam() * T.pct); this.stam = Math.min(this.maxStam(), this.stam + n);
      this.spawnDamage(px, py - HERO_H - 4, '+氣力', '#e8d890');
    }
    this.saveGrowth();
  }

  // 「藥」鍵：開始喝藥（有硬直，被打中中斷）
  pressDrink() {
    if (this.modal() || this.transitioning) return;
    const t = this.nowT || 0;
    if (this.down || this.cine || this.roll || this.atk || this.drink) return;
    const order = [this.quick, 'flask', 'jc', 'xq'];
    const id = order.find(k => this.itemUseful(k));
    if (!id) return;   // 沒東西可用或滿血：不閃、不提示
    this.drink = { id, start: t, healed: false };
    this.mv.x = 0; this.mv.y = 0;
  }

  updateDrink(time) {
    const d = this.drink; if (!d) return;
    if (!d.healed && time - d.start >= DRINK_HEAL_AT) { d.healed = true; if (this.itemUseful(d.id) || this.invCount(d.id) > 0) this.applyItem(d.id); }
    if (time - d.start >= DRINK_MS) this.drink = null;
  }

  // 敵人倒下：擲掉落
  rollDrops(b) {
    for (const [id, p] of (DROPS[b.spawn.type] || [])) {
      if (Math.random() < p) this.spawnDrop(id, b.body.x + (Math.random() - 0.5) * 24, b.body.y + (Math.random() - 0.5) * 12);
    }
    const w = WZ_DROP[b.spawn.type];
    if (w && Math.random() < w[0]) {
      const n = w[1] + Math.floor(Math.random() * (w[2] - w[1] + 1));
      this.spawnDrop('wz', b.body.x + (Math.random() - 0.5) * 24, b.body.y + (Math.random() - 0.5) * 12, n);
    }
  }
  spawnDrop(id, x, y, n) { this.drops.push({ id, x, y, n: n || 1, t0: this.nowT || 0 }); }
  updateDrops(time) {
    const g = this.dropGfx; g.clear();
    const px = this.playerBody.x, py = this.playerBody.y;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i], bob = Math.sin((time - d.t0) / 200) * 1.5;
      g.fillStyle(0x000000, 0.3); g.fillEllipse(d.x, d.y, 11, 4);
      if (d.id === 'wz') {   // 五銖錢：金色圓錢加方孔
        g.fillStyle(0xd9b45a, 1); g.fillCircle(d.x, d.y - 5 + bob, 4.5);
        g.fillStyle(0x3a3520, 1); g.fillRect(d.x - 1, d.y - 6 + bob, 2, 2);
      } else {
        g.fillStyle(d.id === 'xq' ? 0x6a9ad9 : 0xb08a4a, 1); g.fillRoundedRect(d.x - 4, d.y - 9 + bob, 8, 8, 2);
        g.fillStyle(0xf0e6c8, 1); g.fillRect(d.x - 1, d.y - 11 + bob, 2, 3);
      }
      if (time - d.t0 > 400 && Math.hypot(px - d.x, py - d.y) < 20) {
        if (d.id === 'wz') { this.wz += d.n; this.spawnDamage(d.x, d.y - 14, '+' + d.n + ' 五銖', '#e8d890'); }
        else { this.inv[d.id] = (this.inv[d.id] | 0) + 1; this.spawnDamage(d.x, d.y - 14, '+' + ITEMS[d.id].name, '#e8d890'); }
        this.drops.splice(i, 1); this.saveGrowth();
      }
    }
  }

  // ---------- 鎮內 NPC 與對話 ----------
  modal() { return !!(this.panelOpen || this.invOpen || this.dlg || this.shop); }

  buildNpcs() {
    for (const d of NPCS) {
      const key = 'npcw_' + d.look + '_side_1';   // 站姿：取側面走路圖的中立那一格，依 face 決定朝向
      const sprite = this.add.image(d.x, d.y, key).setOrigin(0.5, 1).setDepth(d.y).setFlipX(d.face === 'left');
      const sh = this.add.ellipse(d.x, d.y - 1, 22, 8, 0x000000, 0.35).setDepth(d.y - 1);
      this.world.push(sprite); this.world.push(sh);
      this.block(d.x - 8, d.y - 6, d.x + 8, d.y + 2);
      const tex = this.textures.get(key).getSourceImage(), k = HERO_H / this.textures.get('hero_walk_side_0').getSourceImage().height;
      sprite.setDisplaySize(tex.width * k, tex.height * k);
      this.npcs.push(Object.assign({ sprite }, d));
    }
  }

  // ---------- 分層路人 ----------
  pedKeyed(texKey) {
    if (PED_KEYED[texKey]) return PED_KEYED[texKey];
    const img = this.textures.get(texKey).getSourceImage(), c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i] > 180 && p[i + 1] < 110 && p[i + 2] > 180) p[i + 3] = 0;
    g.putImageData(d, 0, 0);
    return (PED_KEYED[texKey] = c);
  }

  // 依「零件清單＋染色」疊出三個方向、每方向 4 格的貼圖：ped<i>_<方向>_<格>
  composePed(i, layers) {
    if (this.textures.exists('ped' + i + '_side_0')) return;
    for (const dir of PED_DIRS) {
      const comp = document.createElement('canvas'); comp.width = 2048; comp.height = 512;
      const g = comp.getContext('2d');
      for (const L of layers) {
        const src = this.pedKeyed('npc_' + L.name + '_' + dir);
        const t = document.createElement('canvas'); t.width = src.width; t.height = src.height;
        const tg = t.getContext('2d'); tg.drawImage(src, 0, 0);
        tg.globalCompositeOperation = 'multiply';
        tg.fillStyle = 'rgb(' + L.col.map(v => Math.min(255, Math.round(v * 1.15))).join(',') + ')';
        tg.fillRect(0, 0, t.width, t.height);
        tg.globalCompositeOperation = 'destination-in'; tg.drawImage(src, 0, 0);
        g.drawImage(t, 0, 0);
      }
      const p = g.getImageData(0, 0, 2048, 512).data;
      let minX = 512, minY = 512, maxX = -1, maxY = -1;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 2048; x++) {
        if (p[(y * 2048 + x) * 4 + 3] > 0) { const lx = x % 512; if (lx < minX) minX = lx; if (lx > maxX) maxX = lx; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      const w = maxX - minX + 1, h = maxY - minY + 1;
      for (let f = 0; f < 4; f++) {
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        o.getContext('2d').drawImage(comp, f * 512 + minX, minY, w, h, 0, 0, w, h);
        this.textures.addCanvas('ped' + i + '_' + dir + '_' + f, o);
      }
    }
  }

  // 開機時一次做好 PED_COUNT 個路人的貼圖（隨機組合零件與染色），之後只留成品
  makePeds() {
    let seed = 20261110; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    for (let i = 0; i < PED_COUNT; i++) {
      const cols = {}; for (const k of Object.keys(PED_COLORS)) cols[k] = pick(PED_COLORS[k]);
      const topCol = pick(PED_COLORS.cloth); let botCol; do { botCol = pick(PED_COLORS.cloth); } while (botCol === topCol);   // 上衣與下裝不同色
      const layers = [];
      for (const slot of PED_ORDER) {
        let name = null;
        if (slot === 'base') name = 'base';
        else if (PED_PARTS[slot]) name = pick(PED_PARTS[slot]);
        if (name) layers.push({ name, col: slot === 'top' ? topCol : slot === 'bottom' ? botCol : cols[PED_SLOT_COLOR[slot]] });
      }
      this.composePed(i, layers);
    }
    for (const k of Object.keys(PED_KEYED)) delete PED_KEYED[k];   // 零件圖用完就丟，省記憶體
  }

  buildWalkers() {
    let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const R = TOWN_ROAD, y0 = R.y - R.hw + 12, y1 = R.y + R.hw - 4;
    WALKER_IDS.forEach((id, i) => {
      const x = 180 + (i + rnd() * 0.8) * (MAP_W - 360) / WALKER_IDS.length, y = y0 + rnd() * (y1 - y0);
      const sprite = this.add.image(x, y, 'npcw_' + id + '_front_1').setOrigin(0.5, 1).setDepth(y);
      const sh = this.add.ellipse(x, y - 1, 22, 8, 0x000000, 0.35).setDepth(y - 1);
      this.world.push(sprite); this.world.push(sh);
      this.walkers.push({ id, x, y, sprite, sh, vx: 0, vy: 0, dir: 'front', flip: false, until: 0, t: rnd() * 1000, sp: (NPC_OLD.includes(id) ? 13 + rnd() * 5 : NPC_KIDS.includes(id) ? 30 + rnd() * 10 : 20 + rnd() * 14), y0, y1, sc: NPC_KIDS.includes(id) ? 0.7 : 1 });
    });
    this.walkerT = this.time.now;
  }

  updateWalkers() {
    if (this.area !== 'town' || !this.walkers || !this.walkers.length) return;
    const now = this.time.now, dt = Math.min(0.05, (now - (this.walkerT || now)) / 1000); this.walkerT = now;
    const frozen = this.modal();
    for (const w of this.walkers) {
      if (!frozen) {
        if (now > w.until) {   // 換個走法：停一下、左右走、或換條路線
          const r = Math.random();
          if (r < 0.28) { w.vx = 0; w.vy = 0; w.until = now + 1200 + Math.random() * 2600; }
          else if (r < 0.82) { const d = Math.random() < 0.5 ? -1 : 1; w.vx = d * w.sp; w.vy = 0; w.until = now + 2500 + Math.random() * 4500; }
          else { const d = Math.random() < 0.5 ? -1 : 1; w.vx = 0; w.vy = d * w.sp * 0.8; w.until = now + 700 + Math.random() * 1200; }
        }
        w.x += w.vx * dt; w.y += w.vy * dt;
        if (w.x < 80) { w.x = 80; w.vx = Math.abs(w.vx); } else if (w.x > MAP_W - 80) { w.x = MAP_W - 80; w.vx = -Math.abs(w.vx); }
        if (w.y < w.y0) { w.y = w.y0; w.vy = Math.abs(w.vy); } else if (w.y > w.y1) { w.y = w.y1; w.vy = -Math.abs(w.vy); }
        if (w.vx || w.vy) w.t += dt * 1000;
      }
      const moving = !frozen && (w.vx || w.vy);
      if (moving) {
        if (Math.abs(w.vx) >= Math.abs(w.vy)) { w.dir = 'side'; w.flip = w.vx < 0; } else { w.dir = w.vy < 0 ? 'back' : 'front'; }
      }
      const f = moving ? Math.floor(w.t / WALK_FRAME_MS) % 4 : 1;
      const key = 'npcw_' + w.id + '_' + w.dir + '_' + f;
      const tex = this.textures.get(key).getSourceImage(), hs = this.textures.get('hero_walk_' + w.dir + '_0').getSourceImage().height;
      const k = HERO_H / hs * w.sc;
      if (w.sprite.texture.key !== key) w.sprite.setTexture(key);
      w.sprite.setDisplaySize(tex.width * k, tex.height * k).setPosition(w.x, w.y).setDepth(w.y).setFlipX(w.dir === 'side' && w.flip);
      w.sh.setPosition(w.x, w.y - 1).setDepth(w.y - 1);
    }
  }

  nearNpc() {
    if (this.area !== 'town' || !this.playerBody) return null;
    let best = null, bd = NPC_R;
    for (const n of this.npcs) {
      const dd = Math.hypot(this.playerBody.x - n.x, this.playerBody.y - n.y);
      if (dd <= bd) { bd = dd; best = n; }
    }
    return best;
  }

  canTalk() {
    const ph = this.stage && this.stage.phase;
    return !this.dlg && !this.shop && !this.panelOpen && !this.invOpen && !this.down && !this.cine && !this.transitioning
      && (ph === 'walk' || ph === 'cleared') && !this.atk && !this.roll && !this.drink && !!this.nearNpc();
  }

  talkRect() { return { x: this.scale.width / 2 - 52, y: this.scale.height - 260, w: 104, h: 36 }; }

  buildDialog() {
    const mk = (o) => { o.setDepth(1300); this.ui.push(o); this.cameras.main.ignore(o); return o; };
    const tx = (size, color, stroke = 3) => ({ fontFamily: 'system-ui, sans-serif', fontSize: size + 'px', color, stroke: '#000000', strokeThickness: stroke });
    this.dlgGfx = mk(this.add.graphics());
    this.dlgBtnText = mk(this.add.text(0, 0, '對話', tx(15, '#16201a', 0)).setOrigin(0.5).setDepth(1301).setVisible(false));
    this.dlgName = mk(this.add.text(0, 0, '', tx(15, '#f0d890')).setDepth(1301).setVisible(false));
    this.dlgBody = mk(this.add.text(0, 0, '', tx(15, '#e6f0dc', 2)).setDepth(1301).setVisible(false));
    this.dlgHint = mk(this.add.text(0, 0, '點一下繼續', tx(11, '#a8b8a0', 2)).setOrigin(1, 1).setDepth(1301).setVisible(false));
  }

  openDialog(npc) {
    const first = !TALKED[npc.id]; TALKED[npc.id] = true;
    let lines = npc.lines;
    if (!first && npc.chat && npc.chat.length) {   // 之後：隨機說兩句不同的閒話
      const pool = npc.chat.slice(), pick = [];
      for (let n = 0; n < 2 && pool.length; n++) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      lines = pick;
    }
    this.dlg = { npc, i: 0, lines };
    this.joy.id = null; this.joy.active = false; this.joy.x = this.joy.y = this.joy.dx = this.joy.dy = 0; this.btn.held = false;
  }

  advanceDialog() {
    if (!this.dlg) return;
    this.dlg.i++;
    if (this.dlg.i >= this.dlg.lines.length) {
      const n = this.dlg.npc; this.dlg = null;
      if (n.shop) this.openShop(n);
    }
  }

  talkKey() {
    if (this.dlg) { this.advanceDialog(); return; }
    if (this.canTalk()) this.openDialog(this.nearNpc());
  }

  // 回傳 true 表示這次點擊被對話吃掉
  dlgPointer(p) {
    if (this.dlg) { this.advanceDialog(); return true; }
    const r = this.talkRect();
    if (this.canTalk() && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.openDialog(this.nearNpc()); return true; }
    return false;
  }

  drawDialogUI() {
    const g = this.dlgGfx, W = this.scale.width, H = this.scale.height, k = 1 - this.cineK;
    g.clear();
    // NPC 轉向面對主角
    if (this.area === 'town' && this.playerBody) for (const n of this.npcs) {
      const dx = this.playerBody.x - n.x, dy = this.playerBody.y - n.y;
      let dir = 'front', flip = n.face === 'left';
      if (Math.hypot(dx, dy) < 120) {
        if (Math.abs(dx) > Math.abs(dy) * 1.25) { dir = 'side'; flip = dx < 0; }
        else dir = dy < 0 ? 'back' : 'front';
      } else if (n.face) { dir = 'side'; }
      const nk = 'npcw_' + n.look + '_' + dir + '_1', nt = this.textures.get(nk).getSourceImage();
      const ks = HERO_H / this.textures.get('hero_walk_' + dir + '_0').getSourceImage().height;
      if (n.sprite.texture.key !== nk) n.sprite.setTexture(nk);
      n.sprite.setDisplaySize(nt.width * ks, nt.height * ks);
      n.sprite.setFlipX(dir === 'side' && flip);
    }
    // 「對話」鈕
    const can = this.canTalk(), r = this.talkRect();
    if (can) { g.fillStyle(0xd9b45a, 0.95); g.fillRoundedRect(r.x, r.y, r.w, r.h, 8); }
    this.dlgBtnText.setVisible(can).setPosition(r.x + r.w / 2, r.y + r.h / 2).setAlpha(k);
    g.setAlpha(k);
    // 對話框
    const d = this.dlg;
    this.dlgName.setVisible(!!d); this.dlgBody.setVisible(!!d); this.dlgHint.setVisible(!!d);
    if (!d) return;
    const bw = Math.min(W - 20, 380), bh = 118, bx = (W - bw) / 2, by = H - bh - 16;
    g.fillStyle(0x000000, 0.35); g.fillRect(0, 0, W, H);
    g.fillStyle(0x16201a, 0.96); g.fillRoundedRect(bx, by, bw, bh, 10);
    g.lineStyle(2, 0xe6f0dc, 0.7); g.strokeRoundedRect(bx, by, bw, bh, 10);
    this.dlgName.setText(d.npc.name).setPosition(bx + 14, by + 10);
    this.dlgBody.setText(d.lines[d.i]).setPosition(bx + 14, by + 36).setWordWrapWidth(bw - 28);
    this.dlgHint.setText(d.i >= d.lines.length - 1 ? '點一下結束' : '點一下繼續').setPosition(bx + bw - 12, by + bh - 8);
  }

  // ---------- 商店（五銖）----------
  buildShop() {
    const mk = (o) => { o.setDepth(1350); this.ui.push(o); this.cameras.main.ignore(o); return o; };
    const tx = (size, color, stroke = 3) => ({ fontFamily: 'system-ui, sans-serif', fontSize: size + 'px', color, stroke: '#000000', strokeThickness: stroke });
    this.shopGfx = mk(this.add.graphics());
    this.shopTitle = mk(this.add.text(0, 0, '', tx(16, '#f0d890')).setOrigin(0.5, 0).setDepth(1351).setVisible(false));
    this.shopRows = [0, 1, 2, 3].map(() => ({
      name: mk(this.add.text(0, 0, '', tx(16, '#e6f0dc')).setDepth(1351).setVisible(false)),
      desc: mk(this.add.text(0, 0, '', tx(12, '#c8d8c0')).setDepth(1351).setVisible(false)),
      buy: mk(this.add.text(0, 0, '買', tx(15, '#16201a', 0)).setOrigin(0.5).setDepth(1351).setVisible(false)),
    }));
    this.shopClose = mk(this.add.text(0, 0, '離開', tx(16, '#16201a', 0)).setOrigin(0.5).setDepth(1351).setVisible(false));
    this.shopNote = mk(this.add.text(0, 0, '', tx(12, '#e8c890')).setOrigin(0.5, 0).setDepth(1351).setVisible(false));
  }

  openShop(npc) {
    this.shop = { npc, note: '', noteUntil: 0 };
    this.joy.id = null; this.joy.active = false; this.joy.x = this.joy.y = this.joy.dx = this.joy.dy = 0; this.btn.held = false;
  }

  shopLayout() {
    const W = this.scale.width, H = this.scale.height, items = this.shop.npc.shop;
    const pw = Math.min(W - 24, 360), rowH = 58, ph = 70 + rowH * items.length + 64;
    const px = (W - pw) / 2, py = Math.max(12, (H - ph) / 2);
    const rows = items.map((it, i) => { const y = py + 50 + i * rowH; return Object.assign({ y, buy: { x: px + pw - 44, y: y + 22, w: 64, h: 32 } }, it); });
    return { px, py, pw, ph, rows, close: { x: W / 2, y: py + 50 + rowH * items.length + 18, w: 120, h: 36 } };
  }

  shopPointer(p) {
    if (!this.shop) return false;
    const L = this.shopLayout(), t = this.nowT || 0;
    for (const r of L.rows) {
      if (Math.abs(p.x - r.buy.x) <= r.buy.w / 2 && Math.abs(p.y - r.buy.y) <= r.buy.h / 2) {
        if (this.wz >= r.price) {
          this.wz -= r.price; this.inv[r.id] = (this.inv[r.id] | 0) + 1; this.saveGrowth();
          this.shop.note = '買了 ' + ITEMS[r.id].name; this.shop.noteUntil = t + 1200;
        } else { this.shop.note = '五銖不夠'; this.shop.noteUntil = t + 1200; }
      }
    }
    const c = L.close;
    if (Math.abs(p.x - c.x) <= c.w / 2 && Math.abs(p.y - c.y) <= c.h / 2) { this.shop = null; this.saveGrowth(); }
    return true;
  }

  drawShopUI() {
    const g = this.shopGfx, S = this.shop, t = this.nowT || 0;
    g.clear();
    this.shopTitle.setVisible(!!S); this.shopClose.setVisible(!!S); this.shopNote.setVisible(!!S);
    for (const r of this.shopRows) { r.name.setVisible(false); r.desc.setVisible(false); r.buy.setVisible(false); }
    if (!S) return;
    const L = this.shopLayout(), W = this.scale.width, H = this.scale.height;
    g.fillStyle(0x000000, 0.55); g.fillRect(0, 0, W, H);
    g.fillStyle(0x16201a, 0.96); g.fillRoundedRect(L.px, L.py, L.pw, L.ph, 10);
    g.lineStyle(2, 0xe6f0dc, 0.7); g.strokeRoundedRect(L.px, L.py, L.pw, L.ph, 10);
    this.shopTitle.setText(S.npc.name + '　五銖 ' + this.wz).setPosition(W / 2, L.py + 12);
    L.rows.forEach((r, i) => {
      const o = this.shopRows[i], T = ITEMS[r.id], ok = this.wz >= r.price;
      o.name.setVisible(true).setText(T.name + '　' + r.price + ' 五銖（有 ' + this.invCount(r.id) + '）').setPosition(L.px + 16, r.y);
      o.desc.setVisible(true).setText(T.desc).setPosition(L.px + 16, r.y + 24);
      g.fillStyle(0xd9b45a, ok ? 0.95 : 0.35); g.fillRoundedRect(r.buy.x - r.buy.w / 2, r.buy.y - r.buy.h / 2, r.buy.w, r.buy.h, 8);
      o.buy.setVisible(true).setAlpha(ok ? 1 : 0.5).setPosition(r.buy.x, r.buy.y);
    });
    g.fillStyle(0xd9b45a, 1); g.fillRoundedRect(L.close.x - L.close.w / 2, L.close.y - L.close.h / 2, L.close.w, L.close.h, 8);
    this.shopClose.setPosition(L.close.x, L.close.y);
    this.shopNote.setText(t < S.noteUntil ? S.note : '').setPosition(W / 2, L.close.y + 26);
  }

  canOpenInv() {
    const ph = this.stage && this.stage.phase;
    return !this.down && !this.cine && !this.transitioning && (ph === 'walk' || ph === 'cleared') && !this.atk && !this.roll && !this.drink && !this.dlg && !this.shop;
  }
  invBtnRect() { return { x: this.scale.width - 70, y: 28, w: 62, h: 24 }; }
  potPos() { return { x: this.scale.width - 46, y: this.scale.height - 196 }; }

  buildInv() {
    const mk = (o) => { o.setDepth(1100); this.ui.push(o); this.cameras.main.ignore(o); return o; };
    const tx = (size, color, stroke = 3) => ({ fontFamily: 'system-ui, sans-serif', fontSize: size + 'px', color, stroke: '#000000', strokeThickness: stroke });
    this.invOpen = false;
    this.invBtnText = mk(this.add.text(0, 0, '背包', tx(14, '#e6f0dc')).setOrigin(0.5).setDepth(1101));
    this.potText = mk(this.add.text(0, 0, '藥', tx(18, '#e6f0dc')).setOrigin(0.5).setDepth(1101));
    this.invTitle = mk(this.add.text(0, 0, '背包', tx(18, '#f0d890')).setOrigin(0.5, 0));
    this.invRows = ITEM_ORDER.map(id => ({
      id,
      name: mk(this.add.text(0, 0, '', tx(16, '#e6f0dc'))),
      desc: mk(this.add.text(0, 0, '', tx(12, '#c8d8c0'))),
      use: mk(this.add.text(0, 0, '使用', tx(14, '#16201a', 0)).setOrigin(0.5)),
    }));
    this.invClose = mk(this.add.text(0, 0, '離開', tx(16, '#16201a', 0)).setOrigin(0.5));
    this.invNote = mk(this.add.text(0, 0, '點道具名稱＝設為「藥」鍵快捷；戰鬥中只能用「藥」鍵', tx(11, '#a8b8a0')).setOrigin(0.5, 0));
    this.drops = [];
    this.dropGfx = this.add.graphics().setDepth(4000); this.world.push(this.dropGfx); this.uiCam.ignore(this.dropGfx);
    this.drink = null;
    this.layoutInv();
    this.setInvVisible(false);
  }

  setInvVisible(v) {
    this.invTitle.setVisible(v); this.invClose.setVisible(v); this.invNote.setVisible(v);
    for (const r of this.invRows) { r.name.setVisible(v); r.desc.setVisible(v); r.use.setVisible(v); }
  }

  layoutInv() {
    const W = this.scale.width, H = this.scale.height;
    const pw = Math.min(W - 24, 360), rowH = 58, ph = 56 + rowH * 4 + 78;
    const px = (W - pw) / 2, py = Math.max(12, (H - ph) / 2);
    this.inv_ = { px, py, pw, ph, rowH, rows: [] };
    this.invTitle.setPosition(W / 2, py + 12);
    ITEM_ORDER.forEach((id, i) => {
      const y = py + 50 + i * rowH, r = this.invRows[i];
      this.inv_.rows.push({ id, y, use: { x: px + pw - 44, y: y + 22, w: 64, h: 32 }, pick: { x0: px + 8, x1: px + pw - 84, y0: y - 4, y1: y + rowH - 6 } });
      r.name.setPosition(px + 16, y); r.desc.setPosition(px + 16, y + 24); r.use.setPosition(px + pw - 44, y + 22);
    });
    const by = py + 50 + rowH * 4 + 6;
    this.inv_.close = { x: W / 2, y: by + 18, w: 120, h: 36 };
    this.invClose.setPosition(W / 2, by + 18);
    this.invNote.setPosition(W / 2, by + 46);
    const r = this.invBtnRect(); this.invBtnText.setPosition(r.x + r.w / 2, r.y + r.h / 2);
  }

  openInv() { this.invOpen = true; this.joy.id = null; this.joy.active = false; this.joy.x = this.joy.y = this.joy.dx = this.joy.dy = 0; this.btn.held = false; this.layoutInv(); this.setInvVisible(true); }
  closeInv() { this.invOpen = false; this.setInvVisible(false); this.saveGrowth(); }

  invPointer(p) {
    if (this.invOpen) {
      const P = this.inv_;
      for (const r of P.rows) {
        if (!(r.id === 'flask' || this.invCount(r.id) > 0)) continue;
        const u = r.use;
        if (Math.abs(p.x - u.x) <= u.w / 2 && Math.abs(p.y - u.y) <= u.h / 2) {
          if (this.itemUseful(r.id)) this.applyItem(r.id);
        } else if (p.x >= r.pick.x0 && p.x <= r.pick.x1 && p.y >= r.pick.y0 && p.y <= r.pick.y1 && ITEMS[r.id].kind !== 'misc') this.quick = r.id;
      }
      const c = P.close;
      if (Math.abs(p.x - c.x) <= c.w / 2 && Math.abs(p.y - c.y) <= c.h / 2) this.closeInv();
      return true;
    }
    const r = this.invBtnRect();
    if (this.canOpenInv() && !this.panelOpen && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.openInv(); return true; }
    return false;
  }

  drawInvUI() {
    const g = this.pnGfx, t = this.nowT || 0, W = this.scale.width, k = 1 - this.cineK;
    // 背包鈕
    const r = this.invBtnRect(), can = this.canOpenInv() && !this.panelOpen && !this.invOpen;
    g.fillStyle(0x16201a, can ? 0.6 : 0.25); g.fillRoundedRect(r.x, r.y, r.w, r.h, 6);
    g.lineStyle(2, 0xe6f0dc, can ? 0.6 : 0.25); g.strokeRoundedRect(r.x, r.y, r.w, r.h, 6);
    this.invBtnText.setAlpha((can ? 1 : 0.35) * k).setVisible(!this.invOpen && !this.panelOpen);
    // 藥鍵
    const pp = this.potPos(), id = [this.quick, 'flask', 'jc', 'xq'].find(q => this.itemUseful(q)), shown = id || this.quick;
    const flash = false;   // 藥鍵不閃爍
    if (this.invOpen) this.potText.setVisible(false); else this.potText.setVisible(true);
    if (!this.invOpen) {
    g.fillStyle(0x16201a, this.drink ? 0.75 : 0.45); g.fillCircle(pp.x, pp.y, 28);
    g.lineStyle(3, flash ? 0xc0503a : (this.drink ? 0x9ad98a : 0xe6f0dc), this.drink ? 0.95 : 0.55); g.strokeCircle(pp.x, pp.y, 28);
    if (this.drink) { g.lineStyle(4, 0x9ad98a, 0.9); g.beginPath(); g.arc(pp.x, pp.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, (t - this.drink.start) / DRINK_MS), false); g.strokePath(); }
    this.potText.setText(ITEMS[shown].name.slice(0, 2) + '\n' + this.invCount(shown)).setFontSize(13).setPosition(pp.x, pp.y).setAlpha((id ? 1 : 0.4) * k);
    }
    if (!this.invOpen) return;
    const P = this.inv_;
    g.fillStyle(0x000000, 0.55); g.fillRect(0, 0, W, this.scale.height);
    g.fillStyle(0x16201a, 0.96); g.fillRoundedRect(P.px, P.py, P.pw, P.ph, 10);
    g.lineStyle(2, 0xe6f0dc, 0.7); g.strokeRoundedRect(P.px, P.py, P.pw, P.ph, 10);
    this.invTitle.setText('背包　氣血 ' + Math.ceil(this.php) + '/' + this.maxHp());
    for (const row of P.rows) {
      const rr = this.invRows.find(o => o.id === row.id), T = ITEMS[row.id], n = this.invCount(row.id);
      const have = row.id === 'flask' || n > 0;
      rr.name.setVisible(have).setText((this.quick === row.id ? '★ ' : '') + T.name + (row.id === 'flask' ? '　' + n + ' / ' + FLASK_MAX : '　× ' + n));
      rr.desc.setVisible(have).setText(T.desc);
      const ok = this.itemUseful(row.id);
      rr.use.setVisible(have && T.kind !== 'misc');
      if (!have) continue;
      g.lineStyle(1, 0xe6f0dc, 0.15); g.lineBetween(P.px + 12, row.y - 4, P.px + P.pw - 12, row.y - 4);
      if (T.kind !== 'misc') { g.fillStyle(ok ? 0xd9b45a : 0x555044, 1); g.fillRoundedRect(row.use.x - row.use.w / 2, row.use.y - row.use.h / 2, row.use.w, row.use.h, 8); }
    }
    g.fillStyle(0xd9b45a, 1); g.fillRoundedRect(P.close.x - 60, P.close.y - 18, 120, 36, 8);
  }

  // 只在祠堂內、站在祭壇旁才能參拜升級
  canOpenPanel() {
    const ph = this.stage && this.stage.phase;
    return !this.down && !this.cine && (ph === 'walk' || ph === 'cleared') && !this.atk && !this.roll && !!this.nearCamp();
  }

  prayRect() { return { x: this.scale.width / 2 - 52, y: this.scale.height - 260, w: 104, h: 36 }; }

  buildPanel() {
    const mk = (o) => { o.setDepth(1100); this.ui.push(o); this.cameras.main.ignore(o); return o; };
    const tx = (size, color, stroke = 3) => ({ fontFamily: 'system-ui, sans-serif', fontSize: size + 'px', color, stroke: '#000000', strokeThickness: stroke });
    this.lvText = mk(this.add.text(14, 42, '', tx(13, '#e8d890')).setDepth(1001));
    this.pnGfx = mk(this.add.graphics());
    this.pnBtnText = mk(this.add.text(0, 0, '參拜（升級）', tx(15, '#16201a', 0)).setOrigin(0.5).setDepth(1101));
    this.pnTitle = mk(this.add.text(0, 0, '', tx(16, '#f0d890')).setOrigin(0.5, 0));
    this.pnRows = STAT_KEYS.map(k => ({
      k,
      name: mk(this.add.text(0, 0, STAT_NAMES[k], tx(17, '#e6f0dc'))),
      val: mk(this.add.text(0, 0, '', tx(13, '#c8d8c0'))),
      plus: mk(this.add.text(0, 0, '＋', tx(26, '#16201a', 0)).setOrigin(0.5)),
    }));
    this.pnClose = mk(this.add.text(0, 0, '離開', tx(16, '#16201a', 0)).setOrigin(0.5));
    this.pnNote = mk(this.add.text(0, 0, '加點後無法退回，請慎重分配', tx(12, '#a8b8a0')).setOrigin(0.5, 0));
    this.panelOpen = false;
    this.layoutPanel();
    this.setPanelVisible(false);
  }

  setPanelVisible(v) {
    this.pnGfx.setVisible(true); this.pnTitle.setVisible(v); this.pnClose.setVisible(v); this.pnNote.setVisible(v);
    for (const r of this.pnRows) { r.name.setVisible(v); r.val.setVisible(v); r.plus.setVisible(v); }
  }

  layoutPanel() {
    const W = this.scale.width, H = this.scale.height;
    const pw = Math.min(W - 24, 360), rowH = 54, ph = 62 + rowH * 4 + 80;
    const px = (W - pw) / 2, py = Math.max(12, (H - ph) / 2);
    this.pn = { px, py, pw, ph, rowH, rows: [] };
    this.pnTitle.setPosition(W / 2, py + 12);
    this.pnTitle.setWordWrapWidth(pw - 20).setAlign('center');
    STAT_KEYS.forEach((k, i) => {
      const y = py + 62 + i * rowH, r = this.pnRows[i], bx = px + pw - 32;
      this.pn.rows.push({ k, y, plus: { x: bx, y: y + 20, r: 24 } });
      r.name.setPosition(px + 16, y); r.val.setPosition(px + 16, y + 24); r.plus.setPosition(bx, y + 20);
    });
    const by = py + 62 + rowH * 4 + 10;
    this.pn.close = { x: W / 2, y: by + 18, w: 120, h: 36 };
    this.pnClose.setPosition(W / 2, by + 18);
    this.pnNote.setPosition(W / 2, by + 46);
    const r = this.prayRect(); this.pnBtnText.setPosition(r.x + r.w / 2, r.y + r.h / 2);
  }

  openPanel() { this.inv.flask = FLASK_MAX; this.saveGrowth(); this.panelOpen = true; this.joy.id = null; this.joy.active = false; this.joy.x = this.joy.y = this.joy.dx = this.joy.dy = 0; this.btn.held = false; this.layoutPanel(); this.setPanelVisible(true); }
  closePanel() { this.panelOpen = false; this.setPanelVisible(false); this.saveGrowth(); }

  // 回傳 true 表示這次點擊被面板／參拜鈕吃掉
  panelPointer(p) {
    if (this.panelOpen) {
      for (const r of this.pn.rows) if (Math.hypot(p.x - r.plus.x, p.y - r.plus.y) <= r.plus.r) this.buyStat(r.k);
      const c = this.pn.close;
      if (Math.abs(p.x - c.x) <= c.w / 2 && Math.abs(p.y - c.y) <= c.h / 2) this.closePanel();
      return true;
    }
    const r = this.prayRect();
    if (this.canOpenPanel() && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.openPanel(); return true; }
    return false;
  }

  drawPanelUI() {
    const g = this.pnGfx, t = this.nowT || 0;
    g.clear();
    this.drawCamps(t);
    this.lvText.setText('Lv ' + this.lv + '　經驗 ' + this.xp + (this.pending > 0 ? '　（待結算 +' + this.pending + '）' : ''));
    const can = this.canOpenPanel(), r = this.prayRect();
    if (can && !this.panelOpen) {
      g.fillStyle(0xd9b45a, 0.95); g.fillRoundedRect(r.x, r.y, r.w, r.h, 8);
    }
    this.pnBtnText.setVisible(can && !this.panelOpen);
    g.setAlpha(1 - this.cineK); this.pnBtnText.setAlpha(1 - this.cineK);
    if (!this.panelOpen) return;
    this.pnBtnText.setVisible(false);
    const P = this.pn, need = xpNeed(this.lv);
    g.fillStyle(0x000000, 0.55); g.fillRect(0, 0, this.scale.width, this.scale.height);
    g.fillStyle(0x16201a, 0.96); g.fillRoundedRect(P.px, P.py, P.pw, P.ph, 10);
    g.lineStyle(2, 0xe6f0dc, 0.7); g.strokeRoundedRect(P.px, P.py, P.pw, P.ph, 10);
    this.pnTitle.setText('祠堂　Lv ' + this.lv + (this.lv >= MAX_LV ? '（已達上限）' : '\n經驗 ' + this.xp + '　升一級需 ' + need));
    for (const row of P.rows) {
      const rr = this.pnRows.find(o => o.k === row.k), p = this.stats[row.k];
      rr.val.setText(p + ' / ' + STAT_CAP + '　' + STAT_DESC[row.k](p) + (p < STAT_CAP ? ' → ' + STAT_DESC[row.k](p + 1).replace(/^\D+/, '') : ''));
      g.lineStyle(1, 0xe6f0dc, 0.15); g.lineBetween(P.px + 12, row.y - 4, P.px + P.pw - 12, row.y - 4);
      const ok = p < STAT_CAP && this.lv < MAX_LV && this.xp >= need;
      g.fillStyle(ok ? 0xd9b45a : 0x555044, 1); g.fillCircle(row.plus.x, row.plus.y, row.plus.r);
    }
    g.fillStyle(0xd9b45a, 1); g.fillRoundedRect(P.close.x - 60, P.close.y - 18, 120, 36, 8);
  }

  // ---------- 玩家受傷與倒下 ----------
  hurtPlayer(dmg, sx, sy, time) {
    if (this.down || this.cine || time < this.invulnUntil || (time >= this.rollIFrom && time < this.rollIUntil)) return false;
    dmg = Math.max(1, Math.round(dmg * (1 - statDef(this.stats.def))));
    this.php = Math.max(0, this.php - dmg);
    this.roll = null; this.drink = null;
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
    this.pending = 0;   // 結算前倒下，待結算的經驗就沒了
    this.php = this.maxHp();
    this.invulnUntil = time + 1500;
    this.stam = this.maxStam(); this.roll = null;
    this.hero.setAngle(0);
    this.downText.setVisible(false);
    const sp0 = this.area === 'field' ? FIELD_START : START;
    this.playerBody.body.reset(sp0.x, sp0.y);
    // 倒下＝整段重來：伏兵全部回到樹林裡，重新往上走
    for (const b of this.bandits) this.hideBandit(b);
    if (this.area === 'field') this.resetBattle();
    this.stage = { phase: 'walk', t0: 0 };
    this.bannerText.setVisible(false);
    this.cine = false; this.heroAlert.setVisible(false);
  }

  // ---------- 戰場生成器：活躍上限、待命隊列、補入 ----------
  resetBattle() {
    this.battle = { queue: this.bandits.slice(), started: 0, lastSpawn: -1e9 };
    if (this.objText) this.objText.setVisible(false);
  }
  battleActive() { return this.bandits.filter(b => !b.hidden && b.state !== 'dead').length; }
  // 挑一個離主角夠遠的出兵點（盡量在畫面外），找不到就用最遠的幾個
  pickFieldSpawn() {
    const px = this.playerBody.x, py = this.playerBody.y, d = s => Math.hypot(s.x - px, s.y - py);
    const far = FIELD_SPAWNS.filter(s => d(s) > 200);
    const pool = far.length ? far : FIELD_SPAWNS.slice().sort((a, b) => d(b) - d(a)).slice(0, 3);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  updateBattle(time) {
    const st = this.stage, B = FIELD_BATTLE, bt = this.battle;
    if (st.phase === 'walk' && !this.down && this.playerBody.y < FIELD_TRIGGER_Y) {
      st.phase = 'fight'; st.t0 = time; bt.started = time; bt.lastSpawn = -1e9;
      this.banner(B.name, 1800);
    }
    if (st.phase === 'fight' && !this.down) {
      // 場上人數目標：開戰先上 startActive 個，之後每 rampMs 多一個，最多 cap；有人倒下就低於目標，自動補入
      const want = Math.min(B.cap, B.startActive + Math.floor((time - bt.started) / B.rampMs));
      if (bt.queue.length && this.battleActive() < want && time - bt.lastSpawn >= B.gapMs) {
        const b = bt.queue.shift(), p = this.pickFieldSpawn();
        b.spawn = Object.assign({}, b.spawn, { x: p.x, y: p.y, ex: p.ex + (Math.random() - 0.5) * 40, ey: p.ey + (Math.random() - 0.5) * 30 });
        this.revealBandit(b, time);
        bt.lastSpawn = time;
      }
      if (!bt.queue.length && this.bandits.every(b => !b.hidden && b.dead)) {
        st.phase = 'cleared'; st.t0 = time;
        const got = this.settleXp();
        this.banner('擊退黃巾\n獲得 ' + got + ' 經驗', 3000);
      }
    }
    if (st.phase === 'cleared' && time - st.t0 > 4200) {
      st.phase = 'end';
      this.gotoArea('town', { x: TOWN_GATE.x, y: TOWN_GATE.y }, 'left');   // 戰役結束，回到鎮內
    }
    const left = bt.queue.length + this.battleActive();
    this.objText.setVisible(st.phase === 'fight').setText('剩餘黃巾 ' + left);
  }

  // ---------- 森林小道：伏擊流程 ----------
  updateStage(time) {
    const st = this.stage, py = this.playerBody.y;
    if (this.area === 'forest' && st.phase === 'walk' && !this.down && py < AMBUSH_Y) {
      // 出場動畫：黑條滑入、主角停住（無敵、不能操作），頭頂跳出紅色驚嘆號，伏兵慢慢走出來
      st.phase = 'intro'; st.t0 = time;
      this.cine = true; this.atk = null; this.roll = null; this.atkBuf = 0; this.rollBuf = 0;
      this.heroAlert.setVisible(true).setScale(0.6); this.heroAlertUntil = time + 1400;
      this.hintText.setVisible(false);
    }
    if (this.area === 'field') this.updateBattle(time);
    if (this.area === 'forest' && (st.phase === 'intro' || st.phase === 'fight')) {
      for (const b of this.bandits) if (b.hidden && time - st.t0 >= b.spawn.delay) this.revealBandit(b, time);
    }
    if (st.phase === 'intro' && time - st.t0 >= CINE_MS) { st.phase = 'fight'; this.cine = false; }
    // 黑條與操作介面跟著 cine 淡入淡出
    const k = this.cineK = Math.max(0, Math.min(1, this.cineK + (this.cine ? 1 : -1) * 0.06));
    const bh = Math.round(this.scale.height * 0.11 * k), W = this.scale.width;
    this.barTop.setSize(W, bh).setVisible(bh > 0); this.barBot.setPosition(0, this.scale.height - bh).setSize(W, bh).setVisible(bh > 0);
    for (const o of [this.joyGfx, this.btnGfx, this.btnText, this.dgGfx, this.dgText, this.hpGfx, this.hpText, this.lvText, this.pnBtnText]) o.setAlpha(1 - k);
    if (this.area === 'forest' && st.phase === 'fight') {
      if (this.bandits.every(b => !b.hidden && b.dead)) { st.phase = 'cleared'; const got = this.settleXp(); this.banner('擊退伏兵\n獲得 ' + got + ' 經驗\n往北前進', 3000); }
    }
    if (this.area === 'forest' && st.phase === 'cleared' && !this.down && py < EXIT_Y) {
      st.phase = 'end'; st.t0 = time;
      this.gotoArea('field', { x: FIELD_START.x, y: FIELD_START.y }, 'up');   // 擊退伏兵後往北走出森林，進入幽州戰場
    }
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
  buildForest() { this.buildWoods(walkable, 11, 'forest_ground', true); }
  buildField() { this.buildWoods(fieldWalkable, 23, 'field_ground', false); }

  buildWoods(walk, seed0, groundKey, forestProps) {
    let seed = seed0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // 1. 先決定樹的位置：小道與空地以外，錯開的格子＋隨機偏移
    const trees = [];
    for (let gy = 10, row = 0; gy < MAP_H + 60; gy += 34, row++) {
      for (let gx = (row % 2) * 22 - 10; gx < MAP_W + 30; gx += 44) {
        const x = gx + (rnd() - 0.5) * 22, y = gy + (rnd() - 0.5) * 16;
        if (walk(x, y) || walk(x, y - 8) || walk(x - 10, y) || walk(x + 10, y)) continue;
        const r = rnd(), kind = r < 0.38 ? 0 : r < 0.72 ? 1 : 2;           // 松、櫟、柏
        const baseH = [104, 98, 118][kind] * (0.88 + rnd() * 0.26);
        trees.push({ x, y, kind, h: baseH, flip: rnd() < 0.5, shade: 0.74 + rnd() * 0.26 });
      }
    }
    // 2. 地面：林地與泥土兩張圖鋪滿，小道與林地交界用噪點做出不規則的草泥過渡（只畫一次、之後當一張圖，手機比較省）
    const C = 2, cw = Math.ceil(MAP_W / C), ch = Math.ceil(MAP_H / C), TW = 72;   // 一格地磚在世界裡約 144 單位
    const cached = this.textures.exists(groundKey);
    let cv = null;
    if (cached) { for (let n = 0; n < cw * ch; n++) rnd(); }   // 讓之後的亂數與第一次一致（灌木、石頭位置不變）
    else {
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
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) m[j * mw + i] = walk(i * M + 2, j * M + 2) ? 1 : 0;
    const blur = (src, r) => {
      const a = new Float32Array(src.length), b = new Float32Array(src.length);
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const q = i + k; if (q >= 0 && q < mw) { t += src[j * mw + q]; n++; } } a[j * mw + i] = t / n; }
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const q = j + k; if (q >= 0 && q < mh) { t += a[q * mw + i]; n++; } } b[j * mw + i] = t / n; }
      return b;
    };
    m = blur(blur(m, 2), 2);
    cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
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
    this.textures.addCanvas(groundKey, cv).setFilter(Phaser.Textures.FilterMode.NEAREST);   // 放大時保持像素硬邊
    if (['forest_ground', 'field_ground', 'town_ground7'].every(k => this.textures.exists(k))) { this.textures.remove('forest_floor'); this.textures.remove('dirt_path'); }   // 森林、戰場、鎮內地面都做好了才釋放原圖
    }
    this.world.push(this.add.image(0, 0, groundKey).setOrigin(0).setScale(C).setDepth(-20));
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
      if (walk(x, y)) continue;
      if (walk(x - 14, y) || walk(x + 14, y) || walk(x, y - 14) || walk(x, y + 14)) rim.push([x, y]);
    }
    const pick = () => rim.splice(Math.floor(rnd() * rim.length), 1)[0];
    for (let n = 0; n < 26 && rim.length; n++) { const [x, y] = pick(); place('bush_01_k', x + (rnd() - 0.5) * 8, y, 26 + rnd() * 10, false, rnd() < 0.5); }
    for (let n = 0; n < 8 && rim.length; n++) { const [x, y] = pick(); place('rock_01_k', x, y, 18 + rnd() * 8, false, rnd() < 0.5); }
    for (let n = 0; n < 4 && rim.length; n++) { const [x, y] = pick(); place('log_01_k', x, y, 18, false, rnd() < 0.5); }
    if (forestProps) {
      // 空地邊緣：擋路的石頭與倒木（避開小道出入口與伏兵衝出的位置）
      place('rock_01_k', 100, 505, 26, true, false);
      place('rock_01_k', 362, 500, 24, true, true);
      place('rock_01_k', 322, 655, 22, true, false);
      place('log_01_k', 118, 628, 20, true, false);
      place('bush_01_k', 372, 628, 30, false, true);
    }

    // 4. 看不見的牆：小道、空地、側小徑以外都走不進去（每列連續的區段合併，再把上下相同的合併）
    this.obstacles = this.physics.add.staticGroup();
    const S = 8, open = [];
    for (let y = 0; y < MAP_H; y += S) {
      const runs = []; let x0 = null;
      for (let x = 0; x <= MAP_W; x += S) {
        const blocked = x < MAP_W && !walk(x + S / 2, y + S / 2);
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
    if (this.textures.exists('dummy')) return;
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
    this.drawInvUI();
    this.updateWalkers();
    this.drawDialogUI();
    this.drawShopUI();

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
