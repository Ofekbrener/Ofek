// Henesys: plaza with the giant mushroom, mushroom houses, the Bowman school
// on the northern hill, and the east gate portal to the hunting ground.
import * as THREE from 'three';
import { addDaylight } from '../assets/toon.js';
import { mushroomHouse, lollipopTree, giantMushroom, grassTufts, flowers, fence, signpost, portal, paintedGround, dirtPath, dirtDisc, hill, skyAndHills } from '../assets/props.js';
import { buildNpc, prop } from '../assets/kaykit.js';
import { Npc } from '../entities/npc.js';
import { canAdvance } from '../rules/stats.js';

const HALF = 30;

/** game: { character, advance(job), quests } — read at talk time, so dialogs follow progress. */
export function buildHenesys(game) {
  const scene = new THREE.Scene();
  const { sun } = addDaylight(scene);
  const sky = skyAndHills(scene, 90, i => prop(i % 2 ? 'cloud_big' : 'cloud_small', { scale: 1.4, solid: 0, shadow: false }).object3d);
  const colliders = [], heightFns = [], animated = [sky], occluders = [];
  const place = (item, x, z, ry = 0) => {
    item.object3d.position.set(x, item.object3d.position.y, z);
    item.object3d.rotation.y = ry;
    scene.add(item.object3d);
    if (item.collider) colliders.push({ ...item.collider, x, z });
    return item;
  };

  // ground with dirt paths: plaza, east road to the gate, north road to the school
  scene.add(paintedGround(160, 'ground-henesys', (c, toPx, ppm) => {
    dirtDisc(c, toPx, ppm, 0, 0, 8.5);
    dirtPath(c, toPx, ppm, [[0, 0], [12, 1], [22, 0], [31, 0]], 3.4);
    dirtPath(c, toPx, ppm, [[0, 0], [-1, -8], [0, -16]], 3);
    dirtPath(c, toPx, ppm, [[0, 0], [-10, 6], [-17, 9]], 2.4);
    dirtPath(c, toPx, ppm, [[0, 0], [9, 9], [13, 14]], 2.4);
    dirtPath(c, toPx, ppm, [[2, 8], [2, 18], [0, 31]], 2.8);
  }));

  // north hill with the Bowman Instructional School
  const h = hill(0, -23, 11, 3.2);
  scene.add(h.object3d); heightFns.push(h.heightFn);
  const school = mushroomHouse('green', 1.35);
  school.object3d.position.y = 3.0;
  place(school, 0, -24, 0);
  const schoolSign = signpost('Bowman School');
  schoolSign.object3d.position.y = h.heightFn(3.5, -17);
  place(schoolSign, 3.5, -17, -0.2);

  occluders.push(place(giantMushroom(), 0, 0).object3d);
  occluders.push(place(mushroomHouse('orange'), -15, -7, 0.9).object3d);
  occluders.push(place(mushroomHouse('red'), -17, 9, 1.8).object3d);
  occluders.push(place(mushroomHouse('brown', 0.9), 13, 14, -2.6).object3d);
  occluders.push(place(mushroomHouse('red', 0.95), 15, -11, -0.6).object3d);
  occluders.push(place(mushroomHouse('orange', 0.85), -4, 18, 3.1).object3d);

  // trees around the edges
  const trees = [[-24, -20], [-26, -6], [-25, 20], [-12, 24], [6, 25], [22, 22], [25, 9], [24, -14], [16, -24], [-16, -24], [-8, -15], [9, -17], [-22, 2], [5, 12]];
  const TREES = ['tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_medium'];
  // round Henesys trees mixed with KayKit pines
  trees.forEach(([x, z], i) => occluders.push(place(i % 2 ? lollipopTree(1 + (i % 3) * 0.15, i % 4 === 1 ? 0x6cc04a : 0x56b03a) : prop(TREES[i % 4], { scale: 0.9 + (i % 3) * 0.15, solid: i % 4 > 1 ? 0.35 : 0.25 }), x, z, i).object3d));

  // life around town: barrels and crates by the houses, an archery range by
  // Athena's hill, a weapon rack by Dances with Balrog, flags at the gate
  const decor = [
    ['barrel', -12, -4, 0], ['barrel', -12.8, -3.2, 1], ['crate_A_big', -11.5, -2.6, 0.3], ['sack', -13.5, -2.8, 0.8],
    ['crate_B_big', 16.5, -7.5, 0.5], ['crate_A_small', 17.4, -7, 1.2], ['wheelbarrow', 10, 12, 2.2],
    ['barrel', -13, 12, 0.2], ['resource_lumber', -20, 5, 1.4],
    ['target', -5, -19, 0.4, 1.3], ['target', -7.5, -18, 0.7, 1.3], ['bucket_arrows', -3.8, -17.6, 0, 1.2],
    ['weaponrack', 11, 8, -2.2, 1.3], ['tent', 21, -16, -0.8],
    ['flag_red', 27, 6, 0, 1.6], ['flag_red', 27, -6, 0, 1.6],
  ];
  for (const [n, x, z, ry, sc = 1] of decor) {
    const item = prop(n, { scale: sc, solid: n.startsWith('flag') ? 0.2 : 0.7 });
    item.object3d.position.y = h.heightFn(x, z) ?? 0;
    place(item, x, z, ry);
  }

  // fence around the town, open at the east gate
  // open at the east gate (Hunting Ground) and the south gate (Pig Farm)
  for (const path of [[[HALF, 4], [HALF, HALF], [4, HALF]], [[-4, HALF], [-HALF, HALF], [-HALF, -HALF], [HALF, -HALF], [HALF, -4]]]) {
    const f = fence(path); scene.add(f.object3d); colliders.push(...f.colliders);
  }
  const gateSign = signpost('Hunting Ground');
  place(gateSign, 26, 4.5, -Math.PI / 2);
  place(signpost('Henesys'), 7, 5, 0.6);

  // scatter
  const rnd = mulberry(7);
  const free = (x, z) => Math.hypot(x, z) > 9.5 && colliders.every(c => c.type !== 'circle' || Math.hypot(x - c.x, z - c.z) > c.r + 1) && Math.abs(z) > 2.5;
  const grass = [], flowerPts = [];
  for (let i = 0; i < 500; i++) {
    const x = (rnd() - 0.5) * 2 * HALF, z = (rnd() - 0.5) * 2 * HALF;
    if (!free(x, z) || h.heightFn(x, z) != null) continue;
    (i % 5 ? grass : flowerPts).push({ x, z, ry: rnd() * 6, s: 0.8 + rnd() * 0.6 });
  }
  scene.add(grassTufts(grass), flowers(flowerPts));

  // portals at the east gate and the south gate
  for (const [x, z] of [[28, 0], [0, 27.5]]) {
    const gate = portal();
    gate.object3d.position.set(x, 0, z);
    scene.add(gate.object3d);
    animated.push({ animate: (t, cam) => gate.animate(t, cam) });
  }
  place(signpost('Pig Farm'), 4.5, 25, Math.PI);

  // NPCs
  const c = () => game.character;
  const npcs = [
    new Npc('stan', 'Chief Stan', buildNpc('stan'), -5, 5, 0.6, () => ({ lines: [
      `Welcome to Henesys, ${c().name}! I am Chief Stan.`,
      'East through the gate lies the Hunting Ground. Snails near the gate, Orange Mushrooms deep inside.',
      'Tap Attack near a monster to fight. Drink potions when your HP runs low.',
      'Monsters drop mesos. Rina, by the red house, sells potions and weapon and armor upgrades for them.',
      'At level 10, pick a job: Athena Pierce (Bowman), Dances with Balrog (Warrior), Grendel (Magician) or Dark Lord (Thief).',
    ] })),
    new Npc('mia', 'Mia', buildNpc('mia'), 6, -5, -0.8, () => ({ lines: [
      'Have you seen the Orange Mushrooms? They look cute until they bump into you!',
    ] })),
    new Npc('athena', 'Athena Pierce', buildNpc('athena'), 0, -15.5, 0, () => jobTalk('bowman', [
      'I am Athena Pierce, the Bowman Instructor.',
      'Bowmen strike from afar with Double Shot and Arrow Blow.',
    ])),
    new Npc('grendel', 'Grendel the Really Old', buildNpc('grendel'), -9, -13, 0.5, () => jobTalk('magician', [
      'I am Grendel the Really Old. I came from Ellinia to teach magic.',
      'Magicians cast Energy Bolt, Magic Claw, Heal and Thunderbolt.',
    ])),
    new Npc('darklord', 'Dark Lord', buildNpc('darklord'), 12, -6, -1.2, () => jobTalk('thief', [
      'Dark Lord. Kerning City sent me.',
      'Thieves throw Lucky Seven, strike with Double Stab, and vanish with Dark Sight.',
    ])),
    new Npc('rina', 'Rina (Shop)', buildNpc('rina'), -7, 11, 1.66, () => game.shop()),
    new Npc('balrog', 'Dances with Balrog', buildNpc('balrog'), 9, 6, -2.2, () => jobTalk('warrior', [
      'I am Dances with Balrog. I came from Perion to train warriors.',
      'Warriors fight up close with Power Strike and Slash Blast.',
    ])),
  ];
  function jobTalk(job, intro) {
    const ch = c();
    const title = { bowman: 'Bowman', warrior: 'Warrior', magician: 'Magician', thief: 'Thief' }[job];
    if (canAdvance(ch)) return { lines: [...intro, `Do you want to become a ${title}?`], choices: [{ label: `Become a ${title}`, onPick: () => game.advance(job) }] };
    if (ch.job === job) return { lines: ['Keep training. The Hunting Ground still has much to teach you.'] };
    if (ch.job !== 'beginner') return { lines: [...intro.slice(0, 1), 'You have already chosen your path.'] };
    return { lines: [...intro, `Come back when you reach level 10. You are level ${ch.level} now.`] };
  }
  for (const n of npcs) {
    n.quests = game.quests ?? null;
    n.object3d.position.y = h.heightFn(n.position.x, n.position.z) ?? 0;
    scene.add(n.object3d);
    colliders.push({ type: 'circle', x: n.position.x, z: n.position.z, r: 0.45 });
  }

  return {
    id: 'henesys', name: 'Henesys', scene, sun, colliders, heightFns,
    bounds: { minX: -HALF, maxX: HALF + 2, minZ: -HALF, maxZ: HALF },
    spawn: { x: 4, z: 10 },
    portals: [{ x: 28, z: 0, r: 1.3, to: 'hunting', arrive: { x: -33, z: 0 } }, { x: 0, z: 27.5, r: 1.3, to: 'pigfarm', arrive: { x: 0, z: -25 } }],
    npcs, mobs: null, occluders,
    animate(t, camera) { animated.forEach(a => a.animate(t, camera)); },
  };
}

/** Small seeded RNG so scatter is the same on every load. */
export function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
