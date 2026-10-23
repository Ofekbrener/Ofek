"""Mix the trailer music with the game sounds logged during capture, then
encode frames + audio into trailer.mp4.
    python3 henesys-3d/tools/trailer/mix.py OUT_DIR
"""
import sys, os, json, subprocess
import numpy as np
from scipy.io import wavfile

OUT = sys.argv[1]
SFX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'sfx')
SR = 22050
def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

sr, music = wavfile.read(os.path.join(OUT, 'music.wav'))
assert sr == SR
mix = music.astype(np.float32) / 32768 * 0.8
GAIN = {'levelup': .55, 'mob_snail': .3, 'mob_pig': .3, 'mob_mushroom': .3, 'mob_stump': .3, 'mob_skeleton': .35, 'mob_slime': .3, 'hit': .4, 'crit': .45, 'thunder': .6}
cache, last = {}, {}
for e in json.load(open(os.path.join(OUT, 'sfx.json'))):
    n, t = e['name'], e['t']
    if t - last.get(n, -1) < 0.08: continue
    last[n] = t
    f = os.path.join(SFX, n + '.mp3')
    if not os.path.exists(f): continue
    y = cache.setdefault(n, load(f)) * GAIN.get(n, .45)
    s = int(t * SR); e_ = min(len(mix), s + len(y)); mix[s:e_] += y[:e_ - s]
mix = np.tanh(mix * 1.1) * 0.95   # soft limiter
wavfile.write(os.path.join(OUT, 'mix.wav'), SR, (mix * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '30', '-i', os.path.join(OUT, 'frames', '%05d.jpg'), '-i', os.path.join(OUT, 'mix.wav'),
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', os.path.join(OUT, 'trailer.mp4')], check=True)
print('wrote', os.path.join(OUT, 'trailer.mp4'))
