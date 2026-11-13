// Story presentation: Doc's radio box, area title cards, the area change between districts, and the opening cinematic.
'use strict';
// ---------- radio ----------
const WHO = {DOC: {name: 'DR. ADLER', col: '#7dff8a'}, ARMY: {name: 'ARMY · WALL', col: '#ffcc33'}, NOTE: {name: 'FOUND NOTE', col: '#cfd6ff'}};
const RADIO = {q: [], cur: null, t: 0, chars: 0, el: null};
// short burst of filtered noise and a beep, played on the radio's open and close
function radioStatic(len = .22, beep = true) {
  if (!AU.ctx || AU.muted) return; const c = AU.ctx, t = c.currentTime;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = n; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = .8; g.gain.value = .35;
  s.connect(f); f.connect(g); g.connect(AU.sfx); s.start(t);
  if (beep) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 1320; og.gain.setValueAtTime(.12, t + len); og.gain.exponentialRampToValueAtTime(.001, t + len + .09); o.connect(og); og.connect(AU.sfx); o.start(t + len); o.stop(t + len + .1); }
}
RADIO.say = function (lines) { if (!lines || !lines.length) return; RADIO.q.push(...lines); if (!RADIO.cur) RADIO.next(); };
RADIO.next = function () {
  const el = RADIO.el = RADIO.el || document.getElementById('radio');
  RADIO.cur = RADIO.q.shift() || null; RADIO.chars = 0; RADIO.t = 0;
  if (!RADIO.cur) { el.classList.remove('on'); radioStatic(.12, false); return; }
  const w = WHO[RADIO.cur.who] || WHO.DOC;
  el.innerHTML = `<div class="rhead"><i class="rled" style="background:${w.col}"></i><b style="color:${w.col}">${w.name}</b><span class="rwave"><i></i><i></i><i></i><i></i><i></i></span></div><div class="rtext"></div>`;
  el.className = 'on' + (RADIO.cur.who === 'NOTE' ? ' note' : ''); radioStatic();
};
RADIO.clear = function () { RADIO.q = []; RADIO.cur = null; if (RADIO.el) RADIO.el.classList.remove('on'); };
// typed text, then a hold long enough to read it; runs on real time so slow motion never stalls it
RADIO.update = function () {
  const now = performance.now() / 1000, raw = Math.min(.1, now - (RADIO.last || now)); RADIO.last = now;
  const c = RADIO.cur; if (!c) return; RADIO.t += raw;
  RADIO.el.style.visibility = G.state === 'draft' || G.state === 'picking' || G.state === 'dead' ? 'hidden' : 'visible';
  const n = Math.min(c.text.length, Math.floor(RADIO.t * 42));
  if (n !== RADIO.chars) { RADIO.chars = n; const t = RADIO.el.querySelector('.rtext'); if (t) t.textContent = c.text.slice(0, n); }
  if (RADIO.t > c.text.length / 42 + 1.6 + c.text.length * .035) RADIO.next();
};

