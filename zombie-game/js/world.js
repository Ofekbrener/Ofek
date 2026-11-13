// World: night street arena built from the Quaternius kit, lights, rain, colliders, explosive barrels, pickups.
'use strict';
const WORLD = {lamps: [], rain: null, spawnPoints: [[0, -23], [0, 23], [-23, 0], [23, 0]]};

function buildLights() {
  WORLD.hemi = new THREE.HemisphereLight(0x5a6aa0, 0x120e0a, .32); scene.add(WORLD.hemi);
  const moon = new THREE.DirectionalLight(0x8fa6ff, .75);
  const sm = LOW_GPU || HUD.touch || DPR > 1.5 ? 1024 : 2048; moon.castShadow = true; moon.shadow.mapSize.set(sm, sm);
  Object.assign(moon.shadow.camera, {left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60});
  moon.shadow.bias = -.0005; moon.shadow.normalBias = .03; scene.add(moon, moon.target); WORLD.moon = moon;
}
function place(name, x, z, rot = 0, s = 1) {
  const m = propClone(name); m.position.set(x, 0, z); m.rotation.y = rot; m.scale.setScalar(s); (WORLD.layer || scene).add(m); G.props.push(m); return m;
}
const addToLayer = o => { (WORLD.layer || scene).add(o); return o; };
// axis-aligned box collider from a placed prop's bounds
function solid(m, pad = 0) {
  m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m);
  G.colliders.push({x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, hw: (b.max.x - b.min.x) / 2 + pad, hd: (b.max.z - b.min.z) / 2 + pad});
}
// The ground, moon and rain stay for the whole game. Each area swaps the layer of props, lamps and barrels on top.
function buildArena() {
  buildLights();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({color: 0x141318, roughness: .95}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; ground.receiveShadow = true; scene.add(ground); WORLD.ground = ground;
  buildRain(); buildLayout(0);
}
function clearLayout() {
  if (WORLD.layer) scene.remove(WORLD.layer);
  WORLD.layer = null; G.props = []; G.colliders = []; G.barrels = []; WORLD.lamps = []; G.bounds = null; WORLD.water = null; WORLD.gate = null;
  WORLD.spawnPoints = [[0, -23], [0, 23], [-23, 0], [23, 0]];
}
function buildLayout(i) {
  clearLayout(); const A = AREAS[i]; WORLD.built = i;
  WORLD.layer = new THREE.Group(); scene.add(WORLD.layer);
  WORLD.barrelSpots = null;
  if (A.layout && LAYOUTS[A.layout]) WORLD.barrelSpots = LAYOUTS[A.layout](A); else { layoutStreet(A); if (A.dress) A.dress(A); }
  resetBarrels(); applyAreaLook(A);
}
function resetBarrels() {
  for (const b of G.barrels) if (b.m.parent) b.m.parent.remove(b.m);
  G.barrels = []; for (const [x, z] of (WORLD.barrelSpots || AREAS[WORLD.built].barrels || BARRELS)) addBarrel(x, z);
}
const BARRELS = [[-6, -3], [6.5, 3.5], [-3, 9.5], [3.5, -10], [-12, 4], [12, -3]];
// the crossroads block every area is built on; areas pick the street tiles, cover and edge walls
function layoutStreet(A) {
  const slab = new THREE.MeshStandardMaterial({color: A.slab || 0x24222a, roughness: .9});
  for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(15.6, .14, 15.6), slab); s.position.set(x, .06, z); s.receiveShadow = true; addToLayer(s);
  }
  place('Street_4Way', 0, 0);
  for (const d of [8, 16, 24]) {
    const v = d === 16 ? 'Street_Straight_Crack1' : d === 24 ? 'Street_Straight_Crack2' : 'Street_Straight';
    place(v, 0, d); place(v, 0, -d, Math.PI); place(v, d, 0, Math.PI / 2); place(v, -d, 0, -Math.PI / 2);
  }
  for (const [x, z, r] of A.lamps || [[-4.6, -4.6, Math.PI * .25], [4.6, 4.6, Math.PI * 1.25], [4.6, -4.6, -Math.PI * .25], [-4.6, 4.6, Math.PI * .75]]) {
    place('StreetLights', x, z, r);
    const l = new THREE.PointLight(A.lampCol || 0xffa25a, A.lampI || 3.2, 16, 1.6); l.position.set(x + Math.sin(r) * 2.2, 5.6, z + Math.cos(r) * 2.2); addToLayer(l); WORLD.lamps.push(l);
  }
  for (const [n, x, z, r, pad] of A.cover) solid(place(n, x, z, r), pad || 0);
  for (const [n, x, z, r] of A.decor) place(n, x, z, r);
  for (const [n, x, z, r] of A.edge) place(n, x, z, r);
}
// a flat sign with painted text, used for area landmarks
function signPlane(lines, w, h, {bg = '#e8e8e8', fg = '#b01010', x = 0, y = 3, z = 0, rot = 0, glow = 0} = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = c.height / (lines.length + .6); g.font = `bold ${fs}px Oswald, Impact, sans-serif`;
  lines.forEach((t, i) => g.fillText(t, c.width / 2, c.height * (i + 1) / (lines.length + 1)));
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: tex, roughness: .7, emissive: new THREE.Color(glow ? 0xffffff : 0), emissiveMap: glow ? tex : null, emissiveIntensity: glow, side: THREE.DoubleSide}));
  m.position.set(x, y, z); m.rotation.y = rot; addToLayer(m); return m;
}
// lights, fog and rain for an area
function applyAreaLook(A) {
  const L = A.look; WORLD.hemi.color.setHex(L.sky); WORLD.hemi.groundColor.setHex(L.ground); WORLD.hemi.intensity = L.hemiI;
  WORLD.moon.color.setHex(L.moon); WORLD.moon.intensity = L.moonI;
  scene.background.setHex(L.fog); scene.fog.color.setHex(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  renderer.toneMappingExposure = L.exposure || .9; WORLD.ground.material.color.setHex(L.groundCol || 0x141318);
  if (WORLD.rain) WORLD.rain.m.visible = !!A.rain; WORLD.raining = !!A.rain;
}
function addBarrel(x, z) {
  const m = place('Barrel', x, z, rnd(0, 6));
  m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0); } });
  const b = {m, x, z, r: .45, hp: 1, fuse: -1, dead: false};
  G.barrels.push(b);
}
// circle vs AABB push-out, used by the player and zombies
function collide(e, r) {
  for (const c of G.colliders) {
    const px = clamp(e.x, c.x - c.hw, c.x + c.hw), pz = clamp(e.z, c.z - c.hd, c.z + c.hd);
    const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-4) { e.x = px + dx / d * r; e.z = pz + dz / d * r; }
      else { // center inside the box: push out along the shallow axis
        const ox = c.hw - Math.abs(e.x - c.x), oz = c.hd - Math.abs(e.z - c.z);
        if (ox < oz) e.x = c.x + Math.sign(e.x - c.x || 1) * (c.hw + r); else e.z = c.z + Math.sign(e.z - c.z || 1) * (c.hd + r);
      }
    }
  }
  for (const b of G.barrels) if (!b.dead) { const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz); if (d < r + b.r && d > 1e-4) { e.x = b.x + dx / d * (r + b.r); e.z = b.z + dz / d * (r + b.r); } }
}
function inArena(e, r) { clampToBounds(e, r); }

