// FOUNDRY - procedural animation: legs + arms worked out with math every frame,
// swinging chains and lamps, waves on water and lava, flying debris, dust in the air.
'use strict';

// ---------------------------------------------------------------------------------
// setup when a world is built
function initAnim(w) {
  // liquid surfaces: one spring per 2 pixels, so waves can travel along the top
  w.liquids = [];
  for (let y = 0; y < w.H; y++) {
    let x = 0;
    while (x < w.W) {
      const ch = w.fg[y][x];
      if (TILES[ch]?.liquid && !TILES[tileAt(w, x, y - 1)]?.liquid) {
        const lava = !!TILES[ch].lava; let x2 = x;
        while (x2 + 1 < w.W && w.fg[y][x2 + 1] === ch && !TILES[tileAt(w, x2 + 1, y - 1)]?.liquid) x2++;
        const n = ((x2 - x + 1) * TS) / 2 + 1;
        w.liquids.push({ x0: x * TS, x1: (x2 + 1) * TS, y: y * TS, lava, h: new Float32Array(n), v: new Float32Array(n) });
        x = x2 + 1;
      } else x++;
    }
  }
  for (const d of w.decos) {
    d.ang = 0; d.av = 0;
    if (d.kind === 'chain') d.rope = makeRope(d.x, d.y - 16, d.x, d.y + 16, 9, 1);
    if (d.kind === 'cables') d.ropes = [makeRope(d.x - 16, d.y - 4, d.x + 16, d.y - 4, 10, 1.12), makeRope(d.x - 16, d.y - 1, d.x + 16, d.y - 1, 10, 1.25)];
    if (d.kind === 'sparks') { d.rope = makeRope(d.x, d.y - 12, d.x, d.y + 12, 7, 1); d.rope.pinB = false; d.sparkT = 0; }
    if (d.kind === 'lamp') d.flicker = h2(Math.round(d.x), Math.round(d.y), 5) < 0.22;
  }
}

// ---------------------------------------------------------------------------------
// ropes (Verlet: each point remembers where it was, and the difference is its speed)
function makeRope(ax, ay, bx, by, n, slack) {
  const pts = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push({ x: lerp(ax, bx, t), y: lerp(ay, by, t), px: lerp(ax, bx, t), py: lerp(ay, by, t) }); }
  const seg = Math.hypot(bx - ax, by - ay) / (n - 1) * slack;
  return { pts, seg, pinA: true, pinB: Math.abs(bx - ax) > 1, ax, ay, bx, by };
}
function updateRope(w, R, dt) {
  const P = R.pts, g = 500 * dt * dt;
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if ((i === 0 && R.pinA) || (i === P.length - 1 && R.pinB)) continue;
    const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
    p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g;
    // bodies push the rope
    for (const b of ropePushers(w)) {
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
      if (d < b.r && d > 0.01) { p.x += dx / d * (b.r - d) * 0.6 + b.vx * dt * 0.5; p.y += dy / d * (b.r - d) * 0.6; }
    }
  }
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, diff = (d - R.seg) / d;
      const fa = (i === 0 && R.pinA) ? 0 : (i + 1 === P.length - 1 && R.pinB) ? 1 : 0.5, fb = 1 - fa;
      a.x += dx * diff * fa; a.y += dy * diff * fa; b.x -= dx * diff * fb; b.y -= dy * diff * fb;
    }
    P[0].x = R.ax; P[0].y = R.ay; if (R.pinB) { P[P.length - 1].x = R.bx; P[P.length - 1].y = R.by; }
  }
}
function ropePushers(w) {
  if (w._pushT === w.time) return w._push;
  const out = [];
  const P = w.player; if (P && !P.dead) out.push({ x: P.x + 5, y: P.y + 10, r: 9, vx: P.vx });
  for (const e of w.enemies) if (!e.dead) out.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: Math.max(e.w, e.h) / 2 + 2, vx: e.vx });
  w._pushT = w.time; w._push = out; return out;
}
function kickRopes(w, x, y, force) {
  for (const d of w.decos) {
    for (const R of (d.rope ? [d.rope] : d.ropes || [])) for (const p of R.pts) {
      const dd = dist(x, y, p.x, p.y); if (dd < 90) { const a = Math.atan2(p.y - y, p.x - x), f = force * (1 - dd / 90) / 60; p.px -= Math.cos(a) * f; p.py -= Math.sin(a) * f; }
    }
    if ((d.kind === 'lamp' || d.kind === 'cage lamp') && dist(x, y, d.x, d.y) < 120) d.av += Math.sign(d.x - x || 1) * force * 0.02 * (1 - dist(x, y, d.x, d.y) / 120);
  }
}

