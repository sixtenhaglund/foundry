// FOUNDRY - what exists in the game: tiles, objects, enemy + boss designs, saving.
'use strict';

// ---- Tiles ------------------------------------------------------------------
// solid: blocks the player. bul: blocks bullets. rok: blocks rockets. las: blocks lasers.
const TILES = {
  '.': { name: 'Empty' },
  '#': { name: 'Steel wall', solid: 1, bul: 1, rok: 1, las: 1, col: '#5b6470' },
  'C': { name: 'Concrete', solid: 1, bul: 1, rok: 1, las: 1, col: '#6e6a63' },
  'R': { name: 'Rusty plate', solid: 1, bul: 1, rok: 1, las: 1, col: '#7a4a2e' },
  'H': { name: 'Hazard block', solid: 1, bul: 1, rok: 1, las: 1, col: '#c9a227' },
  'G': { name: 'Grate (bullets pass, rockets stop)', solid: 1, rok: 1, col: '#4a5560' },
  '=': { name: 'Girder platform (jump through)', oneway: 1, col: '#8a5a2b' },
  'L': { name: 'Ladder', ladder: 1, col: '#9a8a5a' },
  '~': { name: 'Water', water: 1, col: '#2a6aa0' },
  '^': { name: 'Spikes up', spike: 1, col: '#b0b8c0' },
  'v': { name: 'Spikes down', spike: 1, col: '#b0b8c0' },
  '<': { name: 'Spikes left', spike: 1, col: '#b0b8c0' },
  '>': { name: 'Spikes right', spike: 1, col: '#b0b8c0' },
  'D': { name: 'Arena gate (closes in boss fights)', gate: 1, col: '#a03030' },
};
const BG_TILES = {
  '.': { name: 'None' },
  'w': { name: 'Wall panels', col: '#262b33' },
  'p': { name: 'Pipe wall', col: '#2a2724' },
  'b': { name: 'Dark brick', col: '#2b2320' },
  'm': { name: 'Mesh window', col: '#1c2228' },
  'c': { name: 'Caution wall', col: '#2c2a1e' },
};
const FG_KEYS = ['#', 'C', 'R', 'H', 'G', '=', 'L', '~', '^', 'v', '<', '>', 'D'];
const BG_KEYS = ['w', 'p', 'b', 'm', 'c'];

// ---- Objects ----------------------------------------------------------------
// props: [key, label, type, a, b, step] type: num | sel | bool | text | enemy | boss
const DECO_KINDS = ['lamp', 'cage lamp', 'red beacon', 'warning sign', 'skull sign', 'exit sign', 'vent', 'fan', 'barrel',
  'toxic barrel', 'crate', 'gear', 'pipe across', 'pipe up', 'chain', 'cables', 'monitor', 'steam', 'tank', 'girder', 'hazard tape', 'gauge'];

