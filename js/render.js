// FOUNDRY - drawing the world as pixel art (everything is drawn in code, no image files).
'use strict';

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// seeded random so textures look the same every time
function srand(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// pixel line (Bresenham) so lines stay crisp
function pline(ctx, x0, y0, x1, y1, s = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0, o = Math.floor(s / 2);
  while (n++ < 2000) {
    ctx.fillRect(x0 - o, y0 - o, s, s);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function pcircle(ctx, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - h, cy + dy, h * 2 + 1, 1); }
}
function pring(ctx, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let a = 0; a < Math.PI * 2; a += 1 / Math.max(r, 1)) ctx.fillRect(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 1, 1);
}
// scaled crisp rectangle helper for sprites: R(x, y, w, h, col)
function sprite(ctx, ox, oy, s, flip, bw) {
  return (x, y, w, h, c) => {
    if (c) ctx.fillStyle = c;
    if (flip) x = bw - x - w;
    ctx.fillRect(Math.round(ox + x * s), Math.round(oy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
}

// ---- tile textures --------------------------------------------------------------
const TEX = {};
function tileTex(ch, v, bg) {
  const key = (bg ? 'b' : 'f') + ch + v; if (TEX[key]) return TEX[key];
  const c = mkCanvas(TS, TS), g = c.getContext('2d'), r = srand(ch.charCodeAt(0) * 97 + v * 13 + (bg ? 500 : 0));
  const F = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const speck = (n, col) => { for (let i = 0; i < n; i++) F(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1, col); };
  if (!bg) switch (ch) {
    case '#': F(0, 0, 16, 16, '#58616d'); F(0, 0, 16, 1, '#6f7a87'); F(0, 0, 1, 16, '#66707c'); F(0, 15, 16, 1, '#3b424b'); F(15, 0, 1, 16, '#444b55');
      speck(6, '#4e5661'); F(2, 2, 1, 1, '#8a96a3'); F(13, 2, 1, 1, '#8a96a3'); F(2, 13, 1, 1, '#8a96a3'); F(13, 13, 1, 1, '#8a96a3');
      if (v === 1) F(4, 7, 8, 1, '#4b535d'); if (v === 2) { F(3, 4, 1, 6, '#4b535d'); } break;
    case 'C': F(0, 0, 16, 16, '#6b675f'); speck(22, '#5d5952'); speck(10, '#7a766d'); F(0, 15, 16, 1, '#4f4b45'); F(15, 0, 1, 16, '#57534c');
      if (v === 3) { F(5, 3, 1, 4, '#4f4b45'); F(6, 6, 1, 3, '#4f4b45'); } break;
    case 'R': F(0, 0, 16, 16, '#6e4a33'); for (let i = 0; i < 5; i++) F(Math.floor(r() * 12), Math.floor(r() * 12), 2 + Math.floor(r() * 4), 1 + Math.floor(r() * 3), r() < .5 ? '#8a5530' : '#5a3a28');
      speck(8, '#a0653a'); F(0, 0, 16, 1, '#87603f'); F(0, 15, 16, 1, '#3e2a1e'); F(15, 0, 1, 16, '#4a3222'); F(2, 2, 1, 1, '#b07a50'); F(13, 13, 1, 1, '#b07a50'); break;
    case 'H': F(0, 0, 16, 16, '#1e1e1e'); g.fillStyle = '#d8b02a'; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + y) >> 2) % 2 === 0) g.fillRect(x, y, 1, 1);
      F(0, 0, 16, 1, '#f0d050'); F(0, 15, 16, 1, '#3a3010'); break;
    case 'G': for (let y = 0; y < 16; y += 4) F(0, y, 16, 1, '#55606b'); for (let x = 0; x < 16; x += 4) F(x, 0, 1, 16, '#4a5560'); F(0, 0, 16, 1, '#6c7884'); F(0, 15, 16, 1, '#333a42'); break;
    case '=': F(0, 0, 16, 3, '#9a6a35'); F(0, 0, 16, 1, '#c08848'); F(0, 3, 16, 1, '#5a3a1a');
      g.fillStyle = '#7a5228'; for (let i = 0; i < 8; i++) { g.fillRect(i, 4 + i, 1, 1); g.fillRect(15 - i, 4 + i, 1, 1); } F(0, 11, 16, 1, '#6a4520'); break;
    case 'L': F(2, 0, 2, 16, '#8a7a4a'); F(12, 0, 2, 16, '#8a7a4a'); F(2, 0, 1, 16, '#a89860'); for (let y = 2; y < 16; y += 5) F(4, y, 8, 2, '#7a6a3a'); break;
    case '^': case 'v': case '<': case '>': {
      // 4 spikes; A = across the tile, B = along (tip at B=6, base at B=13)
      const put = (A, B, cc) => { if (A < 0 || A > 15) return; if (ch === '^') F(A, B, 1, 1, cc); else if (ch === 'v') F(A, 15 - B, 1, 1, cc); else if (ch === '<') F(B, A, 1, 1, cc); else F(15 - B, A, 1, 1, cc); };
      for (let k = 0; k < 4; k++) for (let i = 0; i < 8; i++) {
        const hw = Math.floor(i / 3), bx = k * 4 + 2;
        for (let j = -hw; j <= hw; j++) put(bx + j, 6 + i, j < 0 ? '#e0e6ec' : j === 0 ? '#b0b8c0' : '#7a828a');
      }
      const base = (x, y, w, h) => F(x, y, w, h, '#4a5058');
      if (ch === '^') base(0, 14, 16, 2); if (ch === 'v') base(0, 0, 16, 2); if (ch === '<') base(14, 0, 2, 16); if (ch === '>') base(0, 0, 2, 16);
      break;
    }
  } else switch (ch) {
    case 'w': F(0, 0, 16, 16, '#232830'); F(0, 0, 16, 1, '#2b313a'); F(0, 15, 16, 1, '#1a1e24'); F(15, 0, 1, 16, '#1c2027'); speck(4, '#20252c'); if (v === 0) F(3, 3, 10, 1, '#1e2229'); break;
    case 'p': F(0, 0, 16, 16, '#24211e'); F(3, 0, 4, 16, '#3a342c'); F(3, 0, 1, 16, '#4a4236'); F(10, 0, 3, 16, '#33302a'); if (v % 2) { F(2, 6, 6, 2, '#4a4236'); } break;
    case 'b': F(0, 0, 16, 16, '#2a221e'); for (let y = 0; y < 16; y += 4) { F(0, y, 16, 1, '#1d1714'); const o = (y / 4) % 2 ? 4 : 0; for (let x = o; x < 16; x += 8) F(x, y, 1, 4, '#1d1714'); } break;
    case 'm': F(0, 0, 16, 16, '#151a20'); for (let i = 0; i < 16; i += 3) { F(i, 0, 1, 16, '#252c35'); F(0, i, 16, 1, '#252c35'); } break;
    case 'c': F(0, 0, 16, 16, '#25231a'); g.fillStyle = '#3a3420'; for (let y = 10; y < 14; y++) for (let x = 0; x < 16; x++) if (((x + y) >> 1) % 2 === 0) g.fillRect(x, y, 1, 1); break;
  }
  return TEX[key] = c;
}

