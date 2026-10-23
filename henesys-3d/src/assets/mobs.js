// The five hunting-ground monsters, modelled after the Classic sprites.
// buildMob(id) -> { object3d, height, radius, animate(state, dt, t), hit() }
// state: 'idle' | 'move' | 'die'. hit() plays the knock-back on top of any state.
import * as THREE from 'three';
import { toon, flat, outline, paintY, canvasTexture, lathe, materialsOf, mergeParts, ease, INK } from './toon.js';
import { buildSkeletonMob } from './kaykit.js';

// ---------------------------------------------------------------- shared rig

/**
 * Shared animation for every mob. All motion eases toward a target so state
 * changes never snap. gait: 'hop' (mushroom), 'slide' (snails), 'blob' (slime).
 */
function rig(root, body, { gait, hopHeight = 0.5, rate = 1.5, eyes = [], flashMats = [], legs = [] }) {
  const s = { blend: 0, ph: Math.random(), sq: 1, lean: 0, flash: 0, eye: 1, hitT: -1, dieT: -1, lungeT: -1, look: 0 };
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
    } else if (gait === 'trot') {
      // four-legged trot: quick body bob, legs swing in diagonal pairs
      const w = Math.sin(s.ph * Math.PI * 4);
      hop = Math.abs(w) * 0.08;
      sqT = 1 + 0.03 * w;
      legs.forEach((l, i) => { l.rotation.x = ease(l.rotation.x, ((i === 0 || i === 3) ? w : -w) * 0.7 * s.blend, 20, dt); });
    } else {
      // slide: the foot stretches and contracts while the shell rocks
      const w = Math.sin(s.ph * Math.PI * 2);
      stretchZ = 1 + 0.12 * w * s.blend;
      sqT = 1 - 0.05 * w;
      lean = 0.05 * Math.sin(s.ph * Math.PI * 2 + 1);
    }
    if (gait !== 'trot') legs.forEach((l, i) => { l.rotation.x = ease(l.rotation.x, Math.sin(s.ph * Math.PI * 2 + i * 2) * 0.4 * s.blend, 12, dt); });
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

    // contact attack: a quick forward pounce with a squash on landing
    let pounce = 0;
    if (s.lungeT >= 0) {
      s.lungeT += dt;
      const k = s.lungeT / 0.35;
      pounce = Math.sin(Math.min(1, k) * Math.PI);
      lean -= pounce * 0.35;
      if (k >= 1) s.lungeT = -1;
    }
    // idle: glance left and right now and then
    s.look = ease(s.look, s.blend < 0.3 ? Math.sin(t * 0.7 + s.ph * 9) * 0.35 : 0, 3, dt);
    body.rotation.y = s.look;

    s.lean = ease(s.lean, lean, 10, dt);
    body.rotation.x = -s.lean + hitTilt;
    const side = 1 / Math.sqrt(s.sq);
    body.scale.set(side, s.sq, side * stretchZ);
    body.position.y = hop + pounce * 0.25;
    body.position.z = pounce * 0.45;

    if (s.dieT >= 0) {
      s.dieT += dt;
      const k = Math.min(1, s.dieT / 0.6);
      mats.forEach(m => { m.opacity = (m.userData.baseOpacity ?? 1) * (1 - k); });
      // squash flat, then spread and sink
      const squash = Math.min(1, s.dieT / 0.15);
      body.scale.y *= 1 - squash * 0.55;
      body.scale.x *= 1 + squash * 0.35; body.scale.z *= 1 + squash * 0.35;
      body.position.y -= k * 0.3;
    }
  }

  return {
    animate,
    hit() { s.hitT = 0; s.flash = 1; },
    lunge() { if (s.lungeT < 0) s.lungeT = 0; },
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

// Cap colours per mushroom kind: [top, middle, rim, spot shadow, spot, spot highlight]
const CAPS = {
  orange: ['#ec8526', '#e06e1c', '#b84c16', '#c96a12', '#f5c840', '#fbe07a'],
  green: ['#7ccf4e', '#5fae3e', '#3d7f26', '#4e9a30', '#e8f8c8', '#ffffff'],
  horny: ['#6f86e0', '#566fd0', '#3a4aa0', '#4a5cb8', '#d8dcff', '#ffffff'],
};
const capTexture = (kind = 'orange') => canvasTexture('cap-' + kind, 1024, 256, (g) => {
  const [top, mid, rim, shade, spot, hi] = CAPS[kind];
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(0.75, mid); grad.addColorStop(1, rim);
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 256);
  const spots = [[60, .5, 46], [210, .74, 38], [330, .4, 50], [470, .68, 42], [600, .44, 48], [740, .76, 36], [860, .42, 50], [960, .72, 36], [150, .2, 34], [520, .18, 36], [800, .16, 34]];
  for (const [x, v, w] of spots) for (const dx of [-1024, 0, 1024]) {
    const y = v * 256;
    g.fillStyle = shade; g.beginPath(); g.ellipse(x + dx + 3, y + 3, w, w * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = spot; g.beginPath(); g.ellipse(x + dx, y, w, w * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = hi; g.beginPath(); g.ellipse(x + dx - w * 0.25, y - 4, w * 0.4, w * 0.22, 0, 0, Math.PI * 2); g.fill();
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

/** kind: 'orange' (open shouting mouth), 'green' (calm smile), 'horny' (horns, frown). */
function mushroom(kind = 'orange', scale = 0.8) {
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
  const capMat = toon(0xe8e8e8, { map: capTexture(kind) });
  const capGroup = new THREE.Group();
  capGroup.position.set(0, 1.16, -0.1);
  capGroup.rotation.x = -0.34; // tilted back so the gills show from the front
  m.add(capGroup);
  capGroup.add(outline(new THREE.Mesh(lathe(capPts, 64), capMat), 1.03, outlineMat));
  const gills = new THREE.Mesh(new THREE.CircleGeometry(1.05, 64), flat(0xffffff, { map: gillTexture(), side: THREE.DoubleSide }));
  gills.rotation.x = Math.PI / 2; gills.position.y = -0.055;
  capGroup.add(gills);

  const eyes = [-1, 1].map(side => onSurface(m, dotEye(0.065, ink, white), radiusAt, side * 0.32, 0.88, 0));
  if (kind === 'orange') {
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.46), flat(0xffffff, { map: mouthTexture(), transparent: true }));
    onSurface(m, mouth, radiusAt, 0, 0.6, 0.02);
    mouth.rotation.x -= 0.18;
  } else {
    // a small curved mouth: smile for green, frown for horny
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 16, Math.PI), ink);
    onSurface(m, arc, radiusAt, 0, 0.66, 0.012);
    if (kind === 'green') arc.rotateZ(Math.PI);
    // brows give the horny mushroom its scowl
    if (kind === 'horny') for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.03), ink);
      onSurface(m, brow, radiusAt, side * 0.3, 1.0, 0.01);
      brow.rotateZ(side * 0.45);
    }
  }
  if (kind === 'horny') for (const side of [-1, 1]) {
    const horn = outline(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 10), toon(0xf4ecd8)), 1.06, outlineMat);
    horn.position.set(side * 0.45, 0.72, 0.05); horn.rotation.z = -side * 0.5;
    capGroup.add(horn);
  }

  shell(root, m, scale);
  const r = rig(root, body, { gait: 'hop', hopHeight: kind === 'green' ? 0.45 : 0.55, rate: kind === 'horny' ? 1.8 : 1.5, eyes, flashMats: [capMat] });
  return Object.assign(r, { object3d: root, height: 1.95 * scale, radius: 0.85 * scale });
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

