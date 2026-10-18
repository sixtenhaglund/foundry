// FOUNDRY - bosses built from designs (made in the BOSS MAKER).
'use strict';

function makeBoss(o, w, defOverride) {
  const d = defOverride || getBoss(o.def), s = bossSize(d);
  let A = w.arena;
  const ar = A ? { x: A.x - A.tw * TS / 2, y: A.y - A.th * TS / 2, w: A.tw * TS, h: A.th * TS } : { x: o.x - 12 * TS, y: o.y - 8 * TS, w: 24 * TS, h: 12 * TS };
  return { o, d, x: o.x - s.w / 2, y: o.y - s.h / 2, w: s.w, h: s.h, vx: 0, vy: 0, hp: d.maxHp, maxHp: d.maxHp, phase: 0, active: false,
    cd: 1.5, atk: null, last: '', face: -1, flash: 0, dead: false, dying: false, deadT: 0, ar, anim: 0, alpha: 1, tp: 3, ground: false, noSink: true,
    bvx: 90, bvy: 70 };
}

function bossStart(w) {
  const b = w.boss; if (!b || b.active || b.dead) return;
  b.active = true; w.gatesClosed = true; w.banner = { text: b.d.name, sub: 'BOSS', life: 2.5 };
  sfx('roar'); sfx('gate'); bossMusic(true); w.shake = 8;
}

function updateBoss(w, dt) {
  const b = w.boss; if (!b) return;
  const P = w.player, alive = P && !P.dead, d = b.d;
  b.flash = Math.max(0, b.flash - dt); b.anim += dt;
  if (b.dead) return;
  if (b.dying) {
    b.deadT += dt;
    if (Math.random() < dt * 14) boomFx(w, b.x + rand(0, b.w), b.y + rand(0, b.h), rand(0.4, 0.9));
    if (b.deadT > 2.2) {
      b.dead = true; boomFx(w, b.x + b.w / 2, b.y + b.h / 2, 2); w.gatesClosed = false; bossMusic(false); sfx('gate');
      for (let i = 0; i < 16; i++) addDebris(w, b.x + rand(0, b.w), b.y + rand(0, b.h), rand(5, 14), randi(2, 5), pick([b.d.color, b.d.accent, shade(b.d.color, -0.4), '#1e2226']), 0, -rand(100, 260));
      w.banner = { text: 'BOSS DEFEATED', sub: 'THE EXIT IS OPEN', life: 3 };
      for (const k of ['ammo', 'health']) w.pickups.push({ t: k, x: b.x + b.w / 2 + (k === 'ammo' ? -10 : 10), y: b.y + b.h - 5, amount: k === 'ammo' ? 12 : 50, drop: true });
    }
    return;
  }
  const pcx = alive ? P.x + 5 : b.x, pcy = alive ? P.y + 10 : b.y;
  if (!b.active) {
    if (alive && rectsHit(P, b.ar)) bossStart(w);
    if (d.move !== 'hover' && d.move !== 'bounce' && d.move !== 'teleport') bossGravity(w, b, dt);
    return;
  }
  // phase from health left
  let ph = 0; d.phases.forEach((p, i) => { if (b.hp / b.maxHp <= p.at) ph = i; });
  if (ph !== b.phase) { b.phase = ph; w.banner = { text: 'PHASE ' + (ph + 1), sub: d.name, life: 1.6 }; sfx('roar'); b.flash = 0.4; w.shake = 6; }
  const PH = d.phases[b.phase] || d.phases[0];
  const spd = d.speed * (PH.speed || 1);
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  if (!b.atk || !b.atk.lockMove) b.face = pcx > bcx ? 1 : -1;

  // ---- movement
  if (!b.atk || !b.atk.lockMove) {
    if (d.move === 'walk') {
      const gap = pcx - bcx;
      b.vx += clamp((Math.abs(gap) > 30 ? Math.sign(gap) * spd : 0) - b.vx, -400 * dt, 400 * dt);
      bossGravity(w, b, dt);
    } else if (d.move === 'hover') {
      const tx = clamp(pcx, b.ar.x + b.w / 2 + 8, b.ar.x + b.ar.w - b.w / 2 - 8) - b.w / 2, ty = b.ar.y + b.ar.h * 0.22 + Math.sin(b.anim * 1.5) * 10;
      b.x += clamp(tx - b.x, -spd * dt, spd * dt); b.y += clamp(ty - b.y, -spd * dt, spd * dt);
    } else if (d.move === 'bounce') {
      b.x += b.bvx * (spd / 60) * dt; b.y += b.bvy * (spd / 60) * dt;
      if (b.x < b.ar.x + 4 || b.x + b.w > b.ar.x + b.ar.w - 4) { b.bvx *= -1; b.x = clamp(b.x, b.ar.x + 4, b.ar.x + b.ar.w - 4 - b.w); }
      if (b.y < b.ar.y + 4 || b.y + b.h > b.ar.y + b.ar.h - 20) { b.bvy *= -1; b.y = clamp(b.y, b.ar.y + 4, b.ar.y + b.ar.h - 20 - b.h); }
    } else if (d.move === 'teleport') {
      b.tp -= dt;
      if (b.tp < 0.4) b.alpha = Math.max(0, b.tp / 0.4);
      if (b.tp <= 0) {
        b.x = rand(b.ar.x + 16, b.ar.x + b.ar.w - 16 - b.w); b.y = rand(b.ar.y + 16, b.ar.y + b.ar.h * 0.5);
        b.tp = rand(3, 4.5) / (PH.speed || 1); b.alpha = 1; spawnParts(w, b.x + b.w / 2, b.y + b.h / 2, 20, d.eye, 120, 0.5, 0); sfx('zap');
      }
    } else bossGravity(w, b, dt, true);
  }
  // keep inside arena
  b.x = clamp(b.x, b.ar.x, b.ar.x + b.ar.w - b.w);

  // ---- attacks
  if (!b.atk) {
    b.cd -= dt;
    if (b.cd <= 0 && alive) {
      let list = PH.attacks && PH.attacks.length ? PH.attacks : d.attacks;
      if (list.length > 1) list = list.filter(k => k !== b.last);
      const k = pick(list); b.last = k; b.atk = { k, t: 0, n: 0 };
    }
  } else {
    bossAttack(w, b, dt, pcx, pcy);
  }
  if (alive && d.contact > 0 && rectsHit(P, { x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 6 })) hurtPlayer(w, d.contact * (b.atk && b.atk.k === 'dash' ? 1.5 : 1), bcx, 1.6, d.name);
}

