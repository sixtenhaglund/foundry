// FOUNDRY - the level editor.
'use strict';

const ED = {
  L: null, id: null, zoom: 2, cam: { x: 0, y: 0 }, tool: 'select', cur: null, sel: new Set(), box: null, clip: null, pasting: false,
  undo: [], redo: [], dirty: true, world: null, preview: false, light: false, grid: true, floorSnap: true, kf: false, drag: null,
  mx: 0, my: 0, wx: 0, wy: 0, keys: {}, closed: {}, changed: false,
};
let EDBUF = null;

// ---- palette (everything you can place) ----------------------------------------
function paletteCats() {
  const T = (ch, bg) => ({ kind: 'tile', layer: bg ? 'bg' : 'fg', ch, name: (bg ? BG_TILES : TILES)[ch].name });
  const O = (t, name, p = {}, path = null) => ({ kind: 'obj', t, name, p, path });
  return [
    ['TILES', [...FG_KEYS.filter(k => !'^v<>D~L'.includes(k)).map(k => T(k)), Object.assign(T('.'), { name: 'Eraser (tiles)' })]],
    ['BACKGROUND', [...BG_KEYS.map(k => T(k, true)), Object.assign(T('.', true), { name: 'Eraser (background)' })]],
    ['HAZARDS', [T('^'), T('v'), T('<'), T('>'),
      O('crusher', 'Crusher (slams down)', { dir: 'down' }), O('crusher', 'Crusher (slams up)', { dir: 'up' }), O('crusher', 'Crusher (slams left)', { dir: 'left' }), O('crusher', 'Crusher (slams right)', { dir: 'right' }),
      O('saw', 'Saw blade'), O('saw', 'Moving saw', {}, [64, 0]), O('turret', 'Turret: shoots when crossed', { mode: 'when crossed' }), O('turret', 'Turret: shoots randomly', { mode: 'randomly', angle: -90 }),
      O('turret', 'Turret: aims at you', { mode: 'aims at you' }), O('cturret', 'Ceiling turret (can not die)'), O('coil', 'Electric coil'), O('laser', 'Straight laser'),
      O('laser', 'Turning laser', { turn: 60, angle: 90 }), O('laser', 'Blinking laser', { on: 1, off: 1, angle: 90 }), O('laser', 'Moving laser', { angle: 90, color: 'blue' }, [96, 0])]],
    ['ENEMIES', allEnemyIds().map(id => O('enemy', getEnemy(id).name, { def: id }))],
    ['BOSSES', [O('arena', 'Boss arena (closes the red gates)'), T('D'), ...allBossIds().map(id => O('boss', getBoss(id).name, { def: id }))]],
    ['PICKUPS', [O('ammo', 'Bullet ammo'), O('rockets', 'Rocket ammo'), O('health', 'Health pack')]],
    ['MECHANICS', [O('spawn', 'Player start'), O('exit', 'Exit door'), O('checkpoint', 'Checkpoint'), O('sign', 'Message sign'),
      O('platform', 'Moving platform', {}, [96, 0]), T('='), T('L'), T('~'), T('G')]],
    ['DECOR', DECO_KINDS.map(k => O('deco', k, { kind: k }))],
  ];
}

function openEditor(L, id) {
  hideAll(); ambStop(); G.mode = 'editor';
  ED.L = cleanLevel(L); ED.id = id; ED.sel.clear(); ED.box = null; ED.pasting = false; ED.kf = false; ED.undo = []; ED.redo = []; ED.dirty = true; ED.changed = false;
  if (!ED.cur) ED.cur = null;
  const sp = ED.L.objs.find(o => o.t === 'spawn');
  ED.cam.x = (sp ? sp.x : 100) - 300 / ED.zoom; ED.cam.y = (sp ? sp.y : 100) - 300 / ED.zoom;
  $('ed').classList.remove('hidden');
  buildTop(); buildPalette(); renderProps();
}
function backToEditor() {
  hideAll(); ambStop(); G.mode = 'editor'; $('ed').classList.remove('hidden');
  ED.dirty = true; buildPalette(); renderProps();
}
function edSave(quiet) {
  if (!ED.id) ED.id = 'L' + uid();
  ED.L.id = ED.id; saveMyLevel(ED.L); ED.changed = false;
  if (!quiet) toast('SAVED');
}
function edLeave() { edSave(true); showMenu(); }

function buildTop() {
  const t = $('edTop'); t.innerHTML = '';
  const B = (label, fn, title, cls) => { const b = el('button', { onclick: fn, title: title || '' }, label); if (cls) b.className = cls; t.append(b); return b; };
  B('◀ MENU', edLeave, 'Saves and goes back to the menu');
  t.append(el('span', { class: 'name' }, ED.L.name));
  B('▶ TEST', () => edTest(false), 'Play the level (T)', 'on');
  B('▶ FROM MOUSE', () => edTest(true), 'Play starting where the mouse is (Shift+T)');
  t.append(el('span', { class: 'sep' }));
  B('↶ UNDO', edUndo, 'Ctrl+Z'); B('↷ REDO', edRedo, 'Ctrl+Y');
  B('CUT', edCut, 'Ctrl+X'); B('COPY', edCopy, 'Ctrl+C'); B('PASTE', edPasteStart, 'Ctrl+V'); B('DELETE', edDelete, 'Delete');
  t.append(el('span', { class: 'sep' }));
  ED.bGrid = B('GRID', () => { ED.grid = !ED.grid; ED.bGrid.classList.toggle('on', ED.grid); }, 'G'); ED.bGrid.classList.toggle('on', ED.grid);
  ED.bSnap = B('SNAP TO FLOOR', () => { ED.floorSnap = !ED.floorSnap; ED.bSnap.classList.toggle('on', ED.floorSnap); }, 'Things you place land on the floor under the mouse (F)'); ED.bSnap.classList.toggle('on', ED.floorSnap);
  ED.bPrev = B('▶ PREVIEW MOVES', () => { ED.preview = !ED.preview; ED.dirty = true; ED.bPrev.classList.toggle('on', ED.preview); }, 'Watch saws, crushers, lasers and keyframes move (P)'); ED.bPrev.classList.toggle('on', ED.preview);
  ED.bLight = B('DARKNESS', () => { ED.light = !ED.light; ED.bLight.classList.toggle('on', ED.light); }, 'Show the level as dark as in the game'); ED.bLight.classList.toggle('on', ED.light);
  B('− ', () => edZoom(-1, innerWidth / 2, innerHeight / 2), 'Zoom out'); B('+', () => edZoom(1, innerWidth / 2, innerHeight / 2), 'Zoom in');
  t.append(el('span', { class: 'sep' }));
  B('SETTINGS', edSettings); B('SAVE', () => edSave()); B('SHARE', () => { edSave(true); showModal(el('h2', {}, 'LEVEL CODE'), el('textarea', { value: levelCode(deep(ED.L)), readOnly: true, onclick: e => e.target.select() }), el('button', { onclick: closeModal }, 'CLOSE')); });
  B('ENEMY MAKER', () => { edSave(true); openMaker('enemy', null, 'editor'); }); B('BOSS MAKER', () => { edSave(true); openMaker('boss', null, 'editor'); });
}

