// FOUNDRY - hazards: crushers, saws, turrets, ceiling turrets, electric coils, lasers.
'use strict';

// crusher timeline inside one period: rest -> (warning) -> SLAM -> hold -> pull back
function crusherExt(c, t) {
  const slam = 0.12, back = 0.7, hold = c.hold || 0;
  const per = Math.max(c.period, slam + back + hold + 0.1);
  t = ((t - (c.delay || 0)) % per + per) % per;
  const rest = per - slam - hold - back;
  if (t < rest) return { ext: 0, warn: t > rest - 0.45, phase: 0 };
  t -= rest; if (t < slam) return { ext: EASE['ease in'](t / slam), phase: 1 };
  t -= slam; if (t < hold) return { ext: 1, phase: 2 };
  t -= hold; return { ext: 1 - t / back, phase: 3 };
}
const LASER_COLS = { red: ['#ff3030', '#ffb0a0'], green: ['#30ff60', '#c0ffc0'], blue: ['#3080ff', '#b0d0ff'], purple: ['#c040ff', '#e8b0ff'] };

function updateHazards(w, dt) {
  const P = w.player, alive = P && !P.dead;
  const PR = alive ? { x: P.x, y: P.y, w: P.w, h: P.h } : null;
  const pcx = alive ? P.x + 5 : 0, pcy = alive ? P.y + 10 : 0;

  for (const c of w.crushers) {
    const s = crusherExt(c, w.time), prev = c.ext;
    c.ext = s.ext; c.warn = s.warn; c.phase = s.phase;
    if (prev < 1 && c.ext >= 1) {
      sfx('crush'); const r = crusherRect(c);
      if (alive && dist(pcx, pcy, r.x + r.w / 2, r.y + r.h / 2) < 260) w.shake = Math.max(w.shake, 3);
      spawnParts(w, r.x + r.w / 2, r.y + r.h / 2, 6, '#a0a0a0', 60, 0.4, 100);
    }
    if (c.phase === 1 || c.phase === 2) {
      const r = crusherRect(c);
      if (PR && rectsHit(PR, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 })) { killPlayer(w, 'CRUSHED'); w.shake = 10; }
      for (const e of w.enemies) if (!e.dead && !e.still && rectsHit(e, r)) damageEnemy(w, e, 9999, null, true);
    }
  }

  for (const s of w.saws) {
    s.rot += dt * 14;
    if (s.temp) {   // rolling saws from bosses
      s.vy = Math.min((s.vy || 0) + 700 * dt, 400); s.y += s.vy * dt;
      if (blockedAt(w, s.x, s.y + s.r, 'p') || solidBelow(w, s.x, s.y + s.r)) { s.y = Math.floor((s.y + s.r) / TS) * TS - s.r; s.vy = 0; }
      s.x += s.vx * dt; s.life -= dt;
      if (blockedAt(w, s.x + Math.sign(s.vx) * (s.r + 1), s.y, 'p') || s.life <= 0) { s.dead = true; spawnParts(w, s.x, s.y, 10, '#c0c0c0', 100, 0.5, 300); }
      if (Math.random() < 0.5) spawnParts(w, s.x, s.y + s.r, 1, '#ffd080', 60, 0.25, 200);
    }
    if (PR && circRect(s.x, s.y, s.r - 2, PR)) hurtPlayer(w, s.dmg || 40, s.x, 1.2, 'SAWED');
    for (const e of w.enemies) if (!e.dead && !e.still && circRect(s.x, s.y, s.r - 2, e)) damageEnemy(w, e, 60 * dt * 10, s.x, true);
  }
  w.saws = w.saws.filter(s => !s.dead);

  for (const t of w.turrets) {
    t.flash = Math.max(0, (t.flash || 0) - dt);
    if (t.dead) continue;
    t.cd -= dt;
    const bs = 280;
    if (t.ceil) {
      // can't be killed: tracks you and fires bursts
      const seen = alive && dist(t.x, t.y, pcx, pcy) < t.range && lineClear(w, t.x, t.y + 6, pcx, pcy);
      if (seen) { const want = Math.atan2(pcy - t.y, pcx - t.x); t.aim += clamp(angDiff(t.aim, want), -3 * dt, 3 * dt); }
      t.tele = seen && t.cd < 0.35;
      if (t.burst > 0) {
        t.bt -= dt;
        if (t.bt <= 0) { t.burst--; t.bt = 0.09; fireBullet(w, t.x + Math.cos(t.aim) * 8, t.y + 4 + Math.sin(t.aim) * 8, t.aim, bs + 40, t.dmg, 0.05, 'CEILING TURRET'); }
      } else if (seen && t.cd <= 0) { t.burst = 3; t.bt = 0; t.cd = 1 / t.rate; }
      continue;
    }
    const base = t.angle * Math.PI / 180;
    if (t.mode === 'when crossed') {
      t.aim = base;
      const end = raycast(w, t.x, t.y, base, t.range, 'b'); t.ex = end.x; t.ey = end.y;
      t.tripped = PR && segRect(t.x, t.y, end.x, end.y, PR);
      if (t.tripped && t.cd <= 0) { t.cd = 1 / t.rate; fireBullet(w, t.x + Math.cos(base) * 8, t.y + Math.sin(base) * 8, base, bs, t.dmg, 0.02, 'TURRET'); }
    } else if (t.mode === 'randomly') {
      if (t.cd <= 0) { t.cd = (1 / t.rate) * rand(0.5, 1.5); t.aim = base + rand(-1, 1); if (!alive || dist(t.x, t.y, pcx, pcy) < t.range * 1.6) fireBullet(w, t.x + Math.cos(t.aim) * 8, t.y + Math.sin(t.aim) * 8, t.aim, bs, t.dmg, 0, 'TURRET'); }
    } else {
      const seen = alive && dist(t.x, t.y, pcx, pcy) < t.range && lineClear(w, t.x, t.y, pcx, pcy);
      if (seen) {
        const want = Math.atan2(pcy - t.y, pcx - t.x); t.aim += clamp(angDiff(t.aim, want), -2.5 * dt, 2.5 * dt);
        if (t.cd <= 0 && Math.abs(angDiff(t.aim, want)) < 0.2) { t.cd = 1 / t.rate; fireBullet(w, t.x + Math.cos(t.aim) * 8, t.y + Math.sin(t.aim) * 8, t.aim, bs, t.dmg, 0.04, 'TURRET'); }
      }
    }
  }

  for (const c of w.coils) {
    const per = Math.max(c.period, c.on + 0.1);
    const t = ((w.time - (c.delay || 0)) % per + per) % per;
    const was = c.state;
    c.state = t < c.on ? 2 : t > per - 0.4 ? 1 : 0;   // 0 idle, 1 charging, 2 arcing
    if (c.state === 2 && was !== 2) { c.hitDone = false; sfx('zap'); }
    if (c.state === 2) {
      c.boltT = (c.boltT || 0) - dt;
      if (c.boltT <= 0) { c.boltT = 0.05; makeBolts(w, c); }
      const tx = c.x, ty = c.y - 8;
      if (PR && !c.hitDone) {
        const near = dist(tx, ty, pcx, pcy) < c.range && lineClear(w, tx, ty, pcx, pcy, 'l');
        const chain = (c.links || []).some(o => segDist(pcx, pcy, tx, ty, o.x, o.y - 8) < 8);
        if (near || chain) { c.hitDone = true; hurtPlayer(w, c.dmg, tx, 1, 'ELECTROCUTED'); }
      }
      for (const e of w.enemies) if (!e.dead && !e.still && dist(tx, ty, e.x + e.w / 2, e.y + e.h / 2) < c.range) damageEnemy(w, e, 40 * dt, tx, true);
    } else c.bolts = null;
  }

  for (const L of w.lasers) {
    if (L.turn) L.ang += L.turn * Math.PI / 180 * dt;
    if (L.on > 0) {
      const cyc = L.on + Math.max(0.05, L.off), t = ((w.time - (L.delay || 0)) % cyc + cyc) % cyc;
      L.onNow = t < L.on; L.warnNow = !L.onNow && t > cyc - 0.45;
    } else { L.onNow = true; L.warnNow = false; }
    const end = raycast(w, L.x, L.y, L.ang, L.len, 'l'); L.ex = end.x; L.ey = end.y; L.hitWall = end.hit;
    if (L.onNow) {
      if (PR && segRect(L.x, L.y, L.ex, L.ey, PR)) burnPlayer(w, L.dps * dt, 'LASERED');
      for (const e of w.enemies) if (!e.dead && !e.still && segRect(L.x, L.y, L.ex, L.ey, e)) damageEnemy(w, e, L.dps * dt * 0.5, null, true);
      if (end.hit && Math.random() < 0.4) spawnParts(w, end.x, end.y, 1, LASER_COLS[L.color]?.[1] || '#fff', 60, 0.25, 100);
    }
  }
}