const OBJ = {
  spawn:     { cat: 'MECHANICS', name: 'Player start', w: 10, h: 20, props: [] },
  exit:      { cat: 'MECHANICS', name: 'Exit door', w: 24, h: 32, props: [] },
  checkpoint:{ cat: 'MECHANICS', name: 'Checkpoint', w: 10, h: 24, props: [] },
  sign:      { cat: 'MECHANICS', name: 'Message sign', w: 14, h: 12, props: [['text', 'Message', 'text']], def: { text: 'HELLO' } },
  platform:  { cat: 'MECHANICS', name: 'Moving platform', props: [['tw', 'Width (tiles)', 'num', 1, 12, 1]], def: { tw: 3 } },
  ammo:      { cat: 'PICKUPS', name: 'Bullet ammo', w: 12, h: 10, props: [['amount', 'Bullets', 'num', 1, 99, 1]], def: { amount: 10 } },
  rockets:   { cat: 'PICKUPS', name: 'Rocket ammo', w: 12, h: 10, props: [['amount', 'Rockets', 'num', 1, 20, 1]], def: { amount: 2 } },
  health:    { cat: 'PICKUPS', name: 'Health pack', w: 12, h: 10, props: [['amount', 'Heals', 'num', 5, 100, 5]], def: { amount: 40 } },
  crusher:   { cat: 'HAZARDS', name: 'Crusher', props: [['tw', 'Width (tiles)', 'num', 1, 8, 1], ['len', 'Slam distance (tiles)', 'num', 1, 20, 1],
               ['dir', 'Slams', 'sel', ['down', 'up', 'left', 'right']], ['period', 'Every (sec)', 'num', 0.6, 10, 0.1], ['delay', 'Delay (sec)', 'num', 0, 10, 0.1],
               ['hold', 'Stays shut (sec)', 'num', 0, 3, 0.1]], def: { tw: 2, len: 4, dir: 'down', period: 2.4, delay: 0, hold: 0.3 } },
  saw:       { cat: 'HAZARDS', name: 'Saw blade', props: [['r', 'Size', 'num', 6, 60, 1], ['dmg', 'Damage', 'num', 5, 100, 5]], def: { r: 12, dmg: 40 } },
  turret:    { cat: 'HAZARDS', name: 'Turret', props: [['mode', 'Shoots', 'sel', ['when crossed', 'randomly', 'aims at you']], ['angle', 'Direction (deg)', 'num', -180, 180, 15],
               ['rate', 'Shots / sec', 'num', 0.2, 8, 0.1], ['range', 'Range', 'num', 32, 600, 8], ['hp', 'Health (0 = can not die)', 'num', 0, 300, 5], ['dmg', 'Damage', 'num', 1, 60, 1]],
               def: { mode: 'when crossed', angle: 180, rate: 3, range: 260, hp: 40, dmg: 10 } },
  cturret:   { cat: 'HAZARDS', name: 'Ceiling turret (can not die)', props: [['rate', 'Bursts / sec', 'num', 0.2, 4, 0.1], ['range', 'Range', 'num', 64, 600, 8], ['dmg', 'Damage', 'num', 1, 60, 1]],
               def: { rate: 0.7, range: 300, dmg: 8 } },
  coil:      { cat: 'HAZARDS', name: 'Electric coil', props: [['range', 'Arc range', 'num', 16, 200, 4], ['period', 'Every (sec)', 'num', 0.4, 8, 0.1], ['on', 'Arc time (sec)', 'num', 0.1, 4, 0.1],
               ['delay', 'Delay (sec)', 'num', 0, 8, 0.1], ['dmg', 'Damage', 'num', 5, 100, 5]], def: { range: 64, period: 2, on: 0.6, delay: 0, dmg: 30 } },
  laser:     { cat: 'HAZARDS', name: 'Laser', props: [['angle', 'Direction (deg)', 'num', -180, 180, 5], ['turn', 'Turning speed (deg/sec, 0 = straight)', 'num', -360, 360, 5],
               ['len', 'Max length', 'num', 16, 1200, 8], ['on', 'On time (0 = always on)', 'num', 0, 10, 0.1], ['off', 'Off time', 'num', 0, 10, 0.1],
               ['delay', 'Delay (sec)', 'num', 0, 10, 0.1], ['dps', 'Damage / sec', 'num', 10, 999, 10], ['color', 'Colour', 'sel', ['red', 'green', 'blue', 'purple']]],
               def: { angle: 0, turn: 0, len: 400, on: 0, off: 0, delay: 0, dps: 200, color: 'red' } },
  enemy:     { cat: 'ENEMIES', name: 'Enemy', props: [['def', 'Type', 'enemy'], ['face', 'Faces', 'sel', ['left', 'right']]], def: { def: 'grunt', face: 'left' } },
  boss:      { cat: 'BOSSES', name: 'Boss', props: [['def', 'Boss', 'boss']], def: { def: 'warden' } },
  arena:     { cat: 'BOSSES', name: 'Boss arena', props: [['tw', 'Width (tiles)', 'num', 6, 80, 1], ['th', 'Height (tiles)', 'num', 4, 40, 1]], def: { tw: 24, th: 12 } },
  deco:      { cat: 'DECOR', name: 'Decoration', props: [['kind', 'Kind', 'sel', DECO_KINDS], ['front', 'In front of player', 'bool']], def: { kind: 'lamp', front: false } },
};
// object types that can follow keyframes
const MOVABLE = { platform: 1, saw: 1, laser: 1, turret: 1, cturret: 1, coil: 1, deco: 1, crusher: 1, sign: 1, ammo: 1, rockets: 1, health: 1 };