function buildPalette() {
  const p = $('edPal'); p.innerHTML = '';
  const sel = el('button', { class: 'wide' + (ED.tool === 'select' ? ' on' : ''), style: { width: '100%' }, onclick: () => { ED.tool = 'select'; ED.cur = null; buildPalette(); } }, '⬚ SELECT / MOVE  (V)');
  p.append(sel);
  for (const [cat, items] of paletteCats()) {
    const head = el('div', { class: 'cat' + (ED.closed[cat] ? ' closed' : ''), onclick: () => { ED.closed[cat] = !ED.closed[cat]; buildPalette(); } }, (ED.closed[cat] ? '▸ ' : '▾ ') + cat);
    const box = el('div', { class: 'items' });
    for (const it of items) {
      const on = ED.cur && ED.cur.name === it.name && ED.cur.kind === it.kind && (it.kind !== 'tile' || (ED.cur.ch === it.ch && ED.cur.layer === it.layer));
      const ic = it.kind === 'tile' ? iconCanvas({ t: 'tile', ch: it.ch, bg: it.layer === 'bg' }) : iconCanvas(Object.assign({ t: it.t }, OBJ[it.t].def, it.p));
      box.append(el('div', { class: 'it' + (on ? ' on' : ''), title: it.name.toUpperCase(), onclick: () => { ED.cur = it; ED.tool = it.kind === 'tile' ? 'tile' : 'obj'; ED.pasting = false; ED.kf = false; buildPalette(); } }, ic));
    }
    if (cat === 'ENEMIES') box.append(el('button', { class: 'wide', onclick: () => { edSave(true); openMaker('enemy', null, 'editor'); } }, '+ MAKE / EDIT ENEMIES'));
    if (cat === 'BOSSES') box.append(el('button', { class: 'wide', onclick: () => { edSave(true); openMaker('boss', null, 'editor'); } }, '+ MAKE / EDIT BOSSES'));
    p.append(head, box);
  }
}

// ---- undo / redo: we keep copies of the whole level as text ----
function pushUndo() { ED.undo.push(JSON.stringify(ED.L)); if (ED.undo.length > 200) ED.undo.shift(); ED.redo = []; ED.changed = true; }
function edUndo() { if (!ED.undo.length) return toast('NOTHING TO UNDO'); ED.redo.push(JSON.stringify(ED.L)); ED.L = JSON.parse(ED.undo.pop()); afterHistory(); }
function edRedo() { if (!ED.redo.length) return toast('NOTHING TO REDO'); ED.undo.push(JSON.stringify(ED.L)); ED.L = JSON.parse(ED.redo.pop()); afterHistory(); }
function afterHistory() { const ids = new Set(ED.L.objs.map(o => o.id)); for (const i of [...ED.sel]) if (!ids.has(i)) ED.sel.delete(i); ED.dirty = true; renderProps(); buildTop(); }

// ---- helpers ----
const edObj = id => ED.L.objs.find(o => o.id === id);
const snapV = (v, s) => Math.round(v / s) * s;
function edSnap() { return ED.keys.Alt ? 1 : 8; }
function setTile(layer, tx, ty, ch) {
  if (tx < 0 || ty < 0 || tx >= ED.L.w || ty >= ED.L.h) return;
  const r = ED.L[layer][ty]; if (r[tx] === ch) return;
  ED.L[layer][ty] = r.slice(0, tx) + ch + r.slice(tx + 1); ED.dirty = true;
}
function objRect(o) { const s = objSize(o); return { x: o.x - s.w / 2, y: o.y - s.h / 2, w: s.w, h: s.h }; }
function objAt(wx, wy) {
  for (let i = ED.L.objs.length - 1; i >= 0; i--) {
    const o = ED.L.objs[i], r = objRect(o);
    if (o.t === 'arena') { const nearEdge = wx > r.x - 6 && wx < r.x + r.w + 6 && wy > r.y - 6 && wy < r.y + r.h + 6 && (wx < r.x + 6 || wx > r.x + r.w - 6 || wy < r.y + 6 || wy > r.y + r.h - 6); if (nearEdge) return o; continue; }
    const pad = Math.max(0, 6 - Math.min(r.w, r.h) / 2);
    if (wx >= r.x - pad && wx <= r.x + r.w + pad && wy >= r.y - pad && wy <= r.y + r.h + pad) return o;
  }
  return null;
}
const STANDS = { spawn: 1, exit: 1, checkpoint: 1, ammo: 1, rockets: 1, health: 1, enemy: 1, boss: 1, coil: 1, sign: 1 };
const STAND_DECO = { 'barrel': 1, 'toxic barrel': 1, 'crate': 1, 'tank': 1, 'warning sign': 1, 'skull sign': 1, 'monitor': 1 };
function dropToFloor(o) {
  const s = objSize(o), tx = Math.floor(o.x / TS);
  for (let ty = Math.max(0, Math.floor((o.y - s.h / 2 + 2) / TS)); ty < Math.min(ED.L.h, Math.floor(o.y / TS) + 14); ty++) {
    const T = TILES[ED.L.fg[ty] && ED.L.fg[ty][tx]];
    if (T && (T.solid || T.oneway) && ty * TS >= o.y - s.h / 2) { o.y = ty * TS - s.h / 2; return; }
  }
}
function newObjFromCur(wx, wy) {
  const it = ED.cur, s = edSnap();
  const o = Object.assign({ id: uid(), t: it.t, x: snapV(wx, s), y: snapV(wy, s) }, deep(OBJ[it.t].def || {}), deep(it.p || {}));
  if (o.t === 'crusher' && o.dir === 'up') o.len = 4;
  if (ED.floorSnap && !ED.keys.Alt && (STANDS[o.t] || (o.t === 'deco' && STAND_DECO[o.kind]))) dropToFloor(o);
  if (it.path) o.path = { pts: [{ x: o.x + it.path[0], y: o.y + it.path[1], d: 2, e: 'ease in-out' }], mode: 'ping', wait: 0.3, start: 'always', near: 96 };
  return o;
}

