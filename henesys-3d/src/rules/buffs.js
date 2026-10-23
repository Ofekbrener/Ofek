// Timed buffs (Rage, Focus, Haste, Dark Sight). Stored on the character as
// { id: expiresAt } using the game clock in seconds. Pure.
import { SKILLS } from '../config.js';

export function applyBuff(c, id, now) {
  c.buffs ??= {};
  c.buffs[id] = now + SKILLS[id].duration;
}

export function endBuff(c, id) { if (c.buffs) delete c.buffs[id]; }

export function activeBuffs(c, now) {
  return Object.entries(c.buffs ?? {}).filter(([, until]) => until > now).map(([id, until]) => ({ id, left: until - now }));
}

export function modifiers(c, now) {
  const m = { dmg: 1, crit: 0, speed: 1, hidden: false };
  for (const { id } of activeBuffs(c, now)) {
    const e = SKILLS[id].effect ?? {};
    if (e.dmg) m.dmg *= e.dmg;
    if (e.crit) m.crit += e.crit;
    if (e.speed) m.speed *= e.speed;
    if (e.hidden) m.hidden = true;
  }
  return m;
}
