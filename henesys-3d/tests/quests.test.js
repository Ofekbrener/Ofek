import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS, questStatus, acceptQuest, onMobKilled, completeQuest, availableQuests } from '../src/rules/quests.js';
import { MOBS } from '../src/config.js';
import { newCharacter, gainExp } from '../src/rules/stats.js';

const fixed = v => () => v;

test('six quests, each with a giver, goal and reward', () => {
  assert.deepEqual(Object.keys(QUESTS).sort(), ['bones', 'caps', 'pigs', 'shells', 'snailHunt', 'spores']);
  for (const q of Object.values(QUESTS)) { assert.ok(q.npc && q.goal.count > 0 && q.reward); }
});

test('kill quests count every listed mob only while active', () => {
  const c = newCharacter('T', 0);
  onMobKilled(c, 'snail', fixed(0));
  assert.equal(questStatus(c, 'snailHunt'), 'available');
  acceptQuest(c, 'snailHunt');
  for (let i = 0; i < 14; i++) onMobKilled(c, i % 2 ? 'blueSnail' : 'redSnail', fixed(0));
  onMobKilled(c, 'slime', fixed(0));
  assert.equal(c.quests.snailHunt.count, 14);
  assert.equal(questStatus(c, 'snailHunt'), 'active');
  onMobKilled(c, 'snail', fixed(0));
  assert.equal(questStatus(c, 'snailHunt'), 'ready');
});

test('collect quests drop items at 50% and stop at the goal', () => {
  const c = newCharacter('T', 0);
  acceptQuest(c, 'shells');
  assert.deepEqual(onMobKilled(c, 'snail', fixed(0.9)), []);
  assert.deepEqual(onMobKilled(c, 'snail', fixed(0.1)), [{ quest: 'shells', item: 'Snail Shell' }]);
  for (let i = 0; i < 20; i++) onMobKilled(c, 'snail', fixed(0.1));
  assert.equal(c.quests.shells.count, 10);
});

test('level gates and completion rewards', () => {
  const c = newCharacter('T', 0);
  assert.equal(questStatus(c, 'spores'), 'locked');
  assert.equal(acceptQuest(c, 'spores'), false);
  acceptQuest(c, 'shells');
  c.quests.shells.count = 10;
  const mesos = c.mesos, red = c.potions.red;
  assert.equal(completeQuest(c, 'shells').ok, true);
  assert.equal(c.mesos, mesos + 150);
  assert.equal(c.potions.red, red + 5);
  assert.equal(questStatus(c, 'shells'), 'done');
  assert.equal(completeQuest(c, 'shells').ok, false);
});

test('a quest reward can level you up', () => {
  const c = newCharacter('T', 0);
  for (let i = 0; i < 50 && c.level < 6; i++) gainExp(c, 50);
  acceptQuest(c, 'caps'); c.quests.caps.count = 8;
  const r = completeQuest(c, 'caps');
  assert.ok(r.levelsGained >= 1);
});

test('availableQuests lists what an NPC can offer or take back', () => {
  const c = newCharacter('T', 0);
  assert.deepEqual(availableQuests(c, 'stan').map(q => q.id), ['snailHunt']);
  assert.deepEqual(availableQuests(c, 'grendel'), []);
});

test('new monsters exist with spec stats', () => {
  const want = { pig: [7, 70, 12], ribbonPig: [10, 120, 20], stump: [10, 150, 20], greenMushroom: [15, 250, 28], hornyMushroom: [22, 450, 44], skeletonMinion: [25, 900, 60], skeletonWarrior: [28, 1300, 80], skeletonMage: [30, 1100, 92] };
  for (const [id, [lv, hp, exp]] of Object.entries(want)) {
    assert.deepEqual([MOBS[id].level, MOBS[id].hp, MOBS[id].exp * 4], [lv, hp, exp], id);
  }
});
