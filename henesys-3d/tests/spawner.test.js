import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Spawner } from '../src/rules/spawner.js';

const zones = [
  { id: 0, mobIds: ['snail', 'blueSnail'], area: { x: 0, z: 0, w: 20, d: 20 } },
  { id: 1, mobIds: ['redSnail', 'slime'], area: { x: 30, z: 0, w: 20, d: 20 } },
  { id: 2, mobIds: ['orangeMushroom'], area: { x: 60, z: 0, w: 20, d: 20 } },
];

test('first update fills zones up to 6 each and 15 total', () => {
  const s = new Spawner(zones, Math.random);
  const req = s.update(0.016);
  assert.equal(req.length, 15);
  assert.deepEqual([s.count(0), s.count(1), s.count(2)], [6, 6, 3]);
  assert.equal(s.total(), 15);
});

test('spawn requests land inside their zone area and use zone mobs', () => {
  const s = new Spawner(zones, Math.random);
  for (const r of s.update(0.016)) {
    const a = zones[r.zone].area;
    assert.ok(r.x >= a.x - a.w / 2 && r.x <= a.x + a.w / 2);
    assert.ok(r.z >= a.z - a.d / 2 && r.z <= a.z + a.d / 2);
    assert.ok(zones[r.zone].mobIds.includes(r.mobId));
  }
});

test('a death respawns exactly one mob after 7 s', () => {
  const s = new Spawner(zones, Math.random);
  s.update(0.016);
  s.onDeath(0);
  assert.equal(s.update(6.9).length, 0);
  const req = s.update(0.2);
  assert.equal(req.length, 1);
  assert.equal(req[0].zone, 0);
});

test('a huge dt after one death still spawns one mob', () => {
  const s = new Spawner(zones, Math.random);
  s.update(0.016);
  s.onDeath(1);
  assert.equal(s.update(100).length, 1);
  assert.equal(s.total(), 15);
});
