// The five hunting-ground monsters, modelled after the Classic sprites.
// buildMob(id) -> { object3d, height, radius, animate(state, dt, t), hit() }
// state: 'idle' | 'move' | 'die'. hit() plays the knock-back on top of any state.
import * as THREE from 'three';
import { toon, flat, outline, paintY, canvasTexture, lathe, materialsOf, mergeParts, ease, INK } from './toon.js';

// ---------------------------------------------------------------- shared rig

/**
 * Shared animation for every mob. All motion eases toward a target so state
 * changes never snap. gait: 'hop' (mushroom), 'slide' (snails), 'blob' (slime).
 */
function rig(root, body, { gait, hopHeight = 0.5, rate = 1.5, eyes = [], flashMats = [] }) {
  const s = { blend: 0, ph: Math.random(), sq: 1, lean: 0, flash: 0, eye: 1, hitT: -1, dieT: -1 };
  const eyeBase = eyes.map(e => e.scale.y);
  let mats = null;
  const GROUND = 0.25;

  function animate(state, dt, t) {
    if (state === 'die' && s.dieT < 0) {
      s.dieT = 0;
      mats = materialsOf(root);
      mats.forEach(m => { m.transparent = true; m.depthWrite = m.side !== THREE.BackSide; m.needsUpdate = true; });
    }
    s.blend = ease(s.blend, state === 'move' ? 1 : 0, 6, dt);
    s.ph = (s.ph + dt * rate) % 1;

    let hop = 0, sqT = 1, lean = 0, stretchZ = 1;
    const breathe = 1 + Math.sin(t * 3 + s.ph * 6) * 0.035;
    if (gait === 'hop' || gait === 'blob') {
      if (s.ph < GROUND) sqT = 1 - (gait === 'blob' ? 0.28 : 0.2) * Math.sin(s.ph / GROUND * Math.PI);
      else {
        const u = (s.ph - GROUND) / (1 - GROUND), vy = 1 - 2 * u;
        hop = 4 * u * (1 - u) * hopHeight;
        sqT = 1 + (gait === 'blob' ? 0.18 : 0.12) * Math.abs(vy);
        lean = vy * 0.12;
      }
    } else {
      // slide: the foot stretches and contracts while the shell rocks
      const w = Math.sin(s.ph * Math.PI * 2);
      stretchZ = 1 + 0.12 * w * s.blend;
      sqT = 1 - 0.05 * w;
      lean = 0.05 * Math.sin(s.ph * Math.PI * 2 + 1);
    }
    sqT = THREE.MathUtils.lerp(breathe, sqT, s.blend);
    hop *= s.blend; lean *= s.blend;
    s.sq = ease(s.sq, sqT, 22, dt);

    let hitTilt = 0, eyeT = (t + s.ph * 3) % 3.4 < 0.12 ? 0.1 : 1;
    if (s.hitT >= 0) {
      s.hitT += dt;
      hitTilt = -0.5 * Math.exp(-s.hitT * 7) * Math.cos(s.hitT * 16);
      if (s.hitT < 0.35) eyeT = 0.12;
      if (s.hitT > 1.2) s.hitT = -1;
    }
    s.flash = ease(s.flash, 0, 7, dt);
    for (const m of flashMats) m.emissive.setRGB(0.55 * s.flash, 0.3 * s.flash, 0.15 * s.flash);
    s.eye = ease(s.eye, eyeT, 30, dt);
    eyes.forEach((e, i) => { e.scale.y = eyeBase[i] * s.eye; });

    s.lean = ease(s.lean, lean, 10, dt);
    body.rotation.x = -s.lean + hitTilt;
    const side = 1 / Math.sqrt(s.sq);
    body.scale.set(side, s.sq, side * stretchZ);
    body.position.y = hop;

    if (s.dieT >= 0) {
      s.dieT += dt;
      const k = Math.min(1, s.dieT / 0.6);
      mats.forEach(m => { m.opacity = (m.userData.baseOpacity ?? 1) * (1 - k); });
      body.position.y -= k * 0.4;
      body.scale.y *= 1 - k * 0.5;
    }
  }

  return {
    animate,
    hit() { s.hitT = 0; s.flash = 1; },
    get dead() { return s.dieT >= 0.6; },
    get hop() { return body.position.y; },
  };
}

