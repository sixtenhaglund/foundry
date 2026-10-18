// FOUNDRY - sound effects, all made live with Web Audio (no sound files).
'use strict';

const AU = { ctx: null, master: null, vol: 0.5, noise: null, amb: null, boss: null };
function auInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AU.ctx = new C();
  AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.vol; AU.master.connect(AU.ctx.destination);
  const len = AU.ctx.sampleRate; const buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = buf;
}
// one tone: type, start freq, end freq, length, volume
function tone(type, f0, f1, len, vol = 0.2, delay = 0) {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime + delay, o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + len);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + len + 0.02);
}
// burst of noise through a filter
function noise(len, vol = 0.3, freq = 1200, q = 0.7, type = 'lowpass', delay = 0) {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime + delay, s = AU.ctx.createBufferSource(), f = AU.ctx.createBiquadFilter(), g = AU.ctx.createGain();
  s.buffer = AU.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
}
let _lastSfx = {};
function sfx(name) {
  if (!AU.ctx) return;
  const now = performance.now(); if (_lastSfx[name] && now - _lastSfx[name] < 35) return; _lastSfx[name] = now;
  switch (name) {
    case 'shoot': tone('square', 900, 200, 0.08, 0.12); noise(0.06, 0.18, 3000); break;
    case 'eshoot': tone('square', 600, 150, 0.08, 0.07); noise(0.05, 0.08, 2000); break;
    case 'rocket': noise(0.4, 0.25, 600); tone('sawtooth', 200, 60, 0.4, 0.1); break;
    case 'boom': noise(0.7, 0.5, 400, 0.5); tone('sine', 120, 30, 0.6, 0.35); break;
    case 'hurt': tone('square', 300, 80, 0.2, 0.18); break;
    case 'ehurt': tone('square', 500, 200, 0.06, 0.08); break;
    case 'shield': tone('triangle', 1400, 900, 0.08, 0.12); break;
    case 'pickup': tone('square', 600, 600, 0.06, 0.1); tone('square', 900, 900, 0.08, 0.1, 0.06); break;
    case 'empty': tone('square', 120, 100, 0.05, 0.1); break;
    case 'jump': tone('square', 250, 500, 0.08, 0.06); break;
    case 'splash': noise(0.3, 0.2, 900, 1, 'bandpass'); break;
    case 'crush': noise(0.25, 0.45, 300); tone('square', 90, 40, 0.25, 0.25); break;
    case 'zap': noise(0.25, 0.25, 4000, 2, 'bandpass'); tone('sawtooth', 1200, 300, 0.2, 0.07); break;
    case 'charge': tone('sawtooth', 200, 1200, 0.5, 0.06); break;
    case 'laser': tone('sawtooth', 1500, 400, 0.25, 0.1); break;
    case 'die': tone('sawtooth', 400, 40, 0.8, 0.25); noise(0.6, 0.2, 800); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.15, 0.1, i * 0.1)); break;
    case 'check': tone('triangle', 700, 1400, 0.2, 0.12); break;
    case 'click': tone('square', 1000, 1000, 0.02, 0.05); break;
    case 'roar': tone('sawtooth', 120, 40, 1.2, 0.3); noise(1, 0.25, 300); break;
    case 'gate': tone('square', 80, 60, 0.5, 0.2); noise(0.5, 0.25, 200); break;
    case 'alarm': tone('square', 700, 900, 0.25, 0.08); tone('square', 900, 700, 0.25, 0.08, 0.25); break;
  }
}
// quiet factory hum while playing
function ambStart() {
  if (!AU.ctx || AU.amb) return;
  const o = AU.ctx.createOscillator(), o2 = AU.ctx.createOscillator(), g = AU.ctx.createGain(), s = AU.ctx.createBufferSource(), f = AU.ctx.createBiquadFilter(), g2 = AU.ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 50; o2.type = 'sine'; o2.frequency.value = 100.7;
  g.gain.value = 0.02; o.connect(g); o2.connect(g);
  s.buffer = AU.noise; s.loop = true; f.type = 'lowpass'; f.frequency.value = 220; g2.gain.value = 0.05; s.connect(f); f.connect(g2);
  g.connect(AU.master); g2.connect(AU.master); o.start(); o2.start(); s.start();
  AU.amb = [o, o2, s];
}
function ambStop() { if (AU.amb) { AU.amb.forEach(n => { try { n.stop(); } catch (e) { } }); AU.amb = null; } bossMusic(false); }
// pulsing bass while a boss fight is on
function bossMusic(on) {
  if (!AU.ctx) return;
  if (!on) { if (AU.boss) { AU.boss.forEach(n => { try { n.stop(); } catch (e) { } }); AU.boss = null; } return; }
  if (AU.boss) return;
  const o = AU.ctx.createOscillator(), lfo = AU.ctx.createOscillator(), lg = AU.ctx.createGain(), g = AU.ctx.createGain(), f = AU.ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 400;
  lfo.type = 'square'; lfo.frequency.value = 4; lg.gain.value = 0.05; g.gain.value = 0.06;
  lfo.connect(lg); lg.connect(g.gain); o.connect(f); f.connect(g); g.connect(AU.master); o.start(); lfo.start();
  AU.boss = [o, lfo];
}