// --------------------------------------------------------------------- Pig

function pig(ribbon = false) {
  const root = new THREE.Group(), body = new THREE.Group(), m = new THREE.Group();
  root.add(body); body.add(m);
  const outlineMat = flat(INK, { side: THREE.BackSide });
  const ink = flat(0x1a1210), white = flat(0xffffff);
  const skin = toon(ribbon ? 0xf7b2c4 : 0xf4a8b8), dark = toon(0xd9809a);

  const trunk = outline(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), skin), 1.04, outlineMat);
  trunk.scale.set(0.95, 0.82, 1.25); trunk.position.y = 0.6; m.add(trunk);
  const head = outline(new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 16), skin), 1.05, outlineMat);
  head.position.set(0, 0.78, 0.55); m.add(head);
  const snout = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 18), dark), 1.08, outlineMat);
  snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.06, 0.34); head.add(snout);
  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), ink);
    nostril.position.set(side * 0.06, 0, 0.075); nostril.scale.z = 0.4; snout.add(nostril); nostril.rotation.x = -Math.PI / 2;
    const ear = outline(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 4), dark), 1.08, outlineMat);
    ear.position.set(side * 0.24, 0.28, -0.02); ear.rotation.set(-0.3, 0, -side * 0.5); head.add(ear);
  }
  const eyes = [-1, 1].map(side => { const e = dotEye(0.05, ink, white); e.position.set(side * 0.15, 0.1, 0.3); head.add(e); return e; });
  const legs = [];
  for (const [x, z] of [[-0.25, 0.32], [0.25, 0.32], [-0.25, -0.32], [0.25, -0.32]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.4, z); m.add(leg);
    const l = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.36, 10), skin), 1.08, outlineMat);
    l.position.y = -0.2; leg.add(l);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.06, 10), toon(0x6a3a3a));
    hoof.position.y = -0.38; leg.add(hoof);
    legs.push(leg);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 14, Math.PI * 1.6), dark);
  tail.position.set(0, 0.75, -0.62); tail.rotation.y = Math.PI / 2; m.add(tail);
  if (ribbon) {
    const red = toon(0xe8352a);
    for (const side of [-1, 1]) {
      const loop = outline(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 8), red), 1.08, outlineMat);
      loop.position.set(side * 0.13, 0.36, -0.05); loop.rotation.z = side * Math.PI / 2; head.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), red); knot.position.set(0, 0.36, -0.05); head.add(knot);
  }
  shell(root, m, ribbon ? 1.1 : 1);
  const r = rig(root, body, { gait: 'trot', rate: 2.2, eyes, flashMats: [skin], legs });
  return Object.assign(r, { object3d: root, height: 1.25 * (ribbon ? 1.1 : 1), radius: 0.6 * (ribbon ? 1.1 : 1) });
}

