import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCharacter, gainExp, damageRange, rollDamage, deathPenalty, canAdvance, advance } from '../src/rules/stats.js';
import { EXP_TABLE, MOBS } from '../src/config.js';

test('exp table starts with the classic values', () => {
  assert.deepEqual(EXP_TABLE.slice(1, 10), [15, 34, 57, 92, 135, 372, 560, 840, 1242]);
});

test('mob table matches spec', () => {
  assert.deepEqual([MOBS.snail.level, MOBS.snail.hp, MOBS.snail.exp], [1, 8, 3]);
  assert.deepEqual([MOBS.blueSnail.level, MOBS.blueSnail.hp, MOBS.blueSnail.exp], [2, 15, 4]);
  assert.deepEqual([MOBS.redSnail.level, MOBS.redSnail.hp, MOBS.redSnail.exp], [4, 45, 8]);
  assert.deepEqual([MOBS.slime.level, MOBS.slime.hp, MOBS.slime.exp], [6, 50, 10]);
  assert.deepEqual([MOBS.orangeMushroom.level, MOBS.orangeMushroom.hp, MOBS.orangeMushroom.exp], [8, 80, 15]);
});

test('gainExp handles several level-ups in one call', () => {
  const c = newCharacter('Ofek', 0);
  assert.equal(gainExp(c, 15 + 34 + 1).levelsGained, 2);
  assert.equal(c.level, 3);
  assert.equal(c.exp, 1);
  assert.equal(c.str, 22);
});

test('level 30 is the cap', () => {
  const c = newCharacter('A', 0);
  gainExp(c, 1e9);
  assert.equal(c.level, 30);
});

test('death costs 10% of current-level exp', () => {
  const c = newCharacter('A', 0);
  gainExp(c, 15 + 30);
  assert.equal(deathPenalty(c), 3);
  assert.equal(c.exp, 27);
});

test('crit at rng < 0.05 multiplies by 1.5', () => {
  const c = newCharacter('A', 0);
  const [, max] = damageRange(c);
  const r = rollDamage(c, undefined, () => 0.0);
  assert.equal(r.crit, true);
  assert.ok(r.amount <= Math.round(max * 1.5));
});

test('job advance only from beginner at 10+', () => {
  const c = newCharacter('A', 0);
  assert.equal(canAdvance(c), false);
  gainExp(c, 15 + 34 + 57 + 92 + 135 + 372 + 560 + 840 + 1242);
  assert.equal(c.level, 10);
  assert.equal(canAdvance(c), true);
  advance(c, 'bowman');
  assert.equal(c.job, 'bowman');
  assert.equal(canAdvance(c), false);
});
