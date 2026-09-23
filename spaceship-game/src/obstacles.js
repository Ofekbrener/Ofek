import * as THREE from 'three';
import { CONFIG } from './config.js';

// Obstacle kinds
const ROCK = 0;
const BAR = 1;
const BIGEGG = 2;
const SHARD = 3;
const COMET = 4;
const LASER = 5;
const WELL = 6;

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

function instanced(scene, geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
  return m;
}

// Pooled debris + galaxy hazards. Spawning is driven by the wave director
// (journey.js) through spawnPattern(); this class moves everything, resolves
// collisions / near misses, and renders with one InstancedMesh per kind.
export class Obstacles {
  constructor(scene, max, particles) {
    this.max = max;
    this.particles = particles;
    this.list = [];
    for (let i = 0; i < max; i++) {
      this.list.push({
        active: false, type: ROCK, x: 0, y: 0, z: 0, r: 0.6,
        w: 1, d: 0.5, baseX: 0, amp: 0, freq: 0, phase: 0, vx: 0, zMul: 1,
        rx: 0, ry: 0, rz: 0, srx: 0, sry: 0, sx: 1, sy: 1, sz: 1,
        passed: false, group: 0, gapW: 2.4,
      });
    }

    const rockGeo = jitterGeometry(new THREE.IcosahedronGeometry(1, 1), 0.22);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.15, flatShading: true });
    this.rocks = instanced(scene, rockGeo, rockMat, max);
    this.baseColors = [];
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) {
      c.setHSL(0.62 + Math.random() * 0.2, 0.18 + Math.random() * 0.2, 0.42 + Math.random() * 0.18);
      this.baseColors.push(c.clone());
      this.rocks.setColorAt(i, c);
    }
    this.cometColor = new THREE.Color(0xff7a2f);

    this.barMat = new THREE.MeshStandardMaterial({
      color: 0x401030, emissive: 0xff2d95, emissiveIntensity: 1.6, roughness: 0.4, transparent: true, opacity: 0.9,
    });
    this.bars = instanced(scene, new THREE.BoxGeometry(1, 1, 1), this.barMat, 16);

    const eggGeo = new THREE.IcosahedronGeometry(1, 2);
    eggGeo.scale(0.8, 1.05, 0.8);
    this.bigEggs = instanced(scene, eggGeo, new THREE.MeshStandardMaterial({ color: 0xfff3dc, roughness: 0.35, emissive: 0x2a2418 }), 12);

    const shardGeo = new THREE.OctahedronGeometry(1, 0);
    shardGeo.scale(0.6, 1.4, 0.6);
    this.shards = instanced(scene, shardGeo, new THREE.MeshStandardMaterial({
      color: 0xbff2ff, emissive: 0x2a7fbf, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.88, flatShading: true,
    }), 40);

    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xff3a1f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lasers = instanced(scene, new THREE.BoxGeometry(1, 1, 1), this.laserMat, 16);

    const ringGeo = new THREE.RingGeometry(0.6, 2.8, 32, 1);
    ringGeo.rotateX(-Math.PI / 2);
    this.wellMat = new THREE.MeshBasicMaterial({ color: 0xb04bff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.wellRings = instanced(scene, ringGeo, this.wellMat, 6);
    this.wellCores = instanced(scene, new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0x050008 }), 6);

    this.spawnTimer = 1.2;
    this.time = 0;
    this.group = 0;
    this.pull = 0;             // lateral pull on the ship from gravity wells (units/s²)
    this._awarded = new Set();
    this.pickups = null;       // set by main: crystals/drumsticks are placed through safe gaps
    this.orbChance = 0;
    this.giftChance = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  reset() {
    for (const o of this.list) o.active = false;
    this.rocks.count = 0;
    this.bars.count = 0;
    this.time = 0;
    this._awarded.clear();
  }

  clearAhead(zMin) {
    for (const o of this.list) if (o.active && o.z > zMin) o.active = false;
  }

  destroy(o) { o.active = false; }

  _get(type) {
    for (let i = 0; i < this.max; i++) {
      const o = this.list[i];
      if (!o.active) {
        o.active = true; o.type = type; o.passed = false; o.group = this.group;
        o.amp = 0; o.vx = 0; o.zMul = 1; o.y = 0;
        if (type === COMET) this.rocks.setColorAt(i, this.cometColor);
        else if (type === ROCK) this.rocks.setColorAt(i, this.baseColors[i]);
        if (type === ROCK || type === COMET) this.rocks.instanceColor.needsUpdate = true;
        return o;
      }
    }
    return null;
  }

  _rock(x, z, r, amp = 0, freq = 0, type = ROCK) {
    const o = this._get(type);
    if (!o) return null;
    o.baseX = x; o.x = x; o.z = z; o.r = r;
    o.y = type === ROCK ? (Math.random() - 0.3) * 0.5 : 0;
    o.amp = amp; o.freq = freq; o.phase = Math.random() * Math.PI * 2;
    o.rx = Math.random() * 6; o.ry = Math.random() * 6; o.rz = Math.random() * 6;
    o.srx = (Math.random() - 0.5) * 3; o.sry = (Math.random() - 0.5) * 3;
    o.sx = r * (0.85 + Math.random() * 0.3);
    o.sy = r * (0.75 + Math.random() * 0.3);
    o.sz = r * (0.85 + Math.random() * 0.3);
    return o;
  }

  _barrier(x0, x1, z) {
    const o = this._get(BAR);
    if (!o) return;
    o.x = o.baseX = (x0 + x1) / 2; o.z = z;
    o.w = Math.abs(x1 - x0); o.d = 0.5;
  }

  _orb(x, z) {
    const pk = this.pickups;
    if (!pk) return;
    if (Math.random() < this.giftChance) pk.spawnAt(x, z, 2);        // gift box
    else if (Math.random() < this.orbChance) pk.spawnAt(x, z, 1);    // shield orb
  }

  /**
   * Spawn one hazard pattern by name. Every pattern leaves a gap wide enough for the ship.
   * Returns a weight that scales the time until the next spawn.
   */
  spawnPattern(name, level = 0) {
    this.group++;
    const H = CONFIG.halfWidth;
    const z = CONFIG.spawnZ;
    const rr = () => 0.5 + Math.random() * 0.35;
    const pk = this.pickups;

    switch (name) {
      case 'barrier': {
        const gap = 2.3;
        const gapX = (Math.random() * 2 - 1) * (H - gap / 2);
        const left = Math.random() < 0.5;
        if (left) this._barrier(-H - 1.2, gapX - gap / 2, z);
        else this._barrier(gapX + gap / 2, H + 1.2, z);
        const openX = left ? (gapX + H) / 2 : (gapX - H) / 2;
        if (pk) pk.spawnLine(openX, z + 3, 4);
        this._orb(openX, z + 14);
        return 1.25;
      }
      case 'wall': {
        const gap = Math.max(2.1, 3.0 - level * 0.1);
        const gapX = (Math.random() * 2 - 1) * (H - gap / 2);
        for (let x = -H; x <= H + 0.01; x += 1.35) {
          if (Math.abs(x - gapX) < gap / 2 + 0.55) continue;
          this._rock(x + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.8, rr());
        }
        if (pk) pk.spawnLine(gapX, z + 3, 4);
        this._orb(gapX, z - 6);
        return 1.45;
      }
      case 'drifter': {
        const amp = 1.2 + Math.random() * 1.6;
        const x = (Math.random() * 2 - 1) * (H - amp * 0.5);
        this._rock(x, z, rr() + 0.1, amp, 1 + Math.random() * 1.2);
        return 0.9;
      }
      case 'cluster': {
        const n = level >= 2 ? 3 : 2;
        const x0 = (Math.random() * 2 - 1) * H;
        for (let i = 0; i < n; i++) {
          const x = THREE.MathUtils.clamp(x0 + (Math.random() - 0.5) * 3.2, -H, H);
          this._rock(x, z - Math.random() * 5, rr());
        }
        if (pk && Math.random() < 0.5) {
          const far = x0 > 0 ? -H * 0.7 : H * 0.7;
          pk.spawnArc(far * 0.3, far, z - 10, 5);
        }
        return 1.0;
      }
      case 'bigEgg': {
        // One or two giant eggs rolling down the lanes, the second drifting sideways.
        const n = level >= 2 && Math.random() < 0.5 ? 2 : 1;
        const used = [];
        for (let i = 0; i < n; i++) {
          let x;
          do { x = (Math.random() * 2 - 1) * (H - 0.6); } while (used.some((u) => Math.abs(u - x) < 3.2));
          used.push(x);
          const o = this._get(BIGEGG);
          if (!o) break;
          const r = 1.0 + Math.random() * 0.3;
          Object.assign(o, { x, baseX: x, z: z - i * 8, r, y: r * 0.35 - 0.3, rx: 0, srx: 3 + Math.random() * 2, amp: i ? 1.2 : 0, freq: 0.8, phase: Math.random() * 6 });
        }
        if (pk) pk.spawnAt(used.length === 1 ? (used[0] > 0 ? used[0] - 2.2 : used[0] + 2.2) : 0, z + 4);
        return 1.3;
      }
      case 'comet': {
        // 1–2 flaming rocks crossing the lanes diagonally.
        const n = 1 + (level >= 2 && Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const fromLeft = Math.random() < 0.5;
          const o = this._rock(fromLeft ? -H - 1 : H + 1, z - i * 12, 0.55, 0, 0, COMET);
          if (!o) break;
          o.vx = (fromLeft ? 1 : -1) * (1.2 + Math.random() * 0.8);
          o.zMul = 1.35;
        }
        return 1.0;
      }
      case 'laser': {
        // Grill-laser fence with a gap that sweeps side to side.
        const o = this._get(LASER);
        if (!o) return 1;
        o.z = z; o.d = 0.25;
        o.gapW = Math.max(2.2, 2.8 - level * 0.08);
        o.amp = Math.min(H - o.gapW / 2, 1.4 + Math.random() * 1.0);
        o.baseX = (Math.random() * 2 - 1) * (H - o.gapW / 2 - o.amp);
        o.freq = 0.9 + Math.random() * 0.5;
        o.phase = Math.random() * 6.28;
        o.x = o.baseX;
        if (pk) pk.spawnLine(o.baseX, z + 3, 3);
        return 1.4;
      }
      case 'ice': {
        // Staggered field of ice shards with one clear lane.
        const gap = 2.4;
        const gapX = (Math.random() * 2 - 1) * (H - gap / 2);
        const n = 6 + Math.min(4, level);
        for (let i = 0; i < n; i++) {
          let x;
          let tries = 0;
          do { x = (Math.random() * 2 - 1) * H; tries++; } while (Math.abs(x - gapX) < gap / 2 + 0.45 && tries < 10);
          if (Math.abs(x - gapX) < gap / 2 + 0.45) continue;
          const o = this._get(SHARD);
          if (!o) break;
          const r = 0.35 + Math.random() * 0.2;
          Object.assign(o, { x, baseX: x, z: z - Math.random() * 12, r, y: 0, ry: Math.random() * 6, sry: (Math.random() - 0.5) * 2, rz: (Math.random() - 0.5) * 0.6 });
        }
        if (pk) pk.spawnLine(gapX, z + 2, 5, 2.4);
        this._orb(gapX, z - 14);
        return 1.35;
      }
      case 'well': {
        const o = this._get(WELL);
        if (!o) return 1;
        o.x = o.baseX = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * (H - 1.2));
        o.z = z; o.r = 0.5;
        // Crystals orbit on the far side — risk vs reward.
        if (pk) pk.spawnArc(-o.x * 0.2, -o.x * 0.9, z + 6, 4, 2);
        return 1.2;
      }
      default: {
        // 'rocks': single big rock with an optional risky crystal hugging it
        const bx = (Math.random() * 2 - 1) * H;
        const br = 0.75 + Math.random() * 0.4;
        this._rock(bx, z, br);
        if (pk && Math.random() < 0.45) {
          const side = bx > 0 ? -1 : 1;
          pk.spawnAt(bx + side * (br + 0.95), z);
        }
        return 0.7;
      }
    }
  }

  // Boss "throw" attack: fast props hurled from the boss toward the lanes.
  throwAt(fromX, fromZ, count, level = 0) {
    this.group++;
    const H = CONFIG.halfWidth;
    const gapX = (Math.random() * 2 - 1) * (H - 1.4);
    for (let i = 0; i < count; i++) {
      let tx = -H + (i + 0.5) * ((2 * H) / count);
      if (Math.abs(tx - gapX) < 1.4) continue;
      const o = this._rock(fromX, fromZ, 0.55, 0, 0, COMET);
      if (!o) break;
      o.zMul = 0.9 + level * 0.03;
      o.vx = (tx - fromX) / (Math.abs(fromZ) / 30 + 0.2);
    }
  }

  /**
   * Advances obstacles and resolves collisions / near misses.
   * Returns the obstacle that hit the ship (or null) and pushes near-miss events into `events`.
   */
  update(dt, speed, shipX, events) {
    this.time += dt;
    const R = CONFIG.shipRadius;
    const margin = CONFIG.nearMissMargin;
    const H = CONFIG.halfWidth;
    let hit = null;
    let best = null;
    let rockCount = 0;
    let barCount = 0;
    let eggCount = 0;
    let shardCount = 0;
    let laserCount = 0;
    let wellCount = 0;
    this.pull = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p, s = this._s;

    for (let i = 0; i < this.max; i++) {
      const o = this.list[i];
      if (o.active) {
        o.z += speed * dt * o.zMul;
        if (o.z > CONFIG.despawnZ) o.active = false;
      }
      if (!o.active || (o.type !== ROCK && o.type !== COMET)) {
        this.rocks.setMatrixAt(i, this._hidden);
        if (!o.active) continue;
      }
      const prevZ = o.z - speed * dt * o.zMul;
      const crossed = prevZ < 0 && o.z >= 0; // swept test so fast objects can't tunnel through

      if (o.type === ROCK || o.type === COMET || o.type === BIGEGG || o.type === SHARD) {
        if (o.amp > 0) o.x = o.baseX + Math.sin(this.time * o.freq + o.phase) * o.amp;
        if (o.vx) o.x += o.vx * dt;
        if (o.type === COMET && (o.x < -H - 3 || o.x > H + 3)) { o.active = false; this.rocks.setMatrixAt(i, this._hidden); continue; }
        o.rx += o.srx * dt; o.ry += o.sry * dt;

        const dx = o.x - shipX;
        const reach = o.r * 0.9 + R;
        if (!hit && (dx * dx + o.z * o.z < reach * reach || (crossed && Math.abs(dx) < reach))) hit = o;
        if (!o.passed && crossed) {
          o.passed = true;
          const gap = Math.abs(dx) - reach;
          if (!hit && gap > 0 && gap < margin && !this._awarded.has(o.group) && (!best || gap < best.gap)) {
            best = { x: o.x, z: o.z, side: Math.sign(dx), gap, group: o.group };
          }
        }

        if (o.type === ROCK || o.type === COMET) {
          p.set(o.x, o.y, o.z);
          q.setFromEuler(e.set(o.rx, o.ry, o.rz));
          s.set(o.sx, o.sy, o.sz);
          this.rocks.setMatrixAt(i, m.compose(p, q, s));
          rockCount = i + 1;
          if (o.type === COMET && this.particles && Math.random() < 0.85) {
            this.particles.emit(
              o.x + (Math.random() - 0.5) * 0.4, o.y + (Math.random() - 0.5) * 0.4, o.z - 0.3,
              -o.vx * 0.3 + (Math.random() - 0.5), Math.random() * 0.8, -speed * 0.2,
              0.35 + Math.random() * 0.2, 0.9, 1, 0.45 + Math.random() * 0.3, 0.1, 1, 0.9,
            );
          }
        } else if (o.type === BIGEGG && eggCount < 12) {
          p.set(o.x, o.y, o.z);
          q.setFromEuler(e.set(o.rx, 0, Math.sin(o.rx) * 0.15));
          s.setScalar(o.r);
          this.bigEggs.setMatrixAt(eggCount++, m.compose(p, q, s));
        } else if (o.type === SHARD && shardCount < 40) {
          p.set(o.x, o.y, o.z);
          q.setFromEuler(e.set(0, o.ry, o.rz));
          s.setScalar(o.r);
          this.shards.setMatrixAt(shardCount++, m.compose(p, q, s));
        }
      } else if (o.type === BAR) {
        const hw = o.w / 2;
        const cx = THREE.MathUtils.clamp(shipX, o.x - hw, o.x + hw);
        const cz = THREE.MathUtils.clamp(0, o.z - o.d / 2, o.z + o.d / 2);
        const dx = shipX - cx;
        const dz = -cz;
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
      } else if (o.type === LASER) {
        o.x = o.baseX + Math.sin(this.time * o.freq + o.phase) * o.amp;
        const g0 = o.x - o.gapW / 2;
        const g1 = o.x + o.gapW / 2;
        const inZ = Math.abs(o.z) < o.d / 2 + R || crossed;
        const outside = shipX - R < g0 || shipX + R > g1;
        if (!hit && inZ && outside) hit = o;
        if (!o.passed && crossed) {
          o.passed = true;
          const gap = Math.min(shipX - R - g0, g1 - shipX - R);
          if (!hit && gap > 0 && gap < margin && !this._awarded.has(o.group) && (!best || gap < best.gap)) {
            best = { x: shipX - g0 < g1 - shipX ? g0 : g1, z: o.z, side: shipX - g0 < g1 - shipX ? -1 : 1, gap, group: o.group };
          }
        }
        // Thin "warming up" beam far away, full fence once it's close.
        const heat = THREE.MathUtils.clamp((o.z + 75) / 20, 0.12, 1);
        const flick = 0.85 + Math.random() * 0.15;
        q.identity();
        const leftW = g0 - (-H - 1.5);
        const rightW = (H + 1.5) - g1;
        if (laserCount < 15) {
          p.set(-H - 1.5 + leftW / 2, 0, o.z); s.set(leftW, 0.7 * heat * flick, 0.12);
          this.lasers.setMatrixAt(laserCount++, m.compose(p, q, s));
          p.set(g1 + rightW / 2, 0, o.z); s.set(rightW, 0.7 * heat * flick, 0.12);
          this.lasers.setMatrixAt(laserCount++, m.compose(p, q, s));
        }
      } else if (o.type === WELL) {
        const dx = o.x - shipX;
        // Pull the ship toward the well while it's nearby.
        const dist2 = dx * dx + o.z * o.z;
        if (Math.abs(o.z) < 9) this.pull += Math.sign(dx) * 26 / (1 + dist2 * 0.35);
        const reach = 0.45 + R;
        if (!hit && (dist2 < reach * reach || (crossed && Math.abs(dx) < reach))) hit = o;
        if (wellCount < 6) {
          p.set(o.x, -0.2, o.z);
          q.setFromEuler(e.set(0, this.time * 3 + i, 0));
          s.setScalar(1);
          this.wellRings.setMatrixAt(wellCount, m.compose(p, q, s));
          p.y = 0;
          this.wellCores.setMatrixAt(wellCount++, m.compose(p, q, s));
        }
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
    this.bigEggs.count = eggCount;
    this.shards.count = shardCount;
    this.lasers.count = laserCount;
    this.wellRings.count = this.wellCores.count = wellCount;
    for (const mesh of [this.rocks, this.bars, this.bigEggs, this.shards, this.lasers, this.wellRings, this.wellCores]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.barMat.emissiveIntensity = 1.3 + Math.sin(this.time * 10) * 0.4;
    this.wellMat.opacity = 0.35 + Math.sin(this.time * 5) * 0.1;
    return hit;
  }
}
