// Zombies: 4 types plus a boss, each with authored walk/attack/hit/death clips and its own attack pattern.
'use strict';
const ZTYPES = {
  walker:  {model: 'Zombie_Basic',   hp: 3, speed: [1.3, 1.9], move: 'Walk', attack: 'Punch',       range: 1.35, dmg: 10, r: .45, score: 10, coins: [0, 2], voice: 1},
  runner:  {model: 'Zombie_Ribcage', hp: 1, speed: [4.2, 5.0], move: 'Run',  attack: 'Jump',        range: 2.6,  dmg: 8, r: .38, score: 15, coins: [0, 1], pounce: true, voice: 1.3},
  tank:    {model: 'Zombie_Chubby',  hp: 8, speed: [.9, 1.15], move: 'Walk', attack: 'Punch',       range: 1.7,  dmg: 20, r: .7,  score: 30, coins: [2, 4], explode: true, voice: .75},
  grabber: {model: 'Zombie_Arm',     hp: 4, speed: [1.7, 2.1], move: 'Walk', attack: 'Run_Attack',  range: 1.5,  dmg: 12, r: .5,  score: 20, coins: [1, 2], lunge: true, voice: .9},
  // story zombies, one new type per district
  crawler: {model: 'Zombie_Ribcage', hp: 2, speed: [2.0, 2.4], move: 'Crawl', attack: 'Jump',       range: 2.0,  dmg: 10, r: .42, score: 20, coins: [1, 2], pounce: true, ambush: true, tint: 0xa8c890, voice: 1.2},
  bloater: {model: 'Zombie_Chubby',  hp: 6, speed: [.95, 1.15], move: 'Walk', attack: 'Punch',      range: 1.6,  dmg: 12, r: .75, score: 30, coins: [2, 3], acid: true, tint: 0xb0ff70, scale: 1.15, voice: .7},
  riot:    {model: 'Zombie_Basic',   hp: 5, speed: [1.4, 1.7], move: 'Walk', attack: 'Punch',       range: 1.45, dmg: 14, r: .5,  score: 30, coins: [2, 3], shield: true, tint: 0x9aa8c8, voice: .9},
  screamer:{model: 'Zombie_Arm',     hp: 3, speed: [2.3, 2.7], move: 'Run',  attack: 'Wave',        range: 0,    dmg: 0, r: .45, score: 35, coins: [2, 4], scream: true, tint: 0xd8b0ff, voice: 1.5},
  boss:    {model: 'Zombie_Chubby',  hp: 38, speed: [1.6, 1.6], move: 'Walk', attack: 'Punch',      range: 2.6,  dmg: 25, r: 1.4, score: 500, coins: [15, 20], boss: true, scale: 2.1, tint: 0xff9a8a, voice: .55},
};
const AREA_MIX = [[], [['crawler', .2]], [['bloater', .16], ['crawler', .1]], [['riot', .2], ['bloater', .1], ['crawler', .08]], [['screamer', .1], ['riot', .14], ['bloater', .08], ['crawler', .08]]];
const WAVE = {queue: [], spawnT: 0, alive: 0, total: 0, killed: 0, boss: null, active: false};

function makeWave(n) {
  const list = [], boss = n % 5 === 0;
  const count = boss ? 0 : Math.round((n <= 5 ? 5 + n * 2 : 6 + n * 3) * (UP.horde ? 1.3 : 1));
  for (let i = 0; i < count; i++) {
    const r = Math.random(); let t = 'walker';
    if (n >= 2 && r < .22 + n * .015) t = 'runner';
    else if (n >= 3 && r < .34 + n * .015) t = 'tank';
    else if (n >= 4 && r < .48 + n * .015) t = 'grabber';
    // each district mixes in its own zombies, and the ones from the districts before it
    const mix = AREA_MIX[n > 25 ? 4 : areaIndex(n)], q = Math.random();
    let acc = 0; for (const [type, p] of mix) { acc += p; if (q < acc) { t = type; break; } }
    list.push(t);
  }
  if (boss) list.push('walker', 'walker', 'boss', 'walker'); // the boss arrives with a small escort
  return list;
}
// attack tokens: at most 2 zombies (3 from wave 6) swing at you at the same moment; the rest crowd and wait
const attackersNow = () => G.zombies.filter(z => !z.dying && (z.state === 'attack' || z.state === 'windup' || z.state === 'lunge' || z.state === 'pounce')).length;
const maxAttackers = () => G.wave >= 6 ? 3 : 2;
// damage in health points (the bar holds 100): later waves bite a little harder
const zDmg = zb => Math.round((zb.type === 'tank' && G.wave < 7 ? 14 : zb.T.dmg) * (1 + Math.max(0, G.wave - 10) * .015));
const bossN = () => Math.max(1, Math.floor(G.wave / 5));
const bossDmg = () => bossN() === 1 ? 25 : 28 + bossN() * 3;
const bossTele = () => bossN() === 1 ? 1.3 : .95;
function startWave() {
  G.wave++; G.waveKills0 = G.kills; G.waveBest = 0; saveCheckpoint(); WAVE.queue = makeWave(G.wave); WAVE.total = WAVE.queue.length; WAVE.killed = 0; WAVE.spawnT = 1.2; WAVE.active = true; WAVE.boss = null;
  HUD.banner('WAVE ' + G.wave, G.wave % 5 === 0 ? 'BOSS INCOMING' : WAVE.total + ' zombies', G.wave % 5 === 0 ? '#ff4f4f' : '#ffcc33');
  if (G.wave % 5 === 0) { const P = G.player; P.hp = P.maxHp; popText(P.x, P.z, 'FULL HEAL', '#7dff8a', 34, 3); AU.play('heart', {vol: .8}); }
  POW.lastStand = false;
  if (G.wave > 1 && G.wave % 5 !== 0) { const P = G.player; if (P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 10); popText(P.x, P.z, '+10 HP', '#ff5a6a', 26, 2.8); } } // 10 health back every wave
  AU.play('waveStart', {vol: .8}); AU.musicTo(G.wave % 5 === 0 ? 'music_boss' : 'music_combat');
  if (!TUT.active) storyWaveStart();
  setTimeout(() => AU.play('zGroan', {vol: .7, rate: .9}), 600);
}
// riot shields share one geometry and material pair
const SHIELD = {geo: new THREE.BoxGeometry(.85, 1.25, .07), mat: new THREE.MeshStandardMaterial({color: 0x2c3a58, roughness: .4, metalness: .6, transparent: true, opacity: .92}),
  vGeo: new THREE.PlaneGeometry(.6, .22), vMat: new THREE.MeshBasicMaterial({color: 0xdfe6ff})};
