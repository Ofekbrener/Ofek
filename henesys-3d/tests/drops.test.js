import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDrops } from '../src/rules/drops.js';
import { MOBS } from '../src/config.js';

test('every kill drops exactly one mesos pile inside the mob range', () => {
  for (const id of Object.keys(MOBS)) {
    for (let i = 0; i < 50; i++) {
      const mesos = rollDrops(id, Math.random).filter(d => d.kind === 'mesos');
      assert.equal(mesos.length, 1);
      const [lo, hi] = MOBS[id].mesos;
      assert.ok(mesos[0].amount >= lo && mesos[0].amount <= hi, `${id} ${mesos[0].amount}`);
    }
  }
});

test('rng 0 always includes the potion drop', () => {
  const potions = rollDrops('snail', () => 0).filter(d => d.kind === 'potion');
  assert.deepEqual(potions, [{ kind: 'potion', item: 'red' }]);
});

test('rng near 1 drops no potion', () => {
  assert.equal(rollDrops('orangeMushroom', () => 0.999).filter(d => d.kind === 'potion').length, 0);
});
