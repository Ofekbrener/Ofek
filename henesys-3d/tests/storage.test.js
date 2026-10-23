import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save, KEY } from '../src/storage.js';
import { newCharacter, gainExp, advance } from '../src/rules/stats.js';

function memStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

test('a store that throws loads as null', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(load(bad), null);
  assert.equal(save(newCharacter('A', 0), 'henesys', bad), false);
});

test('garbage and wrong shapes load as null', () => {
  const s = memStore();
  for (const raw of ['not json', '{"level":"x"}', '{"v":1,"character":{"level":99}}', 'null', '[]']) {
    s.setItem(KEY, raw);
    assert.equal(load(s), null, raw);
  }
});

test('a character round-trips with its map', () => {
  const s = memStore();
  const c = newCharacter('Ofek', 2);
  gainExp(c, 3347); advance(c, 'warrior'); c.mesos = 1234; c.potions.red = 9;
  assert.equal(save(c, 'hunting', s), true);
  const got = load(s);
  assert.deepEqual(got.character, c);
  assert.equal(got.mapId, 'hunting');
});
