import * as THREE from 'three';
import { CONFIG, initialQuality } from './config.js';
import { createRenderer, setQualityPixelRatio } from './renderer.js';
import { Lighting } from './lighting.js';
import { Environment } from './environment.js';
import { Ship } from './ship.js';
import { Obstacles } from './obstacles.js';
import { Pickups, CRYSTAL, ORB } from './pickups.js';
import { Particles, PALETTES } from './particles.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { haptics } from './haptics.js';
import { store } from './storage.js';
import { Progression, POWERUPS, drawCards, rankInfo } from './progression.js';
import { HangarUI, showCards } from './hangar-ui.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
let quality = params.get('quality') === 'low' || params.get('quality') === 'high' ? params.get('quality') : initialQuality();

// ---------------------------------------------------------------- setup
const canvas = $('game');
let gfx;
try {
  gfx = createRenderer(canvas, quality);
} catch (err) {
  console.error(err);
  $('btn-start').textContent = 'WebGL NOT AVAILABLE';
  $('btn-start').disabled = true;
  throw err;
}
const { renderer, scene, camera, rig, resize } = gfx;

const lighting = new Lighting(scene);
const env = new Environment(scene, quality === 'high' ? CONFIG.starsHigh : CONFIG.starsLow);
const ship = new Ship(scene);
const obstacles = new Obstacles(scene, CONFIG.maxObstacles);
const pickups = new Pickups(scene, CONFIG.maxPickups);
obstacles.pickups = pickups;
const particles = new Particles(scene, quality === 'high' ? CONFIG.particlesHigh : CONFIG.particlesLow);
const fx = new FX($('flash'));
const hud = new HUD();
const audio = new AudioEngine();
const input = new Input(canvas, $('btn-left'), $('btn-right'));
const prog = new Progression();
ship.setSkin(prog.skin);

// Expanding shockwave ring for score milestones.
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffd35c, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }),
);
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
scene.add(ring);
let ringT = 1;

function onResize() {
  resize();
  const h = renderer.domElement.height;
  particles.setViewportHeight(h * 1.2);
  env.setViewportHeight(h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
onResize();

// ---------------------------------------------------------------- state
const state = {
  mode: 'menu',          // menu | playing | choosing | resuming | paused | dying | gameover
  score: 0,
  time: 0,
  level: 1,
  speed: 14,
  nearMisses: 0,
  combo: 1,
  comboTimer: 0,
  nextMilestone: CONFIG.milestone,
  nextTick: 100,
  deathTimer: 0,
  best: parseInt(store.get('best', '0'), 10) || 0,
  menuTime: 0,
  emitAcc: 0,
  slowMuffled: false,
  perfectCd: 0,          // real seconds until a PERFECT may slow time again
  crystals: 0,
  crystalAcc: 0,
  streak: 0,
  streakTimer: 0,
  shields: 0,
  picked: {},
  mods: prog.modifiers({}),
  worldScale: 1,         // eases to 0 while choosing a power-up
  resumeT: 0,
  countStep: 0,
  hangarReturn: 'start',
};
const nearEvents = [];
const pickEvents = [];
const tmpV = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
let cardPick = null;

const screens = {
  start: $('screen-start'),
  pause: $('screen-pause'),
  over: $('screen-over'),
  hangar: $('screen-hangar'),
  cards: $('screen-cards'),
};
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
}

function updateMenuMeta() {
  $('start-best').textContent = state.best > 0 ? `BEST  ${state.best.toLocaleString()}` : '';
  const r = rankInfo(prog.data.xp);
  $('start-rank').textContent = `${r.title} · Rank ${r.rank + 1}`;
  $('start-crystals').textContent = prog.crystals.toLocaleString();
  $('start-xp-fill').style.width = `${(r.into / r.need) * 100}%`;
}
updateMenuMeta();

const hangarUI = new HangarUI(prog, {
  audio,
  haptics,
  onChange: () => { ship.setSkin(prog.skin); updateMenuMeta(); },
});

// ---------------------------------------------------------------- toggles
const soundBtn = $('btn-sound');
const hapticsBtn = $('btn-haptics');
function refreshToggles() {
  soundBtn.classList.toggle('off', audio.muted);
  soundBtn.textContent = audio.muted ? '🔇 Sound' : '🔊 Sound';
  hapticsBtn.classList.toggle('off', !haptics.enabled);
}
if (!haptics.supported) hapticsBtn.classList.add('hidden');
soundBtn.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  audio.click();
  refreshToggles();
});
hapticsBtn.addEventListener('click', () => {
  haptics.setEnabled(!haptics.enabled);
  audio.click();
  refreshToggles();
});
refreshToggles();

