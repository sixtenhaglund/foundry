// FOUNDRY - Carrion-style terrain: smooth rounded edges, big world textures, glowing rims,
// dark interiors and soft shadows. Rendered in cached chunks (16x16 tiles each).
'use strict';

const MAT_OF = { '#': 0, 'C': 1, 'R': 2, 'H': 3, 'S': 4 };
const MAT_STYLE = [
  { corner: 'bevel', r: 3, erode: 0 },      // steel
  { corner: 'round', r: 5, erode: 0.35 },   // concrete
  { corner: 'round', r: 5, erode: 0.3 },    // rust
  { corner: 'bevel', r: 3, erode: 0 },      // hazard
  { corner: 'round', r: 7, erode: 0.6 },    // rock
];
const BG_OF = { w: 0, p: 1, b: 2, m: 3, c: 4, r: 5 };
const TEXN = 256;
let MATTEX = null, BGTEX = null;

// ---- noise (smooth random), made to repeat every 256 pixels so textures tile seamlessly ----
function h2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y, s, P) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const X0 = ((xi % P) + P) % P, Y0 = ((yi % P) + P) % P, X1 = (X0 + 1) % P, Y1 = (Y0 + 1) % P;
  const a = h2(X0, Y0, s), b = h2(X1, Y0, s), c = h2(X0, Y1, s), d = h2(X1, Y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbmT(x, y, s, cell, oct = 4) {
  let t = 0, a = 1, n = 0, c = cell;
  for (let i = 0; i < oct && c >= 1; i++) { t += vn(x / c, y / c, s + i * 17, Math.round(TEXN / c)) * a; n += a; a *= 0.5; c /= 2; }
  return t / n;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function makeTex(fn) {
  const t = new Uint8ClampedArray(TEXN * TEXN * 3);
  for (let y = 0; y < TEXN; y++) for (let x = 0; x < TEXN; x++) { const c = fn(x, y), i = (y * TEXN + x) * 3; t[i] = c[0]; t[i + 1] = c[1]; t[i + 2] = c[2]; }
  return t;
}
function buildTextures() {
  if (MATTEX) return;
  MATTEX = [
    makeTex((x, y) => {            // steel: big panels, seams, rivets, brushed streaks
      const sx = x % 64, sy = y % 32;
      let v = 0.82 + (fbmT(x, y, 1, 64) - 0.5) * 0.4;
      if (sx === 0 || sy === 0) v *= 0.5; else if (sx === 1 || sy === 1) v *= 1.18;
      if ((sx === 4 || sx === 59) && (sy === 4 || sy === 27)) v = 1.35; else if ((sx === 4 || sx === 59) && (sy === 5 || sy === 28)) v *= 0.6;
      v *= 0.94 + h2(x, 7, 3) * 0.12;
      if (h2(x, y, 9) > 0.988) v *= 1.25;
      return [74 * v, 84 * v, 97 * v];
    }),
    makeTex((x, y) => {            // concrete: mottled, pits, hairline cracks
      let v = 0.72 + fbmT(x, y, 2, 64, 5) * 0.55;
      const r = h2(x, y, 4); if (r > 0.965) v *= 0.7; else if (r < 0.02) v *= 1.2;
      if (Math.abs(fbmT(x, y, 5, 64, 3) - 0.5) < 0.005) v *= 0.8;
      return [94 * v, 89 * v, 80 * v];
    }),
    makeTex((x, y) => {            // rust: orange patches, drips, rivets
      const patch = smooth(0.45, 0.62, fbmT(x, y, 6, 64, 3));
      let v = 0.75 + fbmT(x, y, 3, 32, 4) * 0.5;
      v *= 1 - h2(x >> 1, 0, 8) * 0.25 * fbmT(x, y, 13, 16, 2);
      if ((x % 32 === 3 || x % 32 === 28) && (y % 32 === 3 || y % 32 === 28)) v *= 1.4;
      return [lerp(96, 158, patch) * v, lerp(60, 84, patch) * v, lerp(40, 34, patch) * v];
    }),
    makeTex((x, y) => {            // hazard stripes, worn
      const stripe = (((x + y) >> 4) & 1) === 0;
      const g = 0.62 + 0.38 * fbmT(x, y, 7, 32, 3);
      if (fbmT(x, y, 8, 16, 3) > 0.7) { const v = 0.8 + h2(x, y, 2) * 0.2; return [80 * v, 84 * v, 90 * v]; }
      return stripe ? [212 * g, 166 * g, 42 * g] : [34 * g, 32 * g, 30 * g];
    }),
    makeTex((x, y) => {            // dark rock with layers
      const n = fbmT(x, y, 11, 64, 5);
      const strata = Math.sin((y + fbmT(x, y, 12, 64, 2) * 40) * 0.35);
      let v = 0.6 + n * 0.6 + strata * 0.07;
      if (h2(x, y, 14) > 0.975) v *= 1.3;
      return [62 * v, 57 * v, 68 * v];
    }),
  ];
  BGTEX = [
    makeTex((x, y) => {            // wall panels
      let v = 0.85 + (fbmT(x, y, 21, 64) - 0.5) * 0.35;
      if (x % 32 === 0 || y % 64 === 0) v *= 0.6; else if (x % 32 === 16) v *= 1.12;
      return [35 * v, 40 * v, 47 * v];
    }),
    makeTex((x, y) => {            // pipe wall
      const px = x % 64; let v = 0.8 + fbmT(x, y, 22, 32) * 0.3, c = [33, 30, 27];
      if (px >= 8 && px < 22) { const t = (px - 8) / 14; v = 0.55 + 0.75 * Math.sin(t * Math.PI) * (t < 0.35 ? 1.15 : 1); c = [58, 52, 44]; if (y % 64 >= 30 && y % 64 < 34) v *= 1.3; }
      else if (px >= 38 && px < 44) { const t = (px - 38) / 6; v = 0.6 + 0.6 * Math.sin(t * Math.PI); c = [50, 46, 40]; }
      return [c[0] * v, c[1] * v, c[2] * v];
    }),
    makeTex((x, y) => {            // dark brick
      const row = y >> 3, bx = (x + (row & 1) * 8) % 16;
      if (bx === 0 || y % 8 === 0) return [20, 16, 15];
      const id = h2(((x + (row & 1) * 8) >> 4), row, 23), v = (0.75 + id * 0.4) * (0.9 + fbmT(x, y, 24, 16, 2) * 0.2);
      return [46 * v, 35 * v, 30 * v];
    }),
    makeTex((x, y) => {            // mesh window
      const line = (x + y) % 8 === 0 || (x - y + 256) % 8 === 0;
      const glow = fbmT(x, y, 25, 64, 2);
      return line ? [44, 52, 62] : [14 + glow * 14, 18 + glow * 16, 24 + glow * 20];
    }),
    makeTex((x, y) => {            // caution wall
      let v = 0.8 + fbmT(x, y, 26, 32) * 0.35;
      if (y % 128 >= 96 && y % 128 < 110) { const s = ((x + y) >> 3) & 1; return s ? [72 * v, 60 * v, 24 * v] : [26 * v, 24 * v, 20 * v]; }
      return [37 * v, 35 * v, 28 * v];
    }),
    makeTex((x, y) => {            // cave rock wall
      const v = 0.6 + fbmT(x, y, 27, 64, 5) * 0.7;
      return [28 * v, 26 * v, 32 * v];
    }),
  ];
}

// ---- the pixel mask: which pixels are solid terrain -----------------------------------
const CH = 16, MARG = 3, CPX = CH * TS, RN = (CH + 2 * MARG) * TS;
const T_MASK = new Uint8Array(RN * RN), T_MAT = new Uint8Array(RN * RN), T_DS = new Float32Array(RN * RN), T_DA = new Float32Array(RN * RN);
const TERR_CACHE = new Map();

// does tile `ch` fill its `side` edge completely? (used to decide which corners get rounded)
function edgeSolid(ch, side) {
  if (MAT_OF[ch] !== undefined) return true;
  const T = TILES[ch];
  if (T && T.slope) { if (side === 'bottom') return true; if (side === 'top') return false; return (side === 'left' ? T.slope(0) : T.slope(16)) >= 15.9; }
  return false;
}
function matNear(w, tx, ty) {
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [0, 2]]) { const m = MAT_OF[tileAt(w, tx + dx, ty + dy)]; if (m !== undefined) return m; }
  return 0;
}
function cornerIn(dx, dy, r, kind) { return kind === 'bevel' ? dx + dy <= r + 0.5 : dx * dx + dy * dy <= r * r; }