// ---- mouse ----
function edMouse(e, type) {
  ED.mx = e.clientX; ED.my = e.clientY;
  ED.wx = ED.cam.x + ED.mx / ED.zoom; ED.wy = ED.cam.y + ED.my / ED.zoom;
  const tx = Math.floor(ED.wx / TS), ty = Math.floor(ED.wy / TS), s = edSnap();
  if (type === 'down') {
    const btn = e.button;
    if (btn === 1 || ED.keys[' '] || (btn === 2 && ED.tool === 'select' && !ED.pasting && !ED.kf)) { ED.drag = { type: 'pan', sx: ED.mx, sy: ED.my, cx: ED.cam.x, cy: ED.cam.y }; return; }
    if (ED.pasting) { if (btn === 0) edPasteAt(tx, ty); else ED.pasting = false; return; }
    if (ED.kf) {
      const o = edObj([...ED.sel][0]);
      if (btn === 2 || !o) { ED.kf = false; renderProps(); return; }
      pushUndo(); o.path = o.path || { pts: [], mode: 'ping', wait: 0.3, start: 'always', near: 96 };
      o.path.pts.push({ x: snapV(ED.wx, s), y: snapV(ED.wy, s), d: 1.5, e: 'ease in-out' }); ED.dirty = true; renderProps(); return;
    }
    if (ED.tool === 'tile') {
      pushUndo();
      const ch = btn === 2 ? '.' : ED.cur.ch, layer = ED.cur.layer;
      if (ED.keys.Shift) ED.drag = { type: 'rect', ch, layer, x0: tx, y0: ty, x1: tx, y1: ty };
      else { ED.drag = { type: 'paint', ch, layer, lx: tx, ly: ty }; setTile(layer, tx, ty, ch); }
      return;
    }
    if (ED.tool === 'obj') {
      if (btn === 2) { const o = objAt(ED.wx, ED.wy); if (o) { pushUndo(); ED.L.objs = ED.L.objs.filter(q => q !== o); ED.sel.delete(o.id); ED.dirty = true; renderProps(); } return; }
      pushUndo();
      const o = newObjFromCur(ED.wx, ED.wy);
      if (o.t === 'spawn' || o.t === 'exit') ED.L.objs = ED.L.objs.filter(q => q.t !== o.t);
      ED.L.objs.push(o); ED.sel.clear(); ED.sel.add(o.id); ED.dirty = true; renderProps();
      return;
    }
    // select tool
    for (const id of ED.sel) {                 // grab a keyframe dot?
      const o = edObj(id); if (!o || !o.path) continue;
      const i = o.path.pts.findIndex(p => Math.abs(p.x - ED.wx) < 5 && Math.abs(p.y - ED.wy) < 5);
      if (i >= 0) { ED.drag = { type: 'kf', o, i, snap: JSON.stringify(ED.L), moved: false }; return; }
    }
    const o = objAt(ED.wx, ED.wy);
    if (o) {
      if (ED.keys.Shift) { ED.sel.has(o.id) ? ED.sel.delete(o.id) : ED.sel.add(o.id); }
      else if (!ED.sel.has(o.id)) { ED.sel.clear(); ED.sel.add(o.id); }
      ED.box = null;
      ED.drag = { type: 'move', sx: ED.wx, sy: ED.wy, orig: [...ED.sel].map(id => { const q = edObj(id); return [q, q.x, q.y, q.path ? q.path.pts.map(p => [p.x, p.y]) : null]; }), snap: JSON.stringify(ED.L), moved: false };
      renderProps();
    } else {
      if (!ED.keys.Shift) ED.sel.clear();
      ED.drag = { type: 'box', x0: tx, y0: ty }; ED.box = { x: tx, y: ty, w: 1, h: 1 }; renderProps();
    }
    return;
  }
  const D = ED.drag;
  if (type === 'move' && D) {
    if (D.type === 'pan') { ED.cam.x = D.cx - (ED.mx - D.sx) / ED.zoom; ED.cam.y = D.cy - (ED.my - D.sy) / ED.zoom; }
    if (D.type === 'paint') { // fill the gap between mouse samples
      const n = Math.max(Math.abs(tx - D.lx), Math.abs(ty - D.ly));
      for (let i = 0; i <= n; i++) setTile(D.layer, Math.round(lerp(D.lx, tx, n ? i / n : 0)), Math.round(lerp(D.ly, ty, n ? i / n : 0)), D.ch);
      D.lx = tx; D.ly = ty;
    }
    if (D.type === 'rect') { D.x1 = tx; D.y1 = ty; }
    if (D.type === 'box') { ED.box = { x: Math.min(D.x0, tx), y: Math.min(D.y0, ty), w: Math.abs(tx - D.x0) + 1, h: Math.abs(ty - D.y0) + 1 }; }
    if (D.type === 'move') {
      const dx = snapV(ED.wx - D.sx, s), dy = snapV(ED.wy - D.sy, s);
      if ((dx || dy) && !D.moved) { D.moved = true; ED.undo.push(D.snap); ED.redo = []; ED.changed = true; }
      for (const [q, x, y, pts] of D.orig) { q.x = x + dx; q.y = y + dy; if (pts) q.path.pts.forEach((p, i) => { p.x = pts[i][0] + dx; p.y = pts[i][1] + dy; }); }
      if (D.moved) { ED.dirty = true; edPropsPos(); }
    }
    if (D.type === 'kf') {
      if (!D.moved) { D.moved = true; ED.undo.push(D.snap); ED.redo = []; }
      D.o.path.pts[D.i].x = snapV(ED.wx, s); D.o.path.pts[D.i].y = snapV(ED.wy, s); ED.dirty = true;
    }
  }
  if (type === 'up' && D) {
    if (D.type === 'rect') {
      const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setTile(D.layer, x, y, D.ch);
    }
    if (D.type === 'box') {
      const b = ED.box, R = { x: b.x * TS, y: b.y * TS, w: b.w * TS, h: b.h * TS };
      for (const o of ED.L.objs) if (o.x >= R.x && o.x <= R.x + R.w && o.y >= R.y && o.y <= R.y + R.h) ED.sel.add(o.id);
      if (b.w === 1 && b.h === 1) ED.box = null;
      renderProps();
    }
    if (D.type === 'kf' || D.type === 'move') renderProps();
    ED.drag = null;
  }
}
function edZoom(dir, sx, sy) {
  const wx = ED.cam.x + sx / ED.zoom, wy = ED.cam.y + sy / ED.zoom;
  ED.zoom = clamp(ED.zoom + dir, 1, 6);
  ED.cam.x = wx - sx / ED.zoom; ED.cam.y = wy - sy / ED.zoom;
}