// size of an object (for selection + drawing), centred on o.x,o.y
function objSize(o) {
  const d = OBJ[o.t]; if (!d) return { w: 16, h: 16 };
  switch (o.t) {
    case 'platform': return { w: (o.tw || 3) * TS, h: 8 };
    case 'crusher': return (o.dir === 'left' || o.dir === 'right') ? { w: 16, h: (o.tw || 2) * TS } : { w: (o.tw || 2) * TS, h: 16 };
    case 'saw': return { w: (o.r || 12) * 2, h: (o.r || 12) * 2 };
    case 'turret': return { w: 14, h: 14 };
    case 'cturret': return { w: 16, h: 12 };
    case 'coil': return { w: 12, h: 22 };
    case 'laser': return { w: 10, h: 10 };
    case 'arena': return { w: (o.tw || 24) * TS, h: (o.th || 12) * TS };
    case 'enemy': { const e = getEnemy(o.def); const s = enemySize(e); return s; }
    case 'boss': { const b = getBoss(o.def); return bossSize(b); }
    case 'deco': return decoSize(o.kind);
  }
  return { w: d.w || 16, h: d.h || 16 };
}
function decoSize(k) {
  return ({ 'lamp': [10, 8], 'cage lamp': [8, 10], 'red beacon': [8, 8], 'warning sign': [14, 12], 'skull sign': [14, 12], 'exit sign': [16, 8], 'vent': [16, 10],
    'fan': [20, 20], 'barrel': [12, 16], 'toxic barrel': [12, 16], 'crate': [16, 16], 'gear': [24, 24], 'pipe across': [32, 6], 'pipe up': [6, 32], 'chain': [4, 32],
    'cables': [32, 12], 'monitor': [16, 12], 'steam': [8, 8], 'tank': [24, 32], 'girder': [32, 8], 'hazard tape': [32, 4], 'gauge': [10, 10] }[k] || [16, 16])
    .reduce((o, v, i) => (o[i ? 'h' : 'w'] = v, o), {});
}

// ---- Enemy designs ----------------------------------------------------------
// lvl: 0 = shown in SIMPLE, 1 = NORMAL, 2 = ADVANCED
const ENEMY_FIELDS = [
  ['name', 'Name', 'text', 0],
  ['body', 'Body', 'sel', 0, ['soldier', 'robot', 'drone', 'brute', 'crawler']],
  ['color', 'Main colour', 'color', 0],
  ['tough', 'Toughness', 'sel', 0, ['weak', 'normal', 'tough', 'tank']],
  ['weapon', 'Weapon', 'sel', 0, ['none', 'pistol', 'rifle', 'shotgun', 'rocket', 'laser']],
  ['shield', 'Shield', 'sel', 0, ['none', 'raises when aimed at', 'raises when hit', 'always up']],
  ['ai', 'Behaviour', 'sel', 1, ['patrol', 'guard', 'chase', 'fly']],
  ['size', 'Size', 'num', 1, 0.6, 2.5, 0.1],
  ['speed', 'Speed', 'num', 1, 0, 200, 5],
  ['rate', 'Shots / sec', 'num', 1, 0.1, 6, 0.1],
  ['dmg', 'Damage', 'num', 1, 1, 80, 1],
  ['contact', 'Touch damage', 'num', 1, 0, 80, 1],
  ['drop', 'Drops', 'sel', 1, ['nothing', 'ammo', 'rockets', 'health', 'random']],
  ['jump', 'Can jump', 'bool', 1],
  ['accent', 'Second colour', 'color', 2],
  ['eye', 'Eye colour', 'color', 2],
  ['hp', 'Exact health (0 = use toughness)', 'num', 2, 0, 999, 5],
  ['sight', 'Sight range', 'num', 2, 32, 600, 8],
  ['bspeed', 'Bullet speed', 'num', 2, 60, 600, 10],
  ['spread', 'Inaccuracy (deg)', 'num', 2, 0, 45, 1],
  ['burst', 'Shots per burst', 'num', 2, 1, 12, 1],
  ['pellets', 'Bullets per shot', 'num', 2, 1, 12, 1],
  ['shieldHp', 'Shield strength', 'num', 2, 5, 400, 5],
  ['shieldTime', 'Shield up time (sec)', 'num', 2, 0.3, 10, 0.1],
  ['shieldCd', 'Shield cooldown (sec)', 'num', 2, 0, 10, 0.1],
  ['shootShield', 'Shoots with shield up', 'bool', 2],
  ['heavy', 'Knockback resistance', 'num', 2, 0, 1, 0.1],
  ['keepDist', 'Keeps distance', 'num', 2, 0, 300, 8],
];
const ENEMY_BASE = { name: 'NEW ENEMY', body: 'soldier', color: '#5a7a4a', accent: '#2b2f36', eye: '#ff4030', tough: 'normal', weapon: 'pistol', shield: 'none',
  ai: 'patrol', size: 1, speed: 40, rate: 1, dmg: 10, contact: 10, drop: 'random', jump: false, hp: 0, sight: 220, bspeed: 260, spread: 4, burst: 1, pellets: 1,
  shieldHp: 60, shieldTime: 2, shieldCd: 2, shootShield: false, heavy: 0, keepDist: 0, mode: 0 };