// ---------------------------------------------------------------- modifiers
function applyMods() {
  const m = (state.mods = prog.modifiers(state.picked));
  ship.handling = m.handling;
  input.handling = m.handling;
  obstacles.orbChance = m.orbChance;
}

function setShields(n) {
  state.shields = Math.min(5, n);
  ship.setShielded(state.shields > 0);
  hud.setShields(state.shields);
}

// ---------------------------------------------------------------- flow
function startGame() {
  audio.unlock();
  audio.click();
  haptics.tap();

  Object.assign(state, {
    mode: 'playing', score: 0, time: 0, level: 1, speed: CONFIG.baseSpeed,
    nearMisses: 0, combo: 1, comboTimer: 0, nextMilestone: CONFIG.milestone,
    nextTick: 100, deathTimer: 0, emitAcc: 0, slowMuffled: false, perfectCd: 0,
    crystals: 0, crystalAcc: 0, streak: 0, streakTimer: 0, picked: {},
    worldScale: 1, resumeT: 0,
  });
  applyMods();
  obstacles.reset();
  pickups.reset();
  ship.reset();
  ship.setSkin(prog.skin);
  fx.reset();
  input.reset();
  input.enabled = true;
  hud.reset();
  hud.show(true);
  setShields(state.mods.startShields);
  showScreen(null);

  env.setLevelHue(1);
  lighting.setLevelHue(1);
  audio.setLevel(1);
  audio.startMusic();
  audio.muffleMusic(18000, 0.1);
  audio.startEngine();
  hud.showBanner('GO!', 900);
  perf.reset();
}

function toMenu() {
  audio.click();
  audio.stopMusic();
  audio.stopEngine();
  input.enabled = false;
  hud.show(false);
  ship.reset();
  ship.setShielded(false);
  state.mode = 'menu';
  updateMenuMeta();
  showScreen('start');
}

function openHangar(from) {
  audio.unlock();
  audio.click();
  state.hangarReturn = from;
  hangarUI.render();
  showScreen('hangar');
}

function closeHangar() {
  audio.click();
  updateMenuMeta();
  showScreen(state.hangarReturn);
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  input.enabled = false;
  input.release();
  audio.suspend();
  showScreen('pause');
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  audio.resume();
  audio.click();
  state.mode = 'playing';
  input.enabled = true;
  showScreen(null);
}

// ---- in-run power-up choice ----
function openCards(level) {
  const cards = drawCards(state.picked);
  if (!cards.length) return;
  state.mode = 'choosing';
  input.enabled = false;
  input.release();
  audio.muffleMusic(1400, 0.15);
  showScreen('cards');
  cardPick = showCards(level, cards, pickPower);
}

function pickPower(def) {
  state.picked[def.id] = (state.picked[def.id] || 0) + 1;
  applyMods();
  if (def.id === 'shield') {
    setShields(state.shields + 1);
    audio.shieldUp();
  }
  hud.setPowers(state.picked, POWERUPS);
  audio.cardSelect();
  haptics.card();
  cardPick = null;
  showScreen(null);

  // Clear the lane ahead and count back in.
  obstacles.clearAhead(-40);
  state.mode = 'resuming';
  state.resumeT = 0.9;
  state.countStep = 0;
  input.enabled = true;
  audio.muffleMusic(18000, 0.3);
}

function crash() {
  state.mode = 'dying';
  state.deathTimer = CONFIG.deathDelay;
  input.enabled = false;

  const x = ship.x;
  ship.group.visible = false;
  const big = quality === 'high' ? 1 : 0.55;
  particles.burst(x, 0, 0, Math.round(240 * big), 15, 1.3, 0.9, PALETTES.explosion, 2.2, 0.25);
  particles.burst(x, 0, 0, Math.round(90 * big), 30, 0.7, 0.35, PALETTES.spark, 1.2, 0.2);
  particles.burst(x, 0, 0, Math.round(40 * big), 5, 1.8, 1.6, [[0.35, 0.12, 0.08], [0.5, 0.2, 0.1]], 1.0, 0.15);
  lighting.flashAt(x, 0.6, 0.8, 180);

  fx.shake(1);
  fx.slowMo(CONFIG.deathSlowMo, 0.6);
  fx.kickFov(14);
  fx.flash('rgba(255, 90, 40, 0.9)', 0.85, 550);

  audio.collision();
  audio.stopEngine(0.15);
  audio.muffleMusic(450, 0.25);
  haptics.collision();
  env.pulse(1.5);
}

