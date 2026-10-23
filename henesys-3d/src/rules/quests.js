// Quests: who gives them, what they ask, what they pay. Progress lives on the
// character as c.quests[id] = { state: 'active' | 'done', count }. Pure.
import { gainExp } from './stats.js';

export const QUEST_DROP_CHANCE = 0.5;

export const QUESTS = {
  snailHunt: { name: 'Snail Hunt', npc: 'stan', level: 1, goal: { kind: 'kill', mobs: ['snail', 'blueSnail', 'redSnail'], count: 15, label: 'Snails' },
    text: 'Snails keep eating the flowers by the east gate. Defeat 15 of them, any colour.', done: 'The flowers thank you! So do I.', reward: { exp: 300, mesos: 200 } },
  shells: { name: 'Shells for Mia', npc: 'mia', level: 1, goal: { kind: 'collect', mobs: ['snail', 'blueSnail', 'redSnail'], item: 'Snail Shell', count: 10, label: 'Snail Shells' },
    text: 'I am making a necklace from snail shells. Could you bring me 10?', done: 'They are so shiny! Take these potions.', reward: { mesos: 150, potions: { red: 5 } } },
  caps: { name: 'Mushroom Caps', npc: 'athena', level: 6, goal: { kind: 'collect', mobs: ['orangeMushroom'], item: 'Orange Mushroom Cap', count: 8, label: 'Mushroom Caps' },
    text: 'Bowmen fletch arrows with dried mushroom caps. Bring me 8 Orange Mushroom Caps.', done: 'Fine caps. Your aim will thank you.', reward: { exp: 700, potions: { blue: 3 } } },
  pigs: { name: 'Pig Trouble', npc: 'balrog', level: 7, goal: { kind: 'kill', mobs: ['pig', 'ribbonPig'], count: 20, label: 'Pigs' },
    text: 'The pigs south of town broke the farm fence again. Teach 20 of them a lesson.', done: 'Ha! That is how a warrior trains.', reward: { exp: 1200, mesos: 500 } },
  spores: { name: 'Green Spores', npc: 'grendel', level: 14, goal: { kind: 'collect', mobs: ['greenMushroom'], item: 'Green Mushroom Spore', count: 10, label: 'Spores' },
    text: 'My potions need Green Mushroom Spores from the second hunting ground. Ten will do.', done: 'Excellent. The brew will be ready by moonrise.', reward: { exp: 3000 } },
  bones: { name: 'Bones of the Ruins', npc: 'darklord', level: 24, goal: { kind: 'collect', mobs: ['skeletonMinion', 'skeletonWarrior', 'skeletonMage'], item: 'Old Bone', count: 15, label: 'Old Bones' },
    text: 'Skeletons walk the ruins past the second hunting ground. Bring me 15 Old Bones. Ask no questions.', done: 'Good. You were never here.', reward: { exp: 8000, mesos: 2000 } },
};

/** 'locked' | 'available' | 'active' | 'ready' | 'done' */
export function questStatus(c, id) {
  const q = QUESTS[id], st = c.quests?.[id];
  if (st?.state === 'done') return 'done';
  if (st?.state === 'active') return st.count >= q.goal.count ? 'ready' : 'active';
  return c.level >= q.level ? 'available' : 'locked';
}

export function acceptQuest(c, id) {
  if (questStatus(c, id) !== 'available') return false;
  c.quests ??= {};
  c.quests[id] = { state: 'active', count: 0 };
  return true;
}

/** Updates kill counts and rolls quest-item drops. Returns the items that dropped. */
export function onMobKilled(c, mobId, rng = Math.random) {
  const dropped = [];
  for (const [id, q] of Object.entries(QUESTS)) {
    const st = c.quests?.[id];
    if (st?.state !== 'active' || st.count >= q.goal.count || !q.goal.mobs.includes(mobId)) continue;
    if (q.goal.kind === 'kill') st.count++;
    else if (rng() < QUEST_DROP_CHANCE) { st.count++; dropped.push({ quest: id, item: q.goal.item }); }
  }
  return dropped;
}

/** Pays the reward. Returns { ok, levelsGained }. */
export function completeQuest(c, id) {
  if (questStatus(c, id) !== 'ready') return { ok: false, levelsGained: 0 };
  const r = QUESTS[id].reward;
  c.mesos += r.mesos ?? 0;
  for (const [k, n] of Object.entries(r.potions ?? {})) c.potions[k] += n;
  const { levelsGained } = r.exp ? gainExp(c, r.exp) : { levelsGained: 0 };
  c.quests[id] = { state: 'done', count: QUESTS[id].goal.count };
  return { ok: true, levelsGained };
}

/** Quests an NPC can offer now or take back. */
export function availableQuests(c, npc) {
  return Object.entries(QUESTS).filter(([id, q]) => q.npc === npc && ['available', 'active', 'ready'].includes(questStatus(c, id))).map(([id, q]) => ({ id, ...q, status: questStatus(c, id) }));
}

export function activeQuests(c) {
  return Object.entries(QUESTS).filter(([id]) => ['active', 'ready'].includes(questStatus(c, id))).map(([id, q]) => ({ id, ...q, count: c.quests[id].count, status: questStatus(c, id) }));
}