// ---------------------------------------------------------------------------------
// liquids
function splash(w, x, y, force) {
  for (const L of w.liquids || []) {
    if (x < L.x0 || x > L.x1 || Math.abs(y - L.y) > 14) continue;
    const i = Math.round((x - L.x0) / 2);
    for (let k = -2; k <= 2; k++) if (L.v[i + k] != null) L.v[i + k] += force * (1 - Math.abs(k) * 0.3);
    if (Math.abs(force) > 40) spawnParts(w, x, L.y, Math.min(14, Math.abs(force) / 12), L.lava ? '#ffb040' : '#a0d0ff', 70, 0.6, 400);
  }
}
function updateLiquids(w, dt) {
  for (const L of w.liquids) {
    const n = L.h.length, k = L.lava ? 30 : 70, damp = L.lava ? 5 : 3.2;
    for (let i = 0; i < n; i++) { L.v[i] += (-k * L.h[i] - damp * L.v[i]) * dt; L.h[i] += L.v[i] * dt; }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
      if (i > 0) L.v[i - 1] += (L.h[i] - L.h[i - 1]) * 18 * dt;
      if (i < n - 1) L.v[i + 1] += (L.h[i] - L.h[i + 1]) * 18 * dt;
    }
    if (Math.random() < dt * (L.lava ? 6 : 1.5) * n / 40) {
      const i = randi(0, n - 1); L.v[i] += L.lava ? rand(-25, -10) : rand(-6, 6);
      if (L.lava && Math.random() < 0.5) { const x = L.x0 + i * 2; w.parts.push({ x, y: L.y - 1, vx: rand(-15, 15), vy: rand(-90, -40), life: 0.7, max: 0.7, col: Math.random() < 0.5 ? '#ffd060' : '#ff6020', grav: 250, size: 1 }); }
    }
  }
}
function liquidH(L, x) { const i = clamp(Math.round((x - L.x0) / 2), 0, L.h.length - 1); return L.h[i]; }
function drawLiquids(ctx, w, cam, vw, vh) {
  const t = w.time;
  // body of the liquid, tile by tile
  const x0 = Math.max(0, Math.floor(cam.x / TS)), x1 = Math.min(w.W - 1, Math.floor((cam.x + vw) / TS));
  const y0 = Math.max(0, Math.floor(cam.y / TS)), y1 = Math.min(w.H - 1, Math.floor((cam.y + vh) / TS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const T = TILES[w.fg[y][x]]; if (!T || !T.liquid) continue;
    if (!TILES[tileAt(w, x, y - 1)]?.liquid) continue;   // surface tiles are drawn with their waves below
    if (T.lava) { const g = 0.5 + 0.5 * Math.sin(x * 1.7 + y * 2.3 + t * 1.5); ctx.fillStyle = `rgb(${200 + g * 40 | 0},${60 + g * 30 | 0},16)`; ctx.fillRect(x * TS, y * TS, TS, TS); ctx.fillStyle = 'rgba(80,10,0,0.35)'; if ((x * 7 + y * 3) % 5 === 0) ctx.fillRect(x * TS + 3, y * TS + 5, 7, 3); }
    else { ctx.fillStyle = 'rgba(30,90,150,0.5)'; ctx.fillRect(x * TS, y * TS, TS, TS); }
  }
  for (const L of w.liquids) {
    if (L.x1 < cam.x || L.x0 > cam.x + vw || L.y > cam.y + vh + 4 || L.y + TS < cam.y) continue;
    for (let i = 0; i < L.h.length - 1; i++) {
      const x = L.x0 + i * 2, top = Math.round(L.y + clamp(L.h[i], -8, 8));
      if (L.lava) {
        const g = 0.5 + 0.5 * Math.sin(x * 0.15 + t * 2);
        ctx.fillStyle = `rgb(${215 + g * 30 | 0},${70 + g * 40 | 0},18)`; ctx.fillRect(x, top, 2, L.y + TS - top);
        ctx.fillStyle = '#ffe080'; ctx.fillRect(x, top, 2, 1); ctx.fillStyle = '#ffb040'; ctx.fillRect(x, top + 1, 2, 1);
        if (Math.sin(x * 0.07 + t * 0.6) > 0.6) { ctx.fillStyle = 'rgba(70,10,0,0.55)'; ctx.fillRect(x, top + 2, 2, 2); }
      } else {
        ctx.fillStyle = 'rgba(30,90,150,0.5)'; ctx.fillRect(x, top, 2, L.y + TS - top);
        ctx.fillStyle = 'rgba(170,220,255,0.75)'; ctx.fillRect(x, top, 2, 1);
        if (Math.sin(x * 0.3 + t * 2) > 0.85) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, top + 2, 2, 1); }
      }
    }
  }
}

