// FOUNDRY - enemies built from designs (made in the ENEMY MAKER).
'use strict';

function makeEnemy(o, defOverride) {
  const d = defOverride || getEnemy(o.def), s = enemySize(d);
  return { o, d, x: o.x - s.w / 2, y: o.y - s.h / 2, w: s.w, h: s.h, vx: 0, vy: 0, hp: d.maxHp, face: o.face === 'right' ? 1 : -1,
    cd: rand(0.4, 1.2), alert: 0, flash: 0, dead: false, ground: false, burst: 0, bt: 0, charge: 0, aim: 0, anim: Math.random() * 10,
    homeX: o.x, homeY: o.y, sh: { up: d.shield === 'always up', t: 0, cd: 0, hp: d.shieldHp }, bob: Math.random() * 6, stuck: 0 };
}

function enemyWeapon(d) {
  const W = { none: null, pistol: { burst: 1, pellets: 1, spread: 0 }, rifle: { burst: 3, pellets: 1, spread: 0.03 }, shotgun: { burst: 1, pellets: 5, spread: 0.3 },
    rocket: { rocket: true }, laser: { laser: true } }[d.weapon];
  if (!W) return null;
  return Object.assign({}, W, { burst: Math.max(W.burst || 1, d.burst || 1), pellets: Math.max(W.pellets || 1, d.pellets || 1),
    spread: Math.max(W.spread || 0, (d.spread || 0) * Math.PI / 180) });
}

