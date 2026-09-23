// Race league data: 3 leagues × 3 tracks, the chicken rival roster, prizes and
// unlock rules linking the Race League with the Dodge journey.

export const RIVALS = [
  { id: 'nugget', name: 'Nugget', color: 0xffd23a, taunt: 'Bawk bawk, slowpoke!' },
  { id: 'colonel', name: 'Colonel Cluck', color: 0xf5f0e6, taunt: 'Secret recipe: SPEED.' },
  { id: 'eggatha', name: 'Eggatha', color: 0xff8ad8, taunt: 'Murder on the Omelette Express!' },
  { id: 'dave', name: 'Drumstick Dave', color: 0xc07a3a, taunt: 'Finger lickin\' fast!' },
  { id: 'henrietta', name: 'Henrietta Speedfeather', color: 0xa77bff, taunt: 'Feathers up, loser!' },
  { id: 'wingsworth', name: 'Sir Wingsworth', color: 0x5aa8ff, taunt: 'Tally-ho, peasant.' },
  { id: 'cogburn', name: 'Rooster Cogburn', color: 0xff4a3a, taunt: 'Cock-a-doodle-DUST!' },
  { id: 'bertha', name: 'Big Bertha', color: 0xff9a2e, taunt: 'Make way for the hen!' },
  { id: 'flash', name: 'The Kentucky Flash', color: 0xffe9a0, taunt: 'Too fast to fry.' },
];

// Track geometry is procedural from `seed`; `theme` indexes GALAXIES for colors.
// skill: rival top-speed spread within the field.
// Per track: power = recommended Ship Power (1 + total Garage levels),
// features = mechanics active on that track (each race adds one — see `intro`),
// rival = difficulty multiplier applied to rival speed/precision (career order).
export const LEAGUES = [
  {
    id: 'rookie',
    name: 'Rookie Roost Cup',
    icon: '🥉',
    baseSpeed: 40,
    prize: [120, 70, 40, 15, 10],
    rivals: ['nugget', 'dave', 'eggatha', 'bertha'],
    skill: [0.9, 0.93, 0.96, 1.0],
    tracks: [
      { id: 'coop-loop', name: 'Coop Loop', seed: 11, theme: 0, laps: 2, radius: 170, twist: 0.35, hills: 6, obstacles: 6, pads: 6 , power: 1, features: ['rocks'], intro: { icon: '🕹️', title: 'Learn to steer', text: 'Hold ◀ ▶ (or drag) to steer. Corners push you toward the wall — steer into them!' }, rival: 0.95 },
      { id: 'yolk-speedway', name: 'Yolk Speedway', seed: 23, theme: 1, laps: 2, radius: 200, twist: 0.45, hills: 10, obstacles: 8, pads: 7 , power: 2, features: ['rocks', 'boost'], intro: { icon: '⚡', title: 'NEW: Boost', text: 'Drive over boost pads to charge energy, then tap BOOST for a burst of speed.' }, rival: 1.05 },
      { id: 'scrambled', name: 'Scrambled Circuit', seed: 37, theme: 0, laps: 3, radius: 160, twist: 0.6, hills: 8, obstacles: 9, pads: 6 , power: 3, features: ['rocks', 'boost', 'items'], intro: { icon: '🥚', title: 'NEW: Egg Missiles', text: 'Grab ? boxes on the track. Tap ITEM to fire a homing egg at the racer ahead.' }, rival: 1.14 },
    ],
  },
  {
    id: 'pro',
    name: 'Pro Poultry Series',
    icon: '🥈',
    baseSpeed: 50,
    prize: [220, 130, 80, 30, 20],
    rivals: ['colonel', 'henrietta', 'cogburn', 'bertha'],
    skill: [0.92, 0.95, 0.98, 1.02],
    unlock: { galaxies: 2, trophies: 2, league: 'rookie' },
    tracks: [
      { id: 'frying-500', name: 'Frying Pan 500', seed: 51, theme: 2, laps: 2, radius: 210, twist: 0.6, hills: 12, obstacles: 11, pads: 7 , power: 4, features: ['rocks', 'boost', 'items', 'draft', 'rivalItems'], intro: { icon: '💨', title: 'NEW: Drafting', text: 'Tuck in right behind a rival to charge boost. Careful — rivals now fire eggs too!' }, rival: 1.2 },
      { id: 'frostbite', name: 'Frostbite Raceway', seed: 64, theme: 3, laps: 3, radius: 180, twist: 0.7, hills: 14, obstacles: 12, pads: 7 , power: 6, features: ['rocks', 'boost', 'items', 'draft', 'rivalItems', 'ice', 'shield'], intro: { icon: '🧊', title: 'NEW: Ice & Shields', text: 'Blue ice patches kill your grip. ? boxes can now give a Shield that blocks one hit.' }, rival: 1.26 },
      { id: 'drumstick-drift', name: 'Drumstick Drift', seed: 78, theme: 1, laps: 3, radius: 190, twist: 0.85, hills: 10, obstacles: 12, pads: 8 , power: 8, features: ['rocks', 'boost', 'items', 'draft', 'rivalItems', 'ice', 'shield', 'drift'], intro: { icon: '🌀', title: 'NEW: Drift Turbo', text: 'Hold a hard turn through a corner to charge a mini-turbo — it fires when you straighten out.' }, rival: 1.32 },
    ],
  },
  {
    id: 'grand',
    name: 'Grand Hen Prix',
    icon: '🏆',
    baseSpeed: 60,
    prize: [400, 240, 140, 50, 30],
    rivals: ['flash', 'wingsworth', 'colonel', 'henrietta'],
    skill: [0.94, 0.97, 1.0, 1.04],
    unlock: { galaxies: 4, trophies: 2, league: 'pro' },
    tracks: [
      { id: 'omelette-ring', name: 'Omelette Ring', seed: 91, theme: 4, laps: 3, radius: 220, twist: 0.8, hills: 16, obstacles: 14, pads: 8 , power: 10, features: ['rocks', 'boost', 'items', 'draft', 'rivalItems', 'ice', 'shield', 'drift', 'rollingEggs', 'mine'], intro: { icon: '💣', title: 'NEW: Rolling Eggs & Mines', text: 'Giant eggs roll across the track. ? boxes can give an Egg Mine to drop behind you.' }, rival: 1.38 },
      { id: 'feather-storm', name: 'Feather Storm GP', seed: 104, theme: 3, laps: 3, radius: 200, twist: 0.95, hills: 18, obstacles: 15, pads: 8 , power: 12, features: ['rocks', 'boost', 'items', 'draft', 'rivalItems', 'ice', 'shield', 'drift', 'rollingEggs', 'mine', 'wells', 'chicanes'], intro: { icon: '🌌', title: 'NEW: Gravity Wells', text: 'Purple wells tug your ship sideways, and chicanes squeeze the track. Stay sharp!' }, rival: 1.44 },
      { id: 'mother-gp', name: 'Mother Hen Grand Prix', seed: 127, theme: 4, laps: 3, radius: 240, twist: 1.05, hills: 20, obstacles: 16, pads: 9 , power: 15, features: ['rocks', 'boost', 'items', 'draft', 'rivalItems', 'ice', 'shield', 'drift', 'rollingEggs', 'mine', 'wells', 'chicanes', 'motherHen'], intro: { icon: '🐔', title: 'FINAL: The Mother Hen', text: 'The Supreme Mother Hen hovers over the track dropping eggs. Everything you have learned — now!' }, rival: 1.5 },
    ],
  },
];