function fillMask(w, cx, cy) {
  const NT = CH + 2 * MARG, tx0 = cx * CH - MARG, ty0 = cy * CH - MARG;
  T_MASK.fill(0);
  const set = (k, m) => { T_MASK[k] = 1; T_MAT[k] = m; };
  for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++) {
    const tx = tx0 + i, ty = ty0 + j, ch = tileAt(w, tx, ty), T = TILES[ch], bx = i * TS, by = j * TS;
    const m = MAT_OF[ch];
    if (m !== undefined) {
      const U = edgeSolid(tileAt(w, tx, ty - 1), 'bottom'), D = edgeSolid(tileAt(w, tx, ty + 1), 'top');
      const Lf = edgeSolid(tileAt(w, tx - 1, ty), 'right'), Rt = edgeSolid(tileAt(w, tx + 1, ty), 'left');
      const st = MAT_STYLE[m], r = st.r;
      const cTL = !U && !Lf, cTR = !U && !Rt, cBL = !D && !Lf, cBR = !D && !Rt;
      for (let ly = 0; ly < TS; ly++) for (let lx = 0; lx < TS; lx++) {
        let on = true;
        if (cTL && lx < r && ly < r) on = cornerIn(r - lx - 0.5, r - ly - 0.5, r, st.corner);
        else if (cTR && lx >= TS - r && ly < r) on = cornerIn(lx + 0.5 - (TS - r), r - ly - 0.5, r, st.corner);
        else if (cBL && lx < r && ly >= TS - r) on = cornerIn(r - lx - 0.5, ly + 0.5 - (TS - r), r, st.corner);
        else if (cBR && lx >= TS - r && ly >= TS - r) on = cornerIn(lx + 0.5 - (TS - r), ly + 0.5 - (TS - r), r, st.corner);
        if (on && st.erode) {            // rough, crumbly sides and bottoms
          const e = (!Lf && lx < 3 ? 3 - lx : 0) + (!Rt && lx > TS - 4 ? lx - (TS - 4) : 0) + (!D && ly > TS - 4 ? ly - (TS - 4) : 0);
          if (e && h2(tx * TS + lx, ty * TS + ly, 31) < st.erode * e * 0.3) on = false;
        }
        if (on) set((by + ly) * RN + bx + lx, m);
      }
    } else if (T && T.slope) {
      const m2 = matNear(w, tx, ty);
      for (let lx = 0; lx < TS; lx++) { const top = Math.ceil(TS - T.slope(lx + 0.5) - 0.5); for (let ly = Math.max(0, top); ly < TS; ly++) set((by + ly) * RN + bx + lx, m2); }
    } else if (ch === '.') {
      // fill inside corners with a smooth curve (a "fillet"), so floors meet walls softly
      const up = tileAt(w, tx, ty - 1), dn = tileAt(w, tx, ty + 1), lf = tileAt(w, tx - 1, ty), rt = tileAt(w, tx + 1, ty);
      const U = edgeSolid(up, 'bottom'), D = edgeSolid(dn, 'top'), Lf = edgeSolid(lf, 'right'), Rt = edgeSolid(rt, 'left');
      const corners = [];
      if (Lf && D && MAT_OF[tileAt(w, tx - 1, ty + 1)] !== undefined) corners.push([0, 1, MAT_OF[dn] ?? MAT_OF[lf] ?? 0]);
      if (Rt && D && MAT_OF[tileAt(w, tx + 1, ty + 1)] !== undefined) corners.push([1, 1, MAT_OF[dn] ?? MAT_OF[rt] ?? 0]);
      if (Lf && U && MAT_OF[tileAt(w, tx - 1, ty - 1)] !== undefined) corners.push([0, 0, MAT_OF[up] ?? MAT_OF[lf] ?? 0]);
      if (Rt && U && MAT_OF[tileAt(w, tx + 1, ty - 1)] !== undefined) corners.push([1, 0, MAT_OF[up] ?? MAT_OF[rt] ?? 0]);
      for (const [cxr, cyb, mm] of corners) {
        const f = mm === 4 ? 6 : mm === 0 || mm === 3 ? 3 : 4;
        for (let a = 0; a < f; a++) for (let b = 0; b < f; b++) {
          const dx = f - a - 0.5, dy = f - b - 0.5;   // a,b = pixels away from the corner
          if (dx * dx + dy * dy > f * f || (f <= 3 && a + b < f)) {
            const lx = cxr ? TS - 1 - a : a, ly = cyb ? TS - 1 - b : b;
            set((by + ly) * RN + bx + lx, mm);
          }
        }
      }
    }
  }
}