// far-away factory skyline (parallax background)
const SKY = {};
function skyline(theme) {
  const k = theme.sky.join(); if (SKY[k]) return SKY[k];
  const c = mkCanvas(VW, VH), g = c.getContext('2d'), r = srand(7);
  const grd = g.createLinearGradient(0, 0, 0, VH); grd.addColorStop(0, theme.sky[0]); grd.addColorStop(1, theme.sky[1]);
  g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
  const far = shade(theme.sky[1], 0.08), near = shade(theme.sky[0], 0.1);
  for (const [col, base, hmax] of [[far, VH * 0.55, 160], [near, VH * 0.7, 120]]) {
    g.fillStyle = col; let x = 0;
    while (x < VW) {
      const w = 20 + Math.floor(r() * 50), h = 30 + Math.floor(r() * hmax);
      g.fillRect(x, base - h, w, VH - base + h);
      if (r() < 0.4) { const cw = 4 + Math.floor(r() * 5); g.fillRect(x + Math.floor(r() * (w - cw)), base - h - 20 - r() * 60, cw, 80); }
      if (r() < 0.5) for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,190,110,' + (0.1 + r() * 0.2) + ')'; g.fillRect(x + 3 + Math.floor(r() * (w - 6)), base - h + 6 + Math.floor(r() * h * 0.6), 2, 2); g.fillStyle = col; }
      x += w + Math.floor(r() * 8);
    }
  }
  return SKY[k] = c;
}

// ---- main draw -------------------------------------------------------------------
// ctx is a low-res buffer (vw x vh). cam = top-left of the view in world pixels.
function drawWorld(ctx, w, cam, vw, vh, opt = {}) {
  const t = w.time, cx = Math.round(cam.x), cy = Math.round(cam.y);
  // sky
  const sky = skyline(w.theme), px = -Math.round(cx * 0.15) % VW;
  for (let ox = px - VW; ox < vw; ox += VW) for (let oy = 0; oy < vh; oy += VH) ctx.drawImage(sky, ox, oy - Math.round(cy * 0.05) % VH);
  ctx.save(); ctx.translate(-cx, -cy);
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(w.W - 1, Math.floor((cx + vw) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(w.H - 1, Math.floor((cy + vh) / TS));
  // back wall tiles
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = w.bg[y][x]; if (ch !== '.') ctx.drawImage(tileTex(ch, (x * 7 + y * 13) % 4, true), x * TS, y * TS);
  }
  // shadow under solid tiles onto the back wall
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const T = TILES[w.fg[y][x]]; if (T && T.solid && !T.gate && w.bg[y][x + 1] && !TILES[w.fg[y][x + 1]]?.solid) ctx.fillRect(x * TS + TS, y * TS + 3, 3, TS); }

  const decoBack = [], decoFront = [];
  for (const d of w.decos) (d.front ? decoFront : decoBack).push(d);
  for (const d of decoBack) drawDeco(ctx, d, t);

  // foreground tiles (not water)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = w.fg[y][x]; if (ch === '.' || ch === '~') continue;
    const T = TILES[ch];
    if (T.gate) { drawGate(ctx, x * TS, y * TS, w.gatesClosed, t, w.editor); continue; }
    ctx.drawImage(tileTex(ch, (x * 7 + y * 13) % 4), x * TS, y * TS);
    if (T.solid && ch !== 'G') {
      const sol = (dx, dy) => { const q = TILES[tileAt(w, x + dx, y + dy)]; return q && q.solid && !q.gate && tileAt(w, x + dx, y + dy) !== 'G'; };
      if (!sol(0, -1)) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x * TS, y * TS, TS, 1); }
      // tiles deep inside a wall get darker, so big walls have depth
      else if (sol(-1, 0) && sol(1, 0) && sol(0, 1)) {
        const deep2 = sol(0, -2) && sol(-2, 0) && sol(2, 0) && sol(0, 2);
        ctx.fillStyle = deep2 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)'; ctx.fillRect(x * TS, y * TS, TS, TS);
      }
    }
  }

  // exit, checkpoints, signs, platforms, pickups
  if (w.exit) drawExit(ctx, w.exit, !w.boss || w.boss.dead, t);
  for (const c of w.checkpoints) drawCheckpoint(ctx, c, t);
  for (const s of w.signs) drawSign(ctx, s, t);
  for (const p of w.platforms) drawPlatform(ctx, p);
  for (const k of w.pickups) if (!k.taken) drawPickup(ctx, k, t);
  for (const c of w.crushers) drawCrusher(ctx, c, t);
  for (const L of w.lasers) drawLaser(ctx, L, t, w.editor);
  for (const T of w.turrets) drawTurret(ctx, T, t, w.editor);
  for (const c of w.coils) drawCoil(ctx, c, t);
  for (const s of w.saws) drawSaw(ctx, s);
  for (const m of (w.mines || [])) { const blink = m.landed && (m.t * (m.t > m.fuse - 1 ? 12 : 4)) % 1 < 0.5; ctx.fillStyle = '#3a3a3a'; ctx.fillRect(m.x - 4, m.y - 2, 8, 5); ctx.fillStyle = blink ? '#ff3030' : '#802020'; ctx.fillRect(m.x - 1, m.y - 3, 2, 2); }
  if (w.boss) drawBoss(ctx, w.boss, w);
  for (const e of w.enemies) drawEnemy(ctx, e, w);
  if (w.player) drawPlayer(ctx, w.player, w);

  // bullets & rockets
  for (const b of w.bullets) {
    ctx.fillStyle = b.col || '#fff';
    if (b.big) { ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2); }
    else { pline(ctx, b.x, b.y, b.x - b.vx * 0.012, b.y - b.vy * 0.012, 1); }
  }
  for (const r of w.rockets) { ctx.fillStyle = r.owner === 'p' ? '#c0c8c0' : '#c05040'; pline(ctx, r.x, r.y, r.x - Math.cos(r.a) * 6, r.y - Math.sin(r.a) * 6, 2); ctx.fillStyle = '#ffd060'; ctx.fillRect(Math.round(r.x - Math.cos(r.a) * 7) - 1, Math.round(r.y - Math.sin(r.a) * 7) - 1, 2, 2); }
  // effects
  for (const s of (w.shocks || [])) { ctx.fillStyle = '#ffd080'; for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(s.x) - 3 + i * 2, Math.round(s.y) - 4 - (i % 2) * 6 - Math.floor(Math.random() * 3), 2, 4 + (i % 2) * 6); }
  for (const s of (w.strikes || [])) {
    if (s.t < 0) continue;
    if (s.t < s.warn) { ctx.fillStyle = (s.t * 10) % 1 < 0.5 ? 'rgba(255,240,120,0.6)' : 'rgba(255,240,120,0.25)'; ctx.fillRect(Math.round(s.x) - 8, s.y1 - 3, 16, 2); ctx.fillRect(Math.round(s.x), s.y0, 1, s.y1 - s.y0); }
    else { ctx.fillStyle = '#fff8c0'; let x = s.x; for (let y = s.y0; y < s.y1; y += 6) { const nx = s.x + rand(-5, 5); pline(ctx, x, y, nx, y + 6, 2); x = nx; } }
  }
  for (const b of (w.beams || [])) { ctx.fillStyle = b.col || '#ff40ff'; pline(ctx, b.x1, b.y1, b.x2, b.y2, 2); ctx.fillStyle = '#fff'; pline(ctx, b.x1, b.y1, b.x2, b.y2, 1); }
  for (const p of w.parts) { ctx.fillStyle = p.col; ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const b of w.booms) { ctx.fillStyle = 'rgba(255,220,140,' + (b.life / 0.35) + ')'; pcircle(ctx, b.x, b.y, Math.round(b.r * 0.6)); ctx.fillStyle = 'rgba(255,120,40,' + (b.life / 0.35 * 0.8) + ')'; pring(ctx, b.x, b.y, Math.round(b.r)); }

  for (const d of decoFront) drawDeco(ctx, d, t);
  // water on top (see-through)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.fg[y][x] === '~') {
    ctx.fillStyle = 'rgba(40,110,170,0.45)'; ctx.fillRect(x * TS, y * TS, TS, TS);
    if (tileAt(w, x, y - 1) !== '~') { ctx.fillStyle = 'rgba(160,210,255,0.7)'; for (let i = 0; i < TS; i++) { const h = Math.sin((x * TS + i) * 0.4 + t * 3) > 0.3 ? 1 : 0; ctx.fillRect(x * TS + i, y * TS + h, 1, 1); } }
  }
  for (const tx of w.texts) ptext(ctx, tx.text, tx.x, tx.y, tx.col, 1, 'c');
  if (opt.over) opt.over(ctx);
  ctx.restore();
  if (!opt.noLight) drawLight(ctx, w, cam, vw, vh, opt.lightMul ?? 1);
}

