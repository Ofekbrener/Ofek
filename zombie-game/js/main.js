// Main: input, camera, game flow (menu -> waves -> upgrade draft -> ... -> game over) and the frame loop.
'use strict';
const INPUT = {keys: {}, joy: null,
  move() {
    const k = this.keys; let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), z = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
    if (this.joy) { const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, l = Math.hypot(dx, dy); if (l > 8) { x = dx / Math.max(l, 55); z = dy / Math.max(l, 55); } }
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } return {x, z};
  }};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); INPUT.keys[k] = 1;
  if (G.state === 'draft' && ['1', '2', '3'].includes(k)) { pickCard(+k - 1); return; }
  if (G.state !== 'playing') return;
  if (k === ' ') { jump(); e.preventDefault(); }
  if (k === 'j' || k === 'k') startAttack();
  if (k === 'shift' || k === 'l') dash();
  if (k === 'm') AU.toggleMute();
  if (k === 'h') popText(G.player.x, G.player.z, 'VIBRATION ' + (HAPTIC.toggle() ? 'ON' : 'OFF'), '#cfd6ff', 26, 2.6);
});
addEventListener('keyup', e => { INPUT.keys[e.key.toLowerCase()] = 0; });
addEventListener('blur', () => { INPUT.keys = {}; });
cv3.addEventListener('mousedown', e => { if (e.button === 0) startAttack(); });
cv3.addEventListener('contextmenu', e => { e.preventDefault(); dash(); });
cv3.addEventListener('touchstart', e => {
  HUD.touch = true; HUD.layout();
  // Only the on-screen buttons act. A touch anywhere else starts the move stick right under the thumb,
  // so resting or re-placing the thumb never swings the weapon by itself.
  for (const t of e.changedTouches) {
    const b = HUD.btn, near = (bb, pad = 18) => Math.hypot(t.clientX - bb.x, t.clientY - bb.y) < bb.r + pad;
    if (near(b.atk)) { b.atk.down = t.identifier; startAttack(); }
    else if (near(b.jmp)) { b.jmp.down = t.identifier; jump(); }
    else if (UP.dash && near(b.dash)) { b.dash.down = t.identifier; dash(); }
    else if (!INPUT.joy) INPUT.joy = {id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY};
  }
  e.preventDefault();
}, {passive: false});
cv3.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (INPUT.joy && t.identifier === INPUT.joy.id) { INPUT.joy.x = t.clientX; INPUT.joy.y = t.clientY; } e.preventDefault(); }, {passive: false});
const endTouch = e => { for (const t of e.changedTouches) { if (INPUT.joy && t.identifier === INPUT.joy.id) INPUT.joy = null; for (const k in HUD.btn) if (HUD.btn[k].down === t.identifier) HUD.btn[k].down = null; } };
cv3.addEventListener('touchend', endTouch); cv3.addEventListener('touchcancel', endTouch);

// menu buttons: the click sound and a light tap on press, a springy release (see button.rel in index.html)
addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled || b.classList.contains('card')) return; AU.play('cardPick', {vol: .3, rate: 1.3, max: 2}); HAPTIC.fx('card'); });
addEventListener('pointerup', e => { const b = e.target.closest && e.target.closest('button'); if (!b || b.classList.contains('card')) return; b.classList.remove('rel'); void b.offsetWidth; b.classList.add('rel'); setTimeout(() => b.classList.remove('rel'), 140); });

// ---------- camera ----------
function updateCamera(dt) {
  const P = G.player, c = G.cam;
  c.x = lerp(c.x, P.x, damp(.003, dt)); c.z = lerp(c.z, P.z, damp(.003, dt));
  c.kx = lerp(c.kx, 0, damp(.0001, dt)); c.kz = lerp(c.kz, 0, damp(.0001, dt));
  c.zk = lerp(c.zk, 0, damp(.0005, dt)); c.zoom = lerp(c.zoom, G.slowT > 0 ? 1.15 : 1, damp(.01, dt));
  const sh = G.trauma * G.trauma, t = G.time, z = c.zoom + c.zk;
  const ox = sh * .5 * (Math.sin(t * 93) + Math.sin(t * 41)) / 2, oy = sh * .5 * (Math.cos(t * 87) + Math.sin(t * 53)) / 2;
  // portrait: pull back and look 1.4 m ahead so the player sits above the touch buttons
  const pf = W < H ? 1.3 : 1, ahead = W < H ? 1.4 : 0;
  const tx = c.x + c.kx, tz = c.z + c.kz + ahead;
  camera.position.set(tx + ox, 11 * pf / z + oy, tz + 8.6 * pf / z); camera.lookAt(tx + ox * .4, .9, tz); camera.rotateZ(sh * .05 * Math.sin(t * 71) + c.roll);
  c.roll = lerp(c.roll, 0, damp(.002, dt));
  WORLD.moon.position.set(tx + 8, 22, tz + 6); WORLD.moon.target.position.set(tx, 0, tz);
}

