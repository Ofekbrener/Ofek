import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCharacter, damageRange } from '../src/rules/stats.js';
import { buyPotion, buyUpgrade, gearTier, upgradePrice, MAX_TIER } from '../src/rules/shop.js';

test('potions cost mesos and refuse when short', () => {
  const c = newCharacter('A', 0); c.mesos = 600;
  assert.equal(buyPotion(c, 'red', 10).ok, true);
  assert.deepEqual([c.mesos, c.potions.red], [100, 15]);
  assert.equal(buyPotion(c, 'blue', 10).ok, false);
  assert.deepEqual([c.mesos, c.potions.blue], [100, 5]);
});

test('weapon tiers raise damage 15% each and stop at 5', () => {
  const c = newCharacter('A', 0); c.mesos = 1e6;
  const before = damageRange(c)[1];
  assert.equal(buyUpgrade(c, 'weapon').ok, true);
  assert.equal(damageRange(c)[1], Math.round(before * 1.15));
  while (gearTier(c, 'weapon') < MAX_TIER) buyUpgrade(c, 'weapon');
  assert.equal(upgradePrice(c, 'weapon'), null);
  assert.equal(buyUpgrade(c, 'weapon').ok, false);
  assert.equal(c.mesos, 1e6 - 300 - 1500 - 5000 - 12000 - 30000);
});

test('armor raises max HP 15% and heals', () => {
  const c = newCharacter('A', 0); c.mesos = 300; c.hp = 10;
  assert.equal(buyUpgrade(c, 'armor').ok, true);
  const want = Math.round(50 * 1.15);
  assert.deepEqual([c.maxHp, c.hp, c.mesos], [want, want, 0]);
  assert.ok(want > 50);
});
