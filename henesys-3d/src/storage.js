// Save / load through localStorage. Any throw or unexpected shape loads as
// null so a private window or an old save starts a fresh game.
import { JOBS, MAX_LEVEL } from './config.js';
import { normalizeLook } from './rules/appearance.js';

export const KEY = 'henesys3d.save.v1';
const MAPS = ['henesys', 'hunting'];

const store0 = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const num = (v, min = 0) => typeof v === 'number' && Number.isFinite(v) && v >= min;

function valid(c) {
  return c && typeof c === 'object'
    && typeof c.name === 'string' && c.name.length <= 20
    && Number.isInteger(c.level) && c.level >= 1 && c.level <= MAX_LEVEL
    && typeof c.job === 'string' && Object.hasOwn(JOBS, c.job)
    && ['exp', 'str', 'dex', 'mesos'].every(k => num(c[k]))
    && ['hp', 'mp'].every(k => num(c[k])) && num(c.maxHp, 1) && num(c.maxMp, 1)
    && c.potions && num(c.potions.red) && num(c.potions.blue);
}

/** Returns { character, mapId } or null. */
export function load(store = store0()) {
  try {
    const data = JSON.parse(store.getItem(KEY));
    if (!data || data.v !== 1 || !valid(data.character)) return null;
    data.character.look = normalizeLook(data.character.look);
    const g = data.character.gear, tier = v => (Number.isInteger(v) && v >= 0 && v <= 5 ? v : 0);
    data.character.gear = { weapon: tier(g?.weapon), armor: tier(g?.armor) };
    const q = data.character.quests;
    if (!q || typeof q !== 'object' || Array.isArray(q)) data.character.quests = {};
    else for (const k of Object.keys(q)) {
      const e = q[k];
      if (!e || !['active', 'done'].includes(e.state)) delete q[k];
      else { e.count = Number.isFinite(e.count) ? e.count : 0; delete e.announced; }
    }
    return { character: data.character, mapId: MAPS.includes(data.mapId) ? data.mapId : 'henesys' };
  } catch {
    return null;
  }
}

export function save(character, mapId, store = store0()) {
  try {
    store.setItem(KEY, JSON.stringify({ v: 1, character, mapId }));
    return true;
  } catch {
    return false;
  }
}

export function clear(store = store0()) {
  try { store.removeItem(KEY); } catch { /* nothing to clear */ }
}

export function loadSettings(store = store0()) {
  try { return { sound: true, vibration: true, music: true, controls: 'classic', ...JSON.parse(store.getItem('henesys3d.settings') || '{}') }; }
  catch { return { sound: true, vibration: true, music: true, controls: 'classic' }; }
}

export function saveSettings(s, store = store0()) {
  try { store.setItem('henesys3d.settings', JSON.stringify(s)); } catch { /* settings stay in memory */ }
}