// ---------- flow ----------
const ui = document.getElementById('menu');
// Checkpoint: saved at the start of every wave, so a run can resume from the wave you died on.
const SAVE_KEY = 'ozCheckpoint';
function saveCheckpoint() {
  const P = G.player; const {magnetPulse, ...up} = UP;
  const cp = {wave: G.wave, endless: !!G.endless, weapon: P.weapon, maxHp: P.maxHp, score: G.score, kills: G.kills, reroll: DRAFT.rerollCost, up};
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(cp)); } catch (e) {}
}
function loadCheckpoint() { try { const c = JSON.parse(localStorage.getItem(SAVE_KEY)); return c && c.wave > 1 ? c : null; } catch (e) { return null; } }
function clearCheckpoint() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function newRun(cp = null, opts = {}) {
  const ud = document.getElementById('upd'); if (ud && !UPD.busy) ud.remove();
  HOME.on = false; homeStage(false); ui.className = 'overlay'; hudCv.style.visibility = ''; const sh = document.getElementById('shop'); if (sh) sh.hidden = true;
  TUT.abort(); document.getElementById('creator').hidden = true;
  AU.resume(); clearZombies(); clearPickups(); clearFX(); clearTrail(); resetUpgrades(); POW.reset(); clearGear();
  if (G.player && G.player.javelin) { scene.remove(G.player.javelin.g); G.player.javelin = null; }

  G.endless = !!(opts.endless || (cp && cp.endless));
  Object.assign(G, {wave: G.endless && !cp ? 25 : 0, score: 0, runCoins: 0, runGems: 0, kills: 0, combo: 0, hitstop: 0, trauma: 0, slowT: 0, timeScale: 1, flash: 0, hurtFlash: 0});
  DRAFT.rerollCost = 10;
  makePlayer(); G.cam.x = 0; G.cam.z = 2;
  if (cp) { // resume: same weapon, upgrades, coins and score, full hearts, the wave you died on
    Object.assign(UP, cp.up); equipWeapon(cp.weapon); G.player.maxHp = G.player.hp = cp.maxHp;
    Object.assign(G, {wave: cp.wave - 1, score: cp.score, kills: cp.kills}); DRAFT.rerollCost = cp.reroll;
    UP.el = Object.assign({fire: 0, frost: 0, storm: 0, poison: 0}, cp.up.el || {}); UP.gear = Object.assign({}, cp.up.gear || {}); UP.wlvl = cp.up.wlvl || 1;
    if (cp.weapon) { LOOK.weapon = LOOK.weapon; equipWeapon(cp.weapon); } buildGear();
    G.player.revive = safeLv('wind');
  } else { clearCheckpoint(); applySafehouse(); }
  ui.hidden = true; document.getElementById('draft').hidden = true; G.state = 'playing'; RADIO.clear();
  G.area = areaIndex(G.wave + 1); if (WORLD.built !== G.area) buildLayout(G.area); else resetBarrels();
  if (G.area === 4) ensureCharacter(docModel().slice(11)).catch(() => {});
  AU.ambience(true);
  const w0 = G.wave, run = G.runId = (G.runId || 0) + 1;
  if (opts.tutorial) TUT.start(); else { areaCard(G.area); setTimeout(() => { if (G.state === 'playing' && G.wave === w0 && G.runId === run) startWave(); }, 2600); }
}
// minor = false (game over): only play buttons; customizing, training, story and settings live on the home screen
function menuButtons(primaryLabel, minor = true) {
  const cp = loadCheckpoint();
  return (cp ? `<button id="go">Continue: ${cp.endless ? 'Endless' : AREAS[areaIndex(cp.wave)].short} · wave ${cp.wave}</button><button id="fresh" class="ghost">New story from the start</button>`
    : `<button id="go">${primaryLabel}</button>`) +
    (storyFlag('ozEndless') && (minor || !cp) ? `<button id="endless" class="ghost">Endless mode</button>` : '') +
    (minor ? `<div class="minor"><button id="custom" class="ghost">Customize survivor</button><button id="howto" class="ghost">How to play</button><button id="story" class="ghost">Story</button></div>` : '');
}
const voiceLabel = () => 'Voices: ' + (VOICE.on ? 'on' : 'off');
const hapLabel = () => 'Vibration: ' + (HAPTIC.on ? 'on' : 'off');
function wireMenu() {
  const cp = loadCheckpoint(), go = document.getElementById('go'), fresh = document.getElementById('fresh');
  // first launch: design the survivor, then the training run
  const play = c => !STORY.seen() && !c ? STORY.intro(() => play(c)) : lookSaved() ? newRun(c, {tutorial: !TUT_DONE()}) : openCreator('play');
  const en = document.getElementById('endless'); if (en) en.onclick = () => lookSaved() ? newRun(null, {endless: true}) : openCreator('play');
  go.disabled = false; go.onclick = () => play(cp); if (fresh) fresh.onclick = () => play(null); go.focus();
  showUpdate();
  if (!document.querySelector('#menu .minor')) return;
  document.getElementById('story').onclick = () => STORY.intro(showMenu);
  document.getElementById('custom').onclick = () => openCreator('menu');
  document.getElementById('howto').onclick = () => { if (!lookSaved()) return openCreator('play'); newRun(null, {tutorial: true}); };
  if (!document.getElementById('vox')) { const v = document.createElement('button'); v.id = 'vox'; v.className = 'ghost'; v.textContent = voiceLabel(); v.onclick = () => { VOICE.toggle(); v.textContent = voiceLabel(); }; const mi = document.querySelector('#menu .minor'); if (mi) mi.append(v); }
  if (HAPTIC.supported() && !document.getElementById('hap')) { const h = document.createElement('button'); h.id = 'hap'; h.className = 'ghost'; h.textContent = hapLabel(); h.onclick = () => { HAPTIC.toggle(); h.textContent = hapLabel(); }; document.querySelector('#menu .minor').append(h); }
}
function waveCleared() {
  slowmo(.8); G.flash = .5; shake(.5); AU.play('waveClear', {vol: .9}); HAPTIC.fx('waveClear'); AU.duck(.2, 1.2);
  HUD.banner('WAVE ' + G.wave + ' CLEARED', '+' + (50 * G.wave) + ' bonus', '#7dff8a'); G.score += 50 * G.wave;
  for (const k of G.pickups) k.t = Math.max(k.t, 1); UP.magnetPulse = 1.5;
  // beating Patient Zero on wave 25 ends the story
  setTimeout(() => { if (!G.player.dead) { if (G.wave === 25 && !G.endless) showEnding(); else openDraft(); } }, 1800);
}
function gameOver() {
  G.state = 'dead'; ui.hidden = false; ui.className = 'overlay gameover';
  // a clean screen: no HUD, banner or upgrade card behind the title
  hudCv.style.visibility = 'hidden'; HUD.bannerT = 0; if (SHOW.active) endShowcase(); document.getElementById('showcase').hidden = true;
  let best = 0; try { best = +localStorage.getItem('ozBest') || 0; if (G.score > best) { localStorage.setItem('ozBest', G.score); } } catch (e) {}
  const rc = G.runCoins || 0, rg = G.runGems || 0;
  ui.innerHTML = `<h1>YOU FELL</h1><p class="big">Wave <b data-n="${G.wave}">${G.wave}</b> · <b data-n="${G.score}">${G.score}</b> points · <b data-n="${G.kills}">${G.kills}</b> kills</p>
    <p>${G.score > best ? 'New best score!' : 'Best: ' + best}</p>
    <p class="earn"><span><i class="ccoin"></i><b data-n="${rc}" data-pre="+">+${rc}</b> ${rc === 1 ? 'coin' : 'coins'} kept</span>${rg ? `<span><i class="cgem"></i><b data-n="${rg}" data-pre="+">+${rg}</b> ${rg === 1 ? 'emerald' : 'emeralds'}</span>` : ''}</p>${menuButtons('Play again', false)}
    <button id="toHome" class="ghost">Home · spend your coins</button>`;
  wireMenu(); saveMeta(); document.getElementById('toHome').onclick = showMenu;
  countUp(ui);
}
// results numbers count up over 0.8 s with ease-out, a rising tick every 4th step, then a small scale pop
function countUp(root) {
  const els = [...root.querySelectorAll('[data-n]')], t0 = performance.now(), D = 800; let step = 0;
  for (const e of els) e.textContent = (e.dataset.pre || '') + '0';
  const tick = now => {
    const k = Math.min(1, (now - t0) / D), e = easeOutCubic(k);
    for (const el of els) el.textContent = (el.dataset.pre || '') + Math.round(+el.dataset.n * e);
    if (Math.floor(k * 24) > step) { step = Math.floor(k * 24); if (step % 4 === 0) AU.play('coin', {vol: .25, rate: .8 + step * .03, max: 2}); }
    if (k < 1) requestAnimationFrame(tick); else for (const el of els) { el.classList.remove('npop'); void el.offsetWidth; el.classList.add('npop'); }
  };
  requestAnimationFrame(tick);
}
// APK only: the build number comes from js/build.js (written by tools/prepare-android.sh).
// One request per launch to the release; a newer build shows a download strip on the menu.
const UPD = {build: 0, url: '', later: false};
function checkUpdate() {
  if (!window.APP_BUILD || !navigator.onLine || Date.now() - (UPD.checked || 0) < 60000) return; UPD.checked = Date.now();
  fetch('https://api.github.com/repos/Ofekbrener/Ofek/releases/tags/zombie-apk', {headers: {Accept: 'application/vnd.github+json'}})
    .then(r => r.ok ? r.json() : null).then(rel => {
      if (!rel) return;
      const m = /build:\s*(\d+)/.exec(rel.body || ''), apk = (rel.assets || []).find(x => /\.apk$/.test(x.name));
      if (!m || !apk || +m[1] <= window.APP_BUILD) return;
      UPD.build = +m[1]; UPD.url = apk.browser_download_url; showUpdate();
    }).catch(() => {});
}
function showUpdate() {
  if (!UPD.url || UPD.later || document.getElementById('upd') || (G.state !== 'menu' && G.state !== 'dead')) return;
  const d = document.createElement('div'); d.id = 'upd';
  d.innerHTML = `<span id="updMsg">New version available (build ${UPD.build})</span><div class="updbar" id="updBar" hidden><i></i></div><button id="updGo">Update now</button><button id="updLater" class="ghost">Later</button>`;
  // a card pinned near the top of the screen, above the home screen and the menu
  document.body.appendChild(d);
  document.getElementById('updGo').onclick = startUpdate;
  document.getElementById('updLater').onclick = () => { UPD.later = true; d.remove(); };
  // the app updates itself: when it may install, the download starts right away
  if (window.AndroidUpdate && window.AndroidUpdate.canInstall() && !UPD.auto) { UPD.auto = true; startUpdate(); }
}
// the app downloads and installs the update itself; Android only asks the player to confirm the install
function startUpdate() {
  const A = window.AndroidUpdate; if (!A) { location.href = UPD.url; return; }
  const msg = document.getElementById('updMsg'), go = document.getElementById('updGo');
  if (!A.canInstall()) { msg.textContent = 'One-time step: allow Zombie Raid to install its updates, then come back.'; go.textContent = 'Allow'; go.onclick = () => { A.allow(); go.textContent = 'Update now'; go.onclick = startUpdate; }; return; }
  UPD.busy = true; go.disabled = true; go.textContent = 'Updating…'; document.getElementById('updBar').hidden = false; msg.textContent = 'Downloading the update…'; A.start(UPD.url);
}
window.UPD_EVENT = function (ev, v) {
  const msg = document.getElementById('updMsg'), bar = document.querySelector('#updBar i'), go = document.getElementById('updGo'); if (!msg) return;
  if (ev === 'progress') { msg.textContent = 'Downloading the update… ' + Math.max(0, v) + '%'; if (bar) bar.style.width = Math.max(0, v) + '%'; }
  if (ev === 'installing') msg.textContent = 'Installing…';
  if (ev === 'confirm') msg.textContent = 'Tap Install in the Android window. Your progress is kept.';
  if (ev === 'done') msg.textContent = 'Updated. Restarting…';
  if (ev === 'error') { msg.textContent = 'The update did not finish. Check your connection and try again.'; go.disabled = false; go.textContent = 'Try again'; }
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && (G.state === 'menu' || G.state === 'dead')) checkUpdate(); });
let MENU_HTML = '';
function showMenu() {
  G.state = 'menu'; ui.hidden = false; HOME.on = false; saveMeta(); hudCv.style.visibility = '';
  const P = G.player; if (P) { P.x = 0; P.z = 5; P.dead = false; P.rig.play('Idle', {fade: .2}); } G.cam.x = 0; G.cam.z = 5;
  if (WORLD.built !== 0) buildLayout(0);
  // first launch goes straight to the story, the survivor creator and training; after that, the home screen
  if (!firstTime()) { ui.className = 'overlay homeui'; showHome(); return; }
  ui.className = 'overlay'; ui.innerHTML = MENU_HTML;
  document.getElementById('go').outerHTML = menuButtons('Play'); wireMenu();
}

