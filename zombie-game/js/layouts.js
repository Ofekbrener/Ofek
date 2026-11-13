// District layouts: each area has its own shape (a parking lot, a round plaza, a narrow pier, a long highway, a walled yard),
// built from kit props plus simple boxes with painted canvas textures.
'use strict';
// ---------- painted textures ----------
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
const noise = (g, w, h, n, a, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4); } g.globalAlpha = 1; };
const TEX = {
  asphalt: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, w, h); noise(g, w, h, 900, .5, ['#3a3a40', '#1e1e22', '#45454a']); }),
  concrete: (base = '#5a5a5e') => canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, h, 700, .35, ['#6a6a70', '#46464a', '#77777c']); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }),
  planks: () => canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#5a4026', '#4e3720', '#634628', '#553b22'][i % 4]; g.fillRect(0, i * 32, w, 31); g.fillStyle = '#20160c'; g.fillRect(0, i * 32 + 30, w, 2); g.fillRect((i * 97) % w, i * 32, 2, 30); } noise(g, w, h, 500, .3, ['#2a1c10', '#7a5a38']); }),
  tiles: () => canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#3c4440' : '#48524c'; g.fillRect(x * 32, y * 32, 31, 31); } noise(g, w, h, 600, .4, ['#1c201e', '#5a645e']); }),
  water: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#0a1c26'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(120,170,200,${Math.random() * .25})`; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + 10 + Math.random() * 20, y); g.stroke(); } }),
  windows: (lit = .35, wall = '#3a3e48') => canvasTex(256, 256, (g, w, h) => { g.fillStyle = wall; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const on = Math.random() < lit; g.fillStyle = on ? (Math.random() < .5 ? '#ffd890' : '#cfe6ff') : '#161a22'; g.fillRect(x * 64 + 12, y * 64 + 14, 40, 34); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x * 64 + 31, y * 64 + 14, 2, 34); } noise(g, w, h, 300, .25, ['#000', '#666']); }),
  lot: () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, w, h); noise(g, w, h, 1500, .5, ['#3a3a40', '#1e1e22']); g.fillStyle = '#e8e4d0'; for (let i = 0; i <= 8; i++) { g.fillRect(i * 64 - 2, 0, 4, 150); g.fillRect(i * 64 - 2, h - 150, 4, 150); } }),
  road: () => canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#2c2c30'; g.fillRect(0, 0, w, h); noise(g, w, h, 1200, .5, ['#3c3c42', '#1c1c20']); g.fillStyle = '#f0e8c8'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 11, w, 5); g.fillStyle = '#e8e4d0'; for (let x = 0; x < w; x += 64) { g.fillRect(x, h / 3 - 2, 34, 4); g.fillRect(x, 2 * h / 3 - 2, 34, 4); } }),
  hazard: () => canvasTex(128, 32, (g, w, h) => { for (let x = -h; x < w; x += 24) { g.fillStyle = '#f2c400'; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.fill(); } }),
};
// ---------- building blocks ----------
const MATS = {};
const mat = (key, make) => MATS[key] || (MATS[key] = make());
function floor(w, d, tex, rx, ry, x = 0, z = 0, y = .02) {
  const t = tex(); t.repeat.set(rx, ry);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({map: t, roughness: .95})); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; addToLayer(m); return m;
}
// a box that blocks movement; optional painted sides
function block(x, z, w, d, h, {col = 0x55585e, tex = null, rep = 1, y = 0, solidPad = 0, roof = null, cast = true, collide = true} = {}) {
  const side = tex ? new THREE.MeshStandardMaterial({map: (() => { const t = tex(); t.repeat.set(Math.max(1, Math.round(w / 4 * rep)), Math.max(1, Math.round(h / 4 * rep))); return t; })(), roughness: .85}) : new THREE.MeshStandardMaterial({color: col, roughness: .85});
  const sideD = tex ? new THREE.MeshStandardMaterial({map: (() => { const t = tex(); t.repeat.set(Math.max(1, Math.round(d / 4 * rep)), Math.max(1, Math.round(h / 4 * rep))); return t; })(), roughness: .85}) : side;
  const top = new THREE.MeshStandardMaterial({color: roof ?? col, roughness: .9});
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideD, sideD, top, top, side, side]); m.position.set(x, y + h / 2, z); m.castShadow = cast; m.receiveShadow = true; addToLayer(m);
  if (collide) G.colliders.push({x, z, hw: w / 2 + solidPad, hd: d / 2 + solidPad});
  return m;
}
function cylinder(x, z, r, h, col, {collide = true, y = 0} = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), new THREE.MeshStandardMaterial({color: col, roughness: .7})); m.position.set(x, y + h / 2, z); m.castShadow = true; addToLayer(m);
  if (collide) G.colliders.push({x, z, hw: r * .8, hd: r * .8}); return m;
}
function lampLight(x, z, col, i, h = 5.6, dist = 16) { const l = new THREE.PointLight(col, i, dist, 1.6); l.position.set(x, h, z); addToLayer(l); WORLD.lamps.push(l); return l; }
function spot(x, z, tx, tz, col, i, h = 12) { const s = new THREE.SpotLight(col, i, 40, .5, .5, 1.2); s.position.set(x, h, z); s.target.position.set(tx, 0, tz); addToLayer(s); addToLayer(s.target); return s; }
const solidProp = (n, x, z, r = 0, pad = 0, s = 1) => { const m = place(n, x, z, r, s); solid(m, pad); return m; };

