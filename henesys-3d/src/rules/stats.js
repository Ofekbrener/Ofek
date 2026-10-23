// Character stats, levelling and damage. Pure: no Three.js, no DOM.
import { normalizeLook } from './appearance.js';
import { EXP_TABLE, MAX_LEVEL, JOBS, SKILLS, CRIT_CHANCE, CRIT_MULT, MOBS, EXP_MULT } from '../config.js';

const BASE_STAT = 12;

export function newCharacter(name, look) {
  return {
    name, look: normalizeLook(look), level: 1, exp: 0, job: 'beginner',
    str: BASE_STAT, dex: 5, int: 4, luk: 4,
    hp: 50, maxHp: 50, mp: 5, maxMp: 5,
    mesos: 0, potions: { red: 5, blue: 5 },
  };
}

function levelUp(c) {
  c.level += 1;
  c.maxHp += { warrior: 20, magician: 8 }[c.job] ?? 12;
  c.maxMp += { magician: 14, bowman: 10, thief: 8 }[c.job] ?? 6;
  const stat = JOBS[c.job].stat;
  c[stat] = (c[stat] ?? 4) + 5;
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
  const max = Math.max(1, Math.round(((c[JOBS[c.job].stat] ?? 4) + c.level * 2) * mult));
  return [Math.max(1, Math.round(max * 0.6)), max];
}

/** mods: { dmg, crit } from buffs (rules/buffs.js modifiers). */
export function rollDamage(c, skillId, rng = Math.random, mods = { dmg: 1, crit: 0 }) {
  const [min, max] = damageRange(c, skillId);
  const crit = rng() < CRIT_CHANCE + (mods.crit ?? 0);
  const base = (min + Math.floor(rng() * (max - min + 1))) * (mods.dmg ?? 1);
  return { amount: Math.max(1, Math.round(crit ? base * CRIT_MULT : base)), crit };
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
  const stat = JOBS[job].stat;
  if (stat !== 'str') {
    c[stat] = (c[stat] ?? 4) + c.str - BASE_STAT;
    c.str = BASE_STAT;
  }
  return true;
}

export const killExp = mobId => MOBS[mobId].exp * EXP_MULT;

/** Why a skill can or cannot fire now. cooldowns: { skillId: readyAtTime }. */
export function skillState(c, id, now, cooldowns = {}) {
  const s = SKILLS[id];
  if (!s || s.job !== c.job) return { ok: false, reason: 'job' };
  if (c.level < s.level) return { ok: false, reason: 'locked' };
  if ((cooldowns[id] ?? -Infinity) > now) return { ok: false, reason: 'cooldown' };
  if (c.mp < s.mp) return { ok: false, reason: 'mp' };
  return { ok: true };
}