// ---------- loop ----------
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const raw = Math.min(.033, (ts - last) / 1000 || 0); last = ts;
  if (G.state === 'loading') return;
  G.time += raw;
  let dt = raw;
  if (G.hitstop > 0) { G.hitstop -= raw; dt = 0; }
  if (G.slowT > 0) { G.slowT -= raw; G.timeScale = lerp(G.timeScale, .25, .2); } else G.timeScale = lerp(G.timeScale, 1, .1);
  dt *= G.timeScale;
  if (G.state === 'playing' || G.state === 'dead') {
    if (dt > 0) { updatePlayer(dt); updateGear(dt); POW.update(dt); updateZombies(dt); updateWaves(dt); updateBarrels(dt); updatePickups(dt); }
    G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  } else if ((G.state === 'draft' || G.state === 'travel') && G.player) { G.player.rig.play('Idle', {fade: .3}); G.player.rig.mixer.update(raw); for (const zb of G.zombies) zb.rig.mixer.update(raw); }
  else if (G.state === 'menu' && G.player) { G.player.rig.mixer.update(raw); if (!HOME.on) G.player.face += raw * .3; else cosAura(G.player, raw); syncPlayer(); }
  else if (G.state === 'creator') updateCreator(raw);
  else if (G.state === 'intro') STORY.update(raw);
  else if (G.state === 'cutscene') TRAVEL.update(raw);
  if (G.state === 'travel' && MAP3D.on) MAP3D.update(raw);
  if (G.state === 'playing') TUT.update(dt);
  RADIO.update(raw);
  if (UP.magnetPulse > 0) { UP.magnetPulse -= raw; for (const k of G.pickups) { const P = G.player, dx = P.x - k.x, dz = P.z - k.z, d = Math.hypot(dx, dz) || 1; k.x += dx / d * 14 * raw; k.z += dz / d * 14 * raw; } }
  updateFX(dt || raw * .02); updateRain(raw);
  G.trauma = Math.max(0, G.trauma - raw * 1.6); G.flash = Math.max(0, G.flash - raw * 2); G.hurtFlash = Math.max(0, G.hurtFlash - raw * 2);
  if (G.player && G.state !== 'creator' && G.state !== 'intro' && G.state !== 'cutscene' && !MAP3D.on) updateCamera(raw);
  if (G.state === 'menu' && HOME.on && G.player) homeCamera(raw);
  renderFX(); renderer.render(scene, camera); drawHUD(raw);
}