function spawnZombie(type) {
  const T = ZTYPES[type], sp = pick(WORLD.spawnPoints);
  let x = sp[0] + rnd(-3, 3), z = sp[1] + rnd(-3, 3);
  if (T.ambush && G.player) { const a = rnd(0, 7), r = rnd(3.5, 5); const q = {x: G.player.x + Math.cos(a) * r, z: G.player.z + Math.sin(a) * r}; clampToBounds(q, 1); x = q.x; z = q.z; ring(x, z, 1.2, 0xa8c890, .9); AU.play('zGroan', {vol: .6, rate: 1.4, x, z, bus: 'voice'}); }
  const scale = (T.scale || 1) * (T.boss ? 1 : rnd(.93, 1.07));
  const BP = T.boss ? bossProfile() : null;
  const model = BP ? (BP.model === 'human' ? (MODELS[docModel()] ? docModel() : 'Characters_' + LOOK.char) : BP.model) : T.model;
  const rig = new Rig(model, {tint: BP ? BP.tint : T.tint, scale: BP ? BP.scale : scale}); if (BP) { rig.alias = BP.alias || null; rig.model.traverse(o => { if (WEAPON_MESHES.includes(o.name)) o.visible = false; }); }
  if (BP && BP.model === 'human' && model === docModel()) dressDoc(rig.model, model.slice(11));
  const bossN = Math.max(1, Math.floor(G.wave / 5)), hpMul = T.boss ? BP.hp / T.hp * (G.wave > 25 ? 1 + (G.wave - 25) / 20 : 1) * (curArea().boss === 'zero' && G.wave <= 25 && storyFlag('ozEnding') === 'static' ? 1.3 : 1) : 1 + (G.wave - 1) * .08;
  const zb = {type, T, rig, x, z, vx: 0, vz: 0, y: -2, vy: 0, r: T.r * (T.boss ? 1 : scale), face: Math.atan2(-z, -x),
    hp: Math.ceil(T.hp * hpMul), maxHp: Math.ceil(T.hp * hpMul), speed: rnd(...T.speed) * (1 + G.wave * .025),
    state: 'rise', st: 0, cd: rnd(.5, 1.2), flash: 0, stun: 0, burn: 0, bleed: 0, dying: null, wob: rnd(0, 7), groanT: rnd(2, 8)};
  rig.play(T.move, {fade: 0}); rig.cur.time = rnd(0, rig.dur(T.move));
  if (T.shield) { zb.shieldHp = 6; const s = new THREE.Mesh(SHIELD.geo, SHIELD.mat);
    const v = new THREE.Mesh(SHIELD.vGeo, SHIELD.vMat); v.position.set(0, .3, .04); s.add(v); s.position.set(0, 1.05, .55); rig.root.add(s); zb.shieldMesh = s; }
  if (T.scream) zb.screamT = rnd(2.5, 4);
  if (T.boss) { WAVE.boss = zb; zb.bossCd = 2.5; zb.lastMove = ''; zb.prof = BP; zb.bossName = BP.name; zb.r = T.r * BP.scale / T.scale; zb.speed *= BP.speedMul || 1; dressBoss(zb); AU.play('bossIntro', {vol: 1}); HAPTIC.fx('boss'); AU.play('evilLaugh', {vol: .9, delay: .8, bus: 'voice'}); HUD.banner(BP.name, BP.sub, '#ff4f4f'); slowmo(.5); shake(.4); }
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
  zb.flash -= dt; zb.stun -= dt; zb.st += dt; zb.cd -= dt * (zb.rage > 0 ? 1.6 : 1); zb.wob += dt; if (zb.rage > 0) zb.rage -= dt;
  if (zb.dying) { updateDying(zb, dt); return; }
  if (zb.state === 'rise') { // climbs out of the ground with dirt flying
    zb.y = lerp(-2, 0, easeOutCubic(clamp(zb.st / 1.1, 0, 1)));
    if (Math.random() < .5) addPart({x: zb.x + rnd(-.5, .5), y: .05, z: zb.z + rnd(-.5, .5), vx: rnd(-1.5, 1.5), vz: rnd(-1.5, 1.5), vy: rnd(3, 6), g: 20, life: .5, max: .5, size: .12, col: pick(['#3b2f24', '#4a3b2c', '#2a221a']), drag: .95, rx: 0, ry: 0});
    if (zb.st > 1.1) { zb.y = 0; zb.state = 'chase'; zb.st = 0; }
    zb.face = Math.atan2(P.z - zb.z, P.x - zb.x);
  } else {
    // damage over time
    // status effects: burn and bleed tick once per second, frost slows, stun shows stars
    if (zb.burn > 0) { zb.burn -= dt; zb.burnT = (zb.burnT ?? 1) - dt; if (Math.random() < .6) addPart({x: zb.x + rnd(-.3, .3), y: rnd(.4, 1.7), z: zb.z + rnd(-.3, .3), vx: 0, vz: 0, vy: rnd(2, 4), g: -2, life: .45, max: .45, size: rnd(.1, .18), col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10']), drag: .9, rx: 0, ry: 0}); if (zb.burnT <= 0) { zb.burnT = 1; damageZombie(zb, zb.face + Math.PI, zb.burnDmg || 1, {dot: 'burn'}); } }
    if (zb.bleed > 0 && !zb.dying) { zb.bleed -= dt; zb.bleedT = (zb.bleedT ?? 1) - dt; if (Math.random() < .25 * zb.bleedN) addPart({x: zb.x + rnd(-.25, .25), y: rnd(.6, 1.4), z: zb.z + rnd(-.25, .25), vx: 0, vz: 0, vy: -1, g: 14, life: .5, max: .5, size: .07, col: '#b01818', drag: 1, rx: 0, ry: 0}); if (zb.bleedT <= 0) { zb.bleedT = 1; damageZombie(zb, zb.face + Math.PI, zb.bleedN || 1, {dot: 'bleed'}); } if (zb.bleed <= 0) zb.bleedN = 0; }
    if (zb.inCloud > 0) zb.inCloud -= dt;
    comboTick(zb, dt);
    if (zb.slow > 0) { zb.slow -= dt; if (Math.random() < .3) addPart({x: zb.x + rnd(-.3, .3), y: rnd(.3, 1.8), z: zb.z + rnd(-.3, .3), vx: 0, vz: 0, vy: -.4, g: 0, life: .4, max: .4, size: .06, col: '#cff6ff', drag: 1, rx: 0, ry: 0}); }
    if (zb.stun > .25 && Math.random() < .5) { const a = G.time * 8 + Math.random() * 6; addPart({x: zb.x + Math.cos(a) * .35, y: 2 * (zb.T.scale || 1), z: zb.z + Math.sin(a) * .35, vx: -Math.sin(a), vz: Math.cos(a), vy: 0, g: 0, life: .3, max: .3, size: .07, col: '#ffe14a', drag: 1, rx: 0, ry: 0}); }
    if (zb.air) { zb.y += zb.vy * dt; zb.vy -= 22 * dt; zb.rig.body.rotation.x += 10 * dt; if (zb.y <= 0) { zb.y = 0; zb.air = false; zb.rig.body.rotation.x = 0; dust(zb.x, zb.z, 12); shake(.2); AU.play('land', {vol: .6, x: zb.x, z: zb.z}); if (zb.homerun) homerunLand(zb); } }
    if (zb.dying) return;
    const dx = P.x - zb.x, dz = P.z - zb.z, d = Math.hypot(dx, dz), toP = Math.atan2(dz, dx);
    zb.groanT -= dt; if (zb.groanT < 0) { zb.groanT = rnd(4, 10); AU.play(T.boss ? 'bossEffort' : 'zGroan', {vol: .45, rate: T.voice * rnd(.9, 1.1), x: zb.x, z: zb.z, bus: 'voice', max: 2}); }
    if (zb.stun > 0) { /* staggered: knockback only */ }
    else if (zb.dummy) { zb.vx *= .8; zb.vz *= .8; zb.face += angDiff(zb.face, toP) * damp(.05, dt); if (rig.curName !== 'Idle') rig.play('Idle', {fade: .2}); }
    else if (T.boss) bossAI(zb, dt, d, toP);
    else if (T.scream && zb.state !== 'scream') { // keeps 6 m away and screams to enrage the zombies around it
      zb.screamT -= dt; const want = d < 5 ? toP + Math.PI : d > 8 ? toP : toP + Math.PI / 2; zb.face += angDiff(zb.face, want) * damp(.05, dt);
      const sp = zb.speed * (zb.slow > 0 ? zb.slowF || .5 : 1) * (d > 5 && d < 8 ? .4 : 1); zb.vx = lerp(zb.vx, Math.cos(zb.face) * sp, damp(.01, dt)); zb.vz = lerp(zb.vz, Math.sin(zb.face) * sp, damp(.01, dt));
      if (rig.curName !== 'Run') rig.play('Run', {fade: .2});
      if (zb.screamT <= 0 && !P.dead) { zb.state = 'scream'; zb.st = 0; zb.vx = zb.vz = 0; zb.face = toP; rig.play('Wave', {loop: false, restart: true, fade: .1}); }
    } else if (zb.state === 'scream') {
      zb.vx *= .8; zb.vz *= .8; zb.flash = Math.sin(zb.st * 40) > 0 ? .06 : 0;
      if (zb.st > .35 && !zb.screamed) { zb.screamed = true; ring(zb.x, zb.z, 9, 0xd8b0ff, .5); ring(zb.x, zb.z, 4, 0xffffff, .3); AU.play('zAttack', {vol: 1, rate: 1.8, x: zb.x, z: zb.z, bus: 'voice'}); AU.play('evilLaugh', {vol: .5, rate: 1.6, bus: 'voice'}); shake(.15);
        let n = 0; for (const o of G.zombies) if (o !== zb && !o.dying && !o.T.boss && Math.hypot(o.x - zb.x, o.z - zb.z) < 9) { o.rage = 5; n++; } if (n) popText(zb.x, zb.z, 'ENRAGED x' + n, '#d8b0ff', 24, 2.6); }
      if (zb.st > 1) { zb.state = 'chase'; zb.screamed = false; zb.screamT = rnd(5, 6.5); }
    }
    else if (zb.state === 'chase') {
      zb.face += angDiff(zb.face, toP) * damp(.02, dt);
      // unstick: a zombie that barely moved for 1 s while chasing walks sideways around the obstacle
      zb.stuckT = (zb.stuckT ?? 1) - dt; if (zb.stuckT <= 0) { zb.stuckT = 1; if (zb.lx !== undefined && Math.hypot(zb.x - zb.lx, zb.z - zb.lz) < .35 && d > 2) { zb.side = 1.2; zb.sideDir = Math.random() < .5 ? 1 : -1; } zb.lx = zb.x; zb.lz = zb.z; }
      if (zb.side > 0) { zb.side -= dt; zb.face = toP + zb.sideDir * 1.4; }
      const sp = zb.speed * (P.dead ? .3 : 1) * (zb.slow > 0 ? zb.slowF || .5 : 1) * (zb.inCloud > 0 ? .7 : 1) * (zb.rage > 0 ? 1.35 : 1);
      zb.vx = lerp(zb.vx, Math.cos(zb.face) * sp, damp(.01, dt)); zb.vz = lerp(zb.vz, Math.sin(zb.face) * sp, damp(.01, dt));
      if (rig.curName !== T.move) rig.play(T.move, {fade: .2, speed: T.move === 'Run' ? 1.1 : zb.speed / 1.6});
      if (!P.dead && zb.cd <= 0 && attackersNow() < maxAttackers()) {
        if (T.lunge && d > 2.6 && d < 5.5) { zb.state = 'windup'; zb.st = 0; rig.play('Idle', {fade: .1}); AU.play('zAttack', {vol: .6, rate: T.voice, x: zb.x, z: zb.z, bus: 'voice'}); }
        else if (T.pounce && d < T.range) { zb.state = 'pounce'; zb.st = 0; zb.hitDone = false; rig.play('Jump', {loop: false, restart: true, fade: .05}); zb.vx = Math.cos(toP) * 9; zb.vz = Math.sin(toP) * 9; zb.vy = 4.5; AU.play('zAttack', {vol: .6, rate: 1.4, x: zb.x, z: zb.z, bus: 'voice'}); }
        else if (!T.pounce && d < T.range + .2) { zb.state = 'attack'; zb.st = 0; zb.hitDone = false; zb.vx *= .2; zb.vz *= .2; rig.play(T.attack, {loop: false, restart: true, fade: .08, speed: .95}); AU.play('zAttack', {vol: .55, rate: T.voice * rnd(.9, 1.1), x: zb.x, z: zb.z, bus: 'voice', max: 2}); }
      }
    } else if (zb.state === 'attack') { // authored swing; damage lands mid-clip if the player is still in reach and in front
      zb.face += angDiff(zb.face, toP) * damp(.2, dt); zb.vx *= .9; zb.vz *= .9;
      const dur = rig.dur(T.attack) / .95;
      if (!zb.hitDone && zb.st > dur * .45) { zb.hitDone = true; if (d < T.range + .3 && Math.abs(angDiff(zb.face, toP)) < 1 && P.y < .8) { if (hurtPlayer(zDmg(zb), zb.x, zb.z) && UP.thorns) damageZombie(zb, toP + Math.PI, 2, {thorns: true}); } }
      if (zb.st > dur) { zb.state = 'chase'; zb.cd = rnd(.6, 1.1); }
    } else if (zb.state === 'windup') { // grabber: shakes, then lunges
      zb.face = toP; zb.vx *= .8; zb.vz *= .8; zb.flash = Math.sin(zb.st * 40) > .3 ? .05 : 0;
      if (zb.st > .5) { zb.state = 'lunge'; zb.st = 0; zb.hitDone = false; rig.play('Run_Attack', {fade: .05, speed: 1.4}); zb.vx = Math.cos(zb.face) * 11; zb.vz = Math.sin(zb.face) * 11; }
    } else if (zb.state === 'lunge' || zb.state === 'pounce') {
      if (zb.state === 'pounce') { zb.y += zb.vy * dt; zb.vy -= 20 * dt; if (zb.y < 0) zb.y = 0; }
      if (!zb.hitDone && d < zb.r + .6 && P.y < .9) { zb.hitDone = true; hurtPlayer(zDmg(zb), zb.x, zb.z); }
      if (zb.st > (zb.state === 'pounce' ? .45 : .5)) { zb.state = 'chase'; zb.cd = rnd(1, 1.6); zb.y = 0; zb.vx *= .3; zb.vz *= .3; }
    }
  }
  // movement, separation, obstacles
  zb.x += zb.vx * dt; zb.z += zb.vz * dt;
  const fr = zb.air ? .6 : zb.stun > 0 ? .05 : .5; zb.vx *= Math.pow(fr, dt); zb.vz *= Math.pow(fr, dt);
  if (zb.state !== 'rise') {
    for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise') continue; const ox = zb.x - o.x, oz = zb.z - o.z, od = Math.hypot(ox, oz), m = zb.r + o.r; if (od > 0 && od < m) { zb.x += ox / od * (m - od) * .5; zb.z += oz / od * (m - od) * .5; } }
    collide(zb, zb.r); inArena(zb, zb.r);
    if (!P.dead && !zb.T.boss) { const pd = Math.hypot(P.x - zb.x, P.z - zb.z), m = zb.r + .45; if (pd < m && pd > 0) { zb.x -= (P.x - zb.x) / pd * (m - pd); zb.z -= (P.z - zb.z) / pd * (m - pd); } }
  }
  if (zb.sq > 0 || zb.leanT > 0) { // contact squash (100 ms) and lean back (300 ms)
    zb.sq = Math.max(0, (zb.sq || 0) - dt / .1); const q = .15 * zb.sq; rig.body.scale.set(1 + q, 1 - q, 1 + q);
    zb.leanT = Math.max(0, (zb.leanT || 0) - dt); if (!zb.air) rig.body.rotation.x = -.4 * zb.leanT / .3; }
  rig.mixer.update(dt);
  syncZombie(zb);
}
const FLASH_COL = [[1, 1, 1], [1, .8, .2], [.6, .7, .9]]; // normal, crit or finisher, shield block
// shown at once, so the flash is on screen during the hitstop freeze, then held for n frames of game time
function hitFlash(zb, col, n) { zb.flash = n / 60; zb.flashCol = col; const c = FLASH_COL[col]; zb.rig.flash(.55, c[0], c[1], c[2]); }
function syncZombie(zb) {
  const rig = zb.rig; rig.root.position.set(zb.x, zb.y, zb.z); rig.root.rotation.y = yawFor(zb.face);
  if (zb.dying) { if (zb.dying.type !== 'burn' && zb.dying.type !== 'swell') rig.flash(zb.flash > 0 ? .45 : 0); return; }
  if (zb.flash > 0) { const c = FLASH_COL[zb.flashCol || 0]; rig.flash(.55, c[0], c[1], c[2]); } else if (zb.rage > 0) rig.flash(.25 + .1 * Math.sin(G.time * 14), .8, .3, 1); else if (zb.burn > 0) rig.flash(.35, 1, .4, 0); else if (zb.acidT > 0) rig.flash(.35, .75, 1, .1); else if (zb.slow > 0) rig.flash(.4, .35, .75, 1); else if (zb.T.boss && zb.tele) rig.flash(.3 + .3 * Math.sin(G.time * 30), 1, .1, .1); else if (rig.zero) rig.flash(.22 + .1 * Math.sin(G.time * 5), .55, .2, 1); else rig.flash(0);
}

// ---------- boss: charge, slam, summon ----------
const teleMat = new THREE.MeshBasicMaterial({color: 0xff2020, transparent: true, opacity: .35, depthWrite: false});
const TELE_LANE = new THREE.PlaneGeometry(14, 2.6), TELE_CIRCLE = new THREE.CircleGeometry(4, 40); // shared by every boss telegraph
function bossAI(zb, dt, d, toP) {
  const rig = zb.rig, P = G.player;
  if (zb.prof && zb.prof.gear === 'zero' && Math.random() < .6) addPart({x: zb.x + rnd(-.8, .8), y: rnd(.5, 3.5), z: zb.z + rnd(-.8, .8), vx: 0, vz: 0, vy: rnd(.5, 1.5), g: -1, life: .7, max: .7, size: rnd(.08, .16), col: pick(['#b070ff', '#6a3aa0', '#e0c0ff']), drag: .95, rx: 0, ry: 0});
  if (zb.state === 'chase') {
    zb.face += angDiff(zb.face, toP) * damp(.05, dt);
    zb.vx = lerp(zb.vx, Math.cos(zb.face) * zb.speed, damp(.01, dt)); zb.vz = lerp(zb.vz, Math.sin(zb.face) * zb.speed, damp(.01, dt));
    if (rig.curName !== 'Walk') rig.play('Walk', {fade: .2, speed: .8});
    zb.bossCd -= dt;
    if (zb.bossCd <= 0 && !P.dead) {
      const runners = G.zombies.filter(z => !z.T.boss && !z.dying).length >= 9 ? 9 : G.zombies.filter(z => z.type === 'runner' && !z.dying).length;
      // Patient Zero gains moves as it weakens
      if (zb.prof && zb.prof.phases) { const ph = zb.hp < zb.maxHp * .33 ? 2 : zb.hp < zb.maxHp * .66 ? 1 : 0; if (ph !== zb.phase) { zb.phase = ph; if (ph) { HUD.banner('PHASE ' + (ph + 1), ph === 1 ? 'he calls the horde' : 'he stops holding back', '#d0a0ff'); slowmo(.5); shake(.5); zb.speed *= 1.15; } } zb.prof = Object.assign({}, zb.prof, {moves: zb.prof.phases[zb.phase]}); }
      const moves = (zb.prof ? zb.prof.moves : ['charge', 'slam', 'summon']).filter(m => m !== zb.lastMove && !(m === 'slam' && d > 9) && !(m === 'summon' && runners >= 4));
      const m = zb.forceMove || (d < 4 && moves.includes('slam') ? 'slam' : pick(moves.length ? moves : ['charge'])); zb.forceMove = null; zb.lastMove = m; zb.state = m + 'Tele'; zb.st = 0; zb.vx = zb.vz = 0; zb.tele = true;
      if (m === 'hook') hookStart(zb, toP);
      if (m === 'blink') { blinkMove(zb); return; }
      if (m === 'rush') { rushMove(zb); zb.state = 'recover'; zb.st = -1.2; zb.tele = false; }
      if (m === 'throw') { // the harbor master: containers drop on you and around you
        rig.play('Idle_Attack', {fade: .1}); AU.play('bossEffort', {vol: 1, bus: 'voice'}); const n = zb.prof.drops || 3;
        dropContainer(P.x, P.z); for (let i = 1; i < n; i++) { const a = rnd(0, 7), r = rnd(3, 5.5), q = {x: P.x + Math.cos(a) * r, z: P.z + Math.sin(a) * r}; clampToBounds(q, 1.5); dropContainer(q.x, q.z, i * .35); }
        zb.state = 'recover'; zb.st = -.8; zb.tele = false; }
      if (m === 'lanes') { // the convoy: trucks drive down marked lanes, the first one through your position
        rig.play('Wave', {loop: false, restart: true, fade: .1}); AU.play('bossLaugh', {vol: 1, bus: 'voice'}); const bb = boundsBox(), ax = bb.hw >= bb.hd ? 'x' : 'z', lim = (ax === 'x' ? bb.hd : bb.hw) - 1.5, p0 = ax === 'x' ? P.z : P.x;
        truckLane(ax, clamp(p0, -lim, lim), 0, Math.random() < .5 ? 1 : -1); truckLane(ax, clamp(p0 + (p0 > 0 ? -4.5 : 4.5), -lim, lim), .9, Math.random() < .5 ? 1 : -1);
        if (zb.hp < zb.maxHp * .5) truckLane(ax, clamp(-p0, -lim, lim), 1.8, 1);
        zb.state = 'recover'; zb.st = -1.6; zb.tele = false; }
      if (m === 'charge') { zb.chargeDir = toP; zb.teleMesh = new THREE.Mesh(TELE_LANE, teleMat); zb.teleMesh.rotation.x = -Math.PI / 2; scene.add(zb.teleMesh); rig.play('Idle_Attack', {fade: .1}); AU.play('bossEffort', {vol: 1, bus: 'voice'}); }
      if (m === 'slam') { zb.slamX = P.x; zb.slamZ = P.z; zb.teleMesh = new THREE.Mesh(TELE_CIRCLE, teleMat); zb.teleMesh.rotation.x = -Math.PI / 2; zb.teleMesh.position.set(P.x, .04, P.z); scene.add(zb.teleMesh); rig.play('Jump', {loop: false, restart: true, fade: .1, speed: .5}); AU.play('bossEffort', {vol: 1, bus: 'voice', rate: .9}); }
      if (m === 'summon') { rig.play('Wave', {loop: false, restart: true, fade: .1}); AU.play('bossLaugh', {vol: 1, bus: 'voice'}); }
    }
  } else if (zb.state === 'hookTele') { hookUpdate(zb, dt, toP);
  } else if (zb.state === 'chargeTele') {
    zb.chargeDir += angDiff(zb.chargeDir, toP) * damp(.1, dt);
    zb.face = zb.chargeDir; const L = 7; zb.teleMesh.position.set(zb.x + Math.cos(zb.chargeDir) * L, .04, zb.z + Math.sin(zb.chargeDir) * L); zb.teleMesh.rotation.z = -zb.chargeDir;
    teleMat.opacity = .25 + .2 * Math.sin(zb.st * 25);
    if (zb.st > bossTele()) { scene.remove(zb.teleMesh); zb.tele = false; zb.state = 'charge'; zb.st = 0; zb.hitDone = false; rig.play('Run_Arms', {fade: .05, speed: 1.4}); }
  } else if (zb.state === 'charge') {
    zb.vx = Math.cos(zb.chargeDir) * 13; zb.vz = Math.sin(zb.chargeDir) * 13;
    if (Math.random() < .6) dust(zb.x, zb.z, 2);
    if (!zb.hitDone && d < zb.r + .7) { zb.hitDone = true; hurtPlayer(bossDmg(), zb.x, zb.z); }
    const bx = zb.x, bz = zb.z; collide(zb, zb.r);
    const blocked = Math.abs(bx - zb.x) + Math.abs(bz - zb.z) > .01 || outOfBounds(zb.x, zb.z, zb.r + .1);
    if (zb.prof && zb.prof.gear === 'zero' && G.time - (zb.trailT || 0) > .25) { zb.trailT = G.time; acidPool(zb.x, zb.z, 1.1, 3); } // Patient Zero leaves acid
    if ((zb.st > 1.15 || blocked) && zb.prof && zb.prof.chain && zb.hp < zb.maxHp * .5 && (zb.chainN || 0) < zb.prof.chain) { // the orderly turns and charges again
      zb.chainN = (zb.chainN || 0) + 1; zb.vx *= -.2; zb.vz *= -.2; if (blocked) { shake(.4); AU.play('hitMetal', {vol: .8, rate: .7}); dust(zb.x, zb.z, 12); }
      zb.chargeDir = toP; zb.teleMesh = new THREE.Mesh(TELE_LANE, teleMat); zb.teleMesh.rotation.x = -Math.PI / 2; scene.add(zb.teleMesh); zb.tele = true;
      zb.state = 'chargeTele'; zb.st = Math.max(0, bossTele() - .6); rig.play('Idle_Attack', {fade: .08}); AU.play('bossEffort', {vol: .9, bus: 'voice'}); popText(zb.x, zb.z, 'AGAIN!', '#ff4f4f', 30, 4.5);
    } else if (zb.st > 1.15 || blocked) { // crashes into a wall: stunned and open
      zb.chainN = 0; zb.state = 'stunned'; zb.st = 0; zb.vx *= -.2; zb.vz *= -.2; if (blocked) { shake(.6); HAPTIC.fx('slam', .6); AU.play('hitMetal', {vol: 1, rate: .6}); AU.play('explosion', {vol: .5, rate: 1.3}); dust(zb.x, zb.z, 20); }
      rig.play('HitReact', {loop: false, restart: true, fade: .05, speed: .5});
    }
  } else if (zb.state === 'stunned') { zb.vx *= .9; zb.vz *= .9; if (zb.st > 1.4) { zb.state = 'chase'; zb.bossCd = rnd(1.5, 2.5); } }
  else if (zb.state === 'slamTele') {
    const slamT = zb.quickSlam ? .8 : bossN() === 1 ? 1.3 : 1.1;
    teleMat.opacity = .2 + .25 * (zb.st / slamT); zb.teleMesh.scale.setScalar(.3 + .7 * Math.min(1, zb.st / slamT));
    const k = clamp(zb.st / slamT, 0, 1); zb.x = lerp(zb.x, zb.slamX, k * .08); zb.z = lerp(zb.z, zb.slamZ, k * .08); zb.y = Math.sin(k * Math.PI) * 3.2;
    if (zb.st > slamT) {
      scene.remove(zb.teleMesh); zb.tele = false; zb.y = 0; zb.state = 'recover'; zb.st = 0; zb.quickSlam = false; rig.play('Punch', {loop: false, restart: true, fade: .05});
      ring(zb.slamX, zb.slamZ, 4.2, 0xff5040, .4); ring(zb.slamX, zb.slamZ, 2.4, 0xffffff, .25); shake(.8); hitstop(.08); boom(zb.slamX, zb.slamZ, 0xff5030, 8);
      burst(zb.slamX, zb.slamZ, 40, ['#6b6470', '#4a3b2c', '#3b2f24'], 10, .25, .9, .1); AU.play('explosion', {vol: 1}); AU.play('hitHardest', {vol: 1, rate: .6});
      HAPTIC.fx('bossSlam', Math.hypot(P.x - zb.slamX, P.z - zb.slamZ) < 6 ? 1 : .5);
      if (Math.hypot(P.x - zb.slamX, P.z - zb.slamZ) < 4 && P.y < 1) hurtPlayer(bossDmg(), zb.slamX, zb.slamZ);
    }
  } else if (zb.state === 'summonTele') {
    if (zb.st > 1.0) { const nS = G.wave <= 5 ? 2 : 3 + Math.floor(G.wave / 5), st = (zb.prof && zb.prof.summon) || 'runner'; for (let i = 0; i < nS; i++) WAVE.queue.unshift(st === 'mix' ? pick(['runner', 'screamer', 'crawler']) : st); WAVE.total += nS; WAVE.spawnT = 0; zb.state = 'recover'; zb.st = 0; AU.play('chains', {vol: .9}); }
  } else if (zb.state === 'recover') { zb.vx *= .85; zb.vz *= .85; if (zb.st > .9) { zb.state = 'chase'; zb.bossCd = rnd(2, 3.2) * Math.max(.55, zb.hp / zb.maxHp + .2); } }
}

// ---------- damage and deaths ----------
function damageZombie(zb, dir, dmg, o = {}) {
  if (zb.dying || zb.state === 'rise') return;
  const w = o.w || weapon(), T = zb.T;
  // the convoy boss: his shield blocks every hit from the front while he stands ready
  if (zb.prof && zb.prof.frontGuard && zb.state !== 'stunned' && zb.state !== 'recover' && !o.dot && !o.slam && !o.finisher && !['truck', 'crush'].includes(o.kind) && Math.abs(angDiff(zb.face, dir + Math.PI)) < 1.1) {
    sparks(zb.x, zb.z, dir + Math.PI, 14, '#cfe0ff'); AU.play('hitMetal', {vol: .8, rate: 1.1, max: 3}); G.combo++; G.comboT = 2;
    if (G.time - (zb.blockMsgT || 0) > 1.2) { zb.blockMsgT = G.time; popText(zb.x, zb.z, 'BLOCKED: GET BEHIND HIM', '#9fb4ff', 22, 4.6); }
    return;
  }
  // riot shield: blocks hits from the front until it breaks; finishers, slams and damage over time get through
  if (zb.shieldHp > 0 && !o.dot && !o.finisher && !o.slam && !['truck', 'crush', 'storm', 'stormbody', 'pulse'].includes(o.kind) && Math.abs(angDiff(zb.face, dir + Math.PI)) < 1.05) {
    zb.shieldHp -= dmg; zb.vx += Math.cos(dir) * 2; zb.vz += Math.sin(dir) * 2; sparks(zb.x, zb.z, dir + Math.PI, 12, '#cfe0ff'); hitFlash(zb, 2, 2);
    AU.play('hitMetal', {vol: .7, rate: 1.2, max: 3}); G.combo++; G.comboT = 2;
    if (zb.shieldHp <= 0) { const s = zb.shieldMesh; if (s) { zb.rig.root.remove(s); } zb.shieldMesh = null; popText(zb.x, zb.z, 'SHIELD BROKEN', '#cfe0ff', 26, 2.4); burst(zb.x, zb.z, 18, ['#2c3a58', '#dfe6ff'], 7, .15, .8, 1.1); AU.play('glass', {vol: .8}); zb.stun = 1; }
    else popText(zb.x, zb.z, 'BLOCKED', '#9fb4ff', 20, 2.2);
    return;
  }
  // hit flash: white 2 frames, gold 3 frames for crits and finishers
  dmg = comboDamage(zb, dmg, o);
  const gold = o.crit || o.finisher; zb.hp -= dmg; hitFlash(zb, gold ? 1 : 0, gold ? 3 : 2); G.combo++; G.comboT = 2; if (G.combo > (G.waveBest || 0)) G.waveBest = G.combo;
  if (!o.dot) {
    const kb = (o.kb ?? w.kb + (o.finisher ? 4 : 0)) * (zb.dummy ? .05 : T.boss ? .08 : T.explode ? .4 : 1) * (zb.hp <= 0 ? 1.4 : 1);
    zb.vx += Math.cos(dir) * kb; zb.vz += Math.sin(dir) * kb;
    if (!T.boss && !zb.air) { zb.sq = 1; zb.leanT = .3; } // squash on contact, lean back away from the hit
    if (!T.boss && zb.hp > 0 && !zb.air) { zb.stun = Math.max(zb.stun, .28); if (zb.state === 'attack' || zb.state === 'windup' || zb.state === 'lunge') zb.state = 'chase'; zb.rig.play('HitReact', {loop: false, restart: true, fade: .04}); }
    sparks(zb.x, zb.z, dir, 10, o.crit ? '#ffef5a' : '#fff6c8'); burst(zb.x, zb.z, 8, ['#3f9a35', '#2a7a2a', '#7a1f1f'], 6, .12, .7, 1.1);
    ring(zb.x, zb.z, .9, w.col, .16, 1); flashLight(zb.x, zb.z, w.col, 4);
    AU.play(T.boss ? 'bossHurt' : 'zHurt', {vol: .45, rate: T.voice * rnd(.9, 1.15), x: zb.x, z: zb.z, bus: 'voice', max: 2});
  }
  if (o.crit) HAPTIC.fx('crit');
  // damage numbers grow with the hit: 1 dmg = 25 px, 6+ dmg = 40 px; crits and finishers in gold
  popText(zb.x, zb.z, (o.crit ? 'CRIT ' : '') + dmg, o.crit || o.finisher ? '#ffcc33' : o.dot === 'burn' ? '#ff9a3a' : '#ffffff', 22 + Math.min(18, dmg * 3), 2.1 * (T.scale || 1)).dmg = true;
  const sh = SHOUTS[G.combo]; if (sh) { popText(G.player.x, G.player.z, sh, '#ff7a1a', 54, 3.4); slowmo(.4); G.flash = Math.max(G.flash, .3); AU.play('levelUp', {vol: .6}); }
  if (zb.dummy) zb.hp = Math.max(1, zb.hp); // the training dummy never dies
  if (zb.hp <= 0) killZombie(zb, dir, o);
}
const SHOUTS = {10: 'NICE!', 20: 'BRUTAL!', 35: 'UNSTOPPABLE!', 50: 'LEGENDARY!!', 80: 'GODLIKE!!!'};
function chooseDeath(zb, o) {
  const w = o.w || weapon(), r = Math.random();
  if (zb.T.boss) return 'boss';
  if (zb.T.explode) return 'swell';
  if (zb.T.acid) return 'acid';
  if (zb.slow > 0 && zb.shatter) return 'shatter';
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
  zb.dying = {type: chooseDeath(zb, o), t: 0}; zb.state = 'dead'; zb.stun = 0; zb.sq = zb.leanT = 0; zb.rig.body.scale.set(1, 1, 1); zb.rig.body.rotation.x = 0;
  if (T.boss && !TUT.active) storyBossDown();
  popText(zb.x, zb.z, '+' + T.score, '#ffcc33', 26 + Math.min(G.combo, 20), 2.6 * (T.scale || 1));
  AU.play(T.boss ? 'bossDeath' : 'zDeath', {vol: .7, rate: T.voice * rnd(.9, 1.1), x: zb.x, z: zb.z, bus: 'voice', max: 2});
  AU.play(pick(['bone', 'skull', 'gore']), {vol: .8, x: zb.x, z: zb.z, delay: .02});
  blood(zb.x, zb.z, T.boss ? 3 : 1.1); burst(zb.x, zb.z, 14, ['#3f9a35', '#2a7a2a', '#7a1f1f'], 7, .14, .8, 1);
  // drops
  const nc = Math.round(Math.floor(rnd(T.coins[0], T.coins[1] + 1)) * (1 + .25 * safeLv('scav'))); for (let i = 0; i < nc; i++) dropPickup('coin', zb.x, zb.z);
  if (!zb.dummy) maybeDropGem(zb);
  if (Math.random() < (P.hp < P.maxHp ? .12 : .03)) dropPickup('heart', zb.x, zb.z);
  if (T.boss) { dropPickup('heart', zb.x, zb.z); dropPickup('heart', zb.x, zb.z); }
  POW.add(4);
  if (zb.spreadFire && zb.burn > 0) for (const o of G.zombies) if (o !== zb && !o.dying && Math.hypot(o.x - zb.x, o.z - zb.z) < 2.5) { o.burn = 3; o.burnDmg = zb.burnDmg; o.spreadFire = true; burst(o.x, o.z, 6, ['#ff8a1a', '#ffcf3a'], 4, .1, .4, 1); }
  comboKill(zb);
  if (Math.random() < .025 + (T.boss ? 1 : 0)) dropPickup('rage', zb.x, zb.z);
  if (UP.lifesteal) { P.killsForHeal++; if (P.killsForHeal >= 12) { P.killsForHeal = 0; P.hp = Math.min(P.maxHp, P.hp + 6); popText(P.x, P.z, '+6 HP', '#ff5a6a', 26); AU.play('heart', {vol: .5}); } }
  if (UP.explosive && Math.random() < .15 && !T.explode) setTimeout(() => explodeAt(zb.x, zb.z, 2.6, 3, 0, 'kill'), 120);
  const d = zb.dying, rig = zb.rig;
  if (d.type !== 'gib') rig.play('Death', {loop: false, restart: true, fade: .05, speed: d.type === 'launch' ? 1.3 : 1});
  if (d.type === 'launch') { zb.vy = rnd(6, 8.5); zb.spinX = rnd(-9, 9); zb.vx = Math.cos(dir) * 9; zb.vz = Math.sin(dir) * 9; }
  if (d.type === 'decap') popHead(zb, dir);
  if (d.type === 'shatter') shatterZombie(zb, dir);
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
    if (zb.homerun && zb.y > .05) { zb.x += zb.vx * dt * .9; zb.z += zb.vz * dt * .9; } // home runs keep their speed in the air
    zb.y += zb.vy * dt; zb.vy -= 22 * dt; if (zb.y < 0) { zb.y = 0; if (Math.abs(zb.vy) > 3) { dust(zb.x, zb.z, 8); AU.play('land', {vol: .4, x: zb.x, z: zb.z}); if (zb.homerun) { zb.homerun = false; homerunLand(zb); } } zb.vy *= -.3; zb.spinX *= .4; }
    rig.body.rotation.x += zb.spinX * dt * (zb.y > .05 ? 1 : 0);
    // flying bodies knock other zombies over
    if (zb.y < 1.2) for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise' || o.bowled === zb) continue; if (Math.hypot(o.x - zb.x, o.z - zb.z) < zb.r + o.r + .2) { o.bowled = zb; damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 1, {w: weapon(), kind: 'bowl'}); shake(.2); } }
  } else if (d.type === 'decap') {
    if (d.t < .8 && Math.random() < .9) addPart({x: zb.x, y: 1.5, z: zb.z, vx: rnd(-1, 1), vz: rnd(-1, 1), vy: rnd(4, 8), g: 20, life: .6, max: .6, size: .09, col: pick(['#3f9a35', '#2a7a2a']), drag: .95, rx: 0, ry: 0});
  } else if (d.type === 'gib' || d.type === 'shatter') life = .1;
  else if (d.type === 'burn') {
    const k = clamp(d.t / 1.6, 0, 1); for (const m of rig.mats) { m.color.lerp(COL('#140f0f'), dt * 2.5); m.emissive.setRGB(.9 * (1 - k) * (.6 + .4 * Math.sin(d.t * 40)), .3 * (1 - k), 0); }
    for (let i = 0; i < 3; i++) addPart({x: zb.x + rnd(-.3, .3), y: rnd(.2, 1.8), z: zb.z + rnd(-.3, .3), vx: 0, vz: 0, vy: rnd(2, 5), g: -2, life: .5, max: .5, size: rnd(.08, .18), col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10', '#3a3030']), drag: .9, rx: 0, ry: 0});
    life = 2.4;
  } else if (d.type === 'swell') { // tank: swells and flashes, then explodes
    const k = clamp(d.t / .7, 0, 1); rig.body.scale.setScalar(1 + k * .35); rig.flash(Math.sin(d.t * 50) > 0 ? .9 : .2, 1, .6, .2);
    if (d.t > .7 && !d.boomed) { d.boomed = true; rig.root.visible = false; explodeAt(zb.x, zb.z, 3.4, 3, 20, 'tank'); gibZombie(zb, rnd(0, 7)); }
    life = .8;
  } else if (d.type === 'acid') { // bloater: swells green, then bursts into an acid pool
    const k = clamp(d.t / .6, 0, 1); rig.body.scale.setScalar(1 + k * .45); rig.flash(Math.sin(d.t * 50) > 0 ? .8 : .2, .5, 1, .2);
    if (d.t > .6 && !d.boomed) { d.boomed = true; rig.root.visible = false; acidPool(zb.x, zb.z, 2, 5); gibZombie(zb, rnd(0, 7)); const P = G.player; if (Math.hypot(P.x - zb.x, P.z - zb.z) < 1.5) hurtPlayer(18, zb.x, zb.z); }
    life = .7;
  } else if (d.type === 'boss') { if (d.t < 1.5 && Math.random() < .5) burst(zb.x, zb.z, 6, ['#3f9a35', '#7a1f1f'], 6, .2, .8, 2); life = 4; }
  // bodies that fell whole stay as corpses (see CORPSES); the rest sink into the street
  const keep = d.type === 'fall' || d.type === 'launch' || d.type === 'decap' || d.type === 'burn';
  if (keep && d.t >= life - 1 && zb.y <= .05) { zb.gone = true; zb.corpse = true; return; }
  if (d.t > life - 1 && d.type !== 'gib' && d.type !== 'swell' && d.type !== 'acid') zb.y -= dt * 1.2; // sink into the street
  rig.mixer.update(dt); syncZombie(zb);
  if (d.t >= life) zb.gone = true;
}
function updateZombies(dt) {
  const zt = dt * POW.zombieTime(); // TIME WARP slows the horde
  for (const zb of G.zombies) updateZombie(zb, zt);
  updateHazards(zt);
  for (const zb of G.zombies) if (zb.gone) { if (zb.teleMesh) scene.remove(zb.teleMesh); if (zb.corpse) addCorpse(zb.rig); else zb.rig.dispose(); }
  G.zombies = G.zombies.filter(z => !z.gone);
  updateCorpses(dt);
}
// Corpses: the last 8 whole bodies stay on the street, frozen in their last pose (the mixer is no longer updated),
// darkened 40% toward #1a1a1a, sinking 0.3 m over 4 s, then 1 s more under the street and gone.
// They are not in G.zombies, so they never count as alive, block movement or take hits.
const CORPSES = [];
function addCorpse(rig) {
  for (const m of rig.mats) { m.color.lerp(COL('#1a1a1a'), .4); m.emissive.setRGB(0, 0, 0); }
  rig.model.traverse(o => { if (o.isMesh) o.castShadow = false; });
  CORPSES.push({rig, t: 0, y0: rig.root.position.y});
  if (CORPSES.length > 8) CORPSES.shift().rig.dispose();
}
function updateCorpses(dt) {
  for (const c of CORPSES) { c.t += dt; c.rig.root.position.y = c.y0 - .3 * Math.min(1, c.t / 4) - 1.5 * Math.max(0, c.t - 4); }
  while (CORPSES.length && CORPSES[0].t >= 5) CORPSES.shift().rig.dispose();
}
function clearZombies() { clearHazards(); for (const c of CORPSES) c.rig.dispose(); CORPSES.length = 0; for (const zb of G.zombies) { zb.rig.dispose(); if (zb.teleMesh) scene.remove(zb.teleMesh); } G.zombies = []; WAVE.queue = []; WAVE.active = false; WAVE.boss = null; }

// home run victim crashing down flattens whoever is near
function homerunLand(zb) {
  ring(zb.x, zb.z, 2.4, 0xffc080, .3); dust(zb.x, zb.z, 20); shake(.4); AU.play('hitHardest', {vol: .9, rate: .8, x: zb.x, z: zb.z}); HAPTIC.fx('slam', .6);
  for (const o of G.zombies) if (o !== zb && !o.dying && o.state !== 'rise' && Math.hypot(o.x - zb.x, o.z - zb.z) < 2.4) damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 2 + UP.dmg, {w: weapon(), kind: 'homerun', kb: 9});
}
// frozen zombies break into ice
function shatterZombie(zb, dir) {
  zb.rig.root.visible = false;
  const ice = new THREE.MeshStandardMaterial({color: 0xbff4ff, emissive: 0x2a6a8a, roughness: .1, metalness: .3, transparent: true, opacity: .85});
  for (let i = 0; i < 9; i++) { const s = rnd(.1, .26), m = new THREE.Mesh(new THREE.OctahedronGeometry(s), ice); m.castShadow = true; const a = dir + rnd(-1.4, 1.4), sp = rnd(2, 7); gib(zb.x, zb.z, m, Math.cos(a) * sp, Math.sin(a) * sp, rnd(3, 8), rnd(1.2, 2)); }
  burst(zb.x, zb.z, 30, ['#ffffff', '#cff6ff', '#8fe8ff'], 8, .12, .8, 1); ring(zb.x, zb.z, 2, 0x8fe8ff, .3);
  AU.play('glass', {vol: 1, x: zb.x, z: zb.z, rate: rnd(.9, 1.2)}); hitstop(.05);
  if (zb.shatterHurt) { ring(zb.x, zb.z, 2.8, 0xcff6ff, .3); for (const o of G.zombies) if (o !== zb && !o.dying && o.state !== 'rise' && Math.hypot(o.x - zb.x, o.z - zb.z) < 2.8) { damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 2 + UP.dmg, {w: weapon(), kind: 'shatter'}); o.slow = 2; o.slowF = .35; } }
}
