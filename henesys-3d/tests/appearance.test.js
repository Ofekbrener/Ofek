import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, HAIR_STYLES, defaultAppearance, randomAppearance, normalizeLook } from '../src/rules/appearance.js';

test('palettes have the promised sizes', () => {
  assert.equal(HAIR_STYLES.length, 5);
  assert.equal(PALETTES.hair.length, 8);
  assert.equal(PALETTES.skin.length, 5);
  assert.equal(PALETTES.eyes.length, 5);
  assert.equal(PALETTES.shirt.length, 8);
  assert.equal(PALETTES.pants.length, 8);
});

test('old numeric looks map to a full appearance', () => {
  const a = normalizeLook(2);
  assert.equal(a.hairStyle, 'short');
  assert.equal(typeof a.hair, 'number');
  assert.deepEqual(Object.keys(a).sort(), ['bottom', 'eyes', 'hair', 'hairStyle', 'pants', 'shirt', 'skin']);
});

test('bad fields fall back to defaults, good fields survive', () => {
  const d = defaultAppearance();
  const a = normalizeLook({ hairStyle: 'mohawk', hair: PALETTES.hair[3], skin: 'pink', bottom: 'skirt' });
  assert.equal(a.hairStyle, d.hairStyle);
  assert.equal(a.hair, PALETTES.hair[3]);
  assert.equal(a.skin, d.skin);
  assert.equal(a.bottom, 'skirt');
  assert.deepEqual(normalizeLook(null), d);
});

test('random appearances only use palette values', () => {
  let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++) {
    const a = randomAppearance(rng);
    assert.deepEqual(normalizeLook(a), a);
  }
});
