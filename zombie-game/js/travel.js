// Travel cutscenes between districts: a short in-engine scene of the survivor on the way to the next area,
// letterboxed with a caption and a narrator line. Played after the city map, before the next area loads.
'use strict';
const TRAVEL = {on: false, t: 0, dur: 9, scene: null, done: null, extras: []};
const TRIPS = [
  // each trip is a chapter: a title, a short radio scene that moves the story, and a clue added to the case file
  {chapter: 'CHAPTER 2', text: 'Underground', dur: 14, build: tripStreets,
    lines: [{who: 'DOC', text: 'Keep the case cold and keep moving. The subway runs under the river.'}, {who: 'DOC', text: 'Three days ago I ran that hospital. Now I hide in a lab and talk to strangers on the radio.'}],
    clue: {n: 1, title: 'THE CURE', text: 'One vial in a cold case. Doc says the army can copy it and save the city.'}},
  {chapter: 'CHAPTER 3', text: 'The Notes', dur: 15, build: tripTunnel,
    lines: [{who: 'NOTE', text: 'LAB NOTE 14. Subject zero: Dr. M. Adler. Dose given to self. Symptoms expected in 9 days.'}, {who: 'DOC', text: 'You read my notes. They are old. They mean nothing. Get to the harbor.'}],
    clue: {n: 2, title: 'SUBJECT ZERO', text: 'Doc tested the virus on himself first. The outbreak started with him.'}},
  {chapter: 'CHAPTER 4', text: 'Two Voices', dur: 15, build: tripBoat,
    lines: [{who: 'ARMY', text: 'Survivor, this is the Wall. Adler started this. Do not give him the case.'}, {who: 'DOC', text: 'They will lock it in a vault while people die. Bring it to me. I can still fix this.'}],
    clue: {n: 3, title: 'TWO SIDES', text: 'The army wants the cure to save the city. Doc wants it to stay human.'}},
  {chapter: 'CHAPTER 5', text: 'The Wall', dur: 14, build: tripHighway,
    lines: [{who: 'DOC', text: 'My hands are shaking. I can hear them now. The dead.'}, {who: 'ARMY', text: 'Floodlights are on. We see you. One more push.'}],
    clue: {n: 4, title: 'THE CHOICE', text: 'One vial. Give it to the army and save the city, or give it to Doc and save the man who started it.'}},
];
// a zombie that only walks in a cutscene
function extraZombie(model, x, z, face, clip = 'Walk', speed = 1) {
  const r = new Rig(model, {scale: rnd(.93, 1.07)}); r.play(clip, {fade: 0, speed}); r.cur.time = rnd(0, 1);
  const e = {r, x, z, face, v: 0}; TRAVEL.extras.push(e); return e;
}
function tripStreets() {
  floor(120, 14, TEX.road, 8, 1, 30, 0, .03); floor(160, 160, () => TEX.concrete('#24242a'), 30, 30, 0, 0, .01);
  for (let x = -10; x < 80; x += 9) for (const z of [-11, 11]) block(x + rnd(-1, 1), z + (z < 0 ? -rnd(0, 2) : rnd(0, 2)), 8, 6, rnd(8, 16), {tex: () => TEX.windows(.15, '#2a2e36'), roof: 0x16181c, collide: false});
  for (let x = 0; x < 80; x += 14) { place('StreetLights', x, -6.5, 0); lampLight(x, -4.5, 0xffa25a, 2.4, 5.6, 14); }
  const car = place('Vehicle_Sports', 22, 3, .6); car.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(.35); } });
  TRAVEL.fire = {x: 22, z: 3}; place('Vehicle_Pickup', 48, -4.5, 2.6); place('TrashBag_1', 10, 5, 0); place('TrafficCone_1', 35, 1, 0); place('Barrel', 60, 4, 0);
  for (let i = 0; i < 6; i++) extraZombie(pick(['Zombie_Basic', 'Zombie_Chubby', 'Zombie_Ribcage']), -6 - i * 2.2, rnd(-3, 3), 0, 'Walk', 1.2);
  return {run: 7.5, end: 64, cam: (t, P) => [P.x - 4 + Math.min(t, 9) * .3, 3.2, P.z + 8, P.x + 3, 1, P.z]};
}
function tripTunnel() {
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 140, 24, 1, true), new THREE.MeshStandardMaterial({color: 0x2a302c, side: THREE.BackSide, roughness: .9}));
  tube.rotation.z = Math.PI / 2; tube.position.set(30, 2.5, 0); addToLayer(tube);
  floor(140, 6, TEX.tiles, 30, 1, 30, 0, .02);
  const wt = TEX.water(); wt.repeat.set(20, 2); WORLD.water = wt; const w = new THREE.Mesh(new THREE.PlaneGeometry(140, 12), new THREE.MeshStandardMaterial({map: wt, color: 0x66aa88, roughness: .1, metalness: .6, transparent: true, opacity: .7})); w.rotation.x = -Math.PI / 2; w.position.set(30, .12, 0); addToLayer(w);
  for (let x = -10; x < 80; x += 8) { lampLight(x, -4.5, 0x6aff8a, 2.6, 4.5, 10); block(x, -5, .4, .4, .3, {col: 0x9dffb4, y: 4.4, collide: false}); }
  for (let x = 12; x < 70; x += 13) block(x, 4, 9, 2.6, 3, {col: 0x3a4a3e, collide: false});
  signPlane(['RIVER LINE'], 4, .8, {bg: '#0e3a1e', fg: '#9dffb4', x: 6, y: 3.2, z: -5.2, glow: 1});
  for (let i = 0; i < 4; i++) extraZombie('Zombie_Ribcage', 30 + i * 6, 3.4, Math.PI, 'Crawl', 1);
  return {run: 7, end: 72, cam: (t, P) => [P.x - 6, 2, P.z + 3, P.x + 4, 1.2, P.z]};
}
function tripBoat() {
  const wt = TEX.water(); wt.repeat.set(30, 30); WORLD.water = wt;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({map: wt, color: 0x5a8aaa, emissive: 0x0c2838, emissiveMap: wt, roughness: .3, metalness: 0})); sea.rotation.x = -Math.PI / 2; sea.position.y = -.3; addToLayer(sea);
  const boat = new THREE.Group(); addToLayer(boat);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 2.4), new THREE.MeshStandardMaterial({color: 0xd8d0c0})); hull.position.y = .2; boat.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.8), new THREE.MeshStandardMaterial({color: 0x2a3a4a})); cab.position.set(-1.4, 1.2, 0); boat.add(cab);
  TRAVEL.boat = boat;
  for (let x = -20; x < 100; x += 16) { const c = block(x, -26, 3, 3, 24, {col: 0xe0a020, collide: false}); c.material = c.material; }
  for (let x = 0; x < 100; x += 11) block(x + 5, 24, 10, 6, rnd(6, 12), {col: 0x2a2420, collide: false});
  lampLight(60, -10, 0xff9a40, 4, 8, 40);
  return {run: 0, boat: true, end: 95, cam: (t, P) => [P.x - 7 + Math.sin(t * .3) * 2, 3.5, P.z + 7, P.x, 1, P.z]};
}
function tripHighway() {
  floor(160, 16, TEX.road, 10, 1, 40, 0, .03); floor(200, 200, () => TEX.concrete('#2a2622'), 30, 30, 40, 0, .01);
  for (let x = -10; x < 110; x += 3.2) for (const z of [-8.3, 8.3]) block(x, z, 2.9, .6, 1, {col: 0x8a8680, collide: false});
  for (const [n, x, z, r] of [['Vehicle_Sports', 14, -3, .5], ['Vehicle_Pickup', 30, 4, 2.7], ['Vehicle_Truck_Armored', 52, -5, 1.7], ['Vehicle_Sports', 70, 3, -.3]]) place(n, x, z, r);
  // the wall far ahead with its floodlights
  block(120, 0, 3, 60, 14, {tex: () => TEX.concrete('#7a7a7e'), collide: false});
  for (const z of [-14, 14]) { spot(115, z, 60, 0, 0xffffff, 3, 14); block(116, z, 1, 1, 14, {col: 0x5a5a5e, collide: false}); }
  for (let i = 0; i < 5; i++) extraZombie('Zombie_Basic', -5 - i * 2.5, rnd(-4, 4), 0, 'Run', 1);
  return {run: 7.8, end: 100, cam: (t, P) => [P.x - 7, 2.2 + Math.min(t, 14) * .25, P.z - 4, P.x + 6, 1.4, P.z]};
}
// set the stage: swap the area layer for the trip layer
TRAVEL.play = function (i, done) {
  const trip = TRIPS[i]; if (!trip) return done();
  clearZombies(); clearPickups(); clearFX(); clearTrail(); clearGear(); RADIO.clear();
  clearLayout(); WORLD.layer = new THREE.Group(); scene.add(WORLD.layer); WORLD.built = -1;
  const A = AREAS[i + 1]; applyAreaLook(A); WORLD.raining = !!AREAS[i].rain; if (WORLD.rain) WORLD.rain.m.visible = WORLD.raining;
  TRAVEL.extras = []; TRAVEL.boat = null; TRAVEL.fire = null;
  TRAVEL.scene = trip.build(); TRAVEL.trip = trip; TRAVEL.t = 0; TRAVEL.done = done; TRAVEL.on = true; G.state = 'cutscene';
  const P = G.player; P.x = 0; P.z = 0; P.y = 0; P.face = 0; P.vx = P.vz = 0; P.rig.play(TRAVEL.scene.run ? 'Run' : 'Idle', {fade: 0, speed: 1.15});
  const el = document.getElementById('cutscene'); el.hidden = false; document.getElementById('cutText').textContent = '';
  document.getElementById('cutSkip').onclick = e => { e.stopPropagation(); TRAVEL.finish(); };
  document.getElementById('cutText').innerHTML = `<small>${trip.chapter}</small>${trip.text}`;
  setTimeout(() => { if (TRAVEL.on) RADIO.say(trip.lines); }, 1400);
  TRAVEL.clueShown = false; TRAVEL.dur = 30;
  AU.musicTo('music_calm'); AU.ambience(true);
};
TRAVEL.update = function (raw) {
  if (!TRAVEL.on) return; TRAVEL.t += raw; const P = G.player, S = TRAVEL.scene, t = TRAVEL.t;
  // the run slows over the last 8 m of the set and stops before its end, so the survivor never enters the buildings past it
  if (S.run) { const k = clamp((S.end - P.x) / 8, 0, 1), sp = S.run * k; P.x += sp * raw; P.face = 0;
    if (sp < .8) { if (!S.stopped) { S.stopped = true; P.rig.play('Idle', {fade: .4}); } } else if (Math.random() < raw * 2.2) AU.play('step', {vol: .3}); }
  if (TRAVEL.boat) { const b = TRAVEL.boat; b.position.set(P.x = S.end * (1 - Math.exp(-t * 5 / S.end)), Math.sin(t * 2) * .12, P.z = 0); b.rotation.z = Math.sin(t * 1.6) * .04; P.y = .75 + b.position.y; if (Math.random() < .5) addPart({x: b.position.x - 2.6, y: 0, z: rnd(-1, 1), vx: -2, vz: rnd(-1, 1), vy: rnd(1, 2), g: 6, life: .6, max: .6, size: .12, col: '#cfe6ff', drag: .95, rx: 0, ry: 0}); }
  if (TRAVEL.fire && Math.random() < .8) { const f = TRAVEL.fire; addPart({x: f.x + rnd(-.8, .8), y: rnd(.6, 1.4), z: f.z + rnd(-.5, .5), vx: 0, vz: 0, vy: rnd(2, 4), g: -2, life: .6, max: .6, size: rnd(.15, .3), col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10']), drag: .9, rx: 0, ry: 0}); flashLight(f.x, f.z, 0xff6a1a, 3); }
  for (const e of TRAVEL.extras) { const sp = (e.r.curName === 'Run' ? 5.5 : e.r.curName === 'Crawl' ? 1.6 : 2.2) * (Math.abs(e.face) < .1 && e.x > P.x - 4 ? 0 : 1); e.x += Math.cos(e.face) * sp * raw; e.z += Math.sin(e.face) * sp * raw; e.r.root.position.set(e.x, 0, e.z); e.r.root.rotation.y = yawFor(e.face); e.r.mixer.update(raw); }
  P.rig.mixer.update(raw); syncPlayer(); updateFX(raw); updateRain(raw);
  const [x, y, z, lx, ly, lz] = S.cam(t, P); camera.position.set(x, y, z); camera.lookAt(lx, ly, lz);
  // the clue card lands once the radio scene is over (or 4.5 s before the end)
  if (!TRAVEL.clueShown && (t > 24 || (t > 4 && !RADIO.cur && !RADIO.q.length))) { TRAVEL.clueShown = true; showClue(TRAVEL.trip.clue); TRAVEL.dur = t + 5.5; }
  document.getElementById('cutBar').style.width = Math.min(100, t / TRAVEL.dur * 100) + '%';
  if (t > TRAVEL.dur) TRAVEL.finish();
};
TRAVEL.finish = function () {
  if (!TRAVEL.on) return; TRAVEL.on = false; RADIO.clear(); const cl = document.getElementById('clue'); if (cl) cl.classList.remove('on');
  for (const e of TRAVEL.extras) e.r.dispose(); TRAVEL.extras = []; G.player.y = 0;
  document.getElementById('cutscene').hidden = true; const d = TRAVEL.done; TRAVEL.done = null; d && d();
};

// case file: the clues found so far, the newest one stamped in
function showClue(c) {
  if (!c) return; let el = document.getElementById('clue');
  if (!el) { el = document.createElement('div'); el.id = 'clue'; document.body.appendChild(el); }
  const all = TRIPS.slice(0, c.n).map(t => t.clue);
  el.innerHTML = `<div class="cfhead">${icon('story')}CASE FILE<span>${c.n} / 4</span></div>` + all.map(k => `<div class="cfrow${k === c ? ' new' : ''}"><b>${k.n}. ${k.title}</b><p>${k.text}</p>${k === c ? '<i>NEW CLUE</i>' : ''}</div>`).join('');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); AU.play('cardPick', {vol: .6});
}