// ---------- 1. St. Mercy: a parking lot in front of the hospital ----------
function layoutMercy() {
  G.bounds = {type: 'rect', hw: 18, hd: 14};
  floor(44, 36, TEX.lot, 3, 1, 0, 0);
  // the hospital: a long lit building along the far side with the emergency entrance in the middle
  block(-11, -19.5, 16, 8, 9, {tex: () => TEX.windows(.45, '#c8ccd2'), roof: 0x3a3e44});
  block(11, -19.5, 16, 8, 9, {tex: () => TEX.windows(.45, '#c8ccd2'), roof: 0x3a3e44});
  block(0, -21, 6, 5, 6, {col: 0xb8bcc2});
  block(0, -17.6, 7.5, 1.2, .35, {col: 0xd8dade, y: 4, collide: false}); // canopy over the ER doors
  signPlane(['EMERGENCY'], 5, .9, {bg: '#c01818', fg: '#ffffff', x: 0, y: 4.9, z: -17, glow: 1});
  signPlane(['ST. MERCY HOSPITAL'], 12, 1.4, {bg: '#f2f2ee', fg: '#c01818', x: -11, y: 7.4, z: -15.45, glow: .4});
  signPlane(['+'], 2, 2, {bg: '#f4f4f4', fg: '#d01010', x: 11, y: 7.2, z: -15.45, glow: .5});
  lampLight(0, -15.5, 0xff4040, 2.5, 4, 10);
  // parked cars in three rows: the lot is cover
  const cars = ['Vehicle_Sports', 'Vehicle_Pickup'];
  for (const z of [-9.5, 9.5]) for (const x of [-13, -6.5, 6.5, 13]) if (Math.random() < .8) solidProp(pick(cars), x + rnd(-.4, .4), z, z < 0 ? 0 : Math.PI, -.1);
  solidProp('Vehicle_Pickup', -3, 1.5, Math.PI / 2 + .3, -.1); solidProp('Vehicle_Sports', 4.5, -2, -.4, -.1);
  // an ambulance-white truck at the ER doors
  const amb = place('Vehicle_Truck_Armored', 7, -14.5, Math.PI / 2); amb.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(0xf2f2f2); } }); solid(amb, -.2);
  for (const [x, z] of [[-17, -14], [17, -14], [-17, 14], [17, 14], [0, 14]]) { place('StreetLights', x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2); lampLight(x * .9, z * .9, 0xd8ecff, 2.6); }
  for (const [n, x, z, r] of [['TrafficCone_1', -1, -12, 0], ['TrafficCone_2', 1.2, -12.4, 1], ['TrashBag_1', -16, 3, 0], ['TrashBag_2', 16, -3, 1], ['FireHydrant', -16.5, -12, 0], ['Couch', 15.5, 4, -Math.PI / 2]]) place(n, x, z, r);
  // low walls along the sides and the street at the bottom
  for (const x of [-19.2, 19.2]) block(x, 0, .6, 28, .9, {col: 0x6a6e74});
  block(-11, 15.2, 14, .6, .9, {col: 0x6a6e74}); block(11, 15.2, 14, .6, .9, {col: 0x6a6e74});
  WORLD.spawnPoints = [[0, -16], [-2, 17], [2, 17], [-20, -6], [20, 6]];
  return [[-9, -4], [9, 4], [-12, 13], [12, -13], [0, 7]];
}
// ---------- 2. Subway Plaza: a round square around the station stairs ----------
function layoutSubway() {
  G.bounds = {type: 'circle', r: 16};
  const fl = floor(40, 40, TEX.tiles, 10, 10, 0, 0); fl.geometry = new THREE.CircleGeometry(17, 48); fl.material.map.repeat.set(9, 9);
  // the station entrance: a pit with railings in the middle, zombies climb out of it
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), new THREE.MeshBasicMaterial({color: 0x020302})); pit.rotation.x = -Math.PI / 2; pit.position.set(0, .03, 0); addToLayer(pit);
  for (let i = 0; i < 5; i++) block(0, -1 + i * .55, 4.6, .5, .05, {col: 0x2a302c, y: -.2 + i * .1, collide: false, cast: false});
  block(-2.6, 0, .12, 3.4, 1, {col: 0x9aa4a0, collide: false}); block(2.6, 0, .12, 3.4, 1, {col: 0x9aa4a0, collide: false}); block(0, -1.7, 5.3, .12, 1, {col: 0x9aa4a0, collide: false});
  G.colliders.push({x: 0, z: -.2, hw: 2.7, hd: 1.6});
  for (const x of [-3, 3]) { cylinder(x, 2.1, .09, 3.6, 0x203a28, {collide: false}); }
  signPlane(['SUBWAY'], 4.4, 1, {bg: '#0e3a1e', fg: '#9dffb4', x: 0, y: 3.4, z: 2.1, glow: 1.2});
  lampLight(0, 1, 0x6aff8a, 4, 3, 12);
  // a ring of columns holding up a broken arcade, kiosks and benches between them
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + .3, x = Math.cos(a) * 10.5, z = Math.sin(a) * 10.5; cylinder(x, z, .55, 4.2, 0x6a706c); block(x, z, 1.5, 1.5, .4, {col: 0x5a605c, y: 4.2, collide: false}); }
  for (const [x, z, r] of [[-6.5, 5.5, .8], [6.5, -5.5, -2.3], [-6, -6, 2.4], [6.8, 5.8, -.8]]) solidProp('Couch', x, z, r, -.15);
  block(-12.5, -6, 2.2, 2.2, 2.4, {col: 0x2c6a3a, roof: 0x1c3a24}); signPlane(['NEWS'], 1.6, .5, {bg: '#ffcc33', fg: '#111', x: -12.5, y: 2, z: -4.85});
  block(12.5, 6, 2.2, 2.2, 2.4, {col: 0x6a2c2c, roof: 0x3a1c1c});
  // tall dark buildings around the square
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, R = 21; const b = block(Math.cos(a) * R, Math.sin(a) * R, 8, 8, rnd(10, 18), {tex: () => TEX.windows(.18, '#262a30'), roof: 0x16181c, collide: false}); b.rotation.y = -a; }
  for (const [n, x, z, r] of [['TrashBag_1', -3, 8, 0], ['TrashBag_2', 4, -8.5, 1], ['TrashBag_1', 9, 2, 2], ['Pallet_Broken', -9, 1, .3], ['TrafficCone_2', 2, 6, 0]]) place(n, x, z, r);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; lampLight(Math.cos(a) * 13, Math.sin(a) * 13, 0x6aff8a, 2.2, 5, 13); }
  WORLD.spawnPoints = [[0, .2], [0, .2], [15, 0], [-15, 0], [0, -15], [0, 15]];
  return [[-4, 4], [4.5, -3.5], [-9, -8], [9, 8]];
}
// ---------- 3. The Docks: a long pier between black water ----------
function layoutDocks() {
  G.bounds = {type: 'rect', hw: 22, hd: 8};
  floor(48, 17, TEX.planks, 8, 3, 0, 0, .06);
  const w = TEX.water(); w.repeat.set(10, 10); WORLD.water = w;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({map: w, color: 0x5a8aaa, emissive: 0x0c2838, emissiveMap: w, roughness: .3, metalness: 0})); water.rotation.x = -Math.PI / 2; water.position.y = -.6; addToLayer(water);
  for (const z of [-8.6, 8.6]) { block(0, z, 48, .4, .3, {col: 0x3a2a1a, collide: false}); for (let x = -22; x <= 22; x += 4) cylinder(x, z, .22, .7, 0x2a2a2a, {collide: false}); }
  // container stacks make corridors along the pier
  const cont = (x, z, r, two) => { solidProp(pick(['Container_Red', 'Container_Green']), x, z, r, -.2); if (two) { const m = place(pick(['Container_Red', 'Container_Green']), x, z, r); m.position.y = 2.6; } };
  cont(-14, -4.5, 0, true); cont(-6, 4.5, 0, false); cont(4, -4.5, 0, true); cont(13, 4.2, 0, true); cont(-15, 5, 0, false);
  for (const [x, z] of [[-9, -1], [9, 1.5], [0, 5.5], [18, -3]]) solidProp('Pallet', x, z, rnd(0, 1), -.1);
  solidProp('Wheels_Stack', -2, -2.5, 0, -.1);
  // a harbor crane straddling the pier
  const yel = 0xe0a020; for (const x of [-1.5, 1.5]) for (const z of [-7.5, 7.5]) block(x + 8, z, .6, .6, 12, {col: yel, collide: Math.abs(z) < 8});
  block(8, 0, 3.6, 16, .8, {col: yel, y: 12, collide: false}); block(8, -10, 2, 12, .8, {col: yel, y: 12.6, collide: false});
  const hook = place('Container_Red', 8, -12); hook.position.y = 7; hook.scale.setScalar(.8);
  // a boat at the far end: the way across
  block(26, 0, 6, 4, 1.4, {col: 0xd8d0c0, y: -.5, collide: false}); block(25.5, 0, 2.2, 2.4, 1.6, {col: 0x2a3a4a, y: .9, collide: false});
  signPlane(['PIER 9'], 3.4, 1.2, {bg: '#20160e', fg: '#ffb060', x: -22.5, y: 2.4, z: 0, rot: Math.PI / 2, glow: .6});
  for (const x of [-18, -6, 6, 18]) { lampLight(x, -7, 0xff9a40, 3, 6, 14); lampLight(x, 7, 0xff9a40, 2.2, 6, 12); }
  WORLD.spawnPoints = [[-23, 0], [23, 0], [-10, -9], [10, 9], [0, -9], [-18, 9]];
  return [[-11, 3], [1, -1], [11, -2], [-3, 6.5], [16, 6]];
}
// ---------- 4. The Highway: a long road under an overpass ----------
function layoutHighway() {
  G.bounds = {type: 'rect', hw: 24, hd: 7.5};
  floor(60, 16, TEX.road, 4, 1, 0, 0, .03);
  floor(160, 160, () => TEX.concrete('#2a2622'), 30, 30, 0, 0, .01);
  // concrete barriers along both sides, with gaps the horde climbs through
  for (const z of [-8.3, 8.3]) for (let x = -24; x <= 24; x += 3.2) if (Math.abs(x) > 2 || z > 0) block(x, z, 2.9, .6, 1, {col: 0x8a8680, tex: () => TEX.concrete('#8a8680'), solidPad: .05});
  // the overpass: pillars across the road and a deck overhead
  for (const z of [-5.5, 0, 5.5]) cylinder(-6, z, .8, 7, 0x8a8680);
  block(-6, 0, 7, 22, 1.4, {col: 0x7a766e, y: 7, collide: false}); block(-6, -11.5, 7, .6, 1.2, {col: 0x6a665e, y: 8.4, collide: false});
  signPlane(['I-9 NORTH', 'QUARANTINE 2 MI'], 5, 2, {bg: '#0e5a2a', fg: '#ffffff', x: -6, y: 9.6, z: 3.5, rot: 0});
  // wrecks in the lanes
  for (const [n, x, z, r] of [['Vehicle_Sports', -16, -3.5, .4], ['Vehicle_Pickup', -12, 4, -2.6], ['Vehicle_Sports', 4, 2.5, 1.9], ['Vehicle_Truck_Armored', 14, -3.5, Math.PI / 2 + .2], ['Vehicle_Pickup', 20, 4, .3]]) solidProp(n, x, z, r, -.15);
  for (const [n, x, z, r] of [['TrafficCone_1', 0, -1, 0], ['TrafficCone_2', 1, 0, 0], ['TrafficCone_1', 2, 1, 0], ['TrafficBarrier_1', 9, 0, Math.PI / 2], ['Wheels_Stack', -20, 1, 0], ['TrashBag_2', 17, 0, 0]]) place(n, x, z, r);
  for (const x of [-20, -10, 0, 10, 20]) { place('StreetLights', x, -8.9, 0); lampLight(x, -6.6, 0xffc890, 1.8, 5.6, 14); }
  WORLD.spawnPoints = [[-25, -3], [-25, 3], [25, -3], [25, 3], [0, -9]];
  return [[-9, 4.5], [8, -5], [18, 1], [-20, -5]];
}
// ---------- 5. The Quarantine Wall: a floodlit yard under a giant gate ----------
function layoutWall() {
  G.bounds = {type: 'rect', hw: 18, hd: 13};
  floor(44, 34, () => TEX.concrete('#4a4a4e'), 8, 6, 0, 0, .02);
  // the wall and its gate
  block(-13, -17, 18, 3, 12, {tex: () => TEX.concrete('#7a7a7e'), rep: .6});
  block(13, -17, 18, 3, 12, {tex: () => TEX.concrete('#7a7a7e'), rep: .6});
  const gate = block(0, -17.5, 8, 1.2, 10, {col: 0x3a3e44}); gate.userData.gate = true; WORLD.gate = gate;
  const hz = TEX.hazard(); hz.repeat.set(4, 1); const stripe = new THREE.Mesh(new THREE.PlaneGeometry(8, .6), new THREE.MeshBasicMaterial({map: hz})); stripe.position.set(0, 1, -16.85); addToLayer(stripe);
  signPlane(['QUARANTINE ZONE', 'NO ENTRY'], 7, 2, {bg: '#f2c400', fg: '#111111', x: 0, y: 8, z: -16.85, glow: .4});
  // floodlight towers with real spotlights
  for (const x of [-16, 16]) { cylinder(x, -13.5, .35, 11, 0x5a5a5e); block(x, -13.5, 2.4, 1, .8, {col: 0xe8e8e8, y: 11, collide: false}); spot(x, -13.5, x * .2, 0, 0xffffff, 3.2, 11.5); }
  // sandbag walls, a watch tower and checkpoint barriers
  const bags = (x, z, w, d) => block(x, z, w, d, .9, {col: 0x8a7a58, roof: 0x9a8a68});
  bags(-9, -6, 5, .9); bags(9, -6, 5, .9); bags(-12, 4, .9, 5); bags(12, 4, .9, 5); bags(0, 7, 6, .9);
  solidProp('WaterTower', -14, 10, 0, -.4); solidProp('TrafficBarrier_1', -4, -10, 0, -.1); solidProp('TrafficBarrier_2', 4, -10, 0, -.1);
  for (const [n, x, z, r] of [['PlasticBarrier', -2, 2, 0], ['PlasticBarrier', 2, 2, 0], ['Pallet', 14, 10, 0], ['CinderBlock', 6, 11, 0], ['TrafficCone_1', -7, 0, 0], ['TrafficCone_2', 7, 0, 0]]) place(n, x, z, r);
  for (const x of [-18.5, 18.5]) block(x, 0, .6, 26, 1.6, {col: 0x5a5a5e});
  for (const [x, z] of [[-10, 10], [10, 10]]) lampLight(x, z, 0xffffff, 2.4, 6, 14);
  WORLD.spawnPoints = [[0, 15], [-12, 15], [12, 15], [-19, -2], [19, -2]];
  return [[-6, -3], [6, -3], [0, 10], [-15, -8], [15, -8]];
}
const LAYOUTS = {mercy: layoutMercy, subway: layoutSubway, docks: layoutDocks, highway: layoutHighway, wall: layoutWall};

// ---------- bounds: every area has its own shape ----------
function clampToBounds(e, r) {
  const B = G.bounds;
  if (!B || B.type === 'rect') { const hw = (B ? B.hw : G.arena) - r, hd = (B ? B.hd : G.arena) - r; e.x = clamp(e.x, -hw, hw); e.z = clamp(e.z, -hd, hd); return; }
  const d = Math.hypot(e.x, e.z), R = B.r - r; if (d > R) { e.x *= R / d; e.z *= R / d; }
}
function outOfBounds(x, z, m = 0) {
  const B = G.bounds; if (!B || B.type === 'rect') { const hw = B ? B.hw : G.arena, hd = B ? B.hd : G.arena; return Math.abs(x) > hw - m || Math.abs(z) > hd - m; }
  return Math.hypot(x, z) > B.r - m;
}
function boundsBox() { const B = G.bounds; return B && B.type === 'rect' ? {hw: B.hw, hd: B.hd} : {hw: B ? B.r * .7 : 17, hd: B ? B.r * .7 : 17}; }
