import * as THREE from 'three';
import { CONFIG, initialQuality } from './config.js';
import { createRenderer, setQualityPixelRatio } from './renderer.js';
import { Lighting } from './lighting.js';
import { Environment } from './environment.js';
import { Ship } from './ship.js';
import { Obstacles } from './obstacles.js';
import { Particles, PALETTES } from './particles.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { haptics } from './haptics.js';
import { store } from './storage.js';

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
const particles = new Particles(scene, quality === 'high' ? CONFIG.particlesHigh : CONFIG.particlesLow);
const fx = new FX($('flash'));
const hud = new HUD();
const audio = new AudioEngine();
const input = new Input(canvas, $('btn-left'), $('btn-right'));

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
  mode: 'menu',          // menu | playing | paused | dying | gameover
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
};
const nearEvents = [];
const tmpV = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

const screens = {
  start: $('screen-start'),
  pause: $('screen-pause'),
  over: $('screen-over'),
};
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
}

function updateBestLabel() {
  $('start-best').textContent = state.best > 0 ? `BEST  ${state.best.toLocaleString()}` : '';
}
updateBestLabel();

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

// ---------------------------------------------------------------- flow
function startGame() {
  audio.unlock();
  audio.click();
  haptics.tap();

  Object.assign(state, {
    mode: 'playing', score: 0, time: 0, level: 1, speed: CONFIG.baseSpeed,
    nearMisses: 0, combo: 1, comboTimer: 0, nextMilestone: CONFIG.milestone,
    nextTick: 100, deathTimer: 0, emitAcc: 0, slowMuffled: false,
  });
  obstacles.reset();
  ship.reset();
  fx.reset();
  input.reset();
  input.enabled = true;
  hud.reset();
  hud.show(true);
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
  state.mode = 'menu';
  updateBestLabel();
  showScreen('start');
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
  fx.slowMo(CONFIG.deathSlowMo, 0.6, true);
  fx.kickFov(14);
  fx.flash('rgba(255, 90, 40, 0.9)', 0.85, 550);

  audio.collision();
  audio.stopEngine(0.15);
  audio.muffleMusic(450, 0.25);
  haptics.collision();
  env.pulse(1.5);
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
  showScreen('over');
  if (isBest) {
    audio.chime();
    haptics.milestone();
  }
}

$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', toMenu);
$('btn-quit').addEventListener('click', () => { audio.resume(); toMenu(); });
$('btn-resume').addEventListener('click', resumeGame);
$('btn-pause').addEventListener('click', pauseGame);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  }
  if ((e.key === ' ' || e.key === 'Enter') && (state.mode === 'menu' || state.mode === 'gameover')) {
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
  state.nearMisses++;
  state.combo = state.comboTimer > 0 ? Math.min(CONFIG.maxCombo, state.combo + 1) : 1;
  state.comboTimer = CONFIG.comboWindow;
  const bonus = CONFIG.nearMissBonus * state.combo;
  state.score += bonus;

  hud.popup(`+${bonus} NEAR MISS`, shipScreenX() + ev.side * -0.12, state.combo > 1 ? '' : 'cyan');
  hud.pop(1.4, '#3cf2ff');
  hud.setCombo(state.combo);

  if (fx.slowMo()) {
    audio.muffleMusic(900, 0.03);
    state.slowMuffled = true;
  }
  fx.kickFov(5);
  fx.shake(0.14);
  fx.flash('rgba(60, 242, 255, 0.5)', 0.22, 220);
  const sx = ship.x + ev.side * 0.6;
  particles.burst(sx, 0, 0.2, quality === 'high' ? 30 : 16, 8, 0.45, 0.32, PALETTES.spark, 3, 0.6);
  audio.nearMiss(ev.side);
  haptics.nearMiss();
}

