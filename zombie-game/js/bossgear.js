// Boss looks and signature moves: each boss wears its own gear (a gurney, a conductor's hat, a harbor hook,
// riot armor, Patient Zero's glow) and has one move nobody else has.
'use strict';
const gearMat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: .6}, o));
function modelHeight(rig) { const b = new THREE.Box3().setFromObject(rig.model); return (b.max.y - b.min.y) / rig.model.scale.y; }
// gear is added to the scaled model, so sizes are in the model's own units
const BOSS_GEAR = {
  gurney(rig, h) { const g = new THREE.Group(); const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, .1, .62), gearMat(0xf4f4f4)); top.position.y = .55; g.add(top);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.1, .06, .58), gearMat(0x9fd8e8)); sheet.position.y = .63; g.add(sheet);
    for (const [x, z] of [[-.55, -.25], [.55, -.25], [-.55, .25], [.55, .25]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .5), gearMat(0x9a9a9a, {metalness: .8})); l.position.set(x, .27, z); g.add(l); const w = new THREE.Mesh(new THREE.SphereGeometry(.05), gearMat(0x222222)); w.position.set(x, .04, z); g.add(w); }
    g.rotation.y = Math.PI / 2; g.scale.setScalar(.8); g.position.set(0, 0, .5); rig.model.add(g); },
  hat(rig, h) { const g = new THREE.Group(); const brim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .03, 20), gearMat(0x1a2a1e)); g.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.13, .14, .26, 20), gearMat(0x1a2a1e)); top.position.y = .14; g.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.141, .141, .05, 20), gearMat(0xd4a020, {metalness: .6})); band.position.y = .05; g.add(band);
    attachHead(rig, g, h, -.02);
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, .14, 10), gearMat(0xd4c060, {metalness: .9})); wh.rotation.x = Math.PI / 2; wh.position.set(.08, h * .78, .16); rig.model.add(wh); },
  hook(rig, h) { const hat = new THREE.Mesh(new THREE.ConeGeometry(.26, .2, 20), gearMat(0xffd020)); attachHead(rig, hat, h, .02);
    const hk = new THREE.Mesh(new THREE.TorusGeometry(.16, .035, 8, 20, Math.PI * 1.4), gearMat(0x8a8a90, {metalness: .9, roughness: .3})); hk.position.set(-.42, h * .45, .15); hk.rotation.set(0, 0, 1.2); rig.model.add(hk);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .5), gearMat(0x6a6a70, {metalness: .9})); ch.position.set(-.42, h * .45 + .3, .15); rig.model.add(ch); },
  riot(rig, h) { const hel = new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gearMat(0x1a2030, {metalness: .5, roughness: .3})); attachHead(rig, hel, h, -.12);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .02), gearMat(0x88aaff, {transparent: true, opacity: .6})); visor.position.set(0, -.04, .19); hel.add(visor);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(.85, 1.2, .07), gearMat(0x2c3a58, {metalness: .6, roughness: .35, transparent: true, opacity: .93})); sh.position.set(0, h * .52, .5); rig.model.add(sh);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.6, .2), new THREE.MeshBasicMaterial({color: 0xdfe6ff})); lab.position.set(0, .3, .04); sh.add(lab); },
  zero(rig, h) { const l = new THREE.PointLight(0xb070ff, 2.5, 6, 1.6); l.position.set(0, h * .7, .3); rig.model.add(l); rig.zeroLight = l;
    // infected skin and clothes: everything shifts toward a sick purple
    const pur = new THREE.Color(0x8a4ad0); for (const m of rig.mats) m.color.lerp(pur, .55); rig.zero = true; },
};
// put a piece on the head bone when the body has one, else on top of the model
function attachHead(rig, mesh, h, dy) {
  rig.model.add(mesh); mesh.position.set(0, h + dy, .02);
  const head = rig.bones.Head; if (!head) return;
  rig.root.updateMatrixWorld(true); head.attach(mesh); // attach keeps the world position, so it follows the head from here
}
function dressBoss(zb) { const BP = zb.prof, f = BOSS_GEAR[BP.gear]; if (f) f(zb.rig, modelHeight(zb.rig)); }