function updateEnemies(w, dt) {
  const P = w.player, alive = P && !P.dead;
  const pcx = alive ? P.x + 5 : 0, pcy = alive ? P.y + 10 : 0;
  for (const e of w.enemies) {
    if (e.dead || e.still) continue;
    const d = e.d, ecx = e.x + e.w / 2, ecy = e.y + e.h / 2, eyeY = e.y + Math.min(6, e.h * 0.3);
    e.flash = Math.max(0, e.flash - dt); e.anim += dt;
    e.alert = Math.max(0, e.alert - dt);
    const D = alive ? dist(ecx, ecy, pcx, pcy) : 1e9;
    const inFront = alive && ((pcx - ecx) * e.face > 0 || e.alert > 0 || D < 50);
    const sees = alive && D < d.sight && inFront && lineClear(w, ecx, eyeY, pcx, pcy - 4);
    if (sees && e.alert <= 0 && e.ground && d.ai !== 'fly') e.vy = -110;   // little jump of surprise
    if (sees) e.alert = 2.5;
    const hunting = e.alert > 0 && alive;
    const W = enemyWeapon(d);

    // ---- shield
    const sh = e.sh;
    sh.cd = Math.max(0, sh.cd - dt);
    if (sh.cd <= 0 && sh.hp <= 0) sh.hp = d.shieldHp;
    if (d.shield === 'always up') sh.up = sh.cd <= 0;
    else if (sh.up) { sh.t -= dt; if (sh.t <= 0) { sh.up = false; sh.cd = d.shieldCd; } }
    else if (d.shield === 'raises when aimed at' && sh.cd <= 0 && alive && D < 320) {
      const toMe = Math.atan2(ecy - (P.y + 8), ecx - pcx);
      if (Math.abs(angDiff(P.aim, toMe)) < 0.22) { sh.up = true; sh.t = d.shieldTime; }
    }
    if (sh.up && hunting) e.face = pcx > ecx ? 1 : -1;
    const slow = sh.up ? 0.4 : 1;

    // ---- movement
    const sp = d.speed * slow;
    if (d.ai === 'fly') {
      e.bob += dt * 3;
      let tx = e.homeX, ty = e.homeY + Math.sin(e.bob) * 6;
      if (hunting) { const side = ecx < pcx ? -1 : 1; tx = pcx + side * (d.keepDist || 80); ty = pcy - 40 + Math.sin(e.bob) * 8; e.face = pcx > ecx ? 1 : -1; }
      const dx = tx - ecx, dy = ty - ecy, L = Math.hypot(dx, dy) || 1;
      const want = Math.min(sp, L * 3);
      e.vx += clamp(dx / L * want - e.vx, -200 * dt, 200 * dt); e.vy += clamp(dy / L * want - e.vy, -200 * dt, 200 * dt);
      const r = moveBody(w, e, e.vx * dt, e.vy * dt, true); if (r.hitX) e.vx = 0; if (r.hitY) e.vy = 0;
    } else {
      let want = 0;
      const melee = !W;
      if (d.ai === 'patrol') {
        if (hunting && !melee) { e.face = pcx > ecx ? 1 : -1; want = 0; }
        else if (hunting && melee) { e.face = pcx > ecx ? 1 : -1; want = e.face * sp * 1.3; }
        else want = e.face * sp * 0.6;
      } else if (d.ai === 'guard') {
        if (hunting) e.face = pcx > ecx ? 1 : -1;
        if (hunting && melee && D < 120) want = e.face * sp;
      } else if (d.ai === 'chase') {
        if (hunting) {
          e.face = pcx > ecx ? 1 : -1;
          const gap = Math.abs(pcx - ecx);
          want = (d.keepDist && gap < d.keepDist && !melee) ? -e.face * sp * 0.6 : (gap > (melee ? 2 : 40) ? e.face * sp : 0);
        } else want = e.face * sp * 0.4;
      }
      // turn at walls and ledges when wandering
      if (e.ground && want) {
        const fx = want > 0 ? e.x + e.w + 2 : e.x - 2;
        const wall = blockedAt(w, fx, e.y + e.h - 4, 'p');
        const ledge = !solidBelow(w, fx, e.y + e.h + 4) && !(TILES[tileUnder(w, fx, e.y + e.h + 4)]?.water);
        if (wall || ledge) {
          if (d.jump && wall && hunting && !blockedAt(w, fx, e.y - 18, 'p')) { e.vy = -300; }
          else if (!hunting || ledge) { if (!hunting) e.face = -e.face; want = 0; }
        }
      }
      e.vx += clamp(want - e.vx, -600 * dt, 600 * dt);
      const inWater = TILES[tileUnder(w, ecx, ecy)]?.liquid;
      if (TILES[tileUnder(w, ecx, e.y + e.h - 2)]?.lava) { damageEnemy(w, e, 300 * dt, null, true); e.vy = Math.min(e.vy, -120); }
      e.vy = Math.min(e.vy + (inWater ? 250 : 950) * dt, inWater ? 60 : 430);
      if (d.jump && hunting && e.ground && pcy < ecy - 30 && Math.abs(pcx - ecx) < 60 && Math.random() < dt * 2) e.vy = -320;
      const r = moveBody(w, e, e.vx * dt, e.vy * dt, false);
      if (r.hitX) { e.vx = 0; if (!hunting) e.face = -e.face; }
      if (r.hitY) e.vy = 0;
      e.ground = r.ground;
      if (r.plat) { e.x += r.plat.dx; e.y += r.plat.dy; }
      if (TILES[tileUnder(w, ecx, e.y + e.h - 2)]?.spike) damageEnemy(w, e, 100 * dt, null, true);
    }
    if (e.y > w.ph + 40) { e.dead = true; continue; }

    // ---- shooting
    if (W && hunting && (!sh.up || d.shootShield)) {
      const want = Math.atan2(pcy - eyeY, pcx - ecx);
      if (e.charge > 0) {                       // laser: aim line, then fire
        e.charge -= dt; e.aim += clamp(angDiff(e.aim, want), -0.6 * dt, 0.6 * dt);
        if (e.charge <= 0) {
          const end = raycast(w, ecx, eyeY, e.aim, d.sight + 60, 'l');
          (w.beams || (w.beams = [])).push({ x1: ecx, y1: eyeY, x2: end.x, y2: end.y, life: 0.15, col: d.eye });
          if (alive && segRect(ecx, eyeY, end.x, end.y, P)) hurtPlayer(w, d.dmg, ecx, 1, 'SNIPED');
          sfx('laser'); e.cd = 1 / d.rate;
        }
      } else if (e.burst > 0) {
        e.bt -= dt;
        if (e.bt <= 0) { e.burst--; e.bt = 0.11; enemyShoot(w, e, W, want); }
      } else if (sees) {
        e.cd -= dt;
        if (e.cd <= 0) {
          if (W.laser) { e.charge = 0.8; e.aim = want; sfx('charge'); }
          else if (W.rocket) { e.cd = 1 / d.rate; w.rockets.push({ x: ecx + e.face * 6, y: eyeY, a: want + rand(-0.05, 0.05), sp: 90, max: 230, owner: 'e', dmg: d.dmg, life: 3.5 }); sfx('rocket'); }
          else { e.burst = W.burst; e.bt = 0; e.cd = 1 / d.rate; }
        }
      }
    } else { e.burst = 0; if (e.charge > 0 && !hunting) e.charge = 0; }

    // touching the player
    if (alive && d.contact > 0 && rectsHit(e, P)) hurtPlayer(w, d.contact, ecx, 1.2, d.name);
  }
  w.enemies = w.enemies.filter(e => !e.dead || e.deadT < 1);
  for (const e of w.enemies) if (e.dead) e.deadT = (e.deadT || 0) + dt;
}

