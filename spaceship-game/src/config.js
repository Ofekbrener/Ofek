// Central tuning knobs. Tweak here to rebalance the game.
export const CONFIG = {
  // Play field (world units). Ship moves on X only, obstacles fly toward +Z.
  halfWidth: 3.4,
  spawnZ: -140,
  despawnZ: 12,
  floorY: -1.6,

  // Ship
  shipRadius: 0.5,          // forgiving hitbox (smaller than the visual)
  shipSpring: 190,          // stiffness of the steering spring (runs in real time)
  buttonSteerMin: 6,        // units / second when a button is first pressed…
  buttonSteerMax: 13,       // …accelerating to this while held
  buttonAccelTime: 0.25,    // seconds to reach max button speed
  dragSensitivity: 1.8,     // full screen-width drag = sensitivity * field width
  dragSmoothing: 0.025,     // seconds; low-pass on the finger target to hide touch jitter

  // Difficulty curve
  baseSpeed: 26,
  maxSpeed: 78,
  speedRamp: 0.75,          // units / s gained every second
  baseSpawnInterval: 0.95,  // seconds between spawns at the start
  minSpawnInterval: 0.34,
  spawnCurve: 80,           // seconds until spawn rate is ~63% of the way to min
  levelDuration: 20,        // seconds per level
  cardsEveryLevels: 1,      // offer a pick-1-of-3 power-up every N level-ups

  // Scoring
  distanceScore: 0.5,       // points per world unit travelled
  nearMissMargin: 0.4,      // gap (units) that counts as a close call
  perfectMargin: 0.15,      // gap that counts as a PERFECT near miss
  nearMissBonus: 15,
  perfectBonus: 40,
  comboWindow: 3.5,         // seconds to chain near misses
  maxCombo: 4,
  milestone: 500,           // chime + banner every N points

  // Pickups
  crystalRadius: 0.8,
  crystalScoreBonus: 5,     // points per crystal collected
  payoutScoreDivisor: 50,   // end-of-run bonus crystals = score / N

  // Game feel
  slowMoScale: 0.45,
  slowMoDuration: 0.25,     // real seconds at full slow-mo
  perfectCooldown: 4,       // min real seconds between PERFECT slow-mo moments
  deathSlowMo: 0.22,
  deathDelay: 1.5,          // real seconds from impact to game-over screen
  shieldGrace: 1.2,         // invulnerability after a shield absorbs a hit
  resumeGrace: 1.0,         // invulnerability after choosing a power-up

  // Rendering / performance
  maxPixelRatio: 2,
  lowPixelRatio: 1.25,
  particlesHigh: 1400,
  particlesLow: 700,
  starsHigh: 1400,
  starsLow: 700,
  maxObstacles: 90,
  maxPickups: 60,
};

// Quality tier: start optimistic on capable devices, auto-downgrade on slow frames.
export function initialQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return cores <= 4 || mem <= 2 ? 'low' : 'high';
}