// ---------------------------------------------------------------------------------
// debris: broken pieces that fly, spin and bounce
function addDebris(w, x, y, len, thick, col, vx, vy) {
  if (w.debris.length > 220) w.debris.shift();
  w.debris.push({ x, y, vx: vx + rand(-60, 60), vy: vy + rand(-160, -60), a: rand(0, 6.28), va: rand(-12, 12), len, thick, col, life: rand(3, 5) });
}
function updateDebris(w, dt) {
  for (const d of w.debris) {
    d.life -= dt; d.vy = Math.min(d.vy + 700 * dt, 500);
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (blockedAt(w, nx, ny + 1, 'p') || (d.vy > 0 && TILES[tileUnder(w, nx, ny + 1)]?.oneway)) { d.vy *= -0.3; d.vx *= 0.6; d.va *= 0.5; if (Math.abs(d.vy) < 30) d.vy = 0; }
    else d.y = ny;
    if (blockedAt(w, nx + Math.sign(d.vx) * 2, d.y, 'p')) d.vx *= -0.4; else d.x = nx;
    d.a += d.va * dt;
    if (TILES[tileUnder(w, d.x, d.y)]?.lava) d.life = Math.min(d.life, 0.3);
  }
  w.debris = w.debris.filter(d => d.life > 0);
}
function drawDebris(ctx, w) {
  for (const d of w.debris) {
    ctx.globalAlpha = clamp(d.life, 0, 1); ctx.fillStyle = d.col;
    const c = Math.cos(d.a) * d.len / 2, s = Math.sin(d.a) * d.len / 2;
    pline(ctx, d.x - c, d.y - s, d.x + c, d.y + s, d.thick);
  }
  ctx.globalAlpha = 1;
}
function shatterEnemy(w, e) {
  const d = e.d, s = d.size || 1, cx = e.x + e.w / 2, cy = e.y + e.h / 2, vx = e.vx * 0.5;
  const dark = shade(d.color, -0.35), metal = d.body === 'robot' || d.body === 'drone';
  if (d.body === 'crawler') { for (let i = 0; i < 6; i++) addDebris(w, cx, cy, 5 * s, 1, dark, vx, 0); addDebris(w, cx, cy, 8 * s, 3, d.color, vx, -40); }
  else if (d.body === 'drone') { addDebris(w, cx, cy, 10 * s, 4, d.color, vx, -40); addDebris(w, cx, cy - 4, 12 * s, 1, '#9aa4b0', vx, -80); addDebris(w, cx, cy + 3, 6 * s, 2, '#1e2226', vx, 0); }
  else {
    addDebris(w, cx, e.y + 3 * s, 4 * s, Math.round(4 * s), d.body === 'robot' ? dark : d.accent, vx, -120);   // head / helmet
    addDebris(w, cx, cy, 7 * s, Math.round(4 * s), d.color, vx, -60);                                        // torso
    for (let i = 0; i < 2; i++) { addDebris(w, cx, cy + 4, 8 * s, 2, d.body === 'robot' ? d.accent : shade(d.accent, 0.1), vx, -40); addDebris(w, cx, cy - 2, 6 * s, 2, d.color, vx, -80); }
    if (d.weapon !== 'none') addDebris(w, cx, cy, 8, 2, '#1e2226', vx, -100);
  }
  if (metal) { spawnParts(w, cx, cy, 12, '#ffd060', 160, 0.5, 300); spawnParts(w, cx, cy, 6, '#505050', 40, 1.4, -40, 2); }
}