// ---- copy / paste ----
function edCopy() {
  const b = ED.box;
  if (b && (b.w > 1 || b.h > 1)) {
    const clip = { w: b.w, h: b.h, fg: [], bg: [], objs: [] };
    for (let y = b.y; y < b.y + b.h; y++) { clip.fg.push((ED.L.fg[y] || '').slice(b.x, b.x + b.w).padEnd(b.w, '.')); clip.bg.push((ED.L.bg[y] || '').slice(b.x, b.x + b.w).padEnd(b.w, '.')); }
    const R = { x: b.x * TS, y: b.y * TS, w: b.w * TS, h: b.h * TS };
    const objs = ED.L.objs.filter(o => ED.sel.has(o.id) || (o.x >= R.x && o.x <= R.x + R.w && o.y >= R.y && o.y <= R.y + R.h));
    clip.objs = objs.map(o => relObj(o, R.x, R.y));
    ED.clip = clip; toast('COPIED ' + b.w + 'x' + b.h + ' TILES + ' + objs.length + ' THINGS'); return true;
  }
  if (ED.sel.size) {
    const objs = [...ED.sel].map(edObj).filter(Boolean);
    const ox = Math.floor(Math.min(...objs.map(o => objRect(o).x)) / TS) * TS, oy = Math.floor(Math.min(...objs.map(o => objRect(o).y)) / TS) * TS;
    ED.clip = { w: 0, h: 0, fg: [], bg: [], objs: objs.map(o => relObj(o, ox, oy)) };
    toast('COPIED ' + objs.length + ' THING' + (objs.length > 1 ? 'S' : '')); return true;
  }
  toast('SELECT SOMETHING FIRST (DRAG A BOX)'); return false;
}
function relObj(o, ox, oy) { const c = deep(o); c.x -= ox; c.y -= oy; if (c.path) c.path.pts.forEach(p => { p.x -= ox; p.y -= oy; }); return c; }
function edPasteStart() { if (!ED.clip) return toast('COPY SOMETHING FIRST'); ED.pasting = true; ED.kf = false; toast('CLICK TO PASTE · RIGHT-CLICK TO CANCEL'); }
function edPasteAt(tx, ty) {
  const c = ED.clip; pushUndo();
  for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) { setTile('fg', tx + i, ty + j, c.fg[j][i]); setTile('bg', tx + i, ty + j, c.bg[j][i]); }
  ED.sel.clear();
  for (const r of c.objs) {
    if ((r.t === 'spawn' || r.t === 'exit') && ED.L.objs.some(o => o.t === r.t)) continue;
    const o = deep(r); o.id = uid(); o.x += tx * TS; o.y += ty * TS; if (o.path) o.path.pts.forEach(p => { p.x += tx * TS; p.y += ty * TS; });
    ED.L.objs.push(o); ED.sel.add(o.id);
  }
  ED.box = c.w ? { x: tx, y: ty, w: c.w, h: c.h } : null;
  ED.dirty = true; renderProps();
  if (!ED.keys.Shift) ED.pasting = false;   // hold shift to paste many times
}
function edDelete() {
  const n = ED.sel.size, b = ED.box;
  if (!n && !b) return;
  pushUndo();
  ED.L.objs = ED.L.objs.filter(o => !ED.sel.has(o.id)); ED.sel.clear();
  if (b && (b.w > 1 || b.h > 1) && !n) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { setTile('fg', x, y, '.'); if (ED.keys.Shift) setTile('bg', x, y, '.'); }
  ED.dirty = true; renderProps();
}
function edCut() {
  if (!edCopy()) return;
  const b = ED.box; pushUndo();
  if (b && (b.w > 1 || b.h > 1)) {
    const R = { x: b.x * TS, y: b.y * TS, w: b.w * TS, h: b.h * TS };
    ED.L.objs = ED.L.objs.filter(o => !(ED.sel.has(o.id) || (o.x >= R.x && o.x <= R.x + R.w && o.y >= R.y && o.y <= R.y + R.h)));
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { setTile('fg', x, y, '.'); setTile('bg', x, y, '.'); }
  } else ED.L.objs = ED.L.objs.filter(o => !ED.sel.has(o.id));
  ED.sel.clear(); ED.dirty = true; renderProps();
}

