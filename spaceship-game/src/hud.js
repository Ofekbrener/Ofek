const $ = (id) => document.getElementById(id);

// DOM HUD: score counter with "pop" feedback, floating bonus text, banners.
export class HUD {
  constructor() {
    this.root = $('hud');
    this.scoreEl = $('hud-score');
    this.levelEl = $('hud-level');
    this.comboEl = $('hud-combo');
    this.popups = $('popups');
    this.banner = $('banner');
    this.shown = -1;
    this.bannerTimer = null;
    this.bannerAnim = null;
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  reset() {
    this.shown = -1;
    this.setScore(0);
    this.setLevel(1);
    this.setCombo(1);
    this.popups.textContent = '';
    this.banner.classList.add('hidden');
  }

  setScore(score) {
    const s = Math.floor(score);
    if (s === this.shown) return;
    this.shown = s;
    this.scoreEl.textContent = s.toLocaleString();
  }

  // Scale "pop" on the score — bigger for bigger moments.
  pop(strength = 1, color = null) {
    if (!this.scoreEl.animate) return;
    const peak = 1 + 0.18 * strength;
    const frames = [
      { transform: `scale(${peak})`, color: color || '#ffffff', offset: 0.25 },
      { transform: 'scale(1)', color: '#e8f1ff' },
    ];
    frames.unshift({ transform: 'scale(1)' });
    this.scoreEl.animate(frames, { duration: 260 + strength * 80, easing: 'cubic-bezier(.2,1.6,.4,1)' });
  }

  setLevel(level) {
    this.levelEl.textContent = level;
  }

  setCombo(combo) {
    if (combo > 1) {
      this.comboEl.textContent = `COMBO x${combo}`;
      this.comboEl.classList.remove('hidden');
    } else {
      this.comboEl.classList.add('hidden');
    }
  }

  // Floating text that drifts up and fades, e.g. "+50 NEAR MISS".
  popup(text, xFrac = 0.5, cls = '') {
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    el.style.left = `${Math.min(85, Math.max(15, xFrac * 100))}%`;
    this.popups.appendChild(el);
    if (!el.animate) { setTimeout(() => el.remove(), 900); return; }
    const a = el.animate(
      [
        { transform: 'translate(-50%, 10px) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -6px) scale(1.15)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%, -60px) scale(1)', opacity: 0 },
      ],
      { duration: 950, easing: 'ease-out' },
    );
    a.onfinish = () => el.remove();
  }

  showBanner(text, ms = 1400) {
    const b = this.banner;
    b.textContent = text;
    b.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    if (b.animate) {
      if (this.bannerAnim) this.bannerAnim.cancel();
      this.bannerAnim = b.animate(
        [
          { transform: 'scale(2.2)', opacity: 0, letterSpacing: '0.5em' },
          { transform: 'scale(1)', opacity: 1, letterSpacing: '0.12em', offset: 0.18 },
          { transform: 'scale(1)', opacity: 1, offset: 0.75 },
          { transform: 'scale(0.9)', opacity: 0 },
        ],
        { duration: ms, easing: 'ease-out', fill: 'forwards' },
      );
    }
    this.bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
  }
}