// ---------------------------------------------------------------------------------
// dust floating in the air (only around the camera)
function updateDust(w, cam, dt) {
  if (w.dust.length < 46) w.dust.push({ x: cam.x + rand(0, VW), y: cam.y + rand(0, VH), vx: rand(-4, 4), vy: rand(-3, 3), ph: rand(0, 6) });
  for (const d of w.dust) {
    d.ph += dt; d.x += (d.vx + Math.sin(d.ph * 0.7) * 3) * dt; d.y += (d.vy + Math.cos(d.ph * 0.5) * 2) * dt;
    if (d.x < cam.x - 10) d.x += VW + 20; if (d.x > cam.x + VW + 10) d.x -= VW + 20;
    if (d.y < cam.y - 10) d.y += VH + 20; if (d.y > cam.y + VH + 10) d.y -= VH + 20;
  }
}

// everything procedural that updates each frame
function updateAnim(w, dt, cam) {
  updateLiquids(w, dt);
  updateDebris(w, dt);
  for (const d of w.decos) {
    if (d.rope) updateRope(w, d.rope, dt);
    if (d.ropes) for (const R of d.ropes) updateRope(w, R, dt);
    if (d.kind === 'lamp' || d.kind === 'cage lamp') { d.av += (-14 * Math.sin(d.ang) - 1.2 * d.av) * dt; d.ang += d.av * dt; }
    if (d.kind === 'sparks') {
      d.sparkT = Math.max(0, d.sparkT - dt);
      if (Math.random() < dt * 0.9) {
        d.sparkT = 0.22; const e = d.rope.pts[d.rope.pts.length - 1];
        e.px -= rand(-3, 3); spawnParts(w, e.x, e.y + 1, 10, Math.random() < 0.5 ? '#ffe8a0' : '#a0d0ff', 110, 0.5, 400);
      }
    }
    if (d.kind === 'drip' && Math.random() < dt * 1.2) w.parts.push({ x: d.x + rand(-1, 1), y: d.y + 4, vx: 0, vy: 10, life: 1.4, max: 1.4, col: '#7ab8ff', grav: 500, size: 1 });
  }
  if (cam) updateDust(w, cam, dt);
  const P = w.player;
  if (P && !P.dead) animPlayer(w, P, dt);
  for (const e of w.enemies) if (!e.dead && !e.still) animEnemy(w, e, dt);
  if (w.boss && !w.boss.dead) animBoss(w, w.boss, dt);
}

// ---------------------------------------------------------------------------------
// HUMANOID RIG: legs with knees, a leaning body, a head, arms that hold the gun
function animBody(o, dt, speedRef) {
  const sp = Math.abs(o.vx);
  o.move = lerp(o.move || 0, clamp(sp / speedRef, 0, 1), Math.min(1, dt * 10));
  o.phase = (o.phase || 0) + sp * dt * 0.26;
  o.recoil = Math.max(0, (o.recoil || 0) - dt * 7);
  o.squash = lerp(o.squash || 0, 0, Math.min(1, dt * 10));
  o.t = (o.t || 0) + dt;
  if (o.ground && !o.wasGround && (o.lastVy || 0) > 200) o.squash = Math.min(1, o.lastVy / 400);
  o.wasGround = o.ground; o.lastVy = o.vy;
}
function animPlayer(w, P, dt) {
  animBody(P, dt, PL.run);
  // scarf: a little rope tied to the neck
  const nx = P.x + 5 - P.face * 1, ny = P.y + 7;
  if (!P.scarf) P.scarf = makeRope(nx, ny, nx - 10, ny, 6, 1);
  const R = P.scarf; R.ax = nx; R.ay = ny; R.pinB = false;
  for (let i = 1; i < R.pts.length; i++) { const p = R.pts[i]; p.x -= P.face * 0.18 + P.vx * dt * 0.12; p.y += Math.sin(w.time * 8 + i) * 0.12; }
  updateRope(NOPUSH, R, dt);
}
const NOPUSH = { player: null, enemies: [], time: -1, _pushT: -1, _push: [] };
function animEnemy(w, e, dt) {
  animBody(e, dt, Math.max(30, e.d.speed));
  const P = w.player, sx = e.x + e.w / 2, sy = e.y + e.h * 0.35;
  const want = e.charge > 0 ? e.aim : (e.alert > 0 && P ? Math.atan2(P.y + 10 - sy, P.x + 5 - sx) : (e.face > 0 ? 0.25 : Math.PI - 0.25));
  e.aimA = e.aimA == null ? want : e.aimA + angDiff(e.aimA, want) * Math.min(1, dt * 10);
  if (e.d.body === 'crawler') stepLegs(w, e, dt, 6, { L: 5 * (e.d.size || 1), reach: 6, stepT: 0.09, spread: [-7, -2, 4, -5, 0, 6] });
  if (e.d.body === 'robot') { e.ant = e.ant || 0; e.antV = (e.antV || 0) + (-60 * e.ant - 4 * e.antV - e.vx * 0.6) * dt; e.ant += e.antV * dt; }
}