const ENEMY_DEFAULTS = {
  grunt:     { name: 'GRUNT', body: 'soldier', color: '#5a7a4a', weapon: 'pistol', tough: 'normal', ai: 'patrol' },
  shieldman: { name: 'RIOT GUARD', body: 'soldier', color: '#3d5a80', weapon: 'rifle', shield: 'raises when aimed at', ai: 'guard', burst: 3, rate: 0.6, shieldHp: 80 },
  drone:     { name: 'DRONE', body: 'drone', color: '#7a7f88', accent: '#30343a', weapon: 'pistol', ai: 'fly', tough: 'weak', speed: 60, keepDist: 90, contact: 0 },
  brute:     { name: 'BRUTE', body: 'brute', color: '#8a4a3a', weapon: 'shotgun', ai: 'chase', tough: 'tough', size: 1.3, pellets: 5, spread: 18, rate: 0.6, speed: 35, heavy: 0.7 },
  crawler:   { name: 'CRAWLER', body: 'crawler', color: '#6a8a2a', eye: '#ffe030', weapon: 'none', ai: 'chase', tough: 'weak', speed: 110, contact: 20, jump: true },
  rocketeer: { name: 'ROCKETEER', body: 'robot', color: '#9a8a5a', weapon: 'rocket', ai: 'guard', rate: 0.35, dmg: 40 },
  sniper:    { name: 'LASER SNIPER', body: 'robot', color: '#5a4a7a', eye: '#ff40ff', weapon: 'laser', ai: 'guard', rate: 0.4, dmg: 30, sight: 400 },
};

// ---- Boss designs -----------------------------------------------------------
const BOSS_ATTACKS = {
  burst: 'Aimed burst', spray: 'Bullet ring', rockets: 'Rocket volley', sweep: 'Laser sweep', slam: 'Jump slam + shockwave',
  dash: 'Dash charge', summon: 'Summon minions', saws: 'Rolling saws', shock: 'Electric strikes', mines: 'Drop mines',
};
const BOSS_FIELDS = [
  ['name', 'Name', 'text', 0],
  ['body', 'Body', 'sel', 0, ['mech', 'tank', 'drone', 'core', 'walker']],
  ['color', 'Main colour', 'color', 0],
  ['diff', 'Difficulty', 'num', 0, 1, 5, 1],
  ['attacks', 'Attacks', 'attacks', 0],
  ['minion', 'Minion (for summon)', 'enemy', 0],
  ['hp', 'Health', 'num', 1, 100, 5000, 50],
  ['move', 'Movement', 'sel', 1, ['walk', 'hover', 'still', 'teleport', 'bounce']],
  ['speed', 'Move speed', 'num', 1, 0, 300, 5],
  ['size', 'Size', 'num', 1, 0.6, 3, 0.1],
  ['cd', 'Rest between attacks (sec)', 'num', 1, 0.2, 5, 0.1],
  ['contact', 'Touch damage', 'num', 1, 0, 80, 5],
  ['accent', 'Second colour', 'color', 1],
  ['eye', 'Eye / core colour', 'color', 2],
  ['bullets', 'Bullets per attack', 'num', 2, 2, 40, 1],
  ['bspeed', 'Bullet speed', 'num', 2, 60, 600, 10],
  ['dmg', 'Bullet damage', 'num', 2, 1, 60, 1],
  ['phases', 'Phases', 'phases', 2],
];
const BOSS_BASE = { name: 'NEW BOSS', body: 'mech', color: '#7a6a5a', accent: '#2a2d33', eye: '#ff3020', diff: 3, attacks: ['burst', 'slam'], minion: 'grunt',
  hp: 0, move: 'walk', speed: 50, size: 1, cd: 1.4, contact: 25, bullets: 0, bspeed: 0, dmg: 0, phases: [], mode: 0 };
const BOSS_DEFAULTS = {
  warden:   { name: 'THE WARDEN', body: 'mech', color: '#8a6a3a', attacks: ['burst', 'slam', 'rockets', 'summon'], minion: 'grunt', move: 'walk', diff: 3 },
  overseer: { name: 'OVERSEER', body: 'drone', color: '#5a6a7a', eye: '#30e0ff', attacks: ['spray', 'sweep', 'shock', 'mines'], move: 'hover', diff: 3, speed: 70 },
  smelter:  { name: 'SMELTER CORE', body: 'core', color: '#7a3a2a', eye: '#ffa020', attacks: ['spray', 'saws', 'sweep', 'shock'], move: 'still', diff: 4,
              phases: [{ at: 1, attacks: ['spray', 'saws'], speed: 1, cd: 1 }, { at: 0.6, attacks: ['spray', 'sweep', 'saws'], speed: 1, cd: 0.8 }, { at: 0.3, attacks: ['sweep', 'shock', 'spray', 'saws'], speed: 1, cd: 0.6 }], mode: 2 },
};

