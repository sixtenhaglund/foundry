// FOUNDRY - playing a level: update order, camera, HUD, dying, winning.
'use strict';

const G = { mode: 'menu', w: null, level: null, src: null, cp: null, cam: { x: 0, y: 0 }, paused: false, endT: 0, mouse: { x: 0, y: 0 } };

// src: { kind: 'campaign' | 'custom' | 'test' | 'maker', idx }
function startPlay(level, src) {
  G.level = cleanLevel(level); G.src = src || { kind: 'custom' }; G.cp = null; G.paused = false;
  resetWorld(); G.mode = 'play'; auInit(); ambStart();
}
function resetWorld() {
  const w = makeWorld(G.level);
  const s = G.cp || (G.src && G.src.from) || { x: w.spawn.x, y: w.spawn.y };
  w.player = makePlayer(w, s.x, s.y);
  w.cp = G.cp;
  if (G.cp) w.checkpoints.forEach(c => { if (c.id === G.cp.id) c.on = true; });
  G.w = w; G.endT = 0; bossMusic(false);
  snapCam(G.w);
}
function snapCam(w) { const P = w.player; G.cam.x = P.x - VW / 2; G.cam.y = P.y - VH / 2; clampCam(w, VW, VH); }
function clampCam(w, vw, vh) {
  G.cam.x = w.pw <= vw ? (w.pw - vw) / 2 : clamp(G.cam.x, 0, w.pw - vw);
  G.cam.y = w.ph <= vh ? (w.ph - vh) / 2 : clamp(G.cam.y, 0, w.ph - vh);
}

function updatePlay(dt, ctl) {
  const w = G.w; if (!w || G.paused) return;
  const P = w.player;
  w.time += dt;
  if (w.timeLeft > 0 && !w.won && !P.dead) {
    const before = Math.ceil(w.timeLeft);
    w.timeLeft -= dt;
    if (Math.ceil(w.timeLeft) !== before && w.timeLeft < 10) sfx('alarm');
    if (w.timeLeft <= 0) { w.timeLeft = 0.0001; killPlayer(w, 'TIME UP'); }
  }
  updateMovers(w, dt);
  updateHazards(w, dt);
  updatePlayer(w, dt, ctl);
  updateEnemies(w, dt);
  updateBoss(w, dt);
  updateBullets(w, dt);
  updateEffects(w, dt);
  updateParts(w, dt);
  for (const k of w.pickups) if (k.drop && !k.landed && !k.taken) {
    k.vy = Math.min((k.vy || -80) + 500 * dt, 250); k.y += k.vy * dt;
    if (k.vy > 0 && (blockedAt(w, k.x, k.y + 5, 'p') || solidBelow(w, k.x, k.y + 5))) { k.landed = true; k.y = Math.floor((k.y + 5) / TS) * TS - 5; }
    if (k.y > w.ph + 40) k.taken = true;
  }
  if (w.cp && w.cp !== G.cp) G.cp = w.cp;
  w.shake = Math.max(0, w.shake - dt * 20);
  w.hurtFlash = Math.max(0, (w.hurtFlash || 0) - dt);
  w.emptyFlash = Math.max(0, (w.emptyFlash || 0) - dt);
  w.lockedMsg = Math.max(0, (w.lockedMsg || 0) - dt);
  if (w.banner) { w.banner.life -= dt; if (w.banner.life <= 0) w.banner = null; }
  // camera: follow the player and look a bit toward the mouse
  if (!P.dead) {
    const tx = P.x + 5 - VW / 2 + clamp((ctl.aimX - (P.x + 5)) * 0.25, -70, 70);
    const ty = P.y + 10 - VH / 2 + clamp((ctl.aimY - (P.y + 10)) * 0.2, -45, 45);
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 6);
  }
  clampCam(w, VW, VH);
  if (P.dead || w.won) G.endT += dt;
}