// planted feet: each foot stays on the ground until the body moves too far, then it steps
function stepLegs(w, e, dt, n, o) {
  const cx = e.x + e.w / 2, by = e.y + e.h;
  if (!e.feet) e.feet = Array.from({ length: n }, (_, i) => ({ x: cx + o.spread[i], y: by, fx: 0, fy: 0, tx: 0, ty: 0, t: 1 }));
  const anyStepping = g => e.feet.some((f, i) => i % 2 === g && f.t < 1);
  e.feet.forEach((f, i) => {
    const ix = cx + o.spread[i] * (e.d?.size || e.s || 1) + clamp(e.vx * 0.12, -10, 10);
    let iy = by + 6;   // find the ground under this foot
    for (let py = by - 8; py < by + 22; py += 2) {
      if (blockedAt(w, ix, py, 'p')) { iy = groundY(w, ix, py); break; }
      if (TILES[tileUnder(w, ix, py)]?.oneway && py % TS < 3) { iy = Math.floor(py / TS) * TS; break; }
    }
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / o.stepT);
      f.x = lerp(f.fx, f.tx, f.t); f.y = lerp(f.fy, f.ty, f.t) - Math.sin(f.t * Math.PI) * o.reach * 0.6;
    } else if ((Math.hypot(f.x - ix, f.y - iy) > o.reach || !e.ground) && !anyStepping(1 - (i % 2))) {
      f.fx = f.x; f.fy = f.y; f.tx = ix; f.ty = e.ground || e.d?.ai === 'fly' ? iy : by + 3; f.t = 0;
      if (o.stomp && e.ground) { w.shake = Math.max(w.shake, o.stomp); sfx('crush'); spawnParts(w, ix, iy, 4, '#8a8070', 50, 0.4, 200); }
    }
  });
}
// two-bone IK: given hip and foot, find the knee (bending `up` or down)
function ikKnee(hx, hy, fx, fy, L1, L2, bendSide) {
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 0.001;
  const maxD = L1 + L2 - 0.01; if (d > maxD) { fx = hx + dx / d * maxD; fy = hy + dy / d * maxD; dx = fx - hx; dy = fy - hy; d = maxD; }
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const mx = hx + dx * a / d, my = hy + dy * a / d;
  return { kx: mx - dy / d * h * bendSide, ky: my + dx / d * h * bendSide, fx, fy };
}

