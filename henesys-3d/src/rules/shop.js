// Rina's shop in Henesys: potions for mesos, and five upgrade tiers each for
// weapon (+15% damage per tier) and armor (+15% max HP when bought). Pure.

export const POTION_PRICE = { red: 50, blue: 100 };
export const UPGRADE_PRICE = [300, 1500, 5000, 12000, 30000];
export const TIER_BONUS = 0.15;
export const MAX_TIER = UPGRADE_PRICE.length;

export const gearTier = (c, slot) => c.gear?.[slot] ?? 0;
/** Price of the next tier, or null at the top tier. */
export const upgradePrice = (c, slot) => UPGRADE_PRICE[gearTier(c, slot)] ?? null;
/** Damage multiplier from the weapon tier. */
export const weaponMult = c => 1 + TIER_BONUS * gearTier(c, 'weapon');

export function buyPotion(c, kind, qty = 1) {
  const cost = POTION_PRICE[kind] * qty;
  if (!cost || qty < 1) return { ok: false, reason: 'No such item' };
  if (c.mesos < cost) return { ok: false, reason: `Not enough mesos (${cost} needed)` };
  c.mesos -= cost;
  c.potions[kind] += qty;
  return { ok: true, cost };
}

export function buyUpgrade(c, slot) {
  if (slot !== 'weapon' && slot !== 'armor') return { ok: false, reason: 'No such item' };
  const cost = upgradePrice(c, slot);
  if (cost == null) return { ok: false, reason: 'Already at the top tier' };
  if (c.mesos < cost) return { ok: false, reason: `Not enough mesos (${cost.toLocaleString('en-US')} needed)` };
  c.mesos -= cost;
  c.gear = { weapon: 0, armor: 0, ...c.gear, [slot]: gearTier(c, slot) + 1 };
  if (slot === 'armor') { c.maxHp = Math.round(c.maxHp * (1 + TIER_BONUS)); c.hp = c.maxHp; }
  return { ok: true, cost, tier: c.gear[slot] };
}
