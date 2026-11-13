"""Record the radio lines with Piper TTS (open source) and the LibriTTS voice model (CC BY 4.0).
Usage: python make-voices.py <lines.json> <libritts .onnx> <out dir>
lines.json comes from tools/dump-voice-lines.js: [{who, text, key}]. Needs piper-tts and ffmpeg."""
import json, wave, subprocess, os, sys
from piper import PiperVoice, SynthesisConfig
# speaker ids picked for low, steady male voices: Doc slow and tired, the army crisp, the narrator calm
STYLE = {'DOC': dict(sid=186, ls=1.08, rate=.93), 'ARMY': dict(sid=288, ls=.95, rate=1.0),
         'NARRATOR': dict(sid=846, ls=1.1, rate=.97), 'NOTE': dict(sid=846, ls=1.05, rate=1.0)}
lines, model, out = json.load(open(sys.argv[1])), PiperVoice.load(sys.argv[2]), sys.argv[3]
os.makedirs(out, exist_ok=True); keys = []
for l in lines:
    st = STYLE[l['who']]; wav = os.path.join(out, l['key'] + '.wav'); mp3 = wav[:-4] + '.mp3'
    with wave.open(wav, 'wb') as w:
        model.synthesize_wav(l['text'], w, syn_config=SynthesisConfig(speaker_id=st['sid'], length_scale=st['ls'], noise_scale=.6, noise_w_scale=.8))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', f"asetrate=22050*{st['rate']},aresample=22050,loudnorm=I=-16:TP=-1.5", '-ac', '1', '-b:a', '56k', mp3], check=True)
    os.remove(wav); keys.append(l['key'])
json.dump(keys, open(os.path.join(out, 'index.json'), 'w')); print(len(keys), 'lines')
