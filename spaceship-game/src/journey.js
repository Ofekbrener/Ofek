import { GALAXIES, WAVES_PER_GALAXY, WAVE_DURATION, ENDLESS_BOSS_EVERY } from './galaxies.js';

const DRAIN_TIME = 2.2;   // world-seconds after a wave's spawning stops before it's "cleared"
const INTRO_TIME = 2.6;

// Campaign / endless state machine + the wave director that decides what spawns.
//
// phases: intro → wave → draining → (main shows wave-clear + cards) → wave … →
//         bossIntro → boss → victory
export class Journey {
  constructor({ obstacles, chickens, pickups, boss }) {
    this.obstacles = obstacles;
    this.chickens = chickens;
    this.pickups = pickups;
    this.boss = boss;
    this.endless = false;
    this.gIndex = 0;
    this.wave = 0;           // campaign: 0..3 normal, 4 = boss. endless: global counter
    this.phase = 'idle';
    this.t = 0;
    this.spawnT = 0;
    this.bomberCd = 0;
    this.stats = this._freshStats();
  }

  _freshStats() { return { hits: 0, drumsSpawned0: 0, drumsCollected: 0 }; }

  get galaxy() { return GALAXIES[this.gIndex]; }
  get loop() { return this.endless ? Math.floor(this.wave / (ENDLESS_BOSS_EVERY * GALAXIES.length)) : 0; }

  // Wave index inside the current galaxy (0..3, 4 = boss)
  get localWave() { return this.endless ? this.wave % ENDLESS_BOSS_EVERY : this.wave; }
  get isBossWave() { return this.localWave >= WAVES_PER_GALAXY; }

  // Difficulty 0..1 across the galaxy's waves, plus endless loops.
  get waveProgress() { return Math.min(1, this.localWave / (WAVES_PER_GALAXY - 1)); }

  get level() { return this.gIndex + this.localWave * 0.5 + this.loop * 3; }

  get speed() {
    const [a, b] = this.galaxy.speed;
    const boss = this.isBossWave ? a + (b - a) * 0.3 : a + (b - a) * this.waveProgress;
    return Math.min(90, boss * (1 + this.loop * 0.15));
  }

  get spawnInterval() {
    const [a, b] = this.galaxy.spawn;
    return (a + (b - a) * this.waveProgress) / (1 + this.loop * 0.12);
  }

  // Fraction of the current wave elapsed (for the HUD progress bar).
  get waveFrac() {
    if (this.phase === 'wave') return Math.min(1, this.t / WAVE_DURATION);
    if (this.phase === 'draining') return 1;
    return 0;
  }

  startCampaign(gIndex) {
    this.endless = false;
    this.gIndex = gIndex;
    this.wave = 0;
    this._beginGalaxy();
  }

  startEndless() {
    this.endless = true;
    this.gIndex = 0;
    this.wave = 0;
    this._beginGalaxy();
  }

  // Campaign: after a victory, fly on to the next galaxy (keeping the run).
  nextGalaxy() {
    this.gIndex = Math.min(GALAXIES.length - 1, this.gIndex + 1);
    this.wave = 0;
    this._beginGalaxy();
  }

  _beginGalaxy() {
    this.phase = 'intro';
    this.t = 0;
    this.stats = this._freshStats();
    this.stats.drumsSpawned0 = this.pickups.spawned;
  }

  // Called by main after the wave-clear cards are done.
  nextWave() {
    this.wave++;
    if (this.endless && this.wave % ENDLESS_BOSS_EVERY === 0) {
      // Endless: after a boss wave block, warp into the next galaxy in the cycle.
      this.gIndex = Math.floor(this.wave / ENDLESS_BOSS_EVERY) % GALAXIES.length;
      return 'warp';
    }
    this._startPhase();
    return this.phase;
  }

  // Endless: after warping, begin the new galaxy's first wave.
  afterWarp() {
    this.phase = 'intro';
    this.t = 0;
    this.stats = this._freshStats();
    this.stats.drumsSpawned0 = this.pickups.spawned;
  }

  _startPhase() {
    this.t = 0;
    this.spawnT = 0.6;
    if (this.isBossWave) {
      this.phase = 'bossIntro';
      this.boss.start(this.galaxy.boss, this.level, this.galaxy.boss.color);
    } else {
      this.phase = 'wave';
    }
  }

  /**
   * Advance the journey. Returns an event name for main to react to:
   * 'waveStart', 'waveClear', 'bossFight', or null.
   */
  update(dt) {
    this.t += dt;
    this.bomberCd -= dt;
    switch (this.phase) {
      case 'intro':
        if (this.t > INTRO_TIME) { this._startPhase(); return this.phase === 'wave' ? 'waveStart' : null; }
        return null;
      case 'wave':
        this._direct(dt);
        if (this.t >= WAVE_DURATION) { this.phase = 'draining'; this.t = 0; }
        return null;
      case 'draining':
        if (this.t >= DRAIN_TIME) { this.phase = 'cleared'; return 'waveClear'; }
        return null;
      case 'bossIntro':
        if (!this.boss.entering) { this.phase = 'boss'; return 'bossFight'; }
        return null;
      default:
        return null;
    }
  }

  // Wave director: weighted pick from the galaxy's hazard table.
  _direct(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const hz = this.galaxy.hazards;
    let total = 0;
    for (const [k, w] of Object.entries(hz)) {
      if (w <= 0) continue;
      if (k === 'bombers' && this.bomberCd > 0) continue;
      total += w;
    }
    let r = Math.random() * total;
    let choice = 'rocks';
    for (const [k, w] of Object.entries(hz)) {
      if (w <= 0 || (k === 'bombers' && this.bomberCd > 0)) continue;
      r -= w;
      if (r <= 0) { choice = k; break; }
    }

    let weight;
    if (choice === 'flock') {
      const kinds = ['line', 'v', 'swoop'];
      this.chickens.spawnFormation(kinds[(Math.random() * 3) | 0], undefined, this.level);
      weight = 1.3;
    } else if (choice === 'bombers') {
      this.chickens.spawnBombers(2 + (this.level >= 3 ? 1 : 0), Math.max(0.8, 1.4 - this.level * 0.08));
      this.bomberCd = 9;
      weight = 0.8;
    } else {
      weight = this.obstacles.spawnPattern(choice, this.level);
    }
    this.spawnT = this.spawnInterval * weight * (0.85 + Math.random() * 0.3);
  }

  // Star rating for the galaxy just cleared.
  stars(drumsCollected) {
    const spawned = Math.max(1, this.pickups.spawned - this.stats.drumsSpawned0);
    let s = 1;
    if (this.stats.hits === 0) s = 2;
    if (this.stats.hits === 0 && drumsCollected / spawned >= 0.7) s = 3;
    return s;
  }
}