// ---------- area card and area change ----------
function areaCard(i) {
  const A = AREAS[i], el = document.getElementById('areacard');
  el.innerHTML = `<div class="anum">AREA ${i + 1} / ${AREAS.length}</div><div class="aname">${A.name}</div><div class="agoal">${A.goal}</div>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(areaCard.t); areaCard.t = setTimeout(() => el.classList.remove('on'), 3600);
}
// fade out, swap the district, fade in, then start its first wave
function enterArea(i, then) {
  const f = document.getElementById('fade'); f.classList.add('on'); G.state = 'travel';
  setTimeout(() => {
    G.area = i; RADIO.clear(); buildLayout(i); clearPickups(); clearFX(); clearTrail();
    const P = G.player; P.x = 0; P.z = 2; P.vx = P.vz = 0; G.cam.x = 0; G.cam.z = 2; buildGear();
    f.classList.remove('on'); G.state = 'playing'; areaCard(i); then && then();
  }, 700);
}
// after each draft: next wave, or the next district after a boss
function nextWave() {
  const ni = areaIndex(G.wave + 1);
  if (ni !== G.area) enterArea(ni, () => setTimeout(startWave, 3000)); else startWave();
}
function storyWaveStart() {
  const li = (G.wave - 1) % 5, A = curArea();
  const lines = li === 4 ? A.radio.boss : A.radio[li];
  if (lines) setTimeout(() => RADIO.say(lines), li === 0 ? 2200 : 900);
}
function storyBossDown() { const A = curArea(); setTimeout(() => RADIO.say(A.radio.after), 1500); }

// ---------- opening ----------
const INTRO_SHOTS = [
  {text: 'Day 3 of the outbreak. The city has gone quiet.', cam: t => [Math.sin(t * .12) * 26, 20, Math.cos(t * .12) * 26, 0, 0, 0]},
  {text: 'You wake up in the parking lot of St. Mercy Hospital.', cam: (t, P) => [P.x + 2.4 - t * .1, 1.5, P.z + 2.8 - t * .12, P.x, 1.15, P.z]},
  {text: 'Your radio crackles.', radio: [{who: 'DOC', text: 'If anyone can hear this... my name is Dr. Adler.'}], cam: (t, P) => [P.x - 1.8, 1.7, P.z + 2.2 - t * .08, P.x, 1.1, P.z]},
  {text: '', radio: [{who: 'DOC', text: 'I made a cure. It\'s in the hospital cold room. Bring it to the quarantine wall, and the army can make enough for everyone.'}], cam: (t, P) => [P.x + 3.5, 2.6 + t * .05, P.z + 3.5, P.x, 1, P.z]},
  {text: 'Five districts stand between you and the wall.', cam: (t, P) => { const k = Math.min(1, t / 3), e = k * k * (3 - 2 * k); return [P.x, lerp(4, 11, e), P.z + lerp(6, 8.6, e), P.x, lerp(1, .9, e), P.z]; }},
];
const STORY = {i: 0, t: 0, done: null, on: false};
STORY.seen = () => { try { return localStorage.getItem('ozIntro') === '1'; } catch (e) { return false; } };
STORY.intro = function (done) {
  AU.resume(); RADIO.clear(); STORY.on = true; STORY.done = done; STORY.i = -1; G.state = 'intro'; ui.hidden = true;
  if (WORLD.built !== 0) buildLayout(0);
  const P = G.player; P.x = 0; P.z = 2; P.face = Math.PI / 2; P.rig.play('Idle', {fade: 0}); syncPlayer();
  document.getElementById('intro').hidden = false; AU.musicTo('music_calm'); AU.ambience(true);
  document.getElementById('introSkip').onclick = e => { e.stopPropagation(); STORY.finish(); };
  document.getElementById('intro').onclick = () => STORY.next();
  STORY.next();
};
STORY.next = function () {
  STORY.i++; STORY.t = 0;
  if (STORY.i >= INTRO_SHOTS.length) return STORY.finish();
  const s = INTRO_SHOTS[STORY.i], cap = document.getElementById('introText');
  cap.textContent = ''; cap.dataset.full = s.text; RADIO.clear(); if (s.radio) RADIO.say(s.radio);
  document.getElementById('introDots').innerHTML = INTRO_SHOTS.map((_, i) => `<i class="${i <= STORY.i ? 'on' : ''}"></i>`).join('');
  AU.play('swingWide', {vol: .25, rate: .5});
};
STORY.update = function (raw) {
  if (!STORY.on) return; STORY.t += raw;
  const s = INTRO_SHOTS[STORY.i], P = G.player; if (!s) return;
  const cap = document.getElementById('introText'), full = cap.dataset.full || '', n = Math.min(full.length, Math.floor(STORY.t * 38));
  if (cap.textContent.length !== n) cap.textContent = full.slice(0, n);
  P.rig.mixer.update(raw); syncPlayer();
  const [x, y, z, lx, ly, lz] = s.cam(STORY.t, P); camera.position.set(x, y, z); camera.lookAt(lx, ly, lz);
  document.getElementById('introTap').style.opacity = STORY.t > 1.2 ? 1 : 0;
};
STORY.finish = function () {
  if (!STORY.on) return; STORY.on = false; RADIO.clear(); document.getElementById('intro').hidden = true;
  try { localStorage.setItem('ozIntro', '1'); } catch (e) {}
  G.state = 'menu'; const d = STORY.done; STORY.done = null; d && d();
};