// called when the player clicks / presses a key on the death or win screen
function endScreenAction(key) {
  const w = G.w; if (!w || G.endT < 0.7) return;
  if (w.player.dead) { if (w.deathCause === 'TIME UP') G.cp = null; resetWorld(); return; }
  if (w.won) finishLevel();
}

function drawPlay(ctx) {
  const w = G.w;
  const sh = w.shake > 0.5 ? { x: rand(-w.shake, w.shake) * 0.5, y: rand(-w.shake, w.shake) * 0.5 } : { x: 0, y: 0 };
  drawWorld(ctx, w, { x: G.cam.x + sh.x, y: G.cam.y + sh.y }, VW, VH);
  drawHud(ctx, w);
}

function bar(ctx, x, y, wd, h, f, col, back = '#1a1a1a') {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, wd + 2, h + 2); ctx.fillStyle = back; ctx.fillRect(x, y, wd, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(wd * clamp(f, 0, 1)), h);
}
function drawHud(ctx, w) {
  const P = w.player, t = w.time;
  if (w.hurtFlash > 0) { ctx.fillStyle = 'rgba(200,0,0,' + w.hurtFlash * 0.6 + ')'; ctx.fillRect(0, 0, VW, VH); }
  // health
  ptext(ctx, 'HP', 8, 8, '#ff8080');
  bar(ctx, 20, 8, 80, 5, P.hp / PL.maxHp, P.hp < 30 && (t * 4) % 1 < 0.5 ? '#ff6060' : '#e03838');
  // weapons
  const wcol = i => P.weapon === i ? '#ffffff' : '#7a7a7a';
  ctx.fillStyle = P.weapon === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)'; ctx.fillRect(6, 17, 46, 11);
  ctx.fillStyle = P.weapon === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)'; ctx.fillRect(56, 17, 46, 11);
  ctx.fillStyle = '#e8c050'; ctx.fillRect(9, 20, 2, 5); ctx.fillRect(12, 20, 2, 5);
  ptext(ctx, '1 ' + P.ammo, 18, 20, P.ammo === 0 ? '#ff5050' : wcol(0));
  ctx.fillStyle = '#c8ccc8'; ctx.fillRect(59, 21, 6, 3); ctx.fillStyle = '#ff9040'; ctx.fillRect(65, 21, 2, 3);
  ptext(ctx, '2 ' + P.rockets, 70, 20, P.rockets === 0 ? '#a05050' : wcol(1));
  if (w.emptyFlash > 0) ptext(ctx, 'OUT OF ' + (P.weapon ? 'ROCKETS' : 'AMMO') + '!', 8, 32, '#ff5050');
  if (P.air < 10) { ptext(ctx, 'AIR', 8, 42, '#80c0ff'); bar(ctx, 24, 42, 50, 4, P.air / 10, P.air < 3 ? '#ff6060' : '#60b0ff'); }
  // timer
  if (w.L.time > 0) {
    const s = Math.max(0, Math.ceil(w.timeLeft)), str = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    ptext(ctx, str, VW / 2, 6, s <= 10 && (t * 4) % 1 < 0.5 ? '#ff4040' : s <= 10 ? '#ffa040' : '#ffffff', 2, 'c');
  }
  ptext(ctx, G.level.name, VW - 6, 6, '#8a8a8a', 1, 'r');
  // boss bar
  const b = w.boss;
  if (b && b.active && !b.dead) {
    const bw = 260, x = VW / 2 - bw / 2, y = VH - 18;
    ptext(ctx, b.d.name, VW / 2, y - 9, '#ffb0a0', 1, 'c');
    bar(ctx, x, y, bw, 6, b.hp / b.maxHp, '#d83030', '#3a1010');
    for (const p of b.d.phases.slice(1)) { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x + bw * p.at), y, 1, 6); }
  }
  // banner
  if (w.banner) {
    const a = clamp(w.banner.life * 2, 0, 1); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, VW, 44);
    ptext(ctx, w.banner.sub, VW / 2, 76, '#ff8060', 1, 'c'); ptext(ctx, w.banner.text, VW / 2, 88, '#ffffff', 3, 'c');
    ctx.globalAlpha = 1;
  }
  if (w.signText) {
    const lines = wrapText(w.signText, 60);
    const h = lines.length * 8 + 10, y = VH - 40 - h;
    ctx.fillStyle = 'rgba(10,20,30,0.85)'; ctx.fillRect(VW / 2 - 130, y, 260, h); ctx.fillStyle = '#60d0ff'; ctx.fillRect(VW / 2 - 130, y, 260, 1);
    lines.forEach((l, i) => ptext(ctx, l, VW / 2, y + 6 + i * 8, '#d0f0ff', 1, 'c'));
  }
  if (w.lockedMsg > 0) ptext(ctx, 'DEFEAT THE BOSS TO OPEN THE EXIT', VW / 2, VH / 2 - 40, '#ff6060', 1, 'c');
  // crosshair
  if (!P.dead && !w.won) {
    const mx = Math.round(G.mouse.x), my = Math.round(G.mouse.y);
    ctx.fillStyle = '#000'; ctx.fillRect(mx - 4, my - 1, 9, 3); ctx.fillRect(mx - 1, my - 4, 3, 9);
    ctx.fillStyle = P.weapon ? '#ff9040' : '#ffffff'; ctx.fillRect(mx - 3, my, 2, 1); ctx.fillRect(mx + 2, my, 2, 1); ctx.fillRect(mx, my - 3, 1, 2); ctx.fillRect(mx, my + 2, 1, 2);
  }
  // death / win
  if (P.dead && P.deadT > 0.6) {
    ctx.fillStyle = 'rgba(40,0,0,' + Math.min(0.7, (P.deadT - 0.6) * 1.5) + ')'; ctx.fillRect(0, 0, VW, VH);
    ptext(ctx, w.deathCause === 'TIME UP' ? 'TIME UP' : 'YOU DIED', VW / 2, VH / 2 - 30, '#ff4040', 4, 'c');
    if (w.deathCause !== 'TIME UP') ptext(ctx, w.deathCause, VW / 2, VH / 2 + 2, '#ffb0a0', 1, 'c');
    if (G.endT > 0.7) ptext(ctx, 'CLICK OR PRESS R TO TRY AGAIN' + (G.cp && w.deathCause !== 'TIME UP' ? ' (FROM CHECKPOINT)' : ''), VW / 2, VH / 2 + 20, (t * 2) % 1 < 0.7 ? '#ffffff' : '#a0a0a0', 1, 'c');
  }
  if (w.won) {
    ctx.fillStyle = 'rgba(0,20,10,' + Math.min(0.75, G.endT * 1.5) + ')'; ctx.fillRect(0, 0, VW, VH);
    ptext(ctx, 'ESCAPED!', VW / 2, VH / 2 - 40, '#60ff90', 4, 'c');
    const s = Math.floor(w.time);
    ptext(ctx, 'TIME ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '    KILLS ' + w.kills + '    AMMO LEFT ' + P.ammo, VW / 2, VH / 2, '#d0ffe0', 1, 'c');
    if (G.endT > 0.7) ptext(ctx, G.src.kind === 'campaign' ? 'CLICK TO CONTINUE' : 'CLICK TO GO BACK', VW / 2, VH / 2 + 20, (t * 2) % 1 < 0.7 ? '#ffffff' : '#a0a0a0', 1, 'c');
  }
}
function wrapText(s, n) {
  const out = []; let line = '';
  for (const word of String(s).toUpperCase().split(/\s+/)) {
    if ((line + ' ' + word).trim().length > n) { out.push(line.trim()); line = word; } else line += ' ' + word;
  }
  if (line.trim()) out.push(line.trim());
  return out.length ? out : [''];
}