// Test hook: advance the simulation without rendering (used by the automated checks).
window.simulate = function (secs, step = 1 / 60) {
  for (let t = 0; t < secs; t += step) {
    G.time += step; let dt = step;
    if (G.hitstop > 0) { G.hitstop -= step; dt = 0; }
    if (G.slowT > 0) { G.slowT -= step; G.timeScale = lerp(G.timeScale, .25, .2); } else G.timeScale = lerp(G.timeScale, 1, .1);
    dt *= G.timeScale;
    if ((G.state === 'playing' || G.state === 'dead') && dt > 0) { updatePlayer(dt); updateGear(dt); POW.update(dt); updateZombies(dt); updateWaves(dt); updateBarrels(dt); updatePickups(dt); }
    if (G.state === 'playing') TUT.update(step);
    G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
    updateFX(dt || step * .02);
  }
};

// ---------- boot ----------
(async function boot() {
  resize();
  const bar = document.getElementById('loadbar'), go = document.getElementById('go');
  const total = MODEL_FILES.length + AU.fileList().length; let done = 0;
  const tick = () => { done++; bar.style.width = (done / total * 100).toFixed(0) + '%'; };
  try {
    await Promise.all([loadModels(tick), AU.load(tick), VOICE.load()]);
  } catch (e) { console.error(e); go.textContent = 'Could not load the game files'; return; }
  buildArena(); renderWeaponArt();
  try { await ensureCharacter(LOOK.char); } catch (e) { LOOK.char = 'Matt'; }
  // canvas text does not wait for web fonts: load the HUD font before the first frame (at most 1.5 s)
  try { await Promise.race([Promise.all([document.fonts.load('700 20px Oswald'), document.fonts.load('500 20px Oswald'), document.fonts.load("20px 'Black Ops One'")]), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  makePlayer(); G.player.z = 0; G.player.face = Math.PI / 2; renderPortrait(G.player.rig);
  document.querySelector('#menu .load').remove(); MENU_HTML = ui.innerHTML;
  showMenu(); checkUpdate();
  // first launch: the story plays by itself, then the survivor creator, then training
  if (firstTime()) setTimeout(() => { if (G.state !== 'menu') return; const after = () => lookSaved() ? newRun(null, {tutorial: !TUT_DONE()}) : openCreator('play'); STORY.seen() ? after() : STORY.intro(after); }, 400);
  requestAnimationFrame(frame);
})();
