// FOUNDRY - the built-in levels, made with a tiny level builder.
'use strict';

function LB(name, w, h, theme, o = {}) {
  const fg = [], bg = [];
  for (let y = 0; y < h; y++) { fg.push(new Array(w).fill('.')); bg.push(new Array(w).fill('w')); }
  const L = { v: 1, name, w, h, time: o.time || 0, ammo: o.ammo ?? 12, rockets: o.rockets || 0, theme, objs: [], enemies: {}, bosses: {} };
  const B = {
    fill(x, y, ww, hh, ch) { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) if (fg[j] && i >= 0 && i < w) fg[j][i] = ch; return B; },
    back(x, y, ww, hh, ch) { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) if (bg[j] && i >= 0 && i < w) bg[j][i] = ch; return B; },
    obj(t, x, y, p = {}) { L.objs.push(Object.assign({ id: uid(), t, x, y }, deep(OBJ[t].def || {}), p)); return L.objs[L.objs.length - 1]; },
    // stand something on the floor: tx = tile column, floor = tile row of the floor surface
    at(t, tx, floor, p = {}) { const o = Object.assign({ t }, OBJ[t].def || {}, p); const s = objSize(o); return B.obj(t, tx * TS + 8, floor * TS - s.h / 2, p); },
    lamps(x0, x1, row, step = 8) { for (let x = x0; x <= x1; x += step) B.obj('deco', x * TS + 8, row * TS + 4, { kind: 'lamp' }); return B; },
    move(o, pts, mode = 'ping', wait = 0, ease = 'ease in-out') { o.path = { pts: pts.map(([x, y, d]) => ({ x, y, d, e: ease })), mode, wait, start: 'always', near: 96 }; return o; },
    done() { L.fg = fg.map(r => r.join('')); L.bg = bg.map(r => r.join('')); return cleanLevel(L); },
  };
  return B;
}

