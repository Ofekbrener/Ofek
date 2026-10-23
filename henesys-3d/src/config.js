// Game data tables. Values for mobs and the first 9 EXP steps are MapleStory Classic's.

export const MOBS = {
  snail:          { name: 'Snail',           level: 1, hp: 8,  exp: 3,  atk: 3,  speed: 0.8, zone: 0, mesos: [1, 5],   drops: [{ item: 'red', chance: 0.05 }] },
  blueSnail:      { name: 'Blue Snail',      level: 2, hp: 15, exp: 4,  atk: 5,  speed: 0.9, zone: 0, mesos: [2, 7],   drops: [{ item: 'red', chance: 0.06 }] },
  redSnail:       { name: 'Red Snail',       level: 4, hp: 45, exp: 8,  atk: 10, speed: 1.0, zone: 1, mesos: [4, 12],  drops: [{ item: 'red', chance: 0.08 }, { item: 'blue', chance: 0.04 }] },
  slime:          { name: 'Slime',           level: 6, hp: 50, exp: 10, atk: 12, speed: 1.4, zone: 1, mesos: [5, 15],  drops: [{ item: 'blue', chance: 0.08 }] },
  orangeMushroom: { name: 'Orange Mushroom', level: 8, hp: 80, exp: 15, atk: 18, speed: 1.6, zone: 2, mesos: [8, 20],  drops: [{ item: 'red', chance: 0.1 }, { item: 'blue', chance: 0.06 }] },
};

export const MAX_LEVEL = 30;

// EXP_TABLE[level] = EXP needed to go from `level` to `level + 1`.
export const EXP_TABLE = (() => {
  const t = [0, 15, 34, 57, 92, 135, 372, 560, 840, 1242];
  while (t.length < MAX_LEVEL) t.push(Math.round(t[t.length - 1] * 1.2));
  return t;
})();

export const JOBS = {
  beginner: { name: 'Beginner', weapon: 'club',  range: 1.6, stat: 'str', skills: ['threeSnails'] },
  bowman:   { name: 'Bowman',   weapon: 'bow',   range: 10,  stat: 'dex', skills: ['doubleShot', 'arrowBlow'] },
  warrior:  { name: 'Warrior',  weapon: 'sword', range: 2.2, stat: 'str', skills: ['powerStrike', 'slashBlast'] },
};

export const SKILLS = {
  threeSnails: { name: 'Three Snails', mp: 3,  range: 6,   hits: 1, multiplier: 1.3,  aoe: false, cooldown: 0.6 },
  doubleShot:  { name: 'Double Shot',  mp: 6,  range: 10,  hits: 2, multiplier: 0.8,  aoe: false, cooldown: 0.6 },
  arrowBlow:   { name: 'Arrow Blow',   mp: 8,  range: 10,  hits: 1, multiplier: 1.8,  aoe: false, cooldown: 0.8 },
  powerStrike: { name: 'Power Strike', mp: 6,  range: 2.4, hits: 1, multiplier: 2.0,  aoe: false, cooldown: 0.6 },
  slashBlast:  { name: 'Slash Blast',  mp: 10, range: 3.2, hits: 1, multiplier: 1.1,  aoe: true,  cooldown: 0.9 },
};

export const CRIT_CHANCE = 0.05;
export const CRIT_MULT = 1.5;
