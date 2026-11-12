// Juice: hitstop, screen shake, particles, blood decals, shockwave rings, floating text, light flashes, lightning.
// Units are meters. See .claude/skills/game-feel/SKILL.md for the numbers and why.
'use strict';
const FX = {parts: [], rings: [], texts: [], bolts: [], decals: [], gibs: []};
const MAXP = 1200, dummy = new THREE.Object3D(), colCache = {};
const COL = c => colCache[c] || (colCache[c] = new THREE.Color(c));
const partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}), MAXP);
for (let i = 0; i < MAXP; i++) partMesh.setColorAt(i, COL('#ffffff'));
partMesh.frustumCulled = false; scene.add(partMesh);
const ringGeo = new THREE.RingGeometry(.88, 1, 48); ringGeo.rotateX(-Math.PI / 2);
const hitLight = new THREE.PointLight(0xffd890, 0, 7, 2); scene.add(hitLight);
const boomLight = new THREE.PointLight(0xff9a40, 0, 12, 2); scene.add(boomLight);

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
function ring(x, z, r, col, life = .3, y = .05) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  m.position.set(x, y, z); scene.add(m); FX.rings.push({m, r, life, t: 0});
}
// Blood puddles use the kit's own decal meshes, recolored green.
const bloodMat = new THREE.MeshStandardMaterial({color: 0x173d14, roughness: .25, metalness: .2, transparent: true, opacity: .88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
function blood(x, z, s = 1) {
  const m = propClone(pick(['Blood_1', 'Blood_2', 'Blood_3']));
  m.traverse(o => { if (o.isMesh) { o.material = bloodMat; o.castShadow = false; } });
  m.position.set(x + rnd(-.3, .3), .02 + FX.decals.length % 7 * .001, z + rnd(-.3, .3)); m.rotation.y = rnd(0, 7);
  m.scale.setScalar(s * rnd(.7, 1.2) * .01); scene.add(m); FX.decals.push({m, grow: s * rnd(.7, 1.2) * .32, t: 0});
  if (FX.decals.length > 70) scene.remove(FX.decals.shift().m);
}
function popText(x, z, txt, col, size = 26, y = 2.3) { FX.texts.push({x, y, z, txt, col, size, t: 0, off: 0, vy: -90}); }
function flashLight(x, z, col, i = 4) { hitLight.color.setHex(col); hitLight.position.set(x, 1.3, z); hitLight.intensity = Math.max(hitLight.intensity, i); }
function boom(x, z, col = 0xff9a40, i = 9) { boomLight.color.setHex(col); boomLight.position.set(x, 1.5, z); boomLight.intensity = i; }
function bolt(x1, z1, x2, z2) {
  const pts = [], n = 9;
  for (let i = 0; i <= n; i++) { const k = i / n, j = i && i < n ? 1 : 0; pts.push(new THREE.Vector3(lerp(x1, x2, k) + rnd(-.3, .3) * j, 1.2 + rnd(-.3, .3) * j, lerp(z1, z2, k) + rnd(-.3, .3) * j)); }
  const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: 0xcff0ff, transparent: true, blending: THREE.AdditiveBlending}));
  scene.add(m); FX.bolts.push({m, t: 0, life: .18});
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
  for (const r of FX.rings) if (r.t >= r.life) scene.remove(r.m);
  FX.rings = FX.rings.filter(r => r.t < r.life);
  for (const b of FX.bolts) { b.t += dt; b.m.material.opacity = 1 - b.t / b.life; }
  for (const b of FX.bolts) if (b.t >= b.life) scene.remove(b.m);
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
  for (const g of FX.gibs) if (g.life <= 0) scene.remove(g.m);
  FX.gibs = FX.gibs.filter(g => g.life > 0);
  hitLight.intensity *= Math.pow(.0005, dt); boomLight.intensity *= Math.pow(.004, dt);
}
function renderFX() {
  let n = 0;
  for (const p of FX.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    dummy.position.set(p.x, p.y, p.z);
    if (p.streak) { const len = Math.hypot(p.vx, p.vz) * .035; dummy.rotation.set(0, -Math.atan2(p.vz, p.vx), 0); dummy.scale.set(Math.max(.06, len), .03, .03); }
    else { dummy.rotation.set(p.rx, p.ry, 0); const s = p.size * (.4 + .6 * a); dummy.scale.set(s, s, s); }
    dummy.updateMatrix(); partMesh.setMatrixAt(n, dummy.matrix); partMesh.setColorAt(n, COL(p.col)); n++;
  }
  partMesh.count = n; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  for (const r of FX.rings) { const k = r.t / r.life, e = easeOutCubic(k); r.m.scale.setScalar(.1 + (r.r - .1) * e); r.m.material.opacity = (1 - k) * .7; }
}
function clearFX() {
  for (const r of FX.rings) scene.remove(r.m); for (const b of FX.bolts) scene.remove(b.m);
  for (const d of FX.decals) scene.remove(d.m); for (const g of FX.gibs) scene.remove(g.m);
  FX.parts = []; FX.rings = []; FX.bolts = []; FX.decals = []; FX.gibs = []; FX.texts = [];
}
