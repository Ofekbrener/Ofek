// The city map between districts, as a 3D miniature: each district is a small diorama built from the same kit,
// a glowing route links them, and a tiny copy of the survivor runs the next leg while the camera follows.
'use strict';
const MAP3D = {on: false, t: 0, next: 1, go: null, curve: null, legs: [], runner: null, card: false};
const MAP_SPOTS = [[-26, 12], [-11, 3], [3, 11], [16, -3], [27, -15]];
const DIST_COL = [0xff4040, 0x6aff8a, 0xff9a40, 0xffc890, 0xffffff];
const mini = (name, x, z, r = 0, s = .32) => { const m = place(name, x, z, r, s); return m; };
function mapLabel(text, x, y, z, col = '#ffffff', size = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.font = 'bold 64px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(text, 256, 64); g.fillStyle = col; g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthTest: false, transparent: true})); s.scale.set(8 * size, 2 * size, 1); s.position.set(x, y, z); s.renderOrder = 10; addToLayer(s); (MAP3D.labels || (MAP3D.labels = [])).push(s); return s;
}
// a flat ribbon along a curve (the river and the roads)
function ribbon(curve, width, y, material, n = 120) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const p = curve.getPoint(i / n), t = curve.getTangent(i / n), nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
    pos.push(p.x + nx / l * width / 2, y, p.z + nz / l * width / 2, p.x - nx / l * width / 2, y, p.z - nz / l * width / 2); if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.receiveShadow = true; addToLayer(m); return m;
}
// the five dioramas
const DIORAMA = [
  (x, z) => { block(x, z - 3, 7, 2.4, 2.8, {tex: () => TEX.windows(.5, '#c8ccd2'), collide: false, roof: 0x3a3e44}); signPlane(['ER'], 1.2, .5, {bg: '#c01818', fg: '#fff', x, y: 1.4, z: z - 1.75, glow: 1});
    for (const dx of [-2.4, -.8, .8, 2.4]) mini(pick(['Vehicle_Sports', 'Vehicle_Pickup']), x + dx, z + .6, 0, .28); mini('StreetLights', x - 3.4, z + 1.8, 0, .3); },
  (x, z) => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; block(x + Math.cos(a) * 3.6, z + Math.sin(a) * 3.6, 1.6, 1.6, rnd(2.5, 4.5), {tex: () => TEX.windows(.25, '#262a30'), collide: false, roof: 0x16181c}); }
    signPlane(['SUBWAY'], 1.8, .45, {bg: '#0e3a1e', fg: '#9dffb4', x, y: .9, z, glow: 1.2}); },
  (x, z) => { for (const [dx, dz] of [[-2, -1], [-.4, 1.2], [1.6, -.8], [-2, 1.3]]) mini(pick(['Container_Red', 'Container_Green']), x + dx, z + dz, rnd(0, .3), .3);
    const yel = 0xe0a020; for (const dx of [2.6, 3.6]) block(x + dx, z + 1.6, .2, .2, 4, {col: yel, collide: false}); block(x + 3.1, z + .6, .3, 3, .3, {col: yel, y: 4, collide: false}); },
  (x, z) => { block(x, z, 9, 2.6, .1, {col: 0x2c2c30, collide: false}); for (let dx = -4; dx <= 4; dx += 1.4) block(x + dx, z, .6, .08, .02, {col: 0xe8e4d0, y: .1, collide: false});
    mini('Vehicle_Truck_Armored', x - 1.5, z - .4, Math.PI / 2, .3); mini('Vehicle_Sports', x + 2, z + .5, 1.8, .28); block(x - 3, z, 1, 3.4, 1.8, {col: 0x8a8680, collide: false, y: 0}); },
  (x, z) => { block(x, z - 2.4, 10, .8, 3.6, {tex: () => TEX.concrete('#7a7a7e'), collide: false}); block(x, z - 2.5, 2.2, .9, 3, {col: 0x3a3e44, collide: false});
    for (const dx of [-4.4, 4.4]) { block(x + dx, z - 1.2, .25, .25, 4.5, {col: 0x5a5a5e, collide: false}); spot(x + dx, z - 1.2, x, z + 2, 0xffffff, 2, 5); } mini('WaterTower', x - 3, z + 1.8, 0, .3); },
];
MAP3D.show = function (next, go) {
  G.player.rig.root.visible = false; MAP3D.labels = []; MAP3D.next = next; MAP3D.go = go; MAP3D.t = 0; MAP3D.card = false; MAP3D.on = true; G.state = 'travel';
  clearZombies(); clearPickups(); clearFX(); clearTrail(); clearGear(); RADIO.clear();
  clearLayout(); WORLD.layer = new THREE.Group(); scene.add(WORLD.layer); WORLD.built = -1;
  // night over the city
  WORLD.hemi.color.setHex(0x4a5a80); WORLD.hemi.groundColor.setHex(0x0a0806); WORLD.hemi.intensity = .45; WORLD.moon.color.setHex(0x9fb4ff); WORLD.moon.intensity = .6;
  scene.background.setHex(0x05070c); scene.fog.color.setHex(0x05070c); scene.fog.near = 60; scene.fog.far = 140; WORLD.raining = false; if (WORLD.rain) WORLD.rain.m.visible = false;
  WORLD.ground.material.color.setHex(0x161814);
  floor(140, 100, () => TEX.concrete('#23251f'), 20, 14, 0, 0, .01);
  // city blocks everywhere, low and dark
  for (let x = -44; x <= 44; x += 6) for (let z = -32; z <= 32; z += 6) { if (MAP_SPOTS.some(([a, b]) => Math.hypot(a - x, b - z) < 7.5) || Math.abs(z - (-.35 * x - 2)) < 5) continue; if (Math.random() < .55) block(x + rnd(-1, 1), z + rnd(-1, 1), rnd(2, 4), rnd(2, 4), rnd(.6, 3.2), {tex: () => TEX.windows(.12, '#202328'), collide: false, roof: 0x121418, cast: false}); }
  // the river and the roads
  const river = new THREE.CatmullRomCurve3([[-60, 0, 2], [-30, 0, -6], [-8, 0, 16], [10, 0, 2], [30, 0, -8], [60, 0, 6]].map(p => new THREE.Vector3(...p)));
  const wt = TEX.water(); wt.repeat.set(30, 2); WORLD.water = wt; ribbon(river, 6, .05, new THREE.MeshStandardMaterial({map: wt, color: 0x4a7a9a, emissive: 0x0c2838, emissiveMap: wt, roughness: .3}));
  MAP3D.curve = new THREE.CatmullRomCurve3(MAP_SPOTS.map(([x, z]) => new THREE.Vector3(x, .3, z)), false, 'catmullrom', .3);
  ribbon(MAP3D.curve, 1.6, .04, new THREE.MeshStandardMaterial({color: 0x34342e, roughness: 1}));
  // the wall across the far end
  block(27, -21, 34, 1.2, 3, {tex: () => TEX.concrete('#6a6a6e'), collide: false});
  // dioramas, lit when reached, dark and fogged when not
  AREAS.forEach((A, i) => { const [x, z] = MAP_SPOTS[i], st = i < next ? 'done' : i === next ? 'next' : 'lock';
    DIORAMA[i](x, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.8, .3, 40), new THREE.MeshStandardMaterial({color: st === 'lock' ? 0x1a1a1a : 0x2a2a26, roughness: .9})); base.position.set(x, .12, z); base.receiveShadow = true; addToLayer(base);
    if (st !== 'lock') lampLight(x, z, DIST_COL[i], st === 'next' ? 5 : 3, 6, 18);
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.1, 48), new THREE.MeshBasicMaterial({color: st === 'done' ? 0x4fdc62 : st === 'next' ? 0xffcc33 : 0x444444, transparent: true, opacity: .85, side: THREE.DoubleSide})); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .3, z); addToLayer(ring);
    if (st === 'next') MAP3D.pulse = ring;
    if (st === 'lock') { const fog = new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({color: 0x0a0a0c, transparent: true, opacity: .72})); fog.position.set(x, .2, z); addToLayer(fog); mapLabel('?', x, 4, z, '#888', 1.2); }
    mapLabel((i + 1) + '  ' + A.short.toUpperCase(), x, st === 'lock' ? 7.2 : 6.5, z + 1, st === 'done' ? '#7dff8a' : st === 'next' ? '#ffcc33' : '#9a9a9a', .9);
    if (st === 'done') mapLabel('✓ CLEARED', x, 5, z + 1, '#7dff8a', .55);
  });
  // the route: done in red, the next leg grows as the survivor runs it
  const tube = (t0, t1, col, op) => { const pts = []; for (let i = 0; i <= 40; i++) pts.push(MAP3D.curve.getPoint(t0 + (t1 - t0) * i / 40)); const c = new THREE.CatmullRomCurve3(pts);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 80, .28, 8), new THREE.MeshBasicMaterial({color: col, transparent: op < 1, opacity: op})); m.position.y = .15; addToLayer(m); return m; };
  const seg = 1 / (MAP_SPOTS.length - 1); MAP3D.t0 = (next - 1) * seg; MAP3D.t1 = next * seg;
  if (next > 1) tube(0, MAP3D.t0, 0xff3030, 1);
  tube(MAP3D.t1, 1, 0x555555, .5);
  MAP3D.leg = tube(MAP3D.t0, MAP3D.t1, 0xff3030, 1); MAP3D.leg.geometry.setDrawRange(0, 0);
  // the tiny survivor
  const r = new Rig('Characters_' + (MODELS['Characters_' + LOOK.char] ? LOOK.char : 'Matt'), {scale: .9}); applyLook(r, LOOK); r.play('Run', {fade: 0, speed: 1.3}); MAP3D.runner = r;
  MAP3D.glow = new THREE.PointLight(0xffcc33, 3, 8, 1.6); addToLayer(MAP3D.glow);
  const el = document.getElementById('citymap'); el.hidden = false; el.classList.add('m3d');
  const A = AREAS[next], B = BOSSES[A.boss];
  el.innerHTML = `<div class="m3head"><span>DAY 3 · ROUTE TO THE WALL</span><span>${G.kills} kills · ${G.score} pts</span></div>
    <div class="m3card" id="m3card"><div class="mnum">AREA ${next + 1} / ${AREAS.length}</div><div class="mnext">${A.name}</div><div class="mgoal">${A.goal}</div>
    <div class="mthreat">${A.newZombie ? `<span>NEW</span>${THREAT[A.newZombie]}` : ''}</div><div class="mthreat boss"><span>BOSS</span>${B.name}</div>
    <button id="mapGo" class="primary">${icon('map')}Travel</button></div><div class="m3tap" id="m3tap">tap to skip</div>`;
  el.onclick = e => { if (!e.target.closest('button') && MAP3D.t < 4) MAP3D.t = 4; };
  document.getElementById('mapGo').onclick = () => {
    MAP3D.finish(); AU.play('cardPick', {vol: .7}); const f = document.getElementById('fade'); f.classList.add('on');
    setTimeout(() => { f.classList.remove('on'); TRAVEL.play(next - 1, () => { f.classList.add('on'); setTimeout(() => { f.classList.remove('on'); go(); }, 500); }); }, 650);
  };
  AU.musicTo('music_calm'); AU.play('cardOpen', {vol: .7});
};
MAP3D.update = function (raw) {
  if (!MAP3D.on) return; MAP3D.t += raw; const t = MAP3D.t, run = clamp((t - 1.2) / 2.8, 0, 1), e = run * run * (3 - 2 * run);
  const u = lerp(MAP3D.t0, MAP3D.t1, e), p = MAP3D.curve.getPoint(u), tg = MAP3D.curve.getTangent(u), r = MAP3D.runner;
  r.root.position.set(p.x, .3, p.z); r.root.rotation.y = yawFor(Math.atan2(tg.z, tg.x)); if (run >= 1 && r.curName !== 'Idle') r.play('Idle', {fade: .3}); r.mixer.update(raw);
  MAP3D.glow.position.set(p.x, 2, p.z);
  const idx = MAP3D.leg.geometry.index.count; MAP3D.leg.geometry.setDrawRange(0, Math.floor(idx * e / 6) * 6);
  if (run > 0 && run < 1 && Math.random() < raw * 6) AU.play('step', {vol: .25});
  // labels fade out when the camera gets close, so they never fill the screen
  for (const l of MAP3D.labels) { const d = camera.position.distanceTo(l.position); l.material.opacity = clamp((d - 9) / 8, 0, 1); }
  if (MAP3D.pulse) MAP3D.pulse.scale.setScalar(1 + .06 * Math.sin(t * 5));
  if (WORLD.water) WORLD.water.offset.x += raw * .02;
  // camera: wide shot of the city, then chase the survivor, then settle over the next district
  const [nx, nz] = MAP_SPOTS[MAP3D.next], k1 = clamp(t / 1.2, 0, 1), k3 = clamp((t - 4) / 1.2, 0, 1);
  const wide = [0, 52, 40, 0, 0, -2], chase = [p.x - tg.x * 9, 9, p.z - tg.z * 9 + 6, p.x + tg.x * 4, .5, p.z + tg.z * 4], end = [nx + 9, 11, nz + 12, nx, .5, nz];
  const sm = k => k * k * (3 - 2 * k), cam = t < 1.2 ? wide.map((v, i) => lerp(v, chase[i], sm(k1))) : t < 4 ? chase : chase.map((v, i) => lerp(v, end[i], sm(k3)));
  camera.position.set(cam[0], cam[1], cam[2]); camera.lookAt(cam[3], cam[4], cam[5]);
  if (t > 4.4 && !MAP3D.card) { MAP3D.card = true; document.getElementById('m3card').classList.add('on'); document.getElementById('m3tap').style.display = 'none'; AU.play('waveStart', {vol: .5}); }
};
MAP3D.finish = function () {
  MAP3D.on = false; G.player.rig.root.visible = true; if (MAP3D.runner) { MAP3D.runner.dispose(); MAP3D.runner = null; }
  const el = document.getElementById('citymap'); el.hidden = true; el.classList.remove('m3d'); el.onclick = null;
};
