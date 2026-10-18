// FOUNDRY - drawing characters with procedural animation (rigs from anim.js).
'use strict';

const WHITE = { body: '#fff', light: '#fff', dark: '#fff', skin: '#fff', helmet: '#fff', eye: '#fff', legs: '#fff', legsDark: '#fff', boots: '#fff' };

function drawPlayer(ctx, P, w) {
  if (P.dead) return;
  if (P.inv > 0 && !w.dummy && (w.time * 20) % 2 < 1) return;
  // scarf first, so it is behind the body
  if (P.scarf) {
    const S = P.scarf.pts;
    for (let i = 1; i < S.length; i++) { ctx.fillStyle = i > S.length - 3 ? '#e04848' : '#b02c2c'; pline(ctx, S[i - 1].x, S[i - 1].y, S[i].x, S[i].y, i < 3 ? 2 : 1); }
  }
  const gun = P.weapon === 0 ? { len: 7, thick: 2, col: '#1c2026' } : { len: 10, thick: 3, col: '#4a5a3a', tip: '#c05040' };
  drawHumanoid(ctx, { x: P.x + P.w / 2, y: P.y + P.h, s: 1, face: P.face, o: P, aim: P.aim, kind: 'player', c: PLAYER_COLS, gun });
  if (P.water && (w.time * 2) % 1 < 0.1 && !w.editor) spawnParts(w, P.x + 5, P.y + 2, 1, '#a0d0ff', 10, 1, -30);
}

function enemyCols(d) {
  return d._cols || (d._cols = {
    body: d.color, light: shade(d.color, 0.28), dark: shade(d.color, -0.4), skin: '#b88a68', helmet: d.accent, eye: d.eye,
    legs: d.body === 'robot' ? shade(d.accent, 0.15) : shade(d.accent, 0.1), legsDark: shade(d.accent, -0.25), boots: '#141618',
  });
}
const GUN_LOOK = { pistol: [6, 2, '#1c2026'], rifle: [10, 2, '#1c2026'], shotgun: [9, 3, '#2a2420'], rocket: [11, 3, '#4a5a3a', '#c05040'], laser: [12, 2, '#2a2440', '#ff40ff'] };

function drawEnemy(ctx, e, w) {
  if (e.dead) return;
  const d = e.d, s = d.size || 1, f = e.face, C = e.flash > 0 ? WHITE : enemyCols(d);
  const aim = e.aimA ?? (f > 0 ? 0.25 : Math.PI - 0.25);
  const G = GUN_LOOK[d.weapon], gun = G ? { len: G[0] * s, thick: Math.max(G[1], Math.round(G[1] * s)), col: e.flash > 0 ? '#fff' : G[2], tip: G[3] === '#ff40ff' ? d.eye : G[3] } : null;
  const fx = e.x + e.w / 2, fy = e.y + e.h;
  if (d.body === 'soldier' || d.body === 'robot' || d.body === 'brute')
    drawHumanoid(ctx, { x: fx, y: fy, s: d.body === 'brute' ? s * 1.05 : s, face: f, o: e, aim, kind: d.body, c: C, gun });
  else if (d.body === 'drone') drawDrone(ctx, e, w, C, aim, gun);
  else if (d.body === 'crawler') drawCrawler(ctx, e, w, C);

  // laser sniper: aiming line while charging
  if (e.charge > 0 && gun) {
    const sx = e.x + e.w / 2, sy = e.y + e.h * 0.35;
    ctx.fillStyle = d.eye; ctx.globalAlpha = 0.4 + 0.4 * Math.sin(w.time * 30);
    const end = raycast(w, sx, sy, e.aimA, d.sight + 60, 'l'), D = dist(sx, sy, end.x, end.y);
    for (let i = 0; i < D; i += 2) ctx.fillRect(Math.round(sx + Math.cos(e.aimA) * i), Math.round(sy + Math.sin(e.aimA) * i), 1, 1);
    ctx.globalAlpha = 1;
  }
  // shield
  if (d.shield !== 'none') {
    const sh = e.sh;
    if (sh.up) {
      const sx = Math.round(f > 0 ? e.x + e.w + 1 : e.x - 4), y = Math.round(e.y) - 3, h = e.h + 4, wob = Math.round(Math.sin(w.time * 20) * 0.5);
      ctx.fillStyle = 'rgba(140,210,255,0.3)'; ctx.fillRect(sx, y, 3, h);
      ctx.fillStyle = '#a8dcff'; ctx.fillRect(sx + (f > 0 ? 2 : 0) + wob, y, 1, h);
      ctx.fillStyle = 'rgba(200,240,255,' + (0.3 + 0.3 * Math.sin(w.time * 6)) + ')'; ctx.fillRect(sx, y + Math.round((w.time * 40) % h), 3, 1);
      ctx.fillStyle = '#5a7a9a'; ctx.fillRect(sx, y, 3, 1); ctx.fillRect(sx, y + h - 1, 3, 1);
    } else if (sh.hp > 0) {
      ctx.fillStyle = '#5a7a9a'; ctx.fillRect(Math.round(f > 0 ? e.x - 2 : e.x + e.w), Math.round(e.y + e.h * 0.4), 2, Math.round(e.h * 0.45));
    }
  }
  if (e.hp < d.maxHp) { const x = Math.round(e.x); ctx.fillStyle = '#300'; ctx.fillRect(x, Math.round(e.y) - 6, e.w, 2); ctx.fillStyle = '#e03030'; ctx.fillRect(x, Math.round(e.y) - 6, Math.max(0, Math.round(e.w * e.hp / d.maxHp)), 2); }
  if (e.alert > 2.3 && !w.editor) ptext(ctx, '!', e.x + e.w / 2, e.y - 14 - Math.round(Math.sin((2.5 - e.alert) * 20) * 2), '#ff4040', 1, 'c');
}

