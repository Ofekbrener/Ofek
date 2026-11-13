// Gear: weapons that fight on their own. Each piece has levels 1 to 5; a run holds at most 4 pieces.
'use strict';
const GEAR = {
  blades: {name: 'ORBIT BLADES', icon: 'blades', text: l => `${l + 1} knives circle you and cut what they touch`},
  dog: {name: 'GUARD DOG', icon: 'dog', text: l => `a dog hunts the nearest zombie, bite ${1 + l} damage${l >= 5 ? ', 2 dogs' : ''}`},
  molotov: {name: 'MOLOTOV', icon: 'molotov', text: l => `a fire bottle every ${(4 - .4 * (l - 1)).toFixed(1)} s`},
  tesla: {name: 'TESLA COIL', icon: 'tesla', text: l => `lightning hits ${l} zombie${l > 1 ? 's' : ''} every ${(2.5 - .2 * (l - 1)).toFixed(1)} s`},
  pulse: {name: 'SHOCK PULSE', icon: 'pulse', text: l => `a ${(3 + .5 * (l - 1)).toFixed(1)} m blast every ${(5 - .3 * (l - 1)).toFixed(1)} s, ${l} damage`},
  drone: {name: 'TURRET DRONE', icon: 'drone', text: l => `a drone shoots ${(1 / (.8 / (1 + .15 * (l - 1)))).toFixed(1)} times a second, ${1 + Math.floor(l / 2)} damage`},
};
const GEAR_MAX = 4;
const GS = {blades: [], dogs: [], drone: null, cd: {}, bottles: [], bladeHit: new Map(), angle: 0};
const gearLvl = id => UP.gear[id] || 0;
function kitMesh(name) { let m = null; MODELS.Characters_Matt.scene.traverse(o => { if (o.isMesh && o.name === name) m = o; }); return m; }
function nearestTo(x, z, maxD, skip) {
  let best = null, bd = maxD; for (const zb of G.zombies) { if (zb.dying || zb.state === 'rise' || (zb.dummy && !SHOW.active) || (skip && skip.includes(zb))) continue; const d = Math.hypot(zb.x - x, zb.z - z); if (d < bd) { bd = d; best = zb; } } return best;
}
// rebuild the visible pieces after a level change or a resumed run
function buildGear() {
  clearGear();
  const nb = gearLvl('blades') ? gearLvl('blades') + 1 : 0, km = kitMesh('Knife');
  for (let i = 0; i < nb && km; i++) {
    const m = new THREE.Mesh(km.geometry, km.material.clone()); m.material.emissive = new THREE.Color(0x6fb8ff); m.material.emissiveIntensity = .6;
    const e = weaponEnds(km, .5), ax = e.tip.clone().sub(e.grip).normalize(); m.quaternion.setFromUnitVectors(ax, new THREE.Vector3(1, 0, 0));
    m.scale.setScalar(km.getWorldScale(new THREE.Vector3()).x * 1.6); m.castShadow = true;
    const g = new THREE.Group(); g.add(m); scene.add(g); GS.blades.push(g);
  }
  const nd = gearLvl('dog') ? (gearLvl('dog') >= 5 ? 2 : 1) : 0;
  if (nd) ensureModel('Characters_GermanShepherd').then(() => { for (let i = GS.dogs.length; i < nd; i++) { const r = new Rig('Characters_GermanShepherd', {scale: .9}); const P = G.player; GS.dogs.push({rig: r, x: P.x - 1 - i, z: P.z + 1, face: 0, state: 'follow', t: 0, target: null, bit: false}); r.play('Idle'); } });
  if (gearLvl('drone')) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(.18, 14, 10), new THREE.MeshStandardMaterial({color: 0x3a4050, metalness: .7, roughness: .3}));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({color: 0x5fe3ff})); eye.position.set(.15, 0, 0);
    for (const sx of [-1, 1]) { const rot = new THREE.Mesh(new THREE.BoxGeometry(.5, .015, .05), new THREE.MeshStandardMaterial({color: 0x222})); rot.position.set(0, .16, sx * .12); rot.name = 'rotor'; g.add(rot); }
    const pm = kitMesh('Pistol'); if (pm) { const gun = new THREE.Mesh(pm.geometry, pm.material); gun.scale.setScalar(pm.getWorldScale(new THREE.Vector3()).x * 1.2); gun.position.set(.05, -.18, 0); gun.rotation.y = -Math.PI / 2; g.add(gun); }
    g.add(body, eye); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); GS.drone = {g, a: 0};
  }
}
function clearGear() {
  for (const b of GS.blades) scene.remove(b); GS.blades = [];
  for (const d of GS.dogs) d.rig.dispose(); GS.dogs = [];
  if (GS.drone) scene.remove(GS.drone.g); GS.drone = null;
  for (const b of GS.bottles) scene.remove(b.m); GS.bottles = [];
}
const cdReady = (id, cd, dt) => { GS.cd[id] = (GS.cd[id] ?? cd * .5) - dt; if (GS.cd[id] <= 0) { GS.cd[id] = cd; return true; } return false; };
function gearHit(zb, dir, dmg, kind) { damageZombie(zb, dir, dmg, {w: weapon(), kind, kb: 3}); }