function shell(root, inner, scale) {
  inner.scale.setScalar(scale);
  return root;
}

/** Puts a mesh on the surface of a lathe body whose radius at height y is radiusAt(y). */
function onSurface(parent, mesh, radiusAt, x, y, lift = 0.01) {
  const r = radiusAt(y), z = Math.sqrt(Math.max(0, r * r - x * x));
  mesh.position.set(x, y, z + lift);
  mesh.lookAt(x * 2, y, (z + lift) * 2);
  parent.add(mesh);
  return mesh;
}

function profileRadius(prof) {
  return y => {
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) {
      const [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
      return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
    }
    return 0;
  };
}

function dotEye(radius, ink, white) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), ink);
  eye.scale.z = 0.4;
  const glint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.34, 8, 6), white);
  glint.position.set(radius * 0.3, radius * 0.38, radius * 0.8);
  eye.add(glint);
  return eye;
}

// ------------------------------------------------------------ Orange Mushroom

const capTexture = () => canvasTexture('om-cap', 1024, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ec8526'); grad.addColorStop(0.75, '#e06e1c'); grad.addColorStop(1, '#b84c16');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 256);
  const spots = [[60, .5, 46], [210, .74, 38], [330, .4, 50], [470, .68, 42], [600, .44, 48], [740, .76, 36], [860, .42, 50], [960, .72, 36], [150, .2, 34], [520, .18, 36], [800, .16, 34]];
  for (const [x, v, w] of spots) for (const dx of [-1024, 0, 1024]) {
    const y = v * 256;
    g.fillStyle = '#c96a12'; g.beginPath(); g.ellipse(x + dx + 3, y + 3, w, w * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f5c840'; g.beginPath(); g.ellipse(x + dx, y, w, w * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbe07a'; g.beginPath(); g.ellipse(x + dx - w * 0.25, y - 4, w * 0.4, w * 0.22, 0, 0, Math.PI * 2); g.fill();
  }
});

const gillTexture = () => canvasTexture('om-gills', 256, 256, (g) => {
  const rg = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  rg.addColorStop(0, '#4d4636'); rg.addColorStop(1, '#8a826a');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(40,34,24,.75)'; g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2;
    g.beginPath(); g.moveTo(128 + Math.cos(a) * 40, 128 + Math.sin(a) * 40); g.lineTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128); g.stroke();
  }
});

const mouthTexture = () => canvasTexture('om-mouth', 128, 256, (g) => {
  const path = () => { g.beginPath(); g.moveTo(14, 30); g.lineTo(114, 30); g.lineTo(108, 200); g.quadraticCurveTo(64, 262, 20, 200); g.closePath(); };
  path(); g.fillStyle = '#1a1210'; g.fill();
  g.save(); g.translate(64, 30); g.scale(0.86, 0.9); g.translate(-64, -30); path();
  const rg = g.createLinearGradient(0, 30, 0, 230); rg.addColorStop(0, '#6e0c0c'); rg.addColorStop(0.55, '#b01e18'); rg.addColorStop(1, '#e0473a');
  g.fillStyle = rg; g.fill(); g.restore();
  g.fillStyle = '#efe9da'; g.strokeStyle = '#1a1210'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 0); g.lineTo(128, 26);
  g.quadraticCurveTo(100, 50, 76, 30); g.quadraticCurveTo(64, 18, 52, 30); g.quadraticCurveTo(28, 50, 0, 26); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, 26); g.quadraticCurveTo(28, 50, 52, 30); g.quadraticCurveTo(64, 18, 76, 30); g.quadraticCurveTo(100, 50, 128, 26); g.stroke();
  g.fillStyle = '#ffffff'; g.lineWidth = 4;
  for (const x of [30, 98]) { g.beginPath(); g.moveTo(x - 11, 38); g.lineTo(x + 11, 38); g.lineTo(x, 60); g.closePath(); g.fill(); g.stroke(); }
});

