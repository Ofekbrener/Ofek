// Town and field props: mushroom houses, lollipop trees, fences, flowers,
// grass, signs, the portal, sky and distant hills. Static meshes; repeated
// small things are InstancedMesh so the phone draws them in one call each.
import * as THREE from 'three';
import { toon, flat, outline, paintY, canvasTexture, lathe, INK } from './toon.js';

const outlineMat = flat(INK, { side: THREE.BackSide });
const O = (mesh, s = 1.03) => outline(mesh, s, outlineMat);

function capTex(key, base, rim, spot) {
  return canvasTexture(key, 1024, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, base); grad.addColorStop(0.8, base); grad.addColorStop(1, rim);
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 256);
    const spots = [[80, .45, 44], [260, .7, 34], [400, .35, 50], [560, .62, 40], [700, .4, 46], [860, .7, 34], [980, .5, 40], [180, .18, 30], [640, .15, 30]];
    for (const [x, v, w] of spots) for (const dx of [-1024, 0, 1024]) {
      g.fillStyle = spot; g.beginPath(); g.ellipse(x + dx, v * 256, w, w * 0.85, 0, 0, Math.PI * 2); g.fill();
    }
  });
}

/** Mushroom cap from a quarter-ellipse profile, rim first so faces point out. */
function capGeo(r, h) {
  const pts = [[r * 0.94, -h * 0.1]];
  for (let i = 20; i >= 0; i--) { const a = i / 20 * Math.PI / 2; pts.push([Math.sin(a) * r, Math.cos(a) * h]); }
  return lathe(pts, 48);
}

// ------------------------------------------------------------ mushroom house

const CAPS = {
  orange: ['#ec8526', '#b84c16', '#f5c840'],
  red: ['#d8402e', '#9a2416', '#fff2dc'],
  brown: ['#a8693a', '#6a3a1a', '#e8c890'],
  green: ['#58a83a', '#2f6a20', '#d8f0a0'],
};

export function mushroomHouse(cap = 'orange', size = 1) {
  const g = new THREE.Group();
  const wallR = 2.2 * size, wallH = 3 * size;
  const walls = O(new THREE.Mesh(paintY(lathe([[0, 0], [wallR * 1.05, 0], [wallR, wallH * 0.5], [wallR * 0.86, wallH], [0, wallH]], 32), 0xf6ecd4, 0xd8c8a4, 0, wallH), toon(0xffffff, { vertexColors: true })));
  walls.receiveShadow = true;
  g.add(walls);
  const [base, rim, spot] = CAPS[cap];
  const roof = O(new THREE.Mesh(capGeo(3.4 * size, 2.4 * size), toon(0xe8e8e8, { map: capTex('cap-' + cap, base, rim, spot) })));
  roof.position.y = wallH * 0.95;
  g.add(roof);
  const under = new THREE.Mesh(new THREE.CircleGeometry(3.2 * size, 48), flat(0x8a7a5a, { side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = wallH * 0.95 - 0.2 * size;
  g.add(under);
  // door (front = +z)
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.55, 0); doorShape.lineTo(0.55, 0); doorShape.lineTo(0.55, 1.1); doorShape.absarc(0, 1.1, 0.55, 0, Math.PI, false); doorShape.lineTo(-0.55, 0);
  const door = new THREE.Mesh(new THREE.ShapeGeometry(doorShape, 12), toon(0x7a4a24));
  door.scale.setScalar(size); door.position.set(0, 0.02, wallR * 1.0 + 0.02);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07 * size, 8, 6), toon(0xf2c832));
  knob.position.set(0.32 * size, 0.85 * size, wallR + 0.06); g.add(knob);
  // round windows
  for (const a of [-0.9, 0.9]) {
    const w = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.42 * size, 0.08 * size, 8, 20), toon(0x7a4a24));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.42 * size, 20), toon(0x9fd6f0));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06 * size, 0.84 * size, 0.04), toon(0x7a4a24));
    w.add(frame, glass, bar);
    const rr = wallR * 0.93;
    w.position.set(Math.sin(a) * rr, wallH * 0.58, Math.cos(a) * rr);
    w.rotation.y = a;
    g.add(w);
  }
  // chimney
  const chim = O(new THREE.Mesh(new THREE.CylinderGeometry(0.28 * size, 0.32 * size, 1.4 * size, 10), toon(0xb08060)));
  chim.position.set(-1.4 * size, wallH + 1.6 * size, -0.6 * size); g.add(chim);
  g.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { object3d: g, collider: { type: 'circle', r: wallR * 1.08 } };
}

