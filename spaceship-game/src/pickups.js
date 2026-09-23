import * as THREE from 'three';
import { CONFIG } from './config.js';

export const CRYSTAL = 0;
export const ORB = 1;

// Pooled collectibles: crystals (currency) and rare shield orbs.
export class Pickups {
  constructor(scene, max) {
    this.max = max;
    this.list = [];
    for (let i = 0; i < max; i++) {
      this.list.push({ active: false, type: CRYSTAL, x: 0, y: 0, z: 0, phase: 0, pulled: false });
    }

    const crystalGeo = new THREE.OctahedronGeometry(0.32, 0);
    crystalGeo.scale(0.8, 1.3, 0.8);
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0x7ff6ff, emissive: 0x19c6e6, emissiveIntensity: 1.6,
      metalness: 0.3, roughness: 0.15, flatShading: true,
    });
    this.crystals = new THREE.InstancedMesh(crystalGeo, this.crystalMat, max);
    this.crystals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crystals.frustumCulled = false;
    this.crystals.count = 0;
    scene.add(this.crystals);

    const orbGeo = new THREE.IcosahedronGeometry(0.42, 1);
    this.orbMat = new THREE.MeshStandardMaterial({
      color: 0x6fa8ff, emissive: 0x3a6bff, emissiveIntensity: 2.2,
      transparent: true, opacity: 0.85, roughness: 0.2, flatShading: true,
    });
    this.orbs = new THREE.InstancedMesh(orbGeo, this.orbMat, 6);
    this.orbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.orbs.frustumCulled = false;
    this.orbs.count = 0;
    scene.add(this.orbs);

    this.time = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  reset() {
    for (const p of this.list) p.active = false;
    this.crystals.count = 0;
    this.orbs.count = 0;
  }

  spawnAt(x, z, type = CRYSTAL) {
    const p = this.list.find((o) => !o.active);
    if (!p) return;
    p.active = true;
    p.type = type;
    p.x = THREE.MathUtils.clamp(x, -CONFIG.halfWidth, CONFIG.halfWidth);
    p.z = z;
    p.y = 0.1;
    p.phase = Math.random() * Math.PI * 2;
    p.pulled = false;
  }

  // A straight trail of crystals down the given x, leading into a gap.
  spawnLine(x, z, count = 5, spacing = 2.2) {
    for (let i = 0; i < count; i++) this.spawnAt(x, z + i * spacing);
  }

  // A sweeping arc from one x to another (encourages movement).
  spawnArc(x0, x1, z, count = 6, spacing = 2.4) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const e = t * t * (3 - 2 * t);
      this.spawnAt(x0 + (x1 - x0) * e, z - i * spacing);
    }
  }

  /** Moves pickups, applies magnet, pushes collected items into `events`. */
  update(dt, speed, shipX, magnet, events) {
    this.time += dt;
    const R = CONFIG.crystalRadius;
    let ci = 0;
    let oi = 0;
    const m = this._m, q = this._q, e = this._e, pv = this._p, s = this._s;

    for (const p of this.list) {
      if (!p.active) continue;
      p.z += speed * dt;
      if (p.z > CONFIG.despawnZ) { p.active = false; continue; }

      const dx = shipX - p.x;
      const dz = -p.z;
      const d2 = dx * dx + dz * dz;
      const pullR = magnet + R;
      if (magnet > 0 && p.z > -pullR * 2.5 && p.z < 1 && d2 < pullR * pullR * 4) {
        p.pulled = true;
      }
      if (p.pulled) {
        // Home in on the ship; faster the closer it gets.
        const k = 1 - Math.exp(-dt * 14);
        p.x += dx * k;
        p.z += dz * k * 0.6;
      }
      if (d2 < R * R || (p.pulled && d2 < (R * 1.4) * (R * 1.4))) {
        p.active = false;
        events.push({ type: p.type, x: p.x, z: p.z });
        continue;
      }

      const bob = Math.sin(this.time * 4 + p.phase) * 0.15;
      pv.set(p.x, p.y + bob, p.z);
      if (p.type === CRYSTAL) {
        q.setFromEuler(e.set(0, this.time * 3 + p.phase, 0.2));
        s.setScalar(1);
        this.crystals.setMatrixAt(ci++, m.compose(pv, q, s));
      } else if (oi < 6) {
        q.setFromEuler(e.set(this.time, this.time * 1.3, 0));
        s.setScalar(1 + Math.sin(this.time * 8) * 0.08);
        this.orbs.setMatrixAt(oi++, m.compose(pv, q, s));
      }
    }

    this.crystals.count = ci;
    this.orbs.count = oi;
    this.crystals.instanceMatrix.needsUpdate = true;
    this.orbs.instanceMatrix.needsUpdate = true;
    this.crystalMat.emissiveIntensity = 1.4 + Math.sin(this.time * 6) * 0.4;
  }
}