// Race Garage upgrades (bought with drumsticks earned in the Dodge journey).
export const RACE_UPGRADES = [
  { id: 'engine', name: 'Hyper Engine', icon: '⚙️', max: 5, base: 70, desc: (l) => `+${l * 9}% top speed` },
  { id: 'accel', name: 'Afterburners', icon: '🔥', max: 5, base: 55, desc: (l) => `+${l * 15}% acceleration` },
  { id: 'grip', name: 'Gravity Grip', icon: '🧲', max: 5, base: 60, desc: (l) => `${l * 14}% less drift in corners` },
  { id: 'tank', name: 'Boost Tank', icon: '⚡', max: 5, base: 65, desc: (l) => `+${l * 20}% boost power & charge` },
  { id: 'armor', name: 'Egg-Proof Armor', icon: '🛡️', max: 3, base: 80, desc: (l) => `${l * 30}% faster recovery from crashes` },
];

// Galaxy i needs this many race trophies (podium finishes) to be launched.
export const GALAXY_TROPHY_REQ = [1, 2, 4, 6, 8];

// The 9 races in career order (race N+1 unlocks with a podium in race N).
export const CAREER = LEAGUES.flatMap((lg) => lg.tracks.map((t) => ({ league: lg, track: t })));
export const careerIndex = (trackId) => CAREER.findIndex((c) => c.track.id === trackId);

export const RACE_QUIPS = {
  win: ['WINNER WINNER, CHICKEN DINNER!', 'FIRST PLACE!', 'FEATHERS IN THE DUST!'],
  podium: ['ON THE PODIUM!', 'NOT BAD, PILOT!'],
  lose: ['OUT-CLUCKED!', 'EGG ON YOUR FACE!', 'BETTER LUCK NEXT HATCH'],
};

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function findTrack(trackId) {
  for (const lg of LEAGUES) {
    const i = lg.tracks.findIndex((t) => t.id === trackId);
    if (i >= 0) return { league: lg, track: lg.tracks[i], index: i };
  }
  return null;
}
