// FOUNDRY - more traps: heat coils, wall zappers, flame jets, proximity mines, steam launchers, lava.
'use strict';

// where in its cycle a timed trap is: 0 = off, 1 = warning, 2 = on
function cycleState(t, period, on, delay, warn = 0.5) {
  if (!period) return { s: 2, k: 1 };
  const per = Math.max(period, on + 0.1), u = ((t - (delay || 0)) % per + per) % per;
  if (u < on) return { s: 2, k: u / on };
  if (u > per - warn) return { s: 1, k: (u - (per - warn)) / warn };
  return { s: 0, k: 0 };
}
function heaterRect(h) { const s = objSize(h); return { x: h.x - s.w / 2, y: h.y - s.h / 2, w: s.w, h: s.h }; }
function heatZone(h) {   // the hot area: the plate and a bit in front of it
  const r = heaterRect(h), g = 7;
  if (h.dir === 'floor') return { x: r.x, y: r.y - g, w: r.w, h: r.h + g };
  if (h.dir === 'ceiling') return { x: r.x, y: r.y, w: r.w, h: r.h + g };
  if (h.dir === 'left wall') return { x: r.x, y: r.y, w: r.w + g, h: r.h };
  return { x: r.x - g, y: r.y, w: r.w + g, h: r.h };
}
const ZAP_DIR = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

