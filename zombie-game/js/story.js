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
  const c = RADIO.cur, spoken = VOICE.speak(c.who, c.text); RADIO.hold = Math.max(c.text.length / 42 + 1.6 + c.text.length * .035, spoken + .9);
};
RADIO.clear = function () { RADIO.q = []; RADIO.cur = null; VOICE.stop(); if (RADIO.el) RADIO.el.classList.remove('on'); };
// typed text, then a hold long enough to read it; runs on real time so slow motion never stalls it
RADIO.update = function () {
  const now = performance.now() / 1000, raw = Math.min(.1, now - (RADIO.last || now)); RADIO.last = now;
  const c = RADIO.cur; if (!c) return; RADIO.t += raw;
  RADIO.el.classList.toggle('low', G.state === 'ending');
  RADIO.el.style.visibility = G.state === 'draft' || G.state === 'picking' || G.state === 'dead' || G.state === 'travel' ? 'hidden' : 'visible';
  const n = Math.min(c.text.length, Math.floor(RADIO.t * 42));
  if (n !== RADIO.chars) { RADIO.chars = n; const t = RADIO.el.querySelector('.rtext'); if (t) t.textContent = c.text.slice(0, n); }
  if (RADIO.t > RADIO.hold) RADIO.next();
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
    G.area = i; RADIO.clear(); buildLayout(i); if (i === 4) ensureCharacter(docModel().slice(11)).catch(() => {}); clearPickups(); clearFX(); clearTrail();
    const P = G.player; P.x = 0; P.z = 2; P.vx = P.vz = 0; G.cam.x = 0; G.cam.z = 2; buildGear();
    f.classList.remove('on'); G.state = 'playing'; areaCard(i); then && then();
  }, 700);
}
// after each draft: next wave, or the next district after a boss
function nextWave() {
  const ni = areaIndex(G.wave + 1);
  if (ni !== G.area && G.endless) enterArea(ni, () => setTimeout(startWave, 3000));
  else if (ni !== G.area) MAP3D.show(ni, () => enterArea(ni, () => setTimeout(startWave, 3000))); else startWave();
}
function storyWaveStart() {
  if (G.endless) return;
  const li = (G.wave - 1) % 5, A = curArea();
  const lines = li === 4 ? A.radio.boss : A.radio[li];
  if (lines) setTimeout(() => RADIO.say(lines), li === 0 ? 2200 : 900);
}
function storyBossDown() { if (G.endless || G.wave === 25) return; const A = curArea(); setTimeout(() => RADIO.say(A.radio.after), 1500); }

// ---------- the ending: who gets the cure ----------
const ENDINGS = {
  army: {title: 'ENDING: DAWN', col: '#ffcc33', lines: ['The gate opens. Soldiers take the case from your hands.', 'Three weeks later, the first doses reach the city.', 'Somewhere in the static, a voice says thank you. Then nothing.']},
  doc: {title: 'ENDING: STATIC', col: '#d0a0ff', lines: ['Dr. Adler drinks the cure in one go. His eyes clear.', '"You saved me," he says, and walks into the dark.', 'Behind you, the floodlights on the wall go out one by one.']},
};
const ENDING_RADIO = [{who: 'ARMY', text: 'Survivor, bring the case to the gate. We can save everyone.'}, {who: 'DOC', text: 'Please. I made this. I only need one dose.'}];
function showEnding() {
  const el = document.getElementById('ending'); G.state = 'ending'; el.hidden = false; RADIO.clear(); AU.musicTo('music_calm'); clearCheckpoint();
  el.innerHTML = `<div class="ebox"><div class="etitle">THE CASE IS STILL WARM</div>
    <p class="eline">Patient Zero is down. Two voices on the radio. One choice.</p>
    <div class="echoice"><button id="eArmy" class="ecard army"><b>Give the cure to the army</b><span>They can make enough for the whole city.</span></button>
    <button id="eDoc" class="ecard doc"><b>Give the cure to Doc</b><span>It is the only thing that keeps him human.</span></button></div></div>`;
  RADIO.say(ENDING_RADIO);
  const pickE = id => { AU.play('cardPick', {vol: .9}); RADIO.clear(); playEnding(id); };
  document.getElementById('eArmy').onclick = () => pickE('army'); document.getElementById('eDoc').onclick = () => pickE('doc');
}
function playEnding(id) {
  const E = ENDINGS[id], el = document.getElementById('ending'); storyFlag('ozEnding', id === 'army' ? 'dawn' : 'static'); storyFlag('ozEndless', '1');
  let i = 0;
  const show = () => {
    if (i >= E.lines.length) {
      el.innerHTML = `<div class="ebox"><div class="etitle" style="color:${E.col}">${E.title}</div><p class="eline">Score ${G.score} · ${G.kills} kills</p>
        <div class="eunlock">ENDLESS MODE UNLOCKED</div><p class="eline small">${id === 'doc' ? 'Start a new story and Patient Zero will remember you.' : 'The districts loop, and the horde keeps growing.'}</p>
        <button id="eMenu" class="primary">Back to menu</button></div>`;
      AU.play('levelUp', {vol: .8}); document.getElementById('eMenu').onclick = () => { el.hidden = true; clearZombies(); showMenu(); };
      return;
    }
    el.innerHTML = `<div class="ebox"><div class="etitle" style="color:${E.col}">${E.title}</div><p class="eline big">${E.lines[i]}</p><p class="etap">tap to continue</p></div>`; VOICE.speak('NARRATOR', E.lines[i]);
    i++; el.onclick = e => { if (e.target.closest('button')) return; show(); };
  };
  show();
}

