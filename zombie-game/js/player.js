// Player: movement, jump/slam, dash, and a combo chain built from the kit's authored clips.
// Every weapon has its own combo, trail, on-hit effect and 4th-hit finisher.
'use strict';
// combos are move names from js/moves.js (each its own arm motion and hit shape), and one finisher per weapon
const WEAPONS = {
  Knife: {name: 'KNIFE', cls: 'blade', dmg: 1, range: 1.9, arc: 1.15, speed: 1.5, kb: 4, lunge: 4, twist: .3,
    combo: ['jab', 'backslash', 'stabDown', 'Flurry'], fin: 'FLURRY', finText: '5 rapid stabs', swing: 'swingLight', hit: ['hitKnife', 'gore'],
    col: 0xdfe8ff, trail: {col: 0xe8f2ff, width: 1.25, base: .15, fx: 'glint'}, desc: 'Fast. Double damage chance from behind.'},
  Spear: {name: 'SPEAR', cls: 'pierce', dmg: 2, range: 3.2, arc: .42, speed: 1.0, kb: 7, lunge: 9, twist: .2,
    combo: ['thrust', 'thrust', 'sweep', 'Javelin'], fin: 'JAVELIN', finText: 'throw it through the horde, it comes back', swing: 'swingBlade', hit: ['hitFlesh', 'gore'],
    col: 0x7fe0ff, trail: {col: 0x7fe0ff, width: 1.0, base: .6, fx: 'streak'}, desc: 'Long reach. Pierces every zombie in a line.'},
  WoodenBat_Barbed: {name: 'BARBED BAT', cls: 'blunt', dmg: 2, range: 2.2, arc: 1.45, speed: .95, kb: 13, lunge: 4, twist: .45,
    combo: ['hSwing', 'backhand', 'overhead', 'HomeRun'], fin: 'HOME RUN', finText: 'one zombie flies 15 m and flattens others', swing: 'swingHeavy', hit: ['hitHeavy', 'hitWood'],
    col: 0xffc080, trail: {col: 0xd99a55, width: 1.08, base: .45, fx: 'splinter'}, desc: 'Huge knockback.'},
  WoodenBat_Saw: {name: 'SAW BAT', cls: 'saw', dmg: 2, range: 2.2, arc: 1.4, speed: 1.05, kb: 6, lunge: 3, twist: .4,
    combo: ['hSwing', 'backhand', 'grind', 'Grinder'], fin: 'GRINDER', finText: 'a spinning 6-hit grind', swing: 'swingHeavy', hit: ['hitSaw', 'gore'],
    col: 0xff6a6a, trail: {col: 0xff3a3a, width: 1.08, base: .45, fx: 'sparks'}, desc: 'Bleed stacks: up to 3 damage per second.'},
  Axe: {name: 'FIRE AXE', cls: 'heavy', dmg: 3, range: 2.2, arc: 1.2, speed: .8, kb: 8, lunge: 5, twist: .45, glow: 0xff6a1a,
    combo: ['chop', 'diag', 'chop', 'FireLine'], fin: 'FIRE LINE', finText: 'a 6 m wall of fire', swing: 'swingHeavy', hit: ['hitAxe', 'bone'],
    col: 0xffa040, trail: {col: 0xff6a1a, width: 1.25, base: .55, fx: 'fire'}, desc: 'Sets zombies on fire. Cuts heads off.'},
  Guitar: {name: 'GUITAR', cls: 'blunt', dmg: 2, range: 2.4, arc: 1.7, speed: 1.0, kb: 11, lunge: 3, twist: .45,
    combo: ['hSwing', 'overhead', 'neckJab', 'PowerChord'], fin: 'POWER CHORD', finText: 'a 5.5 m shockwave that knocks everyone down', swing: 'swingWide', hit: ['guitarHit', 'hitWood'],
    col: 0xd38cff, trail: {col: 0xc070ff, width: 1.15, base: .3, fx: 'notes'}, desc: 'Every hit stuns for 1 s.'},
};
// finisher -> clip, speed multiplier, repeats, spin turns
const FIN = {Flurry: {clip: 'Stab', move: 'jab', spd: 2.3, rep: 5}, Javelin: {clip: 'Punch', move: 'throw', spd: 1}, HomeRun: {clip: 'Slash', move: 'hSwing', spd: .75},
  Grinder: {clip: 'Slash', move: 'spinOut', spd: .55, spin: 2, ticks: 6}, FireLine: {clip: 'Slash', move: 'chop', spd: .7}, PowerChord: {clip: 'Slash', move: 'overhead', spd: .8}};
// Hit frames: each clip raises the arm in a first burst, then strikes in a second burst; these are the strike peaks.
const CLIP_HIT = {Slash: .31, Stab: .28, Punch: .36, Run_Slash: .36, Run_Stab: .32};
const WEAPON_MESHES = ['Axe', 'Guitar', 'Knife', 'Pistol', 'Rifle', 'Shotgun', 'SMG', 'Spear', 'WoodenBat_Barbed', 'WoodenBat_Saw'];

