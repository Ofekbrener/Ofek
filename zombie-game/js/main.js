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
    if (near(b.atk)) startAttack();
    else if (near(b.jmp)) jump();
    else if (UP.dash && near(b.dash)) dash();
    else if (!INPUT.joy) INPUT.joy = {id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY};
  }
  e.preventDefault();
}, {passive: false});
cv3.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (INPUT.joy && t.identifier === INPUT.joy.id) { INPUT.joy.x = t.clientX; INPUT.joy.y = t.clientY; } e.preventDefault(); }, {passive: false});
const endTouch = e => { for (const t of e.changedTouches) if (INPUT.joy && t.identifier === INPUT.joy.id) INPUT.joy = null; };
cv3.addEventListener('touchend', endTouch); cv3.addEventListener('touchcancel', endTouch);

// ---------- camera ----------
function updateCamera(dt) {
  const P = G.player, c = G.cam;
  c.x = lerp(c.x, P.x, damp(.003, dt)); c.z = lerp(c.z, P.z, damp(.003, dt));
  c.kx = lerp(c.kx, 0, damp(.0001, dt)); c.kz = lerp(c.kz, 0, damp(.0001, dt));
  c.zk = lerp(c.zk, 0, damp(.0005, dt)); c.zoom = lerp(c.zoom, G.slowT > 0 ? 1.15 : 1, damp(.01, dt));
  const sh = G.trauma * G.trauma, t = G.time, z = c.zoom + c.zk;
  const ox = sh * .5 * (Math.sin(t * 93) + Math.sin(t * 41)) / 2, oy = sh * .5 * (Math.cos(t * 87) + Math.sin(t * 53)) / 2;
  const tx = c.x + c.kx, tz = c.z + c.kz;
  camera.position.set(tx + ox, 11 / z + oy, tz + 8.6 / z); camera.lookAt(tx + ox * .4, .9, tz); camera.rotateZ(sh * .05 * Math.sin(t * 71) + c.roll);
  c.roll = lerp(c.roll, 0, damp(.002, dt));
  WORLD.moon.position.set(tx + 8, 22, tz + 6); WORLD.moon.target.position.set(tx, 0, tz);
}

