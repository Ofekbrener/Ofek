// Sound effects synthesised with Web Audio (no audio files), plus vibration.
// The AudioContext starts on the first touch, as mobile browsers require.
let ctx = null, master = null;
const opts = { sound: true, vibration: true };

export function configureAudio(settings) { Object.assign(opts, settings); }

function ensure() {
  if (ctx || typeof AudioContext === 'undefined') return ctx;
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  return ctx;
}
addEventListener('pointerdown', () => { ensure(); ctx?.resume?.(); }, { once: false, passive: true });

function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, f0, f1, vol = 0.4, q = 1) {
  noiseBuf ??= (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}

const SOUNDS = {
  swing: () => noise(0.18, 600, 2400, 0.35, 0.8),
  arrow: () => { tone('triangle', 700, 260, 0.12, 0.35); noise(0.12, 3000, 1200, 0.15, 2); },
  hit: () => { tone('sine', 180, 60, 0.12, 0.6); noise(0.08, 1800, 600, 0.25, 1.5); tone('square', 900, 500, 0.05, 0.08); },
  crit: () => { tone('sine', 220, 50, 0.2, 0.8); noise(0.14, 2600, 500, 0.4, 1.2); tone('triangle', 1400, 700, 0.12, 0.2); },
  heavy: () => { noise(0.28, 300, 2200, 0.45, 0.7); tone('sawtooth', 120, 60, 0.2, 0.15); },
  coin: () => { tone('square', 1568, 1568, 0.05, 0.12); tone('square', 2093, 2093, 0.12, 0.12, 0.05); },
  hurt: () => tone('square', 240, 90, 0.2, 0.25),
  jump: () => tone('square', 320, 640, 0.12, 0.15),
  pickup: () => { tone('sine', 988, 988, 0.08, 0.3); tone('sine', 1319, 1319, 0.14, 0.3, 0.07); },
  levelup: () => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.25, 0.35, i * 0.08));
    [1047, 1319, 1568].forEach(f => tone('sine', f, f, 0.9, 0.18, 0.5));
  },
  portal: () => tone('sine', 300, 1200, 0.45, 0.3),
  potion: () => { tone('sine', 500, 900, 0.15, 0.3); tone('sine', 700, 1200, 0.15, 0.2, 0.08); },
};
const VIBES = { hurt: 60, levelup: [40, 60, 40, 60, 80], hit: 12, crit: 30, heavy: 25 };

export function sfx(name) {
  if (opts.vibration && VIBES[name] && navigator.vibrate) { try { navigator.vibrate(VIBES[name]); } catch { /* unsupported */ } }
  if (!opts.sound || !ensure() || ctx.state !== 'running') return;
  SOUNDS[name]?.();
}
