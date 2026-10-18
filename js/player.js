// FOUNDRY - the player: moving, jumping, swimming, climbing, shooting, pickups.
'use strict';

const PL = { run: 115, accG: 1100, accA: 700, grav: 950, jump: 315, fall: 430, swim: 70, climb: 80, maxHp: 100 };
const WEAPONS = [
  { name: 'PISTOL', cd: 0.2 },
  { name: 'ROCKETS', cd: 0.8 },
];

function makePlayer(w, cx, cy) {
  return { x: cx - 5, y: cy - 10, w: 10, h: 20, vx: 0, vy: 0, face: 1, hp: PL.maxHp, inv: 0, ground: false, coyote: 0, jumpBuf: 0,
    weapon: 0, ammo: w.L.ammo, rockets: w.L.rockets, cd: 0, aim: 0, air: 10, water: false, climb: false, dead: false, deadT: 0,
    plat: null, anim: 0, recoil: 0, jumpHeld: false, drown: 0 };
}

function updatePlayer(w, dt, ctl) {
  const P = w.player;
  if (P.dead) { P.deadT += dt; return; }
  P.inv = Math.max(0, P.inv - dt); P.cd = Math.max(0, P.cd - dt); P.recoil = Math.max(0, P.recoil - dt * 6);
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;

  // ride a moving platform
  if (P.plat) { P.x += P.plat.dx; P.y += P.plat.dy; }

  P.water = TILES[tileUnder(w, cx, cy)]?.water;
  const headWet = TILES[tileUnder(w, cx, P.y + 3)]?.water;
  const onLadder = !!rectInTile(w, { x: P.x + 3, y: P.y + 2, w: P.w - 6, h: P.h - 2 + (ctl.down ? 3 : 0) }, T => T.ladder);
  if (onLadder && (ctl.up || ctl.down) && !P.climb) { P.climb = true; P.vy = 0; }
  if (!onLadder) P.climb = false;

  // walking
  const dir = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
  const top = P.water ? PL.swim : PL.run;
  const acc = P.ground ? PL.accG : PL.accA;
  if (dir) { P.vx += clamp(dir * top - P.vx, -acc * dt, acc * dt); }
  else { const f = (P.ground ? PL.accG : PL.accA * 0.5) * dt; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f; }

  // jumping (coyote time = a tiny grace period after walking off a ledge)
  P.coyote = P.ground ? 0.1 : Math.max(0, P.coyote - dt);
  if (ctl.jumpPressed) P.jumpBuf = 0.12; else P.jumpBuf = Math.max(0, P.jumpBuf - dt);
  if (P.climb) {
    P.vy = ((ctl.down ? 1 : 0) - (ctl.up ? 1 : 0)) * PL.climb;
    if (P.jumpBuf > 0 && !ctl.up) { P.climb = false; P.vy = -PL.jump * 0.7; P.jumpBuf = 0; sfx('jump'); }
  } else if (P.water) {
    P.vy = Math.min(P.vy + PL.grav * 0.25 * dt, 70);
    const surface = !TILES[tileUnder(w, cx, P.y - 3)]?.water;
    if (surface && (ctl.jumpPressed || ctl.up)) { P.vy = -290; sfx('splash'); }     // leap out at the surface
    else if (ctl.jumpPressed || (ctl.up && P.vy > -40)) { P.vy = -150; if (ctl.jumpPressed) sfx('splash'); }
    if (ctl.down) P.vy = Math.min(P.vy + 300 * dt, 110);
  } else {
    P.vy = Math.min(P.vy + PL.grav * dt, PL.fall);
    if (P.jumpBuf > 0 && P.coyote > 0) { P.vy = -PL.jump; P.coyote = 0; P.jumpBuf = 0; P.jumpHeld = true; sfx('jump'); }
    if (P.jumpHeld && !ctl.jump && P.vy < 0) { P.vy *= 0.45; P.jumpHeld = false; }
    if (P.vy >= 0) P.jumpHeld = false;
  }
  const wasWater = P.water;
  const r = moveBody(w, P, P.vx * dt, P.vy * dt, ctl.down || P.climb);
  if (r.hitX) P.vx = 0;
  if (r.hitY) P.vy = 0;
  P.ground = r.ground; P.plat = r.plat;
  if (P.climb && r.ground && ctl.down) P.climb = false;
  if (!wasWater && TILES[tileUnder(w, P.x + P.w / 2, P.y + P.h / 2)]?.water) { sfx('splash'); spawnParts(w, P.x + 5, P.y + 10, 8, '#7ab8ff', 60, 0.5, 200); }
  P.anim += Math.abs(P.vx) * dt;

  // breath under water
  if (headWet) { P.air -= dt; if (P.air < 0) { P.drown += dt; if (P.drown > 0.5) { P.drown = 0; hurtPlayer(w, 10, null, 0, 'DROWNED'); } } }
  else P.air = Math.min(10, P.air + dt * 3);

  // spikes
  const sp = rectInTile(w, { x: P.x + 2, y: P.y + 4, w: P.w - 4, h: P.h - 4 }, T => T.spike);
  if (sp) { hurtPlayer(w, 40, sp.x * TS + 8, 1, 'SPIKES'); if (!P.dead) P.vy = -260; }
  if (P.y > w.ph + 40) killPlayer(w, 'FELL');

  // aiming + weapons
  const sx = P.x + P.w / 2, sy = P.y + 8;
  P.aim = Math.atan2(ctl.aimY - sy, ctl.aimX - sx);
  P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
  if (ctl.swap) { P.weapon = 1 - P.weapon; sfx('click'); }
  if (ctl.w1) P.weapon = 0; if (ctl.w2) P.weapon = 1;
  if (ctl.fire && P.cd <= 0) {
    const mx = sx + Math.cos(P.aim) * 10, my = sy + Math.sin(P.aim) * 10;
    if (P.weapon === 0) {
      if (P.ammo > 0) {
        P.ammo--; P.cd = WEAPONS[0].cd; P.recoil = 1;
        w.bullets.push({ x: mx, y: my, vx: Math.cos(P.aim) * 460, vy: Math.sin(P.aim) * 460, owner: 'p', dmg: 12, life: 1.2, col: '#ffe080' });
        spawnParts(w, mx, my, 3, '#ffd060', 40, 0.12, 0); sfx('shoot');
      } else { P.cd = 0.3; sfx('empty'); w.emptyFlash = 0.6; }
    } else {
      if (P.rockets > 0) {
        P.rockets--; P.cd = WEAPONS[1].cd; P.recoil = 1.5;
        w.rockets.push({ x: mx, y: my, vx: Math.cos(P.aim) * 150, vy: Math.sin(P.aim) * 150, a: P.aim, owner: 'p', dmg: 70, life: 3, sp: 150 });
        P.vx -= Math.cos(P.aim) * 40; sfx('rocket');
      } else { P.cd = 0.3; sfx('empty'); w.emptyFlash = 0.6; }
    }
  }

  // pickups
  for (const k of w.pickups) {
    if (k.taken) continue;
    const s = objSize(k);
    if (rectsHit(P, { x: k.x - s.w / 2, y: k.y - s.h / 2, w: s.w, h: s.h })) {
      if (k.t === 'health' && P.hp >= PL.maxHp) continue;
      k.taken = true; sfx('pickup');
      if (k.t === 'ammo') { P.ammo += k.amount; floatText(w, k.x, k.y - 8, '+' + k.amount + ' AMMO', '#ffe080'); }
      if (k.t === 'rockets') { P.rockets += k.amount; floatText(w, k.x, k.y - 8, '+' + k.amount + ' ROCKET' + (k.amount > 1 ? 'S' : ''), '#ff9050'); if (P.rockets === k.amount && P.ammo === 0) P.weapon = 1; }
      if (k.t === 'health') { P.hp = Math.min(PL.maxHp, P.hp + k.amount); floatText(w, k.x, k.y - 8, '+' + k.amount + ' HP', '#70ff90'); }
    }
  }
  // checkpoints
  for (const c of w.checkpoints) if (!c.on && Math.abs(c.x - (P.x + 5)) < 10 && Math.abs(c.y - (P.y + 10)) < 20) {
    w.checkpoints.forEach(o => o.on = false); c.on = true; w.cp = { x: c.x, y: c.y + 2, id: c.id }; sfx('check'); floatText(w, c.x, c.y - 20, 'CHECKPOINT', '#70d0ff');
  }
  // signs
  w.signText = null;
  for (const s of w.signs) if (dist(s.x, s.y, P.x + 5, P.y + 10) < 28) w.signText = s.text;
  // exit door
  if (w.exit && !w.won) {
    const e = w.exit, open = !w.boss || w.boss.dead;
    if (Math.abs(e.x - (P.x + 5)) < 12 && Math.abs(e.y - (P.y + 10)) < 18) {
      if (open) { w.won = true; sfx('win'); }
      else w.lockedMsg = 1;
    }
  }
}