function updateTraps(w, dt) {
  const P = w.player, alive = P && !P.dead, PR = alive ? P : null;
  // heat coils glow up, then burn
  for (const h of w.heaters) {
    const c = cycleState(w.time, h.period, h.on, h.delay, 0.9);
    const target = c.s === 2 ? 1 : c.s === 1 ? c.k * 0.6 : 0;
    h.heat += (target - h.heat) * Math.min(1, dt * (c.s === 2 ? 8 : 2.5));
    h.hot = c.s === 2 && h.heat > 0.7;
    if (h.hot) {
      const z = heatZone(h);
      if (PR && rectsHit(PR, z)) { burnPlayer(w, h.dps * dt, 'BURNED'); if (Math.random() < 0.3) spawnParts(w, P.x + 5, P.y + 18, 1, '#ffb060', 40, 0.4, -80); }
      for (const e of w.enemies) if (!e.dead && !e.still && rectsHit(e, z)) damageEnemy(w, e, h.dps * dt * 0.5, null, true);
    }
    if (h.heat > 0.3 && Math.random() < h.heat * dt * 20) {
      const r = heaterRect(h), up = h.dir === 'ceiling' ? 1 : -1;
      w.parts.push({ x: r.x + rand(0, r.w), y: r.y + rand(0, r.h), vx: rand(-8, 8), vy: up * rand(15, 40), life: 0.9, max: 0.9, col: h.heat > 0.8 ? '#ffe0a0' : '#ff7030', grav: -up * 20, size: 1 });
    }
  }
  // wall zappers: an electric beam that shoots out of the wall
  for (const z of w.zaps) {
    const c = cycleState(w.time, z.period, z.on, z.delay, 0.5), was = z.state;
    z.state = c.s;
    const [dx, dy] = ZAP_DIR[z.dir] || ZAP_DIR.right, a = Math.atan2(dy, dx);
    const end = raycast(w, z.x + dx * 6, z.y + dy * 6, a, z.range, 'l'); z.ex = end.x; z.ey = end.y;
    if (z.state === 2 && was !== 2) { z.hitDone = false; sfx('zap'); }
    if (z.state === 2) {
      z.boltT = (z.boltT || 0) - dt;
      if (z.boltT <= 0) {
        z.boltT = 0.04; const n = Math.max(3, Math.round(end.d / 9)), pts = [[z.x + dx * 6, z.y + dy * 6]];
        for (let i = 1; i < n; i++) pts.push([lerp(z.x, end.x, i / n) + (dy ? rand(-5, 5) : 0), lerp(z.y, end.y, i / n) + (dx ? rand(-5, 5) : 0)]);
        pts.push([end.x, end.y]); z.bolt = pts;
      }
      if (PR && !z.hitDone && segRect(z.x, z.y, end.x, end.y, { x: P.x - 2, y: P.y - 2, w: P.w + 4, h: P.h + 4 })) { z.hitDone = true; hurtPlayer(w, z.dmg, z.x, 1, 'ELECTROCUTED'); }
      for (const e of w.enemies) if (!e.dead && !e.still && segRect(z.x, z.y, end.x, end.y, e)) damageEnemy(w, e, 60 * dt, null, true);
      if (Math.random() < 0.4) spawnParts(w, end.x, end.y, 1, '#c0e0ff', 60, 0.3, 100);
    } else z.bolt = null;
  }
  // flame jets
  for (const f of w.flamers) {
    const c = cycleState(w.time, f.period, f.on, f.delay, 0.6), was = f.state;
    f.state = c.s; f.ang = f.angle * Math.PI / 180;
    const cx = Math.cos(f.ang), cy = Math.sin(f.ang);
    if (f.state === 2) {
      if (was !== 2) sfx('rocket');
      const ramp = Math.min(1, c.k * f.on / 0.15), len = f.len * ramp;
      const end = raycast(w, f.x, f.y, f.ang, len, 'r'); f.reach = end.d;
      for (let i = 0; i < 5; i++) {
        const sp = rand(140, 220), a = f.ang + rand(-0.18, 0.18);
        w.parts.push({ x: f.x + cx * 5, y: f.y + cy * 5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: f.reach / 200 + 0.05, max: f.reach / 200 + 0.05, col: pick(['#fff0a0', '#ffc040', '#ff7020', '#ff4010']), grav: -60, size: Math.random() < 0.4 ? 2 : 1, fire: true });
      }
      if (PR) for (let d = 4; d < f.reach; d += 6) {
        const px = f.x + cx * d, py = f.y + cy * d, rr = 4 + d * 0.12;
        if (circRect(px, py, rr, PR)) { burnPlayer(w, f.dps * dt, 'BURNED'); break; }
      }
      for (const e of w.enemies) if (!e.dead && !e.still) for (let d = 4; d < f.reach; d += 8) if (circRect(f.x + cx * d, f.y + cy * d, 5, e)) { damageEnemy(w, e, f.dps * dt * 0.5, null, true); break; }
    } else if (f.state === 1 && Math.random() < 0.4) {
      w.parts.push({ x: f.x + cx * 5, y: f.y + cy * 5, vx: cx * 30 + rand(-10, 10), vy: cy * 30 + rand(-10, 10), life: 0.25, max: 0.25, col: '#60a0ff', grav: -30, size: 1 });
    }
  }
  // proximity mines: beep, then boom
  for (const m of w.pmines) {
    if (m.gone) continue;
    if (!m.beep && alive && dist(m.x, m.y, P.x + 5, P.y + 10) < m.radius) { m.beep = 0.001; sfx('alarm'); }
    if (m.beep) { m.beep += dt; if (m.beep > 0.55) { m.gone = true; explode(w, m.x, m.y - 2, 34, m.dmg, 'e'); } }
  }
  // steam launchers throw you up
  for (const v of w.vents) {
    const c = cycleState(w.time, v.period, v.on, 0, 0.5);
    v.onNow = c.s === 2; v.warn = c.s === 1;
    if (v.onNow) {
      if (Math.random() < 0.7) w.parts.push({ x: v.x + rand(-6, 6), y: v.y - 2, vx: rand(-12, 12), vy: rand(-180, -110), life: 0.8, max: 0.8, col: '#d8dce0', grav: 40, size: 2 });
      const zone = { x: v.x - 9, y: v.y - 44, w: 18, h: 44 };
      if (PR && rectsHit(PR, zone)) { P.vy = Math.min(P.vy, -v.power); P.jumpHeld = false; P.ground = false; if (!v.puff) { sfx('splash'); v.puff = 1; } } else v.puff = 0;
      for (const e of w.enemies) if (!e.dead && !e.still && e.d.ai !== 'fly' && rectsHit(e, zone)) e.vy = Math.min(e.vy, -v.power * 0.8);
    }
  }
}
// a placed mine can be shot to blow it up early
function shootMines(w, b) {
  for (const m of w.pmines) if (!m.gone && Math.abs(b.x - m.x) < 6 && Math.abs(b.y - m.y) < 5) { m.gone = true; explode(w, m.x, m.y - 2, 34, m.dmg, 'p'); return true; }
  return false;
}