function enemyShoot(w, e, W, a) {
  const d = e.d, sx = e.x + e.w / 2 + Math.cos(a) * 8, sy = e.y + Math.min(6, e.h * 0.3) + Math.sin(a) * 4;
  e.recoil = 1;
  for (let i = 0; i < W.pellets; i++) {
    const aa = a + (W.pellets > 1 ? (i / (W.pellets - 1) - 0.5) * W.spread * 2 : rand(-W.spread, W.spread)) + rand(-0.03, 0.03);
    w.bullets.push({ x: sx, y: sy, vx: Math.cos(aa) * d.bspeed, vy: Math.sin(aa) * d.bspeed, owner: 'e', dmg: d.dmg, life: 2.5, col: '#ff6040', cause: d.name });
  }
  sfx('eshoot');
}

// returns 'blocked' if the shield stopped it
function damageEnemy(w, e, dmg, fromX, blast) {
  if (e.dead) return;
  const d = e.d, cx = e.x + e.w / 2;
  if (e.sh.up && !blast && fromX != null && (fromX - cx) * e.face > 0) {
    e.sh.hp -= dmg; sfx('shield'); spawnParts(w, cx + e.face * e.w * 0.6, e.y + e.h / 2, 4, '#a0e0ff', 70, 0.25, 100);
    if (e.sh.hp <= 0) { e.sh.up = false; e.sh.cd = d.shieldCd + 2; spawnParts(w, cx + e.face * 8, e.y + e.h / 2, 12, '#a0e0ff', 120, 0.5, 300); floatText(w, cx, e.y - 6, 'SHIELD BROKEN', '#a0e0ff'); }
    return 'blocked';
  }
  e.hp -= dmg; e.flash = 0.08; e.alert = 3;
  if (fromX != null) { e.face = fromX > cx ? 1 : -1; const k = 1 - (d.heavy || 0); e.vx -= e.face * 60 * k; }
  if (d.shield === 'raises when hit' && !e.sh.up && e.sh.cd <= 0) { e.sh.up = true; e.sh.t = d.shieldTime; }
  if (!blast) sfx('ehurt');
  if (Math.random() < 0.5 || dmg > 5) spawnParts(w, cx, e.y + e.h / 2, 3, d.body === 'robot' || d.body === 'drone' ? '#ffd060' : '#a02020', 70, 0.35, 250);
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 0; w.kills++;
    shatterEnemy(w, e);   // breaks into pieces that fly and bounce (anim.js)
    if (d.body === 'drone') boomFx(w, cx, e.y + e.h / 2, 0.5);
    let drop = d.drop; if (drop === 'random') drop = Math.random() < 0.55 ? 'ammo' : Math.random() < 0.3 ? 'health' : Math.random() < 0.25 ? 'rockets' : 'nothing';
    if (drop !== 'nothing' && OBJ[drop]) w.pickups.push({ t: drop, x: cx, y: Math.min(e.y + e.h - 5, w.ph), amount: { ammo: 6, rockets: 1, health: 20 }[drop], drop: true });
  }
  return 'hit';
}
