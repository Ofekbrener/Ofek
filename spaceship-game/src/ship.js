import * as THREE from 'three';
import { CONFIG } from './config.js';

// Procedural low-poly ship, pointing toward -Z.
export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.group.add(this.model);
    scene.add(this.group);

    const hull = this.hullMat = new THREE.MeshStandardMaterial({ color: 0xd8e2f0, metalness: 0.55, roughness: 0.35, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3350, metalness: 0.6, roughness: 0.5, flatShading: true });
    const accent = this.accentMat = new THREE.MeshStandardMaterial({ color: 0xff3ca8, emissive: 0xff3ca8, emissiveIntensity: 0.6, flatShading: true });
    const glass = this.glassMat = new THREE.MeshStandardMaterial({ color: 0x3cf2ff, emissive: 0x1aa6c4, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.1 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x9ff8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });

    // Fuselage: a stretched octagonal cone.
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.2, 8), hull);
    body.rotation.x = -Math.PI / 2;
    body.scale.set(1, 1, 0.55);
    this.model.add(body);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 8), dark);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 1.3;
    tail.scale.set(1, 1, 0.55);
    this.model.add(tail);

    // Cockpit
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    cockpit.scale.set(0.9, 0.8, 2.0);
    cockpit.position.set(0, 0.12, -0.15);
    this.model.add(cockpit);

    // Wings: a flat swept triangle, mirrored.
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.2);
    wingShape.lineTo(1.35, 0.75);
    wingShape.lineTo(1.35, 1.05);
    wingShape.lineTo(0, 0.95);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });
    wingGeo.rotateX(Math.PI / 2);
    wingGeo.translate(0.2, 0.02, 0);
    const wingR = new THREE.Mesh(wingGeo, hull);
    const wingL = new THREE.Mesh(wingGeo, hull);
    wingL.scale.x = -1;
    this.model.add(wingR, wingL);

    // Wing tip accents
    const tipGeo = new THREE.BoxGeometry(0.08, 0.14, 0.5);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(tipGeo, accent);
      tip.position.set(1.55 * s, 0.03, 0.92);
      this.model.add(tip);
    }

    // Tail fin
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.6, 0);
    finShape.lineTo(0.55, 0.45);
    finShape.lineTo(0.35, 0.45);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false });
    finGeo.rotateY(-Math.PI / 2);
    const fin = new THREE.Mesh(finGeo, accent);
    fin.position.set(0.025, 0.12, 0.85);
    this.model.add(fin);

    // Twin engines with glowing nozzles
    this.nozzles = [];
    const engGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8);
    engGeo.rotateX(Math.PI / 2);
    const glowGeo = new THREE.CircleGeometry(0.15, 12);
    for (const s of [-1, 1]) {
      const eng = new THREE.Mesh(engGeo, dark);
      eng.position.set(0.45 * s, -0.02, 1.15);
      this.model.add(eng);
      const glow = new THREE.Mesh(glowGeo, this.glowMat);
      glow.position.set(0.45 * s, -0.02, 1.51);
      this.model.add(glow);
      this.nozzles.push(glow);
    }

    // Engine light illuminating the ship + nearby debris
    this.engineLight = new THREE.PointLight(0x4fdcff, 6, 8, 2);
    this.engineLight.position.set(0, 0.2, 2.0);
    this.group.add(this.engineLight);

    this.model.scale.setScalar(0.8);

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
    this.shield.scale.set(1.25, 0.6, 1.2);
    this.shield.visible = false;
    this.group.add(this.shield);
    this.shieldTarget = 0;
    this.invuln = 0;
    this.handling = 1;
    this.trailColor = [0.45, 0.9, 1];
    this.trailColor2 = [1, 0.4, 1];

    this.x = 0;
    this.vx = 0;
    this.targetX = 0;
    this.time = 0;
    this._tmp = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.x = 0;
    this.vx = 0;
    this.targetX = 0;
    this.invuln = 0;
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
    this.trailColor = skin.trail;
    this.trailColor2 = skin.trail2;
  }

  // Show / hide the shield bubble (fades smoothly).
  setShielded(on) { this.shieldTarget = on ? 1 : 0; }

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
      this.vx += ((this.targetX - this.x) * k - this.vx * d) * h;
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
    const s = (0.9 + speedNorm * 0.6) * flicker;
    for (const n of this.nozzles) n.scale.setScalar(s);
    this.engineLight.intensity = (5 + speedNorm * 5) * flicker;
  }

  // World-space nozzle positions for particle emission.
  nozzleWorld(i, out) {
    return this.nozzles[i].getWorldPosition(out);
  }
}
