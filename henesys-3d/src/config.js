// Game data tables. Values for mobs and the first 9 EXP steps are MapleStory Classic's.

export const MOBS = {
  snail:          { name: 'Snail',           level: 1, hp: 8,  exp: 3,  atk: 3,  speed: 0.8, zone: 0, mesos: [1, 5],   drops: [{ item: 'red', chance: 0.05 }] },
  blueSnail:      { name: 'Blue Snail',      level: 2, hp: 15, exp: 4,  atk: 5,  speed: 0.9, zone: 0, mesos: [2, 7],   drops: [{ item: 'red', chance: 0.06 }] },
  redSnail:       { name: 'Red Snail',       level: 4, hp: 45, exp: 8,  atk: 10, speed: 1.0, zone: 1, mesos: [4, 12],  drops: [{ item: 'red', chance: 0.08 }, { item: 'blue', chance: 0.04 }] },
  slime:          { name: 'Slime',           level: 6, hp: 50, exp: 10, atk: 12, speed: 1.4, zone: 1, mesos: [5, 15],  drops: [{ item: 'blue', chance: 0.08 }] },
  orangeMushroom: { name: 'Orange Mushroom', level: 8, hp: 80, exp: 15, atk: 18, speed: 1.6, zone: 2, mesos: [8, 20],  drops: [{ item: 'red', chance: 0.1 }, { item: 'blue', chance: 0.06 }] },

  pig:            { name: 'Pig',             level: 7,  hp: 70,   exp: 3,  atk: 16, speed: 2.0, mesos: [6, 16],    drops: [{ item: 'red', chance: 0.1 }] },
  ribbonPig:      { name: 'Ribbon Pig',      level: 10, hp: 120,  exp: 5,  atk: 22, speed: 2.2, mesos: [9, 22],    drops: [{ item: 'red', chance: 0.1 }, { item: 'blue', chance: 0.05 }] },
  stump:          { name: 'Stump',           level: 10, hp: 150,  exp: 5,  atk: 24, speed: 0.9, mesos: [10, 24],   drops: [{ item: 'blue', chance: 0.08 }] },
  greenMushroom:  { name: 'Green Mushroom',  level: 15, hp: 250,  exp: 7,  atk: 34, speed: 1.6, mesos: [15, 35],   drops: [{ item: 'red', chance: 0.1 }, { item: 'blue', chance: 0.08 }] },
  hornyMushroom:  { name: 'Horny Mushroom',  level: 22, hp: 450,  exp: 11, atk: 48, speed: 1.8, mesos: [25, 55],   drops: [{ item: 'red', chance: 0.12 }, { item: 'blue', chance: 0.1 }] },
  skeletonMinion: { name: 'Skeleton Minion', level: 25, hp: 900,  exp: 15, atk: 60, speed: 1.8, mesos: [40, 80],   drops: [{ item: 'red', chance: 0.12 }, { item: 'blue', chance: 0.1 }] },
  skeletonWarrior:{ name: 'Skeleton Warrior',level: 28, hp: 1300, exp: 20, atk: 75, speed: 1.6, mesos: [55, 110],  drops: [{ item: 'red', chance: 0.15 }, { item: 'blue', chance: 0.1 }] },
  skeletonMage:   { name: 'Skeleton Mage',   level: 30, hp: 1100, exp: 23, atk: 70, speed: 1.4, ranged: true, mesos: [60, 120],  drops: [{ item: 'red', chance: 0.12 }, { item: 'blue', chance: 0.15 }] },
};

export const MAX_LEVEL = 30;

// EXP_TABLE[level] = EXP needed to go from `level` to `level + 1`.
export const EXP_TABLE = (() => {
  const t = [0, 15, 34, 57, 92, 135, 372, 560, 840, 1242];
  while (t.length < MAX_LEVEL) t.push(Math.round(t[t.length - 1] * 1.2));
  return t;
})();

// weapon: which KayKit weapon and attack animation family the job uses.
export const JOBS = {
  beginner: { name: 'Beginner', weapon: 'knife',  range: 1.6, stat: 'str', skills: ['threeSnails'] },
  warrior:  { name: 'Warrior',  weapon: 'sword',  range: 2.2, stat: 'str', skills: ['powerStrike', 'slashBlast', 'rage', 'spin'] },
  magician: { name: 'Magician', weapon: 'staff',  range: 2.0, stat: 'int', skills: ['energyBolt', 'magicClaw', 'heal', 'thunderbolt'] },
  bowman:   { name: 'Bowman',   weapon: 'bow',    range: 10,  stat: 'dex', skills: ['doubleShot', 'arrowBlow', 'focus', 'arrowRain'] },
  thief:    { name: 'Thief',    weapon: 'daggers', range: 1.9, stat: 'luk', skills: ['luckySeven', 'doubleStab', 'haste', 'darkSight'] },
};