// ---- keyboard ----
function edKey(e, down) {
  ED.keys[e.key === ' ' ? ' ' : e.key.length === 1 ? e.key.toLowerCase() : e.key] = down;
  ED.keys.Shift = e.shiftKey; ED.keys.Alt = e.altKey;
  if (!down) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? edRedo() : edUndo(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); edRedo(); return; }
  if (ctrl && k === 'c') { e.preventDefault(); edCopy(); return; }
  if (ctrl && k === 'x') { e.preventDefault(); edCut(); return; }
  if (ctrl && k === 'v') { e.preventDefault(); edPasteStart(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); if (edCopy()) edPasteStart(); return; }
  if (ctrl && k === 's') { e.preventDefault(); edSave(); return; }
  if (ctrl && k === 'a') { e.preventDefault(); ED.L.objs.forEach(o => ED.sel.add(o.id)); renderProps(); return; }
  if (ctrl) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); edDelete(); }
  else if (k === 'escape') { if (ED.pasting) ED.pasting = false; else if (ED.kf) { ED.kf = false; renderProps(); } else { ED.sel.clear(); ED.box = null; ED.tool = 'select'; ED.cur = null; buildPalette(); renderProps(); } }
  else if (k === 't') edTest(e.shiftKey);
  else if (k === 'g') { ED.grid = !ED.grid; buildTop(); }
  else if (k === 'f') { ED.floorSnap = !ED.floorSnap; buildTop(); }
  else if (k === 'p') { ED.preview = !ED.preview; ED.dirty = true; buildTop(); }
  else if (k === 'v') { ED.tool = 'select'; ED.cur = null; buildPalette(); }
  else if (k === 'k' && ED.sel.size === 1) { ED.kf = !ED.kf; renderProps(); }
  else if (k === '+' || k === '=') edZoom(1, innerWidth / 2, innerHeight / 2);
  else if (k === '-') edZoom(-1, innerWidth / 2, innerHeight / 2);
}
function edUpdate(dt) {
  const sp = 500 / ED.zoom * dt, K = ED.keys;
  if (K.a || K.ArrowLeft) ED.cam.x -= sp; if (K.d || K.ArrowRight) ED.cam.x += sp;
  if (K.w || K.ArrowUp) ED.cam.y -= sp; if (K.s || K.ArrowDown) ED.cam.y += sp;
  ED.cam.x = clamp(ED.cam.x, -400, ED.L.w * TS + 200); ED.cam.y = clamp(ED.cam.y, -300, ED.L.h * TS + 200);
  if (ED.dirty) {
    ED.world = makeWorld(ED.L, { editor: true }); ED.dirty = false;
    for (const o of ED.world.movers) o.active = true;
    updateHazards(ED.world, 0);
  }
  if (ED.preview) { const w = ED.world; w.time += dt; updateMovers(w, dt); updateHazards(w, dt); updateBullets(w, dt); updateParts(w, dt); }
}

function edTest(fromMouse) {
  edSave(true);
  if (!ED.L.objs.some(o => o.t === 'spawn')) return toast('PLACE A PLAYER START FIRST (MECHANICS)');
  hideAll();
  startPlay(ED.L, { kind: 'test', from: fromMouse ? { x: ED.wx, y: ED.wy } : null });
}