function makePlayer() {
  if (G.player) G.player.rig.dispose();
  const rig = new Rig('Characters_' + (MODELS['Characters_' + LOOK.char] ? LOOK.char : 'Matt'));
  applyLook(rig, LOOK);
  const P = G.player = {x: 0, z: 2, vx: 0, vz: 0, y: 0, vy: 0, air: false, face: -Math.PI / 2, hp: 5, maxHp: 5, rig,
    weapon: 'Knife', wMesh: null, atk: null, queued: false, combo: 0, lastAtkEnd: -9, inv: 0, hurtT: 0, dashT: 0, dashCd: 0, stepD: 0,
    dead: false, deadT: 0, slam: false, landT: 0, spd: 0, killsForHeal: 0, javelin: null, stormN: 0, twist: 0, lean: 0, poseW: 0, poseKey: null};
  P.wLight = new THREE.PointLight(0xff6a1a, 0, 4, 2);
  equipWeapon(WEAPONS[LOOK.weapon] ? LOOK.weapon : 'Knife'); rig.play('Idle');
  return P;
}
function equipWeapon(name) {
  const P = G.player; P.weapon = name;
  P.rig.model.traverse(o => { if (WEAPON_MESHES.includes(o.name)) { o.visible = o.name === name; if (o.name === name) P.wMesh = o; } });
  if (P.wMesh) { const e = weaponEnds(P.wMesh, .5); P.wMesh.add(P.wLight); P.wLight.position.copy(e.tip).lerp(e.grip, .3); }
  clearTrail();
}
const weapon = () => WEAPONS[G.player.weapon];
const atkSpeed = () => UP.atkSpeed * POW.atkSpeed();
// with elements active, the trail cycles through their colors and mixes their particles
const trailStyle = () => { const els = elActive(); if (!els.length) return weapon().trail; const e = ELEMENTS[els[Math.floor(G.time * 2.5) % els.length]]; return {col: e.col, fx: ELEMENTS[pick(els)].fx}; };
const wDmg = () => weapon().dmg + UP.dmg + (UP.wlvl - 1);
const wRange = () => weapon().range * UP.range * (UP.wlvl >= 3 ? 1.15 : 1) * (POW.is('giant') ? 1.25 : 1);