// --------------------------------------------------------------------- trees

export function lollipopTree(scale = 1, leaf = 0x5cb83a) {
  const g = new THREE.Group();
  const trunk = O(new THREE.Mesh(paintY(lathe([[0, 0], [0.42, 0], [0.3, 0.3], [0.24, 2.2], [0, 2.3]], 12), 0x9a6232, 0x6a3e1c, 0, 2.3), toon(0xffffff, { vertexColors: true })), 1.06);
  g.add(trunk);
  const crown = new THREE.Group(); crown.position.y = 3; g.add(crown);
  const c = new THREE.Color(leaf);
  [[0, 0, 0, 1.5], [0.9, -0.3, 0.3, 1.0], [-0.9, -0.2, 0.2, 1.05], [0.1, 0.7, -0.2, 1.0], [0.2, -0.4, 0.9, 0.9]].forEach(([x, y, z, r], i) => {
    const s = O(new THREE.Mesh(paintY(new THREE.SphereGeometry(r, 18, 14), c.clone().offsetHSL(0, 0, 0.08).getHex(), c.clone().offsetHSL(0, 0, -0.12).getHex(), -r, r), toon(0xffffff, { vertexColors: true })), 1.04);
    s.position.set(x, y, z); crown.add(s);
  });
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { object3d: g, collider: { type: 'circle', r: 0.5 * scale } };
}

/** The giant mushroom tree at the centre of Henesys. */
export function giantMushroom() {
  const g = new THREE.Group();
  const stem = O(new THREE.Mesh(paintY(lathe([[0, 0], [2.4, 0], [1.7, 0.6], [1.3, 3], [1.15, 6.5], [0, 6.6]], 28), 0xf6ecd4, 0xc8b894, 0, 6.6), toon(0xffffff, { vertexColors: true })));
  g.add(stem);
  const cap = O(new THREE.Mesh(capGeo(6.5, 3.6), toon(0xe8e8e8, { map: capTex('cap-giant', '#ec8526', '#b84c16', '#f5c840') })));
  cap.position.y = 6.3; g.add(cap);
  const under = new THREE.Mesh(new THREE.CircleGeometry(6.2, 48), flat(0x8a7a5a, { side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = 6.0; g.add(under);
  // ring bench around the stem
  const bench = O(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 8, 32), toon(0x9a6232)));
  bench.rotation.x = Math.PI / 2; bench.position.y = 0.45; g.add(bench);
  g.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { object3d: g, collider: { type: 'circle', r: 2.8 } };
}

// --------------------------------------------------------- instanced scatter

function instanced(geo, mat, transforms, color) {
  const im = new THREE.InstancedMesh(geo, mat, transforms.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  transforms.forEach((t, i) => {
    e.set(0, t.ry ?? 0, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(t.x, t.y ?? 0, t.z), q, new THREE.Vector3(t.s ?? 1, t.sy ?? t.s ?? 1, t.s ?? 1));
    im.setMatrixAt(i, m);
    if (t.c != null) im.setColorAt(i, new THREE.Color(t.c));
  });
  im.instanceMatrix.needsUpdate = true;
  return im;
}

export function grassTufts(points) {
  const geo = new THREE.ConeGeometry(0.08, 0.35, 4); geo.translate(0, 0.17, 0);
  const g = new THREE.Group();
  const off = [[0, 0], [0.09, 0.04], [-0.08, 0.05]];
  for (const [ox, oz] of off) g.add(instanced(geo, toon(0x4fa83c), points.map(p => ({ x: p.x + ox, y: p.y, z: p.z + oz, ry: p.ry, s: p.s }))));
  return g;
}

export function flowers(points) {
  const g = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4); stemGeo.translate(0, 0.2, 0);
  g.add(instanced(stemGeo, toon(0x3f8f2a), points));
  const headGeo = new THREE.SphereGeometry(0.11, 8, 6); headGeo.translate(0, 0.43, 0);
  const cols = [0xff6b8a, 0xffd23f, 0xffffff, 0xb784ff, 0xff8c3a];
  g.add(instanced(headGeo, toon(0xffffff), points.map((p, i) => ({ ...p, c: cols[i % cols.length] }))));
  const eyeGeo = new THREE.SphereGeometry(0.05, 6, 4); eyeGeo.translate(0, 0.45, 0.07);
  g.add(instanced(eyeGeo, toon(0xf2a000), points));
  return g;
}

/** Fence posts and rails along a polyline. Returns box colliders per segment. */
export function fence(path) {
  const posts = [], rails = [], colliders = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2));
    const ry = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) posts.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n });
    for (let k = 0; k < n; k++) {
      const x = ax + (bx - ax) * (k + 0.5) / n, z = az + (bz - az) * (k + 0.5) / n;
      rails.push({ x, z, y: 0.5, ry, s: 1 }, { x, z, y: 0.9, ry, s: 1 });
    }
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    colliders.push(Math.abs(bx - ax) > Math.abs(bz - az)
      ? { type: 'box', x: cx, z: cz, hw: Math.abs(bx - ax) / 2, hd: 0.2 }
      : { type: 'box', x: cx, z: cz, hw: 0.2, hd: Math.abs(bz - az) / 2 });
  }
  const g = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.18, 1.2, 0.18); postGeo.translate(0, 0.6, 0);
  g.add(instanced(postGeo, toon(0xa8743e), posts));
  const len = Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]) / Math.max(1, Math.round(Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]) / 2));
  const railGeo = new THREE.BoxGeometry(0.08, 0.12, len);
  g.add(instanced(railGeo, toon(0xc08a50), rails));
  return { object3d: g, colliders };
}

