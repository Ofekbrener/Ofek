import { store } from './storage.js';
import { RACE_UPGRADES, LEAGUES, GALAXY_TROPHY_REQ, CAREER, careerIndex } from './race/leagues.js';

// Persistent meta-progression (Hangar upgrades, skins, pilot rank) and the
// in-run power-up pool. Everything the game needs is exposed as a flat set of
// "modifiers" built from permanent upgrades + power-ups picked this run.

export const UPGRADES = [
  { id: 'shield', name: 'Shield Generator', icon: '🛡️', max: 3, base: 60, desc: (l) => `Start each run with ${l} shield${l === 1 ? '' : 's'}` },
  { id: 'magnet', name: 'Drumstick Magnet', icon: '🧲', max: 5, base: 40, desc: (l) => `Pull drumsticks from ${(l * 0.7).toFixed(1)} units away` },
  { id: 'thrusters', name: 'Thrusters', icon: '🚀', max: 5, base: 45, desc: (l) => `+${l * 12}% steering response` },
  { id: 'booster', name: 'Score Booster', icon: '✴️', max: 5, base: 70, desc: (l) => `+${l * 10}% score` },
  { id: 'focus', name: 'Focus Core', icon: '🎯', max: 3, base: 55, desc: (l) => `Wider PERFECT window, longer slow-mo (Lv ${l})` },
  { id: 'lucky', name: 'Lucky Feather', icon: '🍀', max: 3, base: 80, desc: (l) => `+${l * 50}% shield orb & gift box chance` },
];

export const SKINS = [
  { id: 'classic', name: 'Classic', cost: 0, hull: 0xd8e2f0, accent: 0xff3ca8, glass: 0x3cf2ff, trail: [0.45, 0.9, 1], trail2: [1, 0.4, 1] },
  { id: 'crimson', name: 'Crimson', cost: 150, hull: 0xb3243a, accent: 0xffb13c, glass: 0xffd35c, trail: [1, 0.45, 0.2], trail2: [1, 0.85, 0.3] },
  { id: 'gold', name: 'Gold Rush', cost: 300, hull: 0xe8c15a, accent: 0xffffff, glass: 0x7af0ff, trail: [1, 0.85, 0.35], trail2: [1, 1, 0.8] },
  { id: 'stealth', name: 'Stealth', cost: 450, hull: 0x2a2f3d, accent: 0x5dff8a, glass: 0x5dff8a, trail: [0.35, 1, 0.5], trail2: [0.8, 1, 0.8] },
  { id: 'aurora', name: 'Aurora', cost: 700, hull: 0xf2f0ff, accent: 0x9b5cff, glass: 0xff5cf0, trail: [0.7, 0.4, 1], trail2: [0.3, 1, 0.9] },
];

// Cosmetic add-ons worn by the pod in every mode. One item per slot can be equipped.
export const COSMETIC_SLOTS = [
  { id: 'hat', name: 'Hats', icon: '🎩' },
  { id: 'wings', name: 'Wings', icon: '🪽' },
  { id: 'trail', name: 'Trails', icon: '🌈' },
  { id: 'pet', name: 'Pets', icon: '🐣' },
];
export const COSMETICS = [
  { id: 'party', slot: 'hat', name: 'Party Hat', icon: '🥳', cost: 60 },
  { id: 'propeller', slot: 'hat', name: 'Propeller Cap', icon: '🧢', cost: 90 },
  { id: 'chef', slot: 'hat', name: 'Chef Hat', icon: '👨‍🍳', cost: 120 },
  { id: 'viking', slot: 'hat', name: 'Viking Horns', icon: '🪖', cost: 160 },
  { id: 'crown', slot: 'hat', name: 'Royal Crown', icon: '👑', cost: 250 },
  { id: 'jetfins', slot: 'wings', name: 'Jet Fins', icon: '✈️', cost: 100 },
  { id: 'angel', slot: 'wings', name: 'Angel Wings', icon: '👼', cost: 180 },
  { id: 'bat', slot: 'wings', name: 'Bat Wings', icon: '🦇', cost: 180 },
  { id: 'dragon', slot: 'wings', name: 'Dragon Wings', icon: '🐉', cost: 320 },
  { id: 'fire', slot: 'trail', name: 'Fire Trail', icon: '🔥', cost: 80, trail: [1, 0.45, 0.1], trail2: [1, 0.85, 0.2] },
  { id: 'toxic', slot: 'trail', name: 'Toxic Trail', icon: '☢️', cost: 80, trail: [0.4, 1, 0.2], trail2: [0.8, 1, 0.3] },
  { id: 'goldtrail', slot: 'trail', name: 'Gold Trail', icon: '✨', cost: 140, trail: [1, 0.82, 0.3], trail2: [1, 1, 0.75] },
  { id: 'rainbow', slot: 'trail', name: 'Rainbow Trail', icon: '🌈', cost: 260, rainbow: true },
  { id: 'chick', slot: 'pet', name: 'Baby Chick', icon: '🐥', cost: 150 },
  { id: 'eggbot', slot: 'pet', name: 'Egg-Bot', icon: '🤖', cost: 220 },
  { id: 'ufo', slot: 'pet', name: 'Mini UFO', icon: '🛸', cost: 300 },
];

