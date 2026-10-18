// FOUNDRY - start-up, input, and the main loop.
'use strict';

const cv = $('cv'), sctx = cv.getContext('2d');
const BUF = mkCanvas(VW, VH), bctx = BUF.getContext('2d');
bctx.imageSmoothingEnabled = false;
const IN = { keys: {}, pressed: {}, mx: 0, my: 0, mdown: false, rpressed: false, wheel: 0 };
let view = { x: 0, y: 0, s: 1 };   // where the 640x360 game picture sits on screen

function resize() { cv.width = innerWidth; cv.height = innerHeight; sctx.imageSmoothingEnabled = false; }
addEventListener('resize', resize); resize();

const typing = e => { const t = e.target && e.target.tagName; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'; };
addEventListener('keydown', e => {
  if (typing(e)) return;
  auInit();
  if (G.mode === 'editor') { edKey(e, true); if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault(); return; }
  if (!IN.keys[e.code]) IN.pressed[e.code] = true;
  IN.keys[e.code] = true;
  if (G.mode === 'play') {
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') { if (G.paused) resumePlay(); else if (!G.w.won && !G.w.player.dead) showPause(); else quitPlay(); }
    if (e.code === 'KeyR' && G.w && G.w.player.dead) endScreenAction();
    if ((e.code === 'Enter' || e.code === 'Space') && G.w && G.w.won) endScreenAction();
  } else if (e.code === 'Escape' && !$('modal').classList.contains('hidden')) closeModal();
});
addEventListener('keyup', e => {
  if (G.mode === 'editor') { edKey(e, false); return; }
  IN.keys[e.code] = false;
});
addEventListener('blur', () => { IN.keys = {}; IN.mdown = false; ED.keys = {}; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  auInit();
  if (G.mode === 'editor') { edMouse(e, 'down'); return; }
  if (G.mode === 'play') {
    if (G.w && (G.w.player.dead || G.w.won)) { endScreenAction(); return; }
    if (e.button === 0) IN.mdown = true;
    if (e.button === 2) IN.rpressed = true;
  }
});
addEventListener('mousemove', e => {
  IN.mx = e.clientX; IN.my = e.clientY;
  if (G.mode === 'editor' && (e.target === cv || ED.drag)) edMouse(e, 'move');
});
addEventListener('mouseup', e => {
  if (e.button === 0) IN.mdown = false;
  if (G.mode === 'editor') edMouse(e, 'up');
});
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (G.mode === 'editor') edZoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
  else if (G.mode === 'play') IN.wheel = Math.sign(e.deltaY);
}, { passive: false });

function readControls() {
  const K = IN.keys, P = IN.pressed;
  // mouse -> game picture -> world
  G.mouse.x = (IN.mx - view.x) / view.s; G.mouse.y = (IN.my - view.y) / view.s;
  const ctl = {
    left: K.KeyA || K.ArrowLeft, right: K.KeyD || K.ArrowRight, up: K.KeyW || K.ArrowUp, down: K.KeyS || K.ArrowDown,
    jump: K.Space || K.KeyW || K.ArrowUp, jumpPressed: P.Space || P.KeyW || P.ArrowUp,
    fire: IN.mdown, swap: P.KeyQ || IN.rpressed || IN.wheel !== 0, w1: P.Digit1, w2: P.Digit2,
    aimX: G.cam.x + G.mouse.x, aimY: G.cam.y + G.mouse.y,
  };
  IN.pressed = {}; IN.rpressed = false; IN.wheel = 0;
  return ctl;
}

// menu background: a level ticking away behind the buttons
let menuWorld = null, menuT = 0;
function drawMenuBg(dt) {
  if (!menuWorld) { menuWorld = makeWorld(CAMPAIGN[1], { editor: false }); menuWorld.enemies = []; menuWorld.player = null; }
  const w = menuWorld; w.time += dt; menuT += dt;
  const q = AU.ctx; AU.ctx = null;
  try { updateMovers(w, dt); updateHazards(w, dt); updateTraps(w, dt); updateBullets(w, dt); updateParts(w, dt); updateAnim(w, dt, null); } finally { AU.ctx = q; }
  const span = Math.max(0, w.pw - VW);
  const cam = { x: span * (0.5 - 0.5 * Math.cos(menuT * 0.05)), y: Math.max(0, w.ph - VH) * 0.6 };
  drawWorld(bctx, w, cam, VW, VH);
  blitGame();
}
function blitGame() {
  const s = Math.min(cv.width / VW, cv.height / VH);
  const sc = s >= 2 ? (s - Math.floor(s) < 0.15 ? Math.floor(s) : s) : s;
  view.s = sc; view.x = Math.floor((cv.width - VW * sc) / 2); view.y = Math.floor((cv.height - VH * sc) / 2);
  sctx.imageSmoothingEnabled = false;
  sctx.fillStyle = '#000'; sctx.fillRect(0, 0, cv.width, cv.height);
  sctx.drawImage(BUF, view.x, view.y, Math.round(VW * sc), Math.round(VH * sc));
}

let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  try {
    if (G.mode === 'play') {
      cv.style.cursor = 'none';
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) { const ctl = readControls(); updatePlay(STEP, ctl); acc -= STEP; n++; }
      if (n === 5) acc = 0;
      if (G.mode === 'play') { drawPlay(bctx); blitGame(); }
    } else {
      cv.style.cursor = 'default';
      if (G.mode === 'editor') { edUpdate(dt); drawEditor(sctx, cv.width, cv.height); }
      else if (G.mode === 'maker') { makerTick(dt); sctx.fillStyle = '#101215'; sctx.fillRect(0, 0, cv.width, cv.height); }
      else drawMenuBg(dt);
    }
  } catch (e) { console.error(e); }
}
showMenu();
requestAnimationFrame(frame);
