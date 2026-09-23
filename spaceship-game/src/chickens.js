import * as THREE from 'three';
import { CONFIG } from './config.js';
import { chickenBodyGeometry, wingGeometry, friedEggGeometry } from './geo.js';

const PLANE_Y = -0.3;      // eggs crack onto this plane, just under the ship
const MAX_CHICKENS = 48;
const MAX_EGGS = 48;

// Space hens: formations that fly at ship height (hazards), bombers that hover
// high above and drop eggs, falling eggs with a landing telegraph, and the
// fried-egg puddles they leave behind (also hazards).
export class Chickens {
  constructor(scene, particles) {
    this.particles = particles;
    this.hens = [];
    for (let i = 0; i < MAX_CHICKENS; i++) {
      this.hens.push({
        active: false, bomber: false, x: 0, y: 0, z: 0, baseX: 0, amp: 0, freq: 0, phase: 0,
        group: 0, passed: false, scale: 1, life: 0, dropT: 0, state: 0, vx: 0, flapSpeed: 16,
      });
    }
    this.eggs = [];
    for (let i = 0; i < MAX_EGGS; i++) this.eggs.push({ active: false, x: 0, y: 0, z: 0, y0: 0, t: 0, T: 1, spin: 0 });
    this.puddles = [];
    for (let i = 0; i < MAX_EGGS; i++) this.puddles.push({ active: false, x: 0, z: 0, rot: 0, group: 0, passed: false, s: 1 });

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, flatShading: true });
    this.bodyMesh = new THREE.InstancedMesh(chickenBodyGeometry(), mat, MAX_CHICKENS);
    this.wingL = new THREE.InstancedMesh(wingGeometry(), mat, MAX_CHICKENS);
    this.wingR = new THREE.InstancedMesh(wingGeometry(), mat, MAX_CHICKENS);
    for (const m of [this.bodyMesh, this.wingL, this.wingR]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    }

    const eggGeo = new THREE.IcosahedronGeometry(0.3, 1);
    eggGeo.scale(0.82, 1.08, 0.82);
    this.eggMesh = new THREE.InstancedMesh(eggGeo, new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.4, emissive: 0x33302a }), MAX_EGGS);
    this.puddleMesh = new THREE.InstancedMesh(friedEggGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0x222018 }), MAX_EGGS);
    const ringGeo = new THREE.RingGeometry(0.45, 0.7, 20);
    ringGeo.rotateX(-Math.PI / 2);
    this.shadowMesh = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xff5a3c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }), MAX_EGGS);
    for (const m of [this.eggMesh, this.puddleMesh, this.shadowMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    }

    this.group = 1e6;          // separate id space from obstacles
    this._awarded = new Set();
    this.time = 0;
    this.onEggLanded = null;   // callback(x, z) for splat sound
    this._m = new THREE.Matrix4();
    this._m2 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._wingOff = new THREE.Vector3();
    this._one = new THREE.Vector3(1, 1, 1);
  }

  setTint(hex) {
    const c = new THREE.Color(hex);
    for (let i = 0; i < MAX_CHICKENS; i++) {
      this.bodyMesh.setColorAt(i, c);
      this.wingL.setColorAt(i, c);
      this.wingR.setColorAt(i, c);
    }
    for (const m of [this.bodyMesh, this.wingL, this.wingR]) m.instanceColor.needsUpdate = true;
  }

  reset() {
    for (const h of this.hens) h.active = false;
    for (const e of this.eggs) e.active = false;
    for (const p of this.puddles) p.active = false;
    this._awarded.clear();
  }

  clearAhead(zMin) {
    for (const h of this.hens) if (h.active && !h.bomber && h.z > zMin) h.active = false;
    for (const e of this.eggs) if (e.active && e.z > zMin) e.active = false;
    for (const p of this.puddles) if (p.active && p.z > zMin) p.active = false;
  }

  _hen() { return this.hens.find((h) => !h.active); }

  _spawnHen(x, z, opts = {}) {
    const h = this._hen();
    if (!h) return null;
    Object.assign(h, {
      active: true, bomber: false, x, baseX: x, y: 0.05, z, amp: 0, freq: 0, phase: Math.random() * 6.28,
      group: this.group, passed: false, scale: 1.05, life: 0, state: 0, vx: 0, flapSpeed: 14 + Math.random() * 6,
    }, opts);
    return h;
  }

  // Formation of hens flying at ship height. Always leaves a gap.
  spawnFormation(kind, z = CONFIG.spawnZ, level = 0) {
    this.group++;
    const H = CONFIG.halfWidth;
    if (kind === 'line') {
      const gap = Math.max(2.2, 3 - level * 0.1);
      const gapX = (Math.random() * 2 - 1) * (H - gap / 2);
      for (let x = -H; x <= H + 0.01; x += 1.45) {
        if (Math.abs(x - gapX) < gap / 2 + 0.5) continue;
        this._spawnHen(x, z, { amp: 0.15, freq: 2 });
      }
      return gapX;
    }
    if (kind === 'v') {
      const cx = (Math.random() * 2 - 1) * (H - 2);
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue; // the hole in the middle of the V
        this._spawnHen(THREE.MathUtils.clamp(cx + i * 1.2, -H, H), z - Math.abs(i) * 2.5);
      }
      this._spawnHen(cx, z + 3, {}); // leader, far enough ahead to thread behind it
      return cx;
    }
    // swoop: a column weaving across the lanes
    const n = 3 + Math.min(2, level >> 1);
    const amp = 1.8 + Math.random() * 1.2;
    const freq = 1.1 + Math.random() * 0.6;
    const cx = (Math.random() * 2 - 1) * (H - amp);
    const ph = Math.random() * 6.28;
    for (let i = 0; i < n; i++) this._spawnHen(cx, z - i * 3.2, { amp, freq, phase: ph + i * 0.5 });
    return null;
  }

  // High-flying bombers that hover ahead and drop eggs for a few seconds.
  spawnBombers(count = 2, dropInterval = 1.3) {
    const H = CONFIG.halfWidth;
    for (let i = 0; i < count; i++) {
      const h = this._hen();
      if (!h) return;
      const x = -H + ((i + 0.5) / count) * H * 2 + (Math.random() - 0.5);
      Object.assign(h, {
        active: true, bomber: true, x, baseX: x, y: 3.4 + Math.random() * 0.6, z: -150 - i * 6,
        amp: 1.5, freq: 0.6 + Math.random() * 0.4, phase: Math.random() * 6.28, passed: true,
        scale: 1.25, life: 6 + Math.random() * 2, dropT: 1 + i * 0.4 + Math.random() * dropInterval,
        dropInterval, state: 0, flapSpeed: 18,
      });
    }
  }

  // Drop an egg that lands after `T` world-seconds (boss attacks use this too).
  dropEgg(x, z, y0, T = 1.0) {
    const e = this.eggs.find((o) => !o.active);
    if (!e) return;
    Object.assign(e, { active: true, x: THREE.MathUtils.clamp(x, -CONFIG.halfWidth - 0.3, CONFIG.halfWidth + 0.3), z, y: y0, y0, t: 0, T, spin: Math.random() * 6 });
  }

  _puddle(x, z) {
    const p = this.puddles.find((o) => !o.active);
    if (!p) return;
    this.group++;
    Object.assign(p, { active: true, x, z, rot: Math.random() * 6.28, group: this.group, passed: false, s: 0.3 });
  }

  // Shield / Feather Dash knocked a hen out: burst of feathers.
  poof(h) {
    h.active = false;
    this.particles.burst(h.x, h.y + 0.2, h.z, 40, 6, 1.1, 0.45, [[1, 1, 1], [0.96, 0.92, 0.84], [1, 0.9, 0.7]], 2.5, 0.35);
  }

  splat(p) {
    p.active = false;
    this.particles.burst(p.x, PLANE_Y + 0.1, p.z, 26, 5, 0.6, 0.35, [[1, 0.75, 0.1], [1, 1, 0.95], [1, 0.85, 0.3]], 3, 0.4);
  }

  /**
   * Advances hens, eggs and puddles. Returns {obj, kind} if something hits the ship.
   * Pushes at most one near-miss event per frame.
   */
  update(dt, speed, shipX, events) {
    this.time += dt;
    const R = CONFIG.shipRadius;
    const margin = CONFIG.nearMissMargin;
    let hit = null;
    let best = null;
    const m = this._m, m2 = this._m2, q = this._q, e = this._e, p = this._p, s = this._s;
    let hc = 0;

    // --- hens ---
    for (const h of this.hens) {
      if (!h.active) continue;
      const flap = Math.sin(this.time * h.flapSpeed + h.phase);
      if (h.bomber) {
        h.life -= dt;
        if (h.state === 0) {
          // fly in fast, then cruise alongside the player
          const target = -46;
          h.z += Math.max(speed * 0.1, (target - h.z) * 3) * dt;
          if (h.z > target - 1) h.state = 1;
        }
        h.x = THREE.MathUtils.clamp(h.baseX + Math.sin(this.time * h.freq + h.phase) * h.amp, -CONFIG.halfWidth, CONFIG.halfWidth);
        if (h.state === 1) {
          h.dropT -= dt;
          if (h.dropT <= 0 && h.life > 0) {
            h.dropT = h.dropInterval * (0.8 + Math.random() * 0.4);
            // Half the eggs are aimed at the ship's lane to keep the player moving.
            const tx = Math.random() < 0.5 ? shipX + (Math.random() - 0.5) * 0.6 : h.x;
            this.dropEgg(tx, h.z, h.y - 0.3, 1.0);
          }
          if (h.life <= 0) h.state = 2;
        }
        if (h.state === 2) { h.y += dt * 3; h.z -= dt * 20; if (h.y > 12) h.active = false; }
      } else {
        const prevZ = h.z;
        h.z += speed * dt;
        if (h.z > CONFIG.despawnZ) { h.active = false; continue; }
        const nx = h.baseX + Math.sin(this.time * h.freq + h.phase) * h.amp;
        h.vx = (nx - h.x) / Math.max(dt, 1e-4);
        h.x = nx;
        h.y = 0.05 + flap * 0.08;

        const dx = h.x - shipX;
        const reach = 0.55 * h.scale + R;
        const crossed = prevZ < 0 && h.z >= 0;
        if (!hit && (dx * dx + h.z * h.z < reach * reach || (crossed && Math.abs(dx) < reach))) hit = { obj: h, kind: 'chicken' };
        if (!h.passed && crossed) {
          h.passed = true;
          const gap = Math.abs(dx) - reach;
          if (!hit && gap > 0 && gap < margin && !this._awarded.has(h.group) && (!best || gap < best.gap)) {
            best = { x: h.x, z: h.z, side: Math.sign(dx), gap, group: h.group, hen: true };
          }
        }
      }

      if (hc >= MAX_CHICKENS) continue;
      const yaw = h.bomber ? 0 : THREE.MathUtils.clamp(h.vx * 0.08, -0.6, 0.6);
      p.set(h.x, h.y, h.z);
      q.setFromEuler(e.set(0.15, yaw, 0));
      s.setScalar(h.scale);
      m.compose(p, q, s);
      this.bodyMesh.setMatrixAt(hc, m);
      const f = flap * 0.9;
      this._wingOff.set(0.38, 0.22, -0.05);
      m2.compose(this._wingOff, q.setFromEuler(e.set(0, 0, f)), this._one);
      this.wingR.setMatrixAt(hc, m2.premultiply(m));
      this._wingOff.set(-0.38, 0.22, -0.05);
      m2.compose(this._wingOff, q.setFromEuler(e.set(0, Math.PI, f)), this._one);
      this.wingL.setMatrixAt(hc, m2.premultiply(m));
      hc++;
    }
    this.bodyMesh.count = this.wingL.count = this.wingR.count = hc;

    // --- falling eggs + landing telegraph ---
    let ec = 0;
    for (const eg of this.eggs) {
      if (!eg.active) continue;
      eg.t += dt;
      eg.z += speed * dt;
      const k = Math.min(1, eg.t / eg.T);
      eg.y = eg.y0 + (PLANE_Y + 0.2 - eg.y0) * k * k;
      eg.spin += dt * 8;
      if (k >= 1) {
        eg.active = false;
        this._puddle(eg.x, eg.z);
        if (this.onEggLanded) this.onEggLanded(eg.x, eg.z);
        this.particles.burst(eg.x, PLANE_Y + 0.15, eg.z, 12, 4, 0.4, 0.3, [[1, 1, 0.95], [1, 0.8, 0.2]], 3, 1);
        continue;
      }
      if (eg.z > CONFIG.despawnZ) { eg.active = false; continue; }
      p.set(eg.x, eg.y, eg.z);
      q.setFromEuler(e.set(eg.spin, 0, eg.spin * 0.5));
      s.setScalar(1);
      this.eggMesh.setMatrixAt(ec, m.compose(p, q, s));
      // Telegraph ring on the landing plane, shrinking as the egg arrives.
      p.set(eg.x, PLANE_Y + 0.02, eg.z + speed * (eg.T - eg.t) * 0);
      q.identity();
      s.setScalar(1.5 - k * 0.6);
      this.shadowMesh.setMatrixAt(ec, m.compose(p, q, s));
      ec++;
    }
    this.eggMesh.count = this.shadowMesh.count = ec;

    // --- puddles (hazards) ---
    let pc = 0;
    const PR = 0.62;
    for (const pd of this.puddles) {
      if (!pd.active) continue;
      const prevZ = pd.z;
      pd.z += speed * dt;
      if (pd.z > CONFIG.despawnZ) { pd.active = false; continue; }
      pd.s = Math.min(1, pd.s + dt * 6);
      const dx = pd.x - shipX;
      const reach = PR + R * 0.8;
      const crossed = prevZ < 0 && pd.z >= 0;
      if (!hit && (dx * dx + pd.z * pd.z < reach * reach || (crossed && Math.abs(dx) < reach))) hit = { obj: pd, kind: 'puddle' };
      if (!pd.passed && crossed) {
        pd.passed = true;
        const gap = Math.abs(dx) - reach;
        if (!hit && gap > 0 && gap < margin && !this._awarded.has(pd.group) && (!best || gap < best.gap)) {
          best = { x: pd.x, z: pd.z, side: Math.sign(dx), gap, group: pd.group };
        }
      }
      p.set(pd.x, PLANE_Y, pd.z);
      q.setFromEuler(e.set(0, pd.rot, 0));
      s.setScalar(pd.s);
      this.puddleMesh.setMatrixAt(pc++, m.compose(p, q, s));
    }
    this.puddleMesh.count = pc;

    if (best && !hit) {
      if (this._awarded.size > 64) this._awarded.clear();
      this._awarded.add(best.group);
      events.push(best);
    }

    for (const mesh of [this.bodyMesh, this.wingL, this.wingR, this.eggMesh, this.shadowMesh, this.puddleMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    return hit;
  }
}
