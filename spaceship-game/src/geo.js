import * as THREE from 'three';

// Merge several (geometry, color) parts into one non-indexed, vertex-coloured
// geometry — lets complex props (chickens, drumsticks, gifts…) render as a
// single InstancedMesh draw call.
export function mergeColored(parts) {
  const pos = [];
  const nor = [];
  const col = [];
  const c = new THREE.Color();
  for (const { geo, color } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    c.set(color);
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(n[i], n[i + 1], n[i + 2]);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Small helper: geometry transformed in place.
export function tf(geo, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] } = {}) {
  geo.scale(s[0], s[1], s[2]);
  if (r[0]) geo.rotateX(r[0]);
  if (r[1]) geo.rotateY(r[1]);
  if (r[2]) geo.rotateZ(r[2]);
  geo.translate(p[0], p[1], p[2]);
  return geo;
}

// ---- Shared procedural models ------------------------------------------------

// Chicken body facing +Z (toward the player). ~0.9 units tall.
export function chickenBodyGeometry(bodyColor = 0xf7f3ea) {
  return mergeColored([
    { geo: tf(new THREE.IcosahedronGeometry(0.5, 1), { s: [1, 0.9, 1.15] }), color: bodyColor },
    { geo: tf(new THREE.IcosahedronGeometry(0.3, 1), { p: [0, 0.5, 0.35] }), color: bodyColor },
    { geo: tf(new THREE.ConeGeometry(0.1, 0.24, 6), { r: [Math.PI / 2, 0, 0], p: [0, 0.47, 0.72] }), color: 0xffa21f },
    { geo: tf(new THREE.IcosahedronGeometry(0.07, 0), { s: [1, 1.6, 1], p: [0, 0.34, 0.6] }), color: 0xe8262f },
    { geo: tf(new THREE.IcosahedronGeometry(0.09, 0), { p: [0, 0.84, 0.3] }), color: 0xe8262f },
    { geo: tf(new THREE.IcosahedronGeometry(0.08, 0), { p: [0, 0.8, 0.44] }), color: 0xe8262f },
    { geo: tf(new THREE.IcosahedronGeometry(0.08, 0), { p: [0, 0.78, 0.16] }), color: 0xe8262f },
    { geo: tf(new THREE.IcosahedronGeometry(0.06, 0), { p: [0.16, 0.58, 0.58] }), color: 0x111111 },
    { geo: tf(new THREE.IcosahedronGeometry(0.06, 0), { p: [-0.16, 0.58, 0.58] }), color: 0x111111 },
    { geo: tf(new THREE.ConeGeometry(0.22, 0.4, 5), { r: [-0.9, 0, 0], p: [0, 0.28, -0.6] }), color: bodyColor },
    { geo: tf(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 5), { p: [0.16, -0.55, 0.05] }), color: 0xffa21f },
    { geo: tf(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 5), { p: [-0.16, -0.55, 0.05] }), color: 0xffa21f },
  ]);
}

// One wing, hinged at the origin, extending along +X.
export function wingGeometry(color = 0xeee8dc) {
  return mergeColored([
    { geo: tf(new THREE.IcosahedronGeometry(0.3, 0), { s: [1.5, 0.25, 1], p: [0.4, 0, 0] }), color },
    { geo: tf(new THREE.ConeGeometry(0.14, 0.35, 4), { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.3], p: [0.85, 0, -0.05] }), color },
  ]);
}

export function drumstickGeometry() {
  return mergeColored([
    { geo: tf(new THREE.IcosahedronGeometry(0.26, 1), { s: [1, 1.35, 1], p: [0, 0.14, 0] }), color: 0xb5651d },
    { geo: tf(new THREE.IcosahedronGeometry(0.2, 1), { s: [1.05, 0.9, 1.05], p: [0.03, 0.26, 0.05] }), color: 0xd98b3a },
    { geo: tf(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 6), { p: [0, -0.32, 0] }), color: 0xf5ecd7 },
    { geo: tf(new THREE.IcosahedronGeometry(0.075, 0), { p: [0.05, -0.5, 0] }), color: 0xf5ecd7 },
    { geo: tf(new THREE.IcosahedronGeometry(0.075, 0), { p: [-0.05, -0.5, 0] }), color: 0xf5ecd7 },
  ]);
}

