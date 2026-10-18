// FOUNDRY - level format, building a playable world, tile collision, keyframe paths.
'use strict';

// A level is plain data, so it can be saved, copied and shared as text:
// { v, name, w, h, time, ammo, rockets, theme, fg:[rows], bg:[rows], objs:[...], enemies:{}, bosses:{} }
function blankLevel(w = 60, h = 24) {
  const fg = [], bg = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += (y === h - 1 || y === 0 || x === 0 || x === w - 1) ? '#' : '.';
    fg.push(r); bg.push('w'.repeat(w));
  }
  return { v: 1, name: 'MY LEVEL', w, h, time: 0, ammo: 12, rockets: 0, theme: 'rust', fg, bg,
    objs: [{ id: uid(), t: 'spawn', x: 3 * TS, y: (h - 2) * TS - 10 + TS }, { id: uid(), t: 'exit', x: (w - 4) * TS, y: (h - 1) * TS - 16 }], enemies: {}, bosses: {} };
}

function cleanLevel(L) {
  L = deep(L || {});
  L.v = 1;
  L.w = clamp(Math.round(L.w || 60), 10, 400); L.h = clamp(Math.round(L.h || 24), 8, 200);
  L.name = String(L.name || 'LEVEL').slice(0, 30);
  L.time = clamp(+L.time || 0, 0, 3600); L.rockets = clamp(+L.rockets || 0, 0, 99);
  L.ammo = L.ammo == null ? 12 : clamp(+L.ammo || 0, 0, 999);
  if (!THEMES[L.theme]) L.theme = 'rust';
  const fix = (rows, ok, fill) => {
    const out = [];
    for (let y = 0; y < L.h; y++) {
      let r = (rows && rows[y]) || '';
      let s = '';
      for (let x = 0; x < L.w; x++) { const c = r[x]; s += (c && ok[c]) ? c : fill; }
      out.push(s);
    }
    return out;
  };
  L.fg = fix(L.fg, TILES, '.'); L.bg = fix(L.bg, BG_TILES, '.');
  L.objs = (L.objs || []).filter(o => o && OBJ[o.t]).map(o => {
    const r = Object.assign({}, OBJ[o.t].def || {}, o);
    r.id = r.id || uid(); r.x = +r.x || 0; r.y = +r.y || 0;
    if (r.path) {
      r.path.pts = (r.path.pts || []).map(p => ({ x: +p.x || 0, y: +p.y || 0, d: clamp(+p.d || 1, 0.05, 60), e: EASE[p.e] ? p.e : 'ease in-out' }));
      r.path.mode = ['ping', 'loop', 'once'].includes(r.path.mode) ? r.path.mode : 'ping';
      r.path.wait = clamp(+r.path.wait || 0, 0, 30);
      r.path.start = r.path.start === 'near' ? 'near' : 'always';
      r.path.near = clamp(+r.path.near || 96, 8, 2000);
      if (!r.path.pts.length) delete r.path;
    }
    return r;
  });
  L.enemies = L.enemies || {}; L.bosses = L.bosses || {};
  return L;
}

// change level size, keeping what's there (grow/shrink at right + bottom)
function resizeLevel(L, w, h) {
  w = clamp(w, 10, 400); h = clamp(h, 8, 200);
  const fg = [], bg = [];
  for (let y = 0; y < h; y++) {
    let a = '', b = '';
    for (let x = 0; x < w; x++) { a += (L.fg[y] && L.fg[y][x]) || '.'; b += (L.bg[y] && L.bg[y][x]) || '.'; }
    fg.push(a); bg.push(b);
  }
  L.fg = fg; L.bg = bg; L.w = w; L.h = h;
}