// R: { x, y (feet), s, face, o (the animated object), aim, kind, c: colours, gun: {len, thick, col} }
function drawHumanoid(ctx, R) {
  const o = R.o, s = R.s, f = R.face, k = R.kind;
  const L1 = (k === 'brute' ? 6 : 5) * s, L2 = (k === 'brute' ? 6.5 : 5.2) * s;
  const move = o.move || 0, ph = o.phase || 0, air = !o.ground && !o.climb;
  const breathe = Math.sin((o.t || 0) * 2.2) * 0.4 * s;
  const bob = (air ? 0 : -Math.abs(Math.sin(ph)) * 1.4 * move * s) + breathe * (1 - move) + (o.squash || 0) * 2.5 * s;
  const hipX = R.x, hipY = R.y - (L1 + L2) * 0.96 + bob;
  const torso = (k === 'brute' ? 9 : 7) * s, lean = (0.18 * move + (air ? 0.05 : 0)) * f;
  const neckX = hipX + Math.sin(lean) * torso, neckY = hipY - Math.cos(lean) * torso;
  const leg = (i, col) => {
    let a1, kb;
    if (o.climb) { const c = Math.sin((o.y || 0) * 0.3 + i * Math.PI); a1 = 0.3 * c; kb = 0.9 + 0.5 * c; }
    else if (air) { a1 = i ? -0.45 : 0.65; kb = i ? 0.5 : 1.3 * (o.vy < 0 ? 1 : 0.7); }
    else { const p = ph + i * Math.PI; a1 = Math.sin(p) * 0.75 * move; kb = 0.12 + Math.max(0, Math.cos(p)) * 1.1 * move + (o.squash || 0) * 0.8; }
    const hx = hipX + (i ? -0.8 : 0.8) * s * f, kx = hx + Math.sin(a1) * L1 * f, ky = hipY + Math.cos(a1) * L1;
    const fx = kx + Math.sin(a1 - kb) * L2 * f, fy = Math.min(ky + Math.cos(a1 - kb) * L2, R.y + 0.5);
    ctx.fillStyle = col; const th = Math.max(2, Math.round((k === 'brute' ? 3 : 2) * s));
    pline(ctx, hx, hipY, kx, ky, th); pline(ctx, kx, ky, fx, fy, th);
    ctx.fillStyle = R.c.boots; ctx.fillRect(Math.round(fx - (f > 0 ? 1 : 2)), Math.round(fy - 1), Math.max(3, Math.round(3 * s)), Math.max(1, Math.round(1.5 * s)));
    if (k === 'robot') { ctx.fillStyle = R.c.light; ctx.fillRect(Math.round(kx) - 1, Math.round(ky) - 1, 2, 2); }
  };
  const aim = R.aim, rc = (o.recoil || 0) * 2 * s;
  const shX = neckX + 0.5 * f * s, shY = neckY + 1.5 * s;
  const handX = shX + Math.cos(aim) * (4 * s - rc), handY = shY + Math.sin(aim) * (4 * s - rc) + 1;
  const arm = (col, front) => {
    const hx = front ? handX : handX + Math.cos(aim) * 3 * s, hy = front ? handY : handY + Math.sin(aim) * 3 * s;
    const kn = ikKnee(shX, shY, hx, hy, 3.2 * s, 3.4 * s, Math.cos(aim) >= 0 ? 1 : -1);
    ctx.fillStyle = col; const th = Math.max(2, Math.round((k === 'brute' ? 3 : 2) * s));
    pline(ctx, shX, shY, kn.kx, kn.ky, th); pline(ctx, kn.kx, kn.ky, kn.fx, kn.fy, th);
  };
  leg(1, R.c.legsDark);
  if (R.gun) arm(R.c.dark, false);
  // torso
  const tw = Math.max(3, Math.round((k === 'brute' ? 7 : k === 'robot' ? 5 : 4) * s));
  ctx.fillStyle = R.c.body; pline(ctx, hipX, hipY, neckX, neckY + s, tw);
  ctx.fillStyle = R.c.light; pline(ctx, hipX + f * (tw / 2 - 0.5), hipY - 1, neckX + f * (tw / 2 - 0.5), neckY + 1.5 * s, 1);
  ctx.fillStyle = R.c.dark; ctx.fillRect(Math.round(hipX - tw / 2), Math.round(hipY - 1), tw, 1);
  if (R.c.badge) { ctx.fillStyle = R.c.badge; ctx.fillRect(Math.round(lerp(hipX, neckX, 0.6) - 1), Math.round(lerp(hipY, neckY, 0.6)), 2, 2); }
  // head
  const hx = neckX + f * 0.6 * s, hy = neckY - 2.6 * s;
  if (k === 'robot') {
    ctx.fillStyle = R.c.dark; ctx.fillRect(Math.round(hx - 3 * s), Math.round(hy - 2.5 * s), Math.round(6 * s), Math.round(5 * s));
    ctx.fillStyle = '#111'; ctx.fillRect(Math.round(hx - 1 * s + f * s), Math.round(hy - 0.8 * s), Math.round(3 * s), Math.max(1, Math.round(1.6 * s)));
    ctx.fillStyle = R.c.eye; ctx.fillRect(Math.round(hx + f * 1.2 * s), Math.round(hy - 0.8 * s), Math.max(1, Math.round(1.4 * s)), Math.max(1, Math.round(1.6 * s)));
    const an = o.ant || 0; ctx.fillStyle = R.c.light; pline(ctx, hx - f * s, hy - 2.5 * s, hx - f * s + Math.sin(an) * 4 * s, hy - 2.5 * s - Math.cos(an) * 4 * s, 1);
    ctx.fillStyle = R.c.eye; ctx.fillRect(Math.round(hx - f * s + Math.sin(an) * 4 * s), Math.round(hy - 2.5 * s - Math.cos(an) * 4 * s) - 1, 1, 1);
  } else {
    ctx.fillStyle = R.c.skin; pcircle(ctx, hx, hy, Math.max(2, Math.round(2.4 * s)));
    ctx.fillStyle = R.c.helmet; ctx.fillRect(Math.round(hx - 3 * s), Math.round(hy - 3 * s), Math.round(6 * s), Math.max(2, Math.round(2.4 * s)));
    ctx.fillRect(Math.round(hx - (f > 0 ? 3 : -1) * s), Math.round(hy - 1 * s), Math.max(1, Math.round(1.5 * s)), Math.round(2 * s));
    ctx.fillStyle = R.c.eye; ctx.fillRect(Math.round(hx + (f > 0 ? 0 : -2.5) * s), Math.round(hy - 0.5 * s), Math.max(2, Math.round(2.5 * s)), Math.max(1, Math.round(1.2 * s)));
  }
  leg(0, R.c.legs);
  // gun + front arm
  if (R.gun) {
    const gx = handX - Math.cos(aim) * 1.5, gy = handY - Math.sin(aim) * 1.5;
    ctx.fillStyle = R.gun.col; pline(ctx, gx, gy, gx + Math.cos(aim) * R.gun.len, gy + Math.sin(aim) * R.gun.len, R.gun.thick);
    if (R.gun.tip) { ctx.fillStyle = R.gun.tip; ctx.fillRect(Math.round(gx + Math.cos(aim) * R.gun.len) - 1, Math.round(gy + Math.sin(aim) * R.gun.len) - 1, 2, 2); }
    arm(R.c.body, true);
  } else {
    // swinging arms when there is no gun
    const sw = Math.sin(ph) * 0.8 * move;
    ctx.fillStyle = R.c.body; pline(ctx, shX, shY, shX + Math.sin(sw) * 6 * s * f, shY + Math.cos(sw) * 6 * s, Math.max(2, Math.round(2 * s)));
  }
}

