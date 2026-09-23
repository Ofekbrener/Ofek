import { store } from './storage.js';

// Vibration API wrapper with a strength setting (Off / Normal / Strong).
// Patterns are deliberately long enough (40ms+) to be felt on most Android motors.
// Silently no-ops where unsupported (e.g. iOS Safari).
const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const LEVELS = ['Off', 'Normal', 'Strong'];
const SCALE = [0, 1, 1.8];

let level = parseInt(store.get('haptics', '1'), 10);
if (!(level >= 0 && level <= 2)) level = 1;

function buzz(pattern) {
  if (!supported || level === 0) return;
  const k = SCALE[level];
  // Scale "on" segments (even indices); keep gaps as-is so rhythm stays readable.
  const p = Array.isArray(pattern)
    ? pattern.map((v, i) => (i % 2 === 0 ? Math.round(v * k) : v))
    : Math.round(pattern * k);
  try { navigator.vibrate(p); } catch { /* ignore */ }
}

export const haptics = {
  supported,
  get level() { return level; },
  get label() { return LEVELS[level]; },
  // Cycle Off → Normal → Strong, with a test buzz.
  cycle() {
    level = (level + 1) % 3;
    store.set('haptics', level);
    buzz([90, 60, 90]);
    return level;
  },
  tap: () => buzz(40),
  // Only PERFECT near misses buzz (rate-limited by the game) — close calls and steering never do.
  perfect: () => buzz(45),
  gift: () => buzz(60),
  shieldBreak: () => buzz([80, 40, 120]),
  purchase: () => buzz([40, 50, 60]),
  card: () => buzz(50),
  milestone: () => buzz([60, 50, 90]),
  waveClear: () => buzz([60, 50, 90]),
  bossHit: () => buzz([60, 30, 60]),
  bossDefeated: () => buzz([120, 60, 120, 60, 250]),
  bossIntro: () => buzz([200, 100, 200]),
  collision: () => buzz([180, 60, 320]),
  stop: () => { try { navigator.vibrate(0); } catch { /* ignore */ } },
};
