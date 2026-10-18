// FOUNDRY - ENEMY MAKER and BOSS MAKER (simple / normal / advanced).
'use strict';

const MK = { kind: 'enemy', id: null, def: null, mode: 0, back: 'menu', world: null, pv: null, t: 0, saved: true };
const MODE_NAMES = ['SIMPLE', 'NORMAL', 'ADVANCED'];

function openMaker(kind, id, back) {
  hideAll(); ambStop(); G.mode = 'maker';
  MK.kind = kind; MK.back = back || MK.back;
  const ids = kind === 'enemy' ? allEnemyIds() : allBossIds();
  loadDesign(id && ids.includes(id) ? id : ids[0]);
  $('mk').classList.remove('hidden');
  renderMaker();
}
function backToMaker() { hideAll(); ambStop(); G.mode = 'maker'; $('mk').classList.remove('hidden'); renderMaker(); }
function loadDesign(id) {
  const isE = MK.kind === 'enemy';
  const src = isE ? (customEnemies[id] || ENEMY_DEFAULTS[id] || levelEnemies[id]) : (customBosses[id] || BOSS_DEFAULTS[id] || levelBosses[id]);
  MK.id = id; MK.def = Object.assign({}, deep(isE ? ENEMY_BASE : BOSS_BASE), deep(src || {}));
  MK.mode = MK.def.mode || 0; MK.saved = true; MK.world = null;
}
const isBuiltin = () => MK.kind === 'enemy' ? !!ENEMY_DEFAULTS[MK.id] : !!BOSS_DEFAULTS[MK.id];

function makerSave() {
  const store = MK.kind === 'enemy' ? customEnemies : customBosses;
  if (isBuiltin() || !store[MK.id]) { MK.id = (MK.kind === 'enemy' ? 'e_' : 'b_') + uid(); }
  const d = deep(MK.def); d.mode = MK.mode; delete d.id; delete d.maxHp; delete d.nb; delete d.bs; delete d.bd;
  store[MK.id] = d; saveStore(MK.kind === 'enemy' ? 'enemies' : 'bosses', store);
  MK.saved = true; toast('SAVED ' + d.name); renderMaker();
}
function makerChanged() { MK.saved = false; MK.world = null; }

