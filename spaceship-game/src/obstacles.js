import * as THREE from 'three';
import { CONFIG } from './config.js';

const ASTEROID = 0;
const BARRIER = 1;

// Deterministic jitter so shared vertices of the non-indexed icosahedron move together.
function jitterGeometry(geo, amount) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
    const n = (h - Math.floor(h)) * 2 - 1;
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Obstacles {
  constructor(scene, max) {
    this.max = max;
    this.list = [];
    for (let i = 0; i < max; i++) {
      this.list.push({
        active: false, type: ASTEROID, x: 0, y: 0, z: 0, r: 0.6,
        w: 1, d: 0.5, baseX: 0, amp: 0, freq: 0, phase: 0,
        rx: 0, ry: 0, rz: 0, srx: 0, sry: 0, sx: 1, sy: 1, sz: 1,
        passed: false, group: 0,
      });
    }

    const rockGeo = jitterGeometry(new THREE.IcosahedronGeometry(1, 1), 0.22);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.15, flatShading: true });
    this.rocks = new THREE.InstancedMesh(rockGeo, rockMat, max);
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rocks.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) {
      c.setHSL(0.62 + Math.random() * 0.2, 0.18 + Math.random() * 0.2, 0.42 + Math.random() * 0.18);
      this.rocks.setColorAt(i, c);
    }
    this.rocks.count = 0;
    scene.add(this.rocks);

    const barGeo = new THREE.BoxGeometry(1, 1, 1);
    this.barMat = new THREE.MeshStandardMaterial({
      color: 0x401030, emissive: 0xff2d95, emissiveIntensity: 1.6, roughness: 0.4,
      transparent: true, opacity: 0.9,
    });
    this.bars = new THREE.InstancedMesh(barGeo, this.barMat, 16);
    this.bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bars.frustumCulled = false;
    this.bars.count = 0;
    scene.add(this.bars);

    this.spawnTimer = 1.2;
    this.time = 0;
    this.group = 0;
    this._awarded = new Set();
    this.pickups = null;     // set by main: crystals are placed through safe gaps
    this.orbChance = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  reset() {
    for (const o of this.list) o.active = false;
    this.rocks.count = 0;
    this.bars.count = 0;
    this.spawnTimer = 1.2;
    this.time = 0;
    this._awarded.clear();
  }

  // Remove everything close to the ship (used after picking a power-up).
  clearAhead(zMin) {
    for (const o of this.list) if (o.active && o.z > zMin) o.active = false;
  }

  destroy(o) { o.active = false; }

  _get() {
    for (const o of this.list) if (!o.active) return o;
    return null;
  }

  _rock(x, z, r, amp = 0, freq = 0) {
    const o = this._get();
    if (!o) return;
    o.active = true; o.type = ASTEROID; o.passed = false; o.group = this.group;
    o.baseX = x; o.x = x; o.z = z; o.r = r;
    o.y = (Math.random() - 0.3) * 0.5;
    o.amp = amp; o.freq = freq; o.phase = Math.random() * Math.PI * 2;
    o.rx = Math.random() * 6; o.ry = Math.random() * 6; o.rz = Math.random() * 6;
    o.srx = (Math.random() - 0.5) * 3; o.sry = (Math.random() - 0.5) * 3;
    o.sx = r * (0.85 + Math.random() * 0.3);
    o.sy = r * (0.75 + Math.random() * 0.3);
    o.sz = r * (0.85 + Math.random() * 0.3);
  }

  _barrier(x0, x1, z) {
    const o = this._get();
    if (!o) return;
    o.active = true; o.type = BARRIER; o.passed = false; o.group = this.group;
    o.x = o.baseX = (x0 + x1) / 2; o.z = z; o.y = 0;
    o.w = Math.abs(x1 - x0); o.d = 0.5; o.amp = 0;
  }

  // Pattern generator. Every pattern leaves at least one gap wide enough for the ship.
  _spawnPattern(level) {
    this.group++;
    const H = CONFIG.halfWidth;
    const z = CONFIG.spawnZ;
    const roll = Math.random();
    const rr = () => 0.5 + Math.random() * 0.35;
    const pk = this.pickups;
    const orb = (x, zz) => { if (pk && Math.random() < this.orbChance) pk.spawnAt(x, zz, 1); };

    if (level >= 2 && roll < 0.16) {
      // Energy barrier covering one side
      const gap = 2.3;
      const gapX = (Math.random() * 2 - 1) * (H - gap / 2);
      const left = Math.random() < 0.5;
      if (left) this._barrier(-H - 1.2, gapX - gap / 2, z);
      else this._barrier(gapX + gap / 2, H + 1.2, z);
      // Crystals lead into the open side of the barrier.
      const openX = left ? (gapX + H) / 2 : (gapX - H) / 2;
      if (pk) pk.spawnLine(openX, z + 3, 4);
      orb(openX, z + 14);
      return 1.25;
    }
    if (level >= 1 && roll < 0.36) {
      // Wall of rocks with a gap
      const gap = Math.max(2.1, 3.0 - level * 0.12);
      const gapX = (Math.random() * 2 - 1) * (H - gap / 2);
      for (let x = -H; x <= H + 0.01; x += 1.35) {
        if (Math.abs(x - gapX) < gap / 2 + 0.55) continue;
        this._rock(x + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.8, rr());
      }
      if (pk) pk.spawnLine(gapX, z + 3, 4);
      orb(gapX, z - 6);
      return 1.45;
    }
    if (level >= 3 && roll < 0.55) {
      // Drifting rock sweeping across lanes
      const amp = 1.2 + Math.random() * 1.6;
      const x = (Math.random() * 2 - 1) * (H - amp * 0.5);
      this._rock(x, z, rr() + 0.1, amp, 1 + Math.random() * 1.2);
      return 0.9;
    }
    if (roll < 0.75) {
      // Pair / cluster
      const n = level >= 2 ? 3 : 2;
      const x0 = (Math.random() * 2 - 1) * H;
      for (let i = 0; i < n; i++) {
        const x = THREE.MathUtils.clamp(x0 + (Math.random() - 0.5) * 3.2, -H, H);
        this._rock(x, z - Math.random() * 5, rr());
      }
      // Sweep of crystals on the opposite side, pulling the player across.
      if (pk && Math.random() < 0.5) {
        const far = x0 > 0 ? -H * 0.7 : H * 0.7;
        pk.spawnArc(far * 0.3, far, z - 10, 5);
      }
      return 1.0;
    }
    // Single big rock, often aimed where the player tends to be
    const bx = (Math.random() * 2 - 1) * H;
    const br = 0.75 + Math.random() * 0.4;
    this._rock(bx, z, br);
    // Risky crystal hugging the rock — tempting, but tight.
    if (pk && Math.random() < 0.45) {
      const side = bx > 0 ? -1 : 1;
      pk.spawnAt(bx + side * (br + 0.95), z);
    }
    return 0.7;
  }

  /**
   * Advances obstacles, spawns new ones and resolves collisions / near misses.
   * Returns the obstacle that hit the ship (or null) and pushes near-miss events into `events`.
   */
  update(dt, speed, spawnInterval, level, shipX, spawning, events) {
    this.time += dt;
    if (spawning) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const weight = this._spawnPattern(level);
        this.spawnTimer = spawnInterval * weight * (0.85 + Math.random() * 0.3);
      }
    }

    const R = CONFIG.shipRadius;
    const margin = CONFIG.nearMissMargin;
    let hit = null;
    let best = null;   // at most one near-miss event per frame (the tightest)
    let rockCount = 0;
    let barCount = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p, s = this._s;
    const hidden = this._hidden || (this._hidden = new THREE.Matrix4().makeScale(0, 0, 0));

    // Rocks keep their pool slot as instance index so per-instance colours stay stable.
    for (let i = 0; i < this.max; i++) {
      const o = this.list[i];
      if (o.active) {
        o.z += speed * dt;
        if (o.z > CONFIG.despawnZ) o.active = false;
      }
      if (!o.active || o.type !== ASTEROID) {
        this.rocks.setMatrixAt(i, hidden);
        if (!o.active) continue;
      }
      const prevZ = o.z - speed * dt;

      if (o.type === ASTEROID) {
        if (o.amp > 0) o.x = o.baseX + Math.sin(this.time * o.freq + o.phase) * o.amp;
        o.rx += o.srx * dt; o.ry += o.sry * dt;

        // Collision in the XZ plane (ship lives at z = 0)
        const dx = o.x - shipX;
        const dz = o.z;
        const reach = o.r * 0.9 + R;
        const crossed = prevZ < 0 && o.z >= 0; // swept test so fast rocks can't tunnel through
        if (!hit && (dx * dx + dz * dz < reach * reach || (crossed && Math.abs(dx) < reach))) hit = o;

        // Near miss: rock crosses the ship plane close but without touching
        if (!o.passed && crossed) {
          o.passed = true;
          const gap = Math.abs(dx) - reach;
          if (!hit && gap > 0 && gap < margin && !this._awarded.has(o.group) && (!best || gap < best.gap)) {
            best = { x: o.x, z: o.z, side: Math.sign(dx), gap, group: o.group };
          }
        }

        p.set(o.x, o.y, o.z);
        q.setFromEuler(e.set(o.rx, o.ry, o.rz));
        s.set(o.sx, o.sy, o.sz);
        this.rocks.setMatrixAt(i, m.compose(p, q, s));
        rockCount = i + 1;
      } else {
        const hw = o.w / 2;
        const cx = THREE.MathUtils.clamp(shipX, o.x - hw, o.x + hw);
        const cz = THREE.MathUtils.clamp(0, o.z - o.d / 2, o.z + o.d / 2);
        const dx = shipX - cx;
        const dz = -cz;
        const crossed = prevZ < 0 && o.z >= 0;
        if (!hit && (dx * dx + dz * dz < R * R || (crossed && Math.abs(dx) < R))) hit = o;

        if (!o.passed && crossed) {
          o.passed = true;
          const gap = Math.abs(dx) - R;
          if (!hit && gap > 0 && gap < margin && !this._awarded.has(o.group) && (!best || gap < best.gap)) {
            best = { x: cx, z: o.z, side: Math.sign(cx - shipX), gap, group: o.group };
          }
        }

        p.set(o.x, 0, o.z);
        q.identity();
        s.set(o.w, 0.9, o.d);
        if (barCount < 16) this.bars.setMatrixAt(barCount++, m.compose(p, q, s));
      }
    }

    if (best && !hit) {
      // One event per pattern: passing through a wall's gap counts once.
      if (this._awarded.size > 64) this._awarded.clear();
      this._awarded.add(best.group);
      events.push(best);
    }

    this.rocks.count = rockCount;
    this.bars.count = barCount;
    this.rocks.instanceMatrix.needsUpdate = true;
    this.bars.instanceMatrix.needsUpdate = true;
    this.barMat.emissiveIntensity = 1.3 + Math.sin(this.time * 10) * 0.4;
    return hit;
  }
}