// distance transform: for every pixel, roughly how far to the nearest "seed" pixel
function distXform(out, seedVal) {
  const INF = 1e6, D2 = 1.4142;
  for (let i = 0; i < RN * RN; i++) out[i] = T_MASK[i] === seedVal ? 0 : INF;
  for (let y = 0; y < RN; y++) for (let x = 0; x < RN; x++) {
    const i = y * RN + x; let v = out[i]; if (v === 0) continue;
    if (x > 0) v = Math.min(v, out[i - 1] + 1);
    if (y > 0) { v = Math.min(v, out[i - RN] + 1); if (x > 0) v = Math.min(v, out[i - RN - 1] + D2); if (x < RN - 1) v = Math.min(v, out[i - RN + 1] + D2); }
    out[i] = v;
  }
  for (let y = RN - 1; y >= 0; y--) for (let x = RN - 1; x >= 0; x--) {
    const i = y * RN + x; let v = out[i]; if (v === 0) continue;
    if (x < RN - 1) v = Math.min(v, out[i + 1] + 1);
    if (y < RN - 1) { v = Math.min(v, out[i + RN] + 1); if (x < RN - 1) v = Math.min(v, out[i + RN + 1] + D2); if (x > 0) v = Math.min(v, out[i + RN - 1] + D2); }
    out[i] = v;
  }
}