function makeCampaign() {
  const out = [];

  // ---------------- 1: INTAKE (tutorial) ----------------
  {
    const B = LB('INTAKE', 90, 22, 'rust', { ammo: 8 });
    B.fill(0, 0, 90, 2, '#').fill(0, 19, 90, 3, 'C').fill(0, 0, 1, 22, '#').fill(89, 0, 1, 22, '#');
    B.back(20, 2, 10, 17, 'p').back(44, 2, 6, 17, 'm').back(60, 2, 8, 17, 'b').back(82, 2, 7, 17, 'c');
    B.at('spawn', 3, 19);
    B.at('sign', 6, 19, { text: 'A / D TO MOVE. W OR SPACE TO JUMP. AIM WITH THE MOUSE AND CLICK TO SHOOT.' });
    B.at('sign', 10, 19, { text: 'SPIKES HURT A LOT. JUMP OVER THEM.' });
    B.fill(12, 17, 3, 2, 'R');
    B.fill(18, 18, 3, 1, '^');
    B.at('ammo', 24, 19, { amount: 6 });
    B.at('sign', 27, 19, { text: 'AMMO IS LIMITED! GRAB AMMO BOXES. ENEMIES SOMETIMES DROP MORE.' });
    B.at('deco', 30, 19, { kind: 'barrel' }); B.at('deco', 31, 19, { kind: 'crate' });
    B.at('enemy', 37, 19, { def: 'grunt', face: 'left' });
    B.fill(44, 17, 2, 1, '=').fill(46, 15, 2, 1, '=').fill(48, 13, 3, 6, '#');
    B.at('sign', 42, 19, { text: 'GIRDERS: JUMP UP THROUGH THEM. HOLD S TO DROP DOWN.' });
    B.at('sign', 52, 19, { text: 'SAW BLADES MOVE. JUMP OVER THEM OR WAIT FOR A GAP.' });
    const saw = B.at('saw', 55, 19, { r: 11, dmg: 35 }); saw.y -= 1;
    B.move(saw, [[62 * TS + 8, saw.y, 1.6]], 'ping', 0.3);
    B.fill(66, 11, 1, 8, 'L').fill(67, 11, 8, 1, '=').fill(70, 12, 1, 7, 'G');
    B.at('sign', 63, 19, { text: 'GRATES STOP YOU, BUT NOT BULLETS. SHOOT THROUGH THEM! CLIMB THE LADDER WITH W.' });
    B.at('enemy', 73, 19, { def: 'grunt', face: 'left' });
    B.fill(77, 19, 6, 2, '~');
    B.at('sign', 75, 19, { text: 'YOU CAN SWIM. PRESS W TO SWIM UP. WATCH YOUR AIR!' });
    B.at('health', 80, 21, { amount: 30 });
    B.at('exit', 86, 19); B.obj('deco', 86 * TS + 8, 15 * TS, { kind: 'exit sign' });
    B.lamps(4, 86, 2, 9);
    B.at('deco', 15, 19, { kind: 'warning sign' }); B.obj('deco', 40 * TS, 8 * TS, { kind: 'gear' }); B.obj('deco', 58 * TS, 6 * TS, { kind: 'pipe across' });
    B.obj('deco', 33 * TS, 5 * TS, { kind: 'fan' }); B.at('deco', 84, 19, { kind: 'toxic barrel' });
    out.push(B.done());
  }

  // ---------------- 2: PRESS LINE (crushers, timer) ----------------
  {
    const B = LB('PRESS LINE', 110, 24, 'steel', { time: 150, ammo: 10, rockets: 1 });
    B.fill(0, 0, 110, 2, '#').fill(0, 21, 110, 3, 'C').fill(0, 0, 1, 24, '#').fill(109, 0, 1, 24, '#');
    B.fill(14, 0, 28, 13, '#');                      // low ceiling over the press line
    B.back(14, 13, 28, 8, 'c').back(42, 2, 30, 19, 'p').back(84, 2, 25, 19, 'm');
    B.at('spawn', 3, 21);
    B.at('sign', 9, 21, { text: 'CRUSHERS KILL INSTANTLY! WATCH THE RED LIGHT, THEN RUN. YOU HAVE A TIME LIMIT.' });
    [0, 0.6, 1.2, 1.8].forEach((dl, i) => B.obj('crusher', (18 + i * 6) * TS, 13 * TS + 8, { tw: 2, len: 7, dir: 'down', period: 2.4, delay: dl, hold: 0.3 }));
    B.at('checkpoint', 44, 21);
    B.at('ammo', 46, 21, { amount: 8 });
    B.obj('cturret', 52 * TS + 8, 2 * TS + 6, { rate: 0.6, range: 280, dmg: 7 });
    B.fill(52, 19, 2, 2, 'R').fill(60, 19, 2, 2, 'R');
    B.at('sign', 49, 21, { text: 'CEILING TURRETS CAN NOT BE DESTROYED. HIDE BEHIND COVER.' });
    B.at('enemy', 57, 21, { def: 'grunt', face: 'left' }); B.at('enemy', 65, 21, { def: 'grunt', face: 'left' });
    B.at('rockets', 68, 21, { amount: 2 });
    B.at('sign', 69, 21, { text: 'ROCKETS: PRESS 2 OR Q TO SWITCH. SHIELDS CAN NOT STOP EXPLOSIONS!' });
    B.fill(72, 21, 13, 3, '.').fill(72, 23, 13, 1, '#').fill(72, 22, 13, 1, '^');
    const plat = B.obj('platform', 74 * TS + 8, 19 * TS + 8, { tw: 3 });
    B.move(plat, [[82 * TS + 8, 19 * TS + 8, 2.4]], 'ping', 0.6);
    B.obj('laser', 92 * TS + 8, 2 * TS + 5, { angle: 90, on: 1.4, off: 1.2, len: 400, dps: 250 });
    B.at('enemy', 99, 21, { def: 'shieldman', face: 'left' });
    B.obj('turret', 106 * TS + 8, 18 * TS + 8, { mode: 'when crossed', angle: 180, rate: 2.5, range: 400, hp: 40, dmg: 8 });
    B.at('health', 88, 21, { amount: 40 });
    B.at('exit', 106, 21);
    B.lamps(3, 12, 2, 5); B.lamps(44, 104, 2, 10);
    for (let i = 0; i < 4; i++) B.obj('deco', (16 + i * 6) * TS + 8, 13 * TS + 6, { kind: 'red beacon' });
    B.at('deco', 47, 21, { kind: 'barrel' }); B.obj('deco', 76 * TS, 10 * TS, { kind: 'chain' }); B.obj('deco', 80 * TS, 10 * TS, { kind: 'chain' });
    B.obj('deco', 95 * TS, 8 * TS, { kind: 'monitor' }); B.obj('deco', 100 * TS, 5 * TS, { kind: 'vent' });
    out.push(B.done());
  }

  // ---------------- 3: COOLANT (water, coils, lasers) ----------------
  {
    const B = LB('COOLANT', 100, 26, 'toxic', { ammo: 14, rockets: 2 });
    B.fill(0, 0, 100, 2, '#').fill(0, 0, 1, 26, '#').fill(99, 0, 1, 26, '#');
    B.fill(0, 16, 20, 10, 'C').fill(20, 23, 26, 3, 'C').fill(46, 16, 54, 10, 'C');
    B.fill(20, 16, 26, 7, '~');
    B.fill(27, 14, 2, 9, 'R').fill(37, 14, 2, 9, 'R');
    B.back(20, 2, 26, 21, 'm').back(46, 2, 20, 14, 'p');
    B.at('spawn', 3, 16);
    B.at('sign', 7, 16, { text: 'COOLANT TANK AHEAD. ELECTRIC COILS ZAP EVERYTHING CLOSE TO THEM. WAIT UNTIL THEY STOP.' });
    B.obj('enemy', 15 * TS, 10 * TS, { def: 'drone', face: 'left' });
    B.obj('coil', 28 * TS, 14 * TS - 11, { range: 70, period: 2.6, on: 0.7, delay: 0 });
    B.obj('coil', 38 * TS, 14 * TS - 11, { range: 70, period: 2.6, on: 0.7, delay: 1.3 });
    B.at('ammo', 33, 23, { amount: 8 });
    B.at('checkpoint', 48, 16);
    B.fill(59, 8, 2, 2, '#');
    B.obj('laser', 60 * TS, 10 * TS + 5, { angle: 90, turn: 70, len: 220, dps: 220, color: 'green' });
    B.at('sign', 52, 16, { text: 'A TURNING LASER. RUN UNDER IT WHEN IT POINTS AWAY.' });
    B.fill(72, 6, 1, 10, 'L').fill(73, 6, 9, 1, '=').fill(75, 7, 1, 9, 'G');
    B.at('sign', 70, 16, { text: 'ROCKETS CAN NOT GET THROUGH GRATES. BULLETS CAN.' });
    B.at('enemy', 79, 16, { def: 'rocketeer', face: 'left' });
    B.at('enemy', 64, 16, { def: 'grunt', face: 'left' });
    B.obj('enemy', 68 * TS, 4 * TS, { def: 'drone', face: 'left' });
    B.fill(86, 10, 8, 1, '#');
    B.at('enemy', 90, 10, { def: 'sniper', face: 'left' });
    B.obj('coil', 84 * TS, 16 * TS - 11, { range: 40, period: 2, on: 0.8 });
    B.obj('coil', 88 * TS, 16 * TS - 11, { range: 40, period: 2, on: 0.8 });
    B.at('health', 82, 16, { amount: 40 }); B.at('rockets', 50, 16, { amount: 1 });
    B.at('exit', 96, 16);
    B.lamps(3, 96, 2, 11);
    B.at('deco', 10, 16, { kind: 'toxic barrel' }); B.at('deco', 11, 16, { kind: 'toxic barrel' }); B.at('deco', 55, 16, { kind: 'tank' });
    B.obj('deco', 33 * TS, 6 * TS, { kind: 'pipe up' }); B.obj('deco', 24 * TS, 4 * TS, { kind: 'steam' });
    out.push(B.done());
  }

  // ---------------- 4: THE CORE (boss) ----------------
  {
    const B = LB('THE CORE', 80, 30, 'furnace', { ammo: 16, rockets: 3 });
    B.fill(0, 0, 80, 2, '#').fill(0, 27, 80, 3, 'C').fill(0, 0, 1, 30, '#').fill(76, 0, 4, 30, '#');
    B.fill(1, 2, 27, 19, '#');                         // low entry corridor (rows 21-26)
    B.fill(28, 0, 2, 22, '#').fill(28, 22, 2, 5, 'D');   // arena gate
    B.fill(30, 0, 46, 7, '#');
    B.back(30, 7, 46, 20, 'b').back(1, 21, 27, 6, 'c');
    B.at('spawn', 3, 27);
    B.at('sign', 6, 27, { text: 'THE CORE. SOMETHING BIG IS WAITING BEHIND THE RED GATE.' });
    const s = B.obj('saw', 12 * TS + 8, 22 * TS, { r: 10, dmg: 35 });
    B.move(s, [[12 * TS + 8, 26 * TS + 2, 0.9]], 'ping', 0.2, 'ease in');
    B.obj('crusher', 18 * TS, 21 * TS + 8, { tw: 2, len: 5, dir: 'down', period: 2, hold: 0.2 });
    B.at('enemy', 22, 27, { def: 'grunt', face: 'left' });
    B.at('ammo', 9, 27, { amount: 6 });
    B.at('checkpoint', 25, 27);
    B.obj('arena', 53 * TS, 17 * TS, { tw: 46, th: 20 });
    B.at('boss', 62, 27, { def: 'warden' });
    B.fill(35, 22, 5, 1, '=').fill(66, 22, 5, 1, '=').fill(49, 17, 8, 1, '=');
    B.at('health', 36, 22, { amount: 40 }); B.at('health', 69, 22, { amount: 40 }); B.at('ammo', 52, 17, { amount: 10 }); B.at('rockets', 54, 17, { amount: 2 });
    B.at('exit', 73, 27);
    B.lamps(33, 73, 7, 8);
    for (const x of [31, 74]) B.obj('deco', x * TS + 8, 8 * TS, { kind: 'red beacon' });
    B.at('deco', 32, 27, { kind: 'barrel' }); B.obj('deco', 44 * TS, 11 * TS, { kind: 'gear' }); B.obj('deco', 64 * TS, 11 * TS, { kind: 'gear' });
    out.push(B.done());
  }
  return out;
}