export function giftGeometry() {
  return mergeColored([
    { geo: new THREE.BoxGeometry(0.62, 0.52, 0.62), color: 0xe8262f },
    { geo: new THREE.BoxGeometry(0.66, 0.1, 0.14), color: 0xffd35c },
    { geo: new THREE.BoxGeometry(0.14, 0.56, 0.66), color: 0xffd35c },
    { geo: new THREE.BoxGeometry(0.66, 0.56, 0.14), color: 0xffd35c },
    { geo: tf(new THREE.TorusGeometry(0.1, 0.04, 5, 10), { r: [0, 0.6, 0], p: [0.1, 0.33, 0] }), color: 0xffd35c },
    { geo: tf(new THREE.TorusGeometry(0.1, 0.04, 5, 10), { r: [0, -0.6, 0], p: [-0.1, 0.33, 0] }), color: 0xffd35c },
  ]);
}

export function cornGeometry() {
  return mergeColored([
    { geo: tf(new THREE.IcosahedronGeometry(0.22, 1), { s: [1, 2.3, 1] }), color: 0xffd23a },
    { geo: tf(new THREE.ConeGeometry(0.12, 0.6, 4), { r: [0, 0, 0.35], p: [0.12, -0.25, 0] }), color: 0x4ec94a },
    { geo: tf(new THREE.ConeGeometry(0.12, 0.6, 4), { r: [0, 0, -0.35], p: [-0.12, -0.25, 0] }), color: 0x3fae3b },
  ]);
}

export function friedEggGeometry() {
  return mergeColored([
    { geo: tf(new THREE.CircleGeometry(0.75, 10), { r: [-Math.PI / 2, 0, 0], s: [1, 1, 0.85], p: [0, 0.01, 0] }), color: 0xfbfaf5 },
    { geo: tf(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1, 0.55, 1], p: [0.05, 0.01, 0.02] }), color: 0xffb81c },
  ]);
}

// Racing egg-pod: a rocket-powered egg with a hen peeking out of the cockpit. Faces -Z.
export function eggPodGeometry(color) {
  return mergeColored([
    { geo: tf(new THREE.IcosahedronGeometry(0.6, 2), { s: [0.9, 0.62, 1.35], p: [0, 0, 0] }), color },
    { geo: tf(new THREE.CylinderGeometry(0.22, 0.3, 0.4, 10), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.85] }), color: 0x2a3350 },
    { geo: tf(new THREE.ConeGeometry(0.25, 0.5, 4), { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.25], p: [0.62, -0.05, 0.4] }), color: 0x2a3350 },
    { geo: tf(new THREE.ConeGeometry(0.25, 0.5, 4), { r: [0, 0, Math.PI / 2], s: [1, 1, 0.25], p: [-0.62, -0.05, 0.4] }), color: 0x2a3350 },
    // hen head + beak + comb + goggles
    { geo: tf(new THREE.IcosahedronGeometry(0.24, 1), { p: [0, 0.42, -0.1] }), color: 0xf7f3ea },
    { geo: tf(new THREE.ConeGeometry(0.08, 0.2, 5), { r: [-Math.PI / 2, 0, 0], p: [0, 0.4, -0.38] }), color: 0xffa21f },
    { geo: tf(new THREE.IcosahedronGeometry(0.08, 0), { p: [0, 0.68, -0.08] }), color: 0xe8262f },
    { geo: tf(new THREE.IcosahedronGeometry(0.07, 0), { p: [0, 0.64, 0.06] }), color: 0xe8262f },
    { geo: tf(new THREE.TorusGeometry(0.2, 0.04, 5, 14), { p: [0, 0.47, -0.16], s: [1, 0.45, 1] }), color: 0x222222 },
  ]);
}
