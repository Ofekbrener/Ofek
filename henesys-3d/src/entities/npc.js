// A standing NPC: idles, turns to face a nearby player, opens a dialog on tap.
import * as THREE from 'three';
import { nameTag } from '../assets/props.js';
import { showDialog } from '../dialog.js';

export const TALK_RANGE = 6;

const markerTextures = {};
function markerTexture(kind) {
  if (markerTextures[kind]) return markerTextures[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 110px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = '#3a2412'; g.strokeText(kind, 64, 70);
  g.fillStyle = kind === '?' ? '#7cf05a' : '#ffd23f'; g.fillText(kind, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (markerTextures[kind] = t);
}
function markerSprite() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('!'), depthTest: false, transparent: true }));
  s.scale.set(0.8, 0.8, 1); s.renderOrder = 11;
  return s;
}

export class Npc {
  /**
   * talk: () => { lines, choices? } so dialogs can depend on game state.
   * quests (optional): { dialog(npcId) -> dialog | null, marker(npcId) -> '!' | '?' | '' }
   */
  constructor(id, name, model, x, z, ry, talk, quests = null) {
    this.id = id; this.name = name; this.model = model; this.talk = talk; this.quests = quests;
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
    // quest marker floating over the head: yellow ! (new quest) or ? (ready to turn in)
    this.marker = markerSprite();
    this.marker.position.y = 2.35;
    this.marker.visible = false;
    this.object3d.add(this.marker);
    this.markerKind = '';
  }

  get position() { return this.object3d.position; }

  update(dt, t, player) {
    const p = player.position, d = Math.hypot(p.x - this.position.x, p.z - this.position.z);
    const target = d < TALK_RANGE ? Math.atan2(p.x - this.position.x, p.z - this.position.z) : this.baseYaw;
    let dy = target - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-5 * dt));
    this.model.object3d.rotation.y = this.yaw;
    this.model.animate('idle', dt, t, 0);
    const kind = this.quests?.marker(this.id) ?? '';
    if (kind !== this.markerKind) { this.markerKind = kind; this.marker.visible = !!kind; if (kind) this.marker.material.map = markerTexture(kind); }
    if (kind) { this.marker.position.y = 2.35 + Math.sin(t * 3) * 0.08; }
  }

  onTap() {
    const q = this.quests?.dialog(this.id);
    return showDialog({ name: this.name, ...(q ?? this.talk()) });
  }
}
