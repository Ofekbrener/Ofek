"""36 s trailer cue at 120 bpm (one bar = 2 s, so cuts land on bars).
Bars 0-1 intro, 2-15 full band, 16-17 build, 18 final hit.
    python3 henesys-3d/tools/trailer/music.py OUT.wav
"""
import sys, os, importlib.util
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve
spec = importlib.util.spec_from_file_location('mm', os.path.join(os.path.dirname(__file__), '..', 'make-music.py'))
mm = importlib.util.module_from_spec(spec); spec.loader.exec_module(mm)
SR, voice, drum, hz, lp, hp, rng = mm.SR, mm.voice, mm.drum, mm.hz, mm.lp, mm.hp, mm.rng

BEAT = 0.5; BAR = 2.0; TOTAL = 38.0
out = np.zeros(int(SR * TOTAL))
def put(y, at, g):
    s = int(SR * at); e = min(len(out), s + len(y)); out[s:e] += y[:e - s] * g

I, V, vi, IV = (0, 4, 7), (7, 11, 14), (9, 12, 16), (5, 9, 12)
prog = [I, V, vi, IV]
root = 48
beat = ['kick', 'hat', 'snare', 'hat', 'kick', 'kick', 'snare', 'hat']
for bar in range(18):
    ch = prog[bar % 4]; t0 = bar * BAR
    for n in ch: put(voice('pad', hz(root + 12 + n), BAR), t0, .08 if bar < 2 else .06)
    if bar >= 2:
        put(voice('bass', hz(root + ch[0] - 12), BEAT * 1.8), t0, .6)
        put(voice('bass', hz(root + ch[0] - 12 + 7), BEAT * 1.8), t0 + 2 * BEAT, .5)
        for step in range(8):
            n = ch[[0, 1, 2, 1, 0, 2, 1, 2][step]] + 12
            put(voice('pluck', hz(root + n), BEAT * .9), t0 + step * BEAT / 2, .16)
    if 2 <= bar < 16:
        for step, k in enumerate(beat):
            if k: put(drum(k), t0 + step * BEAT / 2, .55)
    if bar in (16, 17):   # build: snare roll getting denser and louder
        n = 8 if bar == 16 else 16
        for i in range(n): put(drum('snare'), t0 + i * BAR / n, .35 + .4 * (bar - 16 + i / n))
        put(drum('kick'), t0, .6)
# intro bell motif, then the field melody twice
motif = [(7, .5), (9, .5), (12, 1), (14, 1), (12, 1)] * 2
melody = [(0, .5), (4, .5), (7, .5), (12, 1.5), (11, .5), (9, .5), (7, 1), (None, 1), (9, .5), (11, .5), (12, 1), (14, 1), (12, 2), (None, 1),
          (7, .5), (9, .5), (11, 1), (12, .5), (11, .5), (9, 1), (7, 1), (4, 1), (5, 1), (7, 2), (None, 2)]
at = 0.0
for n, d in motif:
    put(voice('bell', hz(72 + n), d * BEAT * 1.1), at, .18); at += d * BEAT
at = 2 * BAR
for rep in range(2):
    for n, d in melody:
        if n is not None and at < 16 * BAR: put(voice('bell', hz(72 + n + (12 if rep else 0) * 0), d * BEAT * 1.05), at, .24)
        at += d * BEAT
# riser through the build
x = np.arange(int(SR * 2 * BAR)) / SR
put(hp(rng.uniform(-1, 1, len(x)), 2000) * (x / x[-1]) ** 2 * .25, 16 * BAR, 1)
# final hit at 36 s: big chord, low boom, crash
t = 18 * BAR
put(np.sin(2 * np.pi * np.cumsum(np.geomspace(90, 35, int(SR * 1.5))) / SR) * np.exp(-3 * np.arange(int(SR * 1.5)) / SR), t, .9)
put(hp(rng.uniform(-1, 1, int(SR * 1.8)), 3000) * np.exp(-2.5 * np.arange(int(SR * 1.8)) / SR), t, .35)
for n in (0, 4, 7, 12, 16):
    put(voice('organ', hz(root + 12 + n), 1.8) * np.exp(-1.2 * np.arange(int(SR * 1.8)) / SR), t, .12)
    put(voice('bell', hz(72 + n), 1.8), t, .1)
ir = rng.uniform(-1, 1, int(SR * 1.2)) * np.exp(-5 * np.arange(int(SR * 1.2)) / SR); ir = lp(ir, 5000)
wet = fftconvolve(out, ir)[:len(out)]; out = out + wet / np.max(np.abs(wet)) * np.max(np.abs(out)) * .25
out = lp(out, 9000); out = out / np.max(np.abs(out)) * .85
fade = int(SR * .5); out[-fade:] *= np.linspace(1, 0, fade)
wavfile.write(sys.argv[1], SR, (out * 32767).astype(np.int16))
print('trailer music', TOTAL, 's')