function hitBarrel(b) { if (b.dead || b.fuse >= 0) return; b.fuse = .18; for (const o of [b.m]) o.traverse(x => { if (x.isMesh) x.material.emissive.setRGB(1, .4, 0); }); }
function explodeAt(x, z, radius, dmgZ, dmgP, src) {
  if (src === 'barrel') TUT.event('barrel');
  AU.play('explosion', {vol: 1, x, z, max: 4}); AU.play('glass', {vol: .6, x, z}); AU.play('metalDrop', {vol: .7, x, z, delay: .1});
  burst(x, z, 40, ['#ff9a1a', '#ffcf3a', '#ff4a10', '#2a2626', '#444'], 12, .22, 1.1, .6);
  burst(x, z, 16, ['#555', '#333'], 4, .35, 1.6, .3);
  ring(x, z, radius, 0xff9a40, .4); ring(x, z, radius * .6, 0xffffff, .25);
  boom(x, z); shake(.6); hitstop(.07); AU.duck(.3, .5);
  if (G.player) { const pd = Math.hypot(G.player.x - x, G.player.z - z); if (pd < 16) HAPTIC.fx('explosion', clamp(1.2 - pd / 16, .3, 1)); }
  const sc = new THREE.Mesh(new THREE.CircleGeometry(radius * .45, 20), new THREE.MeshBasicMaterial({color: 0x050505, transparent: true, opacity: .7, depthWrite: false}));
  sc.rotation.x = -Math.PI / 2; sc.position.set(x, .025, z); scene.add(sc); FX.decals.push({m: sc, grow: 1, t: 1});
  for (const zb of G.zombies) if (!zb.dying) { const d = Math.hypot(zb.x - x, zb.z - z); if (d < radius) damageZombie(zb, Math.atan2(zb.z - z, zb.x - x), dmgZ, {blast: true, src}); }
  const p = G.player; if (p && dmgP && Math.hypot(p.x - x, p.z - z) < radius * .75) hurtPlayer(dmgP, x, z);
  for (const b of G.barrels) if (!b.dead && b.fuse < 0 && Math.hypot(b.x - x, b.z - z) < radius) hitBarrel(b); // chain reactions
}
function updateBarrels(dt) {
  for (const b of G.barrels) if (!b.dead && b.fuse >= 0) {
    b.fuse -= dt; if (b.fuse < 0) { b.dead = true; if (b.m.parent) b.m.parent.remove(b.m); explodeAt(b.x, b.z, 3.4, 4, 1, 'barrel'); }
  }
}