function onScoreProgress() {
  while (state.score >= state.nextTick) {
    state.nextTick += 100;
    const prog = ((state.nextTick - 100) % CONFIG.milestone) / CONFIG.milestone;
    hud.pop(0.6);
    if (prog !== 0) audio.scoreTick(prog);
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
  hud.showBanner(`LEVEL ${level}`, 1500);
  audio.setLevel(level);
  audio.levelUp();
  haptics.levelUp();
  env.setLevelHue(level);
  lighting.setLevelHue(level);
  particles.burst(ship.x, 0.2, -1, quality === 'high' ? 60 : 30, 10, 0.8, 0.4, PALETTES.pink, 2, 0.8);
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
  const ts = fx.timeScale;
  const dt = realDt * ts;
  nearEvents.length = 0;

  if (state.mode === 'playing') {
    state.time += dt;
    const level = 1 + Math.floor(state.time / CONFIG.levelDuration);
    if (level !== state.level) onLevelUp(level);

    state.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + CONFIG.speedRamp * state.time);
    const spawnInterval = CONFIG.minSpawnInterval +
      (CONFIG.baseSpawnInterval - CONFIG.minSpawnInterval) * Math.exp(-state.time / CONFIG.spawnCurve);

    ship.setTarget(input.update(realDt, ship.x));
    const hit = obstacles.update(dt, state.speed, spawnInterval, state.level, ship.x, true, nearEvents);

    if (hit) {
      crash();
    } else {
      for (const ev of nearEvents) onNearMiss(ev);
      state.score += state.speed * dt * CONFIG.distanceScore;
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) { state.combo = 1; hud.setCombo(1); }
      }
      onScoreProgress();
      hud.setScore(state.score);
    }
  } else if (state.mode === 'dying') {
    state.speed = Math.max(6, state.speed * Math.exp(-dt * 1.2));
    obstacles.update(dt, state.speed, 1, state.level, 999, false, nearEvents);
    state.deathTimer -= realDt;
    if (state.deathTimer <= 0) gameOver();
  } else {
    // menu / game over: calm attract mode
    state.menuTime += realDt;
    state.speed += ((state.mode === 'menu' ? 16 : 8) - state.speed) * (1 - Math.exp(-realDt * 1.5));
    obstacles.update(dt, state.speed, 1, 1, 999, false, nearEvents);
    if (state.mode === 'menu') ship.setTarget(Math.sin(state.menuTime * 0.7) * 1.8);
  }

  // Restore music brightness after a near-miss slow-mo.
  if (state.slowMuffled && ts > 0.9 && state.mode === 'playing') {
    state.slowMuffled = false;
    audio.muffleMusic(18000, 0.15);
  }

  const speedNorm = THREE.MathUtils.clamp((state.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
  ship.update(dt, realDt, speedNorm);

  // Engine trail
  if (ship.group.visible) {
    ship.group.updateMatrixWorld();
    const rate = (quality === 'high' ? 110 : 65) * (1 + speedNorm * 0.5);
    state.emitAcc += dt * rate;
    while (state.emitAcc >= 1) {
      state.emitAcc -= 1;
      for (let i = 0; i < 2; i++) {
        ship.nozzleWorld(i, tmpV);
        const pink = Math.random() < 0.15;
        particles.emit(
          tmpV.x + (Math.random() - 0.5) * 0.1, tmpV.y + (Math.random() - 0.5) * 0.1, tmpV.z,
          (Math.random() - 0.5) * 0.8 - ship.vx * 0.15, (Math.random() - 0.5) * 0.6, 3 + Math.random() * 3,
          0.3 + Math.random() * 0.18, 0.7 + speedNorm * 0.4,
          pink ? 1 : 0.45, pink ? 0.4 : 0.9, 1, 0.6, 1,
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

  if (state.mode === 'playing') audio.setEngine(speedNorm, input.steer, ts);

  renderer.render(scene, camera);

  if (DEBUG) {
    const info = renderer.info.render;
    debugEl.textContent =
      `fps ${perf.fps.toFixed(0)}  q:${quality}\n` +
      `calls ${info.calls}  tris ${info.triangles}\n` +
      `particles ${particles.alive}  speed ${state.speed.toFixed(1)}\n` +
      `ts ${ts.toFixed(2)}  lvl ${state.level}`;
  }
}
requestAnimationFrame(frame);

// Expose a tiny hook for automated tests / debugging.
if (DEBUG) window.__game = { state, ship, obstacles, fx, input };

// ---------------------------------------------------------------- PWA
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.has('nosw')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}