// ---- drawing the editor ----
function drawEditor(ctx, W, H) {
  const bw = Math.ceil(W / ED.zoom), bh = Math.ceil(H / ED.zoom);
  if (!EDBUF || EDBUF.width !== bw || EDBUF.height !== bh) EDBUF = mkCanvas(bw, bh);
  const g = EDBUF.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, bw, bh);
  const w = ED.world;
  drawWorld(g, w, ED.cam, bw, bh, { noLight: !ED.light, lightMul: 1, over: c => edOverlay(c, w, bw, bh) });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(EDBUF, 0, 0, bw * ED.zoom, bh * ED.zoom);
  // status bar
  const tx = Math.floor(ED.wx / TS), ty = Math.floor(ED.wy / TS);
  let hint = ED.pasting ? 'CLICK TO PASTE (HOLD SHIFT TO PASTE MORE) · RIGHT-CLICK: CANCEL'
    : ED.kf ? 'CLICK TO ADD KEYFRAMES WHERE IT SHOULD MOVE · RIGHT-CLICK / ESC: DONE'
    : ED.tool === 'tile' ? 'LEFT: PAINT · RIGHT: ERASE · SHIFT+DRAG: RECTANGLE'
    : ED.tool === 'obj' ? 'CLICK: PLACE ' + ED.cur.name.toUpperCase() + ' · RIGHT-CLICK: DELETE · ALT: NO SNAPPING'
    : 'CLICK: SELECT · DRAG: MOVE · DRAG EMPTY: BOX SELECT · SHIFT: ADD · DRAG DOTS: MOVE KEYFRAMES';
  $('edStat').innerHTML = '<b>' + tx + ', ' + ty + '</b> &nbsp; ' + hint + ' &nbsp;·&nbsp; WASD / MIDDLE-DRAG: MOVE VIEW · WHEEL: ZOOM · T: TEST';
}
function edOverlay(c, w, bw, bh) {
  const L = ED.L, cam = ED.cam, t = performance.now() / 1000;
  if (ED.grid) {
    c.fillStyle = 'rgba(255,255,255,0.07)';
    const x0 = Math.max(0, Math.floor(cam.x / TS)), x1 = Math.min(L.w, Math.ceil((cam.x + bw) / TS)), y0 = Math.max(0, Math.floor(cam.y / TS)), y1 = Math.min(L.h, Math.ceil((cam.y + bh) / TS));
    for (let x = x0; x <= x1; x++) c.fillRect(x * TS, y0 * TS, 1, (y1 - y0) * TS);
    for (let y = y0; y <= y1; y++) c.fillRect(x0 * TS, y * TS, (x1 - x0) * TS, 1);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = x0; x <= x1; x++) if (x % 8 === 0) c.fillRect(x * TS, y0 * TS, 1, (y1 - y0) * TS);
    for (let y = y0; y <= y1; y++) if (y % 8 === 0) c.fillRect(x0 * TS, y * TS, (x1 - x0) * TS, 1);
  }
  c.fillStyle = '#d8b02a'; c.fillRect(-1, -1, L.w * TS + 2, 1); c.fillRect(-1, L.h * TS, L.w * TS + 2, 1); c.fillRect(-1, -1, 1, L.h * TS + 2); c.fillRect(L.w * TS, -1, 1, L.h * TS + 2);
  const dashRect = (r, col) => { c.fillStyle = col; for (let i = 0; i < r.w; i += 4) { c.fillRect(Math.round(r.x + i), Math.round(r.y), 2, 1); c.fillRect(Math.round(r.x + i), Math.round(r.y + r.h), 2, 1); } for (let i = 0; i < r.h; i += 4) { c.fillRect(Math.round(r.x), Math.round(r.y + i), 1, 2); c.fillRect(Math.round(r.x + r.w), Math.round(r.y + i), 1, 2); } };
  for (const o of L.objs) {
    const sel = ED.sel.has(o.id), r = objRect(o);
    if (o.t === 'spawn') { drawObjIcon(c, o, o.x, o.y); ptext(c, 'START', o.x, r.y - 8, '#60ff90', 1, 'c'); }
    if (o.t === 'arena') { dashRect(r, sel ? '#ffd860' : '#ff9040'); ptext(c, 'BOSS ARENA', r.x + 4, r.y + 4, '#ff9040'); }
    if (o.t === 'boss' && w.boss && w.boss.o.id !== o.id) { dashRect(r, '#ff4040'); ptext(c, 'ONLY 1 BOSS', o.x, r.y - 8, '#ff6060', 1, 'c'); }
    if (o.t === 'crusher') { const R = crusherRect(Object.assign({}, o, { ext: 1 })); dashRect(R, 'rgba(255,80,80,0.5)'); }
    if (o.t === 'coil' && sel) { c.fillStyle = 'rgba(120,180,255,0.6)'; pring(c, o.x, o.y - 8, Math.round(o.range)); }
    if (o.t === 'enemy' && sel) { c.fillStyle = 'rgba(255,255,255,0.25)'; const e = getEnemy(o.def); pring(c, o.x, o.y, Math.round(Math.min(e.sight, 300))); }
    if (o.path && o.path.pts.length) {
      const pts = [{ x: o.x, y: o.y }, ...o.path.pts];
      c.fillStyle = sel ? '#60e0ff' : 'rgba(96,224,255,0.35)';
      for (let i = 1; i < pts.length; i++) { const D = dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y); for (let k = 0; k < D; k += 3) c.fillRect(Math.round(lerp(pts[i - 1].x, pts[i].x, k / D)), Math.round(lerp(pts[i - 1].y, pts[i].y, k / D)), 1, 1); }
      if (o.path.mode === 'loop' && pts.length > 2) { const a = pts[pts.length - 1], b = pts[0], D = dist(a.x, a.y, b.x, b.y); for (let k = 0; k < D; k += 6) c.fillRect(Math.round(lerp(a.x, b.x, k / D)), Math.round(lerp(a.y, b.y, k / D)), 1, 1); }
      o.path.pts.forEach((p, i) => {
        if (sel) { const s = objSize(o); c.fillStyle = 'rgba(96,224,255,0.15)'; c.fillRect(Math.round(p.x - s.w / 2), Math.round(p.y - s.h / 2), s.w, s.h); }
        c.fillStyle = '#000'; c.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 7, 7); c.fillStyle = sel ? '#60e0ff' : '#3a8aa0'; c.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5);
        if (sel) ptext(c, String(i + 1), p.x + 5, p.y - 8, '#60e0ff');
      });
    }
    if (sel) { c.fillStyle = (t * 3) % 1 < 0.6 ? '#ffd860' : '#a08020'; const R = { x: r.x - 2, y: r.y - 2, w: r.w + 3, h: r.h + 3 }; c.fillRect(R.x, R.y, R.w, 1); c.fillRect(R.x, R.y + R.h, R.w + 1, 1); c.fillRect(R.x, R.y, 1, R.h); c.fillRect(R.x + R.w, R.y, 1, R.h); }
  }
  // hover
  if (!ED.drag && ED.tool === 'select' && !ED.pasting && !ED.kf) { const o = objAt(ED.wx, ED.wy); if (o && !ED.sel.has(o.id)) dashRect(objRect(o), 'rgba(255,255,255,0.6)'); }
  if (ED.box) { const b = ED.box; c.fillStyle = 'rgba(255,216,96,0.12)'; c.fillRect(b.x * TS, b.y * TS, b.w * TS, b.h * TS); dashRect({ x: b.x * TS, y: b.y * TS, w: b.w * TS, h: b.h * TS }, '#ffd860'); }
  const tx = Math.floor(ED.wx / TS), ty = Math.floor(ED.wy / TS);
  if (ED.pasting && ED.clip) {
    const cl = ED.clip;
    c.globalAlpha = 0.6;
    for (let j = 0; j < cl.h; j++) for (let i = 0; i < cl.w; i++) { const ch = cl.fg[j][i]; if (ch !== '.' && ch !== '~' && ch !== 'D') c.drawImage(tileTex(ch, 0), (tx + i) * TS, (ty + j) * TS); else if (ch === '~') { c.fillStyle = 'rgba(40,110,170,0.6)'; c.fillRect((tx + i) * TS, (ty + j) * TS, TS, TS); } }
    for (const o of cl.objs) { const q = Object.assign({}, o, { x: o.x + tx * TS, y: o.y + ty * TS }); drawObjIcon(c, q, q.x, q.y); }
    c.globalAlpha = 1;
    dashRect({ x: tx * TS, y: ty * TS, w: Math.max(cl.w, 1) * TS, h: Math.max(cl.h, 1) * TS }, '#60ff90');
  } else if (ED.tool === 'tile') {
    const D = ED.drag;
    if (D && D.type === 'rect') { const x0 = Math.min(D.x0, D.x1), y0 = Math.min(D.y0, D.y1); dashRect({ x: x0 * TS, y: y0 * TS, w: (Math.abs(D.x1 - D.x0) + 1) * TS, h: (Math.abs(D.y1 - D.y0) + 1) * TS }, '#ffd860'); }
    else dashRect({ x: tx * TS, y: ty * TS, w: TS, h: TS }, '#ffd860');
  } else if (ED.tool === 'obj' && ED.cur && !ED.kf) {
    const o = newObjFromCur(ED.wx, ED.wy);
    c.globalAlpha = 0.65;
    if (o.t === 'boss') dashRect(objRect(o), '#ff6060'); if (o.t === 'arena') dashRect(objRect(o), '#ff9040');
    if (o.t === 'crusher') { const R = objRect(o); c.fillStyle = '#5a636e'; c.fillRect(R.x, R.y, R.w, R.h); }
    else if (o.t === 'platform') drawPlatform(c, o);
    else if (o.t !== 'arena') drawObjIcon(c, o, o.x, o.y);
    c.globalAlpha = 1;
  }
  if (ED.kf) { c.fillStyle = '#60e0ff'; const s = edSnap(); c.fillRect(snapV(ED.wx, s) - 2, snapV(ED.wy, s) - 2, 5, 5); }
}