// ---------- signature moves ----------
// the harbor master's hook: a line toward you, then it yanks you in
function hookStart(zb, toP) {
  zb.hookDir = toP; zb.teleMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.1), teleMat); zb.teleMesh.rotation.x = -Math.PI / 2; scene.add(zb.teleMesh);
  zb.rig.play('Idle_Attack', {fade: .1}); AU.play('chains', {vol: .9}); AU.play('bossEffort', {vol: .8, bus: 'voice'});
}
function hookUpdate(zb, dt, toP) {
  const P = G.player;
  if (zb.st < 1) { zb.hookDir += angDiff(zb.hookDir, toP) * damp(.2, dt); zb.face = zb.hookDir; zb.teleMesh.position.set(zb.x + Math.cos(zb.hookDir) * 7, .05, zb.z + Math.sin(zb.hookDir) * 7); zb.teleMesh.rotation.z = -zb.hookDir; teleMat.opacity = .25 + .2 * Math.sin(zb.st * 30); return; }
  if (!zb.hooked) {
    zb.hooked = true; scene.remove(zb.teleMesh); zb.tele = false; zb.rig.play('Punch', {loop: false, restart: true, fade: .05}); AU.play('swingHeavy', {vol: 1, rate: .6});
    const dx = P.x - zb.x, dz = P.z - zb.z, along = dx * Math.cos(zb.hookDir) + dz * Math.sin(zb.hookDir), across = Math.abs(-dx * Math.sin(zb.hookDir) + dz * Math.cos(zb.hookDir));
    // a chain of sparks shows the hook flying out
    for (let i = 1; i < 14; i++) addPart({x: zb.x + Math.cos(zb.hookDir) * i, y: 1.2, z: zb.z + Math.sin(zb.hookDir) * i, vx: 0, vz: 0, vy: 0, g: 0, life: .25, max: .25, size: .12, col: '#c8c8d0', drag: 1, rx: 0, ry: 0});
    if (along > 0 && along < 14 && across < .9 && P.y < 1 && P.inv <= 0 && !POW.safe()) {
      P.vx = -Math.cos(zb.hookDir) * Math.min(26, along * 2.4); P.vz = -Math.sin(zb.hookDir) * Math.min(26, along * 2.4); P.hurtT = .35;
      popText(P.x, P.z, 'HOOKED!', '#ffc040', 34, 2.6); shake(.5); HAPTIC.fx('slam', .7); zb.bossCd = .2; zb.lastMove = 'hook'; zb.nextSlam = true;
    }
  }
  if (zb.st > 1.5) { zb.state = 'chase'; zb.hooked = false; if (zb.nextSlam) { zb.nextSlam = false; zb.bossCd = 0; zb.forceMove = 'slam'; } }
}
// Patient Zero vanishes in smoke and comes out behind you, already slamming
function blinkMove(zb) {
  const P = G.player; burst(zb.x, zb.z, 40, ['#6a3aa0', '#2a1040', '#b070ff'], 7, .3, 1, 1.4); AU.play('evilLaugh', {vol: .8, bus: 'voice'}); AU.play('swingWide', {vol: .8, rate: .5});
  const a = P.face + Math.PI + rnd(-.6, .6), q = {x: P.x + Math.cos(a) * 3.2, z: P.z + Math.sin(a) * 3.2}; clampToBounds(q, zb.r);
  zb.x = q.x; zb.z = q.z; burst(zb.x, zb.z, 40, ['#6a3aa0', '#b070ff'], 7, .3, 1, 1.4); flashLight(zb.x, zb.z, 0xb070ff, 8); ring(zb.x, zb.z, 2.5, 0xb070ff, .4);
  zb.bossCd = 0; zb.forceMove = 'slam'; zb.state = 'chase'; zb.tele = false; zb.quickSlam = true;
}
// the conductor's whistle: a stampede of runners down a red lane
function rushMove(zb) {
  const P = G.player, bb = boundsBox(), ax = bb.hw >= bb.hd ? 'x' : 'z', lim = (ax === 'x' ? bb.hd : bb.hw) - 1.5, p0 = ax === 'x' ? P.z : P.x;
  truckLane(ax, clamp(p0, -lim, lim), 0, Math.random() < .5 ? 1 : -1, 'stampede');
  if (zb.hp < zb.maxHp * .5) truckLane(ax, clamp(p0 + (p0 > 0 ? -4 : 4), -lim, lim), .8, Math.random() < .5 ? 1 : -1, 'stampede');
  zb.rig.play('Idle_Attack', {fade: .1}); AU.play('chains', {vol: .6, rate: 1.8}); popText(zb.x, zb.z, 'WHISTLE!', '#9fd0a8', 30, 4.5);
  for (let i = 0; i < 3; i++) AU.play('zAttack', {vol: .5, rate: 1.5 + i * .1, delay: .4 + i * .15, bus: 'voice'});
}
