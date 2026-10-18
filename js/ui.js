// FOUNDRY - menus, pause, popups, saved levels, little icons.
'use strict';

const CAMPAIGN = makeCampaign();
let myLevels = loadStore('levels', []);
let progress = (() => { try { return JSON.parse(localStorage.getItem('foundry_progress')) || { done: [], best: {} }; } catch (e) { return { done: [], best: {} }; } })();
const saveProgress = () => { try { localStorage.setItem('foundry_progress', JSON.stringify(progress)); } catch (e) { } };
const $ = id => document.getElementById(id);

// tiny DOM builder: el('button', { onclick }, 'text')
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'style' && typeof props[k] === 'object') Object.assign(e.style, props[k]);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), props[k]);
    else if (k === 'class') e.className = props[k];
    else if (k in e) e[k] = props[k]; else e.setAttribute(k, props[k]);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 1600); }
function showModal(...kids) { const m = $('modal'); m.innerHTML = ''; m.append(el('div', { class: 'panel' }, ...kids)); m.classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); $('modal').innerHTML = ''; }
function hideAll() { ['menu', 'ed', 'mk'].forEach(i => $(i).classList.add('hidden')); closeModal(); }

// ---- saved levels ----
function saveMyLevel(L) {
  embedDesigns(L);
  const i = myLevels.findIndex(l => l.id === L.id);
  if (i >= 0) myLevels[i] = deep(L); else myLevels.push(deep(L));
  saveStore('levels', myLevels);
}
// put the custom enemies/bosses a level uses inside it, so it still works when shared
function embedDesigns(L) {
  L.enemies = {}; L.bosses = {};
  const addE = id => { if (customEnemies[id]) L.enemies[id] = deep(customEnemies[id]); };
  for (const o of L.objs) {
    if (o.t === 'enemy') addE(o.def);
    if (o.t === 'boss' && customBosses[o.def]) { L.bosses[o.def] = deep(customBosses[o.def]); addE(customBosses[o.def].minion); }
    if (o.t === 'boss') addE(getBoss(o.def).minion);
  }
}
function levelCode(L) { embedDesigns(L); return 'FOUNDRY1:' + btoa(unescape(encodeURIComponent(JSON.stringify(L)))); }
function readLevelCode(s) {
  s = s.trim(); if (s.startsWith('FOUNDRY1:')) s = decodeURIComponent(escape(atob(s.slice(9))));
  return cleanLevel(JSON.parse(s));
}

// ---- screens ----
function showMenu() {
  hideAll(); ambStop(); G.mode = 'menu';
  const m = $('menu'); m.innerHTML = ''; m.classList.remove('hidden');
  m.append(
    el('div', { class: 'title' }, 'FOUNDRY'),
    el('div', { class: 'stripe' }),
    el('div', { class: 'sub' }, 'SHOOT. RUN. ESCAPE THE FACTORY.'),
    el('button', { class: 'big', onclick: showCampaign }, '▶ PLAY'),
    el('button', { class: 'big', onclick: showMyLevels }, 'MY LEVELS'),
    el('button', { class: 'big', onclick: () => openEditor(blankLevel(), null) }, 'NEW LEVEL (EDITOR)'),
    el('div', { style: { display: 'flex', gap: '10px' } },
      el('button', { onclick: () => openMaker('enemy', null, 'menu') }, 'ENEMY MAKER'),
      el('button', { onclick: () => openMaker('boss', null, 'menu') }, 'BOSS MAKER'),
      el('button', { onclick: showHelp }, 'CONTROLS')),
  );
}
function showHelp() {
  showModal(el('h2', {}, 'CONTROLS'), el('div', { class: 'help', innerHTML:
    '<b>A / D</b> MOVE &nbsp; <b>W / SPACE</b> JUMP, CLIMB, SWIM &nbsp; <b>S</b> DROP THROUGH GIRDERS<br>' +
    '<b>MOUSE</b> AIM &nbsp; <b>LEFT CLICK</b> SHOOT &nbsp; <b>RIGHT CLICK / Q / 1 / 2</b> SWITCH GUN<br>' +
    '<b>ESC</b> PAUSE &nbsp; <b>R</b> RETRY AFTER DYING<br><br>' +
    'AMMO IS LIMITED: FIND BOXES AROUND THE MAP.<br>ROCKETS EXPLODE (THEY GO THROUGH SHIELDS) AND CAN ROCKET-JUMP YOU.<br>' +
    'GRATES LET BULLETS THROUGH, BUT NOT YOU OR ROCKETS.' }), el('div', { style: { marginTop: '12px' } }, el('button', { onclick: closeModal }, 'OK')));
}
function showCampaign() {
  hideAll(); G.mode = 'menu';
  const m = $('menu'); m.innerHTML = ''; m.classList.remove('hidden');
  const p = el('div', { class: 'panel' }, el('h2', {}, 'CAMPAIGN'));
  CAMPAIGN.forEach((L, i) => {
    const open = i === 0 || progress.done.includes(i - 1);
    const best = progress.best[L.name];
    p.append(el('div', { class: 'row' },
      el('div', { class: 'grow' }, (i + 1) + '. ' + L.name, el('div', { class: 'muted' }, (L.time ? 'TIME LIMIT ' + L.time + 's · ' : '') + (L.objs.some(o => o.t === 'boss') ? 'BOSS FIGHT · ' : '') + (best != null ? 'BEST ' + fmtTime(best) : open ? 'NOT BEATEN YET' : 'LOCKED'))),
      el('button', { disabled: !open, onclick: () => { hideAll(); startPlay(CAMPAIGN[i], { kind: 'campaign', idx: i }); } }, open ? 'PLAY' : 'LOCKED'),
      el('button', { onclick: () => openEditor(Object.assign(deep(L), { name: L.name + ' COPY' }), null), title: 'Open a copy in the editor' }, 'EDIT COPY')));
  });
  p.append(el('div', { style: { marginTop: '10px' } }, el('button', { onclick: showMenu }, '◀ BACK')));
  m.append(p);
}
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

