// FOUNDRY - bullets, rockets, explosions, particles, and boss/enemy temporary effects.
'use strict';

function spawnParts(w, x, y, n, col, spd = 60, life = 0.5, grav = 200, size = 1) {
  if (w.parts.length > 900) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random() * 0.7);
    w.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life, col, grav, size });
  }
}
function floatText(w, x, y, text, col) { w.texts.push({ x, y, text, col, life: 1.2 }); }

// everything a player's bullet/explosion can hurt
function hitTargets(w) {
  const out = [];
  for (const e of w.enemies) if (!e.dead && !e.still) out.push({ kind: 'e', o: e, r: e });
  if (w.boss && !w.boss.dead && !w.boss.dying) out.push({ kind: 'b', o: w.boss, r: w.boss });
  for (const t of w.turrets) if (!t.ceil && t.hp > 0 && !t.dead) out.push({ kind: 't', o: t, r: { x: t.x - 7, y: t.y - 7, w: 14, h: 14 } });
  return out;
}
function damageTarget(w, T, dmg, fromX, blast) {
  if (T.kind === 'e') return damageEnemy(w, T.o, dmg, fromX, blast);
  if (T.kind === 'b') return damageBoss(w, T.o, dmg);
  if (T.kind === 't') {
    const t = T.o; t.hpNow -= dmg; t.flash = 0.1; sfx('ehurt');
    if (t.hpNow <= 0) { t.dead = true; boomFx(w, t.x, t.y, 0.6); w.kills++; }
    return 'hit';
  }
}

function updateBullets(w, dt) {
  const P = w.player;
  for (const b of w.bullets) {
    b.life -= dt; if (b.life <= 0) { b.dead = true; continue; }
    const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
    for (let s = 0; s < steps && !b.dead; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (blockedAt(w, b.x, b.y, 'b')) { b.dead = true; spawnParts(w, b.x - b.vx * 0.005, b.y - b.vy * 0.005, 3, '#ffd080', 50, 0.2, 100); break; }
      if (b.owner === 'p') {
        for (const T of hitTargets(w)) {
          const R = T.r;
          if (b.x >= R.x && b.x <= R.x + R.w && b.y >= R.y && b.y <= R.y + R.h) {
            const res = damageTarget(w, T, b.dmg, b.x - b.vx * 0.02, false);
            if (res === 'blocked') { b.vx = -b.vx * 0.5; b.vy = -b.vy * 0.3 - 60; b.owner = 'x'; b.life = 0.3; }
            else b.dead = true;
            break;
          }
        }
      } else if (b.owner === 'e' && P && !P.dead) {
        if (b.x >= P.x && b.x <= P.x + P.w && b.y >= P.y && b.y <= P.y + P.h) { b.dead = true; hurtPlayer(w, b.dmg, b.x - b.vx, 0.6, b.cause || 'SHOT'); }
      }
    }
  }
  w.bullets = w.bullets.filter(b => !b.dead);

  for (const r of w.rockets) {
    r.life -= dt;
    if (r.home && P && !P.dead) { const want = Math.atan2(P.y + 10 - r.y, P.x + 5 - r.x); r.a += clamp(angDiff(r.a, want), -r.home * dt, r.home * dt); }
    r.sp = Math.min(r.sp + 500 * dt, r.max || 380);
    r.vx = Math.cos(r.a) * r.sp; r.vy = Math.sin(r.a) * r.sp;
    const steps = Math.ceil(r.sp * dt / 4);
    let hit = r.life <= 0;
    for (let s = 0; s < steps && !hit; s++) {
      r.x += r.vx * dt / steps; r.y += r.vy * dt / steps;
      if (blockedAt(w, r.x, r.y, 'r') || r.x < 0 || r.x > w.pw || r.y > w.ph + 50) { hit = true; break; }
      if (r.owner === 'p') { for (const T of hitTargets(w)) if (r.x >= T.r.x && r.x <= T.r.x + T.r.w && r.y >= T.r.y && r.y <= T.r.y + T.r.h) { hit = true; break; } }
      else if (P && !P.dead && r.x >= P.x - 2 && r.x <= P.x + P.w + 2 && r.y >= P.y - 2 && r.y <= P.y + P.h + 2) hit = true;
    }
    if (Math.random() < 0.8) w.parts.push({ x: r.x - r.vx * 0.02, y: r.y - r.vy * 0.02, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.4, max: 0.4, col: Math.random() < 0.5 ? '#ffa040' : '#808080', grav: -20, size: 1 });
    if (hit) { r.dead = true; explode(w, r.x, r.y, 34, r.dmg, r.owner); }
  }
  w.rockets = w.rockets.filter(r => !r.dead);
}