// Shield soaks the hit: the obstacle shatters and the ship blinks briefly.
function absorbHit(o) {
  obstacles.destroy(o);
  setShields(state.shields - 1);
  ship.invuln = CONFIG.shieldGrace;
  const hx = o.type === 0 ? o.x : ship.x;
  particles.burst(hx, 0, o.z, quality === 'high' ? 70 : 35, 12, 0.8, 0.5, [[0.8, 0.8, 0.85], [0.55, 0.5, 0.6]], 2, 0.4);
  particles.burst(ship.x, 0, 0, quality === 'high' ? 60 : 30, 9, 0.6, 0.4, [[0.45, 0.7, 1], [0.8, 0.9, 1]], 2.5, 0.3);
  lighting.flashAt(ship.x, 0.6, 0.5, 70, 0x6fb8ff);
  fx.shake(0.5);
  fx.flash('rgba(111, 184, 255, 0.6)', 0.4, 350);
  audio.shieldBreak();
  haptics.shieldBreak();
  hud.popup('SHIELD SAVED YOU', shipScreenX(), 'cyan');
}

function countUp(el, to, ms = 700) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function gameOver() {
  state.mode = 'gameover';
  hud.show(false);
  const final = Math.floor(state.score);
  const isBest = final > state.best;
  if (isBest) {
    state.best = final;
    store.set('best', final);
  }
  $('final-score').textContent = final.toLocaleString();
  $('over-best').textContent = state.best.toLocaleString();
  $('over-level').textContent = state.level;
  $('over-near').textContent = state.nearMisses;
  $('over-time').textContent = `${Math.floor(state.time)}s`;
  $('new-best').classList.toggle('hidden', !isBest);

  // Bank crystals + XP.
  const bonus = Math.floor(final / CONFIG.payoutScoreDivisor);
  const earned = state.crystals + bonus;
  const { before, after } = prog.bankRun(earned, final);
  $('pay-collected').textContent = '0';
  $('pay-bonus').textContent = '0';
  $('pay-total').textContent = '0';
  $('over-rank').textContent = before.title;
  $('over-xp').textContent = `+${final.toLocaleString()} XP`;
  const fill = $('over-xp-fill');
  fill.style.transition = 'none';
  fill.style.width = `${(before.into / before.need) * 100}%`;
  showScreen('over');

  setTimeout(() => {
    countUp($('pay-collected'), state.crystals, 500);
    countUp($('pay-bonus'), bonus, 500);
    countUp($('pay-total'), earned, 900);
    fill.style.transition = '';
    if (after.rank > before.rank) {
      fill.style.width = '100%';
      setTimeout(() => {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        void fill.offsetWidth;
        fill.style.transition = '';
        fill.style.width = `${(after.into / after.need) * 100}%`;
        $('over-rank').textContent = `RANK UP! ${after.title}`;
        audio.chime();
        haptics.milestone();
      }, 750);
    } else {
      fill.style.width = `${(after.into / after.need) * 100}%`;
      if (isBest) {
        audio.chime();
        haptics.milestone();
      }
    }
  }, 350);
}

$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', toMenu);
$('btn-quit').addEventListener('click', () => { audio.resume(); toMenu(); });
$('btn-resume').addEventListener('click', resumeGame);
$('btn-pause').addEventListener('click', pauseGame);
$('btn-hangar').addEventListener('click', () => openHangar('start'));
$('btn-over-hangar').addEventListener('click', () => openHangar('over'));
$('btn-hangar-back').addEventListener('click', closeHangar);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  }
  if (state.mode === 'choosing' && cardPick && ['1', '2', '3'].includes(e.key)) {
    cardPick(Number(e.key) - 1);
  }
  const onMenu = (state.mode === 'menu' || state.mode === 'gameover') && screens.hangar.classList.contains('hidden');
  if ((e.key === ' ' || e.key === 'Enter') && onMenu) {
    e.preventDefault();
    startGame();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
    audio.suspend();
  } else if (state.mode !== 'paused') {
    audio.resume();
  }
});

// ---------------------------------------------------------------- events
function shipScreenX() {
  tmpV.set(ship.x, 0, 0).project(camera);
  return (tmpV.x + 1) / 2;
}

