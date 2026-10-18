// FOUNDRY - shared helpers: math, easing, pixel font, ids.
'use strict';

const VW = 640, VH = 360;   // game resolution (scaled up with sharp pixels)
const TS = 16;              // tile size in pixels

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const rectsHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const circRect = (cx, cy, r, R) => { const nx = clamp(cx, R.x, R.x + R.w), ny = clamp(cy, R.y, R.y + R.h); return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r; };
// distance from point to segment
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
// does a segment touch a rectangle (sampled, good enough for beams)
function segRect(ax, ay, bx, by, R) {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
  for (let i = 0; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
    if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) return true;
  }
  return false;
}

let _uid = 1;
const uid = () => 'o' + (Date.now() % 1e7).toString(36) + (_uid++).toString(36);
const deep = o => JSON.parse(JSON.stringify(o));

// Easing: how a keyframe move speeds up / slows down. t goes 0..1.
const EASE = {
  'linear': t => t,
  'ease in': t => t * t * t,
  'ease out': t => 1 - (1 - t) ** 3,
  'ease in-out': t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  'back': t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  'bounce': t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
  'elastic': t => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
  'snap': t => t < 1 ? 0 : 1,
};
const EASE_NAMES = Object.keys(EASE);

// ---- 3x5 pixel font -------------------------------------------------------
const FONT = {};
(() => {
  const g = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', '!': '010010010000010',
    '?': '110001010000010', '-': '000000111000000', '+': '000010111010000', '/': '001001010100100', "'": '010010000000000',
    '(': '010100100100010', ')': '010001001001010', '%': '101001010100101', '<': '001010100010001', '>': '100010001010100',
    '=': '000111000111000', '#': '101111101111101', '*': '000101010101000', '_': '000000000000111', '"': '101101000000000',
  };
  for (const k in g) FONT[k] = g[k];
})();

// draw text in the pixel font. align: 'l' | 'c' | 'r'
function ptext(ctx, str, x, y, col = '#fff', s = 1, align = 'l', shadow = '#000') {
  str = String(str).toUpperCase();
  const w = str.length * 4 * s - s;
  if (align === 'c') x -= Math.floor(w / 2); else if (align === 'r') x -= w;
  x = Math.round(x); y = Math.round(y);
  const pass = (ox, oy, c) => {
    ctx.fillStyle = c;
    for (let i = 0; i < str.length; i++) {
      const gl = FONT[str[i]]; if (!gl) continue;
      for (let p = 0; p < 15; p++) if (gl[p] === '1') ctx.fillRect(x + i * 4 * s + (p % 3) * s + ox, y + Math.floor(p / 3) * s + oy, s, s);
    }
  };
  if (shadow) pass(s, s, shadow);
  pass(0, 0, col);
  return w;
}
const ptextW = (str, s = 1) => String(str).length * 4 * s - s;

// colour helpers
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function shade(h, f) { const [r, g, b] = hexRgb(h); const m = v => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255); return `rgb(${m(r)},${m(g)},${m(b)})`; }