export function signpost(text) {
  const g = new THREE.Group();
  const post = O(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 8), toon(0x8a5a2a)), 1.08);
  post.position.y = 1.1; g.add(post);
  const tex = canvasTexture('sign-' + text, 512, 160, (c) => {
    c.fillStyle = '#c89050'; c.fillRect(0, 0, 512, 160);
    c.strokeStyle = '#6a3e1c'; c.lineWidth = 14; c.strokeRect(7, 7, 498, 146);
    c.fillStyle = '#3a2412'; c.font = 'bold 72px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 84);
  });
  const board = O(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), [toon(0xc89050), toon(0xc89050), toon(0xc89050), toon(0xc89050), toon(0xffffff, { map: tex }), toon(0xffffff, { map: tex })]), 1.05);
  board.position.y = 2.0; g.add(board);
  return { object3d: g, collider: { type: 'circle', r: 0.3 } };
}

// -------------------------------------------------------------------- portal

/** Classic portal: a swirl of light on the ground. animate(t) spins it. */
export function portal() {
  const g = new THREE.Group();
  const tex = canvasTexture('portal', 256, 256, (c) => {
    const rg = c.createRadialGradient(128, 128, 10, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(140,220,255,.9)'); rg.addColorStop(1, 'rgba(60,140,255,0)');
    c.fillStyle = rg; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 8;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let a = 0; a < 5; a += 0.05) { const r = 12 + a * 22; c.lineTo(128 + Math.cos(a + k * 2.1) * r, 128 + Math.sin(a + k * 2.1) * r); } c.stroke(); }
  });
  const mats = [];
  const layers = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.9 - i * 0.2 });
    mats.push(m);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.4 - i * 0.4, 2.4 - i * 0.4), m);
    disc.position.y = 0.9 + i * 0.35;
    g.add(disc); layers.push(disc);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 1.3; g.add(beam);
  return {
    object3d: g,
    animate(t, camera) {
      layers.forEach((d, i) => {
        d.quaternion.copy(camera.quaternion);
        d.rotateZ(t * (1.5 + i) * (i % 2 ? -1 : 1));
        d.position.y = 0.9 + i * 0.35 + Math.sin(t * 2 + i) * 0.08;
      });
    },
  };
}

// --------------------------------------------------------------- landscape