function onNearMiss(ev) {
  const m = state.mods;
  const perfect = ev.gap < m.perfectMargin;
  state.nearMisses++;
  state.combo = state.comboTimer > 0 ? Math.min(CONFIG.maxCombo, state.combo + 1) : 1;
  state.comboTimer = CONFIG.comboWindow;
  const base = perfect ? CONFIG.perfectBonus : CONFIG.nearMissBonus;
  const bonus = Math.round(base * state.combo * m.nearMult * m.scoreMult);
  state.score += bonus;
  hud.setCombo(state.combo);
  const sx = ship.x + ev.side * 0.6;

  if (perfect) {
    hud.popup(`PERFECT +${bonus}`, shipScreenX(), '');
    hud.pop(1.4, '#ffd35c');
    particles.burst(sx, 0, 0.2, quality === 'high' ? 30 : 16, 8, 0.45, 0.32, PALETTES.spark, 3, 0.6);
    audio.nearMiss(ev.side, 1);
    // The big moment (slow-mo, flash, buzz) is rationed so it stays special.
    if (state.perfectCd <= 0) {
      state.perfectCd = CONFIG.perfectCooldown;
      fx.slowMo(CONFIG.slowMoScale, CONFIG.slowMoDuration + m.slowMoExtra);
      audio.muffleMusic(1100, 0.03);
      state.slowMuffled = true;
      fx.flash('rgba(60, 242, 255, 0.4)', 0.18, 220);
      fx.kickFov(4);
      fx.shake(0.1);
      haptics.perfect();
    }
  } else {
    hud.popup(`+${bonus}`, shipScreenX() + ev.side * -0.1, 'cyan');
    hud.pop(0.7, '#3cf2ff');
    particles.burst(sx, 0, 0.2, quality === 'high' ? 12 : 6, 6, 0.35, 0.28, PALETTES.spark, 3, 0.6);
    audio.nearMiss(ev.side, 0);
  }
}

function onPickup(ev) {
  if (ev.type === CRYSTAL) {
    state.crystalAcc += state.mods.crystalMult;
    const n = Math.floor(state.crystalAcc);
    state.streak = state.streakTimer > 0 ? state.streak + 1 : 0;
    state.streakTimer = 1.2;
    state.score += CONFIG.crystalScoreBonus * state.mods.scoreMult;
    audio.pickup(state.streak);
    const c = ship.trailColor;
    particles.burst(ev.x, 0.1, Math.min(ev.z, 0.3), quality === 'high' ? 14 : 8, 5, 0.4, 0.3, [[0.6, 1, 1], c, [1, 1, 1]], 3, 0.8);
    if (n !== state.crystals) {
      state.crystals = n;
      hud.setCrystals(n);
    }
  } else if (ev.type === ORB) {
    setShields(state.shields + 1);
    audio.shieldUp();
    haptics.tap();
    hud.popup('+SHIELD', shipScreenX(), 'cyan');
    particles.burst(ship.x, 0.1, 0, quality === 'high' ? 40 : 20, 7, 0.6, 0.45, [[0.45, 0.7, 1], [0.8, 0.9, 1]], 2.5, 0.6);
  }
}

function onScoreProgress() {
  while (state.score >= state.nextTick) {
    state.nextTick += 100;
    const prog01 = ((state.nextTick - 100) % CONFIG.milestone) / CONFIG.milestone;
    hud.pop(0.6);
    if (prog01 !== 0) audio.scoreTick(prog01);
  }
  while (state.score >= state.nextMilestone) {
    const m = state.nextMilestone;
    state.nextMilestone += CONFIG.milestone;
    hud.showBanner(m.toLocaleString(), 1300);
    hud.pop(2.4, '#ffd35c');
    audio.chime();
    haptics.milestone();
    fx.flash('rgba(255, 211, 92, 0.55)', 0.35, 400);
    env.pulse(1);
    particles.burst(ship.x, 0.2, 0, quality === 'high' ? 90 : 45, 9, 0.9, 0.45, PALETTES.gold, 1.8, 0.5);
    ring.position.set(ship.x, -0.2, 0);
    ringT = 0;
  }
}