export const POWERUPS = [
  { id: 'shield', name: 'Extra Shield', icon: '🛡️', desc: '+1 shield charge now', max: 9 },
  { id: 'rush', name: 'Drumstick Rush', icon: '🍗', desc: '+50% drumstick value', max: 4 },
  { id: 'overdrive', name: 'Overdrive', icon: '✴️', desc: '+25% score', max: 4 },
  { id: 'nimble', name: 'Nimble', icon: '🌀', desc: '+20% handling', max: 3 },
  { id: 'magnet', name: 'Magnet Pulse', icon: '🧲', desc: '+1.5 magnet radius', max: 3 },
  { id: 'slow', name: 'Slow Field', icon: '⏳', desc: '−8% world speed', max: 3 },
  { id: 'daredevil', name: 'Daredevil', icon: '😈', desc: 'Near-miss bonus ×2', max: 2 },
  { id: 'gifts', name: 'Gift Wrapper', icon: '🎁', desc: 'Gift boxes appear twice as often', max: 2 },
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

const DEFAULT_SAVE = {
  v: 2, crystals: 0, upgrades: {}, skins: ['classic'], skin: 'classic', xp: 0,
  addons: [], wear: {},
  galaxy: { unlocked: 1, stars: [0, 0, 0, 0, 0] },
  endlessBest: { wave: 0, score: 0 },
  race: { best: {} },
  ftue: {},
};
const ALL_UPGRADES = () => [...UPGRADES, ...RACE_UPGRADES];
export const GALAXY_COUNT = 5;

// Every upgrade level (Dodge + Race Garage) as {id: level}, for Ship.setUpgrades.
export function upgradeLevels(prog) {
  const out = {};
  for (const u of ALL_UPGRADES()) out[u.id] = prog.level(u.id);
  out.cosmetics = { ...prog.data.wear };   // equipped add-ons ride along to Ship.setUpgrades
  return out;
}

export class Progression {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = store.get('save', null);
      const d = raw ? JSON.parse(raw) : {};
      const merged = { ...DEFAULT_SAVE, ...d, upgrades: { ...(d.upgrades || {}) } };
      const g = d.galaxy || {};
      merged.galaxy = {
        unlocked: Math.max(1, Math.min(GALAXY_COUNT + 1, g.unlocked | 0 || 1)),
        stars: Array.from({ length: GALAXY_COUNT }, (_, i) => Math.max(0, Math.min(3, (g.stars && g.stars[i]) | 0))),
      };
      merged.endlessBest = { wave: 0, score: 0, ...(d.endlessBest || {}) };
      merged.race = { best: { ...((d.race && d.race.best) || {}) } };
      // FTUE flags (seen hand-offs). Old saves have none: they just get the guidance once.
      merged.ftue = { ...((d.ftue && typeof d.ftue === 'object') ? d.ftue : {}) };
      if (raw && !d.ftue) {
        // Pre-FTUE save: skip guidance for steps the player has clearly done already.
        if (merged.galaxy.unlocked > 1 || merged.galaxy.stars.some((x) => x > 0)) merged.ftue.dodged = 1;
        if (Object.values(merged.race.best).some((x) => x > 0 && x <= 3)) merged.ftue.trophy = 1;
        if (RACE_UPGRADES.some((u) => merged.upgrades[u.id] > 0)) merged.ftue.upgrade = merged.ftue.garage = 1;
      }
      if (!Array.isArray(merged.skins) || !merged.skins.includes('classic')) merged.skins = ['classic', ...(merged.skins || [])];
      if (!merged.skins.includes(merged.skin)) merged.skin = 'classic';
      merged.addons = Array.isArray(d.addons) ? d.addons.filter((id) => COSMETICS.some((c) => c.id === id)) : [];
      merged.wear = {};
      for (const [slot, id] of Object.entries((d.wear && typeof d.wear === 'object') ? d.wear : {})) {
        if (merged.addons.includes(id) && COSMETICS.find((c) => c.id === id).slot === slot) merged.wear[slot] = id;
      }
      merged.crystals = Math.max(0, merged.crystals | 0);
      merged.xp = Math.max(0, merged.xp | 0);
      return merged;
    } catch {
      return { ...DEFAULT_SAVE, addons: [], wear: {}, upgrades: {}, skins: ['classic'], galaxy: { unlocked: 1, stars: [0, 0, 0, 0, 0] }, endlessBest: { wave: 0, score: 0 }, race: { best: {} }, ftue: {} };
    }
  }

  save() { store.set('save', JSON.stringify(this.data)); }

  level(id) { return this.data.upgrades[id] || 0; }
  get crystals() { return this.data.crystals; }
  get skin() { return SKINS.find((s) => s.id === this.data.skin) || SKINS[0]; }

  canBuy(id) {
    const u = ALL_UPGRADES().find((x) => x.id === id);
    const l = this.level(id);
    return l < u.max && this.data.crystals >= upgradeCost(u, l);
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    const u = ALL_UPGRADES().find((x) => x.id === id);
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

  ownsAddon(id) { return this.data.addons.includes(id); }
  wearing(id) { const c = COSMETICS.find((x) => x.id === id); return !!c && this.data.wear[c.slot] === id; }

  // Buying an add-on also puts it on.
  buyAddon(id) {
    const c = COSMETICS.find((x) => x.id === id);
    if (!c || this.ownsAddon(id) || this.data.crystals < c.cost) return false;
    this.data.crystals -= c.cost;
    this.data.addons.push(id);
    this.data.wear[c.slot] = id;
    this.save();
    return true;
  }

  // Tap an owned add-on to wear it; tap the worn one to take it off.
  toggleAddon(id) {
    const c = COSMETICS.find((x) => x.id === id);
    if (!c || !this.ownsAddon(id)) return false;
    if (this.data.wear[c.slot] === id) delete this.data.wear[c.slot];
    else this.data.wear[c.slot] = id;
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

  // ---- campaign ----
  get unlocked() { return this.data.galaxy.unlocked; }
  get endlessUnlocked() { return this.data.galaxy.unlocked > GALAXY_COUNT; }
  starsFor(i) { return this.data.galaxy.stars[i] || 0; }
  get totalStars() { return this.data.galaxy.stars.reduce((a, b) => a + b, 0); }

  // Returns true if this completion unlocked something new.
  completeGalaxy(i, stars) {
    const g = this.data.galaxy;
    const wasUnlocked = g.unlocked;
    g.stars[i] = Math.max(g.stars[i] || 0, stars);
    g.unlocked = Math.max(g.unlocked, i + 2);
    this.save();
    return g.unlocked > wasUnlocked;
  }

  recordEndless(wave, score) {
    const b = this.data.endlessBest;
    let improved = false;
    if (wave > b.wave) { b.wave = wave; improved = true; }
    if (score > b.score) { b.score = score; improved = true; }
    if (improved) this.save();
    return improved;
  }

  // ---- race league ----
  get raceStats() {
    return { engine: this.level('engine'), accel: this.level('accel'), grip: this.level('grip'), tank: this.level('tank'), armor: this.level('armor') };
  }
  bestPlace(trackId) { return this.data.race.best[trackId] || 0; }
  // A trophy = a podium finish (top 3) on a track.
  get trophies() { return Object.values(this.data.race.best).filter((p) => p > 0 && p <= 3).length; }
  leagueTrophies(leagueId) {
    const lg = LEAGUES.find((l) => l.id === leagueId);
    return lg ? lg.tracks.filter((t) => { const p = this.bestPlace(t.id); return p > 0 && p <= 3; }).length : 0;
  }
  // Returns {newBest, newTrophy}
  recordRace(trackId, place) {
    const prev = this.bestPlace(trackId);
    const newBest = !prev || place < prev;
    if (newBest) this.data.race.best[trackId] = place;
    this.save();
    return { newBest, newTrophy: place <= 3 && (!prev || prev > 3) };
  }
  // Linear career: race N+1 unlocks with a podium in race N. A track the player
  // already raced (old saves with league gating) stays unlocked.
  raceUnlocked(trackId) {
    const i = careerIndex(trackId);
    if (i <= 0) return i === 0;
    if (this.bestPlace(trackId) > 0) return true;
    const prev = this.bestPlace(CAREER[i - 1].track.id);
    return prev > 0 && prev <= 3;
  }
  // A league is open when its first race is.
  leagueUnlocked(lg) { return this.raceUnlocked(lg.tracks[0].id); }
  // First unlocked career race without a podium yet (null when all are podiumed).
  get nextCareerRace() {
    for (const c of CAREER) {
      if (!this.raceUnlocked(c.track.id)) return null;
      const b = this.bestPlace(c.track.id);
      if (!b || b > 3) return c;
    }
    return null;
  }
  get racesRun() { return Object.keys(this.data.race.best).length; }
  // Ship Power = 1 + total Race Garage levels (compared to track.power).
  get shipPower() { return 1 + RACE_UPGRADES.reduce((a, u) => a + this.level(u.id), 0); }
  // Galaxy i can be launched if its predecessor boss is beaten AND enough race trophies.
  galaxyTrophyReq(i) { return GALAXY_TROPHY_REQ[i] || 0; }
  galaxyOpen(i) { return this.trophies >= this.galaxyTrophyReq(i) && (i === 0 || i < this.unlocked); }

  // ---- FTUE flags ----
  ftueSeen(key) { return !!this.data.ftue[key]; }
  ftueMark(key) { if (!this.data.ftue[key]) { this.data.ftue[key] = 1; this.save(); } }

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
      giftChance: 0.035 * (1 + this.level('lucky') * 0.5) * Math.pow(2, p('gifts')),
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
