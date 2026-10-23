import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followYaw } from '../src/rules/camera.js';

const behind = playerYaw => playerYaw + Math.PI;
const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('walking forward swings the camera behind the player', () => {
  let cam = 0;
  const playerYaw = 1.5;
  for (let i = 0; i < 120; i++) cam = followYaw(cam, playerYaw, 1 / 30, { moving: true, forward: 1, dragging: false });
  assert.ok(angleDiff(cam, behind(playerYaw)) < 0.05, `cam ${cam}`);
});

test('standing still keeps the chosen angle', () => {
  assert.equal(followYaw(0.7, 2, 1 / 30, { moving: false, forward: 0, dragging: false }), 0.7);
});

test('a finger on the camera wins over the follow', () => {
  assert.equal(followYaw(0.7, 2, 1 / 30, { moving: true, forward: 1, dragging: true }), 0.7);
});

test('sideways walking turns the camera slower than forward walking', () => {
  const side = followYaw(0, 2.5, 1 / 30, { moving: true, forward: 0, dragging: false });
  const fwd = followYaw(0, 2.5, 1 / 30, { moving: true, forward: 1, dragging: false });
  assert.ok(Math.abs(side) < Math.abs(fwd));
  assert.ok(Math.abs(side) > 0);
});