function onLevelUp(level) {
  state.level = level;
  hud.setLevel(level);
  audio.setLevel(level);
  audio.levelUp();
  haptics.levelUp();
  env.setLevelHue(level);
  lighting.setLevelHue(level);
  particles.burst(ship.x, 0.2, -1, quality === 'high' ? 60 : 30, 10, 0.8, 0.4, PALETTES.pink, 2, 0.8);
  if ((level - 1) % CONFIG.cardsEveryLevels === 0) openCards(level);
  else hud.showBanner(`LEVEL ${level}`, 1500);
}

// ---------------------------------------------------------------- perf
const perf = {
  frames: 0, acc: 0, fps: 60, sampleT: 0, sampleFrames: 0, checked: false,
  reset() { this.sampleT = 0; this.sampleFrames = 0; this.checked = false; },
  tick(realDt) {
    this.frames++;
    this.acc += realDt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
    }
    // Auto-downgrade once, early in a run, if the device struggles.
    if (state.mode === 'playing' && !this.checked && quality === 'high') {
      this.sampleT += realDt;
      if (this.sampleT > 0.75) this.sampleFrames++;
      if (this.sampleT > 3.5) {
        this.checked = true;
        const avg = this.sampleFrames / (this.sampleT - 0.75);
        if (avg < 45) {
          quality = 'low';
          setQualityPixelRatio(renderer, quality);
          onResize();
        }
      }
    }
  },
};
const debugEl = $('debug');
if (DEBUG) debugEl.classList.remove('hidden');

// ---------------------------------------------------------------- loop
let last = performance.now();
let lastFov = 0;

function updateRun(dt, realDt) {
  const m = state.mods;
  const live = state.mode === 'playing';
  if (live) {
    state.time += dt;
    const level = 1 + Math.floor(state.time / CONFIG.levelDuration);
    if (level !== state.level) onLevelUp(level);
  }

  state.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + CONFIG.speedRamp * state.time) * m.speedMult;
  const spawnInterval = CONFIG.minSpawnInterval +
    (CONFIG.baseSpawnInterval - CONFIG.minSpawnInterval) * Math.exp(-state.time / CONFIG.spawnCurve);

  ship.setTarget(input.update(realDt, ship.x));
  const hit = obstacles.update(dt, state.speed, spawnInterval, state.level, ship.x, live, nearEvents);
  pickEvents.length = 0;
  pickups.update(dt, state.speed, ship.x, m.magnet, pickEvents);
  for (const ev of pickEvents) onPickup(ev);

  if (hit && state.mode === 'playing' && ship.invuln <= 0) {
    if (state.shields > 0) absorbHit(hit);
    else { crash(); return; }
  }
  if (live) for (const ev of nearEvents) onNearMiss(ev);

  state.score += state.speed * dt * CONFIG.distanceScore * m.scoreMult;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) { state.combo = 1; hud.setCombo(1); }
  }
  if (state.streakTimer > 0) state.streakTimer -= dt;
  onScoreProgress();
  hud.setScore(state.score);
}

