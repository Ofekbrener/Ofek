// Juice: hitstop, screen shake, particles, blood decals, shockwave rings, floating text, light flashes, lightning.
// Units are meters. See .claude/skills/game-feel/SKILL.md for the numbers and why.
'use strict';
const FX = {parts: [], rings: [], texts: [], bolts: [], decals: [], gibs: [], fires: [], clouds: []};
const MAXP = 1200, dummy = new THREE.Object3D(), colCache = {};
const COL = c => colCache[c] || (colCache[c] = new THREE.Color(c));
const cssCache = {}, CSS = c => cssCache[c] || (cssCache[c] = '#' + COL(c).getHexString()); // '#rrggbb' for a hex number, cached
const partMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.7, 0), new THREE.MeshBasicMaterial({color: 0xffffff}), MAXP);
for (let i = 0; i < MAXP; i++) partMesh.setColorAt(i, COL('#ffffff'));
partMesh.frustumCulled = false; scene.add(partMesh);
const ringGeo = new THREE.RingGeometry(.88, 1, 48); ringGeo.rotateX(-Math.PI / 2);
const hitLight = new THREE.PointLight(0xffd890, 0, 7, 2); scene.add(hitLight);
const boomLight = new THREE.PointLight(0xff9a40, 0, 12, 2); scene.add(boomLight);