// ---------- city map between districts ----------
// An illustrated map: the river, the districts with icons, fog over the places not reached yet,
// and the survivor's portrait walking the route to the next stop. Then the travel cutscene plays.
const MAP_PTS = [[110, 320], [215, 250], [330, 285], [440, 190], [520, 90]];
const MAP_ICON = {
  0: '<path d="M-6 -2h4v-4h4v4h4v4h-4v4h-4v-4h-4z" fill="#d01010"/>',
  1: '<text y="5" font-size="15" font-weight="700" fill="#9dffb4" text-anchor="middle">M</text>',
  2: '<path d="M0 -7v12M-6 1a6 6 0 0 0 12 0M-3 -5h6" stroke="#ffb060" stroke-width="2" fill="none"/>',
  3: '<path d="M-3 -7l-3 14M3 -7l3 14M0 -6v2M0 -1v2M0 4v2" stroke="#fff" stroke-width="1.6"/>',
  4: '<path d="M-7 6v-9h14v9M-3 6v-5h6v5" stroke="#ffcc33" stroke-width="1.8" fill="none"/>',
};
const THREAT = {crawler: 'Crawlers climb out of the ground', bloater: 'Bloaters burst into acid', riot: 'Riot shields block hits from the front', screamer: 'Screamers enrage the horde'};
function showCityMap(next, go) {
  const el = document.getElementById('citymap'); G.state = 'travel'; el.hidden = false; AU.musicTo('music_calm'); AU.play('cardOpen', {vol: .7});
  const route = 'M' + MAP_PTS.map(p => p.join(' ')).join(' L');
  const done = 'M' + MAP_PTS.slice(0, next).map(p => p.join(' ')).join(' L');
  const leg = `M${MAP_PTS[next - 1].join(' ')} L${MAP_PTS[next].join(' ')}`;
  const blobs = AREAS.map((A, i) => { const [x, y] = MAP_PTS[i], st = i < next ? 'done' : i === next ? 'next' : 'lock';
    return `<g class="md ${st}"><ellipse cx="${x}" cy="${y}" rx="62" ry="40" class="mblob"/>
      <g transform="translate(${x} ${y})"><circle r="17" class="mpin"/>${MAP_ICON[i]}${st === 'done' ? '<circle r="17" class="mdoneR"/><path d="M-6 0l4 4 8-9" class="chk"/>' : ''}</g>
      <text x="${x}" y="${y + 34}" class="mname">${A.short.toUpperCase()}</text>${st === 'lock' ? `<ellipse cx="${x}" cy="${y}" rx="64" ry="42" class="mfog"/>` : ''}</g>`; }).join('');
  const portrait = PORTRAIT.img ? PORTRAIT.img.src : '';
  const A = AREAS[next], B = BOSSES[A.boss];
  el.innerHTML = `<div class="mapwrap"><div class="mhead"><span>DAY 3 · ROUTE TO THE WALL</span><span>${G.kills} kills · ${G.score} pts</span></div>
    <svg viewBox="0 0 600 400" class="mapsvg"><defs>
      <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#b9ad8e" stroke-width="1"/></pattern>
      <clipPath id="pc"><circle r="15"/></clipPath>
      <filter id="rough"><feTurbulence baseFrequency=".04" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter></defs>
    <rect width="600" height="400" fill="#dcd2b4"/><rect width="600" height="400" fill="url(#grid)" opacity=".55"/>
    <path d="M0 210 C120 170 200 300 300 250 S470 120 600 150 L600 190 C470 160 380 300 300 290 S110 220 0 250 Z" fill="#7aa0b4" opacity=".8" filter="url(#rough)"/>
    <text x="40" y="238" class="mriver">RIVER</text>
    <rect x="30" y="40" width="70" height="44" fill="#9bb88a" opacity=".6" rx="8"/><rect x="250" y="340" width="90" height="40" fill="#9bb88a" opacity=".6" rx="8"/>
    <path d="M440 30 H600" stroke="#4a4030" stroke-width="10"/><path d="M505 30h30" stroke="#ffcc33" stroke-width="10"/><text x="560" y="22" class="mwallT">THE WALL</text>
    <path d="${route}" class="mroute"/><path d="${done}" class="mdone"/>
    ${blobs}
    <path d="${leg}" class="mleg"/>
    <g class="mme"><circle r="17" fill="#ffcc33"/><image href="${portrait}" x="-15" y="-15" width="30" height="30" clip-path="url(#pc)" preserveAspectRatio="xMidYMid slice"/>
      <animateMotion dur="2.4s" fill="freeze" path="${leg}" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".5 0 .5 1"/></g>
    </svg>
    <div class="mcard"><div class="mnum">AREA ${next + 1} / ${AREAS.length}</div><div class="mnext">${A.name}</div><div class="mgoal">${A.goal}</div>
      <div class="mthreat">${A.newZombie ? `<span>NEW</span>${THREAT[A.newZombie]}` : ''}</div><div class="mthreat boss"><span>BOSS</span>${B.name}</div>
      <button id="mapGo" class="primary">Travel</button></div></div>`;
  AU.play('step', {vol: .4, delay: .3}); AU.play('step', {vol: .4, delay: .9}); AU.play('step', {vol: .4, delay: 1.5});
  document.getElementById('mapGo').onclick = () => {
    el.hidden = true; AU.play('cardPick', {vol: .7}); const f = document.getElementById('fade'); f.classList.add('on');
    setTimeout(() => { f.classList.remove('on'); TRAVEL.play(next - 1, () => { f.classList.add('on'); setTimeout(() => { f.classList.remove('on'); go(); }, 500); }); }, 650);
  };
}

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
  cap.textContent = ''; cap.dataset.full = s.text; RADIO.clear(); if (s.radio) RADIO.say(s.radio); else if (s.text) VOICE.speak('NARRATOR', s.text);
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