// ---- Keyframe paths -------------------------------------------------------------
// The object's own spot is keyframe 0. Each next keyframe has: x, y, d = seconds to get there, e = easing.
function pathSegs(o) {
  const P = o.path, pts = [{ x: o.bx ?? o.x, y: o.by ?? o.y }, ...P.pts];
  const segs = [];
  for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], d: P.pts[i - 1].d, e: P.pts[i - 1].e });
  if (P.mode === 'ping') for (let i = pts.length - 1; i > 0; i--) segs.push({ a: pts[i], b: pts[i - 1], d: P.pts[i - 1].d, e: P.pts[i - 1].e });
  if (P.mode === 'loop') segs.push({ a: pts[pts.length - 1], b: pts[0], d: P.pts[0].d, e: P.pts[0].e });
  return segs;
}
function pathPos(o, t) {
  const P = o.path; if (!P || !P.pts.length) return { x: o.bx ?? o.x, y: o.by ?? o.y };
  const segs = o._segs || (o._segs = pathSegs(o));
  const wait = P.wait || 0;
  let total = 0; for (const s of segs) total += s.d + wait;
  if (P.mode === 'once') { if (t >= total) { const l = segs[segs.length - 1].b; return { x: l.x, y: l.y }; } }
  else t = ((t % total) + total) % total;
  for (const s of segs) {
    if (t <= s.d) { const u = (EASE[s.e] || EASE.linear)(clamp(t / s.d, 0, 1)); return { x: lerp(s.a.x, s.b.x, u), y: lerp(s.a.y, s.b.y, u) }; }
    t -= s.d;
    if (t <= wait) return { x: s.b.x, y: s.b.y };
    t -= wait;
  }
  const l = segs[segs.length - 1].b; return { x: l.x, y: l.y };
}

// ---- The world (a level that is being played) -------------------------------------
function makeWorld(L, opt = {}) {
  levelEnemies = L.enemies || {}; levelBosses = L.bosses || {};
  const w = {
    L, W: L.w, H: L.h, pw: L.w * TS, ph: L.h * TS, theme: THEMES[L.theme] || THEMES.rust,
    fg: L.fg.map(r => r.split('')), bg: L.bg.map(r => r.split('')),
    time: 0, timeLeft: L.time || 0, gatesClosed: false,
    platforms: [], crushers: [], saws: [], turrets: [], coils: [], lasers: [], pickups: [], decos: [], signs: [], checkpoints: [],
    heaters: [], zaps: [], flamers: [], pmines: [], vents: [], debris: [], ropes: [], dust: [],
    enemies: [], bullets: [], rockets: [], booms: [], parts: [], arcs: [], texts: [], movers: [], bossObjs: [],
    exit: null, spawn: null, boss: null, arena: null, kills: 0, shake: 0, editor: !!opt.editor,
  };
  for (const src of L.objs) {
    const o = Object.assign({}, OBJ[src.t].def || {}, deep(src));
    o.bx = o.x; o.by = o.y; o.dx = 0; o.dy = 0;
    if (o.path && o.path.pts.length) { w.movers.push(o); o.pathT = 0; o.active = o.path.start !== 'near'; }
    switch (o.t) {
      case 'spawn': w.spawn = o; break;
      case 'exit': w.exit = o; break;
      case 'checkpoint': o.on = false; w.checkpoints.push(o); break;
      case 'sign': w.signs.push(o); break;
      case 'platform': w.platforms.push(o); break;
      case 'ammo': case 'rockets': case 'health': w.pickups.push(o); break;
      case 'crusher': o.ext = 0; o.tel = 0; w.crushers.push(o); break;
      case 'saw': o.rot = 0; w.saws.push(o); break;
      case 'turret': o.cd = rand(0, 1 / o.rate); o.hpNow = o.hp; o.aim = o.angle * Math.PI / 180; o.dead = false; o.flash = 0; w.turrets.push(o); break;
      case 'cturret': o.cd = 1; o.aim = Math.PI / 2; o.burst = 0; o.hp = 0; o.hpNow = 0; o.ceil = true; w.turrets.push(o); break;
      case 'coil': o.state = 0; o.hitDone = false; w.coils.push(o); break;
      case 'laser': o.ang = o.angle * Math.PI / 180; o.onNow = true; o.ex = o.x; o.ey = o.y; w.lasers.push(o); break;
      case 'deco': o.seed = Math.random() * 100; if (o.kind === 'steam' && !opt.editor) o._w = w; w.decos.push(o); break;
      case 'heater': o.heat = 0; w.heaters.push(o); break;
      case 'wallzap': o.state = 0; w.zaps.push(o); break;
      case 'flamer': o.state = 0; o.ang = o.angle * Math.PI / 180; w.flamers.push(o); break;
      case 'mine': o.armed = 0; o.beep = 0; w.pmines.push(o); break;
      case 'vent': o.onNow = false; w.vents.push(o); break;
      case 'arena': w.arena = o; break;
      case 'enemy': if (!opt.editor) w.enemies.push(makeEnemy(o)); else w.enemies.push(Object.assign(makeEnemy(o), { still: true })); break;
      case 'boss': w.bossObjs.push(o); break;
    }
  }
  if (w.bossObjs.length) w.boss = makeBoss(w.bossObjs[0], w);
  if (!w.spawn) w.spawn = { x: 3 * TS, y: 3 * TS };
  initAnim(w);
  return w;
}

