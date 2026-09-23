import * as THREE from 'three';
import { CONFIG } from './config.js';
import { chickenBodyGeometry, wingGeometry, mergeColored, tf, cornGeometry } from './geo.js';
import { CORN } from './pickups.js';

const BOSS_Z = -36;
const BOSS_Y = 2.6;
const PLANE_Y = -0.3;

// A giant hen that hovers ahead, sways across the lanes and attacks with egg
// barrages, summoned flocks, thrown props and telegraphed grill lasers.
// You can't shoot — grab corn cobs and they launch homing corn missiles at it.
export class Boss {
  constructor(scene, particles, chickens, obstacles, pickups) {
    this.particles = particles;
    this.chickens = chickens;
    this.obstacles = obstacles;
    this.pickups = pickups;
    this.active = false;
    this.defeated = false;

    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true, emissive: 0x000000 });
    this.body = new THREE.Mesh(chickenBodyGeometry(), this.bodyMat);
    this.group.add(this.body);
    this.wingR = new THREE.Mesh(wingGeometry(), this.bodyMat);
    this.wingL = new THREE.Mesh(wingGeometry(), this.bodyMat);
    this.wingR.position.set(0.38, 0.22, -0.05);
    this.wingL.position.set(-0.38, 0.22, -0.05);
    this.wingL.rotation.y = Math.PI;
    this.group.add(this.wingR, this.wingL);

    // Angry eyebrows — every boss hen has them.
    const brows = mergeColored([
      { geo: tf(new THREE.BoxGeometry(0.2, 0.04, 0.04), { r: [0, 0, -0.5], p: [0.15, 0.68, 0.6] }), color: 0x111111 },
      { geo: tf(new THREE.BoxGeometry(0.2, 0.04, 0.04), { r: [0, 0, 0.5], p: [-0.15, 0.68, 0.6] }), color: 0x111111 },
    ]);
    const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, flatShading: true });
    this.group.add(new THREE.Mesh(brows, propMat));

    this.props = {
      ufo: new THREE.Group(),
      chef: new THREE.Mesh(mergeColored([
        { geo: tf(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 10), { p: [0, 0.95, 0.3] }), color: 0xffffff },
        { geo: tf(new THREE.IcosahedronGeometry(0.26, 1), { s: [1, 0.7, 1], p: [0, 1.12, 0.3] }), color: 0xffffff },
        { geo: tf(new THREE.CylinderGeometry(0.35, 0.3, 0.06, 14), { p: [1.35, 0.2, 0.2] }), color: 0x2b2b2b },
        { geo: tf(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), { r: [0, 0, Math.PI / 2], p: [0.95, 0.2, 0.2] }), color: 0x5a3a1a },
      ]), propMat),
      ice: new THREE.Mesh(mergeColored([
        ...[-0.16, -0.05, 0.06, 0.17].map((x, i) => ({
          geo: tf(new THREE.ConeGeometry(0.06, 0.28 + (i % 2) * 0.1, 4), { p: [x, 0.98, 0.3] }), color: 0x9fe8ff,
        })),
        { geo: tf(new THREE.TorusGeometry(0.2, 0.04, 5, 12), { r: [Math.PI / 2, 0, 0], p: [0, 0.86, 0.3] }), color: 0xcff6ff },
      ]), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x1a5a8a, roughness: 0.1, metalness: 0.2, flatShading: true })),
      crown: new THREE.Mesh(mergeColored([
        { geo: tf(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 10), { p: [0, 0.92, 0.3] }), color: 0xffd35c },
        ...[0, 1, 2, 3, 4].map((i) => ({
          geo: tf(new THREE.ConeGeometry(0.05, 0.18, 4), { p: [Math.cos(i * 1.256) * 0.18, 1.06, 0.3 + Math.sin(i * 1.256) * 0.18] }), color: 0xffd35c,
        })),
        { geo: tf(new THREE.IcosahedronGeometry(0.05, 0), { p: [0, 0.94, 0.52] }), color: 0xff2a5c },
        { geo: tf(new THREE.ConeGeometry(0.55, 1.0, 6, 1, true), { s: [1, 1, 0.35], r: [0.25, 0, 0], p: [0, 0.05, -0.5] }), color: 0xb0122c },
      ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6, flatShading: true, side: THREE.DoubleSide })),
    };
    // UFO: saucer + glass dome
    const saucer = new THREE.Mesh(mergeColored([
      { geo: tf(new THREE.CylinderGeometry(1.25, 0.9, 0.22, 20), { p: [0, -0.62, 0] }), color: 0x9aa6b8 },
      { geo: tf(new THREE.CylinderGeometry(0.9, 0.5, 0.2, 20), { p: [0, -0.82, 0] }), color: 0x5d6778 },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        geo: tf(new THREE.IcosahedronGeometry(0.07, 0), { p: [Math.cos(i * 0.785) * 1.12, -0.6, Math.sin(i * 0.785) * 1.12] }),
        color: i % 2 ? 0xffd35c : 0x3cf2ff,
      })),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.3, emissive: 0x111822, flatShading: true }));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
      color: 0x9ff8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false,
    }));
    dome.position.y = -0.55;
    this.props.ufo.add(saucer, dome);
    for (const p of Object.values(this.props)) { p.visible = false; this.group.add(p); }

    // Grill lasers: floor telegraph strip + beam, two of each.
    this.lasers = [];
    for (let i = 0; i < 2; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), new THREE.MeshBasicMaterial({
        color: 0xff2a1f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      strip.rotation.x = -Math.PI / 2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3, 1), new THREE.MeshBasicMaterial({
        color: 0xff5a2c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      strip.visible = beam.visible = false;
      scene.add(strip, beam);
      this.lasers.push({ strip, beam, state: 0, t: 0, x: 0 });
    }

    // Corn missiles (small pool)
    const missileGeo = cornGeometry();
    missileGeo.scale(0.8, 0.8, 0.8);
    missileGeo.rotateX(-Math.PI / 2);
    const missileMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffa21f, emissiveIntensity: 1.5, flatShading: true });
    this.missiles = [];
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(missileGeo, missileMat);
      mesh.visible = false;
      scene.add(mesh);
      this.missiles.push({ active: false, mesh, t: 0, x0: 0, y0: 0, z0: 0, side: 1 });
    }

    this.onHit = null;        // (hpFraction) => void
    this.onDefeated = null;   // () => void
    this.onAttack = null;     // (kind) => void  (for sounds)
    this._v = new THREE.Vector3();
  }

  start(spec, level, tintHex) {
    this.spec = spec;
    this.level = level;
    // The ship auto-fires, so each boss soaks many small hits.
    this.hp = this.maxHp = spec.hp * 5;
    this.fireT = 0.6;
    this.active = true;
    this.defeated = false;
    this.state = 'enter';
    this.t = 0;
    this.attackT = 2.2;
    this.lastAttack = '';
    this.flash = 0;
    this.deathT = 0;
    this.x = 0;
    this.z = -170;
    this.y = BOSS_Y + 2;
    this.bodyMat.color.set(0xffffff);
    this.group.visible = true;
    this.group.scale.setScalar(4.6);
    this.group.rotation.set(0, 0, 0);
    for (const [k, p] of Object.entries(this.props)) p.visible = k === spec.prop;
    this.body.material.color.set(tintHex || 0xffffff);
    for (const l of this.lasers) { l.state = 0; l.strip.visible = l.beam.visible = false; }
    for (const m of this.missiles) { m.active = false; m.mesh.visible = false; }
  }

  stop() {
    this.active = false;
    this.group.visible = false;
    for (const l of this.lasers) { l.state = 0; l.strip.visible = l.beam.visible = false; }
    for (const m of this.missiles) { m.active = false; m.mesh.visible = false; }
    this.pickups.clearType(CORN);
  }

  get hpFrac() { return this.maxHp ? this.hp / this.maxHp : 0; }
  get entering() { return this.state === 'enter'; }

  // The pod auto-fires these at the boss during the fight.
  launchMissile(fromX) {
    const m = this.missiles.find((o) => !o.active);
    if (!m) return;
    Object.assign(m, { active: true, t: 0, x0: fromX, y0: 0.2, z0: 0, side: Math.random() < 0.5 ? -1 : 1 });
    m.mesh.visible = true;
  }

  _hit() {
    if (this.state !== 'fight') return;
    this.hp = Math.max(0, this.hp - 1);
    this.flash = 1;
    this.particles.burst(this.x, this.y + 1, this.z + 1.5, 16, 7, 0.6, 0.45, [[1, 1, 1], [1, 0.9, 0.6], [1, 0.6, 0.2]], 2, 0.2);
    if (this.onHit) this.onHit(this.hpFrac);
    if (this.hp <= 0) {
      this.state = 'dying';
      this.deathT = 0;
      for (const l of this.lasers) { l.state = 0; l.strip.visible = l.beam.visible = false; }
      this.pickups.clearType(CORN);
    }
  }

  _safeX() {
    // Pick a corn spot away from active laser lanes.
    const H = CONFIG.halfWidth;
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() * 2 - 1) * (H - 0.4);
      if (this.lasers.every((l) => l.state === 0 || Math.abs(l.x - x) > 1.6)) return x;
    }
    return 0;
  }

  _attack(shipX) {
    const atk = this.spec.attacks;
    let kind;
    do { kind = atk[(Math.random() * atk.length) | 0]; } while (atk.length > 1 && kind === this.lastAttack && Math.random() < 0.7);
    this.lastAttack = kind;
    const H = CONFIG.halfWidth;
    if (this.onAttack) this.onAttack(kind);

    if (kind === 'lay') {
      // She lays a clutch of eggs around (and at) the pod's lane.
      const n = 3 + Math.min(2, Math.floor(this.level / 2));
      for (let i = 0; i < n; i++) {
        const x = shipX + (i - (n - 1) / 2) * 1.5 + (Math.random() - 0.5) * 0.6;
        this.chickens.dropEgg(x, this.z + 2, this.y + 0.5, 0.85 + i * 0.12);
      }
    } else if (kind === 'rain') {
      // Scattered eggs landing at different times across the lanes.
      const n = 5 + Math.min(3, this.level);
      for (let i = 0; i < n; i++) {
        this.chickens.dropEgg((Math.random() * 2 - 1) * H, this.z + 2 + Math.random() * 3, this.y + 0.5, 0.7 + Math.random() * 0.9);
      }
    } else if (kind === 'fan') {
      // A fan of eggs across the lanes, leaving one gap to slip through.
      const gapX = (Math.random() * 2 - 1) * (H - 1.3);
      const n = 7 + Math.min(3, this.level);
      for (let i = 0; i < n; i++) {
        const x = -H + (i / (n - 1)) * H * 2;
        if (Math.abs(x - gapX) < 1.3) continue;
        this.chickens.dropEgg(x, this.z + 2, this.y + 0.5, 0.95);
      }
    } else if (kind === 'summon') {
      this.chickens.spawnFormation(Math.random() < 0.5 ? 'swoop' : 'line', this.z - 20, this.level);
    } else if (kind === 'throw') {
      this.obstacles.throwAt(this.x, this.z + 3, 5, this.level);
    } else if (kind === 'laser') {
      const both = this.hpFrac < 0.5 && this.spec.tempo >= 1.2;
      const xs = both
        ? [THREE.MathUtils.clamp(shipX, -H, H), THREE.MathUtils.clamp(shipX > 0 ? shipX - 2.8 : shipX + 2.8, -H, H)]
        : [THREE.MathUtils.clamp(shipX, -H, H)];
      xs.forEach((x, i) => {
        const l = this.lasers[i];
        l.state = 1; l.t = 0; l.x = x;
      });
    }
  }

  /** Returns true if a laser beam hits the ship this frame. */
  update(dt, realDt, speed, shipX) {
    if (!this.active) return false;
    this.t += dt;
    const tempo = this.spec.tempo * (this.hpFrac < 0.5 ? 1.25 : 1);
    let laserHit = false;

    if (this.state === 'enter') {
      this.z += (BOSS_Z - this.z) * (1 - Math.exp(-dt * 1.6));
      this.y += (BOSS_Y - this.y) * (1 - Math.exp(-dt * 1.6));
      if (Math.abs(this.z - BOSS_Z) < 1) this.state = 'fight';
    } else if (this.state === 'fight') {
      this.x = Math.sin(this.t * 0.55 * tempo) * 2.3;
      this.attackT -= dt;
      if (this.attackT <= 0) {
        this._attack(shipX);
        this.attackT = (2.8 / tempo) * (0.85 + Math.random() * 0.3);
      }
      // Auto-fire: a missile every ~0.7s from the pod.
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.launchMissile(shipX);
        if (this.onAttack) this.onAttack('fire');
        this.fireT = 0.7;
      }
    } else if (this.state === 'dying') {
      this.deathT += realDt;
      if (Math.random() < 0.5) {
        this.particles.burst(this.x + (Math.random() - 0.5) * 4, this.y + Math.random() * 3, this.z + 1, 20, 8, 0.7, 0.7,
          [[1, 0.85, 0.4], [1, 0.5, 0.15], [1, 1, 1]], 2, 0.1);
      }
      this.group.rotation.z = Math.sin(this.deathT * 30) * 0.08;
      if (this.deathT > 1.6) {
        // Final pop: feather storm.
        this.particles.burst(this.x, this.y + 1, this.z + 2, 260, 16, 2.2, 0.8, [[1, 1, 1], [0.96, 0.92, 0.84], [1, 0.85, 0.5]], 1.2, 0.3);
        this.particles.burst(this.x, this.y + 1, this.z + 2, 120, 22, 1.2, 1.1, [[1, 0.85, 0.4], [1, 0.5, 0.15], [1, 1, 0.9]], 2, 0.2);
        this.group.visible = false;
        this.active = false;
        this.defeated = true;
        if (this.onDefeated) this.onDefeated();
        return false;
      }
    }

    // Pose + wing flap
    const flap = Math.sin(this.t * 7) * 0.5;
    this.wingR.rotation.z = flap;
    this.wingL.rotation.z = flap;
    this.group.position.set(this.x, this.y + Math.sin(this.t * 2) * 0.25, this.z);
    this.group.rotation.y = -this.x * 0.06;
    this.flash = Math.max(0, this.flash - realDt * 4);
    this.bodyMat.emissive.setRGB(this.flash, this.flash * 0.8, this.flash * 0.6);
    const punch = 1 + this.flash * 0.12;
    this.group.scale.setScalar(4.6 * punch);

    // Lasers: telegraph (state 1) → beam (state 2) → off
    for (const l of this.lasers) {
      if (l.state === 0) continue;
      l.t += dt;
      const len = Math.abs(BOSS_Z) + 12;
      const midZ = BOSS_Z / 2 + 6;
      if (l.state === 1) {
        l.strip.visible = true;
        l.strip.position.set(l.x, PLANE_Y + 0.02, midZ);
        l.strip.scale.set(1, len, 1);
        l.strip.material.opacity = 0.25 + 0.35 * Math.abs(Math.sin(l.t * 18));
        if (l.t > 0.85) { l.state = 2; l.t = 0; if (this.onAttack) this.onAttack('beam'); }
      } else if (l.state === 2) {
        l.strip.visible = false;
        l.beam.visible = true;
        l.beam.position.set(l.x, 0.9, midZ);
        l.beam.scale.set(1 + Math.random() * 0.15, 1, len);
        if (Math.abs(shipX - l.x) < 0.35 + CONFIG.shipRadius * 0.8) laserHit = true;
        if (l.t > 0.55) { l.state = 0; l.beam.visible = false; }
      }
    }

    // Corn missiles arc from the ship to the boss.
    for (const m of this.missiles) {
      if (!m.active) continue;
      m.t += realDt / 0.55;
      const k = Math.min(1, m.t);
      const tx = this.x, ty = this.y + 1.2, tz = this.z + 1.5;
      const arc = Math.sin(k * Math.PI);
      const x = m.x0 + (tx - m.x0) * k + arc * m.side * 1.5;
      const y = m.y0 + (ty - m.y0) * k + arc * 1.8;
      const z = m.z0 + (tz - m.z0) * k;
      m.mesh.position.set(x, y, z);
      m.mesh.lookAt(tx, ty, tz);
      this.particles.emit(x, y, z + 0.3, (Math.random() - 0.5), (Math.random() - 0.5), 2, 0.4, 0.8, 1, 0.8, 0.2, 1, 0);
      if (k >= 1) {
        m.active = false;
        m.mesh.visible = false;
        this._hit();
      }
    }
    return laserHit;
  }
}