function drawDrone(ctx, e, w, C, aim, gun) {
  const s = e.d.size || 1, cx = e.x + e.w / 2, cy = e.y + e.h / 2 + Math.sin((e.t || 0) * 4) * 1;
  const tilt = clamp((e.vx || 0) * 0.012, -0.45, 0.45), c = Math.cos(tilt), sn = Math.sin(tilt);
  const P = (u, v) => [cx + u * c - v * sn, cy + u * sn + v * c];
  // rotors
  const t = w.time;
  for (const u of [-6, 6]) {
    const [rx, ry] = P(u * s, -4 * s), bl = Math.abs(Math.cos(t * 50 + u)) * 6 * s;
    ctx.fillStyle = C.legs; pline(ctx, ...P(u * s, -2 * s), rx, ry, 1);
    ctx.fillStyle = 'rgba(200,210,220,0.8)'; pline(ctx, rx - bl, ry, rx + bl, ry, 1);
  }
  // body
  ctx.fillStyle = C.dark; pline(ctx, ...P(-7 * s, 0), ...P(7 * s, 0), Math.round(6 * s));
  ctx.fillStyle = C.body; pline(ctx, ...P(-6 * s, -0.5), ...P(6 * s, -0.5), Math.round(4 * s));
  ctx.fillStyle = C.light; pline(ctx, ...P(-5 * s, -2 * s), ...P(5 * s, -2 * s), 1);
  // eye that looks where it aims
  const [ex, ey] = P(e.face * 3 * s, 0);
  ctx.fillStyle = '#111'; pcircle(ctx, ex, ey, Math.max(1, Math.round(2 * s)));
  ctx.fillStyle = C.eye; ctx.fillRect(Math.round(ex + Math.cos(aim) * s), Math.round(ey + Math.sin(aim) * s), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
  // gun pod hangs underneath
  if (gun) {
    const [gx, gy] = P(0, 4 * s);
    ctx.fillStyle = C.dark; ctx.fillRect(Math.round(gx) - 2, Math.round(gy) - 1, 4, 3);
    const rc = (e.recoil || 0) * 2;
    ctx.fillStyle = gun.col; pline(ctx, gx, gy, gx + Math.cos(aim) * (gun.len * 0.8 - rc), gy + Math.sin(aim) * (gun.len * 0.8 - rc), gun.thick);
  }
  if (Math.random() < 0.15 && !w.editor) w.parts.push({ x: cx + rand(-4, 4), y: cy + 4 * s, vx: rand(-5, 5), vy: rand(20, 40), life: 0.3, max: 0.3, col: '#60c0ff', grav: 0, size: 1 });
}

function drawCrawler(ctx, e, w, C) {
  const s = e.d.size || 1, cx = e.x + e.w / 2, by = e.y + e.h - 3 * s;
  const L = 5 * s, f = e.face;
  // legs: hips on the body, feet planted on the ground (IK knees bend upward)
  const feet = e.feet || [-8, -3, 5, -6, 1, 7].map(o => ({ x: cx + o * s * f, y: e.y + e.h }));
  feet.forEach((ft, i) => {
    const hx = cx + [-5, -1, 3, -4, 0, 4][i] * s * f * 0.9, hy = by - 1;
    const k = ikKnee(hx, hy, ft.x, ft.y, L, L * 1.1, ft.x > hx ? -1 : 1);
    ctx.fillStyle = i >= 3 ? C.legsDark : C.dark; pline(ctx, hx, hy, k.kx, k.ky, 1); pline(ctx, k.kx, k.ky, k.fx, k.fy, 1);
  });
  // segmented body that wiggles
  const t = e.t || 0;
  for (let i = 0; i < 4; i++) {
    const ox = (-6 + i * 4) * s * f, oy = Math.sin(t * 12 + i) * 0.6 * (e.move || 0);
    ctx.fillStyle = i % 2 ? C.body : C.dark; pcircle(ctx, cx + ox, by - 2 * s + oy, Math.max(2, Math.round((i === 3 ? 3 : 2.6) * s)));
  }
  ctx.fillStyle = C.light; ctx.fillRect(Math.round(cx - 6 * s), Math.round(by - 5 * s), Math.round(10 * s), 1);
  // head with snapping jaws
  const hx = cx + 7 * s * f, hy = by - 2.5 * s, jaw = (Math.sin(t * 14) * 0.5 + 0.5) * 1.5 * s;
  ctx.fillStyle = C.body; pcircle(ctx, hx, hy, Math.max(2, Math.round(2.5 * s)));
  ctx.fillStyle = C.dark; pline(ctx, hx + f * 2 * s, hy - 1, hx + f * 4 * s, hy - 1 - jaw, 1); pline(ctx, hx + f * 2 * s, hy + 1, hx + f * 4 * s, hy + 1 + jaw, 1);
  ctx.fillStyle = C.eye; ctx.fillRect(Math.round(hx + f * s), Math.round(hy - 1.5 * s), 1, 1); ctx.fillRect(Math.round(hx + f * 0.5 * s - 1), Math.round(hy - 1.5 * s), 1, 1);
}

// ---------------------------------------------------------------------------------
function drawBoss(ctx, b, w) {
  if (b.dead) return;
  const d = b.d, s = d.size || 1, t = w.time;
  ctx.globalAlpha = b.alpha ?? 1;
  const fla = b.flash > 0 || (b.dying && (t * 15) % 2 < 1);
  const C = fla ? Object.assign({}, WHITE, { accent: '#fff' }) : { body: d.color, light: shade(d.color, 0.28), dark: shade(d.color, -0.38), accent: d.accent, acLight: shade(d.accent, 0.25) };
  const tele = b.atk && b.atk.tele, eye = tele && (t * 12) % 2 < 1 ? '#ffffff' : d.eye;
  const aim = b.aimA ?? Math.PI, cx = b.x + b.w / 2, f = b.face || -1;
  const B = { ctx, b, s, C, eye, aim, cx, f, t };
  ({ mech: bossMech, tank: bossTank, drone: bossDrone, core: bossCore, walker: bossWalker }[d.body] || bossMech)(B);
  ctx.globalAlpha = 1;
  // attack telegraphs + beams
  const A = b.atk;
  if (A && A.k === 'sweep' && A.ex != null) {
    const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
    if (A.on) { ctx.fillStyle = '#ff3030'; pline(ctx, bcx, bcy, A.ex, A.ey, 4); ctx.fillStyle = '#ffd0c0'; pline(ctx, bcx, bcy, A.ex, A.ey, 2); }
    else { ctx.fillStyle = (t * 10) % 1 < 0.5 ? 'rgba(255,60,60,0.7)' : 'rgba(255,60,60,0.2)'; const D = dist(bcx, bcy, A.ex, A.ey); for (let i = 0; i < D; i += 3) ctx.fillRect(Math.round(bcx + Math.cos(A.ang) * i), Math.round(bcy + Math.sin(A.ang) * i), 1, 1); }
  }
  if (A && A.k === 'dash' && A.tele) { ctx.fillStyle = 'rgba(255,60,60,0.5)'; const yy = Math.round(b.y + b.h / 2); for (let i = 0; i < 120; i += 4) ctx.fillRect(Math.round(b.x + b.w / 2 + A.dir * (b.w / 2 + i)), yy, 2, 1); }
  if (A && A.k === 'summon' && A.tele) { ctx.fillStyle = d.eye; for (const sx of [b.ar.x + 24, b.ar.x + b.ar.w - 24]) pring(ctx, sx, b.ar.y + 24, Math.round(4 + A.t * 10)); }
}
function eyeBall(B, x, y, r) {
  const { ctx, eye, aim } = B;
  ctx.fillStyle = '#0c0c0e'; pcircle(ctx, x, y, r + 1);
  ctx.fillStyle = eye; pcircle(ctx, x + Math.cos(aim) * r * 0.4, y + Math.sin(aim) * r * 0.4, Math.max(1, Math.round(r * 0.6)));
  ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x + Math.cos(aim) * r * 0.4) - 1, Math.round(y + Math.sin(aim) * r * 0.4) - 1, 1, 1);
}
function bossLegs(B, hipY, L1, L2, th, kneeDir) {
  const { ctx, b, C, s } = B;
  const sp = (b.d.body === 'walker' ? 13 : 10) * s;
  const feet = b.feet || [{ x: b.x + b.w / 2 - sp, y: b.y + b.h }, { x: b.x + b.w / 2 + sp, y: b.y + b.h }];
  feet.forEach((ft, i) => {
    const hx = b.x + b.w / 2 + (i ? 1 : -1) * 9 * s * (b.d.body === 'walker' ? 1.2 : 1);
    const k = ikKnee(hx, hipY, ft.x, ft.y, L1, L2, (ft.x > hx ? 1 : -1) * kneeDir);
    ctx.fillStyle = i ? C.accent : shade(C.accent === '#fff' ? '#ffffff' : C.accent, -0.2);
    pline(ctx, hx, hipY, k.kx, k.ky, th); pline(ctx, k.kx, k.ky, k.fx, k.fy, th - 1);
    ctx.fillStyle = C.dark; pcircle(ctx, k.kx, k.ky, Math.max(2, Math.round(th / 2 + 0.5)));
    ctx.fillStyle = C.dark; ctx.fillRect(Math.round(k.fx - 4 * s), Math.round(k.fy) - 2, Math.round(8 * s), 2);
  });
}
function cannon(B, x, y, len, th) {
  const { ctx, b, C, aim } = B, rc = (b.recoil || 0) * 3;
  ctx.fillStyle = C.dark; pcircle(ctx, x, y, Math.round(th * 0.9));
  ctx.fillStyle = '#1a1c20'; pline(ctx, x, y, x + Math.cos(aim) * (len - rc), y + Math.sin(aim) * (len - rc), th);
  ctx.fillStyle = C.light; pline(ctx, x + Math.cos(aim) * 2, y + Math.sin(aim) * 2 - 1, x + Math.cos(aim) * (len - rc - 1), y + Math.sin(aim) * (len - rc - 1) - 1, 1);
}
function bossMech(B) {
  const { ctx, b, s, C, t } = B, cx = b.x + b.w / 2;
  const bob = Math.sin((b.dist || 0) * 0.15) * 1.5 * (b.move || 0) + Math.sin(t * 2) * 0.6;
  const bodyY = b.y + 10 * s + bob, bw = 30 * s, bh = 20 * s;
  bossLegs(B, bodyY + bh - 2, 12 * s, 12 * s, Math.max(3, Math.round(4 * s)), -1);
  ctx.fillStyle = C.dark; ctx.fillRect(Math.round(cx - bw / 2), Math.round(bodyY), Math.round(bw), Math.round(bh));
  ctx.fillStyle = C.body; ctx.fillRect(Math.round(cx - bw / 2 + 2), Math.round(bodyY + 2), Math.round(bw - 4), Math.round(bh - 5));
  ctx.fillStyle = C.light; ctx.fillRect(Math.round(cx - bw / 2 + 2), Math.round(bodyY + 2), Math.round(bw - 4), 1);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = C.dark; ctx.fillRect(Math.round(cx - bw / 2 + 5 + i * 7 * s), Math.round(bodyY + bh - 7 * s), 3, 2); }
  ctx.fillStyle = '#d8b02a'; ctx.fillRect(Math.round(cx - bw / 2 + 2), Math.round(bodyY + bh - 3), Math.round(bw - 4), 1);
  // cockpit
  ctx.fillStyle = C.dark; ctx.fillRect(Math.round(cx - 8 * s), Math.round(bodyY - 7 * s), Math.round(16 * s), Math.round(9 * s));
  eyeBall(B, cx + B.f * 2 * s, bodyY - 3 * s, Math.max(2, Math.round(2.5 * s)));
  // arm cannons
  cannon(B, cx - bw / 2 - 1, bodyY + 6 * s, 15 * s, Math.max(3, Math.round(4 * s)));
  cannon(B, cx + bw / 2 + 1, bodyY + 6 * s, 15 * s, Math.max(3, Math.round(4 * s)));
  if (Math.random() < 0.08) w_puff(b, cx - bw / 2 + 4, bodyY - 2);
}
function bossWalker(B) {
  const { ctx, b, s, C, t } = B, cx = b.x + b.w / 2;
  const bob = Math.sin((b.dist || 0) * 0.1) * 2 * (b.move || 0) + Math.sin(t * 1.6);
  const bodyY = b.y + 4 * s + bob;
  bossLegs(B, bodyY + 16 * s, 18 * s, 18 * s, Math.max(3, Math.round(3 * s)), 1);
  ctx.fillStyle = C.dark; ctx.fillRect(Math.round(cx - 16 * s), Math.round(bodyY), Math.round(32 * s), Math.round(18 * s));
  ctx.fillStyle = C.body; ctx.fillRect(Math.round(cx - 15 * s), Math.round(bodyY + 1), Math.round(30 * s), Math.round(14 * s));
  ctx.fillStyle = C.light; ctx.fillRect(Math.round(cx - 15 * s), Math.round(bodyY + 1), Math.round(30 * s), 1);
  ctx.fillStyle = '#111'; ctx.fillRect(Math.round(cx - 9 * s), Math.round(bodyY + 4 * s), Math.round(18 * s), Math.round(7 * s));
  eyeBall(B, cx + B.f * 3 * s, bodyY + 7.5 * s, Math.max(2, Math.round(2.5 * s)));
  cannon(B, cx + B.f * 15 * s, bodyY + 12 * s, 12 * s, Math.max(2, Math.round(3 * s)));
  ctx.fillStyle = C.acLight; pline(ctx, cx - B.f * 10 * s, bodyY, cx - B.f * 12 * s + Math.sin(t * 3) * 2, bodyY - 8 * s, 1);
}
function bossTank(B) {
  const { ctx, b, s, C, t } = B, x = b.x, y = b.y, W = b.w, H = b.h, dd = b.dist || 0;
  // treads with moving links + spinning wheels
  const ty = y + H - 10 * s;
  ctx.fillStyle = '#1e2024'; ctx.fillRect(Math.round(x + 2), Math.round(ty), Math.round(W - 4), Math.round(10 * s));
  ctx.fillStyle = '#3a3e44';
  for (let k = ((dd % 6) + 6) % 6; k < W - 6; k += 6) { ctx.fillRect(Math.round(x + 3 + k), Math.round(ty), 3, 1); ctx.fillRect(Math.round(x + W - 6 - k), Math.round(ty + 10 * s - 1), 3, 1); }
  const n = 5, r = Math.round(3.5 * s);
  for (let i = 0; i < n; i++) {
    const wx = x + 8 * s + i * (W - 16 * s) / (n - 1), wy = ty + 5 * s, a = dd / (r + 0.01);
    ctx.fillStyle = C.accent; pcircle(ctx, wx, wy, r); ctx.fillStyle = C.dark; pline(ctx, wx - Math.cos(a) * r, wy - Math.sin(a) * r, wx + Math.cos(a) * r, wy + Math.sin(a) * r, 1);
  }
  // hull
  ctx.fillStyle = C.dark; ctx.fillRect(Math.round(x + 4 * s), Math.round(y + 10 * s), Math.round(W - 8 * s), Math.round(11 * s));
  ctx.fillStyle = C.body; ctx.fillRect(Math.round(x + 5 * s), Math.round(y + 11 * s), Math.round(W - 10 * s), Math.round(8 * s));
  ctx.fillStyle = C.light; ctx.fillRect(Math.round(x + 5 * s), Math.round(y + 11 * s), Math.round(W - 10 * s), 1);
  // turret aims at you
  const tx = x + W / 2, tyy = y + 9 * s;
  ctx.fillStyle = C.dark; pcircle(ctx, tx, tyy, Math.round(8 * s)); ctx.fillStyle = C.body; pcircle(ctx, tx, tyy - 1, Math.round(6.5 * s));
  B.aim = clamp(B.aim > 0.6 && B.aim < 2.5 ? (B.aim < Math.PI / 2 ? 0.6 : 2.5) : B.aim, -Math.PI, Math.PI);
  cannon(B, tx, tyy, 22 * s, Math.max(3, Math.round(4 * s)));
  eyeBall(B, tx, tyy - 2 * s, Math.max(1, Math.round(1.8 * s)));
  if (Math.random() < 0.1) w_puff(b, x + 6 * s, y + 10 * s);
}
function bossDrone(B) {
  const { ctx, b, s, C, t } = B, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const tilt = clamp((b.vx || 0) * 0.004 + Math.sin(t * 1.3) * 0.06, -0.35, 0.35), c = Math.cos(tilt), sn = Math.sin(tilt);
  const P = (u, v) => [cx + u * c - v * sn, cy + u * sn + v * c];
  for (const u of [-15, 15]) {
    const [rx, ry] = P(u * s, -10 * s), bl = Math.abs(Math.cos(t * 40 + u)) * 11 * s;
    ctx.fillStyle = C.accent; pline(ctx, ...P(u * s, -5 * s), rx, ry, 2);
    ctx.fillStyle = 'rgba(210,215,225,0.75)'; pline(ctx, rx - bl, ry, rx + bl, ry, 2);
  }
  // claws hang and swing
  for (const u of [-8, 8]) {
    const [ax, ay] = P(u * s, 7 * s), sw = (b.swing || 0) * 4 + Math.sin(t * 2 + u) * 0.15;
    const ex = ax + Math.sin(sw) * 9 * s, ey = ay + Math.cos(sw) * 9 * s;
    ctx.fillStyle = C.accent; pline(ctx, ax, ay, ex, ey, 2);
    ctx.fillStyle = C.dark; pline(ctx, ex, ey, ex - 3 * s, ey + 3 * s, 2); pline(ctx, ex, ey, ex + 3 * s, ey + 3 * s, 2);
  }
  ctx.fillStyle = C.dark; pline(ctx, ...P(-18 * s, 0), ...P(18 * s, 0), Math.round(14 * s));
  ctx.fillStyle = C.body; pline(ctx, ...P(-16 * s, -1), ...P(16 * s, -1), Math.round(10 * s));
  ctx.fillStyle = C.light; pline(ctx, ...P(-14 * s, -5 * s), ...P(14 * s, -5 * s), 1);
  const [ex, ey] = P(0, 0); eyeBall(B, ex, ey, Math.max(3, Math.round(4.5 * s)));
}
function bossCore(B) {
  const { ctx, b, s, C, t } = B, cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = 17 * s;
  // hanging cables sway behind it
  ctx.fillStyle = '#16181c';
  for (let k = -2; k <= 2; k++) { let px = cx + k * 7 * s, py = cy - R; for (let i = 1; i < 8; i++) { const nx = cx + k * 7 * s + Math.sin(t * 1.5 + i * 0.6 + k) * i * 0.8, ny = cy - R - i * 6; pline(ctx, px, py, nx, ny, 2); px = nx; py = ny; } }
  ctx.fillStyle = C.dark; pcircle(ctx, cx, cy, Math.round(R));
  ctx.fillStyle = C.body; pcircle(ctx, cx, cy, Math.round(R - 3 * s));
  // rotating armour plates
  for (let k = 0; k < 8; k++) {
    const a = t * (b.phase ? 1.3 + b.phase * 0.5 : 0.8) + k * Math.PI / 4, open = b.atk && b.atk.tele ? 3 * s : 0;
    ctx.fillStyle = k % 2 ? C.accent : C.acLight;
    pline(ctx, cx + Math.cos(a) * (R - 1 + open), cy + Math.sin(a) * (R - 1 + open), cx + Math.cos(a + 0.4) * (R - 1 + open), cy + Math.sin(a + 0.4) * (R - 1 + open), Math.max(2, Math.round(3 * s)));
  }
  const pulse = 1 + Math.sin(t * 5) * 0.15;
  ctx.fillStyle = '#0c0c0e'; pcircle(ctx, cx, cy, Math.round(9 * s * pulse));
  eyeBall(B, cx, cy, Math.max(3, Math.round(6 * s * pulse)));
}
function w_puff(b, x, y) { const w = G.w && G.w.boss === b ? G.w : (MK.world && MK.world.boss === b ? MK.world : null); if (w) w.parts.push({ x, y, vx: rand(-10, 10), vy: rand(-40, -20), life: 0.9, max: 0.9, col: '#6a6a6a', grav: -10, size: 2 }); }