function frame(now) {
  requestAnimationFrame(frame);
  let realDt = (now - last) / 1000;
  last = now;
  if (!(realDt > 0)) realDt = 1 / 60;
  realDt = Math.min(realDt, 1 / 20);
  perf.tick(realDt);

  if (state.mode === 'paused') {
    renderer.render(scene, camera);
    return;
  }

  fx.update(realDt);
  state.perfectCd = Math.max(0, state.perfectCd - realDt);

  // World time: slow-mo × power-up freeze.
  if (state.mode === 'choosing') {
    state.worldScale *= Math.exp(-realDt * 9);
  } else if (state.mode === 'resuming') {
    state.resumeT -= realDt;
    state.worldScale = Math.min(1, Math.max(state.worldScale, 1 - state.resumeT / 0.9));
    const step = state.resumeT > 0.6 ? 1 : state.resumeT > 0.3 ? 2 : state.resumeT > 0 ? 3 : 4;
    if (step !== state.countStep) {
      state.countStep = step;
      hud.showBanner(step < 4 ? String(4 - step) : 'GO!', step < 4 ? 320 : 600);
      audio.countdown(step === 4);
    }
    if (state.resumeT <= 0) {
      state.mode = 'playing';
      state.worldScale = 1;
      ship.invuln = CONFIG.resumeGrace;
    }
  } else {
    state.worldScale = 1;
  }
  const ts = fx.timeScale * state.worldScale;
  const dt = realDt * ts;
  nearEvents.length = 0;

  if (state.mode === 'playing' || state.mode === 'choosing' || state.mode === 'resuming') {
    updateRun(dt, realDt);
  } else if (state.mode === 'dying') {
    state.speed = Math.max(6, state.speed * Math.exp(-dt * 1.2));
    obstacles.update(dt, state.speed, 1, state.level, 999, false, nearEvents);
    pickups.update(dt, state.speed, 999, 0, pickEvents);
    state.deathTimer -= realDt;
    if (state.deathTimer <= 0) gameOver();
  } else {
    // menu / game over: calm attract mode
    state.menuTime += realDt;
    state.speed += ((state.mode === 'menu' ? 16 : 8) - state.speed) * (1 - Math.exp(-realDt * 1.5));
    obstacles.update(dt, state.speed, 1, 1, 999, false, nearEvents);
    pickups.update(dt, state.speed, 999, 0, pickEvents);
    if (state.mode === 'menu') ship.setTarget(Math.sin(state.menuTime * 0.7) * 1.8);
  }

  // Restore music brightness after a near-miss slow-mo.
  if (state.slowMuffled && ts > 0.9 && state.mode === 'playing') {
    state.slowMuffled = false;
    audio.muffleMusic(18000, 0.15);
  }

  const speedNorm = THREE.MathUtils.clamp((state.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
  // Steering runs on real time: control never feels sluggish during slow-mo.
  ship.update(state.mode === 'choosing' ? 0 : realDt, speedNorm);

  // Engine trail (skin-coloured)
  if (ship.group.visible) {
    ship.group.updateMatrixWorld();
    const rate = (quality === 'high' ? 110 : 65) * (1 + speedNorm * 0.5);
    state.emitAcc += dt * rate;
    const c1 = ship.trailColor;
    const c2 = ship.trailColor2;
    while (state.emitAcc >= 1) {
      state.emitAcc -= 1;
      for (let i = 0; i < 2; i++) {
        ship.nozzleWorld(i, tmpV);
        const c = Math.random() < 0.15 ? c2 : c1;
        particles.emit(
          tmpV.x + (Math.random() - 0.5) * 0.1, tmpV.y + (Math.random() - 0.5) * 0.1, tmpV.z,
          (Math.random() - 0.5) * 0.8 - ship.vx * 0.15, (Math.random() - 0.5) * 0.6, 3 + Math.random() * 3,
          0.3 + Math.random() * 0.18, 0.7 + speedNorm * 0.4,
          c[0], c[1], c[2], 0.6, 1,
        );
      }
    }
  }

  particles.update(dt, state.speed);
  env.update(dt, realDt, state.speed, speedNorm);
  lighting.update(realDt);

  if (ringT < 1) {
    ringT = Math.min(1, ringT + realDt * 1.6);
    ring.visible = true;
    const s = 1 + ringT * 7;
    ring.scale.set(s, s, s);
    ring.material.opacity = (1 - ringT) * 0.9;
    if (ringT >= 1) ring.visible = false;
  }

  // Camera follows the ship loosely, with shake + banking roll.
  camera.position.set(
    rig.basePos.x + ship.x * 0.4 + fx.shakeX,
    rig.basePos.y + fx.shakeY,
    rig.basePos.z,
  );
  lookTarget.set(rig.lookAt.x + ship.x * 0.3, rig.lookAt.y, rig.lookAt.z);
  camera.lookAt(lookTarget);
  camera.rotateZ(fx.shakeRoll - ship.vx * 0.004);
  const fov = rig.baseFov + fx.fovKick + speedNorm * 6;
  if (Math.abs(fov - lastFov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    lastFov = fov;
  }

  if (state.mode === 'playing' || state.mode === 'resuming') audio.setEngine(speedNorm, input.steer, ts);

  renderer.render(scene, camera);

  if (DEBUG) {
    const info = renderer.info.render;
    debugEl.textContent =
      `fps ${perf.fps.toFixed(0)}  q:${quality}\n` +
      `calls ${info.calls}  tris ${info.triangles}\n` +
      `particles ${particles.alive}  speed ${state.speed.toFixed(1)}\n` +
      `ts ${ts.toFixed(2)}  lvl ${state.level}  ${state.mode}`;
  }
}
requestAnimationFrame(frame);

// Expose a tiny hook for automated tests / debugging.
if (DEBUG) {
  window.__game = {
    state, ship, obstacles, pickups, fx, input, prog,
    addCrystals(n) { prog.data.crystals += n; prog.save(); updateMenuMeta(); },
    jumpTime(t) { state.time = t; },
  };
}

// ---------------------------------------------------------------- PWA
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.has('nosw')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}
