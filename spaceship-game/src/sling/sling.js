import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Ship } from '../ship.js';
import { Particles } from '../particles.js';
import { chickenBodyGeometry, mergeColored, tf } from '../geo.js';
import { GALAXIES } from '../galaxies.js';
import { MATS, HENS, WORLDS, buildLevel, starsFor } from './levels.js';

// Coco Catapult: Angry-Birds-style physics puzzler seen from behind the
// slingshot. Pull back to aim (a dotted arc previews the flight), let go to
// launch Coco's pod into towers of wood / stone / ice with Space Hens inside.
// Tap mid-flight for a one-time dive boost. Clear every hen to win; fewer
// shots = more stars.
//
// main.js owns the renderer and calls update() + render each frame while the
// session is active; the session reports what happened through `events`.

const GRAVITY = -18;
const POUCH = new THREE.Vector3(0, 2.25, 0);
const PITCH = 0.64;           // launch elevation (rad)
const SPEED_MIN = 9, SPEED_MAX = 27;
const STEP = 1 / 60;
const PROJ_R = 0.55;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const hex = (c) => new THREE.Color(c);

// ---------------------------------------------------------------- textures
function blockTexture(m, damaged) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const pal = {
    wood: ['#c98a4a', '#a8692f', '#5e3a1c'],
    stone: ['#a3a8b0', '#7f858e', '#3e434b'],
    ice: ['#cdefff', '#96d4f2', '#4f9cc6'],
  }[m];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 128, 128);
  let seed = m.length * 97 + (damaged ? 13 : 0);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (m === 'wood') {
    g.strokeStyle = pal[1]; g.lineWidth = 3;
    for (let y = 14; y < 128; y += 22) { g.beginPath(); g.moveTo(0, y + rnd() * 4); g.bezierCurveTo(40, y - 6, 80, y + 8, 128, y + rnd() * 4); g.stroke(); }
    g.fillStyle = pal[1];
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(20 + rnd() * 90, 20 + rnd() * 90, 6, 3, 0, 0, Math.PI * 2); g.fill(); }
  } else if (m === 'stone') {
    for (let i = 0; i < 14; i++) { g.fillStyle = rnd() > 0.5 ? pal[1] : '#b3b8c0'; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 6 + rnd() * 12, 0, Math.PI * 2); g.fill(); }
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(18, 110); g.lineTo(60, 18); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(58, 116); g.lineTo(84, 60); g.stroke();
  }
  if (damaged) {
    g.strokeStyle = pal[2]; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      let x = 30 + rnd() * 70, y = 10 + rnd() * 20;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += (rnd() - 0.5) * 34; y += 18 + rnd() * 10; g.lineTo(x, y); }
      g.stroke();
    }
  }
  // chunky dark edge = the game's ink-outline look
  g.strokeStyle = pal[2]; g.lineWidth = 10; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function groundTexture(base) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    g.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 10, 2 + rnd() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function planetTexture(cols) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(100, 90, 20, 128, 128, 128);
  r.addColorStop(0, cols[0]); r.addColorStop(0.55, cols[1]); r.addColorStop(1, cols[2]);
  g.fillStyle = r; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 10;
  for (let y = 60; y < 220; y += 34) { g.beginPath(); g.moveTo(10, y); g.quadraticCurveTo(128, y + 18, 246, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- session
export class SlingSession {
  constructor(quality) {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    this.events = {};
    this.active = false;

    // Lights: warm key with shadows + sky fill.
    this.hemi = new THREE.HemisphereLight(0xf3e6c8, 0x2f5358, 1.3);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    this.sun.position.set(-14, 26, 10);
    this.sun.target.position.set(0, 0, -20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 16; sc.bottom = -10; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this._buildWorld();
    this._buildSlingshot();

    this.particles = new Particles(this.scene, quality === 'high' ? 900 : 500);

    // Projectile visual: the player's actual pod (skin, upgrades, add-ons, Coco).
    this.ship = new Ship(this.scene);
    this.ship.group.scale.setScalar(0.5);
    this.ship.engineLight.intensity = 3;
    this.ship.setShielded(false);

    // Trajectory preview dots.
    const dotGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this.dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xfff4dc }), 26);
    this.dots.frustumCulled = false;
    this.dots.count = 0;
    this.scene.add(this.dots);

    // Shared materials / geometries.
    this.blockMats = {};
    for (const m of Object.keys(MATS)) {
      const opts = m === 'ice'
        ? { roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.9 }
        : { roughness: m === 'stone' ? 0.85 : 0.7, metalness: 0.02 };
      this.blockMats[m] = [
        new THREE.MeshStandardMaterial({ map: blockTexture(m, false), ...opts }),
        new THREE.MeshStandardMaterial({ map: blockTexture(m, true), ...opts }),
      ];
    }
    this.henMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 });
    this.henGeo = chickenBodyGeometry(0xf7f3ea);
    this.helmetGeo = mergeColored([
      { geo: new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color: 0x9aa3b5 },
      { geo: tf(new THREE.TorusGeometry(0.41, 0.05, 6, 20), { r: [Math.PI / 2, 0, 0] }), color: 0x5a6378 },
      { geo: tf(new THREE.ConeGeometry(0.06, 0.2, 6), { p: [0, 0.48, 0] }), color: 0x5a6378 },
    ]);
    this.crownGeo = mergeColored([
      { geo: new THREE.CylinderGeometry(0.34, 0.3, 0.2, 10), color: 0xffc23a },
      ...[0, 1, 2, 3, 4].map((i) => ({ geo: tf(new THREE.ConeGeometry(0.08, 0.26, 4), { p: [Math.cos(i * 1.2566) * 0.3, 0.2, Math.sin(i * 1.2566) * 0.3] }), color: 0xffc23a })),
      { geo: tf(new THREE.IcosahedronGeometry(0.07, 0), { p: [0, 0.05, 0.33] }), color: 0xd9582b },
    ]);

    this._geoCache = new Map();
    this.entities = [];
    this._bindInput();
  }

  _boxGeo(w, h, d) {
    const k = `${w}|${h}|${d}`;
    if (!this._geoCache.has(k)) this._geoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return this._geoCache.get(k);
  }

  // ---------- static world: sky dome, ground, planet, hills ----------
  _buildWorld() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: hex(0x16202e) }, uMid: { value: hex(0x22364a) }, uBot: { value: hex(0xe07a3a) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop, uMid, uBot; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(uBot, uMid, smoothstep(-0.02, 0.18, h)); c = mix(c, uTop, smoothstep(0.18, 0.7, h)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.scene.add(this.sky);

    // Stars
    const sg = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.3;
      sp.push(Math.cos(a) * Math.cos(e) * 480, Math.sin(e) * 480, Math.sin(a) * Math.cos(e) * 480);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xf3e6c8, size: 1.6, sizeAttenuation: false, fog: false }));
    this.scene.add(this.stars);

    this.groundMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.planetMat = new THREE.MeshBasicMaterial({ fog: false, transparent: true });
    this.planet = new THREE.Mesh(new THREE.CircleGeometry(60, 48), this.planetMat);
    this.planet.position.set(-90, 55, -380);
    this.scene.add(this.planet);

    // Low-poly hills around the horizon.
    this.hillMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    const hills = [];
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI * 0.95 + (i / 21) * Math.PI * 0.9;
      const d = 150 + Math.random() * 60;
      hills.push({ geo: tf(new THREE.ConeGeometry(14 + Math.random() * 16, 10 + Math.random() * 18, 6), { p: [Math.cos(a) * d, 4, Math.sin(a) * d] }), color: 0xffffff });
    }
    this.hills = new THREE.Mesh(mergeColored(hills), this.hillMat);
    this.scene.add(this.hills);
  }

  _theme(galaxyIndex) {
    const G = GALAXIES[galaxyIndex];
    const [top, mid] = G.home.sky;
    const horizon = G.world ? G.world.sky.horizon : 0xe07a3a;
    this.skyMat.uniforms.uTop.value.set(top);
    this.skyMat.uniforms.uMid.value.set(mid);
    this.skyMat.uniforms.uBot.value.set(horizon);
    const fogC = hex(horizon).lerp(hex(mid), 0.55);
    this.scene.fog = new THREE.Fog(fogC, 70, 320);
    const floor = hex(G.colors.floor).lerp(hex(0x1f2a3a), 0.35);
    this.groundMat.map = groundTexture(`#${floor.getHexString()}`);
    this.groundMat.needsUpdate = true;
    this.hillMat.color.copy(floor).multiplyScalar(0.55);
    this.planetMat.map = planetTexture(G.home.planet);
    this.planetMat.needsUpdate = true;
    this.hemi.color.set(0xf3e6c8);
    this.hemi.groundColor.copy(floor).multiplyScalar(0.6);
  }

  _buildSlingshot() {
    const wood = 0x6b4428, dark = 0x3e2616;
    this.sling = new THREE.Mesh(mergeColored([
      { geo: tf(new THREE.CylinderGeometry(0.17, 0.22, 1.5, 8), { p: [0, 0.75, 0] }), color: wood },
      { geo: tf(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 8), { r: [0, 0, 0.45], p: [-0.3, 1.9, 0] }), color: wood },
      { geo: tf(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 8), { r: [0, 0, -0.45], p: [0.3, 1.9, 0] }), color: wood },
      { geo: tf(new THREE.TorusGeometry(0.2, 0.05, 5, 12), { r: [Math.PI / 2, 0, 0], p: [0, 1.2, 0] }), color: dark },
      { geo: tf(new THREE.CylinderGeometry(1.6, 2.2, 0.5, 10), { p: [0, 0.1, 0.2] }), color: 0x4a3a2a },
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }));
    this.sling.castShadow = true;
    this.scene.add(this.sling);
    this.forkL = new THREE.Vector3(-0.56, 2.42, 0);
    this.forkR = new THREE.Vector3(0.56, 2.42, 0);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd9582b, roughness: 0.6 });
    const bandGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
    bandGeo.translate(0, 0.5, 0);
    this.bandL = new THREE.Mesh(bandGeo, bandMat);
    this.bandR = new THREE.Mesh(bandGeo, bandMat);
    this.scene.add(this.bandL, this.bandR);
  }

  _band(mesh, from, to) {
    _v.subVectors(to, from);
    const len = _v.length();
    mesh.position.copy(from);
    mesh.scale.set(1, Math.max(0.01, len), 1);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.normalize());
    mesh.quaternion.copy(_q);
  }

  // ---------------------------------------------------------------- level
  load(w, l, { skin, upgrades }) {
    this.dispose();
    this.def = buildLevel(w, l);
    this._theme(WORLDS[w].galaxy);
    this.ship.setSkin(skin);
    this.ship.setUpgrades(upgrades);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 14;
    world.defaultContactMaterial.friction = 0.6;
    world.defaultContactMaterial.restitution = 0.06;
    this.world = world;
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.userData = { kind: 'ground' };
    world.addBody(ground);

    this.entities = [];
    for (const b of this.def.blocks) this._addBlock(b);
    for (const h of this.def.hens) this._addHen(h);
    this.hensLeft = this.def.hens.length;
    this.structZ = this.def.hens.reduce((a, h) => a + h.z, 0) / this.def.hens.length;

    this.score = 0;
    this.shotsLeft = this.def.shots;
    this.shotsUsed = 0;
    this.t = 0;
    this.armed = false;          // damage is off while the towers settle
    this.state = 'intro';
    this.stateT = 0;
    this.proj = null;
    this.acc = 0;
    this.shake = 0;
    this.pull = null;
    this._placeProjectileAtPouch();
    this.camera.position.set(6, 9, this.structZ + 16);
    this._look = new THREE.Vector3(0, 1.5, this.structZ);
    this.active = true;
  }

  _addBlock(b) {
    const mat = MATS[b.m];
    const body = new CANNON.Body({
      mass: b.w * b.h * b.d * mat.density,
      shape: new CANNON.Box(new CANNON.Vec3(b.w / 2, b.h / 2, b.d / 2)),
      position: new CANNON.Vec3(b.x, b.y, b.z),
      sleepSpeedLimit: 0.2, sleepTimeLimit: 0.4,
    });
    body.sleep();
    const mesh = new THREE.Mesh(this._boxGeo(b.w, b.h, b.d), this.blockMats[b.m][0]);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    const e = { kind: 'block', m: b.m, body, mesh, hp: mat.hp, maxHp: mat.hp, pts: mat.pts };
    this._track(e);
  }

  _addHen(h) {
    const spec = HENS[h.type];
    const body = new CANNON.Body({
      mass: h.type === 'boss' ? 4 : 0.8,
      shape: new CANNON.Sphere(spec.r),
      position: new CANNON.Vec3(h.x, h.y, h.z),
      angularDamping: 0.6, linearDamping: 0.05,
      sleepSpeedLimit: 0.2, sleepTimeLimit: 0.4,
    });
    body.sleep();
    const group = new THREE.Group();
    const inner = new THREE.Group();
    const s = spec.r / 0.62;
    const bodyMesh = new THREE.Mesh(this.henGeo, this.henMat);
    bodyMesh.castShadow = true;
    inner.add(bodyMesh);
    if (h.type === 'helmet') { const m = new THREE.Mesh(this.helmetGeo, this.henMat); m.position.set(0, 0.62, 0.3); m.scale.setScalar(0.95); inner.add(m); }
    if (h.type === 'boss') { const m = new THREE.Mesh(this.crownGeo, this.henMat); m.position.set(0, 0.92, 0.28); inner.add(m); }
    inner.scale.setScalar(s);
    inner.position.y = -0.05 * s;
    group.add(inner);
    this.scene.add(group);
    const e = { kind: 'hen', type: h.type, body, mesh: group, inner, hp: spec.hp, maxHp: spec.hp, pts: spec.pts, phase: Math.random() * 6 };
    this._track(e);
  }

  _track(e) {
    e.body.userData = e;
    e.body.addEventListener('collide', (ev) => this._onCollide(e, ev));
    this.world.addBody(e.body);
    this.entities.push(e);
    this._sync(e);
  }

  _onCollide(e, ev) {
    if (!this.armed || e.dead) return;
    const v = Math.abs(ev.contact.getImpactVelocityAlongNormal());
    const other = ev.body;
    const om = other.mass || 8;
    const ratio = Math.min(4, Math.max(0.25, om / e.body.mass));
    const hardness = e.kind === 'hen' ? 1 : e.m === 'stone' ? 2.2 : e.m === 'ice' ? 0.7 : 1;
    const thresh = e.kind === 'hen' ? 1.1 : 1.8;
    const dmg = Math.max(0, v - thresh) * Math.sqrt(ratio) / hardness;
    if (dmg <= 0.05) return;
    e.hp -= dmg;
    if (other.userData && other.userData.kind === 'proj' && v > 4) this.events.onImpact && this.events.onImpact(e.kind === 'hen' ? 'hen' : e.m, Math.min(1, v / 20));
    if (e.hp <= 0) e.dead = true;
    else if (e.kind === 'block' && e.hp < e.maxHp * 0.5) e.mesh.material = this.blockMats[e.m][1];
  }

  _sync(e) {
    const p = e.body.position, q = e.body.quaternion;
    e.mesh.position.set(p.x, p.y, p.z);
    if (e.kind === 'hen') {
      // Hens stay upright-ish and face the slingshot (they're watching you).
      e.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    } else {
      e.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  _kill(e) {
    e.dead = true;
    this.world.removeBody(e.body);
    // Sleeping bodies aren't woken when their support disappears; without this,
    // hens and slabs resting on a destroyed block would hang in mid-air.
    for (const o of this.entities) if (!o.dead && o.body.sleepState) o.body.wakeUp();
    this.scene.remove(e.mesh);
    const p = e.body.position;
    if (e.kind === 'hen') {
      this.hensLeft--;
      this.particles.burst(p.x, p.y, p.z, e.type === 'boss' ? 120 : 60, 7, 1.1, 0.55, [[1, 1, 1], [0.97, 0.93, 0.85], [1, 0.8, 0.4]], 1.4, 0);
      this._addScore(e.pts, p);
      this.events.onHen && this.events.onHen(e.type, this.hensLeft);
    } else {
      const col = { wood: [[0.79, 0.54, 0.29], [0.6, 0.38, 0.18]], stone: [[0.64, 0.66, 0.69], [0.45, 0.47, 0.5]], ice: [[0.8, 0.94, 1], [1, 1, 1]] }[e.m];
      this.particles.burst(p.x, p.y, p.z, 30, 5, 0.8, 0.35, col, 2.2, 0);
      this._addScore(e.pts, p);
      this.events.onBreak && this.events.onBreak(e.m);
    }
  }

  _addScore(pts, pos) {
    this.score += pts;
    this.events.onScore && this.events.onScore(this.score, pts, pos && this._screen(pos));
  }

  _screen(p) {
    _v.set(p.x, p.y + 0.8, p.z).project(this.camera);
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight };
  }

  // ---------------------------------------------------------------- shooting
  _placeProjectileAtPouch() {
    this.ship.group.visible = this.shotsLeft > 0;
    this.ship.group.position.copy(POUCH);
    this.ship.group.rotation.set(0, 0, 0);
    this.ship.model.rotation.set(0, 0, 0);
  }

  _aimVector(pull) {
    const R = Math.min(innerWidth, innerHeight) * 0.34;
    const len = Math.min(R, Math.hypot(pull.x, pull.y));
    const power = len / R;
    const yaw = THREE.MathUtils.clamp(-pull.x / R, -1, 1) * 0.5;
    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * power;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), -Math.cos(yaw) * Math.cos(PITCH));
    return { power, yaw, vel: dir.multiplyScalar(speed) };
  }

  _pouchPos(aim) {
    return new THREE.Vector3(-Math.sin(aim.yaw) * aim.power * 1.4, POUCH.y - aim.power * 0.7, aim.power * 1.9);
  }

  _launch(aim) {
    const from = this._pouchPos(aim);
    const body = new CANNON.Body({
      mass: 4, shape: new CANNON.Sphere(PROJ_R),
      position: new CANNON.Vec3(from.x, from.y, from.z),
      velocity: new CANNON.Vec3(aim.vel.x, aim.vel.y, aim.vel.z),
      linearDamping: 0.01, angularDamping: 0.5,
    });
    body.userData = { kind: 'proj' };
    body.addEventListener('collide', () => { if (this.proj && !this.proj.hit) { this.proj.hit = true; this.events.onFirstHit && this.events.onFirstHit(); } });
    this.world.addBody(body);
    this.proj = { body, t: 0, dashed: false, hit: false, still: 0 };
    this.shotsLeft--;
    this.shotsUsed++;
    this.state = 'fly';
    this.stateT = 0;
    this.dots.count = 0;
    this.shake = 0.25;
    this.events.onLaunch && this.events.onLaunch(this.shotsLeft);
  }

  // Tap during flight: one dive boost along the current heading.
  dash() {
    const p = this.proj;
    if (!p || p.dashed || p.hit || this.state !== 'fly') return false;
    p.dashed = true;
    const v = p.body.velocity;
    const sp = Math.hypot(v.x, v.y, v.z);
    const k = Math.max(1.5, 26 / Math.max(1, sp));
    p.body.velocity.set(v.x * k, Math.min(v.y * k, v.y - 6), v.z * k);
    const q = p.body.position;
    this.particles.burst(q.x, q.y, q.z + 0.4, 50, 6, 0.6, 0.45, [[1, 0.85, 0.3], [1, 0.5, 0.15]], 2, 0);
    this.events.onDash && this.events.onDash();
    return true;
  }

  _previewDots(aim) {
    const p0 = this._pouchPos(aim);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 1; i <= 26; i++) {
      const t = i * 0.055;
      const x = p0.x + aim.vel.x * t, y = p0.y + aim.vel.y * t + 0.5 * GRAVITY * t * t, z = p0.z + aim.vel.z * t;
      if (y < 0) break;
      const s = 1 - i / 34;
      m.makeScale(s, s, s).setPosition(x, y, z);
      this.dots.setMatrixAt(n++, m);
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
  }

  _bindInput() {
    const canvas = document.getElementById('game');
    this._down = (e) => {
      if (!this.active || this.paused) return;
      if (this.state === 'fly') { this.dash(); return; }
      if (this.state !== 'aim' || this.shotsLeft <= 0) return;
      this.pull = { sx: e.clientX, sy: e.clientY, x: 0, y: 0, id: e.pointerId };
      this.events.onGrab && this.events.onGrab();
    };
    this._move = (e) => {
      if (!this.pull || e.pointerId !== this.pull.id) return;
      this.pull.x = e.clientX - this.pull.sx;
      this.pull.y = e.clientY - this.pull.sy;
    };
    this._up = (e) => {
      if (!this.pull || e.pointerId !== this.pull.id) return;
      const aim = this._aimVector(this.pull);
      this.pull = null;
      this.dots.count = 0;
      if (aim.power < 0.15 || this.state !== 'aim') { this._placeProjectileAtPouch(); return; }
      this._launch(aim);
    };
    canvas.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
  }

  // ---------------------------------------------------------------- update
  update(realDt) {
    if (!this.active) return;
    const dt = Math.min(realDt, 1 / 20);
    this.t += dt;
    this.stateT += dt;
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= STEP) { this.world.step(STEP); this.acc -= STEP; }
      if (!this.armed && this.t > 0.9) this.armed = true;
      for (const e of this.entities) {
        if (e.dead && e.body.world) this._kill(e);
        if (!e.dead && e.kind === 'hen' && e.body.position.y < -3) this._kill(e);
      }
      this.entities = this.entities.filter((e) => e.body.world);
      // A support knocked out from under a sleeping piece doesn't wake it
      // either, so while anything is tumbling keep the whole level awake.
      if (this.armed && this.entities.some((e) => e.body.sleepState === 0 && e.body.velocity.lengthSquared() > 1)) {
        for (const e of this.entities) if (e.body.sleepState) e.body.wakeUp();
      }
      for (const e of this.entities) this._sync(e);
      this._updateState(dt);
    }
    this._updateVisuals(dt);
    this.particles.update(dt, 0);
  }

  _updateState(dt) {
    if (this.state === 'intro' && this.stateT > 1.8) { this.state = 'aim'; this.stateT = 0; this.events.onAim && this.events.onAim(); }
    if (this.state === 'aim' && this.pull) this._previewDots(this._aimVector(this.pull));
    if (this.state === 'fly') {
      const p = this.proj;
      p.t += dt;
      const v = p.body.velocity;
      const sp = Math.hypot(v.x, v.y, v.z);
      p.still = sp < 0.6 ? p.still + dt : 0;
      const pos = p.body.position;
      const gone = pos.y < -5 || Math.abs(pos.x) > 60 || pos.z < -90 || pos.z > 20;
      if (p.still > 0.4 || gone || p.t > 6) { this.state = 'settle'; this.stateT = 0; }
    }
    if (this.state === 'settle') {
      let moving = false;
      for (const e of this.entities) {
        const v = e.body.velocity;
        if (e.body.sleepState !== CANNON.Body.SLEEPING && Math.hypot(v.x, v.y, v.z) > 0.35) { moving = true; break; }
      }
      if ((!moving && this.stateT > 0.8) || this.stateT > 4) this._endShot();
    }
    if (this.state !== 'done' && this.hensLeft <= 0 && this.state !== 'settle' && this.state !== 'fly') this._finish(true);
  }

  _endShot() {
    if (this.proj) {
      const pb = this.proj.body;
      this.particles.burst(pb.position.x, pb.position.y, pb.position.z, 20, 3, 0.6, 0.3, [[1, 0.95, 0.8]], 2, 0);
      this.world.removeBody(pb);
      this.proj = null;
    }
    if (this.hensLeft <= 0) { this._finish(true); return; }
    if (this.shotsLeft <= 0) { this._finish(false); return; }
    this.state = 'aim';
    this.stateT = 0;
    this._placeProjectileAtPouch();
    this.events.onAim && this.events.onAim();
  }

  _finish(won) {
    if (this.state === 'done') return;
    this.state = 'done';
    this.stateT = 0;
    let bonus = 0;
    if (won) { bonus = this.shotsLeft * 10000; this.score += bonus; }
    const stars = starsFor(this.def, this.shotsUsed, won);
    this.events.onEnd && this.events.onEnd({ won, stars, score: this.score, bonus, shotsUsed: this.shotsUsed, def: this.def });
  }

  _updateVisuals(dt) {
    // Hens bob and look around while they're safe.
    for (const e of this.entities) {
      if (e.kind !== 'hen') continue;
      e.phase += dt * 3;
      e.inner.scale.y = (HENS[e.type].r / 0.62) * (1 + Math.sin(e.phase) * 0.04);
    }

    // Projectile / pouch / bands.
    const ship = this.ship;
    ship.animate(dt);
    let pouch = POUCH;
    if (this.state === 'fly' && this.proj) {
      const b = this.proj.body;
      ship.group.position.set(b.position.x, b.position.y, b.position.z);
      const v = b.velocity;
      // Nose (-Z) follows the flight direction.
      _v.set(v.x, v.y, v.z);
      if (_v.lengthSq() > 0.5) {
        _v.normalize();
        _q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _v);
        ship.group.quaternion.slerp(_q, 1 - Math.exp(-dt * 10));
      }
      ship.setThrust(this.proj.dashed && this.proj.t < 1.5 ? 2.2 : 1.2);
      // Trail
      if (!this.proj.hit) {
        const c = ship.trailColor;
        this.particles.emit(b.position.x, b.position.y, b.position.z + 0.3, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0.4, 0.5, 0.45, c[0], c[1], c[2], 1, 0);
      }
    } else if (this.state === 'aim' && this.pull) {
      const aim = this._aimVector(this.pull);
      pouch = this._pouchPos(aim);
      ship.group.position.copy(pouch);
      _v.copy(aim.vel).normalize();
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _v);
      ship.group.quaternion.copy(_q);
      ship.setThrust(0.6 + aim.power);
    } else if (this.state === 'aim' || this.state === 'intro') {
      ship.group.position.set(0, POUCH.y + Math.sin(this.t * 2.4) * 0.05, 0);
      ship.group.quaternion.setFromEuler(new THREE.Euler(0.25, 0, 0));
      ship.setThrust(0.5);
    }
    const bandTo = this.state === 'fly' ? POUCH : (this.pull ? pouch : POUCH);
    this._band(this.bandL, this.forkL, _v.copy(bandTo).add(new THREE.Vector3(-0.2, 0, 0.1)).clone());
    this._band(this.bandR, this.forkR, _v.copy(bandTo).add(new THREE.Vector3(0.2, 0, 0.1)).clone());

    // Camera
    const cam = this.camera;
    cam.aspect = innerWidth / innerHeight;
    cam.fov = cam.aspect < 0.7 ? 58 : 48;
    cam.updateProjectionMatrix();
    const want = new THREE.Vector3(), look = new THREE.Vector3();
    const sz = this.structZ;
    if (this.state === 'intro') {
      const k = THREE.MathUtils.smoothstep(this.stateT, 0.2, 1.8);
      want.set(THREE.MathUtils.lerp(5, 0, k), THREE.MathUtils.lerp(8, 5.4, k), THREE.MathUtils.lerp(sz + 14, 10.5, k));
      look.set(0, THREE.MathUtils.lerp(1.5, 2.2, k), THREE.MathUtils.lerp(sz, sz + 2, k));
    } else if (this.state === 'fly' && this.proj) {
      const b = this.proj.body.position;
      want.set(b.x * 0.7, Math.max(2.5, b.y + 2.4), b.z + 8);
      look.set(b.x * 0.9, Math.max(1, b.y - 0.4), b.z - 10);
    } else if (this.state === 'settle' || this.state === 'done') {
      want.set(0, 5.5, sz + 13);
      look.set(0, 1.8, sz);
    } else {
      const yaw = this.pull ? this._aimVector(this.pull).yaw : 0;
      want.set(-yaw * 1.5, 5.4, 10.5);
      look.set(yaw * 6, 2.2, sz + 2);
    }
    const k = this.state === 'intro' ? 1 : 1 - Math.exp(-dt * (this.state === 'fly' ? 5 : 3));
    cam.position.lerp(want, k);
    this._look.lerp(look, k);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }
    cam.lookAt(this._look);
  }

  // Shake the camera from outside (big impacts).
  kick(s) { this.shake = Math.max(this.shake, s); }

  dispose() {
    if (this.world) {
      for (const e of this.entities) this.scene.remove(e.mesh);
      this.entities = [];
      this.world = null;
    }
    this.proj = null;
    this.dots.count = 0;
    this.active = false;
  }
}
