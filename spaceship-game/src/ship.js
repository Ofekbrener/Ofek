import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mergeColored, tf } from './geo.js';
import { COSMETICS } from './progression.js';

// Player egg-pod: a rocket-powered egg (like the chicken rivals') flown by a
// human pilot in a helmet under a glass bubble. Points toward -Z.
//
// Draw calls: hull, accent band, glass dome (skin materials, recoloured by
// setSkin), one merged vertex-coloured mesh for the pilot + details + every
// upgrade part, one merged unlit mesh for glowing upgrade parts, one additive
// flame mesh, one instanced mesh for the shield-emitter orbs, and the shield
// bubble. The two merged upgrade meshes are only rebuilt when the upgrade
// levels (or the skin) change.

const EGG_R = 0.56;    // max radius
const EGG_A = 0.85;    // half length (nose at z = -A, tail at z = +A)
const FLAT = 0.75;     // vertical squash of the egg cross-section
const MODEL_SCALE = 1.45;

const DARK = 0x2a3350;
const METAL = 0x8a93a8;
const ARMOR = 0x5a6378;
const SUIT = 0xff7a1a;
const HELMET = 0xf4f6fb;

const UPGRADE_IDS = ['engine', 'accel', 'grip', 'tank', 'armor', 'shield', 'magnet', 'thrusters', 'booster', 'focus', 'lucky'];

// Egg profile radius for u in [-1 (tail), 1 (nose)]; slightly pointier nose.
function eggR(u) {
  return EGG_R * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.14 * u);
}

// Surface of revolution of the egg profile, already in model space.
// u0..u1: slice along the axis; phi0/phiLen: slice around it (0 = top, PI/2 = +X).
function eggShell(u0, u1, { phi0 = 0, phiLen = Math.PI * 2, scale = 1, segs = 16, steps = 12 } = {}) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + (u1 - u0) * (i / steps);
    pts.push(new THREE.Vector2(Math.max(0.0005, eggR(u)) * scale, u * EGG_A * scale));
  }
  const g = new THREE.LatheGeometry(pts, segs, phi0, phiLen);
  g.rotateX(-Math.PI / 2);   // lathe +Y (nose) -> -Z, lathe +Z (phi 0) -> +Y
  g.scale(1, FLAT, 1);
  return g;
}

// Point on the egg surface (model space) at axial u and angle phi, pushed out by `out`.
function eggPoint(u, phi, out = 1) {
  const r = eggR(u) * out;
  return [Math.sin(phi) * r, Math.cos(phi) * r * FLAT, -u * EGG_A];
}