function bossGravity(w, b, dt, still) {
  b.vy = Math.min(b.vy + 950 * dt, 500);
  const r = moveBody(w, b, still ? 0 : b.vx * dt, b.vy * dt, false);
  if (r.hitX) b.vx = 0; if (r.hitY) b.vy = 0;
  const landed = r.ground && !b.ground; b.ground = r.ground;
  return landed;
}

function bossEnd(b, rest = 1) {
  const PH = b.d.phases[b.phase] || {};
  b.atk = null; b.cd = b.d.cd * (PH.cd || 1) * rest * (1.15 - b.d.diff * 0.06);
}

function bossAttack(w, b, dt, pcx, pcy) {
  const A = b.atk, d = b.d, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  A.t += dt;
  const aimP = Math.atan2(pcy - bcy, pcx - bcx);
  switch (A.k) {
    case 'burst': {
      A.tele = A.t < 0.45;
      if (A.t >= 0.45) {
        A.bt = (A.bt || 0) - dt;
        if (A.bt <= 0 && A.n < Math.ceil(d.nb / 2) + 2) { A.n++; A.bt = 0.08; bossBullet(w, b, aimP + rand(-0.06, 0.06)); }
        if (A.n >= Math.ceil(d.nb / 2) + 2) bossEnd(b);
      }
      break;
    }
    case 'spray': {
      A.tele = A.t < 0.5;
      const waves = d.diff >= 3 ? 2 : 1;
      if (A.t >= 0.5 + A.n * 0.35 && A.n < waves) {
        const off = A.n * Math.PI / d.nb + b.anim;
        for (let i = 0; i < d.nb; i++) bossBullet(w, b, off + i * Math.PI * 2 / d.nb, 0.75);
        A.n++;
      }
      if (A.n >= waves) bossEnd(b);
      break;
    }
    case 'rockets': {
      A.tele = A.t < 0.4;
      const n = 2 + Math.floor(d.diff / 2);
      if (A.t >= 0.4 + A.n * 0.25 && A.n < n) {
        A.n++; const a = -Math.PI / 2 + rand(-0.8, 0.8);
        w.rockets.push({ x: bcx, y: b.y + 4, a, sp: 60, max: 200, owner: 'e', dmg: 20 + d.diff * 3, life: 4, home: 2.2 }); sfx('rocket');
      }
      if (A.n >= n) bossEnd(b, 1.2);
      break;
    }
    case 'sweep': {
      A.lockMove = true;
      if (A.t < dt * 1.5) { A.dir = Math.random() < 0.5 ? 1 : -1; A.a0 = aimP - A.dir * 1.0; sfx('charge'); }
      const warn = 0.8, dur = 1.5;
      A.ang = A.t < warn ? A.a0 : A.a0 + A.dir * 2.0 * EASE['ease in-out'](clamp((A.t - warn) / dur, 0, 1));
      const end = raycast(w, bcx, bcy, A.ang, 900, 'l'); A.ex = end.x; A.ey = end.y; A.on = A.t >= warn;
      if (A.on) {
        if (!A.snd) { A.snd = 1; sfx('laser'); }
        const P = w.player; if (P && !P.dead && segRect(bcx, bcy, end.x, end.y, P)) hurtPlayer(w, 20 + d.diff * 3, bcx, 0.8, 'LASERED');
        if (Math.random() < 0.5) spawnParts(w, end.x, end.y, 1, '#ffb0a0', 60, 0.3, 100);
      }
      if (A.t > warn + dur) bossEnd(b);
      break;
    }
    case 'slam': {
      A.lockMove = true;
      const flyer = d.move === 'hover' || d.move === 'bounce' || d.move === 'teleport';
      if (flyer) {
        if (A.n === 0) { A.y0 = b.y; A.n = 1; }
        if (A.n === 1) { b.x += clamp(pcx - bcx, -200 * dt, 200 * dt); b.y += clamp(A.y0 - 30 - b.y, -100 * dt, 100 * dt); if (A.t > 0.7) A.n = 2; }
        else if (A.n === 2) { b.y += 420 * dt; if (blockedAt(w, bcx, b.y + b.h + 2, 'p') || solidBelow(w, bcx, b.y + b.h + 2) || b.y + b.h > b.ar.y + b.ar.h) { slamLand(w, b); A.n = 3; A.t2 = 0; } }
        else { A.t2 += dt; b.y += clamp(A.y0 - b.y, -120 * dt, 120 * dt); if (A.t2 > 0.8) bossEnd(b); }
      } else if (d.move === 'still') {
        if (A.t > 0.6 && !A.done) { A.done = 1; slamLand(w, b); }
        if (A.t > 1.2) bossEnd(b);
      } else {
        if (A.n === 0) { if (b.ground) { b.vy = -460; b.vx = clamp((pcx - bcx) * 1.1, -260, 260); A.n = 1; sfx('jump'); } else bossGravity(w, b, dt); }
        else { const landed = bossGravity(w, b, dt); if (landed && A.n === 1 && A.t > 0.15) { slamLand(w, b); A.n = 2; A.t2 = 0; b.vx = 0; } if (A.n === 2) { A.t2 += dt; if (A.t2 > 0.5) bossEnd(b); } }
      }
      break;
    }
    case 'dash': {
      A.lockMove = true;
      if (A.t < dt * 1.5) { A.dir = pcx > bcx ? 1 : -1; sfx('charge'); }
      A.tele = A.t < 0.6;
      if (!A.tele) {
        const sp = 380 + d.diff * 30;
        if (d.move === 'hover' || d.move === 'bounce' || d.move === 'teleport') { b.x += A.dir * sp * dt; b.y += clamp(pcy - bcy, -150 * dt, 150 * dt); }
        else { b.vx = A.dir * sp; bossGravity(w, b, dt); }
        if (Math.random() < 0.7) spawnParts(w, bcx, b.y + b.h - 2, 2, '#c0c0c0', 50, 0.3, 0);
        const hitWall = b.x <= b.ar.x + 1 || b.x + b.w >= b.ar.x + b.ar.w - 1 || blockedAt(w, A.dir > 0 ? b.x + b.w + 3 : b.x - 3, bcy, 'p');
        if (hitWall || A.t > 1.8) { w.shake = 5; sfx('crush'); b.vx = 0; bossEnd(b); }
      } else if (d.move === 'walk' || d.move === 'still') bossGravity(w, b, dt, true);
      break;
    }
    case 'summon': {
      A.tele = A.t < 0.7;
      if (A.t >= 0.7 && !A.done) {
        A.done = 1;
        const alive = w.enemies.filter(e => !e.dead && e.minion).length;
        const n = Math.min(1 + b.phase + (d.diff >= 4 ? 1 : 0), 6 - alive);
        for (let i = 0; i < n; i++) {
          const sx = i % 2 ? b.ar.x + 24 + i * 6 : b.ar.x + b.ar.w - 24 - i * 6, sy = b.ar.y + 24;
          const e = makeEnemy({ x: sx, y: sy, def: d.minion, face: 'left' }); e.minion = true; e.alert = 5; e.d = Object.assign({}, e.d, { drop: 'ammo' });
          w.enemies.push(e); spawnParts(w, sx, sy, 16, d.eye, 100, 0.5, 0);
        }
        sfx('zap');
      }
      if (A.t > 1.2) bossEnd(b, 1.3);
      break;
    }
    case 'saws': {
      A.tele = A.t < 0.5;
      const n = 1 + Math.ceil(d.diff / 2);
      if (A.t >= 0.5 + A.n * 0.5 && A.n < n) {
        A.n++; const dir = A.n % 2 ? (pcx > bcx ? 1 : -1) : (pcx > bcx ? -1 : 1);
        w.saws.push({ t: 'saw', x: bcx + dir * (b.w / 2 + 12), y: b.y + b.h - 12, r: 10, dmg: 25 + d.diff * 3, rot: 0, temp: true, vx: dir * (150 + d.diff * 15), vy: -100, life: 6 });
        sfx('crush');
      }
      if (A.n >= n) bossEnd(b);
      break;
    }
    case 'shock': {
      if (A.t < dt * 1.5) {
        const n = 3 + d.diff;
        for (let i = 0; i < n; i++) {
          const x = i === 0 ? pcx : rand(b.ar.x + 10, b.ar.x + b.ar.w - 10);
          (w.strikes || (w.strikes = [])).push({ x, y0: b.ar.y, y1: b.ar.y + b.ar.h, t: -i * 0.15, warn: 0.9, dmg: 18 + d.diff * 3 });
        }
        sfx('charge');
      }
      A.tele = A.t < 0.9;
      if (A.t > 1.6) bossEnd(b);
      break;
    }
    case 'mines': {
      A.tele = A.t < 0.4;
      const n = 2 + Math.ceil(d.diff / 2);
      if (A.t >= 0.4 + A.n * 0.15 && A.n < n) {
        A.n++; (w.mines || (w.mines = [])).push({ x: bcx, y: bcy, vx: rand(-160, 160), vy: rand(-220, -80), t: 0, fuse: 3 + rand(0, 1), landed: false, dmg: 25 + d.diff * 3 });
      }
      if (A.n >= n) bossEnd(b, 1.2);
      break;
    }
    default: bossEnd(b);
  }
}

