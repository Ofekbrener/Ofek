// Central tuning knobs. Tweak here to rebalance the game.
export const CONFIG = {
  // Play field (world units). Ship moves on X only, obstacles fly toward +Z.
  halfWidth: 3.4,
  spawnZ: -140,
  despawnZ: 12,
  floorY: -1.6,

  // Ship
  shipRadius: 0.5,          // forgiving hitbox (smaller than the visual)
  shipSpring: 140,          // stiffness of the steering spring
  buttonSteerSpeed: 9,      // units / second while holding an on-screen button
  dragSensitivity: 1.5,     // full screen-width drag = sensitivity * field width

  // Difficulty curve
  baseSpeed: 26,
  maxSpeed: 78,
  speedRamp: 0.75,          // units / s gained every second
  baseSpawnInterval: 0.95,  // seconds between spawns at the start
  minSpawnInterval: 0.34,
  spawnCurve: 80,           // seconds until spawn rate is ~63% of the way to min
  levelDuration: 20,        // seconds per level

  // Scoring
  distanceScore: 0.5,       // points per world unit travelled
  nearMissMargin: 0.85,     // gap (units) that counts as a near miss
  nearMissBonus: 15,
  comboWindow: 3.5,         // seconds to chain near misses
  maxCombo: 4,
  milestone: 500,           // chime + banner every N points

  // Game feel
  slowMoScale: 0.3,
  slowMoDuration: 0.32,     // real seconds at full slow-mo
  slowMoCooldown: 1.4,
  deathSlowMo: 0.22,
  deathDelay: 1.5,          // real seconds from impact to game-over screen

  // Rendering / performance
  maxPixelRatio: 2,
  lowPixelRatio: 1.25,
  particlesHigh: 1400,
  particlesLow: 700,
  starsHigh: 1400,
  starsLow: 700,
  maxObstacles: 90,
};

// Quality tier: start optimistic on capable devices, auto-downgrade on slow frames.
export function initialQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return cores <= 4 || mem <= 2 ? 'low' : 'high';
}