const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.group.add(this.model);
    scene.add(this.group);
    this.pod = new THREE.Group();
    this.pod.position.y = -0.12;
    this.model.add(this.pod);

    // Skin materials (recoloured by setSkin).
    this.hullMat = new THREE.MeshStandardMaterial({ color: 0xd8e2f0, metalness: 0.45, roughness: 0.35, flatShading: true });
    this.accentMat = new THREE.MeshStandardMaterial({ color: 0xff3ca8, emissive: 0xff3ca8, emissiveIntensity: 0.6, flatShading: true });
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x3cf2ff, emissive: 0x1aa6c4, emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.05,
      transparent: true, opacity: 0.38, depthWrite: false,
    });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x9ff8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.partsMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.45, flatShading: true });
    this.litMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

    // Egg hull
    const hull = new THREE.Mesh(eggShell(-1, 1, { segs: 16, steps: 14 }), this.hullMat);
    this.pod.add(hull);
    // Accent band around the waist, just behind the cockpit.
    this.band = new THREE.Mesh(eggShell(-0.6, -0.47, { scale: 1.03, segs: 16, steps: 2 }), this.accentMat);
    this.pod.add(this.band);

    // Glass bubble dome over the pilot.
    const domeGeo = new THREE.SphereGeometry(0.34, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.scale(0.95, 1.2, 1.3);
    this.dome = new THREE.Mesh(domeGeo, this.glassMat);
    this.dome.position.set(0, 0.3, -0.12);
    this.dome.renderOrder = 2;
    this.pod.add(this.dome);

    // Upgrade-driven meshes.
    this.parts = new THREE.Mesh(new THREE.BufferGeometry(), this.partsMat);
    this.lit = new THREE.Mesh(new THREE.BufferGeometry(), this.litMat);
    this.flame = new THREE.Mesh(new THREE.BufferGeometry(), this.glowMat);
    this.flameZ = 0.8;
    this.flame.position.z = this.flameZ;
    this.pod.add(this.parts, this.lit, this.flame);

    this.orbs = new THREE.InstancedMesh(mergeColored([
      { geo: ico(0.085, 1), color: 0xffffff },
      { geo: tf(new THREE.TorusGeometry(0.13, 0.018, 4, 14), { r: [Math.PI / 2, 0, 0] }), color: 0x6fb8ff },
    ]), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 3);
    this.orbs.count = 0;
    this.orbs.frustumCulled = false;
    this.pod.add(this.orbs);
    this._orbM = new THREE.Matrix4();

    // Trail origins (read by nozzleWorld / scaled by race.js).
    this.nozzles = [new THREE.Object3D(), new THREE.Object3D()];
    this.pod.add(this.nozzles[0], this.nozzles[1]);

    // Engine light illuminating the ship + nearby debris
    this.engineLight = new THREE.PointLight(0x4fdcff, 6, 8, 2);
    this.engineLight.position.set(0, 0.2, 2.0);
    this.group.add(this.engineLight);

    this.model.scale.setScalar(MODEL_SCALE);

    // Shield bubble: fresnel rim glow, additive.
    this.shieldMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(0x6fb8ff) } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uAlpha; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float f = pow(1.0 - abs(dot(vN, vV)), 2.5);
          float bands = 0.5 + 0.5 * sin(vP.y * 18.0 - uTime * 6.0);
          float a = (f * 0.9 + bands * f * 0.4 + 0.04) * uAlpha;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), this.shieldMat);
    this.shield.scale.set(1.2, 0.8, 1.3);
    this.shield.visible = false;
    this.group.add(this.shield);
    this.shieldTarget = 0;
    this.shielded = false;
    this.dash = false;
    this.push = 0;            // external lateral force (gravity wells)
    this.invuln = 0;
    this.handling = 1;
    this.trailColor = [0.45, 0.9, 1];
    this.trailColor2 = [1, 0.4, 1];

    this.x = 0;
    this.vx = 0;
    this.targetX = 0;
    this.time = 0;
    this._tmp = new THREE.Vector3();

    // Cosmetic add-ons: wings (flap), propeller blades (spin), pet (follows beside the pod).
    this.cosmetics = {};
    this.wingPivots = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.4 * side, 0.1, 0.05);
      pivot.scale.x = side;               // right wing is the mirrored left one
      const solidW = new THREE.Mesh(new THREE.BufferGeometry(), this.partsMat);
      const litW = new THREE.Mesh(new THREE.BufferGeometry(), this.litMat);
      pivot.add(solidW, litW);
      pivot.userData = { solid: solidW, lit: litW, side };
      this.pod.add(pivot);
      return pivot;
    });
    this.propeller = new THREE.Mesh(new THREE.BufferGeometry(), this.partsMat);
    this.propeller.position.set(0, 0.86, -0.12);
    this.pod.add(this.propeller);
    this.pet = new THREE.Group();
    this.petSolid = new THREE.Mesh(new THREE.BufferGeometry(), this.partsMat);
    this.petLit = new THREE.Mesh(new THREE.BufferGeometry(), this.litMat);
    this.pet.add(this.petSolid, this.petLit);
    this.pet.scale.setScalar(0.62);
    this.pet.visible = false;
    this.group.add(this.pet);
    this._rainbow = [[1, 0, 0], [1, 1, 1]];

    this.skinColors = { hull: 0xd8e2f0, accent: 0xff3ca8, glass: 0x3cf2ff, trail: [0.45, 0.9, 1] };
    this.levels = {};
    for (const id of UPGRADE_IDS) this.levels[id] = 0;
    this._buildParts();
    this.reset();
  }

  reset() {
    this.x = 0;
    this.vx = 0;
    this.targetX = 0;
    this.invuln = 0;
    this.push = 0;
    this.dash = false;
    this.group.position.set(0, 0, 0);
    this.group.visible = true;
    this.model.visible = true;
  }

  setSkin(skin) {
    this.hullMat.color.setHex(skin.hull);
    this.accentMat.color.setHex(skin.accent);
    this.accentMat.emissive.setHex(skin.accent);
    this.glassMat.color.setHex(skin.glass);
    this.glassMat.emissive.setHex(skin.glass).multiplyScalar(0.55);
    this.glowMat.color.setRGB(0.6 + skin.trail[0] * 0.4, 0.6 + skin.trail[1] * 0.4, 0.6 + skin.trail[2] * 0.4);
    this.engineLight.color.setRGB(skin.trail[0], skin.trail[1], skin.trail[2]);
    this.skinTrail = [skin.trail, skin.trail2];
    this._applyTrail();
    // Some upgrade parts carry the skin's colours: rebuild only if they changed.
    const s = this.skinColors;
    if (s.hull !== skin.hull || s.accent !== skin.accent || s.glass !== skin.glass || s.trail.join() !== skin.trail.join()) {
      this.skinColors = { hull: skin.hull, accent: skin.accent, glass: skin.glass, trail: skin.trail.slice() };
      this._buildParts();
    }
  }

  /**
   * Show purchased upgrades on the pod. `levels` = {engine, accel, grip, tank,
   * armor, shield, magnet, thrusters, booster, focus, lucky}; missing = 0.
   * Rebuilds the merged geometry only when something changed.
   */
  setUpgrades(levels = {}) {
    let changed = false;
    for (const id of UPGRADE_IDS) {
      const v = Math.max(0, (levels[id] | 0));
      if (this.levels[id] !== v) { this.levels[id] = v; changed = true; }
    }
    const cos = levels.cosmetics || {};
    if (JSON.stringify(cos) !== JSON.stringify(this.cosmetics)) {
      this.cosmetics = { ...cos };
      this._applyTrail();
      changed = true;
    }
    if (changed) this._buildParts();
    return changed;
  }

  // Engine flame length (race.js / preview drive this directly).
  setThrust(s) {
    for (const n of this.nozzles) n.scale.setScalar(s);
    this.flame.scale.set(1, 1, s);
  }

  // Per-frame animation of upgrade parts (orbiting shield emitters).
  animate(dt) {
    this._animT = (this._animT || 0) + dt;
    this._animateCosmetics(this._animT);
    const n = this.orbs.count;
    if (!n) return;
    const t = this._animT;
    const m = this._orbM;
    for (let i = 0; i < n; i++) {
      const a = t * 1.8 + (i / n) * Math.PI * 2;
      m.makeRotationY(-a + t * 2);
      m.setPosition(Math.cos(a) * 0.95, 0.22 + Math.sin(t * 3 + i * 2) * 0.08, Math.sin(a) * 1.1);
      this.orbs.setMatrixAt(i, m);
    }
    this.orbs.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- build
  _buildParts() {
    const L = this.levels;
    const S = this.skinColors;
    const solid = [];
    const lit = [];
    const flame = [];
    const P = (geo, color) => solid.push({ geo, color });
    const G = (geo, color) => lit.push({ geo, color });
    const trailHex = new THREE.Color(S.trail[0], S.trail[1], S.trail[2]).getHex();
    const FZ = this.flameZ;
    // Flame: disc + cone at nozzle (x, y, z) facing +Z, radius r, length len.
    const F = (x, y, z, r, len) => {
      flame.push({ geo: tf(new THREE.CircleGeometry(r, 10), { p: [x, y, z - FZ + 0.005] }), color: 0x5a5a5a });
      flame.push({ geo: tf(new THREE.CircleGeometry(r * 0.55, 8), { p: [x, y, z - FZ + 0.008] }), color: 0xcfcfcf });
      // Open cone fading from bright at the nozzle to black (= invisible, additive) at the tip.
      const cone = new THREE.ConeGeometry(r * 0.75, len, 8, 3, true);
      const cp = cone.attributes.position;
      const cc = new Float32Array(cp.count * 3);
      for (let i = 0; i < cp.count; i++) {
        const t = (cp.getY(i) + len / 2) / len;
        const b = Math.pow(1 - t, 2) * 0.6;
        cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = b;
      }
      cone.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      flame.push({ geo: tf(cone, { r: [Math.PI / 2, 0, 0], p: [x, y, z - FZ + len / 2] }), color: null });
    };

    // ---- pilot (human, helmet + visor) ----
    P(tf(ico(0.16, 1), { s: [1.25, 0.75, 0.95], p: [0, 0.36, -0.06] }), SUIT);           // shoulders
    P(tf(ico(0.135, 2), { p: [0, 0.52, -0.1] }), HELMET);                                   // helmet
    P(tf(new THREE.BoxGeometry(0.035, 0.03, 0.24), { p: [0, 0.645, -0.08] }), S.accent);   // helmet ridge
    P(tf(cyl(0.05, 0.05, 0.05, 8), { r: [0, 0, Math.PI / 2], p: [0.135, 0.51, -0.08] }), 0x3a4460); // ear cups
    P(tf(cyl(0.05, 0.05, 0.05, 8), { r: [0, 0, Math.PI / 2], p: [-0.135, 0.51, -0.08] }), 0x3a4460);
    const visorGeo = () => new THREE.SphereGeometry(0.142, 14, 5, Math.PI * 1.5 - 0.95, 1.9, 1.2, 0.65);
    P(tf(visorGeo(), { p: [0, 0.52, -0.1] }), L.focus ? 0x0d1a33 : 0xffb13c);              // gold visor (dark when focus lens glows)
    // cockpit rim
    P(tf(new THREE.TorusGeometry(0.34, 0.03, 5, 24), { r: [Math.PI / 2, 0, 0], s: [0.95, 1.3, 1], p: [0, 0.3, -0.12] }), DARK);

    // ---- base hull details ----
    // central rear engine (bigger per engine level)
    const eL = L.engine;
    const eR = 0.2 + eL * 0.03;
    const eLen = 0.3 + eL * 0.05;
    const eZ = EGG_A - 0.08 + eLen / 2;
    P(tf(cyl(eR * 0.9, eR * 1.1, eLen, 14), { r: [Math.PI / 2, 0, 0], p: [0, 0, eZ] }), DARK);
    P(tf(new THREE.TorusGeometry(eR * 0.95, 0.03, 5, 16), { p: [0, 0, eZ + eLen / 2] }), METAL);
    for (let i = 0; i < eL; i++) {
      const z = eZ + eLen / 2 - 0.06 - i * (eLen - 0.1) / Math.max(1, eL);
      G(tf(new THREE.TorusGeometry(eR * 1.1 + 0.01, 0.022, 5, 18), { p: [0, 0, z] }), trailHex);
    }
    F(0, 0, eZ + eLen / 2, eR * 0.7, 0.45 + eL * 0.05 + L.accel * 0.04);

    // twin trail nozzles (lower sides)
    for (const s of [-1, 1]) {
      P(tf(cyl(0.075, 0.095, 0.32, 10), { r: [Math.PI / 2, 0, 0], p: [0.3 * s, -0.17, 0.62] }), DARK);
      P(tf(new THREE.TorusGeometry(0.08, 0.02, 4, 12), { p: [0.3 * s, -0.17, 0.78] }), METAL);
      F(0.3 * s, -0.17, 0.78, 0.07, 0.32 + L.accel * 0.05);
    }
    this.nozzles[0].position.set(-0.3, -0.17, 0.8);
    this.nozzles[1].position.set(0.3, -0.17, 0.8);

    // stubby winglets (like the hens' pods) unless the grip stabilizers replace them
    if (!L.grip) {
      for (const s of [-1, 1]) {
        P(tf(new THREE.ConeGeometry(0.2, 0.36, 4), { r: [0, 0, -Math.PI / 2 * s], s: [1, 1, 0.25], p: [0.56 * s, -0.08, 0.35] }), DARK);
      }
    }

    // ---- accel: extra nozzles around the tail ----
    const accelAng = [Math.PI / 2, Math.PI / 2 + 0.75, Math.PI / 2 - 0.75, Math.PI * 1.5, Math.PI / 2 + 1.5];
    const accelR = eR + 0.16;
    for (let i = 0; i < Math.min(5, L.accel); i++) {
      let a = accelAng[i];
      if (i === 4) a = Math.PI / 2 - 1.5;
      const x = Math.cos(a) * accelR * 1.1, y = Math.sin(a) * accelR * 0.85;
      const z = EGG_A - 0.05;
      P(tf(cyl(0.05, 0.065, 0.26, 8), { r: [Math.PI / 2, 0, 0], p: [x, y, z] }), DARK);
      P(tf(new THREE.TorusGeometry(0.055, 0.016, 4, 10), { p: [x, y, z + 0.13] }), S.accent);
      F(x, y, z + 0.13, 0.05, 0.28 + L.accel * 0.05);
    }

    // ---- grip: side stabilizer fins with glowing tips ----
    if (L.grip) {
      const span = 0.28 + L.grip * 0.1;
      for (const s of [-1, 1]) {
        const x0 = 0.46;
        P(tf(new THREE.ConeGeometry(0.2 + L.grip * 0.015, span, 4), { r: [0, 0, -Math.PI / 2 * s], s: [1, 1, 0.22], p: [(x0 + span / 2) * s, -0.02, 0.36] }), S.hull);
        // swept trailing edge strip (dark)
        P(tf(new THREE.BoxGeometry(span, 0.03, 0.06), { p: [(x0 + span / 2) * s, -0.02, 0.5] }), DARK);
        // vertical tip plate + glow
        P(tf(new THREE.BoxGeometry(0.035, 0.18 + L.grip * 0.02, 0.26), { p: [(x0 + span) * s, 0.02, 0.4] }), DARK);
        G(tf(ico(0.05 + L.grip * 0.006, 0), { s: [0.8, 1, 2.2], p: [(x0 + span + 0.02) * s, 0.02, 0.4] }), S.accent);
      }
    }

    // ---- tank: side boost canisters ----
    if (L.tank) {
      const r = 0.07 + L.tank * 0.02;
      const len = 0.34 + L.tank * 0.07;
      for (const s of [-1, 1]) {
        const x = (0.5 + r * 0.7) * s, y = -0.2, z = 0.12;
        P(tf(cyl(r, r, len, 10), { r: [Math.PI / 2, 0, 0], p: [x, y, z] }), S.accent);
        P(tf(ico(r, 1), { s: [1, 1, 0.6], p: [x, y, z - len / 2] }), METAL);
        P(tf(cyl(r * 0.8, r, 0.08, 10), { r: [Math.PI / 2, 0, 0], p: [x, y, z + len / 2 + 0.04] }), DARK);
        G(tf(new THREE.TorusGeometry(r * 1.02, 0.02, 4, 12), { p: [x, y, z] }), 0x5dffb0);
        if (L.tank >= 3) G(tf(new THREE.TorusGeometry(r * 1.02, 0.02, 4, 12), { p: [x, y, z - len * 0.25] }), 0x5dffb0);
        if (L.tank >= 5) G(tf(new THREE.TorusGeometry(r * 1.02, 0.02, 4, 12), { p: [x, y, z + len * 0.25] }), 0x5dffb0);
      }
    }

    // ---- armor plates: Lv1 nose, Lv2 sides, Lv3 full ----
    if (L.armor >= 1) {
      P(eggShell(0.62, 1, { scale: 1.05, segs: 16, steps: 5 }), ARMOR);
      P(tf(new THREE.TorusGeometry(eggR(0.62) * 1.05, 0.02, 4, 16), { s: [1, FLAT, 1], p: [0, 0, -0.62 * EGG_A * 1.05] }), METAL);
    }
    if (L.armor >= 2) {
      for (const c of [Math.PI / 2, Math.PI * 1.5]) {
        P(eggShell(-0.55, 0.5, { phi0: c - 0.55, phiLen: 1.1, scale: 1.05, segs: 5, steps: 6 }), ARMOR);
        for (const u of [-0.4, 0.05, 0.4]) {
          const pt = eggPoint(u, c, 1.07);
          P(tf(ico(0.025, 0), { p: pt }), METAL);
        }
      }
    }
    if (L.armor >= 3) {
      P(eggShell(-0.88, -0.25, { phi0: -0.6, phiLen: 1.2, scale: 1.045, segs: 5, steps: 5 }), ARMOR);   // top rear
      P(eggShell(-0.6, 0.6, { phi0: Math.PI - 0.7, phiLen: 1.4, scale: 1.045, segs: 5, steps: 6 }), ARMOR);   // belly
      for (const u of [-0.8, -0.55, -0.3]) P(tf(ico(0.025, 0), { p: eggPoint(u, 0, 1.065) }), METAL);
      // armored fin on top (spine)
      P(tf(new THREE.ConeGeometry(0.16, 0.34, 4), { s: [0.2, 1, 1], p: [0, 0.4, 0.52], r: [0.5, 0, 0] }), ARMOR);
    }

    // ---- magnet: antenna with a horseshoe magnet ----
    if (L.magnet) {
      const mast = 0.2 + L.magnet * 0.04;
      const base = [0.2, 0.3, 0.46];
      P(tf(cyl(0.018, 0.026, mast, 6), { p: [base[0], base[1] + mast / 2, base[2]] }), METAL);
      const R = 0.06 + L.magnet * 0.018;
      const tube = 0.025 + L.magnet * 0.006;
      const top = base[1] + mast + R;
      P(tf(new THREE.TorusGeometry(R, tube, 6, 12, Math.PI), { r: [0, 0, Math.PI], p: [base[0], top, base[2]] }), 0xe8262f);
      for (const s of [-1, 1]) {
        P(tf(cyl(tube, tube, 0.07, 6), { p: [base[0] + R * s, top + 0.035, base[2]] }), 0xe8ecf5);
      }
      if (L.magnet >= 3) G(tf(ico(0.02, 0), { p: [base[0], top + 0.1, base[2]] }), 0xffe066);
    }

    // ---- thrusters: small side RCS pods ----
    if (L.thrusters) {
      const pairs = [1, 1, 2, 2, 3][Math.min(5, L.thrusters) - 1];
      const sz = 0.85 + L.thrusters * 0.1;
      const zs = [-0.3, -0.02, -0.55];
      for (let k = 0; k < pairs; k++) {
        const z = zs[k];
        const u = -z / EGG_A;
        const rx = eggR(u);
        for (const s of [-1, 1]) {
          const x = (rx - 0.02) * s, y = 0.06;
          P(tf(cyl(0.045 * sz, 0.055 * sz, 0.14 * sz, 8), { r: [0, 0, Math.PI / 2], p: [x + 0.06 * sz * s, y, z] }), DARK);
          G(tf(new THREE.CircleGeometry(0.035 * sz, 8), { r: [0, Math.PI / 2 * s, 0], p: [x + 0.135 * sz * s, y, z] }), trailHex);
          P(tf(cyl(0.04 * sz, 0.03 * sz, 0.1 * sz, 8), { r: [Math.PI / 2, 0, 0], p: [x + 0.06 * sz * s, y, z + 0.1 * sz] }), METAL);
        }
      }
    }

    // ---- booster: glowing accent racing stripes (1 per level) ----
    const stripes = [[0.3, -0.85, 0.8], [-0.3, -0.85, 0.8], [0.62, -0.8, 0.75], [-0.62, -0.8, 0.75], [0, -0.85, -0.42]];
    for (let i = 0; i < Math.min(5, L.booster); i++) {
      const [phi, u0, u1] = stripes[i];
      G(eggShell(u0, u1, { phi0: phi - 0.045, phiLen: 0.09, scale: 1.06 + (L.armor >= 2 ? 0.02 : 0), segs: 1, steps: 12 }), S.accent);
    }

    // ---- focus: glowing visor + targeting lens on the nose ----
    if (L.focus) {
      const f = Math.min(3, L.focus);
      const vc = new THREE.Color(0x3cf2ff).multiplyScalar(0.45 + f * 0.2).getHex();
      G(tf(new THREE.SphereGeometry(0.146, 14, 3, Math.PI * 1.5 - 0.8, 1.6, 1.38, 0.08 + f * 0.05), { p: [0, 0.52, -0.1] }), vc);
      const nz = -EGG_A * (L.armor ? 1.05 : 1) - 0.02;
      const lr = 0.05 + f * 0.02;
      P(tf(cyl(lr * 1.3, lr * 1.5, 0.06, 12), { r: [Math.PI / 2, 0, 0], p: [0, 0, nz + 0.02] }), DARK);
      G(tf(new THREE.CircleGeometry(lr, 12), { r: [0, Math.PI, 0], p: [0, 0, nz - 0.012] }), 0xff3a4a);
      G(tf(new THREE.TorusGeometry(lr * 1.35, 0.012, 4, 16), { p: [0, 0, nz - 0.015] }), 0xff8a5c);
      if (f >= 2) {
        G(tf(new THREE.BoxGeometry(lr * 3.4, 0.01, 0.01), { p: [0, 0, nz - 0.02] }), 0xffd0c0);
        G(tf(new THREE.BoxGeometry(0.01, lr * 3.4, 0.01), { p: [0, 0, nz - 0.02] }), 0xffd0c0);
      }
      if (f >= 3) G(tf(new THREE.TorusGeometry(lr * 2, 0.012, 4, 20), { p: [0, 0, nz - 0.01] }), 0xff8a5c);
    }

    // ---- lucky: feathers on the helmet ----
    const feathers = [[0, 0xffd35c], [0.38, 0x5dff8a], [-0.38, 0x5dff8a]];
    for (let i = 0; i < Math.min(3, L.lucky); i++) {
      const [a, col] = feathers[i];
      const len = 0.2 - i * 0.02;
      const g = new THREE.ConeGeometry(0.035, len, 5);
      g.translate(0, len / 2, 0);
      g.scale(1, 1, 0.35);
      g.rotateX(0.75);
      g.rotateZ(a);
      g.translate(0, 0.63, -0.06);
      P(g, col);
      G(tf(ico(0.018, 0), { p: [Math.sin(-a) * 0.02, 0.645, -0.06] }), col);
    }

    // shield emitters (orbs)
    this.orbs.count = Math.min(3, L.shield);

    this._buildHat(P, G);

    this._swap(this.parts, solid);
    this._swap(this.lit, lit);
    this._swap(this.flame, flame);
    this._buildWings();
    this._buildPet();
    this.animate(0);
  }

  // ---------------------------------------------------------------- cosmetics
  _cosmetic(slot) {
    const id = this.cosmetics[slot];
    return id ? COSMETICS.find((c) => c.id === id) : null;
  }

  // Trail colour: an equipped trail add-on overrides the skin's.
  _applyTrail() {
    const [t1, t2] = this.skinTrail || [this.trailColor, this.trailColor2];
    const c = this._cosmetic('trail');
    if (c && c.rainbow) { this.trailColor = this._rainbow[0]; this.trailColor2 = this._rainbow[1]; }
    else if (c) { this.trailColor = c.trail; this.trailColor2 = c.trail2; }
    else { this.trailColor = t1; this.trailColor2 = t2; }
    this.engineLight.color.setRGB(this.trailColor[0], this.trailColor[1], this.trailColor[2]);
  }

  // Hats sit on top of the glass dome (top ≈ y 0.71 in pod space).
  _buildHat(P, G) {
    const c = this._cosmetic('hat');
    this.propeller.visible = false;
    if (!c) return;
    const Y = 0.7, Z = -0.12;
    const half = (r) => new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    if (c.id === 'party') {
      P(tf(new THREE.ConeGeometry(0.11, 0.3, 14), { r: [0, 0, 0.18], p: [-0.025, Y + 0.14, Z] }), 0xff4fb0);
      G(tf(new THREE.TorusGeometry(0.085, 0.014, 4, 16), { r: [Math.PI / 2, 0, 0.18], p: [-0.012, Y + 0.07, Z] }), 0x3cf2ff);
      G(tf(new THREE.TorusGeometry(0.05, 0.012, 4, 14), { r: [Math.PI / 2, 0, 0.18], p: [-0.035, Y + 0.17, Z] }), 0xffd35c);
      G(tf(ico(0.045, 1), { p: [-0.055, Y + 0.3, Z] }), 0xffd35c);
    } else if (c.id === 'propeller') {
      P(tf(half(0.13), { p: [0, Y - 0.03, Z] }), 0x3c7bff);
      P(tf(new THREE.BoxGeometry(0.2, 0.015, 0.12), { p: [0, Y - 0.025, Z - 0.15] }), 0xff3c3c);
      P(tf(cyl(0.012, 0.012, 0.1, 6), { p: [0, Y + 0.14, Z] }), 0x8a93a8);
      const blade = (a, col) => ({ geo: tf(new THREE.BoxGeometry(0.34, 0.012, 0.06), { r: [0, a, 0.08] }), color: col });
      const old = this.propeller.geometry;
      this.propeller.geometry = mergeColored([blade(0, 0xffd35c), blade(Math.PI / 2, 0xff3c3c), { geo: ico(0.025, 0), color: 0xffffff }]);
      old.dispose();
      this.propeller.visible = true;
    } else if (c.id === 'chef') {
      P(tf(cyl(0.1, 0.1, 0.12, 14), { p: [0, Y + 0.04, Z] }), 0xffffff);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        P(tf(ico(0.085, 1), { p: [Math.cos(a) * 0.07, Y + 0.15, Z + Math.sin(a) * 0.07] }), 0xf6f6f6);
      }
      P(tf(ico(0.09, 1), { p: [0, Y + 0.19, Z] }), 0xffffff);
    } else if (c.id === 'viking') {
      P(tf(half(0.14), { p: [0, Y - 0.05, Z] }), 0x9aa3b5);
      P(tf(new THREE.TorusGeometry(0.138, 0.018, 5, 18), { r: [Math.PI / 2, 0, 0], p: [0, Y - 0.04, Z] }), 0xffc23c);
      for (const sd of [1, -1]) {
        const h = new THREE.ConeGeometry(0.045, 0.24, 8);
        h.translate(0, 0.12, 0);
        h.rotateZ(-sd * 1.05);
        h.translate(sd * 0.12, Y + 0.02, Z);
        P(h, 0xf2e6c8);
      }
    } else if (c.id === 'crown') {
      P(tf(cyl(0.12, 0.11, 0.07, 14), { p: [0, Y + 0.02, Z] }), 0xffc23c);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const x = Math.cos(a) * 0.105, z = Z + Math.sin(a) * 0.105;
        P(tf(new THREE.ConeGeometry(0.032, 0.1, 4), { p: [x, Y + 0.1, z] }), 0xffc23c);
        G(tf(ico(0.022, 0), { p: [x, Y + 0.16, z] }), i % 2 ? 0x3cf2ff : 0xff3c5a);
      }
    }
  }

  // Wings hang off two mirrored pivots so they can flap. Built for the +X side.
  _buildWings() {
    const c = this._cosmetic('wings');
    const solid = [], lit = [];
    const S = this.skinColors;
    // Flattened ellipsoid "feather/membrane" from the root outward at angle a (up from horizontal).
    const blade = (len, w, a, col, { z = 0, yaw = 0, thick = 0.025 } = {}) => solid.push({
      geo: tf(ico(1, 1), { s: [len, thick, w], r: [0, yaw, a], p: [Math.cos(a) * len, Math.sin(a) * len, z] }), color: col });
    if (c) {
      if (c.id === 'jetfins') {
        solid.push({ geo: tf(new THREE.ConeGeometry(0.17, 0.55, 4), { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.22], p: [0.26, 0, 0.15] }), color: S.hull });
        solid.push({ geo: tf(new THREE.BoxGeometry(0.03, 0.22, 0.2), { r: [0, 0, 0.2], p: [0.5, 0.08, 0.2] }), color: 0x2a3350 });
        lit.push({ geo: tf(ico(0.04, 0), { s: [1, 1, 2.2], p: [0.54, 0, 0.2] }), color: S.accent });
      } else if (c.id === 'angel') {
        for (let i = 0; i < 5; i++) blade(0.2 + i * 0.045, 0.07, 0.2 + i * 0.2, i === 4 ? 0xffe9a8 : 0xffffff, { z: 0.05 + i * 0.03, yaw: -0.25 });
        lit.push({ geo: tf(ico(0.03, 0), { p: [0.02, 0.02, 0.05] }), color: 0xfff6d0 });
      } else if (c.id === 'bat' || c.id === 'dragon') {
        const big = c.id === 'dragon' ? 1.35 : 1.2;
        const skin = c.id === 'dragon' ? 0xa8202e : 0x6a3a9a;
        const bone = c.id === 'dragon' ? 0xffc23c : 0x2a1438;
        for (let i = 0; i < 3; i++) {
          const a = 0.15 + i * 0.32;
          blade(0.28 * big, 0.16 * big, a, skin, { z: 0.08 + i * 0.05, yaw: -0.3, thick: 0.02 });
          solid.push({ geo: tf(cyl(0.014, 0.01, 0.56 * big, 5), { r: [0, 0, a - Math.PI / 2], p: [Math.cos(a) * 0.28 * big, Math.sin(a) * 0.28 * big, 0.04 + i * 0.05] }), color: bone });
        }
        if (c.id === 'dragon') for (let i = 0; i < 3; i++) {
          const a = 0.15 + i * 0.32;
          solid.push({ geo: tf(new THREE.ConeGeometry(0.03, 0.1, 4), { r: [0, 0, a - Math.PI / 2], p: [Math.cos(a) * 0.62 * big, Math.sin(a) * 0.62 * big, 0.04 + i * 0.05] }), color: 0xffc23c });
        }
      }
    }
    for (const pv of this.wingPivots) {
      const u = pv.userData;
      const clone = (arr) => arr.map((p) => ({ geo: p.geo.clone(), color: p.color }));
      this._swap(u.solid, clone(solid));
      this._swap(u.lit, clone(lit));
      pv.visible = !!c;
      pv.userData.flap = c && c.id !== 'jetfins' ? (c.id === 'dragon' ? 0.22 : 0.3) : 0;
    }
    for (const p of [...solid, ...lit]) p.geo.dispose();
  }

  // Pets fly beside the pod (group space, so they don't bank with it).
  _buildPet() {
    const c = this._cosmetic('pet');
    const solid = [], lit = [];
    const P = (geo, color) => solid.push({ geo, color });
    const G = (geo, color) => lit.push({ geo, color });
    if (c && c.id === 'chick') {
      P(tf(ico(0.3, 1), { s: [1, 0.95, 1.05] }), 0xffd83c);
      P(tf(ico(0.2, 1), { p: [0, 0.33, -0.12] }), 0xffe066);
      P(tf(new THREE.ConeGeometry(0.06, 0.14, 5), { r: [-Math.PI / 2, 0, 0], p: [0, 0.3, -0.34] }), 0xff8a1f);
      for (const sd of [1, -1]) {
        P(tf(ico(0.035, 0), { p: [sd * 0.08, 0.39, -0.28] }), 0x111111);
        P(tf(ico(0.13, 1), { s: [0.3, 0.8, 1.2], p: [sd * 0.29, 0.02, 0.02] }), 0xffc81f);
      }
      P(tf(new THREE.ConeGeometry(0.04, 0.12, 5), { r: [-0.4, 0, 0], p: [0, 0.55, -0.1] }), 0xffc81f);
      G(tf(ico(0.07, 1), { p: [0, -0.28, 0.12] }), 0x9ff8ff);
    } else if (c && c.id === 'eggbot') {
      P(tf(ico(0.3, 2), { s: [0.85, 1.1, 0.85] }), 0xf4f6fb);
      G(tf(new THREE.BoxGeometry(0.34, 0.08, 0.05), { p: [0, 0.1, -0.24] }), 0x3cf2ff);
      P(tf(cyl(0.012, 0.012, 0.18, 5), { p: [0, 0.4, 0] }), 0x8a93a8);
      G(tf(ico(0.045, 1), { p: [0, 0.5, 0] }), 0xff3c5a);
      for (const sd of [1, -1]) P(tf(cyl(0.06, 0.07, 0.16, 8), { r: [Math.PI / 2, 0, 0], p: [sd * 0.25, -0.1, 0.12] }), 0x2a3350);
      G(tf(ico(0.06, 1), { p: [0, -0.34, 0.05] }), 0x9ff8ff);
    } else if (c && c.id === 'ufo') {
      P(tf(cyl(0.42, 0.46, 0.1, 20), {}), 0xb8c0d0);
      P(tf(cyl(0.2, 0.3, 0.1, 16), { p: [0, -0.09, 0] }), 0x2a3350);
      G(tf(new THREE.SphereGeometry(0.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0.05, 0] }), 0x9ff4ff);
      P(tf(ico(0.07, 1), { p: [0, 0.14, 0] }), 0xf7f3ea);
      P(tf(ico(0.03, 0), { p: [0, 0.22, 0] }), 0xe8262f);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        G(tf(ico(0.035, 0), { p: [Math.cos(a) * 0.44, -0.01, Math.sin(a) * 0.44] }), i % 2 ? 0xffd35c : 0xff4fb0);
      }
    }
    this._swap(this.petSolid, solid);
    this._swap(this.petLit, lit);
    this.pet.visible = !!c;
  }

  _animateCosmetics(t) {
    if (this.propeller.visible) this.propeller.rotation.y = t * 14;
    for (const pv of this.wingPivots) {
      const f = pv.userData.flap || 0;
      pv.rotation.z = f ? Math.sin(t * 5) * f * pv.userData.side : 0;
    }
    if (this.pet.visible) {
      this.pet.position.set(1.45 + Math.sin(t * 0.9) * 0.15, 0.75 + Math.sin(t * 2.6) * 0.14, 0.7 + Math.cos(t * 1.1) * 0.2);
      this.pet.rotation.set(0, Math.sin(t * 1.3) * 0.35, Math.sin(t * 2.6) * 0.12);
    }
    const c = this.cosmetics.trail === 'rainbow';
    if (c) {
      const h = (t * 0.25) % 1;
      const col = this._tmpColor || (this._tmpColor = new THREE.Color());
      col.setHSL(h, 1, 0.6); this._rainbow[0][0] = col.r; this._rainbow[0][1] = col.g; this._rainbow[0][2] = col.b;
      col.setHSL((h + 0.3) % 1, 1, 0.7); this._rainbow[1][0] = col.r; this._rainbow[1][1] = col.g; this._rainbow[1][2] = col.b;
      this.engineLight.color.setRGB(this._rainbow[0][0], this._rainbow[0][1], this._rainbow[0][2]);
    }
  }

  _swap(mesh, parts) {
    const old = mesh.geometry;
    mesh.geometry = parts.length ? mergeColored(parts) : new THREE.BufferGeometry();
    mesh.visible = parts.length > 0;
    old.dispose();
    for (const p of parts) p.geo.dispose();
  }

  // Show / hide the shield bubble (fades smoothly).
  setShielded(on) {
    this.shielded = on;
    this._refreshBubble();
  }

  // Feather Dash: golden bubble, invincible.
  setDash(on) {
    this.dash = on;
    this._refreshBubble();
  }

  _refreshBubble() {
    this.shieldTarget = this.shielded || this.dash ? 1 : 0;
    this.shieldMat.uniforms.uColor.value.set(this.dash ? 0xffd35c : 0x6fb8ff);
  }

  setTarget(x) {
    this.targetX = THREE.MathUtils.clamp(x, -CONFIG.halfWidth, CONFIG.halfWidth);
  }

  update(realDt, speedNorm) {
    this.time += realDt;

    // Critically damped spring toward the target. It runs on REAL time so
    // steering stays crisp even while the world is in slow motion.
    const k = CONFIG.shipSpring * this.handling;
    const d = 2 * Math.sqrt(k);
    const steps = realDt > 1 / 60 ? 2 : 1;
    const h = realDt / steps;
    for (let i = 0; i < steps; i++) {
      this.vx += ((this.targetX - this.x) * k - this.vx * d + this.push) * h;
      this.x += this.vx * h;
    }
    this.x = THREE.MathUtils.clamp(this.x, -CONFIG.halfWidth - 0.2, CONFIG.halfWidth + 0.2);

    // Shield bubble fade + invulnerability blink.
    const sm = this.shieldMat.uniforms;
    sm.uAlpha.value += (this.shieldTarget - sm.uAlpha.value) * (1 - Math.exp(-8 * realDt));
    sm.uTime.value += realDt;
    this.shield.visible = sm.uAlpha.value > 0.02;
    if (this.invuln > 0) {
      this.invuln -= realDt;
      this.model.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;
    } else {
      this.model.visible = true;
    }

    const bob = Math.sin(this.time * 2.2) * 0.08;
    this.group.position.set(this.x, bob, 0);

    // Bank into turns, slight yaw and nose pitch.
    const bank = THREE.MathUtils.clamp(-this.vx * 0.09, -0.9, 0.9);
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, bank, 1 - Math.exp(-12 * realDt));
    this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, -this.vx * 0.025, 1 - Math.exp(-10 * realDt));
    this.model.rotation.x = Math.sin(this.time * 1.7) * 0.03;

    // Engine flicker scales with speed.
    const flicker = 0.85 + Math.random() * 0.3;
    this.setThrust((0.9 + speedNorm * 0.6) * flicker);
    this.engineLight.intensity = (5 + speedNorm * 5) * flicker;
    this.animate(realDt);
  }

  // World-space nozzle positions for particle emission.
  nozzleWorld(i, out) {
    return this.nozzles[i].getWorldPosition(out);
  }
}
