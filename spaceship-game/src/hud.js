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
    this.crystalEl = $('hud-crystals');
    this.crystalCount = $('hud-crystal-count');
    this.shieldsEl = $('hud-shields');
    this.powersEl = $('hud-powers');
    this.activePopup = null;
    this.shieldCount = -1;
    this.galaxyEl = $('hud-galaxy');
    this.progressEl = $('hud-progress');
    this.effectEl = $('hud-effect');
    this.bossBar = $('boss-bar');
    this.bossName = $('boss-name');
    this.bossFill = $('boss-hp-fill');
    this.card = $('galaxy-card');
    this.segs = [];
    this._progKey = '';
    this.shown = -1;
    this.bannerTimer = null;
    this.bannerAnim = null;
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  reset() {
    this.shown = -1;
    this.setScore(0);
    this.setLevel('WAVE 1');
    this.showBoss(null);
    this.setEffect(null);
    this.setCombo(1);
    this.popups.textContent = '';
    this.activePopup = null;
    this.banner.classList.add('hidden');
    this.setCrystals(0, false);
    this.setShields(0);
    this.setPowers({}, []);
  }

  setCrystals(n, pop = true) {
    this.crystalCount.textContent = n;
    if (pop && this.crystalEl.animate) {
      this.crystalEl.animate(
        [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
        { duration: 220, easing: 'cubic-bezier(.2,1.6,.4,1)' },
      );
    }
  }

  setShields(n) {
    if (n === this.shieldCount) return;
    this.shieldCount = n;
    this.shieldsEl.textContent = '';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'shield-pip';
      this.shieldsEl.appendChild(p);
    }
  }

  // Small chips showing the power-ups picked this run, e.g. "💎 ×2".
  setPowers(picked, defs) {
    this.powersEl.textContent = '';
    for (const d of defs) {
      const n = picked[d.id] || 0;
      if (!n || d.id === 'shield') continue;
      const c = document.createElement('div');
      c.className = 'power-chip';
      c.textContent = n > 1 ? `${d.icon} ×${n}` : d.icon;
      c.title = d.name;
      this.powersEl.appendChild(c);
    }
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

  setLevel(label) {
    this.levelEl.textContent = label;
  }

  setGalaxy(name) { this.galaxyEl.textContent = name.toUpperCase(); }

  // Galaxy progress: 4 wave segments + a boss icon. `wave` 0..4, `frac` 0..1 within it.
  setProgress(wave, frac, waves = 4) {
    if (!this.segs.length || this.segs.length !== waves) {
      this.progressEl.textContent = '';
      this.segs = [];
      for (let i = 0; i < waves; i++) {
        const seg = document.createElement('div');
        seg.className = 'seg';
        const fill = document.createElement('i');
        seg.appendChild(fill);
        this.progressEl.appendChild(seg);
        this.segs.push(fill);
      }
      this.bossIcon = document.createElement('div');
      this.bossIcon.className = 'boss';
      this.bossIcon.textContent = '🐔';
      this.progressEl.appendChild(this.bossIcon);
    }
    const key = `${wave}:${Math.round(frac * 50)}`;
    if (key === this._progKey) return;
    this._progKey = key;
    this.segs.forEach((f, i) => {
      f.style.width = `${i < wave ? 100 : i === wave ? frac * 100 : 0}%`;
    });
    this.bossIcon.classList.toggle('on', wave >= waves);
  }

  showBoss(name) {
    this.bossBar.classList.toggle('hidden', !name);
    if (name) { this.bossName.textContent = name; this.setBossHp(1); }
  }

  setBossHp(frac) { this.bossFill.style.width = `${Math.max(0, frac) * 100}%`; }

  setEffect(text) {
    this.effectEl.classList.toggle('hidden', !text);
    if (text) this.effectEl.textContent = text;
  }

  galaxyCard(num, name, tag) {
    const c = this.card;
    $('galaxy-card-num').textContent = num;
    $('galaxy-card-name').textContent = name.toUpperCase();
    $('galaxy-card-tag').textContent = tag;
    c.classList.add('hidden');
    void c.offsetWidth;
    c.classList.remove('hidden');
    clearTimeout(this._cardT);
    this._cardT = setTimeout(() => c.classList.add('hidden'), 2700);
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
    // Limiter: only one popup on screen — a new one replaces the old.
    if (this.activePopup) this.activePopup.remove();
    const el = document.createElement('div');
    this.activePopup = el;
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
    a.onfinish = () => { el.remove(); if (this.activePopup === el) this.activePopup = null; };
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
