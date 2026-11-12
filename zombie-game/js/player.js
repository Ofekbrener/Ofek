// Player: movement, jump/slam, dash, and a combo attack chain built from the kit's authored clips.
'use strict';
// Weapons are meshes already parented to Matt's hand; we show one at a time.
// combo steps: Slash, SlashM (mirrored slash = backhand), Stab, Punch (shove), Spin (finisher)
const WEAPONS = {
  Knife:            {name: 'KNIFE',       cls: 'blade',  dmg: 1, range: 1.9, arc: 1.15, speed: 1.35, kb: 4,  combo: ['Slash', 'Stab', 'SlashM', 'Spin'], swing: 'swingLight', hit: ['hitKnife', 'gore'], col: 0xdfe8ff, desc: 'Fast stabs and slashes'},
  Spear:            {name: 'SPEAR',       cls: 'pierce', dmg: 2, range: 3.0, arc: .55,  speed: 1.0,  kb: 6,  combo: ['Stab', 'Stab', 'SlashM', 'Spin'], swing: 'swingBlade', hit: ['hitFlesh', 'gore'], col: 0xbfe6ff, desc: 'Long reach, hits in a line'},
  WoodenBat_Barbed: {name: 'BARBED BAT',  cls: 'blunt',  dmg: 2, range: 2.2, arc: 1.4,  speed: 1.05, kb: 10, combo: ['Slash', 'SlashM', 'Punch', 'Spin'], swing: 'swingHeavy', hit: ['hitHeavy', 'hitWood'], col: 0xffd9a0, desc: 'Sends zombies flying'},
  WoodenBat_Saw:    {name: 'SAW BAT',     cls: 'saw',    dmg: 2, range: 2.2, arc: 1.4,  speed: 1.0,  kb: 7,  combo: ['Slash', 'SlashM', 'Slash', 'Spin'], swing: 'swingHeavy', hit: ['hitSaw', 'gore'], col: 0xff9a9a, desc: 'Bleeds: 1 extra damage after 1 s'},
  Axe:              {name: 'FIRE AXE',    cls: 'heavy',  dmg: 3, range: 2.2, arc: 1.2,  speed: .85,  kb: 8,  combo: ['Slash', 'SlashM', 'Stab', 'Spin'], swing: 'swingHeavy', hit: ['hitAxe', 'bone'], col: 0xffb070, desc: 'Heavy chops, cuts heads off'},
  Guitar:           {name: 'GUITAR',      cls: 'blunt',  dmg: 2, range: 2.4, arc: 1.7,  speed: 1.0,  kb: 12, combo: ['Slash', 'SlashM', 'Punch', 'Spin'], swing: 'swingWide', hit: ['guitarHit', 'hitWood'], col: 0xd38cff, desc: 'Wide swings that stun'},
};
const CLIP_HIT = {Slash: .42, Stab: .45, Punch: .4, Run_Slash: .4, Run_Stab: .45}; // fraction of the clip where the blade connects
const WEAPON_MESHES = ['Axe', 'Guitar', 'Knife', 'Pistol', 'Rifle', 'Shotgun', 'SMG', 'Spear', 'WoodenBat_Barbed', 'WoodenBat_Saw'];

function makePlayer() {
  if (G.player) G.player.rig.dispose();
  const rig = new Rig('Characters_Matt');
  const P = G.player = {x: 0, z: 2, vx: 0, vz: 0, y: 0, vy: 0, air: false, face: -Math.PI / 2, hp: 5, maxHp: 5, rig,
    weapon: 'Knife', atk: null, queued: false, combo: 0, lastAtkEnd: -9, inv: 0, hurtT: 0, rage: 0, dashT: 0, dashCd: 0, stepD: 0,
    dead: false, deadT: 0, slam: false, landT: 0, spd: 0, killsForHeal: 0};
  equipWeapon('Knife'); rig.play('Idle');
  return P;
}
function equipWeapon(name) {
  const P = G.player; P.weapon = name;
  P.rig.model.traverse(o => { if (WEAPON_MESHES.includes(o.name)) o.visible = o.name === name; });
}
const weapon = () => WEAPONS[G.player.weapon];
const atkSpeed = () => UP.atkSpeed * (G.player.rage > 0 ? 1.3 : 1);