function nearestZombie(maxD) {
  let best = null, bd = maxD; const P = G.player;
  for (const z of G.zombies) { if (z.dying || z.state === 'rise') continue; const d = Math.hypot(z.x - P.x, z.z - P.z); if (d < bd) { bd = d; best = z; } }
  return best;
}
function startAttack() {
  const P = G.player; if (P.dead || G.state !== 'playing') return;
  if (P.atk) { if (P.atk.ct > P.atk.hitAt * .5) P.queued = true; return; }
  if (P.hurtT > 0 || P.javelin) return;
  if (P.air) { if (!P.slam) { P.slam = true; P.vy = -20; P.rig.play('Slash', {loop: false, restart: true, speed: 1.6, fade: .05}); AU.play('swingHeavy', {rate: .8}); } return; }
  const w = weapon(); if (G.time - P.lastAtkEnd > .6) P.combo = 0;
  // FRENZY: the finisher comes every 3rd hit
  const kind = POW.is('frenzy') && P.combo % 3 === 2 ? w.combo[3] : w.combo[P.combo % w.combo.length]; P.combo++;
  // aim at the nearest zombie, or at a barrel when one is closer and within reach
  let t = nearestZombie(5.5); const td = t ? Math.hypot(t.x - P.x, t.z - P.z) : 1e9;
  for (const br of G.barrels) { if (br.dead) continue; const d = Math.hypot(br.x - P.x, br.z - P.z); if (d < 3 && d < td) { t = br; break; } }
  const dir = t ? Math.atan2(t.z - P.z, t.x - P.x) : P.face;
  const F = FIN[kind], move = F ? F.move : kind, M = MOVES[move];
  let clip = F ? F.clip : M.clip;
  if (!F && P.spd > 3 && (clip === 'Slash' || clip === 'Stab')) clip = 'Run_' + clip; // legs keep running while the arm swings
  const base = w.speed * atkSpeed() * (F ? F.spd : 1);
  P.rig.play(clip, {loop: false, restart: true, speed: base * .75, fade: .1});
  const clipDur = P.rig.dur(clip);
  const fromKey = P.poseW > .05 && P.poseKey ? P.poseKey : null;
  P.atk = {kind, move, clip, ct: 0, clipDur, hitAt: CLIP_HIT[clip] * clipDur, endAt: F && F.spin ? clipDur : clipDur * .72, fromKey, extra: 0,
    base, hit: false, swung: false, dir, fin: F || null,
    rep: F && F.rep ? F.rep + (UP.wlvl >= 5 ? 2 : 0) : 1, ticks: F && F.ticks ? F.ticks + (UP.wlvl >= 5 ? 3 : 0) : 0, tickN: 0, spin: F && F.spin ? F.spin : 0};
  P.face = dir; P.queued = false; P.vx *= .4; P.vz *= .4;
  if (F) { AU.play('pEffort', {vol: .7, bus: 'voice', max: 1}); popText(P.x, P.z, w.fin + '!', '#' + new THREE.Color(w.col).getHexString(), 34, 3.2); }
  else if (Math.random() < .3) AU.play('pEffort', {vol: .5, bus: 'voice', max: 1});
}
function endAttack() {
  const P = G.player; P.atk = null; P.lastAtkEnd = G.time; P.rig.body.scale.x = 1; P.rig.body.rotation.y = 0;
  if (P.queued) { P.queued = false; startAttack(); }
}
function strike(a) {
  const P = G.player, w = weapon(), F = a.kind, M = MOVES[a.move];
  const lunge = (M.lunge || 1) * w.lunge; P.vx += Math.cos(a.dir) * lunge; P.vz += Math.sin(a.dir) * lunge;
  G.cam.kx += Math.cos(a.dir) * .3; G.cam.kz += Math.sin(a.dir) * .3; G.cam.roll += (P.rig.body.scale.x < 0 ? -1 : 1) * (w.cls === 'heavy' || a.fin ? .05 : .02);
  const dmg = wDmg();
  if (a.fin) TUT.event('finisher');
  if (F === 'Javelin') return throwJavelin(a.dir);
  if (F === 'HomeRun') return homeRun(a.dir, dmg);
  if (F === 'PowerChord') return powerChord(a.dir, dmg);
  const range = wRange() * (M.reach || 1) * (F === 'Flurry' ? 1.1 : 1);
  const arc = M.arc != null ? M.arc : w.arc;
  const hits = hitArea(P.x, P.z, a.dir, range, arc, dmg + (M.dmg || 0) + (a.fin ? 1 : 0), {kind: a.move, finisher: !!a.fin, w, side: M.side || 0, trip: M.trip});
  // overhead smashes and chops hit the ground: dust, a ring, and a short stagger
  if (M.smash) { const fx = P.x + Math.cos(a.dir) * range * .7, fz = P.z + Math.sin(a.dir) * range * .7, big = M.smash === 'big';
    dust(fx, fz, big ? 14 : 6); if (big) { ring(fx, fz, 1.4, 0xd8c8a8, .25); shake(.18); AU.play('land', {vol: .6, rate: .8}); }
    for (const zb of G.zombies) if (!zb.dying && Math.hypot(zb.x - fx, zb.z - fz) < (big ? 1.4 : .8)) zb.stun = Math.max(zb.stun, big ? .45 : .25); }
  if (M.pierce && hits > 1) popText(P.x + Math.cos(a.dir) * 2, P.z + Math.sin(a.dir) * 2, 'PIERCE x' + hits, '#7fe0ff', 26, 2.8);
  if (F === 'FireLine') fireLine(P.x, P.z, a.dir);
}
// shared by swings, slams and finishers
function hitArea(x, z, dir, range, arc, dmg, o) {
  const w = o.w || weapon(); let hits = 0, kills0 = G.kills;
  for (const zb of G.zombies) {
    if (zb.dying || zb.state === 'rise') continue;
    const dx = zb.x - x, dz = zb.z - z, d = Math.hypot(dx, dz), toZ = Math.atan2(dz, dx), kbDir = toZ + (o.side || 0) * .6;
    if (d > range + zb.r) continue;
    if (Math.abs(angDiff(dir, toZ)) > arc && d > zb.r + .3) continue;
    const behind = w.cls === 'blade' && Math.abs(angDiff(zb.face, toZ)) < 1.2; // zombie faces away from you
    let dd = Math.round(dmg * POW.dmgMul()); const crit = Math.random() < UP.crit + (behind ? .5 : 0); if (crit) dd *= 2;
    damageZombie(zb, kbDir, dd, {w, kind: o.kind, finisher: o.finisher, crit, slam: o.slam, kb: o.kb});
    if (!zb.dying) { onWeaponHit(zb, w, toZ); if (o.trip) zb.stun = Math.max(zb.stun, o.trip); }
    hits++;
  }
  for (const b of G.barrels) if (!b.dead && Math.hypot(b.x - x, b.z - z) < range + .4 && (Math.abs(angDiff(dir, Math.atan2(b.z - z, b.x - x))) < arc || o.slam)) hitBarrel(b);
  const kills = G.kills - kills0;
  if (hits) {
    TUT.event('hit'); POW.onHits(hits); POW.onSwingHit(hits);
    HAPTIC.fx(kills >= 2 ? 'multiKill' : kills ? 'kill' : 'hit');
    const heavy = w.cls === 'heavy' || o.finisher || o.slam;
    if (!o.light) { hitstop((kills ? .11 + Math.min(kills, 4) * .025 : .06) * (heavy ? 1.3 : 1)); shake((kills ? .4 : .2) + (heavy ? .15 : 0)); }
    AU.play(w.hit[0], {vol: o.light ? .6 : 1, rate: heavy ? .85 : 1, dur: .6, max: 4});
    if (!o.light) AU.play(w.hit[1], {vol: .7, dur: .6, delay: .02});
    AU.duck(kills ? .45 : .7, .2);
    if (kills >= 2) { POW.add(kills * 3); slowmo(.3 + .1 * kills); popText(x, z, kills + 'x KILL!', '#ff4fd8', 38 + kills * 6, 3); AU.play('levelUp', {vol: .5}); }
  }
  return hits;
}
// per-weapon and per-infusion effects on every connected hit
function onWeaponHit(zb, w, dir) {
  if (w.cls === 'saw') { zb.bleedN = Math.min(3, (zb.bleedN || 0) + 1); zb.bleed = 3; }
  if (w.name === 'FIRE AXE') { zb.burn = 3; }
  if (w.name === 'GUITAR') { zb.stun = Math.max(zb.stun, 1); notes(zb.x, zb.z, 6); }
  if (w.name === 'BARBED BAT') burst(zb.x, zb.z, 8, ['#8a5a2a', '#c08850', '#5a3818'], 7, .1, .6, 1.1);
  if (w.cls === 'blade') sparks(zb.x, zb.z, dir, 6, '#ffffff');
  applyElements(zb, w);
}
// stacking elements: each one adds its own effect, scaled by its level
let lastCloud = 0;
function applyElements(zb, w) {
  const E = UP.el, P = G.player;
  if (E.fire) { zb.burn = 3; zb.burnDmg = E.fire >= 2 ? 2 : 1; zb.spreadFire = E.fire >= 3; }
  if (E.frost) { zb.slow = 2.2; zb.slowF = E.frost >= 2 ? .35 : .5; zb.shatter = E.frost >= 2; zb.shatterHurt = E.frost >= 3; burst(zb.x, zb.z, 6, ['#cff6ff', '#8fe8ff', '#ffffff'], 4, .1, .6, 1.2); }
  if (E.storm) {
    P.stormN++;
    if (P.stormN % (E.storm >= 2 ? 2 : 3) === 0) {
      let n = 0; const max = E.storm >= 3 ? 4 : 2;
      for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise' || n >= max) continue; if (Math.hypot(o.x - zb.x, o.z - zb.z) < 6) { bolt(zb.x, zb.z, o.x, o.z); damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 1 + UP.dmg, {w, kind: 'storm'}); n++; } }
      if (n) { AU.play('hitMetal', {vol: .5, rate: 1.6, dur: .3}); flashLight(zb.x, zb.z, 0xbfe0ff, 5); }
    }
  }
  if (E.poison && G.time - lastCloud > .35) { lastCloud = G.time; FX.clouds.push({x: zb.x, z: zb.z, r: E.poison >= 2 ? 2.2 : 1.3, life: 3, slow: E.poison >= 3, tick: 0}); AU.play('gore', {vol: .25, rate: 1.6, dur: .3, max: 2}); }
}