function renderMaker() {
  const R = $('mk'); R.innerHTML = '';
  const isE = MK.kind === 'enemy', ids = isE ? allEnemyIds() : allBossIds();
  // left: list of designs
  const list = el('div', { class: 'col list' }, el('h2', {}, isE ? 'ENEMIES' : 'BOSSES'));
  for (const id of ids) {
    const d = isE ? getEnemy(id) : getBoss(id);
    list.append(el('button', { class: id === MK.id ? 'on' : '', onclick: () => { if (!MK.saved && !confirm('Leave without saving?')) return; loadDesign(id); renderMaker(); } },
      d.name + ((isE ? ENEMY_DEFAULTS : BOSS_DEFAULTS)[id] ? '' : ' ★')));
  }
  list.append(el('div', { class: 'muted', style: { margin: '6px 0' } }, '★ = MADE BY YOU'),
    el('button', { onclick: () => { MK.id = null; MK.def = deep(isE ? ENEMY_BASE : BOSS_BASE); MK.mode = 0; MK.saved = false; MK.world = null; renderMaker(); } }, '+ NEW'),
    el('button', { onclick: () => { MK.id = null; MK.def.name = (MK.def.name + ' 2').slice(0, 20); MK.saved = false; renderMaker(); } }, 'DUPLICATE'),
    !isBuiltin() && MK.id ? el('button', { class: 'danger', onclick: () => {
      if (!confirm('Delete this design?')) return;
      const store = isE ? customEnemies : customBosses; delete store[MK.id]; saveStore(isE ? 'enemies' : 'bosses', store); loadDesign((isE ? allEnemyIds() : allBossIds())[0]); renderMaker();
    } }, 'DELETE') : null,
    el('div', { style: { marginTop: '14px' } }, el('button', { onclick: () => openMaker(isE ? 'boss' : 'enemy', null, MK.back) }, isE ? '→ BOSS MAKER' : '→ ENEMY MAKER')));

  // middle: the form
  const form = el('div', { class: 'col' });
  form.append(el('h2', {}, (isE ? 'ENEMY MAKER' : 'BOSS MAKER') + (MK.saved ? '' : ' *')));
  form.append(el('div', { class: 'tabs' }, ...MODE_NAMES.map((n, i) => el('button', { class: MK.mode === i ? 'on' : '', onclick: () => { MK.mode = i; MK.def.mode = i; makerChanged(); renderMaker(); } }, n))));
  form.append(el('div', { class: 'muted', style: { marginBottom: '8px' } },
    ['ONLY THE BASICS. PERFECT TO START.', 'MORE CONTROL OVER HOW IT MOVES AND FIGHTS.', 'EVERY NUMBER.' + (isE ? '' : ' PHASES: A NEW SET OF ATTACKS WHEN ITS HEALTH GETS LOW.')][MK.mode]));
  if (isBuiltin() && MK.id) form.append(el('div', { class: 'muted', style: { color: '#ffb060', marginBottom: '6px' } }, 'THIS IS A BUILT-IN DESIGN. SAVING MAKES YOUR OWN COPY.'));
  const fields = isE ? ENEMY_FIELDS : BOSS_FIELDS;
  for (const f of fields) {
    const [key, label, type, lvl, a, b, step] = f;
    if (lvl > MK.mode) continue;
    const d = MK.def, set = v => { d[key] = v; makerChanged(); };
    let input;
    if (type === 'text') input = el('input', { type: 'text', value: d[key], maxLength: 20, oninput: e => { set(e.target.value.toUpperCase()); $('mkTitle') && ($('mkTitle').textContent = d.name); } });
    else if (type === 'sel') input = selIn(a, d[key], v => { set(v); renderMaker(); });
    else if (type === 'color') input = el('input', { type: 'color', value: d[key], oninput: e => set(e.target.value) });
    else if (type === 'bool') input = el('input', { type: 'checkbox', checked: !!d[key], onchange: e => set(e.target.checked) });
    else if (type === 'num') {
      const num = el('input', { type: 'number', value: d[key], min: a, max: b, step: step || 1 });
      const rng = el('input', { type: 'range', value: d[key], min: a, max: b, step: step || 1 });
      rng.oninput = () => { num.value = rng.value; set(+rng.value); };
      num.onchange = () => { const v = clamp(+num.value, a, b); num.value = v; rng.value = v; set(v); };
      input = el('span', { class: 'num' }, rng, num);
    }
    else if (type === 'enemy') input = selIn(allEnemyIds().map(id => [id, getEnemy(id).name]), d[key], v => set(v));
    else if (type === 'attacks') { form.append(el('div', { style: { padding: '6px 0 2px', color: '#aab2bc', fontSize: '13px' } }, label + (MK.mode === 2 ? ' (USED BY PHASES BELOW)' : '')), attackBoxes(d.attacks, v => { d.attacks = v; makerChanged(); })); continue; }
    else if (type === 'phases') { form.append(phaseEditor()); continue; }
    form.append(el('label', {}, el('span', {}, label.toUpperCase()), input));
  }
  if (!isE && MK.mode < 2) form.append(el('div', { class: 'muted', style: { marginTop: '6px' } }, 'DIFFICULTY ' + MK.def.diff + ': ' + (MK.def.diff >= 4 ? '3 PHASES' : MK.def.diff >= 2 ? '2 PHASES' : '1 PHASE') + ' · GETS FASTER WHEN HURT'));

  // right: preview + buttons
  const pv = el('canvas', { id: 'mkPrev', width: 270, height: 152 });
  MK.pv = pv;
  const right = el('div', { class: 'col' },
    el('h2', { id: 'mkTitle' }, MK.def.name),
    pv,
    el('div', { class: 'muted', style: { margin: '6px 0' } }, 'LIVE PREVIEW: IT FIGHTS A PRACTICE DUMMY.'),
    el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      el('button', { class: 'on', onclick: makerSave }, 'SAVE'),
      el('button', { onclick: makerTest }, '▶ TEST FIGHT'),
      el('button', { onclick: () => { MK.world = null; } }, 'RESTART PREVIEW'),
      el('button', { onclick: makerBack }, MK.back === 'editor' ? '◀ BACK TO EDITOR' : '◀ MENU')),
    el('div', { class: 'help', style: { marginTop: '12px' }, innerHTML: isE
      ? '<b>SHIELDS</b> BLOCK BULLETS FROM THE FRONT. ROCKET EXPLOSIONS GO THROUGH.<br><b>FLY</b> ENEMIES IGNORE GRAVITY.<br>USE YOUR ENEMY IN THE EDITOR UNDER <b>ENEMIES</b>.'
      : '<b>PUT IT IN A LEVEL:</b> PLACE THE BOSS, A BOSS ARENA AROUND IT AND RED GATE TILES IN THE DOORWAYS.<br>THE GATES CLOSE WHEN YOU WALK IN AND OPEN WHEN IT DIES.' }));
  R.append(list, form, right);
}
function attackBoxes(cur, onch) {
  const box = el('div', { class: 'atk' });
  for (const k in BOSS_ATTACKS) box.append(el('label', {}, el('input', { type: 'checkbox', checked: cur.includes(k), onchange: e => {
    const v = e.target.checked ? [...cur, k] : cur.filter(x => x !== k); cur.splice(0, cur.length, ...v); onch(cur.slice());
  } }), ' ' + BOSS_ATTACKS[k].toUpperCase()));
  return box;
}
function phaseEditor() {
  const d = MK.def;
  if (!d.phases || !d.phases.length) d.phases = [{ at: 1, attacks: d.attacks.slice(), speed: 1, cd: 1 }];
  const box = el('div', {}, el('div', { style: { padding: '10px 0 4px', color: '#9ad0ff' } }, 'PHASES'));
  d.phases.forEach((ph, i) => {
    box.append(el('div', { class: 'phase' },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, el('b', {}, 'PHASE ' + (i + 1)),
        i > 0 ? el('button', { class: 'danger', onclick: () => { d.phases.splice(i, 1); makerChanged(); renderMaker(); } }, '✕') : null),
      el('label', {}, el('span', {}, 'STARTS AT HEALTH %'), i === 0 ? el('span', {}, '100') : el('input', { type: 'number', min: 5, max: 95, value: Math.round(ph.at * 100), onchange: e => { ph.at = clamp(+e.target.value, 5, 95) / 100; makerChanged(); } })),
      el('label', {}, el('span', {}, 'SPEED X'), el('input', { type: 'number', min: 0.3, max: 3, step: 0.1, value: ph.speed, onchange: e => { ph.speed = clamp(+e.target.value, 0.3, 3); makerChanged(); } })),
      el('label', {}, el('span', {}, 'REST X (LOWER = ATTACKS MORE)'), el('input', { type: 'number', min: 0.2, max: 3, step: 0.1, value: ph.cd, onchange: e => { ph.cd = clamp(+e.target.value, 0.2, 3); makerChanged(); } })),
      attackBoxes(ph.attacks, v => { ph.attacks = v; makerChanged(); })));
  });
  if (d.phases.length < 4) box.append(el('button', { onclick: () => { const last = d.phases[d.phases.length - 1]; d.phases.push({ at: Math.max(0.1, last.at - 0.3), attacks: last.attacks.slice(), speed: +(last.speed + 0.2).toFixed(1), cd: +(Math.max(0.3, last.cd - 0.2)).toFixed(1) }); makerChanged(); renderMaker(); } }, '+ ADD PHASE'));
  return box;
}
function makerBack() {
  if (!MK.saved && !confirm('Leave without saving?')) return;
  if (MK.back === 'editor') backToEditor(); else showMenu();
}