function orangeMushroom() {
  const root = new THREE.Group(), body = new THREE.Group(), m = new THREE.Group();
  root.add(body); body.add(m);
  const outlineMat = flat(INK, { side: THREE.BackSide });
  const ink = flat(0x1a1210), white = flat(0xffffff);

  const prof = [[0, 0], [0.42, 0.01], [0.62, 0.08], [0.74, 0.25], [0.77, 0.45], [0.72, 0.7], [0.62, 0.95], [0.5, 1.15], [0.3, 1.28], [0, 1.32]];
  const radiusAt = profileRadius(prof);
  const stem = outline(new THREE.Mesh(paintY(lathe(prof, 48), 0xece4d2, 0xc2b59a, 0, 1.3), toon(0xffffff, { vertexColors: true })), 1.03, outlineMat);
  m.add(stem);

  const capPts = [];
  for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 0.5; capPts.push([Math.sin(a) * 1.08, Math.cos(a) * 0.74]); }
  capPts.push([1.04, -0.06]);
  capPts.reverse(); // rim first so faces point outward
  const capMat = toon(0xe8e8e8, { map: capTexture() });
  const capGroup = new THREE.Group();
  capGroup.position.set(0, 1.16, -0.1);
  capGroup.rotation.x = -0.34; // tilted back so the gills show from the front
  m.add(capGroup);
  capGroup.add(outline(new THREE.Mesh(lathe(capPts, 64), capMat), 1.03, outlineMat));
  const gills = new THREE.Mesh(new THREE.CircleGeometry(1.05, 64), flat(0xffffff, { map: gillTexture(), side: THREE.DoubleSide }));
  gills.rotation.x = Math.PI / 2; gills.position.y = -0.055;
  capGroup.add(gills);

  const eyes = [-1, 1].map(side => onSurface(m, dotEye(0.065, ink, white), radiusAt, side * 0.32, 0.88, 0));
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.46), flat(0xffffff, { map: mouthTexture(), transparent: true }));
  onSurface(m, mouth, radiusAt, 0, 0.6, 0.02);
  mouth.rotation.x -= 0.18;

  shell(root, m, 0.8);
  const r = rig(root, body, { gait: 'hop', hopHeight: 0.55, rate: 1.5, eyes, flashMats: [capMat] });
  return Object.assign(r, { object3d: root, height: 1.75 * 0.8 + 0.2, radius: 0.85 * 0.8 });
}

// ------------------------------------------------------------------ Snails

function spiralShell(color) {
  const parts = [], base = new THREE.Color(color), dark = base.clone().multiplyScalar(0.55), light = base.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const sphere = new THREE.SphereGeometry(1, 14, 10);
  const N = 46, turns = 2.6;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), th = k * turns * Math.PI * 2;
    const R = 0.035 * Math.exp(0.15 * th);
    const mtx = new THREE.Matrix4().compose(
      new THREE.Vector3(0, Math.sin(th) * R, Math.cos(th) * R),
      new THREE.Quaternion(),
      new THREE.Vector3(0.75, 1, 1).multiplyScalar(R * 0.62 + 0.012),
    );
    const c = dark.clone().lerp(i % 4 === 0 ? light : base, Math.min(1, k * 1.6));
    parts.push({ geo: sphere, matrix: mtx, color: c });
  }
  return mergeParts(parts);
}