// ---------- finishers ----------
function throwJavelin(dir) {
  const P = G.player, src = P.wMesh; if (!src) return;
  const e = weaponEnds(src, .5), ax = e.tip.clone().sub(e.grip).normalize();
  const m = new THREE.Mesh(src.geometry, src.material); m.castShadow = true;
  m.quaternion.setFromUnitVectors(ax, new THREE.Vector3(1, 0, 0)); m.scale.setScalar(src.getWorldScale(new THREE.Vector3()).x * 1.3);
  const roll = new THREE.Group(), g = new THREE.Group(); roll.add(m); g.add(roll); g.position.set(P.x, 1.3, P.z); g.rotation.y = -dir; scene.add(g);
  P.javelin = {g, roll, x: P.x, z: P.z, dir, t: 0, back: false, hit: new Set()}; src.visible = false;
  AU.play('swingHeavy', {vol: 1, rate: .6}); AU.play('swingBlade', {vol: .7, rate: 1.2, delay: .05});
}
function updateJavelin(dt) {
  const P = G.player, J = P.javelin; if (!J) return;
  J.t += dt; const w = weapon();
  if (!J.back) { J.x += Math.cos(J.dir) * 22 * dt; J.z += Math.sin(J.dir) * 22 * dt; if (J.t > .55 || Math.abs(J.x) > G.arena || Math.abs(J.z) > G.arena) { J.back = true; J.hit.clear(); AU.play('swingLight', {vol: .7, rate: .7}); } }
  else { const a = Math.atan2(P.z - J.z, P.x - J.x); J.dir = a; J.x += Math.cos(a) * 26 * dt; J.z += Math.sin(a) * 26 * dt; J.g.rotation.y = -a + Math.PI; if (Math.hypot(P.x - J.x, P.z - J.z) < .9) { scene.remove(J.g); P.javelin = null; if (P.wMesh && P.weapon === 'Spear') P.wMesh.visible = true; AU.play('hitMetal', {vol: .5, rate: 1.3, dur: .3}); ring(P.x, P.z, 1.2, w.col, .2); return; } }
  J.g.position.set(J.x, 1.3, J.z); J.roll.rotation.x += dt * 25;
  addPart({x: J.x, y: 1.3, z: J.z, vx: 0, vz: 0, vy: 0, g: 0, life: .2, max: .2, size: .08, col: '#7fe0ff', drag: 1, rx: 0, ry: 0});
  for (const zb of G.zombies) {
    if (zb.dying || zb.state === 'rise' || J.hit.has(zb)) continue;
    if (Math.hypot(zb.x - J.x, zb.z - J.z) < zb.r + .5) {
      J.hit.add(zb); damageZombie(zb, J.dir, wDmg() + 1 + (UP.wlvl >= 5 ? 2 : 0), {w, kind: 'Javelin', finisher: true});
      if (!zb.dying) onWeaponHit(zb, w, J.dir);
      hitstop(.04); shake(.15); AU.play('hitFlesh', {vol: .9, max: 4}); sparks(zb.x, zb.z, J.dir, 8, '#bff0ff'); HAPTIC.fx('hit');
    }
  }
}
function homeRun(dir, dmg) {
  const P = G.player, w = weapon(), range = w.range * UP.range;
  let best = null, bd = 1e9;
  for (const zb of G.zombies) { if (zb.dying || zb.state === 'rise' || zb.T.boss) continue; const d = Math.hypot(zb.x - P.x, zb.z - P.z); if (d < range + zb.r && Math.abs(angDiff(dir, Math.atan2(zb.z - P.z, zb.x - P.x))) < w.arc && d < bd) { bd = d; best = zb; } }
  hitArea(P.x, P.z, dir, range, w.arc, dmg, {kind: 'Slash', w});
  if (best && !best.homerunDone) {
    best.homerun = true; best.homerunDone = true;
    if (!best.dying) damageZombie(best, dir, dmg * 2 + 2, {w, kind: 'HomeRun', finisher: true});
    // fly whether dead or not: dying bodies use the launch death, survivors become airborne
    best.vx = Math.cos(dir) * 19; best.vz = Math.sin(dir) * 19; best.vy = 9;
    if (best.dying) { best.dying.type = 'launch'; best.spinX = 14; } else { best.air = true; best.stun = 2; }
    popText(best.x, best.z, 'HOME RUN!', '#ffcc33', 50, 3.2); slowmo(.45); shake(.6); hitstop(.14); AU.play('hitHardest', {vol: 1}); AU.play('levelUp', {vol: .6, delay: .2});
    ring(best.x, best.z, 2, 0xffffff, .25); HAPTIC.fx('slam');
  }
}
function powerChord(dir, dmg) {
  const P = G.player, w = weapon(), R = (UP.wlvl >= 5 ? 7 : 5.5) * UP.range, arc = .8;
  for (let i = 0; i < 3; i++) setTimeout(() => arcWave(P.x, P.z, dir, R * (.55 + i * .25), arc, 0xc070ff, .35), i * 70);
  AU.play('guitarHit', {vol: 1, rate: .8, dur: 1.4}); AU.play('explosion', {vol: .4, rate: 1.5}); notes(P.x, P.z, 18);
  hitArea(P.x, P.z, dir, R, arc, dmg + 1, {kind: 'PowerChord', finisher: true, w, kb: 12});
  for (const zb of G.zombies) if (!zb.dying && Math.hypot(zb.x - P.x, zb.z - P.z) < R && Math.abs(angDiff(dir, Math.atan2(zb.z - P.z, zb.x - P.x))) < arc) zb.stun = 2;
  shake(.5); boom(P.x + Math.cos(dir) * 2, P.z + Math.sin(dir) * 2, 0xc070ff, 7); HAPTIC.fx('slam');
}
function fireLine(x, z, dir) {
  for (let i = 1, n = UP.wlvl >= 5 ? 14 : 9; i <= n; i++) { const d = i * .7; FX.fires.push({x: x + Math.cos(dir) * d, z: z + Math.sin(dir) * d, life: 3 + i * .04, delay: i * .035}); }
  AU.play('rage', {vol: .9, rate: .6}); AU.play('explosion', {vol: .5, rate: 1.2}); boom(x + Math.cos(dir) * 3, z + Math.sin(dir) * 3, 0xff6a1a, 8); shake(.4);
}

