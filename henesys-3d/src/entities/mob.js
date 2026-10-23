// A monster in the world: wanders its zone, chases the player after being
// hit, gives up 15 m from where the fight started, fades out on death.
import * as THREE from 'three';
import { MOBS } from '../config.js';
import { resolve, groundHeight } from '../rules/collision.js';
import { ease } from '../ease.js';

export const LEASH = 15;

export class Mob {
  constructor(id, model, x, z, zone, rng = Math.random) {
    this.id = id; this.def = MOBS[id]; this.model = model; this.zone = zone; this.rng = rng;
    this.hp = this.def.hp;
    this.state = 'wander';
    this.object3d = new THREE.Group();
    this.object3d.add(model.object3d);
    this.object3d.position.set(x, 0, z);
    this.yaw = rng() * Math.PI * 2;
    this.goal = null; this.wait = rng() * 2; this.moving = false;
    this.leashFrom = null;
    this.hpShownFor = 0;
    this.removable = false;
  }

  get position() { return this.object3d.position; }
  get alive() { return this.state !== 'dead'; }
  get radius() { return this.model.radius; }

  takeHit(amount, fromX, fromZ, force = 1) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hpShownFor = 4;
    this.model.hit();
    if (this.state === 'wander') { this.state = 'chase'; this.leashFrom = { x: this.position.x, z: this.position.z }; }
    // small knock-back away from the attacker
    const dx = this.position.x - fromX, dz = this.position.z - fromZ, d = Math.hypot(dx, dz) || 1;
    this.knock = { x: dx / d * 4 * force, z: dz / d * 4 * force };
    if (this.hp === 0) { this.state = 'dead'; return true; }
    return false;
  }

  update(dt, t, player, map) {
    this.hpShownFor -= dt;
    if (!this.alive) {
      this.model.animate('die', dt, t);
      if (this.model.dead) this.removable = true;
      return;
    }
    const area = map.zones[this.zone].area, speed = this.def.speed;
    let tx = null, tz = null, sp = 0;
    if (this.state === 'chase') {
      const fromStart = Math.hypot(this.position.x - this.leashFrom.x, this.position.z - this.leashFrom.z);
      const toPlayer = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
      if (fromStart > LEASH || toPlayer > LEASH + 5 || player.dead || player.hidden) { this.state = 'wander'; this.goal = null; this.leashFrom = null; }
      else if (toPlayer > this.radius + 0.3) { tx = player.position.x; tz = player.position.z; sp = speed * 1.6; }
    }
    if (this.state === 'wander') {
      if (!this.goal) {
        this.wait -= dt;
        if (this.wait <= 0) {
          this.goal = { x: area.x + (this.rng() - 0.5) * area.w, z: area.z + (this.rng() - 0.5) * area.d };
          if (Math.hypot(this.goal.x - this.position.x, this.goal.z - this.position.z) > 8) {
            const k = 8 / Math.hypot(this.goal.x - this.position.x, this.goal.z - this.position.z);
            this.goal.x = this.position.x + (this.goal.x - this.position.x) * k;
            this.goal.z = this.position.z + (this.goal.z - this.position.z) * k;
          }
        }
      } else {
        tx = this.goal.x; tz = this.goal.z; sp = speed;
        if (Math.hypot(tx - this.position.x, tz - this.position.z) < 0.4) { this.goal = null; this.wait = 1 + this.rng() * 3; tx = null; }
      }
    }

    let nx = this.position.x, nz = this.position.z;
    if (tx != null) {
      const dx = tx - nx, dz = tz - nz, d = Math.hypot(dx, dz);
      nx += dx / d * sp * dt; nz += dz / d * sp * dt;
      const want = Math.atan2(dx, dz);
      let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * (1 - Math.exp(-6 * dt));
    }
    if (this.knock) {
      nx += this.knock.x * dt; nz += this.knock.z * dt;
      this.knock.x = ease(this.knock.x, 0, 8, dt); this.knock.z = ease(this.knock.z, 0, 8, dt);
      if (Math.abs(this.knock.x) + Math.abs(this.knock.z) < 0.05) this.knock = null;
    }
    const p = resolve({ x: nx, z: nz }, this.radius, map.colliders, map.bounds);
    this.position.x = p.x; this.position.z = p.z;
    this.position.y = ease(this.position.y, groundHeight(map.heightFns, p.x, p.z), 12, dt);
    this.object3d.rotation.y = this.yaw;
    this.model.animate(tx != null ? 'move' : 'idle', dt, t);
  }
}