// ---- Saved custom designs (localStorage = the browser's small save box) -----
const STORE = { levels: 'foundry_levels', enemies: 'foundry_enemies', bosses: 'foundry_bosses' };
function loadStore(k, fallback) { try { const v = JSON.parse(localStorage.getItem(STORE[k])); return v ?? fallback; } catch (e) { return fallback; } }
function saveStore(k, v) { try { localStorage.setItem(STORE[k], JSON.stringify(v)); } catch (e) { } }
let customEnemies = loadStore('enemies', {});
let customBosses = loadStore('bosses', {});
let levelEnemies = {}, levelBosses = {};   // designs that came inside an imported level

const TOUGH_HP = { weak: 20, normal: 40, tough: 90, tank: 180 };
function getEnemy(id) {
  const src = customEnemies[id] || levelEnemies[id] || ENEMY_DEFAULTS[id] || ENEMY_DEFAULTS.grunt;
  const e = Object.assign({}, ENEMY_BASE, src, { id });
  e.maxHp = e.hp > 0 ? e.hp : TOUGH_HP[e.tough] || 40;
  if (e.body === 'drone' && e.ai !== 'fly') e.ai = 'fly';
  return e;
}
function enemySize(e) {
  const s = e.size || 1;
  const b = { soldier: [10, 20], robot: [12, 20], drone: [16, 10], brute: [14, 22], crawler: [16, 9] }[e.body] || [10, 20];
  return { w: Math.round(b[0] * s), h: Math.round(b[1] * s) };
}
function getBoss(id) {
  const src = customBosses[id] || levelBosses[id] || BOSS_DEFAULTS[id] || BOSS_DEFAULTS.warden;
  const b = Object.assign({}, BOSS_BASE, src, { id });
  const d = b.diff || 3;
  b.maxHp = b.hp > 0 ? b.hp : 300 + d * 180;
  b.nb = b.bullets || 6 + d * 2;
  b.bs = b.bspeed || 150 + d * 25;
  b.bd = b.dmg || 6 + d * 2;
  b.attacks = (b.attacks && b.attacks.length) ? b.attacks : ['burst'];
  // phases: SIMPLE/NORMAL make them from difficulty; ADVANCED uses the list
  if (!(b.mode === 2 && b.phases && b.phases.length)) {
    b.phases = [{ at: 1, attacks: b.attacks, speed: 1, cd: 1 }];
    if (d >= 2) b.phases.push({ at: 0.5, attacks: b.attacks, speed: 1.25, cd: 0.8 });
    if (d >= 4) b.phases.push({ at: 0.25, attacks: b.attacks, speed: 1.5, cd: 0.6 });
  }
  b.phases = b.phases.slice().sort((p, q) => q.at - p.at);
  return b;
}
function bossSize(b) {
  const s = b.size || 1;
  const z = { mech: [40, 44], tank: [56, 30], drone: [44, 28], core: [40, 40], walker: [36, 48] }[b.body] || [40, 40];
  return { w: Math.round(z[0] * s), h: Math.round(z[1] * s) };
}
function allEnemyIds() { return [...new Set([...Object.keys(ENEMY_DEFAULTS), ...Object.keys(levelEnemies), ...Object.keys(customEnemies)])]; }
function allBossIds() { return [...new Set([...Object.keys(BOSS_DEFAULTS), ...Object.keys(levelBosses), ...Object.keys(customBosses)])]; }

const THEMES = {
  rust:    { sky: ['#1a1412', '#2e211b'], light: '#ffb070', dark: 0.5, name: 'Rusty' },
  steel:   { sky: ['#10141a', '#222a33'], light: '#bcd8ff', dark: 0.45, name: 'Steel' },
  toxic:   { sky: ['#0f1610', '#1c2a1a'], light: '#a8ff70', dark: 0.55, name: 'Toxic' },
  furnace: { sky: ['#1c0c08', '#4a1a0c'], light: '#ff8040', dark: 0.4, name: 'Furnace' },
  dark:    { sky: ['#07080a', '#121418'], light: '#ffe0b0', dark: 0.75, name: 'Blackout' },
};
