// Radio voices. A recorded line (assets/voice/<key>.mp3, listed in assets/voice/index.json) plays through a radio filter.
// Without a recording, the line is spoken by the device's own speech engine: the Android app's TextToSpeech bridge,
// or the browser's speechSynthesis.
'use strict';
const VOICE = {on: true, rec: {}, cur: null, tts: null};
// each speaker gets its own pitch and pace on the speech engine
const VOICE_STYLE = {DOC: {pitch: .62, rate: .9}, ARMY: {pitch: 1.05, rate: 1.05}, NOTE: {pitch: .85, rate: .92}, NARRATOR: {pitch: .8, rate: .9}};
// the same key names the recording file and the line, so new recordings drop in without code changes
VOICE.key = (who, text) => { let h = 5381; const s = who + '|' + text; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return who.toLowerCase() + '_' + h.toString(36); };
VOICE.load = async function () {
  try { localStorage.getItem('ozVoice') === 'off' && (VOICE.on = false); } catch (e) {}
  try { const r = await fetch('assets/voice/index.json'); if (r.ok) for (const k of await r.json()) VOICE.rec[k] = null; } catch (e) {}
};
async function voiceBuffer(k) {
  if (VOICE.rec[k]) return VOICE.rec[k];
  const r = await fetch('assets/voice/' + k + '.mp3'), ab = await r.arrayBuffer();
  return (VOICE.rec[k] = await new Promise((res, rej) => AU.ctx.decodeAudioData(ab, res, rej)));
}
function pickWebVoice() {
  if (!window.speechSynthesis) return null; const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  return vs.find(v => /male|daniel|george|david|alex/i.test(v.name)) || vs[0] || null;
}
// speak a line; returns roughly how many seconds it takes
VOICE.speak = function (who, text) {
  VOICE.stop(); if (!VOICE.on || AU.muted) return 0;
  const k = VOICE.key(who, text), st = VOICE_STYLE[who] || VOICE_STYLE.NARRATOR, est = text.length / (13 * st.rate) + .4;
  if (k in VOICE.rec && AU.ctx) {
    voiceBuffer(k).then(buf => {
      if (VOICE.wantKey !== k) return; const c = AU.ctx, s = c.createBufferSource(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; hp.type = 'highpass'; hp.frequency.value = who === 'NARRATOR' ? 60 : 320; lp.type = 'lowpass'; lp.frequency.value = who === 'NARRATOR' ? 12000 : 3400; g.gain.value = 1.1;
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(AU.voice || AU.sfx); s.start(); VOICE.cur = s; AU.duck(.35, buf.duration);
    }).catch(() => {});
    VOICE.wantKey = k; return est;
  }
  if (window.AndroidTTS) { try { window.AndroidTTS.speak(text, st.pitch, st.rate); AU.duck(.5, est); return est; } catch (e) {} }
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text); u.pitch = st.pitch; u.rate = st.rate; u.volume = 1; const v = pickWebVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u); VOICE.tts = u; AU.duck(.5, est); return est;
  }
  return 0;
};
VOICE.stop = function () {
  VOICE.wantKey = null;
  if (VOICE.cur) { try { VOICE.cur.stop(); } catch (e) {} VOICE.cur = null; }
  if (window.AndroidTTS) { try { window.AndroidTTS.stop(); } catch (e) {} }
  if (window.speechSynthesis) speechSynthesis.cancel();
};
VOICE.toggle = function () { VOICE.on = !VOICE.on; try { localStorage.setItem('ozVoice', VOICE.on ? 'on' : 'off'); } catch (e) {} if (!VOICE.on) VOICE.stop(); return VOICE.on; };
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