function nearestZombie(maxD) {
  let best = null, bd = maxD; const P = G.player;
  for (const z of G.zombies) { if (z.dying || z.state === 'rise') continue; const d = Math.hypot(z.x - P.x, z.z - P.z); if (d < bd) { bd = d; best = z; } }
  return best;
}
function startAttack() {
  const P = G.player; if (P.dead || G.state !== 'playing') return;
  if (P.atk) { if (P.atk.t > P.atk.hitAt * .6) P.queued = true; return; }
  if (P.hurtT > 0) return;
  if (P.air) { if (!P.slam) { P.slam = true; P.vy = -20; P.rig.play('Slash', {loop: false, restart: true, speed: 1.6, fade: .05}); AU.play('swingHeavy', {rate: .8}); } return; }
  const w = weapon(); if (G.time - P.lastAtkEnd > .55) P.combo = 0;
  const kind = w.combo[P.combo % w.combo.length]; P.combo++;
  const t = nearestZombie(5);
  const dir = t ? Math.atan2(t.z - P.z, t.x - P.x) : P.face;
  let clip = kind === 'Stab' ? 'Stab' : kind === 'Punch' ? 'Punch' : 'Slash';
  if (P.spd > 3 && (kind === 'Slash' || kind === 'Stab')) clip = 'Run_' + clip; // legs keep running while the arm swings
  const spd = w.speed * atkSpeed() * (kind === 'Spin' ? 1.2 : 1);
  P.rig.play(clip, {loop: false, restart: true, speed: spd, fade: .06});
  const dur = P.rig.dur(clip) / spd;
  P.atk = {kind, clip, t: 0, dur, hitAt: CLIP_HIT[clip] * dur, hit: false, swung: false, dir, spin: kind === 'Spin'};
  P.rig.body.scale.x = kind === 'SlashM' ? -1 : 1; // mirrored slash reads as a backhand
  P.face = dir; P.queued = false;
  if (Math.random() < .35 || kind === 'Spin') AU.play('pEffort', {vol: .55, bus: 'voice', max: 1});
}
function endAttack() {
  const P = G.player; P.atk = null; P.lastAtkEnd = G.time; P.rig.body.scale.x = 1; P.rig.body.rotation.y = 0;
  if (P.queued) { P.queued = false; startAttack(); }
}
function strike(a) {
  const P = G.player, w = weapon();
  const lunge = a.kind === 'Stab' ? 7 : a.spin ? 5 : 4; P.vx += Math.cos(a.dir) * lunge; P.vz += Math.sin(a.dir) * lunge;
  G.cam.kx += Math.cos(a.dir) * .25; G.cam.kz += Math.sin(a.dir) * .25;
  const range = w.range * UP.range * (a.spin ? 1.25 : a.kind === 'Stab' ? 1.15 : 1);
  const arc = a.spin ? 9 : a.kind === 'Stab' ? .6 : w.arc;
  const dmg = w.dmg + UP.dmg + (a.spin ? 1 : 0) + (a.kind === 'Punch' ? 0 : 0) + (P.rage > 0 ? 1 : 0);
  hitArea(P.x, P.z, a.dir, range, arc, dmg, {kind: a.kind, finisher: a.spin, w});
}
// shared by swings and slams
function hitArea(x, z, dir, range, arc, dmg, o) {
  const w = o.w || weapon(); let hits = 0, kills0 = G.kills;
  for (const zb of G.zombies) {
    if (zb.dying || zb.state === 'rise') continue;
    const dx = zb.x - x, dz = zb.z - z, d = Math.hypot(dx, dz);
    if (d > range + zb.r) continue;
    if (Math.abs(angDiff(dir, Math.atan2(dz, dx))) > arc && d > zb.r + .3) continue;
    let dd = dmg; const crit = Math.random() < UP.crit; if (crit) dd *= 2;
    damageZombie(zb, Math.atan2(dz, dx), dd, {w, kind: o.kind, finisher: o.finisher, crit, slam: o.slam});
    hits++;
  }
  for (const b of G.barrels) if (!b.dead && Math.hypot(b.x - x, b.z - z) < range + .4 && (Math.abs(angDiff(dir, Math.atan2(b.z - z, b.x - x))) < arc || o.slam)) hitBarrel(b);
  const kills = G.kills - kills0;
  if (hits) {
    const heavy = w.cls === 'heavy' || o.finisher || o.slam;
    hitstop((kills ? .11 + Math.min(kills, 4) * .025 : .06) * (heavy ? 1.3 : 1));
    shake((kills ? .4 : .2) + (heavy ? .15 : 0));
    AU.play(w.hit[0], {vol: 1, rate: heavy ? .85 : 1, dur: .6, max: 4});
    AU.play(w.hit[1], {vol: .7, dur: .6, delay: .02});
    AU.duck(kills ? .45 : .7, .2);
    if (kills >= 2) { slowmo(.3 + .1 * kills); popText(x, z, kills + 'x KILL!', '#ff4fd8', 38 + kills * 6, 3); AU.play('levelUp', {vol: .5}); }
    if (o.finisher) finisherFX(x, z, dir);
  }
  return hits;
}
function finisherFX(x, z) {
  if (UP.fire) { ring(x, z, 3, 0xff6a1a, .35); for (const zb of G.zombies) if (!zb.dying && Math.hypot(zb.x - x, zb.z - z) < 3.2) zb.burn = 2.2; AU.play('rage', {vol: .5}); }
  if (UP.chain) { let n = 0; for (const zb of G.zombies) { if (zb.dying || n >= 4) continue; if (Math.hypot(zb.x - x, zb.z - z) < 7) { bolt(x, z, zb.x, zb.z); damageZombie(zb, Math.atan2(zb.z - z, zb.x - x), 1 + UP.dmg, {w: weapon(), kind: 'chain'}); n++; } } if (n) AU.play('hitMetal', {vol: .6, rate: 1.5}); }
}
function jump() {
  const P = G.player; if (P.air || P.dead || P.atk || G.state !== 'playing') return;
  P.air = true; P.vy = 7.8; P.slam = false; P.rig.play('Jump', {loop: false, restart: true, fade: .05}); AU.play('jump', {vol: .5}); dust(P.x, P.z, 8);
}
function land() {
  const P = G.player; P.air = false; P.y = 0; P.vy = 0; P.landT = .25;
  dust(P.x, P.z, 14); AU.play('land', {vol: .7}); P.rig.play('Jump_Land', {loop: false, restart: true, fade: .05});
  if (P.slam) { // ground slam
    P.slam = false; const R = 3.2 * UP.slam, w = weapon();
    ring(P.x, P.z, R, w.col, .4); ring(P.x, P.z, R * .55, 0xffffff, .25); shake(.5); boom(P.x, P.z, w.col, 6);
    burst(P.x, P.z, 30, ['#6b6470', '#4a3b2c', '#ffffff'], 9, .2, .7, .1); AU.play('hitHardest', {vol: 1, rate: .7}); AU.play('explosion', {vol: .5, rate: 1.4});
    hitArea(P.x, P.z, 0, R, 9, w.dmg + UP.dmg + 1, {kind: 'Slam', slam: true, finisher: true, w}); hitstop(.09);
  }
}
function dash() {
  const P = G.player; if (!UP.dash || P.dashCd > 0 || P.dead || G.state !== 'playing') return;
  const mv = INPUT.move(); const a = Math.hypot(mv.x, mv.z) > .2 ? Math.atan2(mv.z, mv.x) : P.face;
  P.dashT = .18; P.dashCd = .9; P.inv = Math.max(P.inv, .3); P.vx = Math.cos(a) * 19; P.vz = Math.sin(a) * 19; P.face = a;
  AU.play('swingWide', {vol: .8, rate: 1.2}); dust(P.x, P.z, 10);
}
function hurtPlayer(dmg, fx, fz) {
  const P = G.player; if (P.inv > 0 || P.dead || G.state !== 'playing') return false;
  P.hp -= dmg; P.inv = 1.1; P.hurtT = .3; G.hurtFlash = .5; shake(.65); hitstop(.12); G.combo = 0;
  const d = Math.hypot(P.x - fx, P.z - fz) || 1; P.vx = (P.x - fx) / d * 12; P.vz = (P.z - fz) / d * 12;
  burst(P.x, P.z, 18, ['#c02020', '#ff3b3b'], 7, .12, .7); popText(P.x, P.z, 'OUCH!', '#ff5050', 32, 2.6);
  AU.play('hitHardest', {vol: 1, rate: .9}); AU.play('pHurt', {vol: .9, bus: 'voice', max: 1}); AU.duck(.3, .4);
  if (P.atk) { P.atk = null; P.rig.body.scale.x = 1; P.rig.body.rotation.y = 0; }
  if (P.hp <= 0) { P.dead = true; P.deadT = 0; P.rig.play('Death', {loop: false, restart: true, fade: .08}); slowmo(1.2); AU.play('pDeath', {bus: 'voice'}); AU.play('lose', {vol: .8, delay: .6}); AU.musicTo('music_calm', 2); setTimeout(gameOver, 2200); }
  else P.rig.play('HitReact', {loop: false, restart: true, fade: .05});
  return true;
}