// kind: melee | projectile | aoe (around the player) | rain (around the target) | buff | heal
export const SKILLS = {
  threeSnails: { name: 'Three Snails', short: 'Snail',   job: 'beginner', level: 1,  kind: 'projectile', mp: 3,  cooldown: 0.6, range: 6,   hits: 1, multiplier: 1.3 },

  powerStrike: { name: 'Power Strike', short: 'Power',   job: 'warrior',  level: 10, kind: 'melee',      mp: 5,  cooldown: 0.6, range: 2.4, hits: 1, multiplier: 2.2 },
  slashBlast:  { name: 'Slash Blast',  short: 'Slash',   job: 'warrior',  level: 13, kind: 'aoe',        mp: 9,  cooldown: 0.9, range: 3.4, hits: 1, multiplier: 1.3 },
  rage:        { name: 'Rage',         short: 'Rage',    job: 'warrior',  level: 16, kind: 'buff',       mp: 12, cooldown: 1,   duration: 30, effect: { dmg: 1.25 } },
  spin:        { name: 'Spin',         short: 'Spin',    job: 'warrior',  level: 20, kind: 'aoe',        mp: 16, cooldown: 1.6, range: 3.6, hits: 3, multiplier: 0.9 },

  energyBolt:  { name: 'Energy Bolt',  short: 'Bolt',    job: 'magician', level: 10, kind: 'projectile', mp: 4,  cooldown: 0.5, range: 9,   hits: 1, multiplier: 1.9 },
  magicClaw:   { name: 'Magic Claw',   short: 'Claw',    job: 'magician', level: 13, kind: 'projectile', mp: 7,  cooldown: 0.6, range: 8,   hits: 2, multiplier: 1.25 },
  heal:        { name: 'Heal',         short: 'Heal',    job: 'magician', level: 16, kind: 'heal',       mp: 14, cooldown: 1.5 },
  thunderbolt: { name: 'Thunderbolt',  short: 'Thunder', job: 'magician', level: 20, kind: 'aoe',        mp: 18, cooldown: 1.4, range: 7,   hits: 1, multiplier: 1.7 },

  doubleShot:  { name: 'Double Shot',  short: 'Double',  job: 'bowman',   level: 10, kind: 'projectile', mp: 5,  cooldown: 0.6, range: 10,  hits: 2, multiplier: 0.9 },
  arrowBlow:   { name: 'Arrow Blow',   short: 'Blow',    job: 'bowman',   level: 13, kind: 'projectile', mp: 8,  cooldown: 0.8, range: 11,  hits: 1, multiplier: 2.0 },
  focus:       { name: 'Focus',        short: 'Focus',   job: 'bowman',   level: 16, kind: 'buff',       mp: 12, cooldown: 1,   duration: 30, effect: { crit: 0.2 } },
  arrowRain:   { name: 'Arrow Rain',   short: 'Rain',    job: 'bowman',   level: 20, kind: 'rain',       mp: 18, cooldown: 1.6, range: 12,  hits: 3, multiplier: 0.8, radius: 3.2 },

  luckySeven:  { name: 'Lucky Seven',  short: 'Lucky7',  job: 'thief',    level: 10, kind: 'projectile', mp: 5,  cooldown: 0.5, range: 8,   hits: 2, multiplier: 1.0 },
  doubleStab:  { name: 'Double Stab',  short: 'Stab',    job: 'thief',    level: 13, kind: 'melee',      mp: 6,  cooldown: 0.5, range: 2.0, hits: 2, multiplier: 1.15 },
  haste:       { name: 'Haste',        short: 'Haste',   job: 'thief',    level: 16, kind: 'buff',       mp: 10, cooldown: 1,   duration: 30, effect: { speed: 1.4 } },
  darkSight:   { name: 'Dark Sight',   short: 'Dark',    job: 'thief',    level: 20, kind: 'buff',       mp: 14, cooldown: 1,   duration: 8,  effect: { hidden: true } },
};
for (const s of Object.values(SKILLS)) s.aoe = s.kind === 'aoe' || s.kind === 'rain';

// Kills pay EXP_MULT times the classic values, like a permanent 4x EXP event.
export const EXP_MULT = 4;

export const CRIT_CHANCE = 0.05;
export const CRIT_MULT = 1.5;

// Which voice each monster family uses when it is hit or defeated (assets/sfx/mob_*.mp3).
export const MOB_VOICE = {
  snail: 'mob_snail', blueSnail: 'mob_snail', redSnail: 'mob_snail', slime: 'mob_slime',
  orangeMushroom: 'mob_mushroom', greenMushroom: 'mob_mushroom', hornyMushroom: 'mob_mushroom',
  pig: 'mob_pig', ribbonPig: 'mob_pig', stump: 'mob_stump',
  skeletonMinion: 'mob_skeleton', skeletonWarrior: 'mob_skeleton', skeletonMage: 'mob_skeleton',
};
