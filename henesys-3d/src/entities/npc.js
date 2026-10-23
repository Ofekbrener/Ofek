// A standing NPC: idles, turns to face a nearby player, opens a dialog on tap.
import * as THREE from 'three';
import { nameTag } from '../assets/props.js';
import { showDialog } from '../dialog.js';

export const TALK_RANGE = 6;

export class Npc {
  /** talk: () => { lines, choices? } so dialogs can depend on game state. */
  constructor(id, name, model, x, z, ry, talk) {
    this.id = id; this.name = name; this.model = model; this.talk = talk;
    this.object3d = new THREE.Group();
    this.object3d.add(model.object3d);
    this.object3d.position.set(x, 0, z);
    this.baseYaw = ry;
    this.yaw = ry;
    model.object3d.rotation.y = ry;
    const tag = nameTag(name, '#ffe680');
    tag.position.y = -0.25;
    this.object3d.add(tag);
    // invisible hit volume for taps
    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 1;
    this.hitbox.userData.npc = this;
    this.object3d.add(this.hitbox);
  }

  get position() { return this.object3d.position; }

  update(dt, t, player) {
    const p = player.position, d = Math.hypot(p.x - this.position.x, p.z - this.position.z);
    const target = d < TALK_RANGE ? Math.atan2(p.x - this.position.x, p.z - this.position.z) : this.baseYaw;
    let dy = target - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-5 * dt));
    this.model.object3d.rotation.y = this.yaw;
    this.model.animate('idle', dt, t, 0);
  }

  onTap() { return showDialog({ name: this.name, ...this.talk() }); }
}