// ---------- rain ----------
function buildRain() {
  const N = 900, pos = new Float32Array(N * 6), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: 0x9fb3d9, transparent: true, opacity: .35}));
  m.frustumCulled = false; scene.add(m); WORLD.rain = {m, pos, N, drops: Array.from({length: N}, () => ({x: rnd(-22, 22), y: rnd(0, 16), z: rnd(-22, 22), v: rnd(16, 22)}))};
}
function updateRain(dt) {
  if (WORLD.water) { WORLD.water.offset.x += dt * .015; WORLD.water.offset.y += dt * .006; }
  const R = WORLD.rain; if (!R || !WORLD.raining) return; const cx = G.cam.x, cz = G.cam.z;
  for (let i = 0; i < R.N; i++) {
    const d = R.drops[i]; d.y -= d.v * dt; if (d.y < 0) { d.y = rnd(10, 16); d.x = cx + rnd(-22, 22); d.z = cz + rnd(-22, 22); if (Math.random() < .08) addPart({x: d.x, y: .05, z: d.z, vx: 0, vz: 0, vy: 1.2, g: 9, life: .15, max: .15, size: .05, col: '#8fa3c8', drag: 1, rx: 0, ry: 0}); }
    R.pos[i * 6] = d.x; R.pos[i * 6 + 1] = d.y; R.pos[i * 6 + 2] = d.z; R.pos[i * 6 + 3] = d.x + .04; R.pos[i * 6 + 4] = d.y + .55; R.pos[i * 6 + 5] = d.z + .02;
  }
  R.m.geometry.attributes.position.needsUpdate = true;
}

// ---------- pickups ----------
const PICK_GEO = {coin: new THREE.CylinderGeometry(.18, .18, .05, 16), heart: new THREE.OctahedronGeometry(.24), rage: new THREE.IcosahedronGeometry(.26), gem: new THREE.OctahedronGeometry(.22)};
const PICK_MAT = {coin: new THREE.MeshStandardMaterial({color: 0xffc83a, metalness: .9, roughness: .25, emissive: 0x3a2500}),
  heart: new THREE.MeshStandardMaterial({color: 0xff3048, emissive: 0x801020, roughness: .3}),
  rage: new THREE.MeshStandardMaterial({color: 0xff7a1a, emissive: 0xc04000, roughness: .3}),
  gem: new THREE.MeshStandardMaterial({color: 0x30e070, emissive: 0x0a8a3a, metalness: .3, roughness: .1})};