// free the GPU buffers of a one-off object (gibs, acid pools) when it leaves the scene; shared geometry is flagged keep
function disposeTree(o) { scene.remove(o); o.traverse(m => { if (m.isMesh) { if (!m.geometry.userData.keep) m.geometry.dispose(); if (!m.material.userData.keep) m.material.dispose(); } }); }
const SCORCH_GEO = new THREE.CircleGeometry(.45, 12), SCORCH_MAT = new THREE.MeshBasicMaterial({color: 0x0a0503, transparent: true, opacity: .6, depthWrite: false});
SCORCH_GEO.userData.keep = SCORCH_MAT.userData.keep = true;
function shake(a) { G.trauma = Math.min(1, G.trauma + a); }
function hitstop(t) { G.hitstop = Math.max(G.hitstop, t); }
function slowmo(t) { G.slowT = Math.max(G.slowT, t); }
function addPart(p) { if (FX.parts.length < MAXP) FX.parts.push(p); }
// chunks pop up, fall with gravity and bounce on the floor
function burst(x, z, n, cols, speed = 6, size = .12, life = .6, y = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 7), s = rnd(.3, 1) * speed;
    addPart({x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rnd(2, 8) * speed / 7, g: 22, life: rnd(.6, 1) * life, max: life,
      size: rnd(.5, 1) * size, col: Array.isArray(cols) ? pick(cols) : cols, drag: .93, rx: rnd(0, 6), ry: rnd(0, 6)});
  }
}
function sparks(x, z, dir, n, col = '#fff6c8') {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(-.8, .8), s = rnd(9, 20);
    addPart({x, y: rnd(.8, 1.4), z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rnd(-1, 4), g: 0, life: rnd(.1, .22), max: .22, size: .05, col, drag: .85, streak: 1});
  }
}
function dust(x, z, n = 10, col = '#6b6470') { burst(x, z, n, col, 3, .16, .5, .1); }
// shockwave rings come from a fixed pool of 16 meshes (each with its own material); the oldest is reused when all are busy
const RING_POOL = [], ARC_GEO = {};
for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending})); m.visible = false; scene.add(m); RING_POOL.push(m); }
function ringMesh(geo) {
  let m = RING_POOL.find(o => !o.visible);
  if (!m) { const r = FX.rings.shift(); m = r.m; }
  m.geometry = geo; m.rotation.set(0, 0, 0); m.visible = true; return m;
}
function ring(x, z, r, col, life = .3, y = .05) {
  const m = ringMesh(ringGeo); m.material.color.set(col); m.position.set(x, y, z); FX.rings.push({m, r, life, t: 0});
}
// a partial ring that expands in one direction (guitar power chord); geometry cached per arc width (0.1 rad steps)
function arcWave(x, z, dir, r, arc, col, life = .35) {
  const key = Math.round(arc * 10); let g = ARC_GEO[key];
  if (!g) { const a = key / 10; g = ARC_GEO[key] = new THREE.RingGeometry(.82, 1, 32, 1, -a, a * 2); g.rotateX(-Math.PI / 2); }
  const m = ringMesh(g); m.material.color.set(col); m.position.set(x, .6, z); m.rotation.y = -dir; FX.rings.push({m, r, life, t: 0});
}
function notes(x, z, n) { for (let i = 0; i < n; i++) addPart({x: x + rnd(-.4, .4), y: rnd(1.2, 2), z: z + rnd(-.4, .4), vx: rnd(-1.5, 1.5), vz: rnd(-1.5, 1.5), vy: rnd(1.5, 3.5), g: -1, life: .9, max: .9, size: rnd(.08, .14), col: pick(['#e0a0ff', '#ff7ae0', '#9a7aff', '#ffffff']), drag: .95, rx: 0, ry: 0}); }
// Blood puddles use the kit's own decal meshes, recolored green.
const bloodMat = new THREE.MeshStandardMaterial({color: 0x173d14, roughness: .25, metalness: .2, transparent: true, opacity: .88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
function blood(x, z, s = 1) {
  const m = propClone(pick(['Blood_1', 'Blood_2', 'Blood_3']));
  m.traverse(o => { if (o.isMesh) { o.material = bloodMat; o.castShadow = false; } });
  m.position.set(x + rnd(-.3, .3), .02 + FX.decals.length % 7 * .001, z + rnd(-.3, .3)); m.rotation.y = rnd(0, 7);
  m.scale.setScalar(s * rnd(.7, 1.2) * .01); scene.add(m); FX.decals.push({m, grow: s * rnd(.7, 1.2) * .32, t: 0});
  if (FX.decals.length > 70) scene.remove(FX.decals.shift().m);
}
// floating text starts 0.6 m above its nominal height so it clears the head of whoever it belongs to
function popText(x, z, txt, col, size = 26, y = 2.3) { const o = {x, y: y + .6, z, txt, col, size, t: 0, off: 0, vy: -90, dmg: false}; FX.texts.push(o); return o; }
function flashLight(x, z, col, i = 4) { hitLight.color.setHex(col); hitLight.position.set(x, 1.3, z); hitLight.intensity = Math.max(hitLight.intensity, i); }
function boom(x, z, col = 0xff9a40, i = 9) { boomLight.color.setHex(col); boomLight.position.set(x, 1.5, z); boomLight.intensity = i; }
// lightning: 8 pooled lines with 10 points each, rewritten in place
const BOLT_POOL = [];
for (let i = 0; i < 8; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
  const m = new THREE.Line(g, new THREE.LineBasicMaterial({color: 0xcff0ff, transparent: true, blending: THREE.AdditiveBlending})); m.frustumCulled = false; m.visible = false; scene.add(m); BOLT_POOL.push(m); }
function bolt(x1, z1, x2, z2) {
  let m = BOLT_POOL.find(o => !o.visible); if (!m) { m = FX.bolts.shift().m; }
  const a = m.geometry.attributes.position, n = 9;
  for (let i = 0; i <= n; i++) { const k = i / n, j = i && i < n ? 1 : 0; a.setXYZ(i, lerp(x1, x2, k) + rnd(-.3, .3) * j, 1.2 + rnd(-.3, .3) * j, lerp(z1, z2, k) + rnd(-.3, .3) * j); }
  a.needsUpdate = true; m.visible = true; FX.bolts.push({m, t: 0, life: .18});
}
// A body part that flies, spins and bounces (heads, chunks of a gibbed zombie).
function gib(x, z, mesh, vx, vz, vy, life = 2.2) {
  mesh.position.set(x, 1.2, z); scene.add(mesh);
  FX.gibs.push({m: mesh, vx, vz, vy, rx: rnd(-12, 12), rz: rnd(-12, 12), life});
}

function updateFX(dt) {
  for (const p of FX.parts) {
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= p.g * dt;
    if (p.y < .02) { p.y = .02; p.vy *= -.35; p.vx *= .6; p.vz *= .6; }
    const k = Math.pow(p.drag, dt * 60); p.vx *= k; p.vz *= k; p.rx += dt * 8; p.life -= dt;
  }
  FX.parts = FX.parts.filter(p => p.life > 0);
  for (const r of FX.rings) r.t += dt;
  for (const r of FX.rings) if (r.t >= r.life) r.m.visible = false;
  FX.rings = FX.rings.filter(r => r.t < r.life);
  for (const b of FX.bolts) { b.t += dt; b.m.material.opacity = 1 - b.t / b.life; }
  for (const b of FX.bolts) if (b.t >= b.life) b.m.visible = false;
  FX.bolts = FX.bolts.filter(b => b.t < b.life);
  for (const t of FX.texts) { t.t += dt; t.off += t.vy * dt; t.vy *= .92; }
  FX.texts = FX.texts.filter(t => t.t < (t.size > 50 ? 1.3 : .9));
  for (const d of FX.decals) if (d.t < 1) { d.t = Math.min(1, d.t + dt * 2.5); d.m.scale.setScalar(d.grow * easeOutCubic(d.t)); }
  for (const g of FX.gibs) {
    g.m.position.x += g.vx * dt; g.m.position.z += g.vz * dt; g.m.position.y += g.vy * dt; g.vy -= 24 * dt;
    if (g.m.position.y < .15) { g.m.position.y = .15; g.vy *= -.4; g.vx *= .6; g.vz *= .6; g.rx *= .6; g.rz *= .6; if (Math.abs(g.vy) > 2) blood(g.m.position.x, g.m.position.z, .4); }
    g.m.rotation.x += g.rx * dt; g.m.rotation.z += g.rz * dt; g.life -= dt;
    if (g.m.position.y > .3 && Math.random() < .4) addPart({x: g.m.position.x, y: g.m.position.y, z: g.m.position.z, vx: 0, vz: 0, vy: 0, g: 18, life: .4, max: .4, size: .07, col: '#3f9a35', drag: .9, rx: 0, ry: 0});
  }
  for (const g of FX.gibs) if (g.life <= 0) disposeTree(g.m);
  FX.gibs = FX.gibs.filter(g => g.life > 0);
  // ground fire: flames, scorch, sets zombies standing in it on fire
  for (const f of FX.fires) {
    if (f.delay > 0) { f.delay -= dt; continue; }
    if (!f.lit) { f.lit = true; const sc = new THREE.Mesh(SCORCH_GEO, SCORCH_MAT); sc.rotation.x = -Math.PI / 2; sc.position.set(f.x, .03, f.z); scene.add(sc); FX.decals.push({m: sc, grow: 1, t: 1}); burst(f.x, f.z, 6, ['#ff8a1a', '#ffcf3a'], 4, .14, .5, .2); }
    f.life -= dt;
    for (let i = 0; i < 2; i++) addPart({x: f.x + rnd(-.35, .35), y: rnd(.05, .4), z: f.z + rnd(-.35, .35), vx: rnd(-.3, .3), vz: rnd(-.3, .3), vy: rnd(1.5, 4), g: -2, life: rnd(.3, .6), max: .6, size: rnd(.1, .22), col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10', '#ff6a1a']), drag: .9, rx: 0, ry: 0});
    for (const zb of G.zombies) if (!zb.dying && zb.state !== 'rise' && Math.hypot(zb.x - f.x, zb.z - f.z) < .8) zb.burn = Math.max(zb.burn, 3);
  }
  FX.fires = FX.fires.filter(f => f.life > 0);
  // poison clouds: green haze, 1 damage per second to zombies inside, optional slow
  for (const c of FX.clouds) {
    c.life -= dt; c.tick -= dt;
    for (let i = 0; i < 2; i++) { const a = rnd(0, 7), r = rnd(0, c.r); addPart({x: c.x + Math.cos(a) * r, y: rnd(.1, 1), z: c.z + Math.sin(a) * r, vx: rnd(-.2, .2), vz: rnd(-.2, .2), vy: rnd(.2, .6), g: 0, life: .9, max: .9, size: rnd(.15, .3), col: pick(['#7adf3a', '#4aa020', '#a8ff5a']), drag: .98, rx: 0, ry: 0}); }
    for (const zb of G.zombies) if (!zb.dying && zb.state !== 'rise' && Math.hypot(zb.x - c.x, zb.z - c.z) < c.r) { if (cloudCheck(c, zb)) break; if (c.slow) zb.inCloud = .3; if (c.tick <= 0) damageZombie(zb, 0, 1, {dot: 'poison'}); }
    if (c.tick <= 0) c.tick = 1;
  }
  FX.clouds = FX.clouds.filter(c => c.life > 0);
  if (FX.fires.length) { const f = FX.fires[Math.floor(FX.fires.length / 2)]; if (!f.delay) { boomLight.color.setHex(0xff6a1a); boomLight.position.set(f.x, 1, f.z); boomLight.intensity = Math.max(boomLight.intensity, 3 + Math.random()); } }
  hitLight.intensity *= Math.pow(.0005, dt); boomLight.intensity *= Math.pow(.004, dt);
}
function renderFX() {
  let n = 0;
  for (const p of FX.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    dummy.position.set(p.x, p.y, p.z);
    if (p.streak) { const len = Math.hypot(p.vx, p.vz) * .035; dummy.rotation.set(0, -Math.atan2(p.vz, p.vx), 0); dummy.scale.set(Math.max(.06, len), .03, .03); }
    else { dummy.rotation.set(p.rx, p.ry, 0); const s = p.size * (p.fade ? a : .4 + .6 * a); dummy.scale.set(s, s, s); }
    dummy.updateMatrix(); partMesh.setMatrixAt(n, dummy.matrix); partMesh.setColorAt(n, COL(p.col)); n++;
  }
  partMesh.count = n; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  for (const r of FX.rings) { const k = r.t / r.life, e = easeOutCubic(k); r.m.scale.setScalar(.1 + (r.r - .1) * e); r.m.material.opacity = (1 - k) * .7; }
}
function clearFX() {
  for (const r of FX.rings) r.m.visible = false; for (const b of FX.bolts) b.m.visible = false;
  for (const d of FX.decals) scene.remove(d.m); for (const g of FX.gibs) disposeTree(g.m);
  FX.parts = []; FX.rings = []; FX.bolts = []; FX.decals = []; FX.gibs = []; FX.texts = []; FX.fires = []; FX.clouds = [];
}
