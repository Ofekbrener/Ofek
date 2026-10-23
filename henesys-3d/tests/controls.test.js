import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classicStep, TURN_RATE } from '../src/rules/controls.js';

test('stick up walks forward along the facing', () => {
  const r = classicStep({ x: 0, y: 1 }, 0, 0.1);
  assert.equal(r.yaw, 0); assert.ok(r.dz > 0); assert.ok(Math.abs(r.dx) < 1e-9); assert.equal(r.back, false);
});

test('stick down walks backward without turning', () => {
  const r = classicStep({ x: 0, y: -1 }, Math.PI / 2, 0.1);
  assert.equal(r.yaw, Math.PI / 2); assert.ok(r.dx < 0); assert.equal(r.back, true);
});

test('stick sideways turns in place', () => {
  const r = classicStep({ x: 1, y: 0 }, 0, 0.5);
  assert.ok(Math.abs(r.yaw + TURN_RATE * 0.5) < 1e-9);
  assert.equal(r.dx, 0); assert.equal(r.dz, 0);
});
