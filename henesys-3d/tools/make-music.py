"""Original background music for each area (no MapleStory audio). Small
synth band: bass, chords, a lead melody and light drums, rendered as seamless
loops to tools/sfx-src/bgm_*.mp3.

    python3 henesys-3d/tools/make-music.py
"""
import os, subprocess, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx-src')
rng = np.random.default_rng(3)
def hz(n): return 440 * 2 ** ((n - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'highpass', fs=SR, output='sos'), x)

def voice(kind, f, d):
    x = np.arange(int(SR * d)) / SR
    if kind == 'pluck':   # soft guitar / harp
        y = sum(np.sin(2 * np.pi * f * h * x) / h ** 1.6 for h in range(1, 6)); e = np.exp(-4.5 * x)
    elif kind == 'flute':
        vib = 1 + .004 * np.sin(2 * np.pi * 5 * x)
        y = np.sin(2 * np.pi * np.cumsum(f * vib) / SR) + .15 * np.sin(4 * np.pi * np.cumsum(f * vib) / SR)
        e = np.minimum(1, x / .05) * np.exp(-.8 * x)
    elif kind == 'bell':
        y = np.sin(2 * np.pi * f * x) + .4 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-6 * x); e = np.exp(-3 * x)
    elif kind == 'bass':
        y = np.sin(2 * np.pi * f * x) + .3 * np.sin(4 * np.pi * f * x); e = np.minimum(1, x / .01) * np.exp(-2.5 * x)
    elif kind == 'pad':
        y = sum(np.sin(2 * np.pi * f * (1 + dt) * x) for dt in (-.003, 0, .003)) / 3; e = np.minimum(1, x / .3) * np.minimum(1, (d - x) / .3)
    elif kind == 'organ':
        y = sum(np.sin(2 * np.pi * f * h * x) * a for h, a in ((1, 1), (2, .5), (4, .25))); e = np.minimum(1, x / .02) * np.minimum(1, (d - x) / .05)
    return y * e

def drum(kind):
    x = np.arange(int(SR * .25)) / SR
    if kind == 'kick': return np.sin(2 * np.pi * np.cumsum(np.geomspace(120, 45, len(x))) / SR) * np.exp(-14 * x)
    if kind == 'snare': return hp(rng.uniform(-1, 1, len(x)), 1200) * np.exp(-22 * x) * .5
    if kind == 'hat': return hp(rng.uniform(-1, 1, len(x)), 7000) * np.exp(-60 * x) * .25

def render(name, bpm, bars, chords, melody, lead, beat, root_oct=48, swing=0.0, pad=False):
    beat_s = 60 / bpm; total = int(SR * beat_s * 4 * bars); out = np.zeros(total + SR * 2)
    def put(y, at, gain):
        s = int(SR * at); out[s:s + len(y)] += y * gain
    for bar in range(bars):
        ch = chords[bar % len(chords)]; t0 = bar * 4 * beat_s
        put(voice('bass', hz(root_oct + ch[0] - 12), beat_s * 1.8), t0, .55)
        put(voice('bass', hz(root_oct + ch[0] - 12 + 7), beat_s * 1.8), t0 + 2 * beat_s, .45)
        if pad:
            for n in ch: put(voice('pad', hz(root_oct + 12 + n), beat_s * 4), t0, .09)
        for step in range(8):   # arpeggio in eighths
            n = ch[[0, 1, 2, 1, 0, 2, 1, 2][step]] + 12
            put(voice('pluck', hz(root_oct + n), beat_s * .9), t0 + step * beat_s / 2 + (swing * beat_s / 2 if step % 2 else 0), .16)
        for step, k in enumerate(beat):
            if k: put(drum(k), t0 + step * beat_s / 2, .5)
    at = 0.0
    for n, d in melody:          # (midi or None, beats)
        if n is not None: put(voice(lead, hz(n), d * beat_s * 1.05), at, .22)
        at += d * beat_s
    # room reverb, then fold the tail back to the start so the loop is seamless
    ir = rng.uniform(-1, 1, int(SR * 1.2)) * np.exp(-5 * np.arange(int(SR * 1.2)) / SR); ir = lp(ir, 5000)
    wet = fftconvolve(out, ir)[:len(out)]; out = out + wet / np.max(np.abs(wet)) * np.max(np.abs(out)) * .25
    loop = out[:total].copy(); loop[:len(out) - total] += out[total:]
    loop = lp(loop, 9000); loop = loop / np.max(np.abs(loop)) * .8
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (loop * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f.name, '-ac', '1', '-b:a', '56k', os.path.join(OUT, f'bgm_{name}.mp3')], check=True)
        os.unlink(f.name)
    print('made bgm', name, f'{total / SR:.1f}s')

# chords as semitone offsets from C (C=0): I, vi, IV, V ...
I, ii, iii, IV, V, vi = (0, 4, 7), (2, 5, 9), (4, 7, 11), (5, 9, 12), (7, 11, 14), (9, 12, 16)
C5 = 72
def mel(*pairs): return [(None if n is None else C5 + n, d) for n, d in pairs]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    # Town: gentle, warm, flute over plucked guitar (G major feel via C chords)
    render('town', 96, 8, [I, vi, IV, V], mel((7, 1), (9, 1), (12, 2), (11, 1), (9, 1), (7, 2), (4, 1), (5, 1), (7, 2), (5, 1), (4, 1), (2, 2),
        (7, 1), (9, 1), (12, 1.5), (14, .5), (12, 1), (11, 1), (9, 2), (7, 1), (5, 1), (4, 1), (2, 1), (0, 4)), 'flute',
        ['kick', None, 'hat', None, 'snare', None, 'hat', 'hat'], pad=True)
    # Fields: upbeat adventure, bell lead, swing
    render('field', 124, 8, [I, V, vi, IV], mel((0, .5), (4, .5), (7, .5), (12, 1.5), (11, .5), (9, .5), (7, 1), (None, 1), (9, .5), (11, .5), (12, 1), (14, 1), (12, 2), (None, 1),
        (7, .5), (9, .5), (11, 1), (12, .5), (11, .5), (9, 1), (7, 1), (4, 1), (5, 1), (7, 2), (None, 2)), 'bell',
        ['kick', 'hat', 'snare', 'hat', 'kick', 'kick', 'snare', 'hat'], swing=.2)
    # Pig farm: bouncy and silly
    render('farm', 132, 8, [I, IV, I, V], mel((0, .5), (0, .5), (7, .5), (7, .5), (9, .5), (9, .5), (7, 1), (5, .5), (5, .5), (4, .5), (4, .5), (2, .5), (2, .5), (0, 1),
        (7, .5), (7, .5), (5, .5), (5, .5), (4, .5), (4, .5), (2, 1), (7, .5), (7, .5), (5, .5), (5, .5), (4, .5), (4, .5), (2, 1)), 'pluck',
        ['kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'snare'], swing=.35)
    # Ruins: minor, slow, organ and pad
    i_, iv_, v_, VI_ = (0, 3, 7), (5, 8, 12), (7, 10, 14), (8, 12, 15)
    render('ruins', 78, 8, [i_, VI_, iv_, v_], mel((0, 2), (3, 1), (7, 1), (8, 3), (7, 1), (5, 2), (3, 2), (2, 4), (0, 2), (3, 1), (5, 1), (7, 3), (8, 1), (7, 2), (2, 2), (0, 4)), 'organ',
        ['kick', None, None, 'hat', 'snare', None, None, 'hat'], root_oct=45, pad=True)
