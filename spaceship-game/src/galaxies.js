// The campaign: five galaxies overrun by space hens. Each galaxy defines its
// look, hazard mix, difficulty band, music and boss.
//
// hazards: relative spawn weights for the wave director (journey.js)
//   rocks, cluster, wall, barrier, drifter  — classic debris
//   flock   — chicken formations flying at ship height
//   bombers — high-flying hens that drop eggs (eggs crack into fried-egg puddles)
//   bigEgg  — giant rolling eggs
//   comet   — fast flaming rocks on diagonal paths
//   laser   — grill-laser fences
//   ice     — ice-shard fields
//   well    — gravity wells that tug the ship

export const GALAXIES = [
  {
    id: 'coop',
    name: 'Coop Nebula',
    tagline: 'Where the feathers first flew',
    colors: { floor: 0x8cc152, lane: 0xffd23a, horizon: 0xffc78a, bg: 0x2c6fb8, sky: 0xcfe8ff, rim: 0xffb070, star: 0xffffff },
    planet: { a: 0x2fd6c3, b: 0x1b2f7a, ring: 0xff9ad5, x: -70, y: 36, size: 30 },
    // Whole-scene look (worlds.js / environment.js / lighting.js). `style` picks
    // the floor pattern, hero backdrop and weather shape; the rest is tweened.
    world: {
      style: 0,
      sky: { top: 0x2a5fa8, horizon: 0xffc58a, bottom: 0xf6b77a, neb1: 0xffffff, neb2: 0xffd9b0, sun: 0xfff1c0, density: 0.32, scale: 1.0, rays: 0.0, scan: 0.0 },
      fog: { color: 0xf3c08e, near: 50, far: 150 },
      floor: { ground: 0x4a6b2c, alpha: 0.97 },
      hero: { x: 22, y: 64, size: 44, asp: 1.9, a: 0xd8362c, b: 0xffcf5a, c: 0xfff1c0 },
      props: [
        { kind: 'hay', count: 14, x: [5.4, 11], y: [0, 0], s: [0.85, 1.35] },
        { kind: 'fence', count: 10, x: [4.9, 6.2], y: [0, 0], s: [0.9, 1.1] },
      ],
      weather: { color: 0xfff6ea, color2: 0xffc6e8, size: 2.4, wind: [0.4, -0.5, 0], sway: 0.9, alpha: 0.8 },
      light: { sky: 0xd6ecff, ground: 0x6a8a3a, hemi: 1.5, key: 0xfff0d8, keyI: 2.4, rim: 0xffb070, rimI: 1.0 },
    },
    hazards: { rocks: 1, cluster: 0.7, wall: 0, flock: 0.8, bombers: 0.3, barrier: 0, drifter: 0, bigEgg: 0, comet: 0, laser: 0, ice: 0, well: 0 },
    speed: [18, 24],
    spawn: [1.4, 1.1],
    waves: 3,
    orbPerWave: true,
    music: { transpose: 0, bpm: 114 },
    boss: {
      name: 'BIG HEN', title: 'Mother of the Coop', hp: 4, color: 0xf7f3ea, prop: 'none',
      attacks: ['lay', 'fan', 'lay', 'rain'], tempo: 0.8,
    },
    briefing: 'Intel reports hens massing around the Coop Nebula. They look... peckish. Dodge their eggs, grab the drumsticks, and bring a napkin.',
    bossQuip: 'She laid a trap. Literally.',
  },
  {
    id: 'yolk',
    name: 'Yolk Belt',
    tagline: 'An asteroid field, sunny side up',
    colors: { floor: 0xffc23c, lane: 0xff6a3c, horizon: 0xff8a1f, bg: 0x0d0804, sky: 0xffd9a0, rim: 0xff7a2f, star: 0xffe2b0 },
    planet: { a: 0xffd35c, b: 0xb3541e, ring: 0xfff1c9, x: 80, y: 30, size: 36 },
    world: {
      style: 1,
      sky: { top: 0x2a1004, horizon: 0xffa23c, bottom: 0x2a1406, neb1: 0xffd35c, neb2: 0xff6a2f, sun: 0xffe08a, density: 0.38, scale: 0.8, rays: 1.0, scan: 0.0 },
      fog: { color: 0x7a3c14, near: 40, far: 135 },
      floor: { ground: 0x201004, alpha: 0.6 },
      hero: { x: 14, y: 60, size: 46, asp: 1.8, a: 0xffc21f, b: 0xff7a14, c: 0xffe9b0 },
      props: [
        { kind: 'eggshell', count: 14, x: [7, 18], y: [2.5, 10], s: [0.9, 1.8], spin: 1 },
        { kind: 'eggrock', count: 12, x: [7.5, 16], y: [3, 9], s: [0.6, 1.3], spin: 1 },
      ],
      weather: { color: 0xffd98a, color2: 0xffffff, size: 1.8, wind: [0.3, 0.15, 0], sway: 0.35, alpha: 0.9 },
      light: { sky: 0xffd9a0, ground: 0x6a3410, hemi: 1.5, key: 0xfff0cc, keyI: 2.4, rim: 0xff7a2f, rimI: 1.4 },
    },
    hazards: { rocks: 1, cluster: 1, wall: 1, flock: 0.8, bombers: 0.9, barrier: 0.4, drifter: 0.3, bigEgg: 1.2, comet: 0, laser: 0, ice: 0, well: 0 },
    speed: [24, 33],
    spawn: [1.05, 0.82],
    music: { transpose: 3, bpm: 120 },
    boss: {
      name: 'THE EGGSECUTIONER', title: 'UFO of Unusual Size', hp: 7, color: 0xffe9a8, prop: 'ufo',
      attacks: ['lay', 'fan', 'rain', 'lay', 'laser'], tempo: 1.1,
    },
    briefing: 'The Yolk Belt is paved with giant eggs rolling at ludicrous speed. Our scientists say "don\'t get scrambled". Very helpful, scientists.',
    bossQuip: 'Abducted. By poultry.',
  },
  {
    id: 'pan',
    name: 'Frying-Pan Cluster',
    tagline: 'Things are heating up',
    colors: { floor: 0xff5a2c, lane: 0xffd23a, horizon: 0xff2a1f, bg: 0x100504, sky: 0xffb08f, rim: 0xff3c1f, star: 0xffc2a8 },
    planet: { a: 0xff7a2f, b: 0x5a0e0e, ring: 0xffd23a, x: -85, y: 26, size: 40 },
    world: {
      style: 2,
      sky: { top: 0x0e0202, horizon: 0xff3a12, bottom: 0x1e0502, neb1: 0x5a140a, neb2: 0xff5a1f, sun: 0xff8a2a, density: 0.72, scale: 1.3, rays: 0.0, scan: 0.0 },
      fog: { color: 0x4a0e06, near: 32, far: 120 },
      floor: { ground: 0x0c0302, alpha: 0.7 },
      hero: { x: 12, y: 62, size: 44, asp: 1.8, a: 0xff8a1f, b: 0xc8200a, c: 0xffd23a },
      props: [
        { kind: 'spatula', count: 10, x: [6, 12], y: [0, 0], s: [1.0, 1.5] },
        { kind: 'flame', count: 12, x: [4.9, 9], y: [0, 0], s: [0.8, 1.3] },
      ],
      weather: { color: 0xff8a2a, color2: 0xffd23a, size: 1.5, wind: [0.2, 2.2, 0], sway: 0.6, alpha: 1.0 },
      light: { sky: 0xffa080, ground: 0x6a1008, hemi: 1.3, key: 0xffc8a0, keyI: 2.0, rim: 0xff3c1f, rimI: 2.0 },
    },
    hazards: { rocks: 0.8, cluster: 0.8, wall: 0.8, flock: 1, bombers: 0.8, barrier: 0.6, drifter: 0.5, bigEgg: 0.5, comet: 1.3, laser: 1.1, ice: 0, well: 0 },
    speed: [28, 38],
    spawn: [0.9, 0.7],
    music: { transpose: 5, bpm: 126 },
    boss: {
      name: 'CHEF CLUCKINGTON', title: 'Master of the Flying Pan', hp: 8, color: 0xfff6ee, prop: 'chef',
      attacks: ['lay', 'throw', 'rain', 'fan', 'laser', 'lay'], tempo: 1.2,
    },
    briefing: 'Chef Cluckington runs the hottest kitchen in the galaxy — grill lasers, flaming comets, flying pans. Whatever you do, do NOT become the special of the day.',
    bossQuip: 'Order up!',
  },
  {
    id: 'frost',
    name: 'Frostfeather Expanse',
    tagline: 'Chill out... or get frozen',
    colors: { floor: 0x7ae8ff, lane: 0xc9f6ff, horizon: 0x3c7bff, bg: 0x040a12, sky: 0xd4f3ff, rim: 0x7a9bff, star: 0xe4f6ff },
    planet: { a: 0xd8f6ff, b: 0x2a5bbf, ring: 0xaee9ff, x: 70, y: 40, size: 34 },
    world: {
      style: 3,
      sky: { top: 0x010512, horizon: 0x2f78e8, bottom: 0x0e2240, neb1: 0x7ae8ff, neb2: 0x9a7bff, sun: 0xc9f6ff, density: 0.3, scale: 0.9, rays: 0.0, scan: 0.0 },
      fog: { color: 0x2a5490, near: 40, far: 150 },
      floor: { ground: 0x1e3c66, alpha: 0.6 },
      hero: { x: 0, y: 66, size: 50, asp: 2.4, a: 0x4dffb0, b: 0xa77bff, c: 0x9fe6ff },
      props: [
        { kind: 'spire', count: 14, x: [6, 14], y: [0, 0], s: [0.8, 1.6] },
        { kind: 'crystal', count: 12, x: [4.9, 8], y: [0, 0], s: [0.6, 1.1] },
      ],
      weather: { color: 0xffffff, color2: 0xcfefff, size: 1.9, wind: [-0.8, -2.0, 0], sway: 0.7, alpha: 0.9 },
      light: { sky: 0xd4f3ff, ground: 0x2a4a7a, hemi: 1.6, key: 0xe8f6ff, keyI: 2.3, rim: 0x7a9bff, rimI: 1.4 },
    },
    hazards: { rocks: 0.6, cluster: 0.6, wall: 0.8, flock: 1, bombers: 1.2, barrier: 0.5, drifter: 0.6, bigEgg: 0.5, comet: 0.4, laser: 0.6, ice: 1.4, well: 0 },
    speed: [31, 42],
    spawn: [0.82, 0.62],
    music: { transpose: -2, bpm: 132 },
    boss: {
      name: 'ROOSTER FROST', title: 'The Cold-Blooded Cockerel', hp: 9, color: 0xe6f7ff, prop: 'ice',
      attacks: ['lay', 'rain', 'fan', 'laser', 'throw', 'lay'], tempo: 1.3,
    },
    briefing: 'An egg blizzard blankets the Frostfeather Expanse. Ice shards everywhere. Rooster Frost waits at the end. He does not do mornings.',
    bossQuip: 'Cock-a-doodle-BRRR.',
  },
  {
    id: 'core',
    name: 'Omelette Core',
    tagline: 'The heart of the hen empire',
    colors: { floor: 0xb04bff, lane: 0xff2a5c, horizon: 0xff1f7a, bg: 0x09030f, sky: 0xe0a8ff, rim: 0xff2a5c, star: 0xf0c8ff },
    planet: { a: 0xff4fa0, b: 0x2a0a4a, ring: 0xffd35c, x: -60, y: 44, size: 48 },
    world: {
      style: 4,
      sky: { top: 0x080112, horizon: 0xe8187a, bottom: 0x14021c, neb1: 0xb04bff, neb2: 0xff2a5c, sun: 0xff6ad0, density: 0.6, scale: 1.1, rays: 0.0, scan: 1.0 },
      fog: { color: 0x3a0840, near: 40, far: 135 },
      floor: { ground: 0x0a0214, alpha: 0.6 },
      hero: { x: 10, y: 66, size: 54, asp: 1.7, a: 0x7a3cff, b: 0xff3cae, c: 0x5af2ff },
      props: [
        { kind: 'pylon', count: 12, x: [5.4, 6.4], y: [0, 0], s: [0.9, 1.2] },
        { kind: 'block', count: 10, x: [7, 13], y: [0, 3], s: [0.8, 1.4], spin: 0.3 },
      ],
      weather: { color: 0xff5ad8, color2: 0x5af2ff, size: 2.2, wind: [1.2, 1.6, 0], sway: 0.25, alpha: 1.0 },
      light: { sky: 0xe0a8ff, ground: 0x2a0a4a, hemi: 1.4, key: 0xffe6ff, keyI: 2.1, rim: 0xff2a5c, rimI: 1.8 },
    },
    hazards: { rocks: 0.7, cluster: 0.7, wall: 0.9, flock: 1.1, bombers: 1, barrier: 0.6, drifter: 0.6, bigEgg: 0.7, comet: 0.7, laser: 0.8, ice: 0.6, well: 1.2 },
    speed: [34, 46],
    spawn: [0.76, 0.56],
    music: { transpose: 1, bpm: 138 },
    boss: {
      name: 'THE SUPREME MOTHER HEN', title: 'Empress of the Omelette Core', hp: 10, color: 0xfff0f6, prop: 'crown',
      attacks: ['lay', 'rain', 'fan', 'laser', 'throw', 'lay', 'summon'], tempo: 1.4,
    },
    briefing: 'This is it. The Supreme Mother Hen commands the entire flock from the Omelette Core, surrounded by gravity wells. End this, pilot. The universe is counting on you. Also, lunch.',
    bossQuip: 'You can\'t make an omelette without breaking a few hens.',
  },
];

export const WAVES_PER_GALAXY = 4;
export const WAVE_DURATION = 24;      // world-seconds per wave
export const ENDLESS_BOSS_EVERY = 5;  // endless: every 5th wave is a boss

export const QUIPS = {
  gameOver: ['YOU GOT EGGED!', 'SCRAMBLED!', 'FOWL PLAY!', 'OMELETTE\'D!', 'FRIED!', 'CLUCKED UP!'],
  waveClear: ['Nice flying!', 'Feathers ruffled.', 'The hens are furious.', 'Not a single scratch? Eggcellent.', 'Keep it clucking!', 'Poultry-geist averted.'],
  victory: ['GALAXY LIBERATED!', 'HENS ROUTED!', 'COOP DE GRÂCE!'],
  shield: ['SHIELD SAVED YOU', 'NOT TODAY, HEN', 'CLOSE CALL!'],
};

export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