function boomFx(w, x, y, big = 1) {
  w.booms.push({ x, y, r: 0, max: 30 * big, life: 0.35 });
  spawnParts(w, x, y, Math.round(20 * big), '#ffb040', 140 * big, 0.6, 50);
  spawnParts(w, x, y, Math.round(10 * big), '#606060', 80 * big, 1, -30, 2);
  w.shake = Math.max(w.shake, 6 * big); sfx('boom');
}
function explode(w, x, y, rad, dmg, owner) {
  boomFx(w, x, y, rad / 34);
  const P = w.player;
  if (P && !P.dead) {
    const d = dist(x, y, P.x + 5, P.y + 10);
    if (d < rad + 6) {
      if (owner === 'p') { const a = Math.atan2(P.y + 10 - y, P.x + 5 - x); P.vx += Math.cos(a) * 260; P.vy = Math.min(P.vy, Math.sin(a) * 340); } // rocket jump!
      else hurtPlayer(w, Math.round(dmg * (1 - d / (rad + 6) * 0.5)), x, 1.3, 'BLOWN UP');
    }
  }
  if (owner === 'p') for (const T of hitTargets(w)) {
    const R = T.r, d = dist(x, y, clamp(x, R.x, R.x + R.w), clamp(y, R.y, R.y + R.h));
    if (d < rad) damageTarget(w, T, Math.round(dmg * (1 - d / rad * 0.5)), x, true);
  }
  // explosions also hurt enemies when an enemy fired it (friendly fire is funny)
  if (owner === 'e') for (const e of w.enemies) if (!e.dead && dist(x, y, e.x + e.w / 2, e.y + e.h / 2) < rad * 0.6) damageEnemy(w, e, dmg * 0.5, x, true);
  for (const m of (w.mines || [])) if (!m.dead && dist(x, y, m.x, m.y) < rad) m.t = Math.max(m.t, m.fuse - 0.1);
}

function updateParts(w, dt) {
  for (const p of w.parts) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; }
  w.parts = w.parts.filter(p => p.life > 0);
  for (const b of w.booms) { b.life -= dt; b.r = b.max * (1 - b.life / 0.35); }
  w.booms = w.booms.filter(b => b.life > 0);
  for (const t of w.texts) { t.life -= dt; t.y -= 18 * dt; }
  w.texts = w.texts.filter(t => t.life > 0);
  for (const b of (w.beams || [])) b.life -= dt;
  if (w.beams) w.beams = w.beams.filter(b => b.life > 0);
}

// ---- temporary attack things (shockwaves, lightning, mines, rolling saws) ----
function updateEffects(w, dt) {
  const P = w.player, alive = P && !P.dead;
  w.shocks = (w.shocks || []).filter(s => {
    s.x += s.vx * dt; s.life -= dt;
    if (blockedAt(w, s.x + Math.sign(s.vx) * 6, s.y - 4, 'p') || !solidBelow(w, s.x, s.y + 2)) return false;
    if (alive && Math.abs(P.x + 5 - s.x) < 8 && P.y + P.h > s.y - 14 && P.y + P.h <= s.y + 2) hurtPlayer(w, s.dmg, s.x, 1, 'SHOCKWAVE');
    if (Math.random() < 0.6) spawnParts(w, s.x, s.y - 2, 1, '#ffd080', 40, 0.3, -40);
    return s.life > 0;
  });
  w.strikes = (w.strikes || []).filter(s => {
    s.t += dt;
    if (s.t >= s.warn && !s.done) {
      s.done = true; sfx('zap'); w.shake = Math.max(w.shake, 3);
      if (alive && Math.abs(P.x + 5 - s.x) < 10 && P.y + P.h > s.y0 && P.y < s.y1) hurtPlayer(w, s.dmg, s.x, 1, 'ELECTROCUTED');
    }
    return s.t < s.warn + 0.3;
  });
  w.mines = (w.mines || []).filter(m => {
    if (!m.landed) {
      m.vy = Math.min(m.vy + 600 * dt, 300); m.y += m.vy * dt; m.x += m.vx * dt;
      if (blockedAt(w, m.x, m.y + 3, 'p') || solidBelow(w, m.x, m.y + 3)) { m.landed = true; m.y = Math.floor((m.y + 3) / TS) * TS - 3; }
    } else {
      m.t += dt;
      if (alive && dist(m.x, m.y, P.x + 5, P.y + 10) < 26 && m.t < m.fuse - 0.4) m.t = m.fuse - 0.4;
    }
    if (m.t >= m.fuse) { explode(w, m.x, m.y, 32, m.dmg, 'e'); return false; }
    return m.y < w.ph + 50;
  });
}