function updatePlayer(dt) {
  const P = G.player, rig = P.rig;
  P.inv -= dt; P.hurtT -= dt; P.dashT -= dt; P.dashCd -= dt; P.landT -= dt; if (P.rage > 0) P.rage -= dt;
  if (P.dead) { P.deadT += dt; rig.mixer.update(dt); syncPlayer(); return; }
  const mv = INPUT.move(), ml = Math.min(1, Math.hypot(mv.x, mv.z));
  const top = 6.4 * UP.move * (P.rage > 0 ? 1.2 : 1) * (P.atk ? .35 : 1) * (P.hurtT > 0 ? .2 : 1);
  if (P.dashT <= 0) {
    const tx = mv.x * top, tz = mv.z * top, k = damp(P.air ? .05 : .0005, dt);
    P.vx = lerp(P.vx, tx, k); P.vz = lerp(P.vz, tz, k);
  }
  P.x += P.vx * dt; P.z += P.vz * dt;
  inArena(P, .45); collide(P, .45);
  P.spd = Math.hypot(P.vx, P.vz);
  if (ml > .2 && !P.atk) P.face = Math.atan2(mv.z, mv.x);
  if (P.dashT > 0 && Math.random() < .8) addPart({x: P.x, y: .9, z: P.z, vx: 0, vz: 0, vy: 0, g: 0, life: .25, max: .25, size: .35, col: '#7f8fb8', drag: 1, rx: 0, ry: 0});
  // jump arc
  if (P.air) { P.y += P.vy * dt; P.vy -= 24 * dt; if (P.y <= 0) land(); else if (rig.curName === 'Jump' && rig.cur.time >= rig.dur('Jump') * .95 && !P.slam) rig.play('Jump_Idle', {fade: .08}); }
  // attack timeline: wind-up -> swing sound -> strike -> recovery -> chain
  if (P.atk) {
    const a = P.atk; a.t += dt;
    const turn = angDiff(P.face, a.dir); P.face += turn * damp(.0001, dt);
    if (!a.swung && a.t >= a.hitAt - .07) { a.swung = true; AU.play(a.spin ? 'swingWide' : weapon().swing, {vol: .9, rate: weapon().cls === 'heavy' ? .85 : 1, max: 4}); }
    if (!a.hit && a.t >= a.hitAt) { a.hit = true; strike(a); }
    if (a.spin) rig.body.rotation.y = easeOutCubic(clamp(a.t / a.dur, 0, 1)) * Math.PI * 2;
    if (P.queued && a.t >= a.dur * .72) endAttack(); else if (a.t >= a.dur) endAttack();
  }
  // footsteps
  if (!P.air && P.spd > 1) { P.stepD += P.spd * dt; if (P.stepD > 1.9) { P.stepD = 0; AU.play('step', {vol: .35, max: 2}); } }
  // locomotion clips when nothing else owns the body
  const busy = P.atk || (P.hurtT > 0) || P.air || (P.landT > 0 && rig.curName === 'Jump_Land');
  if (!busy) {
    if (P.spd > 3.2) rig.play('Run', {speed: clamp(P.spd / 6, .8, 1.4), fade: .15});
    else if (P.spd > .5) rig.play('Walk', {speed: clamp(P.spd / 2.5, .7, 1.4), fade: .15});
    else rig.play('Idle', {fade: .2});
  }
  rig.mixer.update(dt);
  syncPlayer();
}
function syncPlayer() {
  const P = G.player, rig = P.rig;
  rig.root.position.set(P.x, P.y, P.z); rig.root.rotation.y = yawFor(P.face);
  rig.root.visible = !(P.inv > 0 && !P.dead && P.hurtT <= 0 && Math.floor(P.inv * 18) % 2);
  if (P.hurtT > 0) rig.flash(.6, 1, .1, .1); else if (P.rage > 0) rig.flash(.25 + .15 * Math.sin(G.time * 12), 1, .4, 0); else rig.flash(0);
}