function jump() {
  const P = G.player; if (P.air || P.dead || P.atk || G.state !== 'playing') return;
  P.air = true; P.vy = 7.8; P.slam = false; P.rig.play('Jump', {loop: false, restart: true, fade: .05}); AU.play('jump', {vol: .5}); dust(P.x, P.z, 8);
}
function land() {
  const P = G.player; P.air = false; P.y = 0; P.vy = 0; P.landT = .25;
  dust(P.x, P.z, 14); AU.play('land', {vol: .7}); HAPTIC.fx(P.slam ? 'slam' : 'land'); P.rig.play('Jump_Land', {loop: false, restart: true, fade: .05});
  if (P.slam) { // ground slam
    P.slam = false; const R = 3.2 * UP.slam, w = weapon(), st = trailStyle();
    ring(P.x, P.z, R, st.col, .4); ring(P.x, P.z, R * .55, 0xffffff, .25); shake(.5); boom(P.x, P.z, st.col, 6);
    burst(P.x, P.z, 30, ['#6b6470', '#4a3b2c', '#ffffff'], 9, .2, .7, .1); AU.play('hitHardest', {vol: 1, rate: .7}); AU.play('explosion', {vol: .5, rate: 1.4});
    hitArea(P.x, P.z, 0, R, 9, wDmg() + 1, {kind: 'Slam', slam: true, finisher: true, w}); hitstop(.09); TUT.event('slam');
    if (w.name === 'FIRE AXE' || UP.el.fire) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; FX.fires.push({x: P.x + Math.cos(a) * R * .6, z: P.z + Math.sin(a) * R * .6, life: 2.5, delay: 0}); }
  }
}
function dash() {
  const P = G.player; if (!UP.dash || P.dashCd > 0 || P.dead || G.state !== 'playing') return;
  const mv = INPUT.move(); const a = Math.hypot(mv.x, mv.z) > .2 ? Math.atan2(mv.z, mv.x) : P.face;
  P.dashT = .18; P.dashCd = .9; P.inv = Math.max(P.inv, .3); P.vx = Math.cos(a) * 19; P.vz = Math.sin(a) * 19; P.face = a;
  AU.play('swingWide', {vol: .8, rate: 1.2}); dust(P.x, P.z, 10);
}
function hurtPlayer(dmg, fx, fz) {
  const P = G.player; if (P.inv > 0 || P.dead || G.state !== 'playing' || POW.safe()) return false;
  P.hp -= dmg; POW.onHurt(); P.inv = 1.4; P.hurtT = .3; G.hurtFlash = .5; shake(.65); hitstop(.12); G.combo = 0;
  const d = Math.hypot(P.x - fx, P.z - fz) || 1; P.vx = (P.x - fx) / d * 12; P.vz = (P.z - fz) / d * 12;
  burst(P.x, P.z, 18, ['#c02020', '#ff3b3b'], 7, .12, .7); popText(P.x, P.z, 'OUCH!', '#ff5050', 32, 2.6);
  AU.play('hitHardest', {vol: 1, rate: .9}); AU.play('pHurt', {vol: .9, bus: 'voice', max: 1}); AU.duck(.3, .4);
  if (P.atk) { P.atk = null; P.rig.body.scale.x = 1; P.rig.body.rotation.y = 0; }
  HAPTIC.fx(P.hp <= 0 ? 'death' : 'hurt');
  if (P.hp <= 0) { P.dead = true; P.deadT = 0; P.rig.play('Death', {loop: false, restart: true, fade: .08}); slowmo(1.2); AU.play('pDeath', {bus: 'voice'}); AU.play('lose', {vol: .8, delay: .6}); AU.musicTo('music_calm', 2); setTimeout(gameOver, 2200); }
  else P.rig.play('HitReact', {loop: false, restart: true, fade: .05});
  return true;
}