function updateGear(dt) {
  const P = G.player; if (!P || P.dead) return;
  // orbit blades
  const lb = gearLvl('blades');
  if (lb) {
    GS.angle += dt * (3 + lb * .6); const R = 2;
    GS.blades.forEach((g, i) => {
      const a = GS.angle + i / GS.blades.length * Math.PI * 2, x = P.x + Math.cos(a) * R, z = P.z + Math.sin(a) * R;
      g.position.set(x, 1, z); g.rotation.y = -a - Math.PI / 2;
      if (Math.random() < .3) addPart({x, y: 1, z, vx: 0, vz: 0, vy: 0, g: 0, life: .15, max: .15, size: .05, col: '#9fd8ff', drag: 1, rx: 0, ry: 0});
      for (const zb of G.zombies) {
        if (zb.dying || zb.state === 'rise') continue;
        if (Math.hypot(zb.x - x, zb.z - z) < zb.r + .35 && (GS.bladeHit.get(zb) || 0) < G.time) {
          GS.bladeHit.set(zb, G.time + .5); gearHit(zb, a + Math.PI / 2, 1 + Math.floor(lb / 2), 'blades');
          sparks(zb.x, zb.z, a + Math.PI / 2, 5, '#cfe8ff'); AU.play('hitKnife', {vol: .35, rate: 1.3, dur: .2, max: 3});
        }
      }
    });
  }
  // guard dogs
  const ld = gearLvl('dog');
  for (const d of GS.dogs) {
    d.t -= dt; const r = d.rig;
    if (!d.target || d.target.dying || d.target.gone) { d.target = nearestTo(P.x, P.z, 12); if (d.target && Math.random() < .3) AU.play('bark', {vol: .5, x: d.x, z: d.z, max: 1}); }
    const T = d.target;
    if (d.state === 'bite') {
      if (!d.bit && d.t < .25) { d.bit = true; if (T && !T.dying && Math.hypot(T.x - d.x, T.z - d.z) < 1.6) { gearHit(T, d.face, 1 + ld, 'dog'); AU.play('hitFlesh', {vol: .6, rate: 1.2, x: d.x, z: d.z}); burst(T.x, T.z, 6, ['#3f9a35', '#7a1f1f'], 4, .1, .5, .8); } }
      if (d.t <= 0) d.state = 'chase';
    } else if (T) {
      const dx = T.x - d.x, dz = T.z - d.z, dd = Math.hypot(dx, dz); d.face = Math.atan2(dz, dx);
      if (dd > 1.2) { d.x += dx / dd * 7.5 * dt; d.z += dz / dd * 7.5 * dt; r.play('Run', {fade: .15}); }
      else { d.state = 'bite'; d.bit = false; d.t = Math.max(.45, 1.1 - .12 * ld); r.play('Attack', {loop: false, restart: true, fade: .08, speed: 1.3}); }
    } else { // follow the player
      const tx = P.x - Math.cos(P.face) * 1.6, tz = P.z - Math.sin(P.face) * 1.6, dx = tx - d.x, dz = tz - d.z, dd = Math.hypot(dx, dz);
      if (dd > .6) { d.face = Math.atan2(dz, dx); const s = Math.min(8, dd * 3); d.x += dx / dd * s * dt; d.z += dz / dd * s * dt; r.play(s > 4 ? 'Run' : 'Walk', {fade: .2}); } else r.play('Idle', {fade: .3});
    }
    inArena(d, .4); collide(d, .4); r.mixer.update(dt); r.root.position.set(d.x, 0, d.z); r.root.rotation.y = yawFor(d.face);
  }
  // molotov
  const lm = gearLvl('molotov');
  if (lm && cdReady('molotov', 4 - .4 * (lm - 1), dt)) {
    const t = nearestTo(P.x, P.z, 10);
    if (t) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .3, 8), new THREE.MeshStandardMaterial({color: 0x4a7a3a, transparent: true, opacity: .85, emissive: 0x331100})); m.castShadow = true; scene.add(m);
      GS.bottles.push({m, x0: P.x, z0: P.z, x1: t.x + t.vx * .5, z1: t.z + t.vz * .5, t: 0, lvl: lm}); AU.play('swingLight', {vol: .6, rate: .9}); }
    else GS.cd.molotov = .2; // nobody in range: try again soon instead of waiting a full cooldown
  }
  for (const b of GS.bottles) {
    b.t += dt / .6; const k = Math.min(1, b.t); b.m.position.set(lerp(b.x0, b.x1, k), 1.2 + Math.sin(k * Math.PI) * 2.5, lerp(b.z0, b.z1, k)); b.m.rotation.z += dt * 14;
    addPart({x: b.m.position.x, y: b.m.position.y + .15, z: b.m.position.z, vx: 0, vz: 0, vy: 1, g: -1, life: .3, max: .3, size: .1, col: pick(['#ff8a1a', '#ffcf3a']), drag: .9, rx: 0, ry: 0});
    if (b.t >= 1) {
      disposeTree(b.m); const R = .8 + .25 * b.lvl, n = 5 + b.lvl;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; FX.fires.push({x: b.x1 + Math.cos(a) * R * rnd(.3, 1), z: b.z1 + Math.sin(a) * R * rnd(.3, 1), life: 3, delay: 0}); }
      FX.fires.push({x: b.x1, z: b.z1, life: 3, delay: 0});
      AU.play('glass', {vol: .8, x: b.x1, z: b.z1}); AU.play('rage', {vol: .5, rate: .7, x: b.x1, z: b.z1}); boom(b.x1, b.z1, 0xff6a1a, 6); shake(.15);
    }
  }
  GS.bottles = GS.bottles.filter(b => b.t < 1);
  // tesla coil
  const lt = gearLvl('tesla');
  if (lt && cdReady('tesla', 2.5 - .2 * (lt - 1), dt)) {
    const hit = []; for (let i = 0; i < lt; i++) { const t = nearestTo(P.x, P.z, 7, hit); if (!t) break; hit.push(t); }
    for (const t of hit) { bolt(P.x, P.z, t.x, t.z); gearHit(t, Math.atan2(t.z - P.z, t.x - P.x), 1 + Math.floor(lt / 2), 'tesla'); sparks(t.x, t.z, 0, 6, '#cff0ff'); }
    if (hit.length) { AU.play('hitMetal', {vol: .6, rate: 1.7, dur: .3}); flashLight(P.x, P.z, 0x8fd0ff, 5); }
  }
  // shock pulse
  const lp = gearLvl('pulse');
  if (lp && cdReady('pulse', 5 - .3 * (lp - 1), dt)) {
    const R = 3 + .5 * (lp - 1); ring(P.x, P.z, R, 0x9fffd0, .35); ring(P.x, P.z, R * .6, 0xffffff, .25); dust(P.x, P.z, 10);
    for (const zb of G.zombies) if (!zb.dying && zb.state !== 'rise' && Math.hypot(zb.x - P.x, zb.z - P.z) < R) damageZombie(zb, Math.atan2(zb.z - P.z, zb.x - P.x), lp, {w: weapon(), kind: 'pulse', kb: 10});
    AU.play('hitHardest', {vol: .6, rate: 1.3}); AU.play('explosion', {vol: .3, rate: 1.6}); shake(.15);
  }
  // turret drone
  const lr = gearLvl('drone');
  if (GS.drone) {
    const D = GS.drone; D.a += dt * 1.5; const x = P.x + Math.cos(D.a) * 1.1, z = P.z + Math.sin(D.a) * 1.1;
    D.g.position.set(x, 2.1 + Math.sin(G.time * 3) * .1, z); D.g.children.forEach(c => { if (c.name === 'rotor') c.rotation.y += dt * 40; });
    const t = nearestTo(x, z, 9); if (t) D.g.rotation.y = -Math.atan2(t.z - z, t.x - x);
    if (lr && cdReady('drone', .8 / (1 + .15 * (lr - 1)), dt) && t) {
      gearHit(t, Math.atan2(t.z - z, t.x - x), 1 + Math.floor(lr / 2), 'drone');
      for (let i = 0; i < 6; i++) { const k = i / 6; addPart({x: lerp(x, t.x, k), y: lerp(2, 1.1, k), z: lerp(z, t.z, k), vx: 0, vz: 0, vy: 0, g: 0, life: .08, max: .08, size: .06, col: '#fff3a0', drag: 1, rx: 0, ry: 0}); }
      flashLight(x, z, 0xfff3a0, 2.5); AU.play('hitKick', {vol: .35, rate: 2.2, dur: .12, max: 3}); AU.play('shell', {vol: .25, delay: .15, max: 2});
    }
  }
}
