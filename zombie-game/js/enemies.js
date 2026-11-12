// Zombies: 4 types plus a boss, each with authored walk/attack/hit/death clips and its own attack pattern.
'use strict';
const ZTYPES = {
  walker:  {model: 'Zombie_Basic',   hp: 3, speed: [1.3, 1.9], move: 'Walk', attack: 'Punch',       range: 1.35, dmg: 1, r: .45, score: 10, coins: [0, 2], voice: 1},
  runner:  {model: 'Zombie_Ribcage', hp: 1, speed: [4.2, 5.0], move: 'Run',  attack: 'Jump',        range: 2.6,  dmg: 1, r: .38, score: 15, coins: [0, 1], pounce: true, voice: 1.3},
  tank:    {model: 'Zombie_Chubby',  hp: 8, speed: [.9, 1.15], move: 'Walk', attack: 'Punch',       range: 1.7,  dmg: 2, r: .7,  score: 30, coins: [2, 4], explode: true, voice: .75},
  grabber: {model: 'Zombie_Arm',     hp: 4, speed: [1.7, 2.1], move: 'Walk', attack: 'Run_Attack',  range: 1.5,  dmg: 1, r: .5,  score: 20, coins: [1, 2], lunge: true, voice: .9},
  boss:    {model: 'Zombie_Chubby',  hp: 38, speed: [1.6, 1.6], move: 'Walk', attack: 'Punch',      range: 2.6,  dmg: 2, r: 1.4, score: 500, coins: [15, 20], boss: true, scale: 2.1, tint: 0xff9a8a, voice: .55},
};
const WAVE = {queue: [], spawnT: 0, alive: 0, total: 0, killed: 0, boss: null, active: false};

function makeWave(n) {
  const list = [], boss = n % 5 === 0;
  const count = Math.round((boss ? 4 + n : 6 + n * 3) * (UP.horde ? 1.3 : 1));
  for (let i = 0; i < count; i++) {
    const r = Math.random(); let t = 'walker';
    if (n >= 2 && r < .22 + n * .015) t = 'runner';
    else if (n >= 3 && r < .34 + n * .015) t = 'tank';
    else if (n >= 4 && r < .48 + n * .015) t = 'grabber';
    list.push(t);
  }
  if (boss) list.splice(2, 0, 'boss');
  return list;
}
function startWave() {
  G.wave++; WAVE.queue = makeWave(G.wave); WAVE.total = WAVE.queue.length; WAVE.killed = 0; WAVE.spawnT = 1.2; WAVE.active = true; WAVE.boss = null;
  HUD.banner('WAVE ' + G.wave, G.wave % 5 === 0 ? 'BOSS INCOMING' : WAVE.total + ' zombies', G.wave % 5 === 0 ? '#ff4f4f' : '#ffcc33');
  AU.play('waveStart', {vol: .8}); AU.musicTo(G.wave % 5 === 0 ? 'music_boss' : 'music_combat');
  setTimeout(() => AU.play('zGroan', {vol: .7, rate: .9}), 600);
}
function spawnZombie(type) {
  const T = ZTYPES[type], sp = pick(WORLD.spawnPoints);
  const x = sp[0] + rnd(-3, 3), z = sp[1] + rnd(-3, 3);
  const scale = (T.scale || 1) * (T.boss ? 1 : rnd(.93, 1.07));
  const rig = new Rig(T.model, {tint: T.tint, scale});
  const hpMul = 1 + (G.wave - 1) * .13;
  const zb = {type, T, rig, x, z, vx: 0, vz: 0, y: -2, vy: 0, r: T.r * (T.boss ? 1 : scale), face: Math.atan2(-z, -x),
    hp: Math.ceil(T.hp * hpMul), maxHp: Math.ceil(T.hp * hpMul), speed: rnd(...T.speed) * (1 + G.wave * .025),
    state: 'rise', st: 0, cd: rnd(.5, 1.2), flash: 0, stun: 0, burn: 0, bleed: 0, dying: null, wob: rnd(0, 7), groanT: rnd(2, 8)};
  rig.play(T.move, {fade: 0}); rig.cur.time = rnd(0, rig.dur(T.move));
  if (T.boss) { WAVE.boss = zb; zb.bossCd = 2.5; zb.lastMove = ''; AU.play('bossIntro', {vol: 1}); AU.play('evilLaugh', {vol: .9, delay: .8, bus: 'voice'}); HUD.banner('THE BUTCHER', 'boss zombie', '#ff4f4f'); slowmo(.5); shake(.4); }
  G.zombies.push(zb); WAVE.alive++;
}
function updateWaves(dt) {
  if (!WAVE.active) return;
  WAVE.spawnT -= dt;
  const maxAlive = 10 + Math.min(8, G.wave);
  if (WAVE.queue.length && WAVE.spawnT <= 0 && G.zombies.filter(z => !z.dying).length < maxAlive) {
    const t = WAVE.queue.shift(); spawnZombie(t); WAVE.spawnT = t === 'runner' ? .25 : rnd(.6, 1.3) * Math.max(.5, 1 - G.wave * .04);
  }
  if (!WAVE.queue.length && !G.zombies.length && G.state === 'playing' && !G.player.dead) { WAVE.active = false; waveCleared(); }
}