// design as it is right now (also before saving)
function currentDesign() {
  const d = deep(MK.def); d.mode = MK.mode;
  if (MK.kind === 'enemy') { const e = Object.assign({}, ENEMY_BASE, d); e.maxHp = e.hp > 0 ? e.hp : TOUGH_HP[e.tough] || 40; if (e.body === 'drone') e.ai = 'fly'; return e; }
  const tmp = '__preview'; customBosses[tmp] = d; const b = getBoss(tmp); delete customBosses[tmp]; return b;
}

// ---- live preview: a little room where the design fights an invincible dummy ----
function makerPreviewWorld() {
  const isE = MK.kind === 'enemy';
  const W = isE ? 19 : 30, H = isE ? 11 : 17;
  const B = LB('PREVIEW', W, H, 'steel', { ammo: 0 });
  B.fill(0, H - 2, W, 2, 'C').fill(0, 0, W, 1, '#').fill(0, 0, 1, H, '#').fill(W - 1, 0, 1, H, '#');
  B.at('spawn', 3, H - 2);
  if (isE) B.at('enemy', 13, H - 2, { def: '__mk', face: 'left' });
  else { B.obj('arena', W / 2 * TS, (H / 2) * TS, { tw: W - 2, th: H - 2 }); B.at('boss', 20, H - 2, { def: '__mk' }); }
  const L = B.done();
  const w = makeWorld(L);
  const d = currentDesign();
  w.player = makePlayer(w, 3 * TS + 8, (H - 2) * TS - 10); w.dummy = true; w.homeX = w.player.x;
  if (isE) { const o = L.objs.find(o => o.t === 'enemy'); w.enemies = [makeEnemy(o, d)]; if (d.ai === 'fly') { w.enemies[0].y -= 40; w.enemies[0].homeY -= 40; } }
  else { w.boss = makeBoss(L.objs.find(o => o.t === 'boss'), w, d); w.boss.active = true; }
  return w;
}
function makerTick(dt) {
  if (!MK.pv) return;
  if (!MK.world) { try { MK.world = makerPreviewWorld(); MK.t = 0; } catch (e) { console.error(e); return; } }
  const w = MK.world; MK.t += dt;
  const P = w.player;
  P.hp = PL.maxHp;
  // the dummy shuffles a little so attacks aim around
  const want = w.homeX + Math.sin(MK.t * 0.7) * 28;
  const ctl = { left: P.x > want + 4, right: P.x < want - 4, aimX: P.x + 60, aimY: P.y + 8 };
  w.time += dt;
  const quiet = AU.ctx; AU.ctx = null;        // keep the preview silent
  try {
    updateHazards(w, dt); updatePlayer(w, dt, ctl); updateEnemies(w, dt); updateBoss(w, dt); updateBullets(w, dt); updateEffects(w, dt); updateParts(w, dt); updateAnim(w, dt, null);
  } finally { AU.ctx = quiet; }
  if ((MK.kind === 'enemy' && (!w.enemies.length || w.enemies.every(e => e.dead))) || (w.boss && w.boss.dead) || MK.t > 30) MK.world = null;
  if (MK.pv.width !== w.pw || MK.pv.height !== w.ph) { MK.pv.width = w.pw; MK.pv.height = w.ph; }   // show the whole room
  const c = MK.pv.getContext('2d'); c.imageSmoothingEnabled = false;
  const cam = { x: 0, y: 0 };
  c.fillStyle = '#000'; c.fillRect(0, 0, MK.pv.width, MK.pv.height);
  drawWorld(c, w, cam, MK.pv.width, MK.pv.height, { noLight: true });
  ptext(c, 'DUMMY', P.x + 5 - cam.x, P.y - 10 - cam.y, '#8a8a8a', 1, 'c');
  if (w.boss && w.boss.atk) ptext(c, (BOSS_ATTACKS[w.boss.atk.k] || '').toUpperCase(), MK.pv.width / 2, 4, '#ffb0a0', 1, 'c');
}

