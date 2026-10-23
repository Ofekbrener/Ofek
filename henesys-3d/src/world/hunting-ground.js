// Henesys Hunting Ground: three zones running east from the town portal.
// Zone 0 snails, zone 1 red snails and slimes, zone 2 Orange Mushrooms.
import * as THREE from 'three';
import { addDaylight, toon } from '../assets/toon.js';
import { grassTufts, flowers, fence, signpost, portal, paintedGround, dirtPath, hill, skyAndHills } from '../assets/props.js';
import { mulberry } from './henesys.js';
import { prop } from '../assets/kaykit.js';
import { platformHeight } from '../rules/collision.js';

const HALF = 40;

export const ZONES = [
  { id: 0, mobIds: ['snail', 'blueSnail'], area: { x: -18, z: 0, w: 18, d: 56 } },
  { id: 1, mobIds: ['redSnail', 'slime'], area: { x: 4, z: 0, w: 18, d: 56 } },
  { id: 2, mobIds: ['orangeMushroom'], area: { x: 26, z: 0, w: 18, d: 56 } },
];

export function buildHuntingGround() {
  const scene = new THREE.Scene();
  const { sun } = addDaylight(scene);
  const sky = skyAndHills(scene, 110, i => prop(i % 2 ? 'cloud_big' : 'cloud_small', { scale: 1.4, solid: 0, shadow: false }).object3d);
  const colliders = [], heightFns = [], occluders = [];
  const place = (item, x, z, ry = 0, y = 0) => {
    item.object3d.position.set(x, y, z); item.object3d.rotation.y = ry;
    scene.add(item.object3d);
    if (item.collider) colliders.push({ ...item.collider, x, z });
    if (item.platform) heightFns.push(platformHeight(item.platform, x, z, y, ry));
  };

  scene.add(paintedGround(200, 'ground-hunting', (c, toPx, ppm) => {
    dirtPath(c, toPx, ppm, [[-41, 0], [-28, 2], [-14, -3], [0, 2], [14, -2], [30, 1], [38, 0]], 3);
  }));

  // rolling hills inside each zone
  const hills = [[-20, -16, 8, 1.6], [-14, 18, 7, 1.3], [4, -18, 9, 2.2], [6, 17, 7, 1.6], [24, -14, 8, 2], [28, 18, 9, 2.4]];
  for (const [x, z, r, h] of hills) { const hl = hill(x, z, r, h); scene.add(hl.object3d); heightFns.push(hl.heightFn); }
  const groundAt = (x, z) => Math.max(0, ...heightFns.map(f => f(x, z) ?? 0));

  const rnd = mulberry(11);
  const trees = [[-36, -30], [-30, 32], [-8, -34], [-2, 34], [14, -33], [18, 30], [36, -28], [36, 26], [-24, 6], [12, 8], [33, -4], [-6, -12]];
  const TREES = ['trees_A_medium', 'tree_single_A', 'trees_B_medium', 'tree_single_B', 'trees_A_small', 'trees_B_small'];
  trees.forEach(([x, z], i) => { const t = prop(TREES[i % TREES.length], { scale: 1 + (i % 3) * 0.2, solid: 0.3 }); place(t, x, z, i, groundAt(x, z)); occluders.push(t.object3d); });
  // extra tree clumps along the fence line for depth
  for (let i = 0; i < 26; i++) {
    const side = i % 4, k = (Math.floor(i / 4) / 6.5 - 0.5) * 2 * (HALF - 4);
    const [x, z] = [[k, HALF - 2], [k, -HALF + 2], [HALF - 2, k], [-HALF + 2, k * 0.9 + (k > 0 ? 6 : -6)]][side];
    place(prop(TREES[i % TREES.length], { scale: 1.2 + (i % 3) * 0.25, solid: 0.3 }), x, z, i * 1.7, groundAt(x, z));
  }
  for (let i = 0; i < 10; i++) {
    const x = -34 + rnd() * 70, z = (rnd() - 0.5) * 70;
    const name = i % 3 === 0 ? 'resource_lumber' : ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'][i % 5];
    // logs and low rocks are platforms you can jump onto; big rocks stay solid
    const sc = 0.9 + rnd() * 0.9;
    place(prop(name, { scale: sc, solid: 0.7, platform: name === 'resource_lumber' || name === 'rock_single_A' }), x, z, rnd() * 6, groundAt(x, z));
  }

  const f = fence([[-HALF, 4], [-HALF, HALF], [HALF, HALF], [HALF, -HALF], [-HALF, -HALF], [-HALF, -4]]);
  scene.add(f.object3d); colliders.push(...f.colliders);
  place(signpost('Henesys'), -36, 4.5, Math.PI / 2);

  const grass = [], flowerPts = [];
  for (let i = 0; i < 700; i++) {
    const x = (rnd() - 0.5) * 2 * HALF, z = (rnd() - 0.5) * 2 * HALF;
    const y = groundAt(x, z);
    (i % 7 ? grass : flowerPts).push({ x, z, y, ry: rnd() * 6, s: 0.8 + rnd() * 0.6 });
  }
  scene.add(grassTufts(grass), flowers(flowerPts));

  const back = portal();
  back.object3d.position.set(-37.5, 0, 0);
  scene.add(back.object3d);

  return {
    id: 'hunting', name: 'Henesys Hunting Ground', scene, sun, colliders, heightFns,
    bounds: { minX: -HALF - 2, maxX: HALF, minZ: -HALF, maxZ: HALF },
    spawn: { x: -33, z: 0 },
    portals: [{ x: -37.5, z: 0, r: 1.3, to: 'henesys', arrive: { x: 25, z: 0 } }],
    npcs: [], zones: ZONES, mobs: [], drops: [], occluders,
    animate(t, camera) { sky.animate(t); back.animate(t, camera); },
  };
}