// cause = text shown on the death screen
function hurtPlayer(w, dmg, fromX, kb = 1, cause = 'SHOT') {
  const P = w.player; if (!P || P.dead || P.inv > 0 || w.won) return;
  if (w.dummy) { spawnParts(w, P.x + 5, P.y + 10, 4, '#ffd060', 60, 0.3, 200); return; }   // maker preview dummy
  P.hp -= dmg; P.inv = 0.6; w.shake = Math.max(w.shake, 4); w.hurtFlash = 0.3;
  if (fromX != null && kb) { P.vx = Math.sign(P.x + 5 - fromX || 1) * 170 * kb; P.vy = Math.min(P.vy, -140 * kb); }
  sfx('hurt'); spawnParts(w, P.x + 5, P.y + 10, 6, '#c03030', 80, 0.4, 300);
  if (P.hp <= 0) killPlayer(w, cause);
}
// lasers burn through invincibility frames
function burnPlayer(w, dmg, cause) {
  const P = w.player; if (!P || P.dead || w.won || w.dummy) return;
  P.hp -= dmg; w.hurtFlash = 0.15; if (Math.random() < 0.3) spawnParts(w, P.x + 5, P.y + 10, 1, '#ffb060', 50, 0.3, -50);
  if (P.hp <= 0) killPlayer(w, cause);
}
function killPlayer(w, cause) {
  const P = w.player; if (P.dead || w.won || w.dummy) return;
  P.dead = true; P.deadT = 0; P.hp = 0; w.deathCause = cause; w.shake = 8;
  spawnParts(w, P.x + 5, P.y + 10, 30, '#c03030', 160, 0.9, 400); spawnParts(w, P.x + 5, P.y + 10, 10, '#3a4a3a', 120, 0.9, 400); sfx('die');
}
