import { store } from './storage.js';

// Thin wrapper over the Vibration API. Silently no-ops where unsupported (e.g. iOS Safari).
const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
let enabled = store.get('haptics', '1') === '1';

function buzz(pattern) {
  if (!supported || !enabled) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

export const haptics = {
  supported,
  get enabled() { return enabled; },
  setEnabled(v) {
    enabled = v;
    store.set('haptics', v ? '1' : '0');
    if (v) buzz(20);
  },
  tap: () => buzz(12),
  // Only PERFECT near misses buzz (rate-limited by the game) — regular close
  // calls and steering never vibrate.
  perfect: () => buzz(22),
  shieldBreak: () => buzz([50, 30, 70]),
  purchase: () => buzz([15, 40, 25]),
  card: () => buzz(18),
  milestone: () => buzz([30, 60, 30, 60, 60]),
  levelUp: () => buzz([20, 40, 20]),
  collision: () => buzz([90, 40, 180, 40, 60]),
  stop: () => buzz(0),
};
