// Loot on the ground: a spinning meso coin or a potion bottle. Pops out of
// the mob, lands, bobs, and is collected when the player walks within 1.2 m.
import * as THREE from 'three';
import { toon, lathe, outline, flat, INK } from '../assets/toon.js';

export const PICKUP_RANGE = 1.2;
export const DESPAWN = 60;
export const MAGNET = 5;

const outlineMat = flat(INK, { side: THREE.BackSide });
const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18);
const coinMat = toon(0xf5c63a, { emissive: 0x3a2800 });
const bottleGeo = lathe([[0, 0], [0.13, 0], [0.16, 0.12], [0.13, 0.24], [0.06, 0.3], [0.06, 0.38], [0, 0.38]], 14);
const potionMats = { red: toon(0xe8352a), blue: toon(0x2f7de1) };

export class Drop {
  /** loot: { kind: 'mesos', amount } | { kind: 'potion', item: 'red'|'blue' } */
  constructor(loot, x, z, groundY, rng = Math.random) {
    this.loot = loot;
    this.object3d = new THREE.Group();
    const mesh = loot.kind === 'mesos'
      ? new THREE.Mesh(coinGeo, coinMat)
      : outline(new THREE.Mesh(bottleGeo, potionMats[loot.item]), 1.1, outlineMat);
    if (loot.kind === 'mesos') mesh.rotation.x = Math.PI / 2;
    this.mesh = mesh;
    this.object3d.add(mesh);
    const a = rng() * Math.PI * 2;
    this.vel = { x: Math.cos(a) * 1.2, y: 5, z: Math.sin(a) * 1.2 };
    this.object3d.position.set(x, groundY + 0.6, z);
    this.ground = groundY;
    this.landed = false;
    this.age = 0;
  }

  get position() { return this.object3d.position; }

  /** Returns 'picked', 'expired' or null. */
  update(dt, t, player) {
    this.age += dt;
    const p = this.object3d.position;
    if (!this.landed) {
      this.vel.y -= 18 * dt;
      p.x += this.vel.x * dt; p.z += this.vel.z * dt; p.y += this.vel.y * dt;
      if (p.y <= this.ground + 0.25) { p.y = this.ground + 0.25; this.landed = true; }
    } else {
      p.y = this.ground + 0.25 + Math.sin(t * 3 + p.x) * 0.06;
      // magnet: loot within 5 m flies to the player, faster as it gets close
      const dx = player.position.x - p.x, dz = player.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < MAGNET && this.age > 0.5 && !player.dead) {
        const sp = 4 + (MAGNET - d) * 4;
        p.x += dx / d * Math.min(d, sp * dt); p.z += dz / d * Math.min(d, sp * dt);
        p.y += Math.sin(Math.min(1, d / MAGNET) * Math.PI) * 0.4;
      }
    }
    this.object3d.rotation.y += dt * 2.5;
    if (this.landed && this.age > 0.5 && Math.hypot(player.position.x - p.x, player.position.z - p.z) < PICKUP_RANGE && Math.abs(player.position.y - this.ground) < 1.5) return 'picked';
    if (this.age > DESPAWN) return 'expired';
    return null;
  }
}
