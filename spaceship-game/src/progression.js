import { store } from './storage.js';

// Persistent meta-progression (Hangar upgrades, skins, pilot rank) and the
// in-run power-up pool. Everything the game needs is exposed as a flat set of
// "modifiers" built from permanent upgrades + power-ups picked this run.

export const UPGRADES = [
  { id: 'shield', name: 'Shield Generator', icon: '🛡️', max: 3, base: 60, desc: (l) => `Start each run with ${l} shield${l === 1 ? '' : 's'}` },
  { id: 'magnet', name: 'Crystal Magnet', icon: '🧲', max: 5, base: 40, desc: (l) => `Pull crystals from ${(l * 0.7).toFixed(1)} units away` },
  { id: 'thrusters', name: 'Thrusters', icon: '🚀', max: 5, base: 45, desc: (l) => `+${l * 12}% steering response` },
  { id: 'booster', name: 'Score Booster', icon: '✴️', max: 5, base: 70, desc: (l) => `+${l * 10}% score` },
  { id: 'focus', name: 'Focus Core', icon: '🎯', max: 3, base: 55, desc: (l) => `Wider PERFECT window, longer slow-mo (Lv ${l})` },
  { id: 'lucky', name: 'Lucky Star', icon: '🍀', max: 3, base: 80, desc: (l) => `+${l * 50}% shield orb chance` },
];

export const SKINS = [
  { id: 'classic', name: 'Classic', cost: 0, hull: 0xd8e2f0, accent: 0xff3ca8, glass: 0x3cf2ff, trail: [0.45, 0.9, 1], trail2: [1, 0.4, 1] },
  { id: 'crimson', name: 'Crimson', cost: 150, hull: 0xb3243a, accent: 0xffb13c, glass: 0xffd35c, trail: [1, 0.45, 0.2], trail2: [1, 0.85, 0.3] },
  { id: 'gold', name: 'Gold Rush', cost: 300, hull: 0xe8c15a, accent: 0xffffff, glass: 0x7af0ff, trail: [1, 0.85, 0.35], trail2: [1, 1, 0.8] },
  { id: 'stealth', name: 'Stealth', cost: 450, hull: 0x2a2f3d, accent: 0x5dff8a, glass: 0x5dff8a, trail: [0.35, 1, 0.5], trail2: [0.8, 1, 0.8] },
  { id: 'aurora', name: 'Aurora', cost: 700, hull: 0xf2f0ff, accent: 0x9b5cff, glass: 0xff5cf0, trail: [0.7, 0.4, 1], trail2: [0.3, 1, 0.9] },
];

export const POWERUPS = [
  { id: 'shield', name: 'Extra Shield', icon: '🛡️', desc: '+1 shield charge now', max: 9 },
  { id: 'rush', name: 'Crystal Rush', icon: '💎', desc: '+50% crystal value', max: 4 },
  { id: 'overdrive', name: 'Overdrive', icon: '✴️', desc: '+25% score', max: 4 },
  { id: 'nimble', name: 'Nimble', icon: '🌀', desc: '+20% handling', max: 3 },
  { id: 'magnet', name: 'Magnet Pulse', icon: '🧲', desc: '+1.5 magnet radius', max: 3 },
  { id: 'slow', name: 'Slow Field', icon: '⏳', desc: '−8% world speed', max: 3 },
  { id: 'daredevil', name: 'Daredevil', icon: '😈', desc: 'Near-miss bonus ×2', max: 2 },
];

export const RANKS = ['Cadet', 'Pilot', 'Wingman', 'Ace', 'Captain', 'Commander', 'Void Knight', 'Star Legend'];

export function upgradeCost(u, level) {
  return Math.round(u.base * Math.pow(1.8, level) / 5) * 5;
}

// XP needed to go from rank r to r+1.
export function xpForRank(r) {
  return Math.round(800 * Math.pow(1.45, r));
}

export function rankInfo(xp) {
  let r = 0;
  let rest = xp;
  while (rest >= xpForRank(r)) { rest -= xpForRank(r); r++; }
  const title = RANKS[Math.min(r, RANKS.length - 1)] + (r >= RANKS.length ? ` ${r - RANKS.length + 2}` : '');
  return { rank: r, title, into: rest, need: xpForRank(r) };
}

const DEFAULT_SAVE = { v: 1, crystals: 0, upgrades: {}, skins: ['classic'], skin: 'classic', xp: 0 };

export class Progression {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = store.get('save', null);
      const d = raw ? JSON.parse(raw) : {};
      const merged = { ...DEFAULT_SAVE, ...d, upgrades: { ...(d.upgrades || {}) } };
      if (!Array.isArray(merged.skins) || !merged.skins.includes('classic')) merged.skins = ['classic', ...(merged.skins || [])];
      if (!merged.skins.includes(merged.skin)) merged.skin = 'classic';
      merged.crystals = Math.max(0, merged.crystals | 0);
      merged.xp = Math.max(0, merged.xp | 0);
      return merged;
    } catch {
      return { ...DEFAULT_SAVE, upgrades: {}, skins: ['classic'] };
    }
  }

  save() { store.set('save', JSON.stringify(this.data)); }

  level(id) { return this.data.upgrades[id] || 0; }
  get crystals() { return this.data.crystals; }
  get skin() { return SKINS.find((s) => s.id === this.data.skin) || SKINS[0]; }

  canBuy(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const l = this.level(id);
    return l < u.max && this.data.crystals >= upgradeCost(u, l);
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    const u = UPGRADES.find((x) => x.id === id);
    this.data.crystals -= upgradeCost(u, this.level(id));
    this.data.upgrades[id] = this.level(id) + 1;
    this.save();
    return true;
  }

  ownsSkin(id) { return this.data.skins.includes(id); }

  buySkin(id) {
    const s = SKINS.find((x) => x.id === id);
    if (!s || this.ownsSkin(id) || this.data.crystals < s.cost) return false;
    this.data.crystals -= s.cost;
    this.data.skins.push(id);
    this.data.skin = id;
    this.save();
    return true;
  }

  equipSkin(id) {
    if (!this.ownsSkin(id)) return false;
    this.data.skin = id;
    this.save();
    return true;
  }

  // Bank a finished run. Returns rank info before/after for the game-over animation.
  bankRun(crystals, xp) {
    const before = rankInfo(this.data.xp);
    this.data.crystals += crystals;
    this.data.xp += xp;
    this.save();
    return { before, after: rankInfo(this.data.xp) };
  }

  // Combined modifiers for a run: permanent upgrades + picked power-ups.
  modifiers(picked = {}) {
    const p = (id) => picked[id] || 0;
    return {
      startShields: this.level('shield'),
      magnet: this.level('magnet') * 0.7 + p('magnet') * 1.5,
      handling: 1 + this.level('thrusters') * 0.12 + p('nimble') * 0.2,
      scoreMult: 1 + this.level('booster') * 0.1 + p('overdrive') * 0.25,
      crystalMult: 1 + p('rush') * 0.5,
      perfectMargin: 0.15 + this.level('focus') * 0.05,
      slowMoExtra: this.level('focus') * 0.1,
      orbChance: 0.035 * (1 + this.level('lucky') * 0.5),
      speedMult: Math.pow(0.92, p('slow')),
      nearMult: Math.pow(2, p('daredevil')),
    };
  }
}

// Draw `n` distinct power-ups that aren't maxed out this run.
export function drawCards(picked, n = 3) {
  const pool = POWERUPS.filter((p) => (picked[p.id] || 0) < p.max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