// darkness with holes cut out where lights are
let LIGHT = null;
function drawLight(ctx, w, cam, vw, vh, mul) {
  const dark = w.theme.dark * mul; if (dark <= 0.01) return;
  if (!LIGHT || LIGHT.width !== vw || LIGHT.height !== vh) LIGHT = mkCanvas(vw, vh);
  const g = LIGHT.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, vw, vh);
  g.fillStyle = 'rgba(5,5,10,' + dark + ')'; g.fillRect(0, 0, vw, vh);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    x -= cam.x; y -= cam.y; if (x < -r || y < -r || x > vw + r || y > vh + r) return;
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(0,0,0,' + a + ')'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const P = w.player; if (P && !P.dead) hole(P.x + 5, P.y + 10, 70, 0.7);
  for (const d of w.decos) {
    if (d.kind === 'lamp') hole(d.x, d.y + 20, 90, 1);
    else if (d.kind === 'cage lamp') hole(d.x, d.y, 60, 0.9);
    else if (d.kind === 'red beacon') hole(d.x, d.y, 40, 0.6 + Math.sin(w.time * 6) * 0.3);
    else if (d.kind === 'monitor') hole(d.x, d.y, 28, 0.6);
    else if (d.kind === 'toxic barrel') hole(d.x, d.y - 6, 30, 0.6);
    else if (d.kind === 'exit sign') hole(d.x, d.y, 30, 0.7);
  }
  if (w.exit) hole(w.exit.x, w.exit.y, 50, 0.8);
  for (const L of w.lasers) if (L.onNow) { const n = Math.min(12, Math.ceil(dist(L.x, L.y, L.ex, L.ey) / 40)); for (let i = 0; i <= n; i++) hole(lerp(L.x, L.ex, i / n), lerp(L.y, L.ey, i / n), 26, 0.5); }
  for (const c of w.coils) if (c.state) hole(c.x, c.y - 8, c.state === 2 ? c.range + 10 : 30, c.state === 2 ? 0.9 : 0.5);
  for (const b of w.booms) hole(b.x, b.y, b.max * 3, 1);
  for (const b of w.bullets) hole(b.x, b.y, 12, 0.4);
  for (const r of w.rockets) hole(r.x, r.y, 30, 0.8);
  for (const k of w.pickups) if (!k.taken) hole(k.x, k.y, 18, 0.5);
  for (const t of w.turrets) if (!t.dead) hole(t.x, t.y, 16, 0.4);
  for (const e of w.enemies) if (!e.dead) hole(e.x + e.w / 2, e.y + 4, 14, 0.4);
  if (w.boss && !w.boss.dead) hole(w.boss.x + w.boss.w / 2, w.boss.y + w.boss.h / 2, 60, 0.6);
  for (const s of (w.strikes || [])) if (s.t > 0) hole(s.x, s.y1 - 10, 40, 0.6);
  ctx.drawImage(LIGHT, 0, 0);
  // warm glow from lamps
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => {
    x -= cam.x; y -= cam.y; if (x < -r || y < -r || x > vw + r || y > vh + r) return;
    const [R, G, B] = hexRgb(col); const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${R},${G},${B},${a})`); grd.addColorStop(1, `rgba(${R},${G},${B},0)`); ctx.fillStyle = grd; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const d of w.decos) {
    if (d.kind === 'lamp') glow(d.x, d.y + 10, 60, w.theme.light, 0.12);
    if (d.kind === 'cage lamp') glow(d.x, d.y, 40, w.theme.light, 0.12);
    if (d.kind === 'red beacon') glow(d.x, d.y, 34, '#ff2020', 0.15 + Math.sin(w.time * 6) * 0.1);
    if (d.kind === 'toxic barrel') glow(d.x, d.y - 6, 24, '#60ff40', 0.12);
  }
  for (const L of w.lasers) if (L.onNow) glow(L.ex, L.ey, 14, LASER_COLS[L.color]?.[0] || '#f00', 0.4);
  for (const c of w.coils) if (c.state === 2) glow(c.x, c.y - 8, 40, '#60a0ff', 0.3);
  for (const b of w.booms) glow(b.x, b.y, b.max * 2, '#ff9030', 0.5 * b.life / 0.35);
  ctx.restore();
}

// ---- pieces ---------------------------------------------------------------------
function drawGate(ctx, x, y, closed, t, ed) {
  if (closed) {
    ctx.fillStyle = '#3a1010'; ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = '#a03030'; for (let i = 1; i < TS; i += 4) ctx.fillRect(x + i, y, 2, TS);
    ctx.fillStyle = (t * 4) % 1 < 0.5 ? '#ff5050' : '#a03030'; ctx.fillRect(x, y, TS, 1);
  } else {
    ctx.fillStyle = ed ? 'rgba(200,60,60,0.5)' : 'rgba(160,48,48,0.25)';
    for (let i = 0; i < TS; i += 4) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + TS - 1, 2, 1); }
    if (ed) { ctx.fillRect(x, y, 1, TS); ctx.fillRect(x + TS - 1, y, 1, TS); }
  }
}
function drawExit(ctx, e, open, t) {
  const x = Math.round(e.x - 12), y = Math.round(e.y - 16);
  ctx.fillStyle = '#2a2e35'; ctx.fillRect(x - 2, y - 2, 28, 34);
  ctx.fillStyle = open ? '#1a3a24' : '#2a1414'; ctx.fillRect(x, y, 24, 32);
  ctx.fillStyle = open ? '#2f6a40' : '#4a2020'; ctx.fillRect(x + 2, y + 2, 9, 30); ctx.fillRect(x + 13, y + 2, 9, 30);
  ctx.fillStyle = '#1a1d22'; ctx.fillRect(x + 11, y + 2, 2, 30);
  ctx.fillStyle = open ? ((t * 2) % 1 < 0.7 ? '#60ff90' : '#2f6a40') : '#ff4040'; ctx.fillRect(x + 9, y - 6, 6, 3);
  ptext(ctx, 'EXIT', e.x, y - 12, open ? '#60ff90' : '#ff6060', 1, 'c');
}
function drawCheckpoint(ctx, c, t) {
  const x = Math.round(c.x), y = Math.round(c.y + 12);
  ctx.fillStyle = '#6a6e75'; ctx.fillRect(x - 1, y - 24, 2, 24); ctx.fillRect(x - 4, y - 2, 8, 2);
  const col = c.on ? '#40e080' : '#707070', wave = c.on ? Math.round(Math.sin(t * 6)) : 0;
  ctx.fillStyle = col; ctx.fillRect(x + 1, y - 23, 7, 2); ctx.fillRect(x + 1, y - 21, 8 + wave, 2); ctx.fillRect(x + 1, y - 19, 6, 2);
  ctx.fillStyle = c.on ? '#a0ffc0' : '#9a9a9a'; ctx.fillRect(x - 2, y - 26, 4, 2);
}
function drawSign(ctx, s, t) {
  const x = Math.round(s.x - 7), y = Math.round(s.y - 6);
  ctx.fillStyle = '#3a3f47'; ctx.fillRect(x, y, 14, 10); ctx.fillStyle = '#123'; ctx.fillRect(x + 1, y + 1, 12, 8);
  ctx.fillStyle = (t * 2) % 1 < 0.6 ? '#60d0ff' : '#3080a0'; ctx.fillRect(x + 6, y + 2, 2, 4); ctx.fillRect(x + 6, y + 7, 2, 1);
  ctx.fillStyle = '#2a2e35'; ctx.fillRect(x + 6, y + 10, 2, 3);
}
function drawPlatform(ctx, p) {
  const r = platRect(p), x = Math.round(r.x), y = Math.round(r.y);
  ctx.fillStyle = '#4a525c'; ctx.fillRect(x, y, r.w, 8); ctx.fillStyle = '#6a7480'; ctx.fillRect(x, y, r.w, 2); ctx.fillStyle = '#2e333a'; ctx.fillRect(x, y + 7, r.w, 1);
  ctx.fillStyle = '#d8b02a'; for (const ox of [0, r.w - 6]) for (let i = 0; i < 6; i += 2) ctx.fillRect(x + ox + i, y + 3, 1, 3);
  ctx.fillStyle = '#9aa4b0'; for (let i = 10; i < r.w - 8; i += 12) ctx.fillRect(x + i, y + 4, 1, 1);
}
function drawPickup(ctx, k, t) {
  const bob = Math.round(Math.sin(t * 3 + k.x) * 1.5), x = Math.round(k.x - 6), y = Math.round(k.y - 5) + bob;
  if (k.t === 'ammo') { ctx.fillStyle = '#4a5a2a'; ctx.fillRect(x, y, 12, 10); ctx.fillStyle = '#6a7a3a'; ctx.fillRect(x, y, 12, 2); ctx.fillStyle = '#e8c050'; for (let i = 0; i < 3; i++) { ctx.fillRect(x + 2 + i * 3, y + 3, 2, 5); } ctx.fillStyle = '#b08a30'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 3, y + 7, 2, 1); }
  if (k.t === 'rockets') { ctx.fillStyle = '#6a2a20'; ctx.fillRect(x, y, 12, 10); ctx.fillStyle = '#8a3a2a'; ctx.fillRect(x, y, 12, 2); ctx.fillStyle = '#c8ccc8'; ctx.fillRect(x + 2, y + 4, 7, 3); ctx.fillStyle = '#ff9040'; ctx.fillRect(x + 9, y + 4, 2, 3); }
  if (k.t === 'health') { ctx.fillStyle = '#d8dcd8'; ctx.fillRect(x, y, 12, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 12, 2); ctx.fillStyle = '#d02828'; ctx.fillRect(x + 5, y + 2, 2, 7); ctx.fillRect(x + 2, y + 5, 8, 2); }
}
function drawCrusher(ctx, c, t) {
  const r = crusherRect(Object.assign({}, c, { ext: 0 })), h = crusherRect(c);
  const vert = c.dir === 'up' || c.dir === 'down';
  // housing
  ctx.fillStyle = '#2b3036'; ctx.fillRect(Math.round(r.x - 2), Math.round(r.y - 2), r.w + 4, r.h + 4);
  // piston rods
  ctx.fillStyle = '#9aa2aa';
  if (vert) { const a = Math.min(r.y, h.y) + 8, b = Math.max(r.y, h.y) + 8; for (const ox of [r.w * 0.25, r.w * 0.75]) ctx.fillRect(Math.round(r.x + ox - 2), Math.round(a), 4, Math.round(b - a)); }
  else { const a = Math.min(r.x, h.x) + 8, b = Math.max(r.x, h.x) + 8; for (const oy of [r.h * 0.25, r.h * 0.75]) ctx.fillRect(Math.round(a), Math.round(r.y + oy - 2), Math.round(b - a), 4); }
  // head
  const x = Math.round(h.x), y = Math.round(h.y);
  ctx.fillStyle = '#5a636e'; ctx.fillRect(x, y, h.w, h.h); ctx.fillStyle = '#7a8591'; ctx.fillRect(x, y, h.w, 2);
  ctx.fillStyle = '#1e1e1e';
  const sx = c.dir === 'down' ? [x, y + h.h - 5, h.w, 5] : c.dir === 'up' ? [x, y, h.w, 5] : c.dir === 'left' ? [x, y, 5, h.h] : [x + h.w - 5, y, 5, h.h];
  ctx.fillRect(...sx); ctx.fillStyle = '#d8b02a';
  for (let i = 0; i < Math.max(sx[2], sx[3]); i++) for (let j = 0; j < Math.min(sx[2], sx[3]); j++) if (((i + j) >> 1) % 2 === 0) ctx.fillRect(sx[2] > sx[3] ? sx[0] + i : sx[0] + j, sx[2] > sx[3] ? sx[1] + j : sx[1] + i, 1, 1);
  ctx.fillStyle = c.warn && (t * 10) % 1 < 0.5 ? '#ff3030' : '#601818'; ctx.fillRect(x + Math.floor(h.w / 2) - 1, y + Math.floor(h.h / 2) - 1, 3, 3);
}
function drawSaw(ctx, s) {
  const r = Math.round(s.r);
  ctx.fillStyle = '#8a929c'; pcircle(ctx, s.x, s.y, r - 1);
  ctx.fillStyle = '#b8c0c8'; pring(ctx, s.x, s.y, Math.max(1, r - 3));
  const n = Math.max(6, Math.round(r * 0.9));
  ctx.fillStyle = '#d8dee4';
  for (let i = 0; i < n; i++) { const a = s.rot + i * Math.PI * 2 / n; ctx.fillRect(Math.round(s.x + Math.cos(a) * r) - 1, Math.round(s.y + Math.sin(a) * r) - 1, 2, 2); }
  ctx.fillStyle = '#3a3e44'; pcircle(ctx, s.x, s.y, Math.max(1, Math.round(r * 0.3)));
  ctx.fillStyle = '#6a7078'; ctx.fillRect(Math.round(s.x + Math.cos(s.rot) * r * 0.55), Math.round(s.y + Math.sin(s.rot) * r * 0.55), 2, 2);
}
function drawTurret(ctx, T, t, ed) {
  const x = Math.round(T.x), y = Math.round(T.y);
  if (T.ceil) {
    ctx.fillStyle = '#2a2e34'; ctx.fillRect(x - 8, y - 6, 16, 4);
    ctx.fillStyle = '#4a525c'; ctx.fillRect(x - 6, y - 2, 12, 5); ctx.fillStyle = '#5e6873'; ctx.fillRect(x - 6, y - 2, 12, 1);
    ctx.fillStyle = '#1a1c20'; pline(ctx, x, y + 3, x + Math.cos(T.aim) * 9, y + 3 + Math.sin(T.aim) * 9, 2);
    ctx.fillStyle = '#ff3020'; ctx.fillRect(x - 1, y, 2, 2);
    if (T.tele && !ed) { ctx.fillStyle = 'rgba(255,40,40,0.5)'; for (let i = 10; i < 200; i += 6) ctx.fillRect(Math.round(x + Math.cos(T.aim) * i), Math.round(y + 3 + Math.sin(T.aim) * i), 1, 1); }
    return;
  }
  if (T.dead) { ctx.fillStyle = '#1e1e1e'; ctx.fillRect(x - 6, y - 4, 12, 9); if (Math.random() < 0.1) { } ctx.fillStyle = '#ff6020'; if ((t * 3 + x) % 1 < 0.3) ctx.fillRect(x - 1, y - 2, 2, 2); return; }
  if (T.mode === 'when crossed' && T.ex != null) {
    ctx.fillStyle = T.tripped ? 'rgba(255,60,60,0.8)' : 'rgba(255,60,60,0.3)';
    const D = dist(x, y, T.ex, T.ey); for (let i = 8; i < D; i += 3) ctx.fillRect(Math.round(x + Math.cos(T.aim) * i), Math.round(y + Math.sin(T.aim) * i), 1, 1);
  }
  if (ed && T.mode !== 'when crossed') { ctx.fillStyle = 'rgba(255,200,60,0.35)'; for (let i = 10; i < 40; i += 3) ctx.fillRect(Math.round(x + Math.cos(T.aim) * i), Math.round(y + Math.sin(T.aim) * i), 1, 1); }
  ctx.fillStyle = T.flash > 0 ? '#fff' : '#3e4650'; ctx.fillRect(x - 7, y - 7, 14, 14);
  ctx.fillStyle = T.flash > 0 ? '#fff' : '#5a6470'; ctx.fillRect(x - 6, y - 6, 12, 12);
  ctx.fillStyle = '#d8b02a'; ctx.fillRect(x - 6, y + 4, 12, 2);
  ctx.fillStyle = '#1a1c20'; pline(ctx, x, y, x + Math.cos(T.aim) * 10, y + Math.sin(T.aim) * 10, 3);
  ctx.fillStyle = T.mode === 'aims at you' ? '#ff3020' : T.mode === 'randomly' ? '#ffa020' : '#ff3060'; ctx.fillRect(x - 1, y - 1, 3, 3);
  if (T.hp > 0 && T.hpNow < T.hp) { ctx.fillStyle = '#300'; ctx.fillRect(x - 7, y - 11, 14, 2); ctx.fillStyle = '#e03030'; ctx.fillRect(x - 7, y - 11, Math.round(14 * T.hpNow / T.hp), 2); }
}
function drawCoil(ctx, c, t) {
  const x = Math.round(c.x), y = Math.round(c.y);
  ctx.fillStyle = '#2a2e34'; ctx.fillRect(x - 6, y + 7, 12, 4);
  ctx.fillStyle = '#4a4e54'; ctx.fillRect(x - 2, y - 6, 4, 13);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#b06a30' : '#d08a40'; ctx.fillRect(x - 4, y + 5 - i * 3, 8, 2); }
  const glow = c.state === 2 ? '#e0f0ff' : c.state === 1 ? ((t * 12) % 1 < 0.5 ? '#80c0ff' : '#4070a0') : '#506070';
  ctx.fillStyle = glow; pcircle(ctx, x, y - 9, 3);
  if (c.state === 1 && Math.random() < 0.5) { ctx.fillStyle = '#a0d0ff'; ctx.fillRect(x + randi(-6, 6), y - 9 + randi(-6, 6), 1, 1); }
  if (c.bolts) for (const pts of c.bolts) {
    ctx.fillStyle = '#4080ff'; for (let i = 1; i < pts.length; i++) pline(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 3);
    ctx.fillStyle = '#e8f4ff'; for (let i = 1; i < pts.length; i++) pline(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1);
  }
}
function drawLaser(ctx, L, t, ed) {
  const [col, core] = LASER_COLS[L.color] || LASER_COLS.red;
  if (L.ex != null) {
    if (L.onNow && !ed) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.5; pline(ctx, L.x, L.y, L.ex, L.ey, 3); ctx.globalAlpha = 1; pline(ctx, L.x, L.y, L.ex, L.ey, 2);
      ctx.fillStyle = core; pline(ctx, L.x, L.y, L.ex, L.ey, 1);
    } else if (L.warnNow || ed) {
      ctx.fillStyle = ed ? col : (t * 12) % 1 < 0.5 ? col : 'transparent'; ctx.globalAlpha = ed ? 0.5 : 0.7;
      const D = dist(L.x, L.y, L.ex, L.ey); for (let i = 0; i < D; i += 4) ctx.fillRect(Math.round(L.x + Math.cos(L.ang) * i), Math.round(L.y + Math.sin(L.ang) * i), 1, 1);
      ctx.globalAlpha = 1;
    }
  }
  const x = Math.round(L.x), y = Math.round(L.y);
  ctx.fillStyle = '#30353c'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#4a525c'; ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillStyle = L.onNow ? col : '#401010'; ctx.fillRect(Math.round(x + Math.cos(L.ang) * 3) - 1, Math.round(y + Math.sin(L.ang) * 3) - 1, 3, 3);
}

function drawDeco(ctx, d, t) {
  const s = decoSize(d.kind), x = Math.round(d.x - s.w / 2), y = Math.round(d.y - s.h / 2);
  const F = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  switch (d.kind) {
    case 'lamp': F(4, 0, 2, 2, '#333'); F(0, 2, 10, 3, '#4a4e54'); F(1, 5, 8, 2, '#ffe8b0'); F(2, 7, 6, 1, '#fff8e0'); break;
    case 'cage lamp': F(1, 0, 6, 2, '#3a3e44'); F(2, 2, 4, 6, '#ffd890'); F(1, 3, 1, 5, '#555'); F(6, 3, 1, 5, '#555'); F(1, 5, 6, 1, '#555'); F(1, 8, 6, 2, '#3a3e44'); break;
    case 'red beacon': F(1, 5, 6, 3, '#3a3e44'); F(2, 1, 4, 4, (t * 3) % 1 < 0.5 ? '#ff3030' : '#801818'); F(3, 0, 2, 1, '#ff8080'); break;
    case 'warning sign': F(0, 0, 14, 12, '#1e1e1e'); F(1, 1, 12, 10, '#d8b02a'); F(6, 3, 2, 4, '#1e1e1e'); F(6, 8, 2, 2, '#1e1e1e'); break;
    case 'skull sign': F(0, 0, 14, 12, '#1e1e1e'); F(1, 1, 12, 10, '#e8e8e8'); F(4, 2, 6, 5, '#1e1e1e'); F(5, 4, 1, 1, '#e8e8e8'); F(8, 4, 1, 1, '#e8e8e8'); F(5, 7, 4, 2, '#1e1e1e'); break;
    case 'exit sign': F(0, 0, 16, 8, '#1a3a24'); F(1, 1, 14, 6, '#123018'); ptext(ctx, 'EXIT', x + 2, y + 2, '#60ff90', 1, 'l', null); break;
    case 'vent': F(0, 0, 16, 10, '#3a4048'); for (let i = 2; i < 9; i += 2) F(1, i, 14, 1, '#1e2226'); break;
    case 'fan': { F(0, 0, 20, 20, '#2e333a'); F(1, 1, 18, 18, '#15181c'); ctx.fillStyle = '#6a7480'; const a = t * 8; for (let k = 0; k < 3; k++) pline(ctx, x + 10, y + 10, x + 10 + Math.cos(a + k * 2.09) * 8, y + 10 + Math.sin(a + k * 2.09) * 8, 2); F(9, 9, 2, 2, '#9aa4b0'); break; }
    case 'barrel': F(0, 0, 12, 16, '#5a3a2a'); F(0, 3, 12, 1, '#3a2418'); F(0, 12, 12, 1, '#3a2418'); F(1, 0, 2, 16, '#6e4a36'); break;
    case 'toxic barrel': F(0, 0, 12, 16, '#2e4a2a'); F(0, 3, 12, 1, '#1e301c'); F(0, 12, 12, 1, '#1e301c'); F(1, 0, 10, 2, '#70ff40'); F(4, 6, 4, 4, '#d8d020'); F(5, 7, 2, 2, '#1e1e1e'); break;
    case 'crate': F(0, 0, 16, 16, '#6a5030'); F(1, 1, 14, 14, '#7a5e3a'); ctx.fillStyle = '#5a4026'; pline(ctx, x + 1, y + 1, x + 14, y + 14); pline(ctx, x + 14, y + 1, x + 1, y + 14); F(0, 0, 16, 1, '#8a6e48'); break;
    case 'gear': { const cx = x + 12, cy = y + 12; ctx.fillStyle = '#4a4e54'; pcircle(ctx, cx, cy, 9); for (let k = 0; k < 8; k++) { const a = t * 0.8 + k * Math.PI / 4; ctx.fillRect(Math.round(cx + Math.cos(a) * 10) - 2, Math.round(cy + Math.sin(a) * 10) - 2, 4, 4); } ctx.fillStyle = '#2a2d31'; pcircle(ctx, cx, cy, 3); break; }
    case 'pipe across': F(0, 0, 32, 6, '#4a4236'); F(0, 1, 32, 1, '#6a5e4a'); F(0, 5, 32, 1, '#2a251e'); F(10, 0, 2, 6, '#3a342a'); F(24, 0, 2, 6, '#3a342a'); break;
    case 'pipe up': F(0, 0, 6, 32, '#4a4236'); F(1, 0, 1, 32, '#6a5e4a'); F(5, 0, 1, 32, '#2a251e'); F(0, 10, 6, 2, '#3a342a'); F(0, 24, 6, 2, '#3a342a'); break;
    case 'chain': for (let i = 0; i < 32; i += 4) F(i % 8 ? 1 : 0, i, i % 8 ? 2 : 4, 3, i % 8 ? '#5a5e64' : '#7a7e84'); break;
    case 'cables': ctx.fillStyle = '#1e1e1e'; for (let k = 0; k < 3; k++) for (let i = 0; i < 32; i++) ctx.fillRect(x + i, y + 2 + k * 3 + Math.round(Math.sin(i / 32 * Math.PI) * 4), 1, 1); break;
    case 'monitor': F(0, 0, 16, 12, '#2a2e34'); F(1, 1, 14, 9, '#0a2a1a'); ctx.fillStyle = '#40ff80'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2, y + 2 + i * 2, 2 + Math.floor((Math.sin(t * 2 + i * 1.7) * 0.5 + 0.5) * 10), 1); F(6, 10, 4, 2, '#2a2e34'); break;
    case 'steam': if (Math.random() < 0.3 && d._w) spawnParts(d._w, d.x, d.y, 1, '#c8c8c8', 20, 1.2, -40, 2); F(2, 6, 4, 2, '#3a3e44'); break;
    case 'tank': F(2, 0, 20, 32, '#3e5a4a'); F(0, 4, 24, 24, '#3e5a4a'); F(2, 4, 3, 24, '#5a7a66'); F(0, 10, 24, 1, '#2a3e32'); F(0, 22, 24, 1, '#2a3e32'); F(14, 14, 6, 4, '#d8b02a'); break;
    case 'girder': F(0, 0, 32, 2, '#7a5228'); F(0, 6, 32, 2, '#7a5228'); ctx.fillStyle = '#6a4520'; for (let i = 0; i < 32; i += 8) { pline(ctx, x + i, y + 2, x + i + 4, y + 5); pline(ctx, x + i + 4, y + 5, x + i + 8, y + 2); } break;
    case 'hazard tape': for (let i = 0; i < 32; i++) F(i, 0, 1, 4, ((i >> 2) % 2) ? '#1e1e1e' : '#d8b02a'); break;
    case 'gauge': ctx.fillStyle = '#2a2e34'; pcircle(ctx, x + 5, y + 5, 5); ctx.fillStyle = '#d8d8c8'; pcircle(ctx, x + 5, y + 5, 3); ctx.fillStyle = '#c02020'; pline(ctx, x + 5, y + 5, x + 5 + Math.cos(-2 + Math.sin(t) * 0.6) * 3, y + 5 + Math.sin(-2 + Math.sin(t) * 0.6) * 3); break;
  }
}

// ---- characters -----------------------------------------------------------------
function drawPlayer(ctx, P, w) {
  if (P.dead) return;
  if (P.inv > 0 && (w.time * 20) % 2 < 1) return;
  const fl = P.face < 0, x = Math.round(P.x), y = Math.round(P.y);
  const R = sprite(ctx, x, y, 1, fl, 10);
  const step = P.ground && Math.abs(P.vx) > 10 ? Math.floor(P.anim / 6) % 2 : 0;
  // legs
  R(2, 14, 2, step ? 6 : 5, '#2e3640'); R(6, 14, 2, step ? 5 : 6, '#2e3640');
  R(1, 19, 3, 1, '#1a1e24'); R(6, 19, 3, 1, '#1a1e24');
  // body
  R(2, 7, 6, 8, '#4a5a6a'); R(2, 7, 6, 1, '#6a7a8a'); R(2, 12, 6, 1, '#3a4652'); R(3, 9, 2, 2, '#d8b02a');
  // head + helmet + visor
  R(2, 1, 6, 6, '#c89a78'); R(1, 0, 8, 3, '#3e4a56'); R(5, 3, 4, 2, '#50e0ff');
  // arm + gun pointing at the mouse
  const sx = x + 5, sy = y + 8, a = P.aim, k = P.recoil;
  ctx.fillStyle = '#4a5a6a'; pline(ctx, sx, sy, sx + Math.cos(a) * 4, sy + Math.sin(a) * 4, 2);
  const gx = sx + Math.cos(a) * (3 - k), gy = sy + Math.sin(a) * (3 - k);
  if (P.weapon === 0) { ctx.fillStyle = '#22262c'; pline(ctx, gx, gy, gx + Math.cos(a) * 7, gy + Math.sin(a) * 7, 2); }
  else { ctx.fillStyle = '#4a5a3a'; pline(ctx, gx - Math.cos(a) * 3, gy - Math.sin(a) * 3, gx + Math.cos(a) * 9, gy + Math.sin(a) * 9, 3); ctx.fillStyle = '#c05040'; ctx.fillRect(Math.round(gx + Math.cos(a) * 9) - 1, Math.round(gy + Math.sin(a) * 9) - 1, 2, 2); }
  if (P.water && (w.time * 2) % 1 < 0.1) spawnParts(w, x + (fl ? 3 : 7), y + 2, 1, '#a0d0ff', 10, 1, -30);
}

function drawEnemy(ctx, e, w) {
  if (e.dead) return;
  const d = e.d, fl = e.face < 0, s = d.size || 1, x = Math.round(e.x), y = Math.round(e.y);
  const base = enemySize(Object.assign({}, d, { size: 1 })), bw = base.w;
  const R = sprite(ctx, x, y, s, fl, bw);
  const col = e.flash > 0 ? '#ffffff' : d.color, ac = e.flash > 0 ? '#ffffff' : d.accent, dk = e.flash > 0 ? '#fff' : shade(d.color, -0.35), lt = e.flash > 0 ? '#fff' : shade(d.color, 0.25);
  const step = Math.abs(e.vx) > 5 ? Math.floor(e.anim * 8) % 2 : 0;
  switch (d.body) {
    case 'soldier':
      R(2, 14, 2, step ? 6 : 5, ac); R(6, 14, 2, step ? 5 : 6, ac);
      R(2, 7, 6, 8, col); R(2, 7, 6, 1, lt); R(2, 12, 6, 1, dk);
      R(2, 1, 6, 6, '#b88a68'); R(1, 0, 8, 3, ac); R(5, 3, 4, 2, d.eye); break;
    case 'robot':
      R(2, 15, 3, 5, ac); R(7, 15, 3, 5, ac); R(1, 6, 10, 10, col); R(1, 6, 10, 1, lt); R(1, 15, 10, 1, dk);
      R(3, 0, 6, 6, dk); R(4, 2, 4, 2, '#111'); R(6, 2, 2, 2, d.eye); R(5, -2, 1, 2, ac); R(3, 9, 6, 1, ac); break;
    case 'drone': {
      const sp = Math.floor(e.anim * 20) % 2;
      R(sp ? 0 : 3, 0, sp ? 16 : 10, 1, '#9aa4b0'); R(7, 1, 2, 2, ac);
      R(1, 3, 14, 6, col); R(1, 3, 14, 1, lt); R(1, 8, 14, 1, dk); R(9, 4, 4, 3, '#111'); R(10, 5, 2, 2, d.eye); break;
    }
    case 'brute':
      R(2, 16, 4, 6, ac); R(8, 16, 4, 6, ac); R(0, 6, 14, 11, col); R(0, 6, 14, 2, lt); R(0, 15, 14, 1, dk);
      R(4, 1, 6, 6, '#a07a58'); R(3, 0, 8, 3, ac); R(7, 3, 3, 2, d.eye); R(-1, 8, 3, 6, dk); break;
    case 'crawler': {
      const lg = Math.floor(e.anim * 10) % 2;
      for (let i = 0; i < 3; i++) { R(2 + i * 5, 6, 1, 3, dk); R(3 + i * 5 + (lg ? 1 : -1), 8, 2, 1, dk); }
      R(0, 2, 16, 5, col); R(0, 2, 16, 1, lt); R(11, 0, 5, 5, col); R(13, 2, 2, 1, d.eye); R(12, 4, 3, 1, '#eee'); break;
    }
  }
  // weapon
  if (d.weapon !== 'none' && d.body !== 'crawler') {
    const P = w.player, sx = e.x + e.w / 2, sy = e.y + Math.min(6, e.h * 0.3) + 3 * s;
    const a = e.charge > 0 ? e.aim : (e.alert > 0 && P ? Math.atan2(P.y + 10 - sy, P.x + 5 - sx) : (fl ? Math.PI : 0));
    const len = { pistol: 6, rifle: 9, shotgun: 8, rocket: 10, laser: 11 }[d.weapon] * s;
    ctx.fillStyle = d.weapon === 'rocket' ? '#4a5a3a' : '#1e2226';
    pline(ctx, sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, d.weapon === 'rocket' || d.weapon === 'shotgun' ? 3 : 2);
    if (e.charge > 0) {
      ctx.fillStyle = d.eye; ctx.globalAlpha = 0.6;
      const end = raycast(w, sx, sy, a, d.sight + 60, 'l'); const D = dist(sx, sy, end.x, end.y);
      for (let i = 0; i < D; i += 2) ctx.fillRect(Math.round(sx + Math.cos(a) * i), Math.round(sy + Math.sin(a) * i), 1, 1);
      ctx.globalAlpha = 1;
    }
  }
  // shield
  if (d.shield !== 'none') {
    const sh = e.sh, sx = e.face > 0 ? e.x + e.w + 1 : e.x - 4;
    if (sh.up) {
      ctx.fillStyle = 'rgba(140,210,255,0.35)'; ctx.fillRect(Math.round(sx), y - 3, 3, e.h + 4);
      ctx.fillStyle = '#a8dcff'; ctx.fillRect(Math.round(sx) + (e.face > 0 ? 2 : 0), y - 3, 1, e.h + 4);
      ctx.fillStyle = '#5a7a9a'; ctx.fillRect(Math.round(sx), y - 3, 3, 1); ctx.fillRect(Math.round(sx), y + e.h, 3, 1);
    } else if (sh.cd <= 0 || d.shield !== 'always up') {
      ctx.fillStyle = sh.hp <= 0 ? '#3a3a3a' : '#5a7a9a'; ctx.fillRect(Math.round(e.face > 0 ? e.x - 2 : e.x + e.w), y + Math.round(e.h * 0.4), 2, Math.round(e.h * 0.5));
    }
  }
  if (e.hp < e.d.maxHp) { ctx.fillStyle = '#300'; ctx.fillRect(x, y - 5, e.w, 2); ctx.fillStyle = '#e03030'; ctx.fillRect(x, y - 5, Math.max(0, Math.round(e.w * e.hp / e.d.maxHp)), 2); }
  if (e.alert > 2.3 && !w.editor) ptext(ctx, '!', x + e.w / 2, y - 12, '#ff4040', 1, 'c');
}

function drawBoss(ctx, b, w) {
  if (b.dead) return;
  const d = b.d, s = d.size || 1, fl = b.face < 0, x = Math.round(b.x), y = Math.round(b.y);
  const base = bossSize(Object.assign({}, d, { size: 1 }));
  ctx.globalAlpha = b.alpha ?? 1;
  const R = sprite(ctx, x, y, s, fl, base.w);
  const fla = b.flash > 0 || (b.dying && (w.time * 15) % 2 < 1);
  const col = fla ? '#fff' : d.color, ac = fla ? '#fff' : d.accent, dk = fla ? '#fff' : shade(d.color, -0.35), lt = fla ? '#fff' : shade(d.color, 0.25);
  const tele = b.atk && b.atk.tele, eye = tele && (w.time * 12) % 2 < 1 ? '#ffffff' : d.eye;
  const t = w.time;
  switch (d.body) {
    case 'mech': {
      const st = Math.abs(b.vx) > 5 ? Math.floor(t * 6) % 2 : 0;
      R(8, 30, 7, 14 - st * 2, ac); R(25, 30, 7, 12 + st * 2, ac); R(6, 41, 11, 3, dk); R(23, 41, 11, 3, dk);
      R(4, 10, 32, 22, col); R(4, 10, 32, 2, lt); R(4, 30, 32, 2, dk); R(10, 14, 20, 3, dk);
      R(12, 2, 16, 10, dk); R(14, 4, 12, 5, '#111'); R(20, 5, 5, 3, eye);
      R(0, 14, 5, 12, ac); R(35, 14, 5, 12, ac); R(36, 24, 8, 4, dk); R(-4, 24, 8, 4, dk);
      R(14, 20, 12, 6, ac); R(18, 22, 4, 2, eye); break;
    }
    case 'tank': {
      R(0, 20, 56, 10, ac); for (let i = 0; i < 7; i++) R(2 + i * 8 + Math.floor(t * 8) % 2 * 2, 22, 4, 6, dk);
      R(4, 10, 48, 11, col); R(4, 10, 48, 2, lt); R(16, 2, 22, 10, dk); R(18, 4, 18, 3, col); R(28, 5, 4, 2, eye);
      R(36, 5, 20, 4, ac); R(52, 4, 4, 6, dk); break;
    }
    case 'drone': {
      const sp = Math.floor(t * 25) % 2;
      R(sp ? 0 : 4, 0, sp ? 18 : 10, 2, '#9aa4b0'); R(sp ? 26 : 30, 0, sp ? 18 : 10, 2, '#9aa4b0'); R(8, 2, 2, 4, ac); R(34, 2, 2, 4, ac);
      R(4, 6, 36, 16, col); R(4, 6, 36, 2, lt); R(4, 20, 36, 2, dk); R(14, 9, 16, 10, '#111'); R(18, 11, 8, 6, eye); R(20, 13, 4, 2, '#fff');
      R(0, 12, 6, 6, ac); R(38, 12, 6, 6, ac); R(10, 22, 4, 6, dk); R(30, 22, 4, 6, dk); break;
    }
    case 'core': {
      const cx = x + 20 * s, cy = y + 20 * s;
      ctx.fillStyle = dk; pcircle(ctx, cx, cy, Math.round(19 * s)); ctx.fillStyle = col; pcircle(ctx, cx, cy, Math.round(16 * s));
      ctx.fillStyle = ac; for (let k = 0; k < 6; k++) { const a = t * 0.7 + k * Math.PI / 3; ctx.fillRect(Math.round(cx + Math.cos(a) * 17 * s) - 3, Math.round(cy + Math.sin(a) * 17 * s) - 3, 6, 6); }
      ctx.fillStyle = '#111'; pcircle(ctx, cx, cy, Math.round(9 * s)); ctx.fillStyle = eye; pcircle(ctx, cx, cy, Math.round((6 + Math.sin(t * 5)) * s));
      ctx.fillStyle = '#fff'; pcircle(ctx, cx - 2, cy - 2, Math.round(2 * s)); break;
    }
    case 'walker': {
      const st = Math.floor(t * 5) % 2;
      R(4, 22, 4, 26, ac); R(28, 22, 4, 26, ac); R(10, 26, 3, 20 + st * 2, dk); R(23, 26, 3, 22 - st * 2, dk); R(2, 46, 8, 2, dk); R(26, 46, 8, 2, dk);
      R(2, 4, 32, 20, col); R(2, 4, 32, 2, lt); R(2, 22, 32, 2, dk); R(8, 8, 20, 9, '#111'); R(20, 10, 6, 5, eye); R(14, 10, 3, 3, eye);
      R(32, 10, 10, 4, ac); break;
    }
  }
  ctx.globalAlpha = 1;
  const A = b.atk;
  if (A && A.k === 'sweep' && A.ex != null) {
    const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
    if (A.on) { ctx.fillStyle = '#ff3030'; pline(ctx, bcx, bcy, A.ex, A.ey, 4); ctx.fillStyle = '#ffd0c0'; pline(ctx, bcx, bcy, A.ex, A.ey, 2); }
    else { ctx.fillStyle = (t * 10) % 1 < 0.5 ? 'rgba(255,60,60,0.7)' : 'rgba(255,60,60,0.2)'; const D = dist(bcx, bcy, A.ex, A.ey); for (let i = 0; i < D; i += 3) ctx.fillRect(Math.round(bcx + Math.cos(A.ang) * i), Math.round(bcy + Math.sin(A.ang) * i), 1, 1); }
  }
  if (A && A.k === 'dash' && A.tele) { ctx.fillStyle = 'rgba(255,60,60,0.5)'; const yy = Math.round(b.y + b.h / 2); for (let i = 0; i < 120; i += 4) ctx.fillRect(Math.round(b.x + b.w / 2 + A.dir * (b.w / 2 + i)), yy, 2, 1); }
  if (A && A.k === 'summon' && A.tele) { ctx.fillStyle = d.eye; for (const sx of [b.ar.x + 24, b.ar.x + b.ar.w - 24]) pring(ctx, sx, b.ar.y + 24, Math.round(4 + A.t * 10)); }
}