/** Ground plane with a painted texture: grass noise plus dirt paths drawn by `paint`. */
export function paintedGround(size, key, paint) {
  const tex = canvasTexture(key, 1024, 1024, (c, w, h) => {
    c.fillStyle = '#7fcf52'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = Math.random() < 0.5 ? 'rgba(90,170,60,.35)' : 'rgba(170,230,110,.3)';
      const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 6;
      c.beginPath(); c.ellipse(x, y, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2); c.fill();
    }
    // world (x, z) -> canvas px
    const toPx = (x, z) => [(x / size + 0.5) * w, (z / size + 0.5) * h];
    paint(c, toPx, w / size);
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), toon(0xffffff, { map: tex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

/** Draws a soft dirt path through world points on a paintedGround canvas. */
export function dirtPath(c, toPx, pxPerM, pts, width) {
  c.lineCap = c.lineJoin = 'round';
  for (const [col, wMul] of [['#b88a52', 1.15], ['#d8b07a', 1]]) {
    c.strokeStyle = col; c.lineWidth = width * pxPerM * wMul;
    c.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
  }
}

export function dirtDisc(c, toPx, pxPerM, x, z, r) {
  const [px, py] = toPx(x, z);
  c.fillStyle = '#b88a52'; c.beginPath(); c.arc(px, py, r * pxPerM * 1.06, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d8b07a'; c.beginPath(); c.arc(px, py, r * pxPerM, 0, Math.PI * 2); c.fill();
}

/** Smooth round hill. Returns the mesh and a heightFn for walking on it. */
export function hill(x, z, r, h) {
  const geo = new THREE.CircleGeometry(r, 48, 0, Math.PI * 2);
  geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  // add rings so the dome has curvature
  const dome = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const D = dome.attributes.position;
  for (let i = 0; i < D.count; i++) {
    const px = D.getX(i) * r, pz = D.getZ(i) * r, d = Math.hypot(px, pz) / r;
    D.setXYZ(i, px, h * (1 - d * d), pz);
  }
  dome.computeVertexNormals();
  P.needsUpdate = true;
  const mesh = new THREE.Mesh(dome, toon(0x7fcf52));
  mesh.position.set(x, 0, z);
  mesh.receiveShadow = true;
  const heightFn = (px, pz) => { const d = Math.hypot(px - x, pz - z) / r; return d < 1 ? h * (1 - d * d) : null; };
  return { object3d: mesh, heightFn };
}

/** Sky colour, distant green hills and slow clouds around the map. */
export function skyAndHills(scene, radius = 90) {
  scene.background = new THREE.Color(0x8fd0ff);
  scene.fog = new THREE.Fog(0xbfe6ff, 60, 170);
  const g = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + Math.random() * 0.2;
    const h = new THREE.Mesh(new THREE.SphereGeometry(18 + Math.random() * 14, 20, 12), toon(i % 2 ? 0x6fbf4a : 0x5aa83c));
    h.scale.y = 0.45 + Math.random() * 0.3;
    h.position.set(Math.cos(a) * radius, -2, Math.sin(a) * radius);
    g.add(h);
  }
  const clouds = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(2.4 + Math.random() * 1.6, 12, 8), toon(0xffffff));
      p.position.set(j * 2.6 - 4, Math.random(), 0); p.scale.y = 0.6; cl.add(p);
    }
    const a = Math.random() * Math.PI * 2;
    cl.position.set(Math.cos(a) * 70, 22 + Math.random() * 14, Math.sin(a) * 70);
    cl.lookAt(0, cl.position.y, 0);
    clouds.add(cl);
  }
  g.add(clouds);
  scene.add(g);
  return { animate(t) { clouds.rotation.y = t * 0.004; } };
}

/** MapleStory-style name tag: dark rounded box, white text. A Sprite, so it always faces the camera. */
export function nameTag(text, color = '#ffffff') {
  const tex = canvasTexture('tag-' + text + color, 512, 96, (c) => {
    c.font = '600 46px Fredoka, sans-serif';
    const w = Math.min(500, c.measureText(text).width + 40);
    c.fillStyle = 'rgba(20,14,8,.72)';
    c.beginPath(); c.roundRect((512 - w) / 2, 14, w, 68, 16); c.fill();
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 50);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.45, 1);
  s.renderOrder = 10;
  return s;
}
