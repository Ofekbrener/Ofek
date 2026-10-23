import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../assets/', import.meta.url).pathname;
const glbJson = file => {
  const b = fs.readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'glTF', file);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.toString('utf8', 20, 20 + len));
};
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);

test('five KayKit characters ship without animations', () => {
  for (const n of ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded']) {
    const j = glbJson(ROOT + `chars/${n}.glb`);
    assert.equal((j.animations ?? []).length, 0, n);
    // quantize() may split skins per mesh; they must still drive the same bones
    assert.ok(j.skins.length >= 1, n);
    for (const sk of j.skins) assert.deepEqual(sk.joints, j.skins[0].joints, n);
  }
});

test('the shared animation file has every clip the game plays', () => {
  const names = glbJson(ROOT + 'anims.glb').animations.map(a => a.name);
  for (const n of ['Idle', 'Walking_A', 'Walking_Backwards', 'Running_A', 'Jump_Idle', 'Hit_A', 'Death_A', 'Cheer',
    '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab', '2H_Melee_Attack_Spin', 'Dualwield_Melee_Attack_Stab',
    '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Spellcast_Raise', 'Throw', 'Unarmed_Melee_Attack_Punch_A']) assert.ok(names.includes(n), n);
});

test('props are present', () => {
  for (const n of ['tree_single_A', 'tree_single_B', 'trees_A_medium', 'rock_single_A', 'barrel', 'crate_A_big', 'tent', 'target', 'flag_red', 'weaponrack'])
    assert.ok(fs.existsSync(ROOT + `props/${n}.glb`), n);
});

test('all assets fit in 6 MB and carry CC0 credits', () => {
  const total = walk(ROOT).reduce((s, f) => s + fs.statSync(f).size, 0);
  assert.ok(total <= 6 * 1024 * 1024, `${(total / 1048576).toFixed(2)} MB`);
  assert.match(fs.readFileSync(ROOT + 'CREDITS.md', 'utf8'), /CC0/);
});