function showMyLevels() {
  hideAll(); G.mode = 'menu';
  myLevels = loadStore('levels', []);
  const m = $('menu'); m.innerHTML = ''; m.classList.remove('hidden');
  const p = el('div', { class: 'panel' }, el('h2', {}, 'MY LEVELS'));
  if (!myLevels.length) p.append(el('div', { class: 'muted', style: { padding: '10px 0' } }, 'NO LEVELS YET. MAKE ONE!'));
  myLevels.forEach(L => {
    p.append(el('div', { class: 'row' },
      el('div', { class: 'grow' }, L.name, el('div', { class: 'muted' }, L.w + 'x' + L.h + ' · ' + L.objs.length + ' THINGS' + (L.time ? ' · ' + L.time + 's' : ''))),
      el('button', { onclick: () => { hideAll(); startPlay(L, { kind: 'custom' }); } }, 'PLAY'),
      el('button', { onclick: () => openEditor(deep(L), L.id) }, 'EDIT'),
      el('button', { onclick: () => showModal(el('h2', {}, 'LEVEL CODE'), el('div', { class: 'muted' }, 'COPY THIS AND SEND IT TO A FRIEND. THEY CAN USE IMPORT.'),
        el('textarea', { value: levelCode(deep(L)), readOnly: true, onclick: e => e.target.select() }), el('button', { onclick: closeModal }, 'CLOSE')) }, 'SHARE'),
      el('button', { class: 'danger', onclick: () => { if (confirm('Delete "' + L.name + '"?')) { myLevels = myLevels.filter(l => l.id !== L.id); saveStore('levels', myLevels); showMyLevels(); } } }, 'DELETE')));
  });
  p.append(el('div', { style: { marginTop: '10px', display: 'flex', gap: '6px' } },
    el('button', { onclick: showMenu }, '◀ BACK'),
    el('button', { onclick: () => openEditor(blankLevel(), null) }, '+ NEW LEVEL'),
    el('button', { onclick: importDialog }, 'IMPORT CODE')));
  m.append(p);
}
function importDialog() {
  const ta = el('textarea', { placeholder: 'Paste a level code here' });
  showModal(el('h2', {}, 'IMPORT LEVEL'), ta, el('div', { style: { marginTop: '8px' } },
    el('button', { onclick: () => {
      try { const L = readLevelCode(ta.value); L.id = 'L' + uid(); saveMyLevel(L); closeModal(); toast('IMPORTED ' + L.name); showMyLevels(); }
      catch (e) { toast('THAT CODE DOES NOT WORK'); }
    } }, 'IMPORT'), el('button', { onclick: closeModal }, 'CANCEL')));
}