// particles that follow the weapon tip, by trail style
function trailFX(fx, tip, base) {
  const r = Math.random;
  if (fx === 'fire') for (let i = 0; i < 3; i++) { const p = r() < .6 ? tip : base; addPart({x: p.x + rnd(-.1, .1), y: p.y, z: p.z + rnd(-.1, .1), vx: rnd(-.5, .5), vz: rnd(-.5, .5), vy: rnd(1, 3), g: -3, life: .45, max: .45, size: rnd(.08, .16), col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10']), drag: .9, rx: 0, ry: 0}); }
  if (fx === 'sparks' && r() < .8) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-6, 6), vz: rnd(-6, 6), vy: rnd(1, 5), g: 14, life: .25, max: .25, size: .04, col: pick(['#ffe14a', '#ffffff', '#ff9a3a']), drag: .9, streak: 1});
  if (fx === 'splinter' && r() < .35) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-2, 2), vz: rnd(-2, 2), vy: rnd(0, 2), g: 16, life: .5, max: .5, size: .06, col: pick(['#8a5a2a', '#c08850']), drag: .95, rx: 0, ry: 0});
  if (fx === 'notes' && r() < .5) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-.6, .6), vz: rnd(-.6, .6), vy: rnd(1.5, 3), g: -1, life: .7, max: .7, size: .1, col: pick(['#e0a0ff', '#ff7ae0', '#9a7aff']), drag: .95, rx: 0, ry: 0});
  if (fx === 'frost' && r() < .8) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-.8, .8), vz: rnd(-.8, .8), vy: rnd(-1, .5), g: 2, life: .5, max: .5, size: rnd(.04, .09), col: pick(['#ffffff', '#cff6ff', '#8fe8ff']), drag: .9, rx: 0, ry: 0});
  if (fx === 'storm' && r() < .6) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-9, 9), vz: rnd(-9, 9), vy: rnd(-3, 3), g: 0, life: .1, max: .1, size: .03, col: '#e8f6ff', drag: .8, streak: 1});
  if (fx === 'streak' && r() < .5) addPart({x: tip.x, y: tip.y, z: tip.z, vx: 0, vz: 0, vy: 0, g: 0, life: .15, max: .15, size: .05, col: '#bff0ff', drag: 1, rx: 0, ry: 0});
}