// ------------------------------------------------------------------- Stump

const barkTexture = () => canvasTexture('bark', 256, 256, (g) => {
  g.fillStyle = '#7a4e2c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { g.strokeStyle = i % 2 ? 'rgba(60,34,18,.6)' : 'rgba(150,104,64,.5)'; g.lineWidth = 3 + Math.random() * 4; const x = Math.random() * 256; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, 80, x - 10, 170, x + 4, 256); g.stroke(); }
});
const ringsTexture = () => canvasTexture('rings', 256, 256, (g) => {
  g.fillStyle = '#e8c890'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#b88a52'; for (let r = 12; r < 128; r += 14) { g.lineWidth = 3; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
});

function stump() {
  const root = new THREE.Group(), body = new THREE.Group(), m = new THREE.Group();
  root.add(body); body.add(m);
  const outlineMat = flat(INK, { side: THREE.BackSide });
  const ink = flat(0x1a1210);
  const bark = toon(0xffffff, { map: barkTexture() });
  const trunk = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 1.0, 20, 1, true), bark), 1.04, outlineMat);
  trunk.position.y = 0.62; m.add(trunk);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), toon(0xffffff, { map: ringsTexture() }));
  top.rotation.x = -Math.PI / 2; top.position.y = 1.12; m.add(top);
  const sprout = new THREE.Group(); sprout.position.set(0.15, 1.12, 0.1); m.add(sprout);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), toon(0x4f8f2a)); stalk.position.y = 0.15; sprout.add(stalk);
  for (const side of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), toon(0x6cc04a)); leaf.scale.set(1.4, 0.4, 0.8); leaf.position.set(side * 0.1, 0.3, 0); leaf.rotation.z = side * 0.4; sprout.add(leaf); }
  // glowing angry eyes in dark hollows
  const eyes = [-1, 1].map(side => {
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), ink);
    hollow.position.set(side * 0.2, 0.8, 0.6); hollow.rotation.y = side * 0.3; m.add(hollow);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), flat(0xffd23f));
    glow.position.z = 0.01; hollow.add(glow);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), ink);
    brow.position.set(0, 0.12, 0.02); brow.rotation.z = -side * 0.5; hollow.add(brow);
    return hollow;
  });
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.08), ink); mouth.position.set(0, 0.55, 0.64); m.add(mouth);
  const legs = [];
  for (const a of [0.6, 2.6, 4.6]) {
    const leg = new THREE.Group(); leg.position.set(Math.sin(a) * 0.5, 0.18, Math.cos(a) * 0.5); m.add(leg);
    const root2 = outline(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 8), bark), 1.08, outlineMat);
    root2.rotation.x = Math.PI; root2.position.y = -0.04; leg.add(root2);
    legs.push(leg);
  }
  const r = rig(root, body, { gait: 'hop', hopHeight: 0.25, rate: 1.4, eyes, flashMats: [bark], legs });
  return Object.assign(r, { object3d: root, height: 1.35, radius: 0.65 });
}

// ------------------------------------------------------------------- export

const BUILDERS = {
  snail: () => snail(0x5fae3e, 0.9),
  blueSnail: () => snail(0x3d7fd8, 1.0),
  redSnail: () => snail(0xd83a2a, 1.15),
  slime,
  orangeMushroom: () => mushroom('orange', 0.8),
  greenMushroom: () => mushroom('green', 0.9),
  hornyMushroom: () => mushroom('horny', 1.0),
  pig: () => pig(false),
  ribbonPig: () => pig(true),
  stump,
  skeletonMinion: () => buildSkeletonMob('skeletonMinion'),
  skeletonWarrior: () => buildSkeletonMob('skeletonWarrior'),
  skeletonMage: () => buildSkeletonMob('skeletonMage'),
};

export const MOB_IDS = Object.keys(BUILDERS);

export function buildMob(id) {
  const model = BUILDERS[id]();
  // only the big parts cast shadows: hooves, eyes and ears would double the draw calls for nothing
  model.object3d.traverse(o => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.castShadow = !o.userData.isOutline && o.geometry.boundingSphere.radius > 0.3;
  });
  return model;
}