// ---- drawing ----
function drawHeater(ctx, h, t) {
  const r = heaterRect(h), x = Math.round(r.x), y = Math.round(r.y), horiz = h.dir === 'floor' || h.dir === 'ceiling';
  const k = h.heat || 0;
  const col = k < 0.35 ? `rgb(${90 + k * 300 | 0},${30 + k * 40 | 0},20)` : k < 0.75 ? `rgb(255,${80 + (k - 0.35) * 300 | 0},30)` : `rgb(255,${200 + (k - 0.75) * 200 | 0},${120 + (k - 0.75) * 400 | 0})`;
  ctx.fillStyle = '#2a2d31'; ctx.fillRect(x, y, r.w, r.h);
  ctx.fillStyle = '#4a4e54'; if (horiz) ctx.fillRect(x, h.dir === 'floor' ? y + r.h - 2 : y, r.w, 2); else ctx.fillRect(h.dir === 'left wall' ? x : x + r.w - 2, y, 2, r.h);
  ctx.fillStyle = col;
  // zig-zag coil element
  const n = Math.floor((horiz ? r.w : r.h) / 3);
  for (let i = 0; i < n; i++) {
    const o = i * 3 + 1, zz = (i % 2) ? 1 : 3;
    if (horiz) ctx.fillRect(x + o, y + (h.dir === 'floor' ? zz - 1 : r.h - zz - 1), 2, 2);
    else ctx.fillRect(x + (h.dir === 'left wall' ? r.w - zz - 1 : zz - 1), y + o, 2, 2);
  }
  if (h.hot) { ctx.fillStyle = 'rgba(255,200,120,0.25)'; const z = heatZone(h); ctx.fillRect(Math.round(z.x), Math.round(z.y), z.w, z.h); }
}
function drawZap(ctx, z, t, ed) {
  const x = Math.round(z.x), y = Math.round(z.y), [dx, dy] = ZAP_DIR[z.dir] || ZAP_DIR.right;
  ctx.fillStyle = '#25292e'; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = '#3e444c'; ctx.fillRect(x - 5, y - 5, 10, 10);
  for (let i = -4; i <= 4; i += 2) { ctx.fillStyle = i % 4 ? '#b06a30' : '#d08a40'; if (dx) ctx.fillRect(x + dx * 2 - 1, y + i, 3, 1); else ctx.fillRect(x + i, y + dy * 2 - 1, 1, 3); }
  const glow = z.state === 2 ? '#e8f4ff' : z.state === 1 ? ((t * 14) % 1 < 0.5 ? '#80c0ff' : '#305070') : '#304050';
  ctx.fillStyle = glow; ctx.fillRect(x + dx * 5 - 1, y + dy * 5 - 1, 3, 3);
  if (z.state === 1 && Math.random() < 0.6) { ctx.fillStyle = '#a0d0ff'; ctx.fillRect(x + dx * 7 + randi(-3, 3), y + dy * 7 + randi(-3, 3), 1, 1); }
  if ((ed || z.state === 1) && z.ex != null) { ctx.fillStyle = 'rgba(120,180,255,0.35)'; const D = dist(x, y, z.ex, z.ey); for (let i = 8; i < D; i += 4) ctx.fillRect(Math.round(x + dx * i), Math.round(y + dy * i), 1, 1); }
  if (z.bolt) {
    ctx.fillStyle = '#4080ff'; for (let i = 1; i < z.bolt.length; i++) pline(ctx, z.bolt[i - 1][0], z.bolt[i - 1][1], z.bolt[i][0], z.bolt[i][1], 3);
    ctx.fillStyle = '#eef6ff'; for (let i = 1; i < z.bolt.length; i++) pline(ctx, z.bolt[i - 1][0], z.bolt[i - 1][1], z.bolt[i][0], z.bolt[i][1], 1);
  }
}
function drawFlamer(ctx, f, t, ed) {
  const x = Math.round(f.x), y = Math.round(f.y), a = f.angle * Math.PI / 180;
  ctx.fillStyle = '#2a2d31'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillStyle = '#1a1c1e'; pline(ctx, x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 6, 4);
  ctx.fillStyle = f.state === 2 ? '#ffd060' : f.state === 1 ? '#60a0ff' : '#402818'; ctx.fillRect(Math.round(x + Math.cos(a) * 6) - 1, Math.round(y + Math.sin(a) * 6) - 1, 2, 2);
  if (ed) { ctx.fillStyle = 'rgba(255,140,40,0.4)'; for (let i = 8; i < f.len; i += 4) ctx.fillRect(Math.round(x + Math.cos(a) * i), Math.round(y + Math.sin(a) * i), 1, 1); }
}
function drawPMine(ctx, m, t) {
  if (m.gone) return;
  const x = Math.round(m.x), y = Math.round(m.y);
  ctx.fillStyle = '#2e3236'; ctx.fillRect(x - 5, y - 2, 10, 4); ctx.fillStyle = '#4a5058'; ctx.fillRect(x - 4, y - 3, 8, 1);
  const fast = m.beep ? 16 : 1.5;
  ctx.fillStyle = (t * fast) % 1 < 0.3 ? '#ff3030' : '#601010'; ctx.fillRect(x - 1, y - 4, 2, 1);
}
function drawVent(ctx, v, t) {
  const x = Math.round(v.x), y = Math.round(v.y);
  ctx.fillStyle = '#2a2d31'; ctx.fillRect(x - 8, y - 3, 16, 6); ctx.fillStyle = '#4a525c'; ctx.fillRect(x - 8, y - 3, 16, 1);
  ctx.fillStyle = '#15181c'; for (let i = -6; i <= 5; i += 3) ctx.fillRect(x + i, y - 2, 2, 4);
  ctx.fillStyle = v.onNow ? '#60ff90' : v.warn ? ((t * 10) % 1 < 0.5 ? '#ffd060' : '#604010') : '#305040'; ctx.fillRect(x - 8, y + 2, 2, 1); ctx.fillRect(x + 6, y + 2, 2, 1);
}
