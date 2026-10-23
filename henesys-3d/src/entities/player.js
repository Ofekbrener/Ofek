// The player: camera-relative movement, jumping, collision, and the
// third-person follow camera. Everything eases; nothing snaps.
import * as THREE from 'three';
import { resolve, groundHeight, canStep } from '../rules/collision.js';
import { ease } from '../ease.js';
import { classicStep } from '../rules/controls.js';

export const WALK_SPEED = 5;
export const JUMP_VELOCITY = 7;
export const GRAVITY = 20;
export const RADIUS = 0.4;
// Highest ledge you can walk up without jumping.
export const STEP = 0.45;
export const CAM_DIST = 12;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _ray = new THREE.Raycaster();
const CAM_HEIGHT = 1.2;

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
    this.lungeT = 0;
    this.speedMod = 1;   // Haste
    this.backward = false;
  }

  /** Dark Sight: fade the model to a ghost while monsters cannot see you. */
  setHidden(hidden) {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.model.object3d.traverse(o => {
      if (!o.material) return;
      o.material.transparent = hidden; o.material.opacity = hidden ? 0.35 : 1; o.material.needsUpdate = true;
    });
  }

  /** Short step forward with each melee swing. */
  lunge() { this.lungeT = 0.13; }

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
    this.faded?.clear(); this.camLast = null;
  }

  faceTowards(x, z) {
    this.targetYaw = Math.atan2(x - this.position.x, z - this.position.z);
  }

  update(dt, input, map, t) {
    let mag, dx, dz;
    if (input.scheme === 'classic' && !this.dead) {
      // stick up/down walks along the facing, left/right turns in place
      const r = classicStep(input.move, this.targetYaw, dt);
      this.targetYaw = r.yaw; this.yaw = r.yaw;
      dx = r.dx; dz = r.dz; mag = Math.hypot(dx, dz);
      this.backward = r.back;
    } else {
      const yaw = input.camYaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // camera forward on the ground
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // camera right
      const mx = this.dead ? 0 : input.move.x, my = this.dead ? 0 : input.move.y;
      mag = Math.min(1, Math.hypot(mx, my));
      dx = (fx * my + rx * mx); dz = (fz * my + rz * mx);
      if (mag > 0.05) this.targetYaw = Math.atan2(dx, dz);
      this.backward = false;
    }

    if (mag > 0.05) {
      const step = WALK_SPEED * this.speedMod * dt;
      const next = resolve({ x: this.position.x + dx * step, z: this.position.z + dz * step }, RADIUS, map.colliders, map.bounds);
      // a ledge taller than STEP blocks you unless you jump onto it
      if (canStep(this.position.y, groundHeight(map.heightFns, next.x, next.z), STEP)) { this.position.x = next.x; this.position.z = next.z; }
    } else {
      const fixed = resolve({ x: this.position.x, z: this.position.z }, RADIUS, map.colliders, map.bounds);
      this.position.x = fixed.x; this.position.z = fixed.z;
    }
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      const step = 3.2 * dt;
      const l = resolve({ x: this.position.x + Math.sin(this.yaw) * step, z: this.position.z + Math.cos(this.yaw) * step }, RADIUS, map.colliders, map.bounds);
      this.position.x = l.x; this.position.z = l.z;
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

    this.anim = !this.onGround ? 'jump' : this.speed > 0.15 ? (this.backward ? 'back' : 'walk') : 'idle';
    this.model.animate(this.anim, dt, t, this.speed * this.speedMod);
  }

  /** occluders: big meshes (trees, houses) the camera should not hide behind. */
  /** Trees between the camera and the player turn see-through; the camera keeps its distance. */
  fadeOccluders(occluders, dist, dt) {
    const from = _v1.set(this.position.x, this.position.y + 1, this.position.z);
    const to = _v2.copy(this.camLast ?? from);
    const len = Math.min(dist + 1, to.distanceTo(from));
    this.faded ??= new Map();
    const blocking = new Set();
    if (len > 0.5) {
      _ray.set(from, to.sub(from).normalize()); _ray.far = len;
      for (const h of _ray.intersectObjects(occluders, true)) {
        let o = h.object; while (o && !occluders.includes(o)) o = o.parent;
        if (o) blocking.add(o);
      }
    }
    // anything that fills the near view (within 2.5 m of the camera's sight line) fades too
    const cam = this.camLast;
    if (cam) for (const o of occluders) {
      const b = o.userData.bounds ??= new THREE.Box3().setFromObject(o);
      for (let k = 0; k <= 3; k++) if (b.distanceToPoint(_v3.copy(cam).lerp(from, k * 0.2)) < 2.5) { blocking.add(o); break; }
    }
    for (const o of blocking) if (!this.faded.has(o)) this.faded.set(o, 1);
    for (const [o, a] of this.faded) {
      const next = ease(a, blocking.has(o) ? 0.25 : 1, 8, dt);
      setOpacity(o, next);
      if (next > 0.98 && !blocking.has(o)) { setOpacity(o, 1); this.faded.delete(o); }
      else this.faded.set(o, next);
    }
  }

  updateCamera(camera, input, dt, occluders = null) {
    let dist = CAM_DIST * (input.zoom ?? 1);
    if (occluders?.length) this.fadeOccluders(occluders, dist, dt);
    this.camFocus.x = ease(this.camFocus.x, this.position.x, 10, dt);
    this.camFocus.z = ease(this.camFocus.z, this.position.z, 10, dt);
    this.camFocus.y = ease(this.camFocus.y, this.position.y, 6, dt);
    const pitch = input.camPitch, yaw = input.camYaw;
    const horiz = Math.cos(pitch) * dist;
    camera.position.set(
      this.camFocus.x + Math.sin(yaw) * horiz,
      this.camFocus.y + CAM_HEIGHT + Math.sin(pitch) * dist,
      this.camFocus.z + Math.cos(yaw) * horiz,
    );
    camera.lookAt(this.camFocus.x, this.camFocus.y + CAM_HEIGHT, this.camFocus.z);
    (this.camLast ??= new THREE.Vector3()).copy(camera.position);
  }
}

/** Fade a prop by swapping in private transparent copies of its materials; 1 restores the shared ones. */
function setOpacity(obj, a) {
  obj.traverse(m => {
    if (!m.isMesh) return;
    if (a >= 1) { if (m.userData.solidMat) { for (const x of [m.material].flat()) x.dispose(); m.material = m.userData.solidMat; delete m.userData.solidMat; } return; }
    if (!m.userData.solidMat) {
      m.userData.solidMat = m.material;
      m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
      for (const x of [m.material].flat()) { x.transparent = true; x.depthWrite = false; }
    }
    for (const x of [m.material].flat()) x.opacity = a;
  });
}