function dropPickup(type, x, z) {
  const m = new THREE.Mesh(PICK_GEO[type], PICK_MAT[type]); m.castShadow = true; if (type === 'coin') m.rotation.x = Math.PI / 2;
  const a = rnd(0, 7), s = rnd(1.5, 3.5);
  if (type === 'gem') { m.scale.set(1, 1.5, 1); const l = new THREE.PointLight(0x30ff80, 1.5, 3); m.add(l); AU.play('levelUp', {vol: .4, rate: 1.6}); }
  m.position.set(x, .6, z); scene.add(m); G.pickups.push({type, m, x, z, y: .6, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rnd(4, 6), t: 0, life: type === 'gem' ? 30 : 14});
}
function updatePickups(dt) {
  const p = G.player;
  for (const k of G.pickups) {
    k.t += dt; k.life -= dt;
    k.x += k.vx * dt; k.z += k.vz * dt; k.y += k.vy * dt; k.vy -= 18 * dt; if (k.y < .45) { k.y = .45; k.vy = Math.abs(k.vy) > 2 ? -k.vy * .4 : 0; k.vx *= .8; k.vz *= .8; }
    inArena(k, .3); collide(k, .3);
    const dx = p.x - k.x, dz = p.z - k.z, d = Math.hypot(dx, dz), mag = UP.magnet ? 4.5 : 2;
    if (d < mag && k.t > .35) { const s = (mag - d) * 6 + 4; k.x += dx / d * s * dt; k.z += dz / d * s * dt; }
    if (d < .7 && k.t > .25) { collectPickup(k); k.life = -1; }
    k.m.position.set(k.x, k.y + Math.sin(k.t * 4) * .08, k.z); k.m.rotation.y += dt * 4;
    if (k.type === 'gem' && Math.random() < .3) addPart({x: k.x + rnd(-.2, .2), y: k.y + rnd(0, .4), z: k.z + rnd(-.2, .2), vx: 0, vz: 0, vy: .8, g: 0, life: .5, max: .5, size: .05, col: '#b8ffd0', drag: 1, rx: 0, ry: 0});
    k.m.visible = k.life > 3 || Math.floor(k.life * 8) % 2 === 0;
  }
  for (const k of G.pickups) if (k.life <= 0) scene.remove(k.m);
  G.pickups = G.pickups.filter(k => k.life > 0);
}
function collectPickup(k) {
  const p = G.player; flyPickup(k.type, k.x, k.z);
  if (k.type === 'gem') { addGems(1); G.runGems = (G.runGems || 0) + 1; popText(p.x, p.z, '+1 EMERALD', '#30e070', 32, 2.8); AU.play('levelUp', {vol: .7, rate: 1.4}); HAPTIC.fx('card'); ring(p.x, p.z, 1.8, 0x30e070, .4); }
  if (k.type === 'coin') { G.coins++; G.runCoins = (G.runCoins || 0) + 1; G.score += 5; AU.play('coin', {vol: .5, rate: rnd(.95, 1.15), max: 4}); }
  if (k.type === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 1); AU.play('heart', {vol: .7}); HAPTIC.fx('heart'); popText(p.x, p.z, '+1 ♥', '#ff5a6a', 28); ring(p.x, p.z, 1.6, 0xff4060, .3); }
  if (k.type === 'rage') { POW.add(50); AU.play('rage', {vol: .8}); popText(p.x, p.z, '+50 FURY', '#ff7a1a', 36, 2.6); ring(p.x, p.z, 3, 0xff7a1a, .4); slowmo(.3); }
}
function clearPickups() { for (const k of G.pickups) scene.remove(k.m); G.pickups = []; }
