// Loot rolled when a mob dies. Pure.
import { MOBS } from '../config.js';

export function rollDrops(mobId, rng = Math.random) {
  const mob = MOBS[mobId];
  const [lo, hi] = mob.mesos;
  const out = [{ kind: 'mesos', amount: lo + Math.floor(rng() * (hi - lo + 1)) }];
  for (const d of mob.drops) if (rng() < d.chance) out.push({ kind: 'potion', item: d.item });
  return out;
}