// ---- properties panel (right side) ----
function edPropsPos() { const o = ED.sel.size === 1 && edObj([...ED.sel][0]); if (!o) return; const x = $('edPX'), y = $('edPY'); if (x) x.value = +(o.x / TS).toFixed(2); if (y) y.value = +(o.y / TS).toFixed(2); }
function field(label, input) { return el('label', {}, el('span', {}, label), input); }
function numIn(v, step, onch, min, max) { return el('input', { type: 'number', value: v, step, min: min ?? '', max: max ?? '', onchange: e => onch(+e.target.value) }); }
function selIn(opts, v, onch) { return el('select', { onchange: e => onch(e.target.value) }, ...opts.map(o => { const [val, txt] = Array.isArray(o) ? o : [o, o]; return el('option', { value: val, selected: String(val) === String(v) }, String(txt).toUpperCase()); })); }
function edChange(fn) { pushUndo(); fn(); ED.dirty = true; }

function renderProps() {
  const p = $('edProps'); if (!p) return; p.innerHTML = '';
  const sel = [...ED.sel].map(edObj).filter(Boolean);
  if (!sel.length) {
    p.append(el('h3', {}, 'LEVEL: ' + ED.L.name),
      el('div', { class: 'muted' }, ED.L.w + ' x ' + ED.L.h + ' TILES · ' + ED.L.objs.length + ' THINGS'),
      el('div', { class: 'muted' }, 'TIME LIMIT: ' + (ED.L.time ? ED.L.time + ' SEC' : 'NONE') + ' · START AMMO ' + ED.L.ammo + ' · ROCKETS ' + ED.L.rockets),
      el('button', { onclick: edSettings, style: { margin: '8px 0' } }, 'LEVEL SETTINGS'),
      el('h4', {}, 'HOW TO'),
      el('div', { class: 'help', innerHTML:
        '<b>PICK</b> SOMETHING ON THE LEFT, THEN CLICK IN THE LEVEL.<br><b>SELECT</b> A THING TO CHANGE IT HERE.<br>' +
        '<b>KEYFRAMES:</b> SELECT A SAW, LASER, PLATFORM... AND ADD MOVEMENT POINTS.<br><b>DRAG A BOX</b> TO SELECT TILES + THINGS, THEN COPY / PASTE.<br>' +
        '<b>CTRL+Z</b> UNDO · <b>CTRL+Y</b> REDO · <b>CTRL+C / V / X</b> COPY PASTE CUT · <b>CTRL+D</b> DUPLICATE<br>' +
        '<b>BOSS:</b> PLACE A BOSS + A BOSS ARENA AROUND IT + RED GATE TILES AT THE DOORS. THE EXIT OPENS WHEN IT DIES.' }));
    return;
  }
  if (sel.length > 1) {
    p.append(el('h3', {}, sel.length + ' THINGS SELECTED'), el('button', { onclick: edCopy }, 'COPY'), el('button', { onclick: () => { if (edCopy()) edPasteStart(); } }, 'DUPLICATE'), el('button', { class: 'danger', onclick: edDelete }, 'DELETE'));
    return;
  }
  const o = sel[0], D = OBJ[o.t];
  p.append(el('h3', {}, (o.t === 'enemy' ? getEnemy(o.def).name : o.t === 'boss' ? getBoss(o.def).name : o.t === 'deco' ? o.kind : D.name).toUpperCase()));
  p.append(field('X (TILES)', Object.assign(numIn(+(o.x / TS).toFixed(2), 0.5, v => edChange(() => { const d = v * TS - o.x; o.x += d; o.path && o.path.pts.forEach(q => q.x += d); })), { id: 'edPX' })));
  p.append(field('Y (TILES)', Object.assign(numIn(+(o.y / TS).toFixed(2), 0.5, v => edChange(() => { const d = v * TS - o.y; o.y += d; o.path && o.path.pts.forEach(q => q.y += d); })), { id: 'edPY' })));
  for (const [key, label, type, a, b, step] of D.props) {
    const v = o[key], set = val => edChange(() => { o[key] = val; renderProps(); });
    if (type === 'num') p.append(field(label, numIn(v, step || 1, x => set(clamp(x, a, b)), a, b)));
    else if (type === 'sel') p.append(field(label, selIn(a, v, set)));
    else if (type === 'bool') p.append(field(label, el('input', { type: 'checkbox', checked: !!v, onchange: e => set(e.target.checked) })));
    else if (type === 'text') p.append(field(label, el('input', { type: 'text', value: v || '', maxLength: 140, onchange: e => set(e.target.value) })));
    else if (type === 'enemy') p.append(field(label, selIn(allEnemyIds().map(id => [id, getEnemy(id).name]), v, set)));
    else if (type === 'boss') p.append(field(label, selIn(allBossIds().map(id => [id, getBoss(id).name]), v, set)));
  }
  if (o.t === 'enemy') p.append(el('button', { onclick: () => { edSave(true); openMaker('enemy', o.def, 'editor'); } }, 'EDIT THIS ENEMY TYPE'));
  if (o.t === 'boss') p.append(el('button', { onclick: () => { edSave(true); openMaker('boss', o.def, 'editor'); } }, 'EDIT THIS BOSS'));
  // keyframes
  if (MOVABLE[o.t]) {
    p.append(el('h4', {}, 'MOVEMENT (KEYFRAMES)'));
    const P = o.path;
    p.append(el('div', { class: 'muted' }, 'POINT 0 IS WHERE IT STANDS NOW. ADD POINTS FOR WHERE IT SHOULD MOVE.'));
    if (P) P.pts.forEach((q, i) => {
      p.append(el('div', { class: 'kf' },
        el('b', {}, String(i + 1)),
        el('input', { type: 'number', step: 0.5, value: +(q.x / TS).toFixed(2), title: 'X (tiles)', onchange: e => edChange(() => { q.x = +e.target.value * TS; }) }),
        el('input', { type: 'number', step: 0.5, value: +(q.y / TS).toFixed(2), title: 'Y (tiles)', onchange: e => edChange(() => { q.y = +e.target.value * TS; }) }),
        el('input', { type: 'number', step: 0.1, min: 0.05, value: q.d, title: 'Seconds to get here', onchange: e => edChange(() => { q.d = clamp(+e.target.value || 1, 0.05, 60); o._segs = null; }) }),
        el('span', {}),
        selIn(EASE_NAMES, q.e, v => edChange(() => { q.e = v; })),
        el('button', { class: 'danger', title: 'Remove point', onclick: () => edChange(() => { P.pts.splice(i, 1); if (!P.pts.length) delete o.path; renderProps(); }) }, '✕')));
    });
    if (P) p.append(el('div', { class: 'muted' }, 'COLUMNS: X · Y · SECONDS · EASING'));
    p.append(el('button', { class: ED.kf ? 'on' : '', onclick: () => { ED.kf = !ED.kf; ED.pasting = false; renderProps(); } }, ED.kf ? '■ STOP ADDING (ESC)' : '+ ADD BY CLICKING (K)'),
      el('button', { onclick: () => edChange(() => {
        o.path = o.path || { pts: [], mode: 'ping', wait: 0.3, start: 'always', near: 96 };
        const last = o.path.pts[o.path.pts.length - 1] || o; o.path.pts.push({ x: last.x + 3 * TS, y: last.y, d: 1.5, e: 'ease in-out' }); renderProps();
      }) }, '+ ADD POINT (XY)'));
    if (P) {
      p.append(field('AFTER LAST POINT', selIn([['ping', 'GO BACK (PING-PONG)'], ['loop', 'JUMP TO START (LOOP)'], ['once', 'STOP (ONCE)']], P.mode, v => edChange(() => { P.mode = v; }))));
      p.append(field('WAIT AT POINTS (SEC)', numIn(P.wait, 0.1, v => edChange(() => { P.wait = clamp(v, 0, 30); }), 0, 30)));
      p.append(field('STARTS MOVING', selIn([['always', 'RIGHT AWAY'], ['near', 'WHEN PLAYER IS NEAR']], P.start, v => edChange(() => { P.start = v; renderProps(); }))));
      if (P.start === 'near') p.append(field('NEAR = TILES', numIn(+(P.near / TS).toFixed(1), 0.5, v => edChange(() => { P.near = clamp(v * TS, 8, 2000); }))));
      p.append(el('button', { class: 'danger', onclick: () => edChange(() => { delete o.path; renderProps(); }) }, 'REMOVE ALL MOVEMENT'));
    }
  }
  p.append(el('h4', {}, ''), el('button', { onclick: () => { if (edCopy()) edPasteStart(); } }, 'DUPLICATE'), el('button', { class: 'danger', onclick: edDelete }, 'DELETE'));
}

