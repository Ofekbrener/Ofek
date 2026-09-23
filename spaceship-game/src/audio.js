import { store } from './storage.js';

// Fully procedural sound design with the Web Audio API — no audio files.
// Music: a 16-step synthwave sequencer (kick, snare, hats, bass, arp, pad) whose
// tempo and layers grow with the level. SFX: engine hum, impact, near-miss whoosh,
// milestone chime, level-up sweep and UI blips.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A-minor loop: Am – F – C – G
const CHORDS = [
  { root: 33, tones: [57, 60, 64] },
  { root: 29, tones: [57, 60, 65] },
  { root: 36, tones: [55, 60, 64] },
  { root: 31, tones: [55, 59, 62] },
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 3, 2, 1, 0, 1];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = store.get('sound', '1') !== '1';
    this.intensity = 1;
    this.bpm = 118;
    this.musicOn = false;
    this.engineOn = false;
    this._timer = null;
  }

  get ready() { return !!this.ctx; }

  // Must be called from a user gesture (tap) — required by iOS / Chrome autoplay rules.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);

    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.musicFilter).connect(this.master);

    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.95;
    this.sfxBus.connect(this.master);

    this.engineBus = c.createGain();
    this.engineBus.gain.value = 0;
    this.engineBus.connect(this.master);

    // Echo send used by the arp and chimes.
    this.delay = c.createDelay(1.5);
    this.delay.delayTime.value = (60 / this.bpm) * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.35;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3000;
    this.delay.connect(damp).connect(fb).connect(this.delay);
    this.delayOut = c.createGain();
    this.delayOut.gain.value = 0.35;
    this.delay.connect(this.delayOut).connect(this.musicBus);

    // Shared white noise buffer.
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Soft-clip curve for the crunchy impact layer.
    const n = 1024;
    this.crunch = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      this.crunch[i] = Math.tanh(x * 6);
    }
  }

  setMuted(m) {
    this.muted = m;
    store.set('sound', m ? '0' : '1');
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  // ---------- helpers ----------
  _noise(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.start(t, Math.random() * Math.max(0, 1.9 - dur), dur + 0.05);
    return src;
  }
  _osc(type, freq, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    if (dur !== Infinity) o.stop(t + dur + 0.05);
    return o;
  }
  _env(t, attack, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }
  _filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  // ---------- music ----------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.musicFilter.frequency.cancelScheduledValues(this.ctx.currentTime);
    this.musicFilter.frequency.setTargetAtTime(18000, this.ctx.currentTime, 0.1);
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.05);
    this._timer = setInterval(() => this._schedule(), 25);
  }

  stopMusic(fade = 0.4) {
    if (!this.ctx || !this.musicOn) return;
    this.musicOn = false;
    clearInterval(this._timer);
    this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fade / 3);
  }

  // Muffle the music (game over, slow motion) without stopping it.
  muffleMusic(freq, time = 0.2) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, time);
  }

  setLevel(level) {
    this.intensity = level;
    this.bpm = Math.min(152, 118 + (level - 1) * 5);
    if (this.ctx) this.delay.delayTime.setTargetAtTime((60 / this.bpm) * 0.75, this.ctx.currentTime, 0.5);
  }

  _schedule() {
    if (!this.musicOn) return;
    const ahead = this.ctx.currentTime + 0.12;
    // If the tab stalled, skip forward instead of spamming notes.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.nextTime < ahead) {
      this._playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
      this.step++;
    }
  }

  _playStep(s, t) {
    const i16 = s % 16;
    const chord = CHORDS[Math.floor(s / 16) % 4];
    const lvl = this.intensity;
    const stepDur = 60 / this.bpm / 4;

    if (i16 % 4 === 0) this._kick(t);
    if (lvl >= 3 && (i16 === 4 || i16 === 12)) this._snare(t);
    if (i16 % 4 === 2) this._hat(t, 0.16);
    else if (lvl >= 3 && i16 % 2 === 1) this._hat(t, 0.06);

    if (i16 % 2 === 0) {
      const note = chord.root + (i16 % 4 === 2 ? 12 : 0);
      this._bass(mtof(note), t, stepDur * 1.7);
    }
    if (lvl >= 2) {
      const idx = ARP[i16];
      const m = idx < 3 ? chord.tones[idx] + 12 : chord.tones[0] + 24;
      this._arp(mtof(m), t, stepDur * 0.9);
    }
    if (i16 === 0) this._pad(chord.tones, t, stepDur * 16);
  }

  _kick(t) {
    const o = this._osc('sine', 150, t, 0.35);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this._env(t, 0.002, 0.9, 0.3);
    o.connect(g).connect(this.musicBus);
  }
  _snare(t) {
    const n = this._noise(t, 0.2);
    const f = this._filter('bandpass', 1900, 0.8);
    const g = this._env(t, 0.001, 0.35, 0.16);
    n.connect(f).connect(g).connect(this.musicBus);
    const o = this._osc('triangle', 190, t, 0.12);
    const g2 = this._env(t, 0.001, 0.2, 0.08);
    o.connect(g2).connect(this.musicBus);
  }
  _hat(t, vol) {
    const n = this._noise(t, 0.06);
    const f = this._filter('highpass', 7500, 0.7);
    const g = this._env(t, 0.001, vol, 0.045);
    n.connect(f).connect(g).connect(this.musicBus);
  }
  _bass(freq, t, dur) {
    const o = this._osc('sawtooth', freq, t, dur);
    const o2 = this._osc('square', freq * 0.5, t, dur);
    const f = this._filter('lowpass', 300, 6);
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(220, t + dur * 0.8);
    const g = this._env(t, 0.005, 0.28, dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.musicBus);
  }
  _arp(freq, t, dur) {
    const o = this._osc('square', freq, t, dur);
    const f = this._filter('lowpass', 2600, 2);
    const g = this._env(t, 0.004, 0.06, dur);
    o.connect(f).connect(g);
    g.connect(this.musicBus);
    g.connect(this.delay);
  }
  _pad(tones, t, dur) {
    const f = this._filter('lowpass', 900, 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.6);
    g.gain.setValueAtTime(0.045, t + dur - 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const m of tones) {
      for (const det of [-7, 7]) {
        const o = this._osc('sawtooth', mtof(m), t, dur);
        o.detune.value = det;
        o.connect(f);
      }
    }
    f.connect(g).connect(this.musicBus);
  }

  // ---------- engine hum ----------
  startEngine() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    if (!this.engineOn) {
      this.engineOn = true;
      this.engFilter = this._filter('lowpass', 260, 4);
      this.engOscs = [
        this._osc('sawtooth', 46, t, Infinity),
        this._osc('sawtooth', 46.7, t, Infinity),
        this._osc('sine', 23, t, Infinity),
      ];
      for (const o of this.engOscs) o.connect(this.engFilter);

      const rumble = c.createBufferSource();
      rumble.buffer = this.noiseBuf;
      rumble.loop = true;
      rumble.start(t);
      const rf = this._filter('bandpass', 500, 0.9);
      const rg = c.createGain();
      rg.gain.value = 0.35;
      rumble.connect(rf).connect(rg).connect(this.engFilter);
      this.engRumble = rumble;

      const lfo = this._osc('sine', 5.5, t, Infinity);
      const lfoGain = c.createGain();
      lfoGain.gain.value = 40;
      lfo.connect(lfoGain).connect(this.engFilter.frequency);
      this.engLfo = lfo;

      this.engFilter.connect(this.engineBus);
    }
    this.engineBus.gain.cancelScheduledValues(t);
    this.engineBus.gain.setTargetAtTime(0.22, t, 0.3);
  }

  setEngine(speedNorm, steer, timeScale) {
    if (!this.engineOn) return;
    const t = this.ctx.currentTime;
    const s = Math.abs(steer);
    const pitch = (40 + speedNorm * 34 + s * 8) * (0.55 + 0.45 * timeScale);
    this.engOscs[0].frequency.setTargetAtTime(pitch, t, 0.08);
    this.engOscs[1].frequency.setTargetAtTime(pitch * 1.015, t, 0.08);
    this.engOscs[2].frequency.setTargetAtTime(pitch * 0.5, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(220 + speedNorm * 520 + s * 380, t, 0.08);
  }

  stopEngine(fade = 0.3) {
    if (!this.engineOn) return;
    this.engineOn = false;
    const t = this.ctx.currentTime;
    this.engineBus.gain.cancelScheduledValues(t);
    this.engineBus.gain.setTargetAtTime(0.0001, t, fade / 3);
    const nodes = [...this.engOscs, this.engRumble, this.engLfo];
    for (const n of nodes) { try { n.stop(t + fade + 0.2); } catch { /* ignore */ } }
  }

  // ---------- SFX ----------
  collision() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Noise blast with a closing filter
    const n = this._noise(t, 1.6);
    const f = this._filter('lowpass', 5000, 0.8);
    f.frequency.setValueAtTime(5000, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 1.4);
    const g = this._env(t, 0.002, 1.0, 1.5);
    n.connect(f).connect(g).connect(this.sfxBus);
    // Sub boom
    const o = this._osc('sine', 120, t, 1.0);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.9);
    const g2 = this._env(t, 0.002, 1.0, 0.9);
    o.connect(g2).connect(this.sfxBus);
    // Distorted crunch
    const sq = this._osc('square', 70, t, 0.35);
    sq.frequency.exponentialRampToValueAtTime(30, t + 0.3);
    const ws = this.ctx.createWaveShaper();
    ws.curve = this.crunch;
    const g3 = this._env(t, 0.001, 0.35, 0.3);
    sq.connect(ws).connect(g3).connect(this.sfxBus);
  }

  nearMiss(side = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise(t, 0.6);
    const f = this._filter('bandpass', 400, 1.8);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3800, t + 0.18);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    const g = this._env(t, 0.06, 0.8, 0.45);
    let out = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.setValueAtTime(side * 0.9, t);
      p.pan.linearRampToValueAtTime(-side * 0.6, t + 0.45);
      g.connect(p);
      out = p;
    }
    n.connect(f).connect(g);
    out.connect(this.sfxBus);
    // Reward blip
    const o = this._osc('triangle', 880, t + 0.05, 0.25);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.2);
    const g2 = this._env(t + 0.05, 0.005, 0.12, 0.2);
    o.connect(g2).connect(this.sfxBus);
  }

  // FM bell arpeggio for score milestones.
  chime() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [76, 80, 83, 88].forEach((m, i) => {
      const t = t0 + i * 0.085;
      const f = mtof(m);
      const car = this._osc('sine', f, t, 1.6);
      const mod = this._osc('sine', f * 3.5, t, 1.6);
      const modGain = this.ctx.createGain();
      modGain.gain.setValueAtTime(f * 2.5, t);
      modGain.gain.exponentialRampToValueAtTime(1, t + 1.2);
      mod.connect(modGain).connect(car.frequency);
      const g = this._env(t, 0.003, 0.22, 1.4);
      car.connect(g);
      g.connect(this.sfxBus);
      g.connect(this.delay);
    });
  }

  levelUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc('sawtooth', 220, t, 0.7);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.6);
    const f = this._filter('lowpass', 400, 8);
    f.frequency.exponentialRampToValueAtTime(5000, t + 0.6);
    const g = this._env(t, 0.05, 0.16, 0.6);
    o.connect(f).connect(g).connect(this.sfxBus);
    g.connect(this.delay);
  }

  // Tiny rising tick as the score climbs toward the next milestone.
  scoreTick(progress) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc('sine', 660 + progress * 660, t, 0.08);
    const g = this._env(t, 0.002, 0.05, 0.07);
    o.connect(g).connect(this.sfxBus);
  }

  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc('square', 520, t, 0.08);
    o.frequency.exponentialRampToValueAtTime(1040, t + 0.05);
    const f = this._filter('lowpass', 3000);
    const g = this._env(t, 0.002, 0.08, 0.07);
    o.connect(f).connect(g).connect(this.sfxBus);
  }
}