function snail(shellColor, scale) {
  const root = new THREE.Group(), body = new THREE.Group(), m = new THREE.Group();
  root.add(body); body.add(m);
  const outlineMat = flat(INK, { side: THREE.BackSide });
  const ink = flat(0x1a1210), white = flat(0xffffff);
  const skin = toon(0xd9cfb6);

  // foot: a flattened capsule along z, head raised at the front
  const foot = outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 6, 16), skin), 1.06, outlineMat);
  foot.rotation.x = Math.PI / 2; foot.scale.set(1.05, 1, 0.7); foot.position.set(0, 0.12, 0.05);
  m.add(foot);
  const head = outline(new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), skin), 1.06, outlineMat);
  head.position.set(0, 0.27, 0.36);
  m.add(head);

  const shellMat = toon(0xffffff, { vertexColors: true });
  const sh = outline(new THREE.Mesh(spiralShell(shellColor), shellMat), 1.06, outlineMat);
  sh.position.set(0, 0.42, -0.1); sh.rotation.x = 0.25;
  m.add(sh);

  // eye stalks
  const eyes = [];
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.26, 8), skin);
    stalk.position.set(side * 0.08, 0.5, 0.4); stalk.rotation.z = -side * 0.35; stalk.rotation.x = 0.25;
    m.add(stalk);
    const ball = dotEye(0.06, ink, white);
    ball.position.set(side * 0.13, 0.63, 0.44);
    m.add(ball);
    eyes.push(ball);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), ink);
  smile.rotation.z = Math.PI; smile.position.set(0, 0.25, 0.545);
  m.add(smile);

  shell(root, m, scale);
  const r = rig(root, body, { gait: 'slide', rate: 1.2, eyes, flashMats: [shellMat, skin] });
  return Object.assign(r, { object3d: root, height: 0.8 * scale, radius: 0.4 * scale });
}

// ------------------------------------------------------------------- Slime

function slime() {
  const root = new THREE.Group(), body = new THREE.Group(), m = new THREE.Group();
  root.add(body); body.add(m);
  const outlineMat = flat(0x1f4d14, { side: THREE.BackSide });
  const ink = flat(0x1a1210), white = flat(0xffffff);

  const prof = [[0, 0], [0.4, 0.01], [0.56, 0.12], [0.6, 0.3], [0.52, 0.5], [0.34, 0.66], [0.16, 0.76], [0, 0.8]];
  const radiusAt = profileRadius(prof);
  const gel = toon(0xffffff, { vertexColors: true, transparent: true, opacity: 0.9 });
  gel.userData.baseOpacity = 0.9;
  const blob = outline(new THREE.Mesh(paintY(lathe(prof, 40), 0x9be86a, 0x3f9e2c, 0, 0.8), gel), 1.04, outlineMat);
  m.add(blob);
  // curled tip on top
  const tip = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.045, 8, 16, Math.PI * 1.4), toon(0x8fe060));
  tip.position.set(0.04, 0.84, 0); tip.rotation.set(0, Math.PI / 2, 0.6);
  m.add(tip);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), flat(0xeaffd8, { transparent: true, opacity: 0.85 }));
  shine.userData = { baseOpacity: 0.85 };
  shine.material.userData.baseOpacity = 0.85;
  shine.scale.set(1, 0.55, 0.4);
  onSurface(m, shine, radiusAt, -0.3, 0.52, 0.005);

  const eyes = [-1, 1].map(side => {
    const e = dotEye(0.075, ink, white);
    e.scale.y = 1.35;
    return onSurface(m, e, radiusAt, side * 0.2, 0.36, 0);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 14, Math.PI), ink);
  smile.rotation.z = Math.PI;
  onSurface(m, smile, radiusAt, 0, 0.24, 0.005);
  smile.rotateZ(Math.PI);

  const r = rig(root, body, { gait: 'blob', hopHeight: 0.35, rate: 1.7, eyes, flashMats: [gel] });
  return Object.assign(r, { object3d: root, height: 0.95, radius: 0.55 });
}

// ------------------------------------------------------------------- export

const BUILDERS = {
  snail: () => snail(0x5fae3e, 0.9),
  blueSnail: () => snail(0x3d7fd8, 1.0),
  redSnail: () => snail(0xd83a2a, 1.15),
  slime,
  orangeMushroom,
};

export const MOB_IDS = Object.keys(BUILDERS);

export function buildMob(id) {
  const model = BUILDERS[id]();
  model.object3d.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return model;
}