// TEST FIGHT: a real level with your design in it
function makerTest() {
  const isE = MK.kind === 'enemy', d = currentDesign();
  const tmpId = '__test';
  const B = LB('TEST: ' + d.name, isE ? 40 : 44, 18, 'rust', { ammo: 40, rockets: 6 });
  B.fill(0, 16, 44, 2, 'C').fill(0, 0, 44, 1, '#').fill(0, 0, 1, 18, '#').fill(isE ? 39 : 43, 0, 1, 18, '#');
  B.at('spawn', 3, 16); B.at('ammo', 6, 16, { amount: 20 }); B.at('health', 8, 16, { amount: 50 });
  if (isE) {
    B.fill(16, 12, 4, 1, '=').fill(26, 10, 4, 1, '=');
    [22, 30, 35].forEach(x => d.ai === 'fly' ? B.obj('enemy', x * TS, 8 * TS, { def: tmpId, face: 'left' }) : B.at('enemy', x, 16, { def: tmpId, face: 'left' }));
    B.at('exit', 37, 16);
  } else {
    B.fill(12, 0, 1, 12, '#').fill(12, 12, 1, 4, 'D');
    B.obj('arena', 28 * TS, 8.5 * TS, { tw: 30, th: 15 });
    B.at('boss', 34, 16, { def: tmpId });
    B.fill(16, 12, 4, 1, '=').fill(36, 12, 4, 1, '=').fill(26, 9, 4, 1, '=');
    B.at('health', 17, 12, { amount: 40 }); B.at('ammo', 38, 12, { amount: 20 }); B.at('exit', 40, 16);
  }
  const L = B.done();
  if (isE) L.enemies[tmpId] = deep(MK.def); else { L.bosses[tmpId] = Object.assign(deep(MK.def), { mode: MK.mode }); L.enemies = {}; }
  hideAll();
  startPlay(L, { kind: 'maker' });
}
