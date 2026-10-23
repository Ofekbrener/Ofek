// Shared look for every model: soft 4-step toon shading, a dark back-face
// outline, vertex-colour gradients and Canvas-painted textures.
import * as THREE from 'three';
export { ease } from '../ease.js';

const ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 195, 195, 195, 255, 230, 230, 230, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export const INK = 0x2b1a0c;

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
}

export function flat(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

/** Adds an inverted-hull outline as a child. `mat` lets a model share one outline material. */
export function outline(mesh, scale = 1.04, mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })) {
  const o = new THREE.Mesh(mesh.geometry, mat);
  o.scale.setScalar(scale);
  o.userData.isOutline = true;
  mesh.add(o);
  mesh.castShadow = true;
  return mesh;
}

/** Bakes a vertical colour gradient into vertex colours (top colour at y1). */
export function paintY(geo, top, bottom, y0, y1) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  const a = new THREE.Color(top), b = new THREE.Color(bottom), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const k = THREE.MathUtils.clamp((p.getY(i) - y0) / (y1 - y0), 0, 1);
    t.copy(b).lerp(a, k);
    c.set([t.r, t.g, t.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

const texCache = new Map();
/** Canvas texture, cached by key so every instance shares one GPU upload. */
export function canvasTexture(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Lathe from [radius, height] pairs. */
export function lathe(points, segments = 40) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

/** Every material under `root`, outlines included, for flashing or fading. */
export function materialsOf(root) {
  const out = new Set();
  root.traverse(o => { if (o.material) out.add(o.material); });
  return [...out];
}

/** Default daylight rig used by maps and the preview. */
export function addDaylight(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9cbf7a, 2.0);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = sun.shadow.camera; s.left = s.bottom = -14; s.right = s.top = 14; s.near = 1; s.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);
  return { hemi, sun };
}

/**
 * Merges indexed geometries into one, each transformed by its matrix and
 * tinted with a flat vertex colour. Used for shapes made of many parts.
 */
export function mergeParts(parts) {
  let vCount = 0, iCount = 0;
  for (const p of parts) { vCount += p.geo.attributes.position.count; iCount += p.geo.index.count; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  let vo = 0, io = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position, N = p.geo.attributes.normal;
    nm.getNormalMatrix(p.matrix);
    c.set(p.color);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(p.matrix);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      pos.set([v.x, v.y, v.z], (vo + i) * 3);
      nor.set([n.x, n.y, n.z], (vo + i) * 3);
      col.set([c.r, c.g, c.b], (vo + i) * 3);
    }
    const I = p.geo.index.array;
    for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
    vo += P.count; io += I.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Frees the GPU buffers of a removed object. Cached Canvas textures are kept
 * because other instances still use them.
 */
export function disposeObject(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.dispose();
  });
}
