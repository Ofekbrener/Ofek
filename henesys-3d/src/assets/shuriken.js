// Throwing star shared by the thief's hand and the Lucky Seven projectile.
import * as THREE from 'three';
import { toon } from './toon.js';

const metal = toon(0xf4f8ff, { emissive: 0x5a6478 });
const haloMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
const haloGeo = new THREE.CircleGeometry(0.5, 20);
const dark = new THREE.MeshBasicMaterial({ color: 0x2b1a0c });
const starShape = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.1 : 0.34, a = i / 8 * Math.PI * 2 + Math.PI / 4; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.05, 0, Math.PI * 2, true); s.holes.push(hole);
  return s;
})();
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 }).center();
const starEdgeGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.07, bevelEnabled: false }).center();

/** A 1.1 m steel star with a dark outline; spin `userData.spinner.rotation.z`. `glow` adds a halo for flight. */
export function shuriken({ glow = false } = {}) {
  const g = new THREE.Group(), spinner = new THREE.Group(); g.add(spinner);
  const edge = new THREE.Mesh(starEdgeGeo, dark); edge.scale.setScalar(1.12);
  spinner.add(edge, new THREE.Mesh(starGeo, metal));
  if (glow) g.add(new THREE.Mesh(haloGeo, haloMat));
  g.userData.spinner = spinner;
  g.scale.setScalar(1.6);
  return g;
}

export { metal };
