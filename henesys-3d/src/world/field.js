// One builder for every hunting map. A map definition says how big it is,
// how the ground and sky look, where hills, trees, rocks and props go, which
// monsters live in which zone, and where the portals lead.
import * as THREE from 'three';
import { addDaylight } from '../assets/toon.js';
import { grassTufts, flowers, fence, signpost, portal, paintedGround, dirtPath, hill, skyAndHills } from '../assets/props.js';
import { prop } from '../assets/kaykit.js';
import { platformHeight } from '../rules/collision.js';
import { mulberry } from './henesys.js';

const TREE_KINDS = ['trees_A_medium', 'tree_single_A', 'trees_B_medium', 'tree_single_B', 'trees_A_small', 'trees_B_small'];
const ROCKS = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'];

/**
 * def: {
 *   id, name, half, seed, spawn: {x,z},
 *   theme?: { ground, grassDark, grassLight, path, pathEdge, sky, fog, hemi, sun, tuft, flowers: bool, dusk: bool },
 *   paths: [[[x,z]...], width], hills: [[x,z,r,h]], trees: [[x,z]], border: number (trees along the fence),
 *   rocks: number, decor: [[name, x, z, ry, scale]], zones, portals: [{x,z,to,arrive,sign}]
 * }
 */
export function buildField(def) {
  const H = def.half, t = def.theme ?? {};
  const scene = new THREE.Scene();
  const { hemi, sun } = addDaylight(scene);
  if (t.hemi) hemi.color.setHex(t.hemi);
  if (t.sun) { sun.color.setHex(t.sun); sun.intensity *= t.dusk ? 0.75 : 1; }
  const sky = skyAndHills(scene, H * 2.7, i => prop(i % 2 ? 'cloud_big' : 'cloud_small', { scale: 1.4, solid: 0, shadow: false }).object3d);
  if (t.sky) scene.background = new THREE.Color(t.sky);
  if (t.fog) scene.fog = new THREE.Fog(t.fog, H * 1.4, H * 4);

  const colliders = [], heightFns = [], occluders = [];
  const place = (item, x, z, ry = 0, y = 0) => {
    item.object3d.position.set(x, y, z); item.object3d.rotation.y = ry;
    scene.add(item.object3d);
    if (item.collider) colliders.push({ ...item.collider, x, z });
    if (item.platform) heightFns.push(platformHeight(item.platform, x, z, y, ry));
    return item;
  };

  scene.add(paintedGround(H * 5, 'ground-' + def.id, (c, toPx, ppm) => {
    for (const [pts, w] of def.paths ?? []) dirtPath(c, toPx, ppm, pts, w, t.path, t.pathEdge);
  }, t));

  for (const [x, z, r, h] of def.hills ?? []) { const hl = hill(x, z, r, h, t.ground); scene.add(hl.object3d); heightFns.push(hl.heightFn); }
  const groundAt = (x, z) => Math.max(0, ...heightFns.map(f => f(x, z) ?? 0));

  const rnd = mulberry(def.seed ?? 1);
  (def.trees ?? []).forEach(([x, z], i) => {
    const tr = place(prop(TREE_KINDS[i % TREE_KINDS.length], { scale: 1 + (i % 3) * 0.2, solid: 0.3 }), x, z, i, groundAt(x, z));
    occluders.push(tr.object3d);
  });
  // tree line just inside the fence, with gaps where the portals are
  const nearPortal = (x, z) => (def.portals ?? []).some(p => Math.hypot(p.x - x, p.z - z) < 7);
  const border = def.border ?? 24;
  for (let i = 0; i < border; i++) {
    const side = i % 4, k = ((Math.floor(i / 4) + 0.5) / Math.ceil(border / 4) - 0.5) * 2 * (H - 4);
    const [x, z] = [[k, H - 2.5], [k, -H + 2.5], [H - 2.5, k], [-H + 2.5, k]][side];
    if (nearPortal(x, z)) continue;
    place(prop(TREE_KINDS[i % TREE_KINDS.length], { scale: 1.2 + (i % 3) * 0.25, solid: 0.3 }), x, z, i * 1.7, groundAt(x, z));
  }
  for (let i = 0; i < (def.rocks ?? 10); i++) {
    const x = (rnd() - 0.5) * 1.7 * H, z = (rnd() - 0.5) * 1.7 * H;
    if (nearPortal(x, z)) continue;
    const name = i % 3 === 0 ? 'resource_lumber' : ROCKS[i % 5];
    // logs and low rocks are platforms you can jump onto; big rocks stay solid
    place(prop(name, { scale: 0.9 + rnd() * 0.9, solid: 0.7, platform: name === 'resource_lumber' || name === 'rock_single_A' }), x, z, rnd() * 6, groundAt(x, z));
  }
  for (const [n, x, z, ry = 0, sc = 1] of def.decor ?? []) {
    place(prop(n, { scale: sc, solid: n.startsWith('flag') ? 0.2 : 0.7 }), x, z, ry, groundAt(x, z));
  }

  // fence with openings at the portals
  const gaps = (def.portals ?? []).map(p => ({ x: p.x, z: p.z }));
  for (const seg of fenceWithGaps(H, gaps)) { const f = fence(seg); scene.add(f.object3d); colliders.push(...f.colliders); }

  const grass = [], flowerPts = [];
  for (let i = 0; i < H * 17; i++) {
    const x = (rnd() - 0.5) * 2 * H, z = (rnd() - 0.5) * 2 * H;
    const y = groundAt(x, z);
    (i % 7 || t.flowers === false ? grass : flowerPts).push({ x, z, y, ry: rnd() * 6, s: 0.8 + rnd() * 0.6 });
  }
  scene.add(grassTufts(grass, t.tuft));
  if (flowerPts.length) scene.add(flowers(flowerPts));

  const gates = (def.portals ?? []).map(p => {
    const g = portal();
    g.object3d.position.set(p.x, groundAt(p.x, p.z), p.z);
    scene.add(g.object3d);
    if (p.sign) {
      const s = signpost(p.sign);
      // stand the sign beside the portal, facing into the map
      const ox = Math.abs(p.x) > Math.abs(p.z) ? Math.sign(-p.x) * 2.2 : 3.2, oz = Math.abs(p.x) > Math.abs(p.z) ? 4.2 : Math.sign(-p.z) * 2.2;
      place(s, p.x + ox, p.z + oz, Math.atan2(-p.x, -p.z));
    }
    return g;
  });

  return {
    id: def.id, name: def.name, scene, sun, colliders, heightFns,
    bounds: { minX: -H - 2, maxX: H + 2, minZ: -H - 2, maxZ: H + 2 },
    spawn: def.spawn,
    portals: (def.portals ?? []).map(p => ({ x: p.x, z: p.z, r: 1.3, to: p.to, arrive: p.arrive })),
    npcs: [], zones: def.zones, mobs: [], drops: [], occluders,
    animate(time, camera) { sky.animate(time); gates.forEach(g => g.animate(time, camera)); },
  };
}

/** Fence polylines around a square of half-size H, leaving 8 m gaps at the given points. */
function fenceWithGaps(H, gaps) {
  const sides = [[[-H, -H], [H, -H]], [[H, -H], [H, H]], [[H, H], [-H, H]], [[-H, H], [-H, -H]]];
  const out = [];
  for (const [[ax, az], [bx, bz]] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const cuts = gaps.map(g => {
      const t = ((g.x - ax) * (bx - ax) + (g.z - az) * (bz - az)) / (len * len);
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      return t > 0 && t < 1 && Math.hypot(px - g.x, pz - g.z) < 6 ? t : null;
    }).filter(v => v != null).sort((a, b) => a - b);
    let start = 0;
    const half = 4 / len;
    for (const c of cuts) {
      if (c - half > start) out.push([[ax + (bx - ax) * start, az + (bz - az) * start], [ax + (bx - ax) * (c - half), az + (bz - az) * (c - half)]]);
      start = c + half;
    }
    if (start < 1) out.push([[ax + (bx - ax) * start, az + (bz - az) * start], [bx, bz]]);
  }
  return out;
}
