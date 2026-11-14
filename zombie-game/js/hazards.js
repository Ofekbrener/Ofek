// Area hazards: bloater acid pools, the harbor master's falling containers, the convoy's truck lanes.
'use strict';
const HZ = {acid: [], drops: [], lanes: []};
const hzMat = c => new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide});
function hzFloor(geo, col, x, z) { const m = new THREE.Mesh(geo, hzMat(col)); m.rotation.x = -Math.PI / 2; m.position.set(x, .045, z); scene.add(m); return m; }

// green acid: 1 damage per second to the survivor standing in it
function acidPool(x, z, r = 2, life = 5) {
  const m = hzFloor(new THREE.CircleGeometry(r, 32), 0x7dff3a, x, z); m.material.opacity = .45;
  HZ.acid.push({x, z, r, life, max: life, m, tick: 0});
  burst(x, z, 30, ['#9dff4a', '#5adf2a', '#c8ff8a'], 7, .2, .7, .8); AU.play('gore', {vol: .9, rate: .7}); AU.play('explosion', {vol: .4, rate: 1.6});
}
// a shadow grows where the container will land, then it drops
function dropContainer(x, z, delay = 0) {
  const sh = hzFloor(new THREE.CircleGeometry(2.1, 32), 0x000000, x, z); sh.material.opacity = 0; sh.scale.setScalar(.2);
  HZ.drops.push({x, z, t: -delay, tele: 1.3, sh, box: null});
}
// a red lane across the yard, then an armored truck drives through it
function truckLane(axis, pos, delay = 0, dir = 1, kind = 'truck') {
  const L = 44, w = 3.4, geo = new THREE.PlaneGeometry(axis === 'x' ? L : w, axis === 'x' ? w : L);
  const m = hzFloor(geo, 0xff2020, axis === 'x' ? 0 : pos, axis === 'x' ? pos : 0); m.material.opacity = 0;
  if (kind === 'stampede') m.material.color.setHex(0x9fd0a8);
  HZ.lanes.push({axis, pos, dir, t: -delay, tele: 1.4, m, truck: null, hit: false, w, kind});
}
function updateHazards(dt) {
  const P = G.player;
  for (const a of HZ.acid) {
    a.life -= dt; a.tick -= dt; a.m.material.opacity = .45 * Math.min(1, a.life / 1.2);
    if (Math.random() < .5) { const an = rnd(0, 7), r = rnd(0, a.r); addPart({x: a.x + Math.cos(an) * r, y: .05, z: a.z + Math.sin(an) * r, vx: 0, vz: 0, vy: rnd(.4, 1.2), g: 0, life: .6, max: .6, size: rnd(.06, .14), col: pick(['#9dff4a', '#d8ff9a']), drag: 1, rx: 0, ry: 0}); }
    if (a.tick <= 0 && Math.hypot(P.x - a.x, P.z - a.z) < a.r && P.y < .5) { a.tick = 1; if (hurtPlayer(7, a.x, a.z)) popText(P.x, P.z, 'ACID', '#9dff4a', 26, 2.6); }
    if (a.life <= 0) disposeTree(a.m);
  }
  HZ.acid = HZ.acid.filter(a => a.life > 0);
  for (const d of HZ.drops) {
    d.t += dt; if (d.t < 0) continue;
    if (!d.box) {
      const k = clamp(d.t / d.tele, 0, 1); d.sh.material.opacity = .15 + .45 * k; d.sh.scale.setScalar(.2 + .8 * k);
      if (d.t >= d.tele) { d.box = propClone(Math.random() < .5 ? 'Container_Red' : 'Container_Green'); d.box.scale.setScalar(.42); d.box.rotation.y = rnd(0, 3); d.box.position.set(d.x, 14, d.z); scene.add(d.box); d.vy = -30; }
    } else if (!d.landed) {
      d.box.position.y += d.vy * dt; d.vy -= 40 * dt;
      if (d.box.position.y <= 0) {
        d.box.position.y = 0; d.landed = true; d.end = d.t + 2.2; scene.remove(d.sh);
        shake(.7); hitstop(.06); dust(d.x, d.z, 26); ring(d.x, d.z, 2.6, 0xd8c8a8, .35); AU.play('hitMetal', {vol: 1, rate: .55}); AU.play('explosion', {vol: .6, rate: 1.2}); HAPTIC.fx('slam', .7);
        if (Math.hypot(P.x - d.x, P.z - d.z) < 2.3 && P.y < 1) hurtPlayer(25, d.x, d.z);
        for (const zb of G.zombies) if (!zb.dying && !zb.T.boss && zb.state !== 'rise' && Math.hypot(zb.x - d.x, zb.z - d.z) < 2.3) damageZombie(zb, Math.atan2(zb.z - d.z, zb.x - d.x), 6, {w: weapon(), kind: 'crush', kb: 10});
      }
    } else if (d.t > d.end) { d.box.position.y -= dt * 2; if (d.t > d.end + 1) { scene.remove(d.box); d.done = true; } }
  }
  HZ.drops = HZ.drops.filter(d => !d.done);
  for (const l of HZ.lanes) {
    l.t += dt; if (l.t < 0) continue;
    if (l.t < l.tele) { l.m.material.opacity = .15 + .3 * (.5 + .5 * Math.sin(l.t * 22)); continue; }
    if (!l.truck) {
      if (l.kind === 'stampede') { // a pack of runners in a tight column
        l.truck = new THREE.Group(); l.pack = []; for (let i = 0; i < 6; i++) { const r = new Rig('Zombie_Ribcage', {tint: 0xc8e8b0}); r.play('Run', {fade: 0, speed: 1.6}); r.cur.time = rnd(0, 1); l.truck.add(r.root); scene.remove(r.root); l.truck.add(r.root); r.root.position.set((i % 2 ? .7 : -.7), 0, -i * 1.3); l.pack.push(r); }
        scene.add(l.truck); AU.play('zAttack', {vol: 1, rate: 1.4}); AU.play('zGroan', {vol: .9, rate: 1.3, delay: .1});
      } else { l.truck = propClone('Vehicle_Truck_Armored'); scene.add(l.truck); AU.play('explosion', {vol: .5, rate: .5}); AU.play('bossEffort', {vol: .8, rate: .6, bus: 'voice'}); }
      l.s = -26 * l.dir; }
    if (l.pack) for (const r of l.pack) r.mixer.update(dt);
    l.s += l.dir * 34 * dt; const tx = l.axis === 'x' ? l.s : l.pos, tz = l.axis === 'x' ? l.pos : l.s;
    l.truck.position.set(tx, 0, tz); l.truck.rotation.y = l.axis === 'x' ? (l.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (l.dir > 0 ? 0 : Math.PI);
    if (Math.random() < .8) dust(tx, tz, 3);
    const along = l.axis === 'x' ? P.x - tx : P.z - tz, across = l.axis === 'x' ? P.z - l.pos : P.x - l.pos;
    const reach = l.kind === 'stampede' ? 4.5 : 2.4;
    if (!l.hit && Math.abs(along) < reach && Math.abs(across) < l.w / 2 + .3) { l.hit = true; hurtPlayer(l.kind === 'stampede' ? 15 : 30, tx, tz); shake(.8); }
    for (const zb of G.zombies) if (!zb.dying && !zb.T.boss && zb.state !== 'rise') { const za = l.axis === 'x' ? zb.x - tx : zb.z - tz, zc = l.axis === 'x' ? zb.z - l.pos : zb.x - l.pos; if (Math.abs(za) < 2.4 && Math.abs(zc) < l.w / 2 + .3) damageZombie(zb, l.axis === 'x' ? (l.dir > 0 ? 0 : Math.PI) : (l.dir > 0 ? Math.PI / 2 : -Math.PI / 2), 99, {w: weapon(), kind: 'truck', kb: 16}); }
    if (Math.abs(l.s) > 27) { scene.remove(l.truck); scene.remove(l.m); if (l.pack) for (const r of l.pack) r.mixer.stopAllAction(); l.done = true; }
  }
  HZ.lanes = HZ.lanes.filter(l => !l.done);
}
function clearHazards() {
  for (const a of HZ.acid) disposeTree(a.m);
  for (const d of HZ.drops) { scene.remove(d.sh); if (d.box) scene.remove(d.box); }
  for (const l of HZ.lanes) { scene.remove(l.m); if (l.truck) scene.remove(l.truck); if (l.pack) for (const r of l.pack) r.mixer.stopAllAction(); }
  HZ.acid = []; HZ.drops = []; HZ.lanes = [];
}
