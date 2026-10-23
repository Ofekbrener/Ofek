import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, groundHeight } from '../src/rules/collision.js';

const bounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };

test('a point inside a circle is pushed to its edge plus the radius', () => {
  const p = resolve({ x: 0.5, z: 0 }, 0.4, [{ type: 'circle', x: 0, z: 0, r: 2 }], bounds);
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 2.4) < 1e-9);
  assert.ok(p.x > 0);
});

test('a point inside a box leaves along the shallowest axis', () => {
  const p = resolve({ x: 1.8, z: 0.2 }, 0.4, [{ type: 'box', x: 0, z: 0, hw: 2, hd: 3 }], bounds);
  assert.ok(Math.abs(p.x - 2.4) < 1e-9);
  assert.equal(p.z, 0.2);
});

test('a point outside every collider is unchanged', () => {
  assert.deepEqual(resolve({ x: 10, z: 10 }, 0.4, [{ type: 'circle', x: 0, z: 0, r: 2 }], bounds), { x: 10, z: 10 });
});

test('the map edge clamps the position', () => {
  const p = resolve({ x: 999, z: -999 }, 0.4, [], bounds);
  assert.deepEqual(p, { x: 29.6, z: -29.6 });
});

test('groundHeight takes the highest surface that covers the point, else 0', () => {
  const hill = (x, z) => (Math.hypot(x, z) < 5 ? 2 : null);
  const ledge = (x, z) => (x > 0 ? 1 : null);
  assert.equal(groundHeight([hill, ledge], 1, 0), 2);
  assert.equal(groundHeight([hill, ledge], 10, 0), 1);
  assert.equal(groundHeight([hill, ledge], -10, 0), 0);
});
