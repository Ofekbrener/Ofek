"""Designs the game's combat and UI sounds from scratch (no samples, no AI).
Layers of filtered noise, pitched sweeps, plucked strings, bell partials and a
small reverb, rendered to mono MP3 in tools/sfx-src/.

    pip install numpy scipy && python3 henesys-3d/tools/make-sfx.py
"""
import os, sys, subprocess, tempfile
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx-src')
rng = np.random.default_rng(7)


def t(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def env(d, a=0.005, k=8.0):
    """Fast attack, exponential decay (k = decay speed)."""
    x = t(d); e = np.exp(-k * x)
    n = max(1, int(SR * a)); e[:n] *= np.linspace(0, 1, n)
    return e
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def sweep(f0, f1, d, wave='sine'):
    f = np.geomspace(f0, f1, int(SR * d)); ph = 2 * np.pi * np.cumsum(f) / SR
    if wave == 'sine': return np.sin(ph)
    if wave == 'tri': return 2 / np.pi * np.arcsin(np.sin(ph))
    if wave == 'saw': return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if wave == 'square': return np.sign(np.sin(ph))
def swept_noise(f0, f1, d, q=0.6, steps=24):
    """Noise through a band-pass whose centre glides from f0 to f1 (a whoosh)."""
    n = noise(d); out = np.zeros_like(n); seg = len(n) // steps
    centres = np.geomspace(f0, f1, steps)
    for i, c in enumerate(centres):
        a, b = i * seg, (len(n) if i == steps - 1 else (i + 1) * seg)
        lo, hi = c * (1 - q / 2), min(c * (1 + q), SR / 2 - 100)
        w = np.hanning(2 * (b - a))[: b - a] if i == 0 else np.ones(b - a)
        out[a:b] = bp(n, lo, hi)[a:b] * w
    return out
def bell(f, d, k=5.0, ratios=(1, 2.76, 5.4, 8.93), amps=(1, .5, .25, .12)):
    x = t(d); return sum(a * np.sin(2 * np.pi * f * r * x) * np.exp(-k * (1 + i * .6) * x) for i, (r, a) in enumerate(zip(ratios, amps)))
def pluck(f, d, damp=0.996):
    """Karplus-Strong plucked string."""
    n = int(SR / f); buf = rng.uniform(-1, 1, n); out = np.zeros(int(SR * d))
    for i in range(len(out)):
        out[i] = buf[i % n]; buf[i % n] = damp * 0.5 * (buf[i % n] + buf[(i + 1) % n])
    return out
def reverb(x, size=0.6, mix=0.25):
    ir = noise(size) * np.exp(-6 / size * t(size)); ir = lp(ir, 6000)
    wet = fftconvolve(x, ir)[: len(x) + int(SR * size)]
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry * (1 - mix) + wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x)) * mix
def mix(*parts):
    n = max(len(p) for _, p in parts); out = np.zeros(n)
    for start, p in parts:
        s = int(SR * start); m = min(len(p), n - s) if s < n else 0
        if s + len(p) > len(out): out = np.concatenate([out, np.zeros(s + len(p) - len(out))])
        out[s:s + len(p)] += p
    return out
def soft(x, drive=2.0): return np.tanh(x * drive) / np.tanh(drive)
def note(n): return 440 * 2 ** ((n - 69) / 12)


SOUNDS = {}
def sound(name):
    def deco(fn): SOUNDS[name] = fn; return fn
    return deco


@sound('hit')
def _():  # thump + click + squish
    thump = sweep(170, 55, .14) * env(.14, k=22)
    click = hp(noise(.012), 2500) * env(.012, k=200) * .7
    squish = bp(noise(.08), 400, 1300) * env(.08, k=40) * .6
    return reverb(mix((0, thump), (0, click), (0.004, squish)), .3, .12)

@sound('crit')
def _():
    sub = sweep(120, 45, .3) * env(.3, k=10)
    crunch = soft(bp(noise(.05), 800, 4000) * env(.05, k=60), 4) * .7
    ping = bell(1760, .5, k=6) * .35
    smack = sweep(260, 70, .1) * env(.1, k=30) * .8
    return reverb(mix((0, sub), (0, crunch), (0, smack), (0.01, ping)), .5, .2)

@sound('heavy')
def _():
    whoosh = swept_noise(300, 2600, .26) * np.hanning(int(SR * .26)) * 1.4
    ring = sum(np.sin(2 * np.pi * f * t(.45)) for f in (880, 1347, 2113)) * env(.45, k=7) * .18
    return reverb(mix((0, whoosh), (0.15, ring)), .4, .18)

@sound('arrow')
def _():
    twang = pluck(196, .22, .993) * env(.22, k=12) * .9
    whoosh = swept_noise(2500, 6000, .18, .5) * np.hanning(int(SR * .18)) * .8
    return mix((0, twang), (0.03, whoosh))