const PLAYER_COLS = { body: '#4a5a6a', light: '#7a8a9a', dark: '#2e3a46', skin: '#c89a78', helmet: '#3e4a56', eye: '#50e0ff', legs: '#2e3640', legsDark: '#232a32', boots: '#15181c', badge: '#d8b02a' };

// ---------------------------------------------------------------------------------
// boss animation state
function animBoss(w, b, dt) {
  b.recoil = Math.max(0, (b.recoil || 0) - dt * 5);
  b.move = lerp(b.move || 0, clamp(Math.abs(b.vx) / 60, 0, 1), Math.min(1, dt * 6));
  b.dist = (b.dist || 0) + b.vx * dt;
  const P = w.player, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const want = P ? Math.atan2(P.y + 10 - cy, P.x + 5 - cx) : Math.PI;
  b.aimA = b.aimA == null ? want : b.aimA + angDiff(b.aimA, want) * Math.min(1, dt * 4);
  const s = b.d.size || 1;
  if (b.d.body === 'mech') stepLegs(w, b, dt, 2, { L: 12 * s, reach: 16 * s, stepT: 0.22, spread: [-9, 9], stomp: 2 });
  if (b.d.body === 'walker') stepLegs(w, b, dt, 2, { L: 18 * s, reach: 22 * s, stepT: 0.3, spread: [-12, 12], stomp: 3 });
  b.swing = (b.swing || 0) + (-(b.vx || 0) * 0.002 - (b.swing || 0) * 3) * dt * 6;
}
