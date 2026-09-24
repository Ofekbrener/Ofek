import * as THREE from 'three';
import { Track, TRACK_HALF } from './track.js';
import { RIVALS } from './leagues.js';
import { Ship } from '../ship.js';
import { Particles } from '../particles.js';
import { createSky, createHero, applyHero, createWeather, applyWeatherStyle, toSRGB, setStyle } from '../worlds.js';
import { eggPodGeometry, chickenBodyGeometry, wingGeometry, mergeColored, tf } from '../geo.js';

const COUNTDOWN = 3.2;
const DRAFT_DIST = 9;
const STEER = 30;          // lateral thrust at full steer (units/s²), × grip
const CENTRIFUGAL = 1.0;   // corner push-out = v² · curvature · this

// One race: track, player ship + 4 chicken rivals, physics, AI, camera.
// main.js drives it via update(); it reports events through callbacks.
export class RaceSession {
  constructor(quality) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060f);
    this.scene.fog = new THREE.Fog(0x05060f, 80, 420);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);

    this.hemi = new THREE.HemisphereLight(0x8fb8ff, 0x3a1450, 1.5);
    this.key = new THREE.DirectionalLight(0xffffff, 2);
    this.key.position.set(50, 120, 40);
    this.scene.add(this.hemi, this.key);

    this.particles = new Particles(this.scene, quality === 'high' ? 1000 : 600);
    this._buildBackdrop(quality);

    // Player ship lives inside a root that we orient along the track.
    this.ship = new Ship(this.scene);
    this.playerRoot = new THREE.Group();
    this.playerRoot.add(this.ship.group);
    this.scene.add(this.playerRoot);
    this.ship.engineLight.intensity = 6;

    this.podMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25, flatShading: true });
    this.podMeshes = [];

    // Item projectiles (pooled)
    const eggGeo = new THREE.IcosahedronGeometry(0.35, 1);
    eggGeo.scale(0.8, 1.05, 0.8);
    this.missiles = [];
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(eggGeo, new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffa21f, emissiveIntensity: 1.4 }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.missiles.push({ active: false, mesh, s: 0, x: 0, t: 0 });
    }
    this.mines = [];
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(eggGeo, new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff0000, emissiveIntensity: 1 }));
      mesh.scale.setScalar(1.3);
      mesh.visible = false;
      this.scene.add(mesh);
      this.mines.push({ active: false, mesh, s: 0, x: 0, age: 0 });
    }
    // Shields on rivals
    this.rivalShieldMat = new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });

    // The Supreme Mother Hen (final race only)
    const henMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true });
    const hen = new THREE.Group();
    hen.add(new THREE.Mesh(chickenBodyGeometry(0xfff0f6), henMat));
    const wingL = new THREE.Mesh(wingGeometry(), henMat);
    const wingR = new THREE.Mesh(wingGeometry(), henMat);
    wingL.position.set(-0.38, 0.22, -0.05); wingL.rotation.y = Math.PI;
    wingR.position.set(0.38, 0.22, -0.05);
    hen.add(wingL, wingR);
    hen.add(new THREE.Mesh(mergeColored([
      { geo: tf(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 10), { p: [0, 0.92, 0.3] }), color: 0xffd35c },
      ...[0, 1, 2, 3, 4].map((i) => ({ geo: tf(new THREE.ConeGeometry(0.05, 0.18, 4), { p: [Math.cos(i * 1.256) * 0.18, 1.06, 0.3 + Math.sin(i * 1.256) * 0.18] }), color: 0xffd35c })),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.3 })));
    hen.scale.setScalar(4.5);
    hen.visible = false;
    this.scene.add(hen);
    this.henModel = { mesh: hen, wingL, wingR };
    this.henEggs = [];
    const splatGeo = new THREE.IcosahedronGeometry(0.6, 1);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(splatGeo, new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0x554a20 }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.henEggs.push({ active: false, mesh });
    }

    this.track = null;
    this.racers = [];
    this.running = false;
    this.events = {};         // callbacks: onCountdown(n), onGo, onLap(lap), onFinish(results), onBoost, onPad, onBump, onCrash, onOvertake(rival), onFinalLap
    this._f = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() };
    this._g = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() };
    this._m = new THREE.Matrix4();
    this._back = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this.shake = 0;
  }

  _buildBackdrop(quality) {
    const N = 1500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * 6.28, r = 700 + Math.random() * 200;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(t) * s * r, Math.abs(u) * r * 0.8 - 60, Math.sin(t) * s * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd6ff, size: 2, sizeAttenuation: false, fog: false }));
    this.scene.add(this.stars);

    // Galaxy world: sky dome (follows the camera), hero backdrop and weather.
    this.sky = createSky(1000);
    this.scene.add(this.sky);
    this.hero = createHero();
    this.hero.position.set(0, 230, -760);
    this.scene.add(this.hero);
    this.weather = createWeather(quality === 'high' ? 420 : 220);
    this.weather.uniforms.uBox.value.set(70, 34, 70);
    this.scene.add(this.weather.points);
  }

  // Sky, weather, fog and light rig from a galaxy's world block.
  _applyWorld(galaxy) {
    const w = galaxy.world;
    const su = this.sky.material.uniforms;
    const s = w.sky;
    toSRGB(su.uTop.value, s.top); toSRGB(su.uHorizon.value, s.horizon); toSRGB(su.uBottom.value, s.bottom);
    toSRGB(su.uNeb1.value, s.neb1); toSRGB(su.uNeb2.value, s.neb2); toSRGB(su.uSun.value, s.sun);
    su.uDensity.value = s.density; su.uScale.value = s.scale; su.uRays.value = s.rays; su.uScan.value = s.scan;
    su.uSunDir.value.copy(this.hero.position).normalize();
    applyHero(this.hero, w, 2.6);
    setStyle(this.sky.material, w.style);
    applyWeatherStyle(this.weather, w);
    this.scene.background.set(s.bottom);
    this.scene.fog.color.set(w.fog.color).convertLinearToSRGB();
    this.hemi.color.set(w.light.sky);
    this.hemi.groundColor.set(w.light.ground);
    this.hemi.intensity = w.light.hemi + 0.1;
    this.key.color.set(w.light.key);
    this.key.intensity = w.light.keyI * 0.9;
  }

  _updateWorld(dt) {
    this.sky.position.copy(this.camera.position);
    const t = this.sky.material.uniforms.uTime;
    t.value = (t.value + dt) % 1000;
    this.hero.material.uniforms.uTime.value = t.value;
    this.weather.uniforms.uCenter.value.copy(this.camera.position);
    this.weather.tick(dt);
  }

  setAspect(a) {
    this.camera.aspect = a;
    this.weather.uniforms.uScale.value = window.innerHeight * Math.min(window.devicePixelRatio || 1, 2);
    this.baseFov = a < 1 ? 78 : 64;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param league  league def
   * @param trackDef track def
   * @param galaxy  theme galaxy
   * @param stats   {engine, accel, grip, tank, armor} levels
   * @param skin    ship skin
   * @param opts.upgrades all upgrade levels (upgradeLevels(prog)) shown on the pod; defaults to `stats`
   */
  load(league, trackDef, galaxy, stats, skin, opts = {}) {
    if (this.track) this.track.dispose(this.scene);
    this.league = league;
    this.trackDef = trackDef;
    this.track = new Track(trackDef, galaxy);
    this.track.build(this.scene);
    this.laps = trackDef.laps;
    this.drums = 0;
    this.totalLen = this.track.length * this.laps;
    this.feat = this.track.features;
    this.difficulty = Math.min(1, Math.max(0, opts.careerIndex || 0) / 8);
    this.tutorial = !!opts.tutorial;
    this.tutorialState = { cd: 4, corners: 0 };

    // Theme
    this._applyWorld(galaxy);
    this.stars.material.color.set(galaxy.colors.star);

    this.ship.setSkin(skin);
    this.ship.setUpgrades(opts.upgrades || stats);
    this.ship.reset();
    this.ship.setShielded(false);

    // Player stats from the Race Garage
    this.stats = {
      vMax: 40 * (1 + stats.engine * 0.09),
      accel: 0.42 * (1 + stats.accel * 0.15),
      grip: 1 + stats.grip * 0.12,
      boostMul: 1.33 + stats.tank * 0.035,
      charge: 1 + stats.tank * 0.2,
      spin: 1.0 * (1 - stats.armor * 0.3),
    };

    // Rival pods
    for (const m of this.podMeshes) { this.scene.remove(m); m.geometry.dispose(); }
    this.podMeshes = [];
    const rivals = league.rivals.map((id) => RIVALS.find((r) => r.id === id));

    const mk = (o) => Object.assign({
      s: 0, x: 0, vx: 0, v: 0, lap: 0, finished: false, time: 0, energy: 0.3, boostT: 0,
      spinT: 0, hitCd: 0, padCd: -1, steer: 0, drafting: false, lastPlace: 0, bob: Math.random() * 6,
      item: null, shieldT: 0, driftT: 0, turbo: false, onIce: false, aimX: 0, wobble: Math.random() * 6, mistakeT: 0,
    }, o);

    this.player = mk({ isPlayer: true, name: 'YOU', color: 0x3cf2ff, vMax: this.stats.vMax, accel: this.stats.accel, grip: this.stats.grip });
    this.racers = [this.player];
    rivals.forEach((r, i) => {
      const mesh = new THREE.Mesh(eggPodGeometry(r.color), this.podMat);
      mesh.scale.setScalar(1.25);
      this.scene.add(mesh);
      this.podMeshes.push(mesh);
      this.racers.push(mk({
        isPlayer: false, name: r.name, color: r.color, taunt: r.taunt, mesh,
        vMax: 40 * (trackDef.rival || 1) * (0.95 + i * 0.027) * (opts.assist ? 0.94 : 1),
        accel: 0.45 + this.difficulty * 0.15, grip: 1.05 + this.difficulty * 0.35,
        lane: (Math.random() * 2 - 1) * 2, padLove: Math.random(),
      }));
    });
    // Starting grid: two columns, staggered behind the line; player starts at the back-middle.
    const grid = [[-2.2, -4], [2.2, -8], [-2.2, -12], [2.2, -16], [0, -20]];
    const order = [1, 2, 3, 4, 0];
    order.forEach((ri, gi) => {
      const r = this.racers[ri];
      r.x = grid[gi][0];
      r.s = grid[gi][1];
      r.aimX = r.x;
    });

    for (const m of this.missiles) { m.active = false; m.mesh.visible = false; }
    for (const m of this.mines) { m.active = false; m.mesh.visible = false; }
    for (const e of this.henEggs) { e.active = false; e.mesh.visible = false; }
    this.hen = this.feat.has('motherHen') ? Object.assign(this.henModel, { t: 0, s: 0, x: 0, dropT: 3 }) : null;
    this.henModel.mesh.visible = !!this.hen;

    this.waiting = true;       // intro card shown until begin()
    this.paused = false;
    this.time = 0;
    this.countdown = COUNTDOWN;
    this.lastCount = 4;
    this.running = true;
    this.finished = false;
    this.finalLapAnnounced = false;
    this.playerPlace = 5;
    this._placeCd = 0;
    this._buildMinimap();
    this._placeCamera(1);
  }

  dispose() {
    if (this.track) this.track.dispose(this.scene);
    this.track = null;
    for (const m of this.podMeshes) { this.scene.remove(m); m.geometry.dispose(); }
    this.podMeshes = [];
    this.particles.clear();
    this.running = false;
  }

  // ---------------------------------------------------------------- minimap
  _buildMinimap() {
    const tr = this.track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of tr.P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    this.map = { minX, minZ, scale: 1 / Math.max(maxX - minX, maxZ - minZ) };
  }

  drawMinimap(ctx, size) {
    if (!this.track) return;
    const { minX, minZ, scale } = this.map;
    const pad = 8;
    const k = (size - pad * 2) * scale;
    const px = (p) => pad + (p.x - minX) * k;
    const pz = (p) => pad + (p.z - minZ) * k;
    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    const P = this.track.P;
    for (let i = 0; i < P.length; i += 4) { const p = P[i]; if (i === 0) ctx.moveTo(px(p), pz(p)); else ctx.lineTo(px(p), pz(p)); }
    ctx.closePath();
    ctx.stroke();
    const f = this._f;
    for (const r of this.racers) {
      this.track.frame(r.s, 0, f);
      ctx.fillStyle = r.isPlayer ? '#3cf2ff' : '#' + r.color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(px(f.p), pz(f.p), r.isPlayer ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (r.isPlayer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
  }

  // ---------------------------------------------------------------- update
  // Call after load(): starts the 3-2-1 countdown (the intro card waits for a tap).
  begin() { this.waiting = false; }

  // steer: -1..1 steering input (rate, not position); boost / item: button pressed this frame
  update(realDt, steer, boostPressed, itemPressed) {
    if (!this.running) return;
    const dt = Math.min(realDt, 1 / 30);
    this.track.update(dt);
    const e = this.events;

    if (this.waiting || this.paused) {
      this._placeRacers(0);
      this._placeCamera(dt);
      return;
    }
    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0 && n <= 3 && e.onCountdown) e.onCountdown(n);
        if (n <= 0 && e.onGo) e.onGo();
      }
      this._placeRacers(dt);
      this._placeCamera(dt);
      return;
    }

    if (!this.finished) this.time += dt;
    const p = this.player;
    // Smooth the raw input a little so buttons don't feel binary.
    const want = p.finished ? this._autoSteer(p) : steer;
    p.steer += (want - p.steer) * Math.min(1, dt * 10);
    if (!p.finished) {
      if (boostPressed && this.feat.has('boost') && p.energy > 0.05 && p.boostT <= 0 && p.spinT <= 0) {
        p.boostT = 1.2 + p.energy * 1.2;
        if (e.onBoost) e.onBoost();
      }
      if (itemPressed && p.item) this._useItem(p);
    }

    for (const r of this.racers) {
      if (!r.isPlayer) this._ai(r, dt);
      this._physics(r, dt);
    }
    this._updateProjectiles(dt);
    if (this.hen) this._updateHen(dt);
    this._collide(dt);
    this._rank();
    this._tutorial(dt);
    this._placeRacers(dt);
    this._placeCamera(dt);
  }

  // Steering needed to hold lateral position `ideal` (used by AI + post-finish autopilot).
  _autoSteer(r, ideal = 0, precision = 1) {
    const k = this.track.curvature(r.s + 4);
    const S = this._steerAuthority(r);
    const fc = r.v * r.v * k * CENTRIFUGAL;
    const u = (-fc + (ideal - r.x) * 5 - r.vx * 3.2) / S;
    return THREE.MathUtils.clamp(u * precision, -1, 1);
  }

  _steerAuthority(r) {
    let S = STEER * r.grip;
    if (r.onIce) S *= 0.4;
    return S;
  }

  _ai(r, dt) {
    const tr = this.track;
    const d = this.difficulty;
    const k = tr.curvature(r.s + 26);
    // Inside line in corners, personal lane on straights.
    let ideal = -Math.sign(k) * Math.min(1, Math.abs(k) * 70) * (TRACK_HALF - 1.6);
    if (Math.abs(k) < 0.004) ideal = r.lane;
    if (r.padLove > 0.35) {
      for (const pd of tr.pads) {
        const ds = this._ahead(r.s, pd.s);
        if (ds > 5 && ds < 30) { ideal = pd.x; break; }
      }
    }
    if (r.item === 'missile' || !r.item) {
      for (const b of tr.boxes) {
        const ds = this._ahead(r.s, b.s);
        if (ds > 5 && ds < 25 && b.respawn <= 0 && r.padLove > 0.5) { ideal = b.x; break; }
      }
    }
    const avoid = (ox, rad, ds) => {
      if (ds > 2 && ds < 38 && Math.abs(ideal - ox) < rad + 1.3) {
        ideal = ox + (ideal >= ox ? 1 : -1) * (rad + 1.6);
        if (Math.abs(ideal) > TRACK_HALF - 0.8) ideal = ox - Math.sign(ideal) * (rad + 1.6);
      }
    };
    for (const o of tr.obstacles) avoid(o.x, o.r, this._ahead(r.s, o.s));
    for (const ro of tr.rollers) avoid(tr.rollerX(ro), ro.r, this._ahead(r.s, ro.s));
    for (const mn of this.mines) avoid(mn.x, 0.6, this._ahead(r.s, mn.s));
    for (const w of tr.walls) {
      const ds = this._ahead(r.s, w.s);
      if (ds > 0 && ds < 40) ideal = w.x0 < 0 ? (TRACK_HALF - 0.4 + w.x1) / 2 + 0.6 : (w.x0 - TRACK_HALF + 0.4) / 2 - 0.6;
    }
    ideal = THREE.MathUtils.clamp(ideal, -(TRACK_HALF - 0.7), TRACK_HALF - 0.7);

    // Human-ish imperfection: reaction lag + wobble + rare mistakes on low difficulty.
    r.aimX += (ideal - r.aimX) * Math.min(1, dt * (2 + d * 6));
    r.wobble += dt * (0.7 + Math.random() * 0.6);
    let aim = r.aimX + Math.sin(r.wobble) * (1 - d) * 0.5;
    if (r.mistakeT > 0) { r.mistakeT -= dt; aim += r.mistakeDir * 3; }
    else if (Math.random() < dt * (1 - d) * 0.04) { r.mistakeT = 0.5; r.mistakeDir = Math.random() < 0.5 ? -1 : 1; }
    r.steer = this._autoSteer(r, aim, 0.9 + d * 0.1);

    // Corner speed: ease off so centrifugal force stays within grip.
    const kMax = Math.max(Math.abs(tr.curvature(r.s + 14)), Math.abs(tr.curvature(r.s + 30)));
    const safe = kMax > 1e-4 ? Math.sqrt((this._steerAuthority(r) * (0.9 + d * 0.08)) / (kMax * CENTRIFUGAL)) : 999;
    r.cornerCap = safe;

    // Rubber band: stragglers push hard, leaders only ease off a little.
    const gap = r.s - this.player.s;
    r.rubber = gap > 160 ? 0.97 : gap < -70 ? 1.12 : gap < -30 ? 1.05 : 1;

    if (this.feat.has('boost') && r.energy > 0.55 && Math.abs(k) < 0.003 && r.boostT <= 0 && Math.random() < dt * 1.5) {
      r.boostT = 1.2 + r.energy * 1.2;
    }
    if (r.item && this.feat.has('rivalItems')) this._aiItem(r, dt);
  }

  _aiItem(r, dt) {
    r.itemT = (r.itemT || 0) + dt;
    if (r.itemT < 1.2) return;
    if (r.item === 'shield') { this._useItem(r); return; }
    if (r.item === 'missile') {
      const target = this._racerAhead(r);
      if (target && target.s - r.s < 70 && Math.random() < dt * 1.5) this._useItem(r);
    } else if (r.item === 'mine') {
      const behind = this.racers.some((o) => o !== r && r.s - o.s > 3 && r.s - o.s < 30);
      if (behind && Math.random() < dt * 2) this._useItem(r);
    }
  }

  // distance from a to b going forward around the loop
  _ahead(a, b) {
    const L = this.track.length;
    return ((((b - a) % L) + L) % L);
  }

  _racerAhead(r) {
    let best = null;
    for (const o of this.racers) {
      if (o === r || o.finished) continue;
      const ds = o.s - r.s;
      if (ds > 0 && (!best || ds < best.s - r.s)) best = o;
    }
    return best;
  }

  _spin(r, dur, kind) {
    if (r.shieldT > 0) {
      r.shieldT = 0;
      if (r.isPlayer) this.ship.setShielded(false);
      if (r.isPlayer && this.events.onShieldBlock) this.events.onShieldBlock();
      return false;
    }
    r.spinT = dur;
    r.v *= 0.45;
    r.boostT = 0;
    r.hitCd = 1.2;
    this._frameOf(r, this._g);
    this.particles.burst(this._g.p.x, this._g.p.y + 0.4, this._g.p.z, 40, 9, 0.6, 0.5,
      kind === 'egg' ? [[1, 1, 0.95], [1, 0.8, 0.2]] : [[0.8, 0.75, 0.9], [1, 0.6, 0.2]], 2.5, 0);
    if (r.isPlayer && this.events.onCrash) this.events.onCrash(kind);
    return true;
  }

  _physics(r, dt) {
    const tr = this.track;
    const e = this.events;
    const L = tr.length;
    r.hitCd -= dt;
    r.spinT = Math.max(0, r.spinT - dt);
    r.shieldT = Math.max(0, (r.shieldT || 0) - dt);
    if (r.isPlayer && r.shieldT <= 0 && this.ship.shielded) this.ship.setShielded(false);

    // Surface
    r.onIce = false;
    for (const ic of tr.ice) {
      const ds = this._ahead(ic.s, r.s);
      if (ds < ic.len && Math.abs(r.x - ic.x) < ic.w / 2) { r.onIce = true; break; }
    }

    // Boost / drift turbo
    let mul = 1;
    if (r.boostT > 0) {
      r.boostT -= dt;
      if (!r.turbo) r.energy = Math.max(0, r.energy - dt * 0.5);
      if (r.energy <= 0 && !r.turbo) r.boostT = 0;
      mul = r.isPlayer ? (r.turbo ? 1.25 : this.stats.boostMul) : 1.3;
      if (r.boostT <= 0) r.turbo = false;
    }

    // Speed: auto-accelerate; hard steering scrubs speed (that's your brake).
    const scrub = 1 - Math.min(0.3, Math.abs(r.steer) * 0.22 * (r.v / 45));
    r.grind = Math.max(0, (r.grind || 0) - dt);
    let target = r.vMax * mul * (r.rubber || 1) * scrub * (r.spinT > 0 ? 0.35 : 1) * (r.onIce ? 0.92 : 1) * (r.grind > 0 ? 0.55 : 1);
    if (!r.isPlayer && r.cornerCap) target = Math.min(target, r.cornerCap * (r.rubber || 1));
    if (r.finished && !r.isPlayer) target *= 0.85;
    r.v += (target - r.v) * Math.min(1, (target > r.v ? r.accel : 1.4) * dt);

    // Lateral: steering thrust vs. centrifugal force. No steering in a corner = wall.
    const k = tr.curvature(r.s);
    const S = this._steerAuthority(r) * (r.spinT > 0 ? 0.15 : 1);
    const damp = r.onIce ? 0.7 : 2.4;
    let force = r.steer * S + r.v * r.v * k * CENTRIFUGAL - r.vx * damp;
    for (const wl of tr.wells) {
      const ds = Math.abs(this._ahead(r.s, wl.s) > L / 2 ? this._ahead(r.s, wl.s) - L : this._ahead(r.s, wl.s));
      if (ds < 14) {
        const dx = wl.x - r.x;
        force += Math.sign(dx) * 30 / (1 + dx * dx * 0.25) * (1 - ds / 14);
        if (Math.abs(dx) < 0.9 && ds < 1.5 && r.hitCd <= 0) this._spin(r, 0.8, 'rock');
      }
    }
    r.vx += force * dt;
    r.x += r.vx * dt;

    // Drift turbo: hold a hard turn through a corner, release to fire a mini-boost.
    if (this.feat.has('drift') && r.isPlayer) {
      if (Math.abs(r.steer) > 0.7 && Math.abs(k) > 0.006 && r.spinT <= 0) {
        r.driftT += dt;
        if (r.driftT > 0.5 && Math.random() < 0.6) {
          this._frameOf(r, this._g);
          const lvl = r.driftT > 1.4 ? [1, 0.4, 1] : r.driftT > 0.9 ? [1, 0.6, 0.2] : [0.4, 0.9, 1];
          this.particles.emit(this._g.p.x, this._g.p.y + 0.2, this._g.p.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.3, 0.5, lvl[0], lvl[1], lvl[2], 2, 0);
        }
      } else if (Math.abs(r.steer) < 0.35) {
        if (r.driftT > 0.5) {
          r.turbo = true;
          r.boostT = Math.min(1.6, 0.4 + r.driftT * 0.6);
          if (e.onDriftTurbo) e.onDriftTurbo(r.driftT);
        }
        r.driftT = 0;
      }
    }

    // Walls: fast impacts crash you, slow grinding just slows you.
    const lim = TRACK_HALF;
    if (Math.abs(r.x) > lim) {
      const impact = Math.abs(r.vx);
      r.x = Math.sign(r.x) * lim;
      const side = Math.sign(r.x);
      if (impact > 1.8 && r.hitCd <= 0) {
        r.v *= 0.55;
        r.spinT = r.isPlayer ? 0.45 * this.stats.spin : 0.4;
        r.hitCd = 0.8;
        r.boostT = 0;
        if (r.isPlayer && e.onWall) e.onWall(true);
        this._frameOf(r, this._g);
        this.particles.burst(this._g.p.x, this._g.p.y + 0.3, this._g.p.z, 30, 9, 0.5, 0.35, [[1, 0.8, 0.3], [1, 1, 1], [1, 0.4, 0.2]], 3, 0);
        r.vx = -side * 5;   // bounce back onto the track
      } else {
        r.grind = 0.25;
        if (r.isPlayer && Math.random() < 0.5) {
          this._frameOf(r, this._g);
          this.particles.burst(this._g.p.x, this._g.p.y + 0.2, this._g.p.z, 3, 6, 0.3, 0.25, [[1, 0.8, 0.3], [1, 1, 1]], 3, 0);
          if (e.onWall) e.onWall(false);
        }
      }
      if (r.hitCd < 0.75) r.vx = Math.min(Math.abs(r.vx) * 0.35, 3) * -side;
    }

    const prevS = r.s;
    r.s += r.v * dt;
    const crossed = (objS, pad = 0) => this._ahead(prevS, objS) <= r.v * dt + pad;

    // Laps
    const lap = Math.floor(Math.max(0, r.s) / L);
    if (lap > r.lap) {
      r.lap = lap;
      if (r.isPlayer) for (const d of tr.drums) d.taken = false;
      if (r.isPlayer && lap < this.laps && e.onLap) e.onLap(lap + 1);
      if (r.isPlayer && lap === this.laps - 1 && !this.finalLapAnnounced) { this.finalLapAnnounced = true; if (e.onFinalLap) e.onFinalLap(); }
    }
    if (!r.finished && r.s >= this.totalLen) {
      r.finished = true;
      r.time = this.time;
      if (r.isPlayer) this._finish();
    }

    // Boost pads
    for (let i = 0; i < tr.pads.length; i++) {
      const pd = tr.pads[i];
      if (crossed(pd.s) && Math.abs(r.x - pd.x) < 1.6 && r.padCd !== i) {
        r.padCd = i;
        r.energy = Math.min(1, r.energy + 0.4 * (r.isPlayer ? this.stats.charge : 1));
        r.v += 4;
        if (r.isPlayer && e.onPad) e.onPad();
      }
    }

    // Drumsticks (player only)
    if (r.isPlayer) {
      for (const d of tr.drums) {
        if (!d.taken && crossed(d.s, 0.5) && Math.abs(r.x - d.x) < 1.3) {
          d.taken = true;
          this.drums++;
          this._frameOf(r, this._g);
          this.particles.burst(this._g.p.x, this._g.p.y + 1, this._g.p.z, 10, 4, 0.4, 0.3, [[1, 0.7, 0.3], [1, 0.9, 0.5]], 2, 0);
          if (e.onDrum) e.onDrum(this.drums);
        }
      }
    }

    // Item boxes
    for (const b of tr.boxes) {
      if (b.respawn <= 0 && crossed(b.s) && Math.abs(r.x - b.x) < 1.2) {
        b.respawn = 3;
        this._frameOf(r, this._g);
        this.particles.burst(this._g.p.x, this._g.p.y + 0.9, this._g.p.z, 20, 5, 0.5, 0.35, [[1, 0.85, 0.3], [1, 1, 1]], 3, 0);
        if (!r.item) {
          r.item = this._rollItem();
          r.itemT = 0;
          if (r.isPlayer && e.onItem) e.onItem(r.item);
        }
      }
    }

    // Obstacles, rolling eggs, chicane barriers, mines
    if (r.hitCd <= 0) {
      for (const o of tr.obstacles) {
        if (crossed(o.s, 0.6) && Math.abs(r.x - o.x) < o.r + 0.45) { this._spin(r, r.isPlayer ? this.stats.spin : 0.9, o.egg ? 'egg' : 'rock'); break; }
      }
    }
    if (r.hitCd <= 0) {
      for (const ro of tr.rollers) {
        if (crossed(ro.s, 0.8) && Math.abs(r.x - tr.rollerX(ro)) < ro.r + 0.5) { this._spin(r, r.isPlayer ? this.stats.spin : 0.9, 'egg'); break; }
      }
    }
    if (r.hitCd <= 0) {
      for (const w of tr.walls) {
        if (crossed(w.s, 0.4) && r.x > w.x0 - 0.45 && r.x < w.x1 + 0.45) {
          r.v *= 0.5; r.spinT = 0.5; r.hitCd = 1; r.boostT = 0;
          if (r.isPlayer && e.onWall) e.onWall(true);
          break;
        }
      }
    }
    for (const mn of this.mines) {
      if (!mn.active || (mn.owner === r && mn.age < 1)) continue;
      if (crossed(mn.s, 0.6) && Math.abs(r.x - mn.x) < 1.0) {
        mn.active = false;
        this._spin(r, 1.0, 'egg');
      }
    }

    // Drafting: tuck in behind someone to charge boost.
    r.drafting = false;
    if (this.feat.has('draft')) {
      for (const o of this.racers) {
        if (o === r) continue;
        const ds = o.s - r.s;
        if (ds > 1.5 && ds < DRAFT_DIST && Math.abs(o.x - r.x) < 1.3) {
          r.drafting = true;
          r.energy = Math.min(1, r.energy + dt * 0.22 * (r.isPlayer ? this.stats.charge : 1));
          r.v += dt * 3;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- items
  _rollItem() {
    const pool = ['missile', 'missile'];
    if (this.feat.has('shield')) pool.push('shield');
    if (this.feat.has('mine')) pool.push('mine');
    return pool[(Math.random() * pool.length) | 0];
  }

  _useItem(r) {
    const it = r.item;
    r.item = null;
    const e = this.events;
    if (it === 'missile') {
      const target = this._racerAhead(r);
      const m = this.missiles.find((o) => !o.active);
      if (m) {
        Object.assign(m, { active: true, s: r.s + 1.5, x: r.x, owner: r, target, t: 0 });
        m.mesh.visible = true;
      }
      if (r.isPlayer && e.onFire) e.onFire(target);
      if (!r.isPlayer && target && target.isPlayer && e.onIncoming) e.onIncoming(r);
    } else if (it === 'shield') {
      r.shieldT = 8;
      if (r.isPlayer) { this.ship.setShielded(true); if (e.onShield) e.onShield(); }
    } else if (it === 'mine') {
      const mn = this.mines.find((o) => !o.active);
      if (mn) {
        Object.assign(mn, { active: true, s: r.s - 3, x: r.x, owner: r, age: 0 });
        mn.mesh.visible = true;
      }
      if (r.isPlayer && e.onMine) e.onMine();
    }
    if (r.isPlayer && e.onItem) e.onItem(null);
  }

  _updateProjectiles(dt) {
    const f = this._f;
    for (const m of this.missiles) {
      if (!m.active) continue;
      m.t += dt;
      const owner = m.owner;
      const tgt = m.target;
      m.s += (Math.max(owner.v, 30) + 28) * dt;
      if (tgt) m.x += (tgt.x - m.x) * Math.min(1, dt * 4);
      this.track.frame(m.s, m.x, f);
      m.mesh.position.copy(f.p).addScaledVector(f.u, 0.9);
      m.mesh.rotation.x += dt * 10;
      this.particles.emit(m.mesh.position.x, m.mesh.position.y, m.mesh.position.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.35, 0.5, 1, 0.9, 0.5, 1, 0);
      if (tgt && Math.abs(tgt.s - m.s) < 2 && Math.abs(tgt.x - m.x) < 1.3) {
        m.active = false; m.mesh.visible = false;
        const spun = this._spin(tgt, 1.1, 'egg');
        if (owner.isPlayer && spun && this.events.onHitRival) this.events.onHitRival(tgt);
      } else if (m.t > 4 || (tgt && m.s > tgt.s + 20)) {
        m.active = false; m.mesh.visible = false;
      }
    }
    for (const mn of this.mines) {
      if (!mn.active) continue;
      mn.age += dt;
      if (mn.age > 25) { mn.active = false; mn.mesh.visible = false; continue; }
      this.track.frame(mn.s, mn.x, f);
      mn.mesh.position.copy(f.p).addScaledVector(f.u, 0.45);
      mn.mesh.material.emissiveIntensity = 0.6 + (Math.sin(mn.age * 10) > 0 ? 1.2 : 0);
    }
    for (const mn of this.mines) if (!mn.active) mn.mesh.visible = false;
  }

  // ---------------------------------------------------------------- Mother Hen (final race)
  _updateHen(dt) {
    const h = this.hen;
    const p = this.player;
    const f = this._f;
    h.t += dt;
    h.s = p.s + 40;
    h.x = Math.sin(h.t * 0.6) * 3;
    this.track.frame(h.s, h.x, f);
    h.mesh.position.copy(f.p).addScaledVector(f.u, 8 + Math.sin(h.t * 2) * 0.5);
    h.mesh.lookAt(this.camera.position);
    h.wingL.rotation.z = h.wingR.rotation.z = Math.sin(h.t * 7) * 0.5;
    h.dropT -= dt;
    if (h.dropT <= 0 && !p.finished) {
      h.dropT = 1.1;
      const egg = this.henEggs.find((o) => !o.active);
      if (egg) {
        const tx = THREE.MathUtils.clamp(p.x + (Math.random() - 0.5) * 3, -TRACK_HALF + 0.8, TRACK_HALF - 0.8);
        Object.assign(egg, { active: true, s: h.s, x: h.x, tx, y: 8, t: 0, landed: false });
        egg.mesh.visible = true;
        if (this.events.onHenDrop) this.events.onHenDrop();
      }
    }
    for (const egg of this.henEggs) {
      if (!egg.active) continue;
      egg.t += dt;
      if (!egg.landed) {
        const k = Math.min(1, egg.t / 0.9);
        egg.x += (egg.tx - egg.x) * Math.min(1, dt * 4);
        egg.y = 8 * (1 - k * k);
        if (k >= 1) { egg.landed = true; egg.t = 0; }
      }
      this.track.frame(egg.s, egg.x, f);
      egg.mesh.position.copy(f.p).addScaledVector(f.u, egg.landed ? 0.05 : egg.y + 0.4);
      egg.mesh.scale.set(egg.landed ? 1.4 : 0.5, egg.landed ? 0.15 : 0.65, egg.landed ? 1.4 : 0.5);
      if (egg.landed) {
        for (const r of this.racers) {
          if (r.hitCd <= 0 && Math.abs(r.s - egg.s) < 1.2 && Math.abs(r.x - egg.x) < 1.1) this._spin(r, 0.9, 'egg');
        }
        if (egg.t > 12 || p.s - egg.s > 30) { egg.active = false; egg.mesh.visible = false; }
      }
    }
  }

  // ---------------------------------------------------------------- tutorial prompts (race 1)
  _tutorial(dt) {
    if (!this.tutorial || this.player.finished) return;
    const tu = this.tutorialState;
    tu.cd -= dt;
    if (tu.cd > 0) return;
    const p = this.player;
    const k = this.track.curvature(p.s + 30);
    if (Math.abs(k) > 0.008 && tu.corners < 3) {
      tu.corners++;
      tu.cd = 6;
      if (this.events.onHint) this.events.onHint(k > 0 ? '◀ CORNER! HOLD LEFT' : 'CORNER! HOLD RIGHT ▶');
    }
  }

  _collide() {
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        const ds = b.s - a.s;
        const dx = b.x - a.x;
        if (Math.abs(ds) < 1.8 && Math.abs(dx) < 1.15) {
          const push = (1.15 - Math.abs(dx)) * 0.5 * (dx >= 0 ? 1 : -1);
          a.x -= push; b.x += push;
          a.vx -= push * 8; b.vx += push * 8;
          // The one behind loses a little speed.
          if (ds > 0) a.v *= 0.97; else b.v *= 0.97;
          if ((a.isPlayer || b.isPlayer) && this.events.onBump && (this._bumpCd || 0) <= 0) {
            this._bumpCd = 0.5;
            this.events.onBump();
          }
        }
      }
    }
    this._bumpCd = (this._bumpCd || 0) - 1 / 60;
  }

  _rank() {
    const order = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.time - b.time;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.s - a.s;
    });
    order.forEach((r, i) => { r.place = i + 1; });
    const p = this.player;
    if (p.place < p.lastPlace && p.lastPlace && !this.finished) {
      const passed = order[p.place]; // the one just behind us
      if (passed && this.events.onOvertake) this.events.onOvertake(passed);
    }
    p.lastPlace = p.place;
    this.playerPlace = p.place;
  }

  _finish() {
    this.finished = true;
    // Estimate finish times for everyone still racing from their pace.
    const results = this.racers.map((r) => {
      let t = r.time;
      if (!r.finished) {
        const remaining = this.totalLen - r.s;
        t = this.time + remaining / Math.max(10, r.v);
      }
      return { name: r.name, isPlayer: r.isPlayer, color: r.color, time: t };
    }).sort((a, b) => a.time - b.time);
    results.forEach((r, i) => { r.place = i + 1; });
    this.results = results;
    this.playerPlace = results.findIndex((r) => r.isPlayer) + 1;
    if (this.events.onFinish) this.events.onFinish(results, this.playerPlace);
  }

  _frameOf(r, f) { return this.track.frame(r.s, r.x, f); }

  _placeRacers(dt) {
    const f = this._f;
    const back = this._back;
    for (const r of this.racers) {
      r.bob += dt * 3;
      this.track.frame(r.s, r.x, f);
      f.p.addScaledVector(f.u, 0.7 + Math.sin(r.bob) * 0.08);
      back.copy(f.t).negate();
      this._m.makeBasis(f.r, f.u, back);
      const obj = r.isPlayer ? this.playerRoot : r.mesh;
      obj.position.copy(f.p);
      obj.quaternion.setFromRotationMatrix(this._m);
      const bank = THREE.MathUtils.clamp(-r.vx * 0.08, -0.7, 0.7);
      const yaw = THREE.MathUtils.clamp(-Math.atan2(r.vx, Math.max(8, r.v)) * 1.4, -0.6, 0.6);
      if (r.isPlayer) {
        this.ship.model.rotation.z += (bank - this.ship.model.rotation.z) * Math.min(1, dt * 10);
        this.ship.model.rotation.y = r.spinT > 0 ? r.spinT * 12 : yaw;
        this.ship.shield.visible = r.shieldT > 0;
        this.ship.shieldMat.uniforms.uAlpha.value = r.shieldT > 0 ? 0.9 : 0;
        this.ship.shieldMat.uniforms.uTime.value += dt;
        const flick = 0.85 + Math.random() * 0.3;
        const s = (r.boostT > 0 ? 1.8 : 1.1) * flick;
        this.ship.setThrust(s);
        this.ship.animate(dt);
      } else {
        obj.rotateY(r.spinT > 0 ? r.spinT * 12 : yaw);
        obj.rotateZ(bank);
      }
      // Engine trail
      if (this.running && this.countdown <= 0 && Math.random() < 0.9) {
        const c = r.isPlayer ? this.ship.trailColor : [1, 0.6, 0.2];
        const bx = f.p.x - f.t.x * 1.3, by = f.p.y - f.t.y * 1.3, bz = f.p.z - f.t.z * 1.3;
        const boost = (r.boostT > 0 ? 1.6 : 1) * (r.isPlayer ? (this.ship.trailBoost || 1) : 1);
        this.particles.emit(bx, by, bz, -f.t.x * 4 + (Math.random() - 0.5), (Math.random() - 0.5) * 0.5, -f.t.z * 4 + (Math.random() - 0.5),
          0.35 * boost, 0.6 * boost, c[0], c[1], c[2], 1, 0);
      }
    }
    this.particles.update(dt, 0);
  }

  _placeCamera(dt) {
    const p = this.player;
    const f = this._f;
    this.track.frame(p.s - 8, p.x * 0.6, f);
    this._camPos.copy(f.p).addScaledVector(f.u, 3.1);
    const g = this._g;
    this.track.frame(p.s + 12, p.x * 0.35, g);
    this._camLook.copy(g.p).addScaledVector(g.u, 0.8);
    const k = dt >= 1 ? 1 : 1 - Math.exp(-dt * 9);
    this.camera.position.lerp(this._camPos, k);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      const s = this.shake * this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.up.copy(f.u);
    this.camera.lookAt(this._camLook);
    const speedN = Math.min(1, p.v / 60);
    const fov = (this.baseFov || 70) + speedN * 8 + (p.boostT > 0 ? 8 : 0);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
    this._updateWorld(Math.min(dt, 0.1));
  }

  // HUD snapshot
  get hud() {
    const p = this.player;
    return {
      place: this.playerPlace,
      total: this.racers.length,
      lap: Math.min(this.laps, p.lap + 1),
      laps: this.laps,
      speed: Math.round(p.v * 6),
      energy: p.energy,
      boosting: p.boostT > 0,
      drafting: p.drafting,
      time: this.time,
      countdown: this.countdown,
      item: p.item,
      drift: p.driftT,
      onIce: p.onIce,
      drums: this.drums,
    };
  }
}