@sound('throw')
def _():  # throwing star: flick of the wrist, a whirring spin, a bright metal ring
    flick = swept_noise(800, 4200, .07, .6) * np.hanning(int(SR * .07)) * .8
    d = .32; x = t(d)
    whirr = bp(noise(d), 2200, 6500) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 34 * x))) * np.linspace(1, .2, len(x)) * .6
    shing = sum(np.sin(2 * np.pi * f * t(.35)) * a for f, a in ((3520, .25), (5280, .15), (7040, .08))) * env(.35, k=11)
    return reverb(mix((0, flick), (0.03, whirr), (0.02, shing)), .25, .12)

@sound('tink')
def _():  # star striking: hard metal tick with a short ring
    tick = hp(noise(.01), 3000) * env(.01, k=300)
    ring = bell(2637, .25, k=16, ratios=(1, 2.4, 3.9), amps=(1, .4, .2)) * .5
    return mix((0, tick), (0.002, ring))

@sound('slash')
def _():  # sword: heavy whoosh then a steel scrape
    whoosh = swept_noise(250, 1800, .22, .7) * np.hanning(int(SR * .22)) * 1.3
    scrape = bp(noise(.12), 2500, 7000) * env(.12, a=.01, k=18) * .35
    ring = sum(np.sin(2 * np.pi * f * t(.3)) for f in (1240, 1790)) * env(.3, k=12) * .12
    return reverb(mix((0, whoosh), (0.1, scrape), (0.1, ring)), .3, .12)

@sound('stab')
def _():  # daggers: two fast high whips
    def whip(): return swept_noise(1200, 5000, .09, .5) * np.hanning(int(SR * .09))
    shing = bell(4186, .15, k=20) * .15
    return mix((0, whip()), (0.08, whip() * .8), (0.1, shing))

@sound('staff')
def _():  # staff: soft wooden whoosh and a small sparkle
    whoosh = swept_noise(200, 1200, .25, .8) * np.hanning(int(SR * .25))
    twinkle = mix(*[(0.08 + i * .04, bell(note(n), .3, k=9) * .18) for i, n in enumerate((88, 95))])
    return reverb(mix((0, whoosh), (0, twinkle)), .4, .2)

@sound('bolt')
def _():
    zap = soft(sweep(260, 1500, .14, 'saw') * env(.14, k=6), 2) * .5
    zap = lp(zap, 5000)
    sparkle = hp(noise(.3), 5000) * env(.3, k=9) * .25
    shimmer = bell(2093, .4, k=7) * .2 + bell(2637, .4, k=8) * .15
    return reverb(mix((0, zap), (0.05, sparkle), (0.08, shimmer)), .5, .25)

@sound('thunder')
def _():
    crack = soft(hp(noise(.06), 1500) * env(.06, k=50), 3)
    rumble = lp(np.cumsum(noise(1.4)) / 200, 220) * env(1.4, a=.03, k=2.5) * 4
    boom = sweep(90, 35, .5) * env(.5, k=5) * .8
    return reverb(soft(mix((0, crack), (0.02, boom), (0.03, rumble)), 1.5), .8, .3)

@sound('spin')
def _():
    parts = [(i * 0.17, swept_noise(400, 2200 + i * 300, .2) * np.hanning(int(SR * .2))) for i in range(3)]
    return reverb(mix(*parts), .3, .15)

@sound('mobdie')
def _():
    pop = sweep(420, 1300, .07) * env(.07, k=25) * .8
    poof = bp(noise(.3), 900, 3200) * env(.3, a=.01, k=10) * .6
    sparkle = mix(*[(0.06 + i * .05, bell(note(84 + s), .25, k=10) * .2) for i, s in enumerate((0, 4, 7))])
    return reverb(mix((0, pop), (0.03, poof), (0, sparkle)), .4, .2)

@sound('heal')
def _():
    arp = mix(*[(i * .09, bell(note(n), .9, k=3.5) * .5) for i, n in enumerate((84, 88, 91, 96))])
    shimmer = hp(noise(1.0), 6000) * env(1.0, a=.2, k=3) * .12
    return reverb(mix((0, arp), (0, shimmer)), 1.0, .35)

@sound('buff')
def _():
    rise = swept_noise(300, 3000, .5, .8) * np.hanning(int(SR * .5)) * .8
    chord = sum(sweep(note(n), note(n + 5), .7, 'tri') for n in (72, 76, 79)) * env(.7, a=.15, k=3) * .2
    return reverb(mix((0, rise), (0.1, chord)), .7, .3)