// ---- Tiles ------------------------------------------------------------------
function tileAt(w, tx, ty) {
  if (tx < 0 || tx >= w.W || ty < 0) return '#';
  if (ty >= w.H) return '.';
  return w.fg[ty][tx];
}
// kind: 'p' body, 'b' bullet, 'r' rocket, 'l' laser
function blocks(w, ch, kind) {
  const T = TILES[ch]; if (!T) return false;
  if (T.gate) return w.gatesClosed;
  if (kind === 'p') return !!T.solid;
  if (kind === 'b') return !!T.bul;
  if (kind === 'r') return !!T.rok;
  return !!T.las;
}
function blockedAt(w, px, py, kind) {
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS), ch = tileAt(w, tx, ty), T = TILES[ch];
  if (T && T.slope) return py >= ty * TS + TS - T.slope(px - tx * TS);
  return blocks(w, ch, kind);
}
// y of the slope surface at x, if (x,y) is inside a slope tile; otherwise null
function slopeAt(w, px, py) {
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS), T = TILES[tileAt(w, tx, ty)];
  return T && T.slope ? ty * TS + TS - T.slope(clamp(px - tx * TS, 0, TS)) : null;
}
// where something standing at x, around height y, would rest
function groundY(w, px, py) { const s = slopeAt(w, px, py); return s != null ? s : Math.floor(py / TS) * TS; }
function tileUnder(w, px, py) { return tileAt(w, Math.floor(px / TS), Math.floor(py / TS)); }

// crusher heads count as solid walls
function crusherRect(c) {
  const len = c.len * TS * c.ext, tw = (c.tw || 2) * TS;
  switch (c.dir) {
    case 'up': return { x: c.x - tw / 2, y: c.y - 8 - len, w: tw, h: 16 };
    case 'left': return { x: c.x - 8 - len, y: c.y - tw / 2, w: 16, h: tw };
    case 'right': return { x: c.x - 8 + len, y: c.y - tw / 2, w: 16, h: tw };
    default: return { x: c.x - tw / 2, y: c.y - 8 + len, w: tw, h: 16 };
  }
}
function platRect(p) { const w = (p.tw || 3) * TS; return { x: p.x - w / 2, y: p.y - 4, w, h: 8 }; }

