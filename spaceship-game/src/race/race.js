import * as THREE from 'three';
import { Track, TRACK_HALF } from './track.js';
import { RIVALS } from './leagues.js';
import { Ship } from '../ship.js';
import { Particles } from '../particles.js';
import { eggPodGeometry } from '../geo.js';

const COUNTDOWN = 3.2;
const DRAFT_DIST = 9;

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
    this._buildBackdrop();

    // Player ship lives inside a root that we orient along the track.
    this.ship = new Ship(this.scene);
    this.playerRoot = new THREE.Group();
    this.playerRoot.add(this.ship.group);
    this.scene.add(this.playerRoot);
    this.ship.engineLight.intensity = 6;

    this.podMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25, flatShading: true });
    this.podMeshes = [];

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

  _buildBackdrop() {
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

    this.planetMat = new THREE.MeshStandardMaterial({ color: 0x2fd6c3, emissive: 0x0a3a44, roughness: 0.8, fog: false });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), this.planetMat);
    this.planet.position.set(-500, 140, -600);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.4, side: THREE.DoubleSide, fog: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(170, 250, 64), this.ringMat);
    ring.rotation.x = -Math.PI / 2.4;
    this.planet.add(ring);
    this.scene.add(this.planet);
  }

  setAspect(a) {
    this.camera.aspect = a;
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
   */
  load(league, trackDef, galaxy, stats, skin) {
    if (this.track) this.track.dispose(this.scene);
    this.league = league;
    this.trackDef = trackDef;
    this.track = new Track(trackDef, galaxy);
    this.track.build(this.scene);
    this.laps = trackDef.laps;
    this.totalLen = this.track.length * this.laps;

    // Theme
    this.scene.background.set(galaxy.colors.bg);
    this.scene.fog.color.set(galaxy.colors.bg);
    this.hemi.color.set(galaxy.colors.sky);
    this.stars.material.color.set(galaxy.colors.star);
    this.planetMat.color.set(galaxy.planet.a);
    this.planetMat.emissive.set(galaxy.planet.b).multiplyScalar(0.4);
    this.ringMat.color.set(galaxy.planet.ring);

    this.ship.setSkin(skin);
    this.ship.reset();
    this.ship.setShielded(false);

    // Player stats from the Race Garage
    this.stats = {
      vMax: 40 * (1 + stats.engine * 0.09),
      accel: 0.42 * (1 + stats.accel * 0.15),
      slip: 0.55 * (1 - stats.grip * 0.14),
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
      spinT: 0, hitCd: 0, padCd: -1, targetX: 0, drafting: false, lastPlace: 0, bob: Math.random() * 6,
    }, o);

    this.player = mk({ isPlayer: true, name: 'YOU', color: 0x3cf2ff, vMax: this.stats.vMax, accel: this.stats.accel, slip: this.stats.slip });
    this.racers = [this.player];
    rivals.forEach((r, i) => {
      const mesh = new THREE.Mesh(eggPodGeometry(r.color), this.podMat);
      mesh.scale.setScalar(1.25);
      this.scene.add(mesh);
      this.podMeshes.push(mesh);
      this.racers.push(mk({
        isPlayer: false, name: r.name, color: r.color, taunt: r.taunt, mesh,
        vMax: league.baseSpeed * league.skill[i], accel: 0.45, slip: 0.4,
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
      r.targetX = r.x;
    });

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
  // steerX: desired lateral position in -1..1; boost: boolean (button held/tapped)
  update(realDt, steerX, boostPressed) {
    if (!this.running) return;
    const dt = realDt;
    this.track.update(dt);
    const e = this.events;

    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0 && n <= 3 && e.onCountdown) e.onCountdown(n);
        if (n <= 0 && e.onGo) e.onGo();
      }
      this.player.targetX = steerX * (TRACK_HALF - 0.6);
      this._placeRacers(dt);
      this._placeCamera(dt);
      return;
    }

    if (!this.finished) this.time += dt;
    const p = this.player;
    if (!p.finished) {
      p.targetX = steerX * (TRACK_HALF - 0.6);
      if (boostPressed && p.energy > 0.05 && p.boostT <= 0 && p.spinT <= 0) {
        p.boostT = 1.2 + p.energy * 1.2;
        if (e.onBoost) e.onBoost();
      }
    } else {
      p.targetX = 0; // autopilot after the flag
    }

    for (const r of this.racers) {
      if (!r.isPlayer) this._ai(r);
      this._physics(r, dt);
    }
    this._collide(dt);
    this._rank();
    this._placeRacers(dt);
    this._placeCamera(dt);
  }

  _ai(r) {
    const tr = this.track;
    const k = tr.curvature(r.s + 22);
    // Take the inside line in corners, personal lane on straights.
    let ideal = -Math.sign(k) * Math.min(1, Math.abs(k) * 70) * (TRACK_HALF - 1.4);
    if (Math.abs(k) < 0.004) ideal = r.lane;
    // Grab a boost pad if it's close and roughly on the way.
    if (r.padLove > 0.35) {
      for (const pd of tr.pads) {
        const ds = this._ahead(r.s, pd.s);
        if (ds > 5 && ds < 30) { ideal = pd.x; break; }
      }
    }
    // Dodge obstacles ahead.
    for (const o of tr.obstacles) {
      const ds = this._ahead(r.s, o.s);
      if (ds > 2 && ds < 36 && Math.abs(ideal - o.x) < o.r + 1.3) {
        ideal = o.x + (ideal >= o.x ? 1 : -1) * (o.r + 1.6);
        if (Math.abs(ideal) > TRACK_HALF - 0.8) ideal = o.x - Math.sign(ideal) * (o.r + 1.6);
      }
    }
    r.targetX = THREE.MathUtils.clamp(ideal, -(TRACK_HALF - 0.7), TRACK_HALF - 0.7);
    // Rubber band so races stay exciting either way.
    const gap = r.s - this.player.s;
    r.rubber = gap > 120 ? 0.93 : gap < -120 ? 1.08 : 1;
    r.brake = 1 - Math.min(0.16, Math.abs(tr.curvature(r.s + 10)) * 5);
    if (r.energy > 0.6 && Math.abs(k) < 0.003 && r.boostT <= 0 && Math.random() < 0.02) r.boostT = 1.2 + r.energy * 1.2;
  }

  // distance from a to b going forward around the loop
  _ahead(a, b) {
    const L = this.track.length;
    return ((((b - a) % L) + L) % L);
  }

  _physics(r, dt) {
    const tr = this.track;
    const e = this.events;
    const L = tr.length;
    r.hitCd -= dt;
    r.spinT = Math.max(0, r.spinT - dt);

    // Boost
    let mul = 1;
    if (r.boostT > 0) {
      r.boostT -= dt;
      r.energy = Math.max(0, r.energy - dt * 0.5);
      if (r.energy <= 0) r.boostT = 0;
      mul = r.isPlayer ? this.stats.boostMul : 1.3;
    }
    const off = Math.abs(r.x) > TRACK_HALF - 0.3;
    let target = r.vMax * mul * (r.rubber || 1) * (r.brake || 1) * (r.spinT > 0 ? 0.35 : 1) * (off ? 0.8 : 1);
    if (r.finished && !r.isPlayer) target *= 0.8;
    r.v += (target - r.v) * Math.min(1, (target > r.v ? r.accel : 1.6) * dt);

    // Lateral: steering spring + centrifugal drift in corners.
    const k = tr.curvature(r.s);
    const kk = 70 * (r.spinT > 0 ? 0.2 : 1);
    const d = 2 * Math.sqrt(kk);
    const drift = r.v * r.v * k * r.slip * 6;
    r.vx += ((r.targetX - r.x) * kk - r.vx * d + drift) * dt;
    r.x += r.vx * dt;
    // Walls
    const lim = TRACK_HALF;
    if (Math.abs(r.x) > lim) {
      r.x = Math.sign(r.x) * lim;
      r.vx = -r.vx * 0.3;
      r.v *= 1 - 1.2 * dt;
      if (r.isPlayer && Math.random() < 0.5) {
        this._frameOf(r, this._g);
        this.particles.burst(this._g.p.x, this._g.p.y + 0.2, this._g.p.z, 3, 6, 0.3, 0.25, [[1, 0.8, 0.3], [1, 1, 1]], 3, 0);
        if (e.onScrape) e.onScrape();
      }
    }

    const prevS = r.s;
    r.s += r.v * dt;

    // Laps
    const lap = Math.floor(Math.max(0, r.s) / L);
    if (lap > r.lap) {
      r.lap = lap;
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
      const crossed = this._ahead(prevS, pd.s) <= r.v * dt + 0.01;
      if (crossed && Math.abs(r.x - pd.x) < 1.6 && r.padCd !== i) {
        r.padCd = i;
        r.energy = Math.min(1, r.energy + 0.4 * (r.isPlayer ? this.stats.charge : 1));
        r.v += 4;
        if (r.isPlayer && e.onPad) e.onPad();
      }
    }

    // Obstacles
    if (r.hitCd <= 0) {
      for (const o of tr.obstacles) {
        const ds = this._ahead(prevS, o.s);
        if (ds <= r.v * dt + 0.6 && Math.abs(r.x - o.x) < o.r + 0.45) {
          r.hitCd = 1.2;
          r.spinT = r.isPlayer ? this.stats.spin : 0.9;
          r.v *= 0.45;
          r.boostT = 0;
          this._frameOf(r, this._g);
          this.particles.burst(this._g.p.x, this._g.p.y + 0.4, this._g.p.z, 40, 9, 0.6, 0.5,
            o.egg ? [[1, 1, 0.95], [1, 0.8, 0.2]] : [[0.8, 0.75, 0.9], [1, 0.6, 0.2]], 2.5, 0);
          if (r.isPlayer && e.onCrash) e.onCrash(o.egg);
          break;
        }
      }
    }

    // Drafting: tuck in behind someone to charge boost.
    r.drafting = false;
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
      if (r.isPlayer) {
        this.ship.model.rotation.z += (bank - this.ship.model.rotation.z) * Math.min(1, dt * 10);
        this.ship.model.rotation.y = r.spinT > 0 ? r.spinT * 12 : 0;
        const flick = 0.85 + Math.random() * 0.3;
        const s = (r.boostT > 0 ? 1.8 : 1.1) * flick;
        for (const n of this.ship.nozzles) n.scale.setScalar(s);
      } else {
        obj.rotateZ(bank);
        if (r.spinT > 0) obj.rotateY(r.spinT * 12);
      }
      // Engine trail
      if (this.running && this.countdown <= 0 && Math.random() < 0.9) {
        const c = r.isPlayer ? this.ship.trailColor : [1, 0.6, 0.2];
        const bx = f.p.x - f.t.x * 1.3, by = f.p.y - f.t.y * 1.3, bz = f.p.z - f.t.z * 1.3;
        const boost = r.boostT > 0 ? 1.6 : 1;
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
    };
  }
}
