// Automatic power-ups: a FURY meter fills from hits and kills; when full, a random power-up empowers the survivor for 7 s.
// LAST STAND fires once per wave when you drop to 1 heart. Every power-up has its own look, sound and haptic.
'use strict';
const POWERS = {
  frenzy: {name: 'FRENZY', desc: 'attacks 60% faster · finisher every 3rd hit', col: 0xff3b3b, css: '255,59,59', dur: 7},
  giant: {name: 'GIANT', desc: 'huge, unstoppable hits', col: 0xffc83a, css: '255,200,58', dur: 7},
  storm: {name: 'STORM BODY', desc: 'lightning strikes everything near you', col: 0x8fd0ff, css: '143,208,255', dur: 7},
  vampire: {name: 'VAMPIRE', desc: 'hits heal you', col: 0xb01848, css: '200,30,80', dur: 7},
  warp: {name: 'TIME WARP', desc: 'the horde slows to a crawl', col: 0x4f7bff, css: '80,120,255', dur: 7},
  laststand: {name: 'LAST STAND', desc: 'untouchable · double damage', col: 0xffe14a, css: '255,225,74', dur: 4},
};
const POW = {fury: 0, active: null, t: 0, last: '', lastStand: false, tick: 0, hits: 0, ring: null, scale: 1};
POW.is = id => POW.active === id;
POW.reset = () => { if (POW.active) POW.end(true); POW.fury = 0; POW.lastStand = false; };
POW.add = function (v) {
  if (POW.active || G.state !== 'playing' || (typeof TUT !== 'undefined' && TUT.active) || (typeof SHOW !== 'undefined' && SHOW.active)) return;
  POW.fury = clamp(POW.fury + v, 0, 100);
  if (POW.fury >= 100) { const ids = ['frenzy', 'giant', 'storm', 'vampire', 'warp'].filter(i => i !== POW.last); POW.start(pick(ids)); }
};
POW.onHits = n => POW.add(n);
POW.onKill = (multi) => POW.add(4 + (multi >= 2 ? multi * 3 : 0));
POW.onHurt = () => {
  POW.fury = Math.max(0, POW.fury - 20);
  const P = G.player; if (P.hp === 1 && !POW.lastStand && !P.dead) { POW.lastStand = true; setTimeout(() => { if (!P.dead && G.state === 'playing') POW.start('laststand'); }, 250); }
};
POW.start = function (id) {
  if (POW.active) POW.end(true);
  const p = POWERS[id], P = G.player; POW.active = id; POW.t = p.dur; POW.last = id; POW.fury = 0; POW.tick = 0; POW.hits = 0;
  slowmo(.3); G.flash = Math.max(G.flash, .35); shake(.4); HUD.banner(p.name, p.desc, '#' + new THREE.Color(p.col).getHexString());
  ring(P.x, P.z, 4, p.col, .5); ring(P.x, P.z, 2.4, 0xffffff, .3); boom(P.x, P.z, p.col, 7); HAPTIC.fx('boss');
  AU.duck(.25, .8); AU.play('levelUp', {vol: .7});
  if (id === 'frenzy') AU.play('rage', {vol: 1, rate: 1.2});
  if (id === 'giant') AU.play('bossEffort', {vol: 1, rate: 1.4, bus: 'voice'});
  if (id === 'storm') { AU.play('hitMetal', {vol: .9, rate: 1.6, dur: .4}); AU.play('rage', {vol: .6, rate: 1.6}); }
  if (id === 'vampire') AU.play('evilLaugh', {vol: .9, bus: 'voice'});
  if (id === 'warp') { AU.play('bossIntro', {vol: .9, dur: 2.5}); if (AU.musicSrc) AU.musicSrc.playbackRate.value = .7; }
  if (id === 'laststand') { slowmo(.6); AU.play('waveStart', {vol: .8}); }
  if (!POW.ring) { POW.ring = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending})); POW.ring.rotation.x = -Math.PI / 2; scene.add(POW.ring); }
  POW.ring.material.color.setHex(p.col); POW.ring.visible = true;
};
POW.end = function (silent) {
  const id = POW.active; if (!id) return; POW.active = null; if (POW.ring) POW.ring.visible = false;
  if (id === 'warp' && AU.musicSrc) AU.musicSrc.playbackRate.value = 1;
  if (!silent && G.player) { AU.play('swingWide', {vol: .8, rate: .55}); ring(G.player.x, G.player.z, 2, POWERS[id].col, .3); popText(G.player.x, G.player.z, POWERS[id].name + ' ENDS', '#cfd6ff', 22, 2.6); }
};
// multipliers read by combat and movement
POW.atkSpeed = () => POW.is('frenzy') ? 1.6 : 1;
POW.dmgMul = () => POW.is('laststand') ? 2 : POW.is('giant') ? 1.5 : 1;
POW.kbMul = () => POW.is('giant') ? 2 : 1;
POW.zombieTime = () => POW.is('warp') ? .4 : 1;
POW.safe = () => POW.is('laststand');
POW.onSwingHit = function (n) {
  if (POW.is('vampire')) { POW.hits += n; while (POW.hits >= 4) { POW.hits -= 4; const P = G.player; if (P.hp < P.maxHp) { P.hp++; AU.play('heart', {vol: .4, rate: 1.2}); popText(P.x, P.z, '+1 ♥', '#ff5a7a', 26, 2.8); for (let i = 0; i < 6; i++) addPart({x: P.x + rnd(-.4, .4), y: rnd(.8, 1.8), z: P.z + rnd(-.4, .4), vx: 0, vz: 0, vy: rnd(1.5, 3), g: -1, life: .8, max: .8, size: .1, col: '#ff3b5a', drag: .95, rx: 0, ry: 0}); } } }
  if (POW.is('giant')) shake(.12);
};
POW.update = function (dt) {
  const P = G.player; if (!P) return;
  const target = POW.is('giant') ? 1.4 : 1; POW.scale = lerp(POW.scale, target, damp(.001, dt)); P.rig.root.scale.setScalar(POW.scale);
  if (!POW.active) return;
  const p = POWERS[POW.active], c = '#' + new THREE.Color(p.col).getHexString();
  POW.t -= dt; POW.tick -= dt;
  // aura around the survivor
  for (let i = 0; i < 2; i++) { const a = rnd(0, 7), r = rnd(.4, .8) * POW.scale; addPart({x: P.x + Math.cos(a) * r, y: rnd(.1, 1.8) * POW.scale, z: P.z + Math.sin(a) * r, vx: 0, vz: 0, vy: rnd(.8, 2.2), g: -1, life: .5, max: .5, size: rnd(.06, .12), col: c, drag: .95, rx: 0, ry: 0}); }
  // shrinking ring under the feet shows time left
  const k = clamp(POW.t / p.dur, 0, 1); POW.ring.geometry.dispose(); POW.ring.geometry = new THREE.RingGeometry(1.05, 1.25, 40, 1, Math.PI / 2, Math.PI * 2 * k);
  POW.ring.position.set(P.x, .05, P.z); POW.ring.scale.setScalar(POW.scale);
  if (POW.is('storm') && POW.tick <= 0) {
    POW.tick = .5; let n = 0;
    for (const zb of G.zombies) { if (zb.dying || zb.state === 'rise' || n >= 2) continue; if (Math.hypot(zb.x - P.x, zb.z - P.z) < 5.5) { bolt(P.x, P.z, zb.x, zb.z); damageZombie(zb, Math.atan2(zb.z - P.z, zb.x - P.x), 1 + UP.dmg, {w: weapon(), kind: 'stormbody'}); n++; } }
    if (n) { AU.play('hitMetal', {vol: .5, rate: 1.7, dur: .25, max: 4}); flashLight(P.x, P.z, p.col, 5); }
  }
  if (POW.is('giant') && P.spd > 2 && Math.random() < dt * 4) { dust(P.x, P.z, 8); AU.play('land', {vol: .5, rate: .7}); shake(.05); }
  if (POW.is('warp') && Math.random() < .3) addPart({x: P.x + rnd(-6, 6), y: rnd(.2, 2), z: P.z + rnd(-6, 6), vx: 0, vz: 0, vy: .1, g: 0, life: 1, max: 1, size: .05, col: '#9fb8ff', drag: 1, rx: 0, ry: 0});
  if (POW.is('frenzy') && POW.tick <= 0) { POW.tick = .42; AU.play('hitKick', {vol: .35, rate: .55, dur: .2, max: 2}); } // heartbeat
  if (POW.t <= 0) POW.end();
};