// ---------- flow ----------
const ui = document.getElementById('menu');
// Checkpoint: saved at the start of every wave, so a run can resume from the wave you died on.
const SAVE_KEY = 'ozCheckpoint';
function saveCheckpoint() {
  const P = G.player; const {magnetPulse, ...up} = UP;
  const cp = {wave: G.wave, weapon: P.weapon, maxHp: P.maxHp, coins: G.coins, score: G.score, kills: G.kills, reroll: DRAFT.rerollCost, up};
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(cp)); } catch (e) {}
}
function loadCheckpoint() { try { const c = JSON.parse(localStorage.getItem(SAVE_KEY)); return c && c.wave > 1 ? c : null; } catch (e) { return null; } }
function clearCheckpoint() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function newRun(cp = null) {
  AU.resume(); clearZombies(); clearPickups(); clearFX(); clearTrail(); resetUpgrades();
  if (G.player && G.player.javelin) { scene.remove(G.player.javelin.g); G.player.javelin = null; }
  for (const b of G.barrels) { scene.remove(b.m); } G.barrels = []; for (const [x, z] of [[-6, -3], [6.5, 3.5], [-3, 9.5], [3.5, -10], [-12, 4], [12, -3]]) addBarrel(x, z);
  Object.assign(G, {wave: 0, score: 0, coins: 0, kills: 0, combo: 0, hitstop: 0, trauma: 0, slowT: 0, timeScale: 1, flash: 0, hurtFlash: 0});
  DRAFT.rerollCost = 10;
  makePlayer(); G.cam.x = 0; G.cam.z = 2;
  if (cp) { // resume: same weapon, upgrades, coins and score, full hearts, the wave you died on
    Object.assign(UP, cp.up); equipWeapon(cp.weapon); G.player.maxHp = G.player.hp = cp.maxHp;
    Object.assign(G, {wave: cp.wave - 1, coins: cp.coins, score: cp.score, kills: cp.kills}); DRAFT.rerollCost = cp.reroll;
  } else clearCheckpoint();
  ui.hidden = true; document.getElementById('draft').hidden = true; G.state = 'playing';
  AU.ambience(true); startWave();
}
function menuButtons(primaryLabel) {
  const cp = loadCheckpoint();
  return cp ? `<button id="go">Continue from wave ${cp.wave}</button><button id="fresh" class="ghost">New run from wave 1</button>`
    : `<button id="go">${primaryLabel}</button>`;
}
const hapLabel = () => 'Vibration: ' + (HAPTIC.on ? 'on' : 'off');
function wireMenu() {
  const cp = loadCheckpoint(), go = document.getElementById('go'), fresh = document.getElementById('fresh');
  go.disabled = false; go.onclick = () => newRun(cp); if (fresh) fresh.onclick = () => newRun(null); go.focus();
  if (HAPTIC.supported() && !document.getElementById('hap')) { const h = document.createElement('button'); h.id = 'hap'; h.className = 'ghost'; h.textContent = hapLabel(); h.onclick = () => { HAPTIC.toggle(); h.textContent = hapLabel(); }; (fresh || go).after(h); }
}
function waveCleared() {
  slowmo(.8); G.flash = .5; shake(.5); AU.play('waveClear', {vol: .9}); HAPTIC.fx('waveClear'); AU.duck(.2, 1.2);
  HUD.banner('WAVE ' + G.wave + ' CLEARED', '+' + (50 * G.wave) + ' bonus', '#7dff8a'); G.score += 50 * G.wave;
  for (const k of G.pickups) k.t = Math.max(k.t, 1); UP.magnetPulse = 1.5;
  setTimeout(() => { if (!G.player.dead) openDraft(); }, 1800);
}
function gameOver() {
  G.state = 'dead'; ui.hidden = false;
  let best = 0; try { best = +localStorage.getItem('ozBest') || 0; if (G.score > best) { localStorage.setItem('ozBest', G.score); } } catch (e) {}
  ui.innerHTML = `<h1>YOU FELL</h1><p class="big">Wave ${G.wave} · ${G.score} points · ${G.kills} kills</p>
    <p>${G.score > best ? 'New best score!' : 'Best: ' + best}</p>${menuButtons('Play again')}`;
  wireMenu();
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
    if (dt > 0) { updatePlayer(dt); updateZombies(dt); updateWaves(dt); updateBarrels(dt); updatePickups(dt); }
    G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  } else if (G.state === 'draft' && G.player) { G.player.rig.play('Idle', {fade: .3}); G.player.rig.mixer.update(raw); for (const zb of G.zombies) zb.rig.mixer.update(raw); }
  else if (G.state === 'menu' && G.player) { G.player.rig.mixer.update(raw); G.player.face += raw * .3; syncPlayer(); }
  if (UP.magnetPulse > 0) { UP.magnetPulse -= raw; for (const k of G.pickups) { const P = G.player, dx = P.x - k.x, dz = P.z - k.z, d = Math.hypot(dx, dz) || 1; k.x += dx / d * 14 * raw; k.z += dz / d * 14 * raw; } }
  updateFX(dt || raw * .02); updateRain(raw);
  G.trauma = Math.max(0, G.trauma - raw * 1.6); G.flash = Math.max(0, G.flash - raw * 2); G.hurtFlash = Math.max(0, G.hurtFlash - raw * 2);
  if (G.player) updateCamera(raw);
  renderFX(); renderer.render(scene, camera); drawHUD(raw);
}

// Test hook: advance the simulation without rendering (used by the automated checks).
window.simulate = function (secs, step = 1 / 60) {
  for (let t = 0; t < secs; t += step) {
    G.time += step; let dt = step;
    if (G.hitstop > 0) { G.hitstop -= step; dt = 0; }
    if (G.slowT > 0) { G.slowT -= step; G.timeScale = lerp(G.timeScale, .25, .2); } else G.timeScale = lerp(G.timeScale, 1, .1);
    dt *= G.timeScale;
    if ((G.state === 'playing' || G.state === 'dead') && dt > 0) { updatePlayer(dt); updateZombies(dt); updateWaves(dt); updateBarrels(dt); updatePickups(dt); }
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
    await Promise.all([loadModels(tick), AU.load(tick)]);
  } catch (e) { console.error(e); go.textContent = 'Could not load the game files'; return; }
  buildArena(); renderWeaponArt(); makePlayer(); G.player.z = 0; G.player.face = Math.PI / 2;
  G.state = 'menu'; go.outerHTML = menuButtons('Play'); wireMenu();
  requestAnimationFrame(frame);
})();