// Move a body (x,y = top-left, w,h) with collisions. Returns flags.
function moveBody(w, b, dx, dy, drop = false) {
  const res = { hitX: false, hitY: false, ground: false, ceil: false, plat: null };
  // --- X
  if (dx) {
    b.x += dx;
    const col = dx > 0 ? Math.floor((b.x + b.w - 0.01) / TS) : Math.floor(b.x / TS);
    const xHit = () => {
      const y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - 0.01) / TS);
      for (let ty = y0; ty <= y1; ty++) if (blocks(w, tileAt(w, col, ty), 'p')) return true;
      return false;
    };
    if (xHit()) {
      // step up small ledges (like where a slope meets a block), the way you step onto a curb
      let stepped = false;
      if (b.ground || b.onSlope) {
        const y0 = b.y;
        for (let s = 1; s <= 6 && !stepped; s++) { b.y = y0 - s; if (!xHit() && !blockedAt(w, b.x + b.w / 2, b.y, 'p')) stepped = true; }
        if (!stepped) b.y = y0;
      }
      if (!stepped) { b.x = dx > 0 ? col * TS - b.w : (col + 1) * TS; res.hitX = true; }
    }
    for (const c of w.crushers) { const r = crusherRect(c); if (rectsHit(b, r)) { b.x = dx > 0 ? r.x - b.w : r.x + r.w; res.hitX = true; } }
  }
  // --- Y
  if (dy) {
    const oldBottom = b.y + b.h;
    b.y += dy;
    const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - 0.01) / TS);
    const row = dy > 0 ? Math.floor((b.y + b.h - 0.01) / TS) : Math.floor(b.y / TS);
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(w, tx, row);
      const top = TILES[ch] && (TILES[ch].oneway || (TILES[ch].ladder && !TILES[tileAt(w, tx, row - 1)]?.ladder)   // ladder tops are standable
        || (b.noSink && TILES[ch].liquid && !TILES[tileAt(w, tx, row - 1)]?.liquid));                               // bosses walk on top of liquids
      if (blocks(w, ch, 'p') || (dy > 0 && !drop && top && oldBottom <= row * TS + 0.5)) {
        if (dy > 0) { b.y = row * TS - b.h; res.ground = true; } else { b.y = (row + 1) * TS; res.ceil = true; }
        res.hitY = true; break;
      }
    }
    for (const c of w.crushers) {
      const r = crusherRect(c);
      if (rectsHit(b, r)) { if (dy > 0) { b.y = r.y - b.h; res.ground = true; } else { b.y = r.y + r.h; res.ceil = true; } res.hitY = true; }
    }
    if (dy > 0 && !drop) for (const p of w.platforms) {
      const r = platRect(p);
      if (b.x + b.w > r.x && b.x < r.x + r.w && oldBottom <= r.y + 1 + Math.max(0, p.dy) && b.y + b.h >= r.y) {
        b.y = r.y - b.h; res.ground = true; res.hitY = true; res.plat = p;
      }
    }
  }
  // --- slopes: put the feet on the slanted surface
  const fx = b.x + b.w / 2, foot = b.y + b.h;
  let s = slopeAt(w, fx, foot - 0.01);
  if (s != null && foot > s && foot - s < 14 && dy >= -1) { b.y = s - b.h; res.ground = true; res.hitY = dy > 0; b.onSlope = true; }
  else if (s == null && (b.ground || b.onSlope) && dy >= 0 && !res.ground) {
    s = slopeAt(w, fx, foot + 7);                     // walking down a slope: stick to it
    if (s != null && s >= foot - 0.5 && s - foot < 7.5) { b.y = s - b.h; res.ground = true; b.onSlope = true; }
    else b.onSlope = false;
  } else if (s == null) b.onSlope = false;
  return res;
}
function rectInTile(w, R, test) {
  const x0 = Math.floor(R.x / TS), x1 = Math.floor((R.x + R.w - 0.01) / TS), y0 = Math.floor(R.y / TS), y1 = Math.floor((R.y + R.h - 0.01) / TS);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const T = TILES[tileAt(w, x, y)]; if (T && test(T, x, y)) return { x, y, T }; }
  return null;
}
// does a body stand on solid ground right now (for AI ledge checks)
function solidBelow(w, px, py) {
  const ch = tileUnder(w, px, py), T = TILES[ch];
  if (T && T.slope) return true;
  if (TILES[tileUnder(w, px, py + 6)]?.slope) return true;
  return blocks(w, ch, 'p') || (T && T.oneway);
}

// ray from (x,y) in angle a; stops at tiles that block `kind`. Returns end point.
function raycast(w, x, y, a, max, kind = 'l') {
  const cx = Math.cos(a), cy = Math.sin(a);
  let d = 0;
  while (d < max) {
    d += 2;
    const px = x + cx * d, py = y + cy * d;
    if (px < 0 || py < 0 || px > w.pw || py > w.ph || blockedAt(w, px, py, kind)) return { x: px, y: py, d, hit: true };
  }
  return { x: x + cx * max, y: y + cy * max, d: max, hit: false };
}
function lineClear(w, ax, ay, bx, by, kind = 'b') {
  const a = Math.atan2(by - ay, bx - ax), D = Math.hypot(bx - ax, by - ay);
  return !raycast(w, ax, ay, a, D, kind).hit;
}

// move every keyframed object
function updateMovers(w, dt) {
  const P = w.player;
  for (const o of w.movers) {
    if (!o.active && P && dist(P.x + P.w / 2, P.y + P.h / 2, o.bx, o.by) < o.path.near) o.active = true;
    if (o.active) o.pathT += dt;
    const p = pathPos(o, o.pathT);
    o.dx = p.x - o.x; o.dy = p.y - o.y; o.x = p.x; o.y = p.y;
  }
}