function slamLand(w, b) {
  const d = b.d; w.shake = 9; sfx('crush'); sfx('boom');
  const y = b.y + b.h, sp = 170 + d.diff * 20;
  (w.shocks || (w.shocks = [])).push({ x: b.x + b.w / 2 - 6, y, vx: -sp, life: 3, dmg: 20 + d.diff * 3 }, { x: b.x + b.w / 2 + 6, y, vx: sp, life: 3, dmg: 20 + d.diff * 3 });
  spawnParts(w, b.x + b.w / 2, y, 24, '#a09080', 160, 0.7, 300);
}
function bossBullet(w, b, a, spMul = 1) {
  const d = b.d, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  b.recoil = 1;
  w.bullets.push({ x: cx + Math.cos(a) * b.w * 0.4, y: cy + Math.sin(a) * b.h * 0.4, vx: Math.cos(a) * d.bs * spMul, vy: Math.sin(a) * d.bs * spMul, owner: 'e', dmg: d.bd, life: 4, col: d.eye, big: true, cause: d.name });
  sfx('eshoot');
}
function damageBoss(w, b, dmg) {
  if (b.dead || b.dying) return;
  if (!b.active) bossStart(w);
  if (b.d.move === 'teleport' && b.alpha < 0.5) return 'hit';
  b.hp -= dmg; b.flash = 0.06; sfx('ehurt');
  spawnParts(w, b.x + b.w / 2 + rand(-b.w / 3, b.w / 3), b.y + b.h / 2 + rand(-b.h / 3, b.h / 3), 3, '#ffd060', 80, 0.3, 200);
  if (b.hp <= 0) { b.hp = 0; b.dying = true; b.deadT = 0; b.atk = null; w.kills++; w.enemies.forEach(e => { if (e.minion && !e.dead) damageEnemy(w, e, 9999, null, true); }); sfx('roar'); }
  return 'hit';
}