function updatePlayer(dt) {
  const P = G.player, rig = P.rig;
  P.inv -= dt; P.hurtT -= dt; P.dashT -= dt; P.dashCd -= dt; P.landT -= dt;
  updateJavelin(dt);
  if (P.dead) { P.deadT += dt; rig.mixer.update(dt); syncPlayer(); return; }
  const mv = INPUT.move(), ml = Math.min(1, Math.hypot(mv.x, mv.z));
  const top = 6.4 * UP.move * (POW.active ? 1.15 : 1) * (P.atk ? .3 : 1) * (P.hurtT > 0 ? .2 : 1);
  if (P.dashT <= 0) {
    const tx = mv.x * top, tz = mv.z * top, k = damp(P.air ? .05 : .0005, dt);
    P.vx = lerp(P.vx, tx, k); P.vz = lerp(P.vz, tz, k);
  }
  P.x += P.vx * dt; P.z += P.vz * dt;
  inArena(P, .45); collide(P, .45);
  P.spd = Math.hypot(P.vx, P.vz);
  if (ml > .2 && !P.atk) P.face = Math.atan2(mv.z, mv.x);
  if (P.dashT > 0 && Math.random() < .8) addPart({x: P.x, y: .9, z: P.z, vx: 0, vz: 0, vy: 0, g: 0, life: .25, max: .25, size: .35, col: '#7f8fb8', drag: 1, rx: 0, ry: 0});
  if (P.air) { P.y += P.vy * dt; P.vy -= 24 * dt; if (P.y <= 0) land(); else if (rig.curName === 'Jump' && rig.cur.time >= rig.dur('Jump') * .95 && !P.slam) rig.play('Jump_Idle', {fade: .08}); }
  // attack timeline in clip time: slow wind-up (0.6x) -> snap through the strike (1.7x) -> recovery -> chain
  let twistT = 0, leanT = 0;
  if (P.atk) {
    const a = P.atk, w = weapon();
    const pre = a.ct < a.hitAt, ts = a.base * (pre ? .75 : 1.3);
    if (rig.cur) rig.cur.timeScale = ts;
    a.ct += dt * ts;
    P.face += angDiff(P.face, a.dir) * damp(.0001, dt);
    const M = MOVES[a.move];
    if (!a.swung && a.ct >= a.hitAt - .06 * a.clipDur) { a.swung = true; AU.play(a.fin && a.spin ? 'swingWide' : w.swing, {vol: .9, rate: (w.cls === 'heavy' ? .85 : 1) * (M.snd || 1), max: 4}); }
    if (!a.hit && a.ct >= a.hitAt) { a.hit = true; strike(a); }
    // grinding pushes hit again during the hold
    if (M.ticks && a.hit && a.extra < M.ticks - 1 && a.ct >= a.hitAt + (a.extra + 1) * .1 * a.clipDur) {
      a.extra++; hitArea(P.x, P.z, a.dir, wRange() * M.reach, M.arc, Math.max(1, wDmg() - 1), {kind: a.move, w, light: true}); AU.play('hitSaw', {vol: .5, rate: 1.2, dur: .25, max: 3}); sparks(P.x + Math.cos(a.dir) * 1.6, P.z + Math.sin(a.dir) * 1.6, a.dir, 8, '#ffe14a'); }
    // spinning finishers hit on a timer while the body turns
    if (a.spin) { const k = clamp(a.ct / a.clipDur, 0, 1); rig.body.rotation.y = easeOutCubic(k) * Math.PI * 2 * a.spin;
      if (a.ticks && a.ct >= a.hitAt * .5 && a.tickN < a.ticks && a.ct >= a.hitAt * .5 + a.tickN * (a.clipDur - a.hitAt * .5) / a.ticks) {
        a.tickN++; hitArea(P.x, P.z, 0, w.range * UP.range, 9, 1 + UP.dmg, {kind: 'Grinder', w, light: true}); AU.play('hitMetal', {vol: .5, rate: 1.4 + a.tickN * .05, dur: .2, max: 4}); sparks(P.x, P.z, P.face + a.tickN, 8, '#ffe14a'); shake(.08); } }
    // blade trail during the active part of the swing
    const act = a.spin ? a.ct > a.hitAt * .4 : a.ct > a.hitAt - .07 * a.clipDur && a.ct < a.hitAt + .12 * a.clipDur;
    if (act && P.wMesh && P.wMesh.visible) { const s = trailSample(P.wMesh, w), st = trailStyle(); trailFX(st.fx, s.tip, s.base); }
    // torso follow-through: turn away in the wind-up, whip through on the strike
    const amp = w.twist * (a.fin ? 1.25 : 1) * (M.twist != null ? M.twist : 1);
    if (pre) { const k = a.ct / a.hitAt; twistT = -amp * .55 * easeOutCubic(k); leanT = -.12 * k; }
    else { const s = clamp((a.ct - a.hitAt) / (a.clipDur - a.hitAt), 0, 1); twistT = lerp(-amp * .55, amp, easeOutCubic(Math.min(1, s * 3))) * (1 - s * s); leanT = .35 * (1 - s); }
    if (a.ct >= a.endAt) { if (a.rep > 1) { a.rep--; a.ct = 0; a.hit = false; a.swung = false; P.rig.play(a.clip, {loop: false, restart: true, fade: .02}); const t = nearestZombie(4); if (t) a.dir = Math.atan2(t.z - P.z, t.x - P.x); } else endAttack(); }
    else if (P.queued && a.hit && a.ct >= a.hitAt + .12 * a.clipDur && a.rep <= 1) endAttack();
  }
  updateTrail(dt, trailStyle().col);
  if (!P.air && P.spd > 1) { P.stepD += P.spd * dt; if (P.stepD > 1.9) { P.stepD = 0; AU.play('step', {vol: .35, max: 2}); } }
  const busy = P.atk || (P.hurtT > 0) || P.air || (P.landT > 0 && rig.curName === 'Jump_Land');
  if (!busy) {
    if (P.spd > 3.2) rig.play('Run', {speed: clamp(P.spd / 6, .8, 1.4), fade: .15});
    else if (P.spd > .5) rig.play('Walk', {speed: clamp(P.spd / 2.5, .7, 1.4), fade: .15});
    else rig.play('Idle', {fade: .2});
  }
  rig.mixer.update(dt);
  // layer the torso motion on top of the clip
  P.twist = lerp(P.twist, twistT, damp(.00001, dt)); P.lean = lerp(P.lean, leanT, damp(.0001, dt));
  const b = rig.bones;
  if (b.Torso) b.Torso.rotateY(P.twist * .7); if (b.Hips) b.Hips.rotateY(P.twist * .3); if (b.Abdomen) b.Abdomen.rotateX(P.lean * .5);
  updateArmPose(P, dt);
  syncPlayer();
}
function syncPlayer() {
  const P = G.player, rig = P.rig;
  rig.root.position.set(P.x, P.y, P.z); rig.root.rotation.y = yawFor(P.face);
  rig.root.visible = !(P.inv > 0 && !P.dead && P.hurtT <= 0 && Math.floor(P.inv * 18) % 2);
  if (P.hurtT > 0) rig.flash(.6, 1, .1, .1); else if (POW.active) { const c = new THREE.Color(POWERS[POW.active].col); rig.flash(.22 + .12 * Math.sin(G.time * 12), c.r, c.g, c.b); } else rig.flash(0);
  // weapon glow: the fire axe always burns; an infusion tints any weapon
  // weapon glow: fire axe always burns, elements cycle their colors, brighter per weapon level
  const w = weapon(), els = elActive(), gc = els.length ? ELEMENTS[els[Math.floor(G.time * 2.5) % els.length]].col : w.glow || (UP.wlvl > 1 ? w.col : 0);
  if (P.wMesh && gc) { const c = COL('#' + new THREE.Color(gc).getHexString()), f = .7 + .3 * Math.sin(G.time * 23) * Math.sin(G.time * 7); const lv = .4 + .15 * UP.wlvl; P.wMesh.material.emissive.copy(c).multiplyScalar(lv * f); P.wLight.color.copy(c); P.wLight.intensity = (.8 + .4 * UP.wlvl) * f; }
  else P.wLight.intensity = 0;
}