function fireBullet(w, x, y, a, sp, dmg, spread, cause) {
  a += rand(-spread, spread);
  w.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, owner: 'e', dmg, life: 2.5, col: '#ff6040', cause });
  sfx('eshoot');
}

// zig-zag lightning from a coil to its targets / nearby walls / linked coils
function makeBolts(w, c) {
  const sx = c.x, sy = c.y - 8, P = w.player;
  const targets = [];
  c.links = w.coils.filter(o => o !== c && o.state === 2 && dist(o.x, o.y, c.x, c.y) < c.range * 2 + 8 && lineClear(w, sx, sy, o.x, o.y - 8, 'l'));
  for (const o of c.links) targets.push([o.x, o.y - 8]);
  if (P && !P.dead && dist(sx, sy, P.x + 5, P.y + 10) < c.range && lineClear(w, sx, sy, P.x + 5, P.y + 10, 'l')) targets.push([P.x + 5, P.y + 10]);
  for (const e of w.enemies) if (!e.dead && !e.still && dist(sx, sy, e.x + e.w / 2, e.y + e.h / 2) < c.range) targets.push([e.x + e.w / 2, e.y + e.h / 2]);
  while (targets.length < 3) { const r = raycast(w, sx, sy, rand(0, Math.PI * 2), c.range, 'l'); targets.push([r.x, r.y]); }
  c.bolts = targets.map(([tx, ty]) => {
    const pts = [[sx, sy]], n = Math.max(3, Math.round(dist(sx, sy, tx, ty) / 10));
    for (let i = 1; i < n; i++) pts.push([lerp(sx, tx, i / n) + rand(-5, 5), lerp(sy, ty, i / n) + rand(-5, 5)]);
    pts.push([tx, ty]); return pts;
  });
}
