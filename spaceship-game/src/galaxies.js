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
    colors: { floor: 0x3cf2ff, lane: 0xff3ca8, horizon: 0x6a2cff, bg: 0x05060f, sky: 0x8fb8ff, rim: 0xff3ca8, star: 0xbfd6ff },
    planet: { a: 0x2fd6c3, b: 0x1b2f7a, ring: 0xff9ad5, x: -70, y: 36, size: 30 },
    hazards: { rocks: 1, cluster: 1, wall: 0.5, flock: 1.1, bombers: 0.6, barrier: 0, drifter: 0, bigEgg: 0, comet: 0, laser: 0, ice: 0, well: 0 },
    speed: [24, 33],
    spawn: [1.0, 0.78],
    music: { transpose: 0, bpm: 114 },
    boss: {
      name: 'BIG HEN', title: 'Mother of the Coop', hp: 6, color: 0xf7f3ea, prop: 'none',
      attacks: ['fan', 'summon', 'fan', 'throw'], tempo: 1,
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
    hazards: { rocks: 1, cluster: 1, wall: 1, flock: 0.8, bombers: 0.9, barrier: 0.4, drifter: 0.3, bigEgg: 1.2, comet: 0, laser: 0, ice: 0, well: 0 },
    speed: [28, 38],
    spawn: [0.9, 0.7],
    music: { transpose: 3, bpm: 120 },
    boss: {
      name: 'THE EGGSECUTIONER', title: 'UFO of Unusual Size', hp: 7, color: 0xffe9a8, prop: 'ufo',
      attacks: ['fan', 'laser', 'summon', 'fan'], tempo: 1.1,
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
    hazards: { rocks: 0.8, cluster: 0.8, wall: 0.8, flock: 1, bombers: 0.8, barrier: 0.6, drifter: 0.5, bigEgg: 0.5, comet: 1.3, laser: 1.1, ice: 0, well: 0 },
    speed: [31, 42],
    spawn: [0.82, 0.62],
    music: { transpose: 5, bpm: 126 },
    boss: {
      name: 'CHEF CLUCKINGTON', title: 'Master of the Flying Pan', hp: 8, color: 0xfff6ee, prop: 'chef',
      attacks: ['throw', 'laser', 'fan', 'summon', 'throw'], tempo: 1.2,
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
    hazards: { rocks: 0.6, cluster: 0.6, wall: 0.8, flock: 1, bombers: 1.2, barrier: 0.5, drifter: 0.6, bigEgg: 0.5, comet: 0.4, laser: 0.6, ice: 1.4, well: 0 },
    speed: [34, 46],
    spawn: [0.75, 0.56],
    music: { transpose: -2, bpm: 132 },
    boss: {
      name: 'ROOSTER FROST', title: 'The Cold-Blooded Cockerel', hp: 9, color: 0xe6f7ff, prop: 'ice',
      attacks: ['fan', 'throw', 'laser', 'summon', 'fan'], tempo: 1.3,
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
    hazards: { rocks: 0.7, cluster: 0.7, wall: 0.9, flock: 1.1, bombers: 1, barrier: 0.6, drifter: 0.6, bigEgg: 0.7, comet: 0.7, laser: 0.8, ice: 0.6, well: 1.2 },
    speed: [37, 50],
    spawn: [0.7, 0.5],
    music: { transpose: 1, bpm: 138 },
    boss: {
      name: 'THE SUPREME MOTHER HEN', title: 'Empress of the Omelette Core', hp: 10, color: 0xfff0f6, prop: 'crown',
      attacks: ['fan', 'laser', 'summon', 'throw', 'fan', 'laser'], tempo: 1.4,
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