function showPause() {
  G.paused = true;
  const m = $('menu'); m.innerHTML = ''; m.classList.remove('hidden');
  const fromEd = G.src.kind === 'test', fromMk = G.src.kind === 'maker';
  m.append(el('div', { class: 'title', style: { fontSize: '48px' } }, 'PAUSED'),
    el('button', { class: 'big', onclick: resumePlay }, 'RESUME'),
    el('button', { class: 'big', onclick: () => { G.cp = null; resetWorld(); resumePlay(); } }, 'RESTART LEVEL'),
    el('button', { class: 'big', onclick: showHelp }, 'CONTROLS'),
    el('button', { class: 'big', onclick: quitPlay }, fromEd ? 'BACK TO EDITOR' : fromMk ? 'BACK TO MAKER' : 'QUIT TO MENU'));
}
function resumePlay() { $('menu').classList.add('hidden'); G.paused = false; }
function quitPlay() {
  ambStop(); G.paused = false;
  if (G.src.kind === 'test') return backToEditor();
  if (G.src.kind === 'maker') return backToMaker();
  if (G.src.kind === 'campaign') return showCampaign();
  if (G.src.kind === 'custom') return showMyLevels();
  showMenu();
}
function finishLevel() {
  const src = G.src, w = G.w;
  if (src.kind === 'campaign') {
    if (!progress.done.includes(src.idx)) progress.done.push(src.idx);
    const n = G.level.name; if (progress.best[n] == null || w.time < progress.best[n]) progress.best[n] = w.time;
    saveProgress();
    if (src.idx + 1 < CAMPAIGN.length) { startPlay(CAMPAIGN[src.idx + 1], { kind: 'campaign', idx: src.idx + 1 }); return; }
    ambStop(); hideAll(); G.mode = 'menu';
    const m = $('menu'); m.innerHTML = ''; m.classList.remove('hidden');
    m.append(el('div', { class: 'title', style: { fontSize: '56px' } }, 'YOU ESCAPED'), el('div', { class: 'sub' }, 'THE FOUNDRY IS BEHIND YOU. NOW BUILD YOUR OWN.'),
      el('button', { class: 'big', onclick: () => openEditor(blankLevel(), null) }, 'OPEN THE EDITOR'), el('button', { class: 'big', onclick: showMenu }, 'MAIN MENU'));
    return;
  }
  quitPlay();
}