@sound('levelup')
def _():
    arp = mix(*[(i * .085, sweep(note(n), note(n), .2, 'square') * env(.2, k=10) * .22) for i, n in enumerate((72, 76, 79, 84, 88, 91))])
    x = t(1.2); vib = 1 + .006 * np.sin(2 * np.pi * 5.5 * x)
    chord = sum(np.sin(2 * np.pi * np.cumsum(note(n) * vib) / SR) for n in (84, 88, 91)) * env(1.2, a=.02, k=2.6) * .22
    sparkle = hp(noise(1.0), 7000) * env(1.0, a=.1, k=3) * .12
    return reverb(mix((0, arp), (0.5, chord), (0.5, sparkle)), 1.0, .3)

@sound('quest')
def _():
    def brass(n, d): return lp(sweep(note(n), note(n), d, 'saw'), 3000) * env(d, a=.02, k=3) * .3
    return reverb(mix((0, brass(67, .18)), (.16, brass(72, .18)), (.32, brass(76, .18)), (.48, brass(79, .9)), (.48, brass(84, .9) * .7)), .9, .3)

@sound('portal')
def _():
    rise = swept_noise(200, 2400, .8, .5) * np.hanning(int(SR * .8))
    shimmer = sum(np.sin(2 * np.pi * f * t(.8) + 3 * np.sin(2 * np.pi * 6 * t(.8))) for f in (660, 990)) * np.hanning(int(SR * .8)) * .15
    return reverb(mix((0, rise), (0, shimmer)), .8, .35)

@sound('potion')
def _():
    gulps = mix(*[(i * .16, sweep(330, 160, .12) * env(.12, k=18) * .7) for i in range(2)])
    bubbles = mix(*[(0.3 + rng.uniform(0, .3), sweep(f, f * 1.6, .05) * env(.05, k=40) * .25) for f in rng.uniform(600, 1300, 7)])
    return reverb(mix((0, gulps), (0, bubbles)), .3, .15)

@sound('pickup')
def _():
    pop = sweep(500, 1100, .05) * env(.05, k=40) * .6
    chime = bell(1319, .35, k=9) * .4 + bell(1976, .35, k=10) * .25
    return mix((0, pop), (0.03, chime))

@sound('hurt')
def _():
    thud = sweep(140, 60, .16) * env(.16, k=18)
    oof = lp(sweep(420, 210, .18, 'square'), 1800) * env(.18, a=.01, k=10) * .25
    return mix((0, thud), (0.01, oof))


def render(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    x = np.concatenate([x, np.zeros(int(SR * .02))])
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (x * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f.name, '-af',
                        'silenceremove=start_periods=1:start_threshold=-60dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse',
                        '-ac', '1', '-b:a', '64k', os.path.join(OUT, name + '.mp3')], check=True)
        os.unlink(f.name)



# ------------------------------------------------------------- monster voices

@sound('mob_snail')
def _():  # wet squelch
    return mix((0, bp(noise(.18), 300, 1100) * env(.18, a=.02, k=14) * .8), (0.02, sweep(240, 120, .12) * env(.12, k=20) * .4))

@sound('mob_slime')
def _():  # bouncy squish
    return mix((0, sweep(180, 520, .16, 'sine') * env(.16, a=.01, k=10) * .7), (0, bp(noise(.12), 500, 1800) * env(.12, k=25) * .4))

@sound('mob_mushroom')
def _():  # cartoon boing
    x = t(.35); f = 260 + 140 * np.sin(2 * np.pi * 9 * x) * np.exp(-6 * x)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(.35, a=.005, k=7) * .7

@sound('mob_pig')
def _():  # oink: two nasal grunts
    def grunt(d, f0, f1):
        x = sweep(f0, f1, d, 'saw'); x = bp(x, 300, 1400) + .5 * bp(x, 1800, 2600)
        return x * env(d, a=.015, k=9)
    return reverb(mix((0, grunt(.13, 190, 150)), (.15, grunt(.16, 210, 160))), .2, .1)

@sound('mob_stump')
def _():  # wooden knock
    knock = sum(np.sin(2 * np.pi * f * t(.2)) * np.exp(-k * t(.2)) for f, k in ((310, 30), (620, 45), (1150, 60)))
    return mix((0, knock * .5), (0, hp(noise(.02), 1500) * env(.02, k=150) * .5))

@sound('mob_skeleton')
def _():  # bone rattle: a burst of dry clicks
    clicks = [(rng.uniform(0, .25), hp(noise(.015), 2000) * env(.015, k=250) * rng.uniform(.4, 1)) for _ in range(14)]
    clacks = [(rng.uniform(0, .2), bp(noise(.03), 900, 2400) * env(.03, k=90) * .6) for _ in range(5)]
    return reverb(mix(*clicks, *clacks), .25, .15)

# -------------------------------------------------------------------- UI

@sound('ui_open')
def _(): return mix((0, bell(1047, .25, k=12) * .4), (.06, bell(1568, .25, k=12) * .35))

@sound('ui_tap')
def _(): return sweep(700, 900, .04) * env(.04, k=60) * .5


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    for name, fn in SOUNDS.items():
        if only and name not in only: continue
        render(name, fn())
        print('made', name)