// ---- level settings ----
function edSettings() {
  const L = ED.L, v = { name: L.name, w: L.w, h: L.h, time: L.time, ammo: L.ammo, rockets: L.rockets, theme: L.theme };
  const inp = (k, type, extra = {}) => el('input', Object.assign({ type, value: v[k], onchange: e => v[k] = type === 'number' ? +e.target.value : e.target.value }, extra));
  showModal(el('h2', {}, 'LEVEL SETTINGS'),
    el('label', {}, 'NAME', inp('name', 'text', { maxLength: 30 })),
    el('label', {}, 'WIDTH (TILES)', inp('w', 'number', { min: 10, max: 400 })),
    el('label', {}, 'HEIGHT (TILES)', inp('h', 'number', { min: 8, max: 200 })),
    el('label', {}, 'TIME LIMIT (SECONDS, 0 = NONE)', inp('time', 'number', { min: 0, max: 3600 })),
    el('label', {}, 'STARTING AMMO', inp('ammo', 'number', { min: 0, max: 999 })),
    el('label', {}, 'STARTING ROCKETS', inp('rockets', 'number', { min: 0, max: 99 })),
    el('label', {}, 'LOOK', selIn(Object.keys(THEMES).map(k => [k, THEMES[k].name]), v.theme, x => v.theme = x)),
    el('div', { style: { marginTop: '10px' } },
      el('button', { onclick: () => {
        pushUndo(); L.name = String(v.name || 'LEVEL').slice(0, 30).toUpperCase(); L.time = clamp(v.time || 0, 0, 3600); L.ammo = clamp(v.ammo || 0, 0, 999); L.rockets = clamp(v.rockets || 0, 0, 99); L.theme = v.theme;
        if (v.w !== L.w || v.h !== L.h) resizeLevel(L, Math.round(v.w), Math.round(v.h));
        ED.dirty = true; closeModal(); buildTop(); renderProps();
      } }, 'APPLY'), el('button', { onclick: closeModal }, 'CANCEL')));
}