// ---- icons for palettes (draws one object in a small canvas) ----
const ICON_W = { time: 0.6, editor: true, player: null, enemies: [], decos: [] };
function drawObjIcon(ctx, o, cx, cy) {
  const t = 0.6, x = cx, y = cy;
  switch (o.t) {
    case 'spawn': drawPlayer(ctx, { x: x - 5, y: y - 10, w: 10, h: 20, dead: false, inv: 0, face: 1, aim: 0, recoil: 0, weapon: 0, ground: true, vx: 0, anim: 0 }, ICON_W); break;
    case 'exit': drawExit(ctx, { x, y: y + 2 }, true, t); break;
    case 'checkpoint': drawCheckpoint(ctx, { x, y }, t); break;
    case 'sign': drawSign(ctx, { x, y }, t); break;
    case 'platform': drawPlatform(ctx, { x, y, tw: 2 }); break;
    case 'ammo': case 'rockets': case 'health': drawPickup(ctx, { t: o.t, x, y }, 0); break;
    case 'crusher': drawCrusher(ctx, Object.assign({ x, y: y, tw: 2, len: 1, ext: 0.6, warn: false }, o, { tw: Math.min(o.tw || 2, 2) }), t); break;
    case 'saw': drawSaw(ctx, { x, y, r: 11, rot: 0.3 }); break;
    case 'turret': drawTurret(ctx, { x, y, mode: o.mode || 'when crossed', aim: (o.angle ?? 180) * Math.PI / 180, hp: 1, hpNow: 1, flash: 0 }, t, false); break;
    case 'cturret': drawTurret(ctx, { x, y: y - 2, ceil: true, aim: 1.2 }, t, false); break;
    case 'coil': drawCoil(ctx, { x, y: y + 2, state: 1 }, 0); break;
    case 'laser': {
      const a = (o.angle || 0) * Math.PI / 180;
      drawLaser(ctx, { x, y, ang: a, onNow: true, ex: x + Math.cos(a) * 18, ey: y + Math.sin(a) * 18, color: o.color || 'red' }, t, false);
      if (o.turn) { ctx.fillStyle = '#fff'; pring(ctx, x, y, 9); }
      break;
    }
    case 'enemy': { const e = makeEnemy({ x, y, def: o.def, face: 'right' }); drawEnemy(ctx, e, ICON_W); break; }
    case 'boss': { const b = makeBoss({ x, y, def: o.def }, { arena: null }); ctx.save(); const s = bossSize(b.d), k = Math.min(1, 40 / Math.max(s.w, s.h)); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); b.face = 1; drawBoss(ctx, b, ICON_W); ctx.restore(); break; }
    case 'arena': ctx.fillStyle = '#ff9040'; for (let i = -14; i < 14; i += 4) { ctx.fillRect(x + i, y - 12, 2, 1); ctx.fillRect(x + i, y + 12, 2, 1); ctx.fillRect(x - 15, y + i, 1, 2); ctx.fillRect(x + 15, y + i, 1, 2); } ptext(ctx, 'ARENA', x, y - 2, '#ff9040', 1, 'c', null); break;
    case 'deco': { const d = { x, y, kind: o.kind, ang: 0 }; if (o.kind === 'chain') d.rope = makeRope(x, y - 14, x, y + 14, 9, 1); if (o.kind === 'cables') d.ropes = [makeRope(x - 16, y - 4, x + 16, y - 4, 10, 1.12)]; if (o.kind === 'sparks') { d.rope = makeRope(x, y - 12, x, y + 12, 7, 1); } drawDeco(ctx, d, t); break; }
    case 'heater': drawHeater(ctx, Object.assign({ heat: 0.85, hot: false }, o, { x, y, tw: 2 }), t); break;
    case 'wallzap': drawZap(ctx, Object.assign({ state: 1 }, o, { x, y }), t, false); break;
    case 'flamer': {
      const f = Object.assign({ state: 2 }, o, { x, y }), a = f.angle * Math.PI / 180;
      for (let i = 0; i < 18; i++) { ctx.fillStyle = ['#fff0a0', '#ffc040', '#ff7020'][i % 3]; ctx.fillRect(Math.round(x + Math.cos(a) * (6 + i) + rand(-1, 1) * i * 0.2), Math.round(y + Math.sin(a) * (6 + i) + rand(-1, 1) * i * 0.2), 2, 2); }
      drawFlamer(ctx, f, t, false); break;
    }
    case 'mine': drawPMine(ctx, { x, y: y + 4 }, 0.1); break;
    case 'vent': drawVent(ctx, { x, y: y + 6, onNow: true }, t); ctx.fillStyle = '#d8dce0'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 4 + (i * 5) % 9, y - 4 - i * 3, 2, 2); break;
    case 'tile':
      if (MAT_OF[o.ch] !== undefined || TILES[o.ch]?.slope) { ctx.drawImage(terrainIcon(o.ch), x - 16, y - 16, 32, 32); break; }
      if (o.ch === '%') { ctx.fillStyle = '#e04a10'; ctx.fillRect(x - 16, y - 12, 32, 28); ctx.fillStyle = '#ffb040'; ctx.fillRect(x - 16, y - 12, 32, 3); ctx.fillStyle = '#ffe080'; ctx.fillRect(x - 16, y - 12, 32, 1); ctx.fillStyle = '#801800'; ctx.fillRect(x - 8, y, 9, 3); ctx.fillRect(x + 4, y + 8, 7, 2); break; }
      ctx.drawImage(tileTex(o.ch, 0, o.bg), x - 16, y - 16, 32, 32); if (o.ch === '~') { ctx.fillStyle = 'rgba(40,110,170,0.8)'; ctx.fillRect(x - 16, y - 16, 32, 32); ctx.fillStyle = '#a0d0ff'; ctx.fillRect(x - 16, y - 16, 32, 2); }
      if (o.ch === 'D') { drawGate(ctx, x - 16, y - 16, true, 0, false); drawGate(ctx, x, y - 16, true, 0, false); drawGate(ctx, x - 16, y, true, 0, false); drawGate(ctx, x, y, true, 0, false); }
      if (o.ch === '.') { ctx.strokeStyle = '#e04040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10); ctx.moveTo(x + 10, y - 10); ctx.lineTo(x - 10, y + 10); ctx.stroke(); }
      break;
  }
}
const ICONS = new Map();
function iconCanvas(o, size = 48) {
  const key = JSON.stringify(o) + size;
  if (ICONS.has(key) && !/enemy|boss/.test(o.t)) return ICONS.get(key);
  const c = mkCanvas(size, size), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  try { drawObjIcon(g, o, size / 2, size / 2); } catch (e) { console.warn('icon', o, e); }
  ICONS.set(key, c);
  return c;
}
