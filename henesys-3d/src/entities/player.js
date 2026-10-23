// The player: camera-relative movement, jumping, collision, and the
// third-person follow camera. Everything eases; nothing snaps.
import * as THREE from 'three';
import { resolve, groundHeight } from '../rules/collision.js';
import { ease } from '../ease.js';

export const WALK_SPEED = 5;
export const JUMP_VELOCITY = 7;
export const GRAVITY = 20;
export const RADIUS = 0.4;
const CAM_DIST = 6;
const CAM_HEIGHT = 1.4;

export class Player {
  constructor(character, model) {
    this.character = character;
    this.model = model;
    this.object3d = new THREE.Group();
    this.object3d.add(model.object3d);
    this.vy = 0;
    this.onGround = true;
    this.speed = 0;      // eased 0..1 for the walk animation
    this.yaw = 0;        // facing, eased toward targetYaw
    this.targetYaw = 0;
    this.camFocus = new THREE.Vector3();
    this.anim = 'idle';
    this.knock = null;
  }

  /** Shove the player away from (x, z), e.g. after a monster bump. */
  knockFrom(x, z) {
    const dx = this.position.x - x, dz = this.position.z - z, d = Math.hypot(dx, dz) || 1;
    this.knock = { x: dx / d * 6, z: dz / d * 6 };
    if (this.onGround) { this.vy = 3.5; this.onGround = false; }
  }

  get position() { return this.object3d.position; }

  place(x, z, map) {
    this.position.set(x, groundHeight(map.heightFns, x, z), z);
    this.vy = 0;
    this.camFocus.copy(this.position);
  }

  faceTowards(x, z) {
    this.targetYaw = Math.atan2(x - this.position.x, z - this.position.z);
  }

  update(dt, input, map, t) {
    const yaw = input.camYaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // camera forward on the ground
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // camera right
    const mx = input.move.x, my = input.move.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    const dx = (fx * my + rx * mx), dz = (fz * my + rz * mx);

    if (mag > 0.05) {
      this.targetYaw = Math.atan2(dx, dz);
      const step = WALK_SPEED * dt;
      const next = resolve({ x: this.position.x + dx * step, z: this.position.z + dz * step }, RADIUS, map.colliders, map.bounds);
      this.position.x = next.x; this.position.z = next.z;
    } else {
      const fixed = resolve({ x: this.position.x, z: this.position.z }, RADIUS, map.colliders, map.bounds);
      this.position.x = fixed.x; this.position.z = fixed.z;
    }
    if (this.knock) {
      const k = resolve({ x: this.position.x + this.knock.x * dt, z: this.position.z + this.knock.z * dt }, RADIUS, map.colliders, map.bounds);
      this.position.x = k.x; this.position.z = k.z;
      this.knock.x = ease(this.knock.x, 0, 7, dt); this.knock.z = ease(this.knock.z, 0, 7, dt);
      if (Math.abs(this.knock.x) + Math.abs(this.knock.z) < 0.1) this.knock = null;
    }
    this.speed = ease(this.speed, mag, 12, dt);

    // facing: shortest-angle ease
    let dyaw = this.targetYaw - this.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.yaw += dyaw * (1 - Math.exp(-14 * dt));
    this.object3d.rotation.y = this.yaw;

    // vertical
    const floor = groundHeight(map.heightFns, this.position.x, this.position.z);
    if (input.pressed('jump') && this.onGround && !this.dead) { this.vy = JUMP_VELOCITY; this.onGround = false; this.onJump?.(); }
    this.vy -= GRAVITY * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= floor) {
      // step up small ledges, land on everything else
      this.position.y = floor; this.vy = 0; this.onGround = true;
    } else if (this.position.y - floor > 0.05) {
      this.onGround = false;
    }

    this.anim = !this.onGround ? 'jump' : (this.speed > 0.15 ? 'walk' : 'idle');
    this.model.animate(this.anim, dt, t, this.speed);
  }

  updateCamera(camera, input, dt) {
    this.camFocus.x = ease(this.camFocus.x, this.position.x, 10, dt);
    this.camFocus.z = ease(this.camFocus.z, this.position.z, 10, dt);
    this.camFocus.y = ease(this.camFocus.y, this.position.y, 6, dt);
    const pitch = input.camPitch, yaw = input.camYaw;
    const horiz = Math.cos(pitch) * CAM_DIST;
    camera.position.set(
      this.camFocus.x + Math.sin(yaw) * horiz,
      this.camFocus.y + CAM_HEIGHT + Math.sin(pitch) * CAM_DIST,
      this.camFocus.z + Math.cos(yaw) * horiz,
    );
    camera.lookAt(this.camFocus.x, this.camFocus.y + CAM_HEIGHT, this.camFocus.z);
  }
}
