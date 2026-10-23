// Character stats, levelling and damage. Pure: no Three.js, no DOM.
import { normalizeLook } from './appearance.js';
import { EXP_TABLE, MAX_LEVEL, JOBS, SKILLS, CRIT_CHANCE, CRIT_MULT, MOBS, EXP_MULT } from '../config.js';

const BASE_STAT = 12;

export function newCharacter(name, look) {
  return {
    name, look: normalizeLook(look), level: 1, exp: 0, job: 'beginner',
    str: BASE_STAT, dex: 5,
    hp: 50, maxHp: 50, mp: 5, maxMp: 5,
    mesos: 0, potions: { red: 5, blue: 5 },
  };
}

function levelUp(c) {
  c.level += 1;
  c.maxHp += c.job === 'warrior' ? 20 : 12;
  c.maxMp += c.job === 'bowman' ? 10 : 6;
  c[JOBS[c.job].stat] += 5;
  c.hp = c.maxHp;
  c.mp = c.maxMp;
}

export function gainExp(c, amount) {
  let levelsGained = 0;
  if (c.level >= MAX_LEVEL) return { levelsGained };
  c.exp += amount;
  while (c.level < MAX_LEVEL && c.exp >= EXP_TABLE[c.level]) {
    c.exp -= EXP_TABLE[c.level];
    levelUp(c);
    levelsGained++;
  }
  if (c.level >= MAX_LEVEL) c.exp = 0;
  return { levelsGained };
}

export function damageRange(c, skillId) {
  const mult = skillId ? SKILLS[skillId].multiplier : 1;
  const max = Math.max(1, Math.round((c[JOBS[c.job].stat] + c.level * 2) * mult));
  return [Math.max(1, Math.round(max * 0.6)), max];
}

export function rollDamage(c, skillId, rng = Math.random) {
  const [min, max] = damageRange(c, skillId);
  const crit = rng() < CRIT_CHANCE;
  const base = min + Math.floor(rng() * (max - min + 1));
  return { amount: crit ? Math.round(base * CRIT_MULT) : base, crit };
}

export function deathPenalty(c) {
  const lost = Math.floor(c.exp * 0.1);
  c.exp -= lost;
  return lost;
}

export const canAdvance = c => c.level >= 10 && c.job === 'beginner';

// Points auto-assigned to STR while a Beginner move to the new job's stat.
export function advance(c, job) {
  if (!canAdvance(c) || !JOBS[job]) return false;
  c.job = job;
  if (JOBS[job].stat === 'dex') {
    c.dex += c.str - BASE_STAT;
    c.str = BASE_STAT;
  }
  return true;
}

export const killExp = mobId => MOBS[mobId].exp * EXP_MULT;
