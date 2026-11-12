// Weapon trails: a ribbon drawn between the blade's base and tip over the last few frames of a swing.
// Additive blending, so fading a vertex color toward black fades it out.
'use strict';
const TRAIL = {max: 18, life: .16, pts: [], mesh: null, col: new THREE.Color(), tip: new THREE.Vector3(), base: new THREE.Vector3(), local: {}};
(function initTrail() {
  const n = TRAIL.max, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  TRAIL.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
  TRAIL.mesh.frustumCulled = false; scene.add(TRAIL.mesh);
})();
// Find the grip and tip of a weapon mesh in its own space: the two ends of its longest axis, tip = the end farther from the hand.
function weaponEnds(mesh, baseFrac) {
  if (TRAIL.local[mesh.name]) return TRAIL.local[mesh.name];
  mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const ax = s.x >= s.y && s.x >= s.z ? 'x' : s.y >= s.z ? 'y' : 'z';
  const p1 = c.clone(), p2 = c.clone(); p1[ax] = b.min[ax]; p2[ax] = b.max[ax];
  const [grip, tip] = p1.length() < p2.length() ? [p1, p2] : [p2, p1];
  return (TRAIL.local[mesh.name] = {grip, tip, base: grip.clone().lerp(tip, baseFrac)});
}
// Called every frame while a swing is in its active phase.
function trailSample(mesh, w) {
  const e = weaponEnds(mesh, w.trail.base);
  mesh.updateWorldMatrix(true, false);
  const tip = mesh.localToWorld(e.tip.clone()), base = mesh.localToWorld(e.base.clone());
  // widen the ribbon outward so short weapons still draw a readable arc
  const out = tip.clone().sub(base).multiplyScalar(w.trail.width - 1); tip.add(out);
  TRAIL.pts.unshift({tip, base, t: 0}); if (TRAIL.pts.length > TRAIL.max) TRAIL.pts.pop();
  return {tip, base};
}
function updateTrail(dt, colHex) {
  for (const p of TRAIL.pts) p.t += dt;
  TRAIL.pts = TRAIL.pts.filter(p => p.t < TRAIL.life);
  const pos = TRAIL.mesh.geometry.attributes.position.array, col = TRAIL.mesh.geometry.attributes.color.array, n = TRAIL.max;
  TRAIL.col.setHex(colHex);
  for (let i = 0; i < n; i++) {
    const p = TRAIL.pts[Math.min(i, TRAIL.pts.length - 1)];
    const a = p ? Math.max(0, 1 - p.t / TRAIL.life) * (1 - i / n) : 0;
    const tip = p ? p.tip : TRAIL.tip, base = p ? p.base : TRAIL.base;
    pos.set([base.x, base.y, base.z, tip.x, tip.y, tip.z], i * 6);
    col.set([TRAIL.col.r * a * .2, TRAIL.col.g * a * .2, TRAIL.col.b * a * .2, TRAIL.col.r * a * .8, TRAIL.col.g * a * .8, TRAIL.col.b * a * .8], i * 6);
  }
  TRAIL.mesh.visible = TRAIL.pts.length > 1;
  TRAIL.mesh.geometry.attributes.position.needsUpdate = true; TRAIL.mesh.geometry.attributes.color.needsUpdate = true;
}
function clearTrail() { TRAIL.pts = []; TRAIL.mesh.visible = false; }