// ---------- AI ----------
function updateZombie(zb, dt) {
  const P = G.player, T = zb.T, rig = zb.rig;
  zb.flash -= dt; zb.stun -= dt; zb.st += dt; zb.cd -= dt; zb.wob += dt;
  if (zb.dying) { updateDying(zb, dt); return; }
  if (zb.state === 'rise') { // climbs out of the ground with dirt flying
    zb.y = lerp(-2, 0, easeOutCubic(clamp(zb.st / 1.1, 0, 1)));
    if (Math.random() < .5) addPart({x: zb.x + rnd(-.5, .5), y: .05, z: zb.z + rnd(-.5, .5), vx: rnd(-1.5, 1.5), vz: rnd(-1.5, 1.5), vy: rnd(3, 6), g: 20, life: .5, max: .5, size: .12, col: pick(['#3b2f24', '#4a3b2c', '#2a221a']), drag: .95, rx: 0, ry: 0});
    if (zb.st > 1.1) { zb.y = 0; zb.state = 'chase'; zb.st = 0; }
    zb.face = Math.atan2(P.z - zb.z, P.x - zb.x);
  } else {
    // damage over time
    if (zb.burn > 0) { zb.burn -= dt; if (Math.random() < .5) addPart({x: zb.x + rnd(-.3, .3), y: rnd(.4, 1.6), z: zb.z + rnd(-.3, .3), vx: 0, vz: 0, vy: rnd(2, 4), g: -2, life: .4, max: .4, size: .12, col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10']), drag: .9, rx: 0, ry: 0}); if (zb.burn <= 0) damageZombie(zb, zb.face + Math.PI, 1, {dot: 'burn'}); }
    if (zb.bleed > 0) { zb.bleed -= dt; if (zb.bleed <= 0) damageZombie(zb, zb.face + Math.PI, 1, {dot: 'bleed'}); }
    if (zb.dying) return;
    const dx = P.x - zb.x, dz = P.z - zb.z, d = Math.hypot(dx, dz), toP = Math.atan2(dz, dx);
    zb.groanT -= dt; if (zb.groanT < 0) { zb.groanT = rnd(4, 10); AU.play(T.boss ? 'bossEffort' : 'zGroan', {vol: .45, rate: T.voice * rnd(.9, 1.1), x: zb.x, z: zb.z, bus: 'voice', max: 2}); }
    if (zb.stun > 0) { /* staggered: knockback only */ }
    else if (T.boss) bossAI(zb, dt, d, toP);
    else if (zb.state === 'chase') {
      zb.face += angDiff(zb.face, toP) * damp(.02, dt);
      const sp = zb.speed * (P.dead ? .3 : 1);
      zb.vx = lerp(zb.vx, Math.cos(zb.face) * sp, damp(.01, dt)); zb.vz = lerp(zb.vz, Math.sin(zb.face) * sp, damp(.01, dt));
      if (rig.curName !== T.move) rig.play(T.move, {fade: .2, speed: T.move === 'Run' ? 1.1 : zb.speed / 1.6});
      if (!P.dead && zb.cd <= 0) {
        if (T.lunge && d > 2.6 && d < 5.5) { zb.state = 'windup'; zb.st = 0; rig.play('Idle', {fade: .1}); AU.play('zAttack', {vol: .6, rate: T.voice, x: zb.x, z: zb.z, bus: 'voice'}); }
        else if (T.pounce && d < T.range) { zb.state = 'pounce'; zb.st = 0; zb.hitDone = false; rig.play('Jump', {loop: false, restart: true, fade: .05}); zb.vx = Math.cos(toP) * 9; zb.vz = Math.sin(toP) * 9; zb.vy = 4.5; AU.play('zAttack', {vol: .6, rate: 1.4, x: zb.x, z: zb.z, bus: 'voice'}); }
        else if (!T.pounce && d < T.range + .2) { zb.state = 'attack'; zb.st = 0; zb.hitDone = false; zb.vx *= .2; zb.vz *= .2; rig.play(T.attack, {loop: false, restart: true, fade: .08, speed: .95}); AU.play('zAttack', {vol: .55, rate: T.voice * rnd(.9, 1.1), x: zb.x, z: zb.z, bus: 'voice', max: 2}); }
      }
    } else if (zb.state === 'attack') { // authored swing; damage lands mid-clip if the player is still in reach and in front
      zb.face += angDiff(zb.face, toP) * damp(.2, dt); zb.vx *= .9; zb.vz *= .9;
      const dur = rig.dur(T.attack) / .95;
      if (!zb.hitDone && zb.st > dur * .45) { zb.hitDone = true; if (d < T.range + .5 && Math.abs(angDiff(zb.face, toP)) < 1.1 && P.y < .8) { if (hurtPlayer(T.dmg, zb.x, zb.z) && UP.thorns) damageZombie(zb, toP + Math.PI, 2, {thorns: true}); } }
      if (zb.st > dur) { zb.state = 'chase'; zb.cd = rnd(.6, 1.1); }
    } else if (zb.state === 'windup') { // grabber: shakes, then lunges
      zb.face = toP; zb.vx *= .8; zb.vz *= .8; zb.flash = Math.sin(zb.st * 40) > .3 ? .05 : 0;
      if (zb.st > .5) { zb.state = 'lunge'; zb.st = 0; zb.hitDone = false; rig.play('Run_Attack', {fade: .05, speed: 1.4}); zb.vx = Math.cos(zb.face) * 11; zb.vz = Math.sin(zb.face) * 11; }
    } else if (zb.state === 'lunge' || zb.state === 'pounce') {
      if (zb.state === 'pounce') { zb.y += zb.vy * dt; zb.vy -= 20 * dt; if (zb.y < 0) zb.y = 0; }
      if (!zb.hitDone && d < zb.r + .6 && P.y < .9) { zb.hitDone = true; hurtPlayer(T.dmg, zb.x, zb.z); }
      if (zb.st > (zb.state === 'pounce' ? .45 : .5)) { zb.state = 'chase'; zb.cd = rnd(1, 1.6); zb.y = 0; zb.vx *= .3; zb.vz *= .3; }
    }
  }
  // movement, separation, obstacles
  zb.x += zb.vx * dt; zb.z += zb.vz * dt;
  zb.vx *= Math.pow(zb.stun > 0 ? .05 : .5, dt); zb.vz *= Math.pow(zb.stun > 0 ? .05 : .5, dt);
  if (zb.state !== 'rise') {
    for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise') continue; const ox = zb.x - o.x, oz = zb.z - o.z, od = Math.hypot(ox, oz), m = zb.r + o.r; if (od > 0 && od < m) { zb.x += ox / od * (m - od) * .5; zb.z += oz / od * (m - od) * .5; } }
    collide(zb, zb.r); inArena(zb, zb.r);
    if (!P.dead && !zb.T.boss) { const pd = Math.hypot(P.x - zb.x, P.z - zb.z), m = zb.r + .45; if (pd < m && pd > 0) { zb.x -= (P.x - zb.x) / pd * (m - pd); zb.z -= (P.z - zb.z) / pd * (m - pd); } }
  }
  rig.mixer.update(dt);
  syncZombie(zb);
}
function syncZombie(zb) {
  const rig = zb.rig; rig.root.position.set(zb.x, zb.y, zb.z); rig.root.rotation.y = yawFor(zb.face);
  if (zb.dying) { if (zb.dying.type !== 'burn' && zb.dying.type !== 'swell') rig.flash(zb.flash > 0 ? .45 : 0); return; }
  if (zb.flash > 0) rig.flash(.45, 1, .95, .85); else if (zb.burn > 0) rig.flash(.35, 1, .4, 0); else if (zb.T.boss && zb.tele) rig.flash(.3 + .3 * Math.sin(G.time * 30), 1, .1, .1); else rig.flash(0);
}

// ---------- boss: charge, slam, summon ----------
const teleMat = new THREE.MeshBasicMaterial({color: 0xff2020, transparent: true, opacity: .35, depthWrite: false});
function bossAI(zb, dt, d, toP) {
  const rig = zb.rig, P = G.player;
  if (zb.state === 'chase') {
    zb.face += angDiff(zb.face, toP) * damp(.05, dt);
    zb.vx = lerp(zb.vx, Math.cos(zb.face) * zb.speed, damp(.01, dt)); zb.vz = lerp(zb.vz, Math.sin(zb.face) * zb.speed, damp(.01, dt));
    if (rig.curName !== 'Walk') rig.play('Walk', {fade: .2, speed: .8});
    zb.bossCd -= dt;
    if (zb.bossCd <= 0 && !P.dead) {
      const moves = ['charge', 'slam', 'summon'].filter(m => m !== zb.lastMove && !(m === 'slam' && d > 9));
      const m = d < 4 ? 'slam' : pick(moves); zb.lastMove = m; zb.state = m + 'Tele'; zb.st = 0; zb.vx = zb.vz = 0; zb.tele = true;
      if (m === 'charge') { zb.chargeDir = toP; zb.teleMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), teleMat); zb.teleMesh.rotation.x = -Math.PI / 2; scene.add(zb.teleMesh); rig.play('Idle_Attack', {fade: .1}); AU.play('bossEffort', {vol: 1, bus: 'voice'}); }
      if (m === 'slam') { zb.slamX = P.x; zb.slamZ = P.z; zb.teleMesh = new THREE.Mesh(new THREE.CircleGeometry(4, 40), teleMat); zb.teleMesh.rotation.x = -Math.PI / 2; zb.teleMesh.position.set(P.x, .04, P.z); scene.add(zb.teleMesh); rig.play('Jump', {loop: false, restart: true, fade: .1, speed: .5}); AU.play('bossEffort', {vol: 1, bus: 'voice', rate: .9}); }
      if (m === 'summon') { rig.play('Wave', {loop: false, restart: true, fade: .1}); AU.play('bossLaugh', {vol: 1, bus: 'voice'}); }
    }
  } else if (zb.state === 'chargeTele') {
    zb.chargeDir += angDiff(zb.chargeDir, toP) * damp(.1, dt);
    zb.face = zb.chargeDir; const L = 7; zb.teleMesh.position.set(zb.x + Math.cos(zb.chargeDir) * L, .04, zb.z + Math.sin(zb.chargeDir) * L); zb.teleMesh.rotation.z = -zb.chargeDir;
    teleMat.opacity = .25 + .2 * Math.sin(zb.st * 25);
    if (zb.st > .95) { scene.remove(zb.teleMesh); zb.tele = false; zb.state = 'charge'; zb.st = 0; zb.hitDone = false; rig.play('Run_Arms', {fade: .05, speed: 1.4}); }
  } else if (zb.state === 'charge') {
    zb.vx = Math.cos(zb.chargeDir) * 13; zb.vz = Math.sin(zb.chargeDir) * 13;
    if (Math.random() < .6) dust(zb.x, zb.z, 2);
    if (!zb.hitDone && d < zb.r + .7) { zb.hitDone = true; hurtPlayer(2, zb.x, zb.z); }
    const bx = zb.x, bz = zb.z; collide(zb, zb.r);
    const blocked = Math.abs(bx - zb.x) + Math.abs(bz - zb.z) > .01 || Math.abs(zb.x) > G.arena - zb.r - .1 || Math.abs(zb.z) > G.arena - zb.r - .1;
    if (zb.st > 1.15 || blocked) { // crashes into a wall: stunned and open
      zb.state = 'stunned'; zb.st = 0; zb.vx *= -.2; zb.vz *= -.2; if (blocked) { shake(.6); AU.play('hitMetal', {vol: 1, rate: .6}); AU.play('explosion', {vol: .5, rate: 1.3}); dust(zb.x, zb.z, 20); }
      rig.play('HitReact', {loop: false, restart: true, fade: .05, speed: .5});
    }
  } else if (zb.state === 'stunned') { zb.vx *= .9; zb.vz *= .9; if (zb.st > 1.4) { zb.state = 'chase'; zb.bossCd = rnd(1.5, 2.5); } }
  else if (zb.state === 'slamTele') {
    teleMat.opacity = .2 + .25 * (zb.st / 1.1); zb.teleMesh.scale.setScalar(.3 + .7 * Math.min(1, zb.st / 1.1));
    const k = clamp(zb.st / 1.1, 0, 1); zb.x = lerp(zb.x, zb.slamX, k * .08); zb.z = lerp(zb.z, zb.slamZ, k * .08); zb.y = Math.sin(k * Math.PI) * 3.2;
    if (zb.st > 1.1) {
      scene.remove(zb.teleMesh); zb.tele = false; zb.y = 0; zb.state = 'recover'; zb.st = 0; rig.play('Punch', {loop: false, restart: true, fade: .05});
      ring(zb.slamX, zb.slamZ, 4.2, 0xff5040, .4); ring(zb.slamX, zb.slamZ, 2.4, 0xffffff, .25); shake(.8); hitstop(.08); boom(zb.slamX, zb.slamZ, 0xff5030, 8);
      burst(zb.slamX, zb.slamZ, 40, ['#6b6470', '#4a3b2c', '#3b2f24'], 10, .25, .9, .1); AU.play('explosion', {vol: 1}); AU.play('hitHardest', {vol: 1, rate: .6});
      if (Math.hypot(P.x - zb.slamX, P.z - zb.slamZ) < 4 && P.y < 1) hurtPlayer(2, zb.slamX, zb.slamZ);
    }
  } else if (zb.state === 'summonTele') {
    if (zb.st > 1.0) { for (let i = 0; i < 3 + Math.floor(G.wave / 5); i++) WAVE.queue.unshift('runner'); WAVE.total += 3 + Math.floor(G.wave / 5); WAVE.spawnT = 0; zb.state = 'recover'; zb.st = 0; AU.play('chains', {vol: .9}); }
  } else if (zb.state === 'recover') { zb.vx *= .85; zb.vz *= .85; if (zb.st > .9) { zb.state = 'chase'; zb.bossCd = rnd(2, 3.2) * Math.max(.55, zb.hp / zb.maxHp + .2); } }
}

// ---------- damage and deaths ----------
function damageZombie(zb, dir, dmg, o = {}) {
  if (zb.dying || zb.state === 'rise') return;
  const w = o.w || weapon(), T = zb.T;
  zb.hp -= dmg; zb.flash = .12; G.combo++; G.comboT = 2;
  if (!o.dot) {
    const kb = (w.kb + (o.finisher ? 4 : 0)) * (T.boss ? .08 : T.explode ? .4 : 1) * (zb.hp <= 0 ? 1.4 : 1);
    zb.vx += Math.cos(dir) * kb; zb.vz += Math.sin(dir) * kb;
    if (!T.boss && zb.hp > 0) { zb.stun = w.cls === 'blunt' && w.name === 'GUITAR' ? .7 : .28; if (zb.state === 'attack' || zb.state === 'windup' || zb.state === 'lunge') zb.state = 'chase'; zb.rig.play('HitReact', {loop: false, restart: true, fade: .04}); }
    sparks(zb.x, zb.z, dir, 10, o.crit ? '#ffef5a' : '#fff6c8'); burst(zb.x, zb.z, 8, ['#3f9a35', '#2a7a2a', '#7a1f1f'], 6, .12, .7, 1.1);
    ring(zb.x, zb.z, .9, w.col, .16, 1); flashLight(zb.x, zb.z, w.col, 4);
    if (w.cls === 'saw') zb.bleed = 1;
    AU.play(T.boss ? 'bossHurt' : 'zHurt', {vol: .45, rate: T.voice * rnd(.9, 1.15), x: zb.x, z: zb.z, bus: 'voice', max: 2});
  }
  popText(zb.x, zb.z, (o.crit ? 'CRIT ' : '') + dmg, o.crit ? '#ffef5a' : o.dot === 'burn' ? '#ff9a3a' : '#ffffff', o.crit ? 30 : 22, 2.1 * (T.scale || 1));
  const sh = SHOUTS[G.combo]; if (sh) { popText(G.player.x, G.player.z, sh, '#ff7a1a', 54, 3.4); slowmo(.4); G.flash = Math.max(G.flash, .3); AU.play('levelUp', {vol: .6}); }
  if (zb.hp <= 0) killZombie(zb, dir, o);
}
const SHOUTS = {10: 'NICE!', 20: 'BRUTAL!', 35: 'UNSTOPPABLE!', 50: 'LEGENDARY!!', 80: 'GODLIKE!!!'};
function chooseDeath(zb, o) {
  const w = o.w || weapon(), r = Math.random();
  if (zb.T.boss) return 'boss';
  if (zb.T.explode) return 'swell';
  if (o.dot === 'burn' || (zb.burn > 0 && r < .5)) return 'burn';
  if (o.blast) return r < .5 ? 'gib' : 'launch';
  if (o.finisher || o.slam) return r < .6 ? 'launch' : 'gib';
  if (w.cls === 'heavy' && r < .5) return 'decap';
  if (w.cls === 'blunt' && r < .55) return 'launch';
  if (w.cls === 'saw' && r < .4) return 'gib';
  return pick(['fall', 'fall', 'launch', 'decap']);
}
function killZombie(zb, dir, o) {
  const T = zb.T, P = G.player;
  G.kills++; WAVE.killed++; G.score += T.score * (1 + Math.floor(G.combo / 10));
  zb.dying = {type: chooseDeath(zb, o), t: 0}; zb.state = 'dead'; zb.stun = 0;
  popText(zb.x, zb.z, '+' + T.score, '#ffcc33', 26 + Math.min(G.combo, 20), 2.6 * (T.scale || 1));
  AU.play(T.boss ? 'bossDeath' : 'zDeath', {vol: .7, rate: T.voice * rnd(.9, 1.1), x: zb.x, z: zb.z, bus: 'voice', max: 2});
  AU.play(pick(['bone', 'skull', 'gore']), {vol: .8, x: zb.x, z: zb.z, delay: .02});
  blood(zb.x, zb.z, T.boss ? 3 : 1.1); burst(zb.x, zb.z, 14, ['#3f9a35', '#2a7a2a', '#7a1f1f'], 7, .14, .8, 1);
  // drops
  const nc = Math.floor(rnd(T.coins[0], T.coins[1] + 1)); for (let i = 0; i < nc; i++) dropPickup('coin', zb.x, zb.z);
  if (Math.random() < (P.hp < P.maxHp ? .07 : .02) + (T.boss ? 1 : 0)) dropPickup('heart', zb.x, zb.z);
  if (Math.random() < .025 + (T.boss ? 1 : 0)) dropPickup('rage', zb.x, zb.z);
  if (UP.lifesteal) { P.killsForHeal++; if (P.killsForHeal >= 12) { P.killsForHeal = 0; P.hp = Math.min(P.maxHp, P.hp + 1); popText(P.x, P.z, '+1 ♥', '#ff5a6a', 26); AU.play('heart', {vol: .5}); } }
  if (UP.explosive && Math.random() < .15 && !T.explode) setTimeout(() => explodeAt(zb.x, zb.z, 2.6, 3, 0, 'kill'), 120);
  const d = zb.dying, rig = zb.rig;
  if (d.type !== 'gib') rig.play('Death', {loop: false, restart: true, fade: .05, speed: d.type === 'launch' ? 1.3 : 1});
  if (d.type === 'launch') { zb.vy = rnd(6, 8.5); zb.spinX = rnd(-9, 9); zb.vx = Math.cos(dir) * 9; zb.vz = Math.sin(dir) * 9; }
  if (d.type === 'decap') popHead(zb, dir);
  if (d.type === 'gib') gibZombie(zb, dir);
  if (d.type === 'boss') { slowmo(1.5); shake(1); G.flash = .8; AU.play('waveClear', {vol: .9, delay: .4}); HUD.banner('BOSS DOWN!', '+500', '#ffcc33'); }
  if (WAVE.boss === zb) WAVE.boss = null;
}
function popHead(zb, dir) {
  const hb = zb.rig.bones.Head; if (hb) hb.scale.setScalar(.001);
  const skin = zb.rig.mats[zb.rig.mats.length - 1].color;
  const g = new THREE.Group(), h = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), new THREE.MeshStandardMaterial({color: skin, roughness: .8}));
  h.scale.set(1, 1.15, 1); h.castShadow = true; g.add(h);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({color: 0xff2a1a})); e.position.set(sx * .07, .04, .17); g.add(e); }
  gib(zb.x, zb.z, g, Math.cos(dir) * rnd(3, 6), Math.sin(dir) * rnd(3, 6), rnd(7, 10));
  AU.play('skull', {vol: 1, x: zb.x, z: zb.z});
}
function gibZombie(zb, dir) {
  zb.rig.root.visible = false;
  const skin = zb.rig.mats[zb.rig.mats.length - 1].color;
  for (let i = 0; i < 7; i++) {
    const s = rnd(.12, .28), m = new THREE.Mesh(new THREE.BoxGeometry(s, s * rnd(.8, 1.6), s), new THREE.MeshStandardMaterial({color: i % 3 ? skin : 0x7a1f1f, roughness: .8}));
    m.castShadow = true; const a = dir + rnd(-1.2, 1.2), sp = rnd(3, 8); gib(zb.x, zb.z, m, Math.cos(a) * sp, Math.sin(a) * sp, rnd(4, 9), rnd(1.5, 2.5));
  }
  burst(zb.x, zb.z, 30, ['#3f9a35', '#2a7a2a', '#7a1f1f', '#56c04a'], 9, .18, 1, 1); blood(zb.x, zb.z, 1.6); AU.play('gore', {vol: 1, x: zb.x, z: zb.z}); hitstop(.04);
}
function updateDying(zb, dt) {
  const d = zb.dying, rig = zb.rig; d.t += dt;
  zb.x += zb.vx * dt; zb.z += zb.vz * dt; zb.vx *= Math.pow(.04, dt); zb.vz *= Math.pow(.04, dt);
  inArena(zb, zb.r); collide(zb, zb.r * .6);
  let life = 3.2;
  if (d.type === 'launch') {
    zb.y += zb.vy * dt; zb.vy -= 22 * dt; if (zb.y < 0) { zb.y = 0; if (Math.abs(zb.vy) > 3) { dust(zb.x, zb.z, 8); AU.play('land', {vol: .4, x: zb.x, z: zb.z}); } zb.vy *= -.3; zb.spinX *= .4; }
    rig.body.rotation.x += zb.spinX * dt * (zb.y > .05 ? 1 : 0);
    // flying bodies knock other zombies over
    if (zb.y < 1.2) for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise' || o.bowled === zb) continue; if (Math.hypot(o.x - zb.x, o.z - zb.z) < zb.r + o.r + .2) { o.bowled = zb; damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 1, {w: weapon(), kind: 'bowl'}); shake(.2); } }
  } else if (d.type === 'decap') {
    if (d.t < .8 && Math.random() < .9) addPart({x: zb.x, y: 1.5, z: zb.z, vx: rnd(-1, 1), vz: rnd(-1, 1), vy: rnd(4, 8), g: 20, life: .6, max: .6, size: .09, col: pick(['#3f9a35', '#2a7a2a']), drag: .95, rx: 0, ry: 0});
  } else if (d.type === 'gib') life = .1;
  else if (d.type === 'burn') {
    const k = clamp(d.t / 1.6, 0, 1); for (const m of rig.mats) { m.color.lerp(COL('#140f0f'), dt * 2.5); m.emissive.setRGB(.9 * (1 - k) * (.6 + .4 * Math.sin(d.t * 40)), .3 * (1 - k), 0); }
    for (let i = 0; i < 3; i++) addPart({x: zb.x + rnd(-.3, .3), y: rnd(.2, 1.8), z: zb.z + rnd(-.3, .3), vx: 0, vz: 0, vy: rnd(2, 5), g: -2, life: .5, max: .5, size: rnd(.08, .18), col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10', '#3a3030']), drag: .9, rx: 0, ry: 0});
    life = 2.4;
  } else if (d.type === 'swell') { // tank: swells and flashes, then explodes
    const k = clamp(d.t / .7, 0, 1); rig.body.scale.setScalar(1 + k * .35); rig.flash(Math.sin(d.t * 50) > 0 ? .9 : .2, 1, .6, .2);
    if (d.t > .7 && !d.boomed) { d.boomed = true; rig.root.visible = false; explodeAt(zb.x, zb.z, 3.4, 3, 1, 'tank'); gibZombie(zb, rnd(0, 7)); }
    life = .8;
  } else if (d.type === 'boss') { if (d.t < 1.5 && Math.random() < .5) burst(zb.x, zb.z, 6, ['#3f9a35', '#7a1f1f'], 6, .2, .8, 2); life = 4; }
  if (d.t > life - 1 && d.type !== 'gib' && d.type !== 'swell') zb.y -= dt * 1.2; // sink into the street
  rig.mixer.update(dt); syncZombie(zb);
  if (d.t >= life) zb.gone = true;
}
function updateZombies(dt) {
  for (const zb of G.zombies) updateZombie(zb, dt);
  for (const zb of G.zombies) if (zb.gone) { zb.rig.dispose(); if (zb.teleMesh) scene.remove(zb.teleMesh); }
  G.zombies = G.zombies.filter(z => !z.gone);
}
function clearZombies() { for (const zb of G.zombies) { zb.rig.dispose(); if (zb.teleMesh) scene.remove(zb.teleMesh); } G.zombies = []; WAVE.queue = []; WAVE.active = false; WAVE.boss = null; }
