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
  const t = w.time, cx = Math.round(cam.x), cy = Math.round(cam.y), C = { x: cx, y: cy };
  drawFar(ctx, w, C, vw, vh);
  ctx.save(); ctx.translate(-cx, -cy);
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(w.W - 1, Math.floor((cx + vw) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(w.H - 1, Math.floor((cy + vh) / TS));
  drawTerrain(ctx, w, C, vw, vh);           // walls, floors, slopes + back walls (see terrain.js)
  drawShafts(ctx, w, t);

  const decoBack = [], decoFront = [];
  for (const d of w.decos) (d.front ? decoFront : decoBack).push(d);
  for (const d of decoBack) drawDeco(ctx, d, t);

  // the tiles that are not terrain: grates, girders, ladders, spikes, gates
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = w.fg[y][x], T = TILES[ch];
    if (!T || ch === '.' || T.liquid || T.slope || MAT_OF[ch] !== undefined) continue;
    if (T.gate) { drawGate(ctx, x * TS, y * TS, w.gatesClosed, t, w.editor); continue; }
    ctx.drawImage(tileTex(ch, (x * 7 + y * 13) % 4), x * TS, y * TS);
  }
  for (const h of w.heaters) drawHeater(ctx, h, t);
  for (const v of w.vents) drawVent(ctx, v, t);
  for (const m of w.pmines) drawPMine(ctx, m, t);

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
  for (const z of w.zaps) drawZap(ctx, z, t, w.editor);
  for (const f of w.flamers) drawFlamer(ctx, f, t, w.editor);
  for (const m of (w.mines || [])) { const blink = m.landed && (m.t * (m.t > m.fuse - 1 ? 12 : 4)) % 1 < 0.5; ctx.fillStyle = '#3a3a3a'; ctx.fillRect(m.x - 4, m.y - 2, 8, 5); ctx.fillStyle = blink ? '#ff3030' : '#802020'; ctx.fillRect(m.x - 1, m.y - 3, 2, 2); }
  if (w.boss) drawBoss(ctx, w.boss, w);
  for (const e of w.enemies) drawEnemy(ctx, e, w);
  if (w.player) drawPlayer(ctx, w.player, w);
  drawDebris(ctx, w);

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
  for (const p of w.parts) {
    if (p.fire) continue;
    ctx.fillStyle = p.col; ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  // fire glows (adds light instead of covering)
  ctx.globalCompositeOperation = 'lighter';
  for (const p of w.parts) if (p.fire) { const k = p.life / p.max; ctx.fillStyle = p.col; ctx.globalAlpha = clamp(k * 1.2, 0, 1); const sz = Math.round(p.size + (1 - k) * 3); ctx.fillRect(Math.round(p.x) - (sz >> 1), Math.round(p.y) - (sz >> 1), sz, sz); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  for (const b of w.booms) { ctx.fillStyle = 'rgba(255,220,140,' + (b.life / 0.35) + ')'; pcircle(ctx, b.x, b.y, Math.round(b.r * 0.6)); ctx.fillStyle = 'rgba(255,120,40,' + (b.life / 0.35 * 0.8) + ')'; pring(ctx, b.x, b.y, Math.round(b.r)); }

  for (const d of decoFront) drawDeco(ctx, d, t);
  drawLiquids(ctx, w, C, vw, vh);           // water + lava on top, with waves (see anim.js)
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
    if (d.kind === 'lamp') { const p = lampPos(d); if (!lampOff(d, w.time)) hole(p.x + Math.sin(d.ang) * 20, p.y + Math.cos(d.ang) * 20, 90, 1); }
    else if (d.kind === 'cage lamp') { const p = lampPos(d); hole(p.x, p.y, 60, 0.9); }
    else if (d.kind === 'sparks' && d.sparkT > 0) hole(d.x, d.y + 12, 50, d.sparkT * 3);
    else if (d.kind === 'server') hole(d.x, d.y, 22, 0.4);
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
  for (const L of w.liquids || []) if (L.lava) for (let x = L.x0 + 12; x < L.x1; x += 28) hole(x, L.y, 60, 0.8);
  for (const h of w.heaters) if (h.heat > 0.2) { const r = heaterRect(h); hole(r.x + r.w / 2, r.y + r.h / 2, 24 + r.w * 0.6, h.heat); }
  for (const f of w.flamers) if (f.state === 2) { const a = f.angle * Math.PI / 180; hole(f.x + Math.cos(a) * f.len * 0.5, f.y + Math.sin(a) * f.len * 0.5, f.len * 0.9 + 20, 1); }
  for (const z of w.zaps) if (z.state === 2 && z.ex != null) { const n = Math.max(1, Math.ceil(dist(z.x, z.y, z.ex, z.ey) / 40)); for (let i = 0; i <= n; i++) hole(lerp(z.x, z.ex, i / n), lerp(z.y, z.ey, i / n), 36, 0.8); }
  for (const p of w.parts) if (p.fire && Math.random() < 0.15) hole(p.x, p.y, 18, 0.4);
  ctx.drawImage(LIGHT, 0, 0);
  // warm glow from lamps
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => {
    x -= cam.x; y -= cam.y; if (x < -r || y < -r || x > vw + r || y > vh + r) return;
    const [R, G, B] = hexRgb(col); const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${R},${G},${B},${a})`); grd.addColorStop(1, `rgba(${R},${G},${B},0)`); ctx.fillStyle = grd; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const L of w.liquids || []) if (L.lava) for (let x = L.x0 + 12; x < L.x1; x += 28) glow(x, L.y - 4, 50, '#ff6020', 0.18);
  for (const h of w.heaters) if (h.heat > 0.3) { const r = heaterRect(h); glow(r.x + r.w / 2, r.y + r.h / 2, 18 + r.w * 0.5, '#ff7030', h.heat * 0.35); }
  for (const z of w.zaps) if (z.state === 2) glow(z.x, z.y, 40, '#60a0ff', 0.3);
  for (const d of w.decos) {
    if (d.kind === 'lamp' && !lampOff(d, w.time)) { const p = lampPos(d); glow(p.x, p.y + 6, 60, w.theme.light, 0.12); }
    if (d.kind === 'cage lamp') { const p = lampPos(d); glow(p.x, p.y, 40, w.theme.light, 0.12); }
    if (d.kind === 'sparks' && d.sparkT > 0) glow(d.x, d.y + 12, 30, '#a0d0ff', d.sparkT * 2);
    if (d.kind === 'red beacon') glow(d.x, d.y, 34, '#ff2020', 0.15 + Math.sin(w.time * 6) * 0.1);
    if (d.kind === 'toxic barrel') glow(d.x, d.y - 6, 24, '#60ff40', 0.12);
  }
  for (const L of w.lasers) if (L.onNow) glow(L.ex, L.ey, 14, LASER_COLS[L.color]?.[0] || '#f00', 0.4);
  for (const c of w.coils) if (c.state === 2) glow(c.x, c.y - 8, 40, '#60a0ff', 0.3);
  for (const b of w.booms) glow(b.x, b.y, b.max * 2, '#ff9030', 0.5 * b.life / 0.35);
  // floating dust catches the light
  ctx.fillStyle = 'rgba(255,240,210,0.22)';
  for (const d of w.dust || []) ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 1);
  ctx.restore();
  // vignette: darker corners pull your eye to the middle
  if (!VIG || VIG.width !== vw || VIG.height !== vh) {
    VIG = mkCanvas(vw, vh); const v = VIG.getContext('2d');
    const grd = v.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)'); v.fillStyle = grd; v.fillRect(0, 0, vw, vh);
  }
  ctx.drawImage(VIG, 0, 0);
}
let VIG = null;

// hanging lamps swing; this is where the bulb is
function lampPos(d) { const L = d.kind === 'lamp' ? 6 : 4; return { x: d.x + Math.sin(d.ang || 0) * L, y: d.y - 4 + Math.cos(d.ang || 0) * L }; }
// some lamps flicker
function lampOff(d, t) { if (!d.flicker) return false; const u = (t * 3.1 + (d.seed || 0)) % 7; return u > 6.2 && (t * 30) % 1 < 0.5; }
// light beams under lamps (drawn on top of the walls, before objects)
function drawShafts(ctx, w, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const [R, G, B] = hexRgb(w.theme.light);
  for (const d of w.decos) {
    if (d.kind !== 'lamp' || lampOff(d, t)) continue;
    const p = lampPos(d), a = d.ang || 0, len = 90;
    const ex = p.x + Math.sin(a) * len, ey = p.y + Math.cos(a) * len, px = Math.cos(a), py = -Math.sin(a);
    const grd = ctx.createLinearGradient(p.x, p.y, ex, ey);
    grd.addColorStop(0, `rgba(${R},${G},${B},0.13)`); grd.addColorStop(1, `rgba(${R},${G},${B},0)`);
    ctx.fillStyle = grd; ctx.beginPath();
    ctx.moveTo(p.x - px * 3, p.y - py * 3); ctx.lineTo(p.x + px * 3, p.y + py * 3); ctx.lineTo(ex + px * 30, ey + py * 30); ctx.lineTo(ex - px * 30, ey - py * 30); ctx.fill();
  }
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
    case 'lamp': {   // hangs from a rod and swings
      const p = lampPos(d), a = d.ang || 0, off = lampOff(d, t);
      ctx.fillStyle = '#333'; pline(ctx, d.x, d.y - 4, p.x, p.y, 1);
      const c = Math.cos(a), s = Math.sin(a), q = (u, v) => [p.x + u * c + v * s, p.y - u * s + v * c];
      ctx.fillStyle = '#4a4e54'; for (let u = -5; u <= 4; u++) { const [X, Y] = q(u, 0); ctx.fillRect(Math.round(X), Math.round(Y), 1, 3); }
      ctx.fillStyle = off ? '#5a5040' : '#ffe8b0'; for (let u = -4; u <= 3; u++) { const [X, Y] = q(u, 3); ctx.fillRect(Math.round(X), Math.round(Y), 1, 2); }
      break;
    }
    case 'cage lamp': {
      const p = lampPos(d); ctx.fillStyle = '#3a3e44'; pline(ctx, d.x, d.y - 5, p.x, p.y - 3, 1);
      ctx.fillStyle = '#ffd890'; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 6); ctx.fillStyle = '#555';
      ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 1, 1, 5); ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) - 1, 1, 5); ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) + 1, 6, 1);
      ctx.fillStyle = '#3a3e44'; ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) + 4, 6, 2); break;
    }
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
    case 'chain': {
      if (!d.rope) { for (let i = 0; i < 32; i += 4) F(i % 8 ? 1 : 0, i, i % 8 ? 2 : 4, 3, i % 8 ? '#5a5e64' : '#7a7e84'); break; }
      const P = d.rope.pts;
      for (let i = 1; i < P.length; i++) { ctx.fillStyle = i % 2 ? '#7a7e84' : '#55595f'; pline(ctx, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, i % 2 ? 2 : 1); }
      ctx.fillStyle = '#8a8e94'; const e = P[P.length - 1]; ctx.fillRect(Math.round(e.x) - 2, Math.round(e.y), 4, 2); ctx.fillRect(Math.round(e.x) + 1, Math.round(e.y) + 2, 1, 2);
      break;
    }
    case 'cables': {
      if (!d.ropes) { ctx.fillStyle = '#1e1e1e'; for (let k = 0; k < 3; k++) for (let i = 0; i < 32; i++) ctx.fillRect(x + i, y + 2 + k * 3 + Math.round(Math.sin(i / 32 * Math.PI) * 4), 1, 1); break; }
      d.ropes.forEach((R, k) => { ctx.fillStyle = k ? '#2a1e1e' : '#1a1c20'; for (let i = 1; i < R.pts.length; i++) pline(ctx, R.pts[i - 1].x, R.pts[i - 1].y, R.pts[i].x, R.pts[i].y, 1); });
      F(-1, 0, 2, 5, '#3a3e44'); F(31, 0, 2, 5, '#3a3e44'); break;
    }
    case 'sparks': {   // broken cable dangling and spitting sparks
      if (d.rope) { ctx.fillStyle = '#1a1c20'; const P = d.rope.pts; for (let i = 1; i < P.length; i++) pline(ctx, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, 2); const e = P[P.length - 1]; ctx.fillStyle = '#c08040'; ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y), 2, 2); }
      break;
    }
    case 'drip': F(0, 0, 16, 5, '#4a4236'); F(0, 1, 16, 1, '#6a5e4a'); F(6, 5, 4, 2, '#3a342a'); break;
    case 'server': {
      F(0, 0, 14, 24, '#1c1f24'); F(1, 1, 12, 22, '#262a30');
      for (let i = 0; i < 6; i++) { F(2, 2 + i * 4, 10, 3, '#14171b'); const on = Math.sin(t * (3 + i) + (d.seed || 0) * 7 + i * 2) > 0.2; F(3, 3 + i * 4, 1, 1, on ? '#40ff80' : '#104020'); F(5, 3 + i * 4, 1, 1, Math.sin(t * 9 + i) > 0.6 ? '#ffb030' : '#402810'); }
      break;
    }
    case 'piston': {   // background machine pumping up and down
      const u = Math.round((Math.sin(t * 2.2 + (d.seed || 0)) * 0.5 + 0.5) * 10);
      F(0, 22, 16, 10, '#2a2e34'); F(1, 22, 14, 1, '#3e444c'); F(6, 6 + u, 4, 16 - u, '#8a929c'); F(7, 6 + u, 1, 16 - u, '#b8c0c8');
      F(2, u, 12, 6, '#4a525c'); F(2, u, 12, 1, '#6a7480'); F(3, u + 4, 10, 1, '#d8b02a'); break;
    }
    case 'monitor': F(0, 0, 16, 12, '#2a2e34'); F(1, 1, 14, 9, '#0a2a1a'); ctx.fillStyle = '#40ff80'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2, y + 2 + i * 2, 2 + Math.floor((Math.sin(t * 2 + i * 1.7) * 0.5 + 0.5) * 10), 1); F(6, 10, 4, 2, '#2a2e34'); break;
    case 'steam': if (Math.random() < 0.3 && d._w) spawnParts(d._w, d.x, d.y, 1, '#c8c8c8', 20, 1.2, -40, 2); F(2, 6, 4, 2, '#3a3e44'); break;
    case 'tank': F(2, 0, 20, 32, '#3e5a4a'); F(0, 4, 24, 24, '#3e5a4a'); F(2, 4, 3, 24, '#5a7a66'); F(0, 10, 24, 1, '#2a3e32'); F(0, 22, 24, 1, '#2a3e32'); F(14, 14, 6, 4, '#d8b02a'); break;
    case 'girder': F(0, 0, 32, 2, '#7a5228'); F(0, 6, 32, 2, '#7a5228'); ctx.fillStyle = '#6a4520'; for (let i = 0; i < 32; i += 8) { pline(ctx, x + i, y + 2, x + i + 4, y + 5); pline(ctx, x + i + 4, y + 5, x + i + 8, y + 2); } break;
    case 'hazard tape': for (let i = 0; i < 32; i++) F(i, 0, 1, 4, ((i >> 2) % 2) ? '#1e1e1e' : '#d8b02a'); break;
    case 'gauge': ctx.fillStyle = '#2a2e34'; pcircle(ctx, x + 5, y + 5, 5); ctx.fillStyle = '#d8d8c8'; pcircle(ctx, x + 5, y + 5, 3); ctx.fillStyle = '#c02020'; pline(ctx, x + 5, y + 5, x + 5 + Math.cos(-2 + Math.sin(t) * 0.6) * 3, y + 5 + Math.sin(-2 + Math.sin(t) * 0.6) * 3); break;
  }
}