function renderChunk(w, cx, cy) {
  buildTextures();
  fillMask(w, cx, cy);
  distXform(T_DS, 0);   // solid pixels: distance to air
  distXform(T_DA, 1);   // air pixels: distance to solid
  const c = mkCanvas(CPX, CPX), g = c.getContext('2d'), img = g.createImageData(CPX, CPX), D = img.data;
  const lt = hexRgb(w.theme.light), deep = w.theme.deep || [9, 9, 12];
  const o0 = MARG * TS;
  for (let py = 0; py < CPX; py++) {
    const wy = cy * CPX + py, ty = Math.floor(wy / TS), bgRow = w.bg[ty];
    for (let px = 0; px < CPX; px++) {
      const wx = cx * CPX + px, i = (py + o0) * RN + px + o0, o = (py * CPX + px) * 4;
      if (T_MASK[i]) {
        const tex = MATTEX[T_MAT[i]], ti = ((wy & 255) * TEXN + (wx & 255)) * 3;
        let r = tex[ti], gg = tex[ti + 1], b = tex[ti + 2];
        const d = T_DS[i], up1 = !T_MASK[i - RN], up2 = !T_MASK[i - 2 * RN];
        let f, tint = 0;
        if (d < 1.5) { if (up1) { f = 1.55; tint = 0.16; } else f = 0.45; }     // bright rim on top, dark outline elsewhere
        else if (up2 && d < 2.5) { f = 1.22; tint = 0.06; }
        else f = 1 - 0.72 * smooth(2.5, 30, d);
        r = r * f + lt[0] * tint; gg = gg * f + lt[1] * tint; b = b * f + lt[2] * tint;
        const dk = smooth(16, 60, d) * 0.7;
        D[o] = lerp(r, deep[0], dk); D[o + 1] = lerp(gg, deep[1], dk); D[o + 2] = lerp(b, deep[2], dk); D[o + 3] = 255;
      } else {
        const a = T_DA[i], ao = 1 - smooth(0, 16, a);
        const bc = bgRow ? bgRow[Math.floor(wx / TS)] : (wy < 0 ? 'w' : '.');
        const bi = BG_OF[bc];
        if (bi !== undefined) {
          const tex = BGTEX[bi], ti = ((wy & 255) * TEXN + (wx & 255)) * 3, k = 1 - 0.7 * ao;
          D[o] = tex[ti] * k; D[o + 1] = tex[ti + 1] * k; D[o + 2] = tex[ti + 2] * k; D[o + 3] = 255;
        } else if (ao > 0) { D[o] = 2; D[o + 1] = 2; D[o + 2] = 4; D[o + 3] = ao * 170; }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function chunkSig(w, cx, cy) {
  const k = cx + ',' + cy;
  w._sig = w._sig || new Map();
  let s = w._sig.get(k); if (s) return s;
  s = w.L.theme + ':';
  const tx0 = cx * CH - MARG, ty0 = cy * CH - MARG, N = CH + 2 * MARG;
  for (let ty = ty0; ty < ty0 + N; ty++) {
    for (let tx = tx0; tx < tx0 + N; tx++) { const ch = tileAt(w, tx, ty); s += (MAT_OF[ch] !== undefined || TILES[ch]?.slope || ch === '.') ? ch : '_'; }
    if (ty >= cy * CH && ty < cy * CH + CH) s += (w.bg[ty] || '').slice(cx * CH, cx * CH + CH);
    s += '|';
  }
  w._sig.set(k, s); return s;
}

// draw all terrain in view. Renders missing chunks within a small time budget.
function drawTerrain(ctx, w, cam, vw, vh) {
  const cx0 = Math.floor(cam.x / CPX), cx1 = Math.floor((cam.x + vw) / CPX), cy0 = Math.floor(cam.y / CPX), cy1 = Math.floor((cam.y + vh) / CPX);
  const t0 = performance.now();
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    if (cx < -1 || cy < -1 || cx * CPX > w.pw + CPX || cy * CPX > w.ph + CPX) continue;
    const sig = chunkSig(w, cx, cy);
    let c = TERR_CACHE.get(sig);
    if (!c && (performance.now() - t0 < 14 || w.forceTerrain)) {
      c = renderChunk(w, cx, cy); TERR_CACHE.set(sig, c);
      if (TERR_CACHE.size > 180) TERR_CACHE.delete(TERR_CACHE.keys().next().value);
    }
    if (c) ctx.drawImage(c, cx * CPX, cy * CPX);
    else drawChunkFallback(ctx, w, cx, cy);
  }
}
// quick plain tiles, used for a frame or two while a chunk is still being made
function drawChunkFallback(ctx, w, cx, cy) {
  for (let ty = cy * CH; ty < cy * CH + CH; ty++) for (let tx = cx * CH; tx < cx * CH + CH; tx++) {
    if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) continue;
    const b = w.bg[ty][tx]; if (b !== '.') ctx.drawImage(tileTex(b, 0, true), tx * TS, ty * TS);
    const ch = w.fg[ty][tx]; if (MAT_OF[ch] !== undefined) { ctx.fillStyle = shade(TILES[ch].col, -0.4); ctx.fillRect(tx * TS, ty * TS, TS, TS); }
  }
}
// warm up the chunks around a point (called when a level starts)
function prewarmTerrain(w, x, y) {
  w.forceTerrain = true;
  const c = mkCanvas(1, 1).getContext('2d');
  drawTerrain(c, w, { x: x - 400, y: y - 260 }, 800, 520);
  w.forceTerrain = false;
}

// little 16x16 picture of a terrain tile for the editor palette
const TICON = {};
function terrainIcon(ch) {
  if (TICON[ch]) return TICON[ch];
  buildTextures();
  const c = mkCanvas(TS, TS), g = c.getContext('2d'), img = g.createImageData(TS, TS), D = img.data, T = TILES[ch];
  const m = MAT_OF[ch] ?? 0, tex = MATTEX[m], st = MAT_STYLE[m];
  const solid = (x, y) => {
    if (x < 0 || y < 0 || x >= TS || y >= TS) return false;
    if (T.slope) return y + 0.5 >= TS - T.slope(x + 0.5);
    const r = st.r;
    if (y < r && x < r) return cornerIn(r - x - 0.5, r - y - 0.5, r, st.corner);
    if (y < r && x >= TS - r) return cornerIn(x + 0.5 - (TS - r), r - y - 0.5, r, st.corner);
    return true;
  };
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const o = (y * TS + x) * 4; if (!solid(x, y)) continue;
    const ti = ((y * 3 + 40) * TEXN + x * 3 + 40) * 3, f = !solid(x, y - 1) ? 1.55 : !solid(x, y - 2) ? 1.2 : 1;
    D[o] = tex[ti] * f; D[o + 1] = tex[ti + 1] * f; D[o + 2] = tex[ti + 2] * f; D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return TICON[ch] = c;
}

// ---- far background: factory machinery in the fog (parallax layers) -----------------------
const FAR = {};
function farLayers(theme) {
  const key = theme.sky.join(); if (FAR[key]) return FAR[key];
  const W = 1024, H = 420, r = srand(11);
  const mk = (col, fn) => { const c = mkCanvas(W, H), g = c.getContext('2d'); g.fillStyle = col; fn(g); return c; };
  const farCol = shade(theme.sky[1], 0.1), midCol = shade(theme.sky[0], 0.04);
  const far = mk(farCol, g => {
    for (let i = 0; i < 9; i++) {         // tall pipes with joints
      const x = Math.floor(r() * W), pw = 6 + Math.floor(r() * 12);
      g.fillRect(x, 0, pw, H); for (let y = Math.floor(r() * 60); y < H; y += 50 + Math.floor(r() * 40)) g.fillRect(x - 2, y, pw + 4, 4);
    }
    for (let i = 0; i < 6; i++) {         // tanks
      const x = Math.floor(r() * W), tw = 60 + Math.floor(r() * 70), th = 90 + Math.floor(r() * 140), y = H - th;
      g.fillRect(x, y, tw, th); g.beginPath(); g.ellipse(x + tw / 2, y, tw / 2, 14, 0, 0, Math.PI * 2); g.fill();
      for (let k = 1; k < 4; k++) g.fillRect(x - 2, y + k * th / 4, tw + 4, 2);
    }
    for (let i = 0; i < 3; i++) {         // truss bridges
      const y = 40 + Math.floor(r() * 200); g.fillRect(0, y, W, 2); g.fillRect(0, y + 12, W, 2);
      for (let x = 0; x < W; x += 12) { for (let k = 0; k < 12; k++) g.fillRect(x + k, y + 2 + Math.floor(k * 10 / 12), 1, 1); }
    }
    g.fillStyle = 'rgba(255,190,110,0.35)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1);
  });
  const mid = mk(midCol, g => {
    for (let i = 0; i < 5; i++) {         // catwalks with railings
      const y = 80 + Math.floor(r() * 260), x = Math.floor(r() * W), cw = 120 + Math.floor(r() * 200);
      g.fillRect(x, y, cw, 4); g.fillRect(x, y - 10, cw, 1); for (let k = 0; k < cw; k += 10) g.fillRect(x + k, y - 10, 1, 10);
      for (let k = 0; k < 3; k++) { const cx = x + Math.floor(r() * cw); g.fillRect(cx, y + 4, 1, 20 + Math.floor(r() * 50)); }
    }
    for (let i = 0; i < 3; i++) {         // big gears
      const cx = Math.floor(r() * W), cy = 100 + Math.floor(r() * 250), R = 18 + Math.floor(r() * 26);
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; g.fillRect(cx + Math.cos(a) * (R + 3) - 3, cy + Math.sin(a) * (R + 3) - 3, 6, 6); }
    }
    for (let i = 0; i < 4; i++) {         // machine blocks
      const x = Math.floor(r() * W), bw = 40 + Math.floor(r() * 60), bh = 30 + Math.floor(r() * 60);
      g.fillRect(x, H - bh, bw, bh); g.fillRect(x + bw / 3, H - bh - 20, 8, 20);
    }
    g.fillStyle = 'rgba(255,80,60,0.6)';
    for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * W), 60 + Math.floor(r() * 300), 2, 1);
  });
  return FAR[key] = { far, mid, W, H };
}
function drawFar(ctx, w, cam, vw, vh) {
  const th = w.theme, L = farLayers(th);
  const grd = ctx.createLinearGradient(0, 0, 0, vh); grd.addColorStop(0, th.sky[0]); grd.addColorStop(1, th.sky[1]);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, vw, vh);
  const lay = (img, k, yk) => {
    const ox = -Math.round(cam.x * k) % L.W, oy = Math.round(vh - L.H + 40 - cam.y * yk);
    for (let x = ox - L.W; x < vw; x += L.W) ctx.drawImage(img, x, oy);
  };
  lay(L.far, 0.12, 0.04);
  const fog = ctx.createLinearGradient(0, 0, 0, vh); fog.addColorStop(0, 'rgba(0,0,0,0)'); fog.addColorStop(1, th.sky[1] + '88');
  ctx.fillStyle = fog; ctx.fillRect(0, 0, vw, vh);
  lay(L.mid, 0.3, 0.1);
}
