import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, SKILLS } from '../src/config.js';
import { newCharacter, gainExp, advance, damageRange, skillState } from '../src/rules/stats.js';
import { applyBuff, modifiers, activeBuffs, endBuff } from '../src/rules/buffs.js';

function at(level, job) {
  const c = newCharacter('T', 0);
  for (let i = 0; i < 200 && c.level < level; i++) gainExp(c, 5000);
  if (job) advance(c, job);
  return c;
}

test('five jobs, four skills each with unlock levels 10/13/16/20', () => {
  assert.deepEqual(Object.keys(JOBS).sort(), ['beginner', 'bowman', 'magician', 'thief', 'warrior']);
  for (const j of ['warrior', 'magician', 'bowman', 'thief']) {
    assert.equal(JOBS[j].skills.length, 4, j);
    assert.deepEqual(JOBS[j].skills.map(s => SKILLS[s].level), [10, 13, 16, 20], j);
    for (const s of JOBS[j].skills) assert.equal(SKILLS[s].job, j, s);
  }
  assert.deepEqual(['warrior', 'magician', 'bowman', 'thief'].map(j => JOBS[j].stat), ['str', 'int', 'dex', 'luk']);
});

test('advancing moves beginner points into the job stat', () => {
  const m = at(10, 'magician');
  assert.equal(m.str, 12); assert.ok(m.int > 40, `int ${m.int}`);
  const t = at(10, 'thief');
  assert.equal(t.str, 12); assert.ok(t.luk > 40, `luk ${t.luk}`);
  assert.ok(damageRange(m)[1] > damageRange(newCharacter('x', 0))[1]);
});

test('skillState explains why a skill cannot be used', () => {
  const c = at(13, 'warrior');
  assert.deepEqual(skillState(c, 'powerStrike', 0, {}), { ok: true });
  assert.equal(skillState(c, 'rage', 0, {}).reason, 'locked');
  assert.equal(skillState(c, 'energyBolt', 0, {}).reason, 'job');
  c.mp = 0;
  assert.equal(skillState(c, 'powerStrike', 0, {}).reason, 'mp');
  c.mp = 100;
  assert.equal(skillState(c, 'powerStrike', 1, { powerStrike: 1.3 }).reason, 'cooldown');
});

test('buffs modify stats and expire on time', () => {
  const c = at(20, 'warrior');
  applyBuff(c, 'rage', 100);
  assert.ok(modifiers(c, 110).dmg > 1);
  assert.equal(modifiers(c, 100 + SKILLS.rage.duration + 0.1).dmg, 1);
  const t = at(20, 'thief');
  applyBuff(t, 'darkSight', 0);
  assert.equal(modifiers(t, 1).hidden, true);
  endBuff(t, 'darkSight');
  assert.equal(modifiers(t, 1).hidden, false);
  applyBuff(t, 'haste', 0);
  assert.ok(modifiers(t, 1).speed > 1);
  assert.deepEqual(activeBuffs(t, 1).map(b => b.id), ['haste']);
});

test('old characters without int and luk still work', () => {
  const c = newCharacter('Old', 0); delete c.int; delete c.luk;
  assert.ok(damageRange(c)[1] > 0);
});
