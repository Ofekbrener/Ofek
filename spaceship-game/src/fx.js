import { CONFIG } from './config.js';

// Game-feel layer: trauma-based screen shake, time dilation (slow-mo), FOV kicks
// and full-screen colour flashes.
export class FX {
  constructor(flashEl) {
    this.trauma = 0;
    this.timeScale = 1;
    this.slowTimer = 0;       // real seconds remaining at full slow-mo
    this.slowTarget = 1;
    this.fovKick = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeRoll = 0;
    this.t = 0;
    this.flashEl = flashEl;
    this.flashAnim = null;
  }

  reset() {
    this.trauma = 0;
    this.timeScale = 1;
    this.slowTimer = 0;
    this.slowTarget = 1;
    this.fovKick = 0;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // Time dilation. Callers decide how often this may happen (see perfect near-miss cooldown).
  slowMo(scale = CONFIG.slowMoScale, duration = CONFIG.slowMoDuration) {
    this.slowTarget = scale;
    this.timeScale = Math.min(this.timeScale, scale + 0.15);
    this.slowTimer = duration;
  }

  kickFov(amount) {
    this.fovKick = Math.max(this.fovKick, amount);
  }

  flash(color, opacity = 0.6, duration = 300) {
    if (!this.flashEl.animate) return;
    this.flashEl.style.background = color;
    if (this.flashAnim) this.flashAnim.cancel();
    this.flashAnim = this.flashEl.animate(
      [{ opacity }, { opacity: 0 }],
      { duration, easing: 'ease-out' },
    );
  }

  update(realDt) {
    this.t += realDt;

    // Time dilation: snap into slow-mo, hold, then ease back to normal speed.
    if (this.slowTimer > 0) {
      this.slowTimer -= realDt;
      this.timeScale += (this.slowTarget - this.timeScale) * (1 - Math.exp(-25 * realDt));
    } else {
      this.timeScale += (1 - this.timeScale) * (1 - Math.exp(-5 * realDt));
      if (this.timeScale > 0.995) this.timeScale = 1;
    }

    // Shake uses trauma² for a punchy falloff and smooth pseudo-noise.
    this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    const s = this.trauma * this.trauma;
    const t = this.t * 38;
    this.shakeX = s * 0.6 * (Math.sin(t * 1.1) + Math.sin(t * 2.3 + 1.7) * 0.5);
    this.shakeY = s * 0.45 * (Math.sin(t * 1.7 + 0.3) + Math.sin(t * 3.1 + 4.1) * 0.5);
    this.shakeRoll = s * 0.06 * Math.sin(t * 1.3 + 2.2);

    this.fovKick *= Math.exp(-realDt * 4);
  }
}
