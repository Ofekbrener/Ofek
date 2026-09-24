import * as THREE from 'three';
import { CONFIG, initialQuality } from './config.js';
import { createRenderer, setQualityPixelRatio } from './renderer.js';
import { Lighting } from './lighting.js';
import { Environment } from './environment.js';
import { Ship } from './ship.js';
import { Obstacles } from './obstacles.js';
import { Chickens } from './chickens.js';
import { Boss } from './boss.js';
import { Pickups, CRYSTAL, ORB, GIFT, CORN } from './pickups.js';
import { Particles, PALETTES } from './particles.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { haptics } from './haptics.js';
import { store } from './storage.js';
import { Progression, POWERUPS, UPGRADES, COSMETICS, drawCards, rankInfo, upgradeLevels } from './progression.js';
import { HangarUI, showCards } from './hangar-ui.js';
import { ShipPreview } from './ship-preview.js';
import { installIcons } from './icons.js';
import { cocoSVG, COCO } from './coco.js';
import { SlingSession } from './sling/sling.js';
import { WORLDS, levelId } from './sling/levels.js';
import { GALAXIES, QUIPS, pick } from './galaxies.js';
import { Journey } from './journey.js';
import { StarMapUI, starsHTML } from './starmap-ui.js';
import { RaceSession } from './race/race.js';
import { TRACK_HALF } from './race/track.js';
import { RaceMenuUI, showResults, fmtTime } from './race/race-ui.js';
import { LEAGUES, RACE_QUIPS, RACE_UPGRADES, CAREER, careerIndex, ordinal } from './race/leagues.js';
import { nextStep, Handoff, raceLabel, cheapestAffordableRaceUpgrade, cheapestRaceUpgrade, farmGalaxy, tutorialStage, TUTORIAL_STEPS, TUTORIAL_ALLOW, TUTORIAL_HINT } from './ftue.js';

const $ = (id) => document.getElementById(id);
installIcons();   // hand-drawn SVG icons instead of emoji
// Coco (the chicken hero) portraits wherever the markup asks for one.
document.querySelectorAll('[data-coco]').forEach((el) => { el.innerHTML = cocoSVG(el.dataset.coco); });
$('welcome-say').innerHTML = COCO.welcome;
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
scene.background = new THREE.Color(0x05060f);   // own copy: themes tween it

const lighting = new Lighting(scene);
const env = new Environment(scene, quality === 'high' ? CONFIG.starsHigh : CONFIG.starsLow);
const particles = new Particles(scene, quality === 'high' ? CONFIG.particlesHigh : CONFIG.particlesLow);
const sling = new SlingSession(quality);   // Coco Catapult mini-game (own scene)
const SLING_MAX_STARS = WORLDS.reduce((a, w) => a + w.levels.length * 3, 0);
const ship = new Ship(scene);
const obstacles = new Obstacles(scene, CONFIG.maxObstacles, particles);
const pickups = new Pickups(scene, CONFIG.maxPickups);
obstacles.pickups = pickups;
const chickens = new Chickens(scene, particles);
chickens.setTint(0xffffff);
const boss = new Boss(scene, particles, chickens, obstacles, pickups);
const journey = new Journey({ obstacles, chickens, pickups, boss });
const fx = new FX($('flash'));
const hud = new HUD();
const audio = new AudioEngine();
const input = new Input(canvas, $('btn-left'), $('btn-right'));
const prog = new Progression();
ship.setSkin(prog.skin);
ship.setUpgrades(upgradeLevels(prog));
const race = new RaceSession(quality);

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
  race.setAspect(window.innerWidth / window.innerHeight);
  const h = renderer.domElement.height;
  particles.setViewportHeight(h * 1.2);
  env.setViewportHeight(h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
onResize();

// ---------------------------------------------------------------- state
// modes: menu | playing | choosing | resuming | paused | dying | gameover
//        | victory (post-boss celebration) | victoryScreen | warp
const state = {
  mode: 'menu',
  score: 0,
  time: 0,
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
  perfectCd: 0,
  crystals: 0,
  crystalAcc: 0,
  galaxyCrystals: 0,
  bankedCrystals: 0,
  bankedScore: 0,
  streak: 0,
  streakTimer: 0,
  shields: 0,
  picked: {},
  mods: prog.modifiers({}),
  worldScale: 1,
  resumeT: 0,
  countStep: 0,
  returnTo: 'start',
  effect: null,          // {type, t}
  victoryT: 0,
  warpT: 0,
  splatCd: 0,
};
const nearEvents = [];
const pickEvents = [];
const tmpV = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
let cardPick = null;
let lastFov = 0;

const screens = {
  start: $('screen-start'),
  pause: $('screen-pause'),
  over: $('screen-over'),
  hangar: $('screen-hangar'),
  cards: $('screen-cards'),
  map: $('screen-map'),
  victory: $('screen-victory'),
  race: $('screen-race'),
  raceResults: $('screen-race-results'),
  welcome: $('screen-welcome'),
  sling: $('screen-sling'),
  slingResult: $('screen-sling-result'),
  settings: $('screen-settings'),
};
// Home screen turntable: your pod with every upgrade you own.
const homePreview = new ShipPreview($('home-preview'), { drag: true, spin: 0.45, pitch: 0.22 });
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  if (name === 'start') {
    homePreview.setSkin(prog.skin);
    homePreview.setUpgrades(upgradeLevels(prog));
    homePreview.start();
  } else homePreview.stop();
}

function updateMenuMeta() {
  $('start-best').textContent = state.best > 0 ? `BEST  ${state.best.toLocaleString()}` : '';
  const r = rankInfo(prog.data.xp);
  $('start-rank').textContent = `${r.title} · Rank ${r.rank + 1}`;
  $('start-crystals').textContent = prog.crystals.toLocaleString();
  $('start-xp-fill').style.width = `${(r.into / r.need) * 100}%`;
  $('start-trophies').textContent = prog.trophies;
  $('start-power').textContent = prog.shipPower;
  renderModeCards();
  renderNextStep();
}

// Home: progress summary on the Dodge and Race cards.
function renderModeCards() {
  const n = GALAXIES.length;
  const open = prog.galaxyOpen(0);
  let gi = Math.min(n - 1, prog.unlocked - 1);
  while (gi > 0 && !prog.galaxyOpen(gi)) gi--;
  $('btn-start').classList.toggle('locked', !open);
  $('mc-dodge-name').textContent = open ? GALAXIES[gi].name : '🔒 Locked';
  $('mc-dodge-meta').textContent = open ? `Galaxy ${gi + 1}/${n} · ★ ${prog.totalStars}` : 'Needs 🏆 1 from a race';
  $('mc-dodge-fill').style.width = `${(Math.min(n, prog.unlocked - 1) / n) * 100}%`;
  // Home backdrop takes on the colours of the galaxy you're currently in.
  const here = GALAXIES[gi].home;
  const hs = $('screen-start').style;
  here.sky.forEach((c, i) => hs.setProperty(`--hs-${i + 1}`, c));
  here.planet.forEach((c, i) => hs.setProperty(`--hp-${i + 1}`, c));
  $('home-where').textContent = `📍 ${GALAXIES[gi].name}`;
  const slStars = slingStarsTotal();
  $('mc-sling-fill').style.width = `${(slStars / SLING_MAX_STARS) * 100}%`;
  $('mc-sling-meta').textContent = `★ ${slStars}/${SLING_MAX_STARS}`;
  const next = prog.nextCareerRace;
  const done = CAREER.filter((c) => { const b = prog.bestPlace(c.track.id); return b && b <= 3; }).length;
  $('mc-race-name').textContent = next ? next.track.name : 'Career complete! 👑';
  $('mc-race-meta').textContent = `${next ? `Race ${careerIndex(next.track.id) + 1}/${CAREER.length}` : `${CAREER.length}/${CAREER.length}`} · 🏆 ${prog.trophies}`;
  $('mc-race-fill').style.width = `${(done / CAREER.length) * 100}%`;
}

// Tutorial: tapping a locked Home button nudges the player back to the current step.
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.tut-locked');
  if (!el) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  audio.denied();
  haptics.tap();
  const card = $('next-step');
  card.classList.remove('nudge');
  void card.offsetWidth;
  card.classList.add('nudge');
  const stage = tutorialStage(prog);
  if (stage) $('ns-text').textContent = `🔒 ${TUTORIAL_HINT[stage]}`;
}, true);

// 🏠 from anywhere: stop what's running and show the Home hub.
function goHome() {
  audio.click();
  handoff.hide();
  $('rh-pausebox').classList.add('hidden');
  if (state.mode !== 'menu') leaveRun();
  updateMenuMeta();
  showScreen('start');
}

// ---------------------------------------------------------------- FTUE
// Next-step card on the start screen: the single next action of the core loop.
let currentStep = null;
function renderNextStep() {
  currentStep = nextStep(prog);
  // Tutorial: only the current step's button is live; the rest are locked.
  const stage = tutorialStage(prog);
  const allow = stage ? TUTORIAL_ALLOW[stage] : null;
  for (const [id, key] of [['btn-start', 'dodge'], ['btn-race', 'race'], ['btn-hangar', 'garage'], ['btn-sling', 'sling']]) {
    $(id).classList.toggle('tut-locked', !!stage && key !== allow);
    $(id).classList.toggle('tut-glow', !!stage && key === allow);
  }
  $('next-step').classList.toggle('tutorial', !!stage);
  document.querySelector('#next-step .ns-label').textContent = stage
    ? `TUTORIAL · STEP ${TUTORIAL_STEPS.indexOf(stage) + 1} OF ${TUTORIAL_STEPS.length}` : 'NEXT STEP';
  $('ns-icon').textContent = currentStep.icon;
  $('ns-title').textContent = currentStep.title;
  $('ns-text').textContent = currentStep.text;
  $('btn-next-step').textContent = currentStep.label;
}

// Start a race from any menu/result screen (stops a finished dodge run first).
function goRace(league, track) {
  audio.click();
  if (state.mode !== 'menu' && state.mode !== 'raceResults') leaveRun();
  startRace(league, track);
}

// Open the star map with a galaxy's briefing (or Endless) ready to launch.
function goGalaxy(i) {
  openMap();
  if (i === 'endless' || i >= 0) starMap.openBriefing(i);
}

function runStep(step = nextStep(prog)) {
  audio.unlock();
  const a = step.action;
  if (a.type === 'race') goRace(a.league, a.track);
  else if (a.type === 'garage') openHangar('start', a.upgrade);
  else if (a.type === 'galaxy') goGalaxy(a.index);
  else if (a.type === 'endless') goGalaxy('endless');
  else openRaceMenu();
}

const needsWelcome = () => prog.racesRun === 0 && !prog.ftueSeen('welcome');
updateMenuMeta();

const hangarUI = new HangarUI(prog, {
  audio,
  haptics,
  onChange: () => { ship.setSkin(prog.skin); ship.setUpgrades(upgradeLevels(prog)); updateMenuMeta(); },
  onBuy: (id) => onUpgradeBought(id),
});
const handoff = new Handoff(audio);

// Hand-off (c): first Race Garage purchase → point at the next race.
function onUpgradeBought(id) {
  if (hangarUI.lockTo) { hangarUI.lockTo = null; $('btn-hangar-back').classList.remove('hidden'); $('hangar-tut').classList.add('hidden'); hangarUI.render(id); }
  if (!RACE_UPGRADES.some((u) => u.id === id) || prog.ftueSeen('upgrade')) return;
  const r = prog.nextCareerRace;
  if (!r) return;
  prog.ftueMark('upgrade');
  const n = careerIndex(r.track.id) + 1;
  handoff.show({
    forced: !!tutorialStage(prog),
    icon: '⚡',
    title: `RACE ${n} IS READY!`,
    text: `Your ship is stronger — <b>${raceLabel(r.track.id)}</b> is ready!<br>⚡ Ship Power ${prog.shipPower} · Recommended ${r.track.power}`,
    celebrate: true,
    buttons: [
      { label: '🏁 RACE', primary: true, onClick: () => goRace(r.league, r.track) },
      { label: 'KEEP SHOPPING' },
    ],
  });
}

// Hand-off (b): first Dodge run that paid drumsticks → send the player to the Garage.
function afterDodgeRun(earned, screen) {
  const wasTutorial = tutorialStage(prog) === 'dodge';
  prog.ftueMark('dodged');
  let bonus = 0;
  if (wasTutorial) {
    // Tutorial: make sure the first Race Garage upgrade is affordable.
    const want = cheapestRaceUpgrade(prog);
    if (want && prog.crystals < want.cost) { bonus = want.cost - prog.crystals; prog.data.crystals += bonus; prog.save(); updateMenuMeta(); }
  } else if (earned <= 0 || prog.ftueSeen('garage')) return;
  prog.ftueMark('garage');
  const buy = cheapestAffordableRaceUpgrade(prog);
  const want = buy || cheapestRaceUpgrade(prog);
  const tip = !want ? ''
    : buy ? `<br>Try <b>${want.u.icon} ${want.u.name}</b> (🍗 ${want.cost}) for +1 ⚡ Ship Power.`
    : `<br>Save up 🍗 ${want.cost} for <b>${want.u.icon} ${want.u.name}</b> (you have 🍗 ${prog.crystals}).`;
  handoff.showLater(1400, {
    forced: !!tutorialStage(prog),
    icon: '🍗',
    title: `YOU EARNED 🍗 ${earned + bonus}`,
    text: `${bonus ? `Includes a 🎁 tutorial bonus of 🍗 ${bonus}. ` : ''}Spend it in the Garage to make your ship faster.${tip}`,
    celebrate: true,
    buttons: [
      { label: '🛠 GO TO GARAGE', primary: true, onClick: () => openHangar(screen, buy ? buy.u.id : null) },
      { label: 'LATER' },
    ],
  }, () => !screens[screen].classList.contains('hidden'));
}
const starMap = new StarMapUI(prog, {
  audio,
  onLaunch: (i) => startRun(i),
  onEndless: () => startRun('endless'),
});

// Menu backdrop shows the next galaxy to conquer.
env.setTheme(GALAXIES[starMap.suggested], true);
lighting.setTheme(GALAXIES[starMap.suggested]);

// ---------------------------------------------------------------- toggles
const soundBtn = $('btn-sound');
const hapticsBtn = $('btn-haptics');
function refreshToggles() {
  soundBtn.classList.toggle('off', audio.muted);
  soundBtn.textContent = audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
  hapticsBtn.classList.toggle('off', haptics.level === 0);
  hapticsBtn.textContent = `📳 Vibration: ${haptics.label}`;
}
if (!haptics.supported) hapticsBtn.classList.add('hidden');
soundBtn.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  audio.click();
  refreshToggles();
});
hapticsBtn.addEventListener('click', () => {
  haptics.cycle();
  audio.click();
  refreshToggles();
});
refreshToggles();

// UI style themes (themes.css). Cycles in Settings, saved on this device.
const THEMES = [['midnight', 'Midnight Coop'], ['arcade', 'Sunny Arcade'], ['comic', 'Comic Book'], ['retro', 'Retro Space Age'], ['void', 'Void']];
function refreshStyleBtn() {
  const cur = document.documentElement.dataset.theme;
  const t = THEMES.find((x) => x[0] === cur) || THEMES[0];
  $('btn-style').textContent = `🎨 Style: ${t[1]}`;
}
$('btn-style').addEventListener('click', () => {
  audio.click();
  const i = THEMES.findIndex((x) => x[0] === document.documentElement.dataset.theme);
  const next = THEMES[(i + 1) % THEMES.length][0];
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  refreshStyleBtn();
});
refreshStyleBtn();

// Settings screen, including "start again as a new player".
$('btn-settings').addEventListener('click', () => {
  audio.unlock();
  audio.click();
  $('reset-confirm').classList.add('hidden');
  $('btn-reset').classList.remove('hidden');
  showScreen('settings');
});
$('btn-settings-back').addEventListener('click', goHome);
$('btn-reset').addEventListener('click', () => {
  audio.click();
  $('btn-reset').classList.add('hidden');
  $('reset-confirm').classList.remove('hidden');
});
$('btn-reset-no').addEventListener('click', () => {
  audio.click();
  $('reset-confirm').classList.add('hidden');
  $('btn-reset').classList.remove('hidden');
});
$('btn-reset-yes').addEventListener('click', () => {
  haptics.tap();
  // Wipe progress (keep sound / vibration preferences) and boot fresh into the Welcome screen.
  store.remove('save');
  store.remove('best');
  location.reload();
});

// ---------------------------------------------------------------- modifiers
function applyMods() {
  const m = (state.mods = prog.modifiers(state.picked));
  ship.handling = m.handling;
  input.handling = m.handling;
  obstacles.orbChance = m.orbChance;
  obstacles.giftChance = m.giftChance;
}

function setShields(n) {
  state.shields = Math.max(0, Math.min(5, n));
  ship.setShielded(state.shields > 0);
  hud.setShields(state.shields);
}

function magnetRadius() {
  let r = state.mods.magnet;
  if (state.effect && state.effect.type === 'magnet') r += 3;
  if (state.mode === 'victory') r += 9;
  return r;
}

// ---------------------------------------------------------------- flow
function stopWorld() {
  obstacles.reset();
  chickens.reset();
  pickups.reset();
  boss.stop();
  hud.showBoss(null);
}

function startRun(which) {
  audio.unlock();
  audio.click();
  haptics.tap();

  Object.assign(state, {
    mode: 'playing', score: 0, time: 0, nearMisses: 0, combo: 1, comboTimer: 0,
    nextMilestone: CONFIG.milestone, nextTick: 100, deathTimer: 0, emitAcc: 0, slowMuffled: false,
    perfectCd: 0, crystals: 0, crystalAcc: 0, galaxyCrystals: 0, bankedCrystals: 0, bankedScore: 0,
    streak: 0, streakTimer: 0, picked: {}, worldScale: 1, resumeT: 0, effect: null,
  });
  applyMods();
  stopWorld();
  ship.reset();
  ship.setSkin(prog.skin);
  ship.setUpgrades(upgradeLevels(prog));
  fx.reset();
  input.reset();
  input.enabled = true;
  hud.reset();
  hud.setPowers({}, POWERUPS);
  hud.show(true);
  // Galaxy 1 hands new pilots two free shields.
  setShields(state.mods.startShields + (which === 0 ? 2 : 0));
  showScreen(null);
  starMap.closeBriefing();

  if (which === 'endless') journey.startEndless();
  else journey.startCampaign(which);
  enterGalaxy(true);

  audio.startMusic();
  audio.muffleMusic(18000, 0.1);
  audio.startEngine();
  perf.reset();
}

// Visuals, music and HUD for the journey's current galaxy.
function enterGalaxy(fromMenu = false) {
  const g = journey.galaxy;
  if (fromMenu) env.hidePlanet();
  env.setTheme(g);
  lighting.setTheme(g);
  chickens.setTint(g.id === 'frost' ? 0xdff4ff : 0xffffff);
  audio.setGalaxy(g.music);
  audio.setLevel(1);
  audio.setBoss(false);
  state.galaxyCrystals = 0;
  hud.setGalaxy(g.name);
  hud.setLevel(journey.endless ? `ENDLESS W${journey.wave + 1}` : 'GET READY');
  hud.setProgress(0, 0, journey.waveCount);
  const num = journey.endless ? `∞ ENDLESS · LOOP ${journey.loop + 1}` : `GALAXY ${journey.gIndex + 1} OF ${GALAXIES.length}`;
  hud.galaxyCard(num, g.name, g.tagline);
  setTimeout(() => audio.cluck(1, 0.12), 900);
}

function toMenu() {
  audio.click();
  audio.stopMusic();
  audio.stopEngine();
  input.enabled = false;
  hud.show(false);
  stopWorld();
  ship.reset();
  ship.setShielded(false);
  state.mode = 'menu';
  updateMenuMeta();
  showScreen('start');
}

function openMap() {
  audio.unlock();
  audio.click();
  if (state.mode !== 'menu') leaveRun();
  starMap.render();
  env.setTheme(GALAXIES[starMap.suggested]);
  lighting.setTheme(GALAXIES[starMap.suggested]);
  showScreen('map');
}

// `highlight`: race upgrade id to point at (FTUE glow); also focuses the Race Garage.
function openHangar(from, highlight = null) {
  audio.unlock();
  audio.click();
  state.returnTo = from;
  const tut = tutorialStage(prog) === 'garage';
  if (tut && !highlight) { const w = cheapestAffordableRaceUpgrade(prog) || cheapestRaceUpgrade(prog); highlight = w ? w.u.id : null; }
  hangarUI.highlightId = highlight;
  hangarUI.lockTo = tut ? highlight : null;   // tutorial: only the highlighted upgrade can be bought
  $('btn-hangar-back').classList.toggle('hidden', tut);
  $('hangar-tut').classList.toggle('hidden', !tut);
  hangarUI.render();
  showScreen('hangar');
  hangarUI.preview.start();
  hangarUI.setTab(from === 'race' || highlight ? 'race' : 'dodge');
}

function closeHangar() {
  audio.click();
  hangarUI.preview.stop();
  updateMenuMeta();
  if (state.returnTo === 'map') starMap.render();
  if (state.returnTo === 'race') raceMenu.render();
  showScreen(state.returnTo);
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

// ---- waves ----
function onWaveStart() {
  const lw = journey.localWave;
  hud.setLevel(journey.endless ? `ENDLESS W${journey.wave + 1}` : `WAVE ${lw + 1}/${journey.waveCount}`);
  hud.showBanner(`WAVE ${lw + 1}`, 1100);
  audio.setLevel(lw + 1);
  // Tutorial coach on the very first Dodge run.
  if (tutorialStage(prog) === 'dodge' && !journey.endless) {
    const tips = [
      ['Drag anywhere (or hold ◀ ▶) and I\'ll swerve us around hens, eggs & rocks!', 'Grab 🍗 drumsticks! I trade them for upgrades in the Garage.'],
      ['Blue orbs are 🛡 shields. Each one saves our feathers once!', 'Skim close past hazards for bonus points. I like it spicy 🔥'],
      ['Boss next! I\'ll do the shooting, you dodge her eggs!'],
    ][Math.min(2, lw)];
    tips.forEach((t, i) => setTimeout(() => { if (state.mode === 'playing') coach(t, 3600); }, 1300 + i * 4200));
  }
}

// Coach bubble above the steer buttons (tutorial tips).
let coachTimer = 0;
function coach(text, ms = 3500) {
  const el = $('coach');
  el.innerHTML = `${cocoSVG('happy', 'coco coco-mini')}<span></span>`;
  el.lastChild.textContent = text;
  el.classList.remove('hidden');
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(coachTimer);
  coachTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function onWaveClear() {
  const lw = journey.localWave;
  audio.waveClear();
  haptics.waveClear();
  env.pulse(1);
  hud.popup(pick(QUIPS.waveClear), 0.5, 'cyan');
  const cards = drawCards(state.picked);
  if (!cards.length) { advanceWave(); return; }
  const title = lw + 1 >= journey.waveCount ? 'BOSS INCOMING! GEAR UP' : `WAVE ${lw + 1} CLEAR!`;
  setTimeout(() => openCards(title, cards), 500);
}

function openCards(title, cards) {
  if (state.mode !== 'playing') return;
  state.mode = 'choosing';
  input.enabled = false;
  input.release();
  audio.muffleMusic(1400, 0.15);
  showScreen('cards');
  cardPick = showCards(title, cards, pickPower);
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
  obstacles.clearAhead(-40);
  chickens.clearAhead(-40);
  state.mode = 'resuming';
  state.resumeT = 0.9;
  state.countStep = 0;
  input.enabled = true;
  audio.muffleMusic(18000, 0.3);
}

// After cards/countdown: go to the next wave, boss or (endless) next galaxy.
function advanceWave() {
  const next = journey.nextWave();
  if (next === 'warp') startWarp();
  else if (next === 'bossIntro') onBossIntro();
  else if (next === 'wave') onWaveStart();
}

// ---- boss ----
function onBossIntro() {
  const b = journey.galaxy.boss;
  hud.setLevel('BOSS');
  hud.setProgress(journey.waveCount, 0, journey.waveCount);
  hud.showBanner('⚠ WARNING ⚠', 1400);
  setTimeout(() => {
    if (!boss.active) return;
    hud.galaxyCard(b.title.toUpperCase(), b.name, journey.galaxy.bossQuip);
  }, 1300);
  hud.showBoss(b.name);
  if (!prog.ftueSeen('bossTip')) {
    prog.ftueMark('bossTip');
    setTimeout(() => { if (boss.active) coach('I\'m firing at her automatically! You just DODGE the eggs she lays!', 5000); }, 2600);
  }
  audio.setBoss(true);
  audio.bossRoar();
  haptics.bossIntro();
  fx.shake(0.4);
  fx.flash('rgba(255, 60, 90, 0.5)', 0.35, 500);
}

// Auto-fire lands many small hits: keep each one light, celebrate every quarter and the K.O.
let bossQuarter = 4;
boss.onHit = (frac) => {
  hud.setBossHp(frac);
  const q = Math.ceil(frac * 4);
  if (frac <= 0 || q < bossQuarter) {
    bossQuarter = q;
    audio.missileHit();
    haptics.bossHit();
    fx.shake(0.35);
    fx.flash('rgba(255, 255, 255, 0.5)', 0.3, 200);
    fx.slowMo(0.2, 0.06);
    hud.popup(frac > 0 ? `${q * 25}% LEFT!` : 'K.O.!', 0.5, '');
  } else {
    audio.softHit();
    fx.shake(0.06);
  }
};

boss.onAttack = (kind) => {
  if (kind === 'fire') { audio.pew(); return; }
  if (kind === 'fan' || kind === 'lay' || kind === 'rain') audio.cluck(0.8, 0.22);
  else if (kind === 'summon') { audio.cluck(1.2, 0.2); setTimeout(() => audio.cluck(1.4, 0.15), 160); }
  else if (kind === 'throw') audio.cluck(0.6, 0.25);
  else if (kind === 'laser') audio.countdown(false);
  else if (kind === 'beam') audio.missileLaunch();
};

boss.onDefeated = () => {
  state.mode = 'victory';
  state.victoryT = 3.4;
  hud.showBoss(null);
  obstacles.clearAhead(-300);
  chickens.clearAhead(-300);
  audio.setBoss(false);
  audio.victory();
  haptics.bossDefeated();
  fx.shake(1);
  fx.slowMo(0.3, 0.8);
  fx.flash('rgba(255, 240, 200, 0.9)', 0.9, 700);
  lighting.flashAt(boss.x, boss.y, boss.z + 4, 300, 0xfff0c0);
  hud.showBanner(pick(QUIPS.victory), 2200);
  // Drumstick shower!
  for (let i = 0; i < 26; i++) {
    pickups.spawnAt((Math.random() * 2 - 1) * CONFIG.halfWidth, -12 - Math.random() * 30);
  }
  state.score += 500 * state.mods.scoreMult;
};

// Bank drumsticks + XP earned since the last bank (galaxy victory or death).
function bank() {
  const final = Math.floor(state.score);
  const scoreDelta = final - state.bankedScore;
  const bonus = Math.floor(scoreDelta / CONFIG.payoutScoreDivisor);
  const collected = state.crystals - state.bankedCrystals;
  const res = prog.bankRun(collected + bonus, scoreDelta);
  state.bankedScore = final;
  state.bankedCrystals = state.crystals;
  return { ...res, collected, bonus, earned: collected + bonus, xp: scoreDelta };
}

function showVictoryScreen() {
  state.mode = 'victoryScreen';
  input.enabled = false;
  hud.show(false);
  const gi = journey.gIndex;
  const stars = journey.stars(state.galaxyCrystals);
  const newUnlock = prog.completeGalaxy(gi, stars);
  const b = bank();
  const last = gi >= GALAXIES.length - 1;
  $('victory-title').textContent = last ? 'THE HENS ARE DEFEATED!' : pick(QUIPS.victory);
  $('victory-galaxy').textContent = journey.galaxy.name.toUpperCase();
  $('victory-stars').innerHTML = starsHTML(stars, 3, true);
  $('victory-quip').textContent = last ? '...for now. Rumours speak of an Infinite Coop.' : journey.galaxy.bossQuip;
  $('victory-score').textContent = Math.floor(state.score).toLocaleString();
  $('victory-banked').textContent = `+${b.earned}`;
  const note = $('victory-unlock');
  note.classList.toggle('hidden', !newUnlock);
  note.textContent = last ? '∞ ENDLESS MODE UNLOCKED!' : `🔓 ${GALAXIES[gi + 1].name} unlocked!`;
  $('btn-next-galaxy').classList.toggle('hidden', last);
  const nextOpen = !last && prog.galaxyOpen(gi + 1);
  state.nextAction = nextOpen ? 'warp' : 'race';
  $('btn-next-galaxy').textContent = nextOpen ? 'NEXT GALAXY ➜' : `🏁 WIN ${prog.galaxyTrophyReq(gi + 1)} RACE TROPHIES TO CONTINUE`;
  if (!last && !nextOpen) {
    note.classList.remove('hidden');
    note.textContent = `🏆 ${GALAXIES[gi + 1].name} needs ${prog.galaxyTrophyReq(gi + 1)} race trophies (you have ${prog.trophies})`;
  }
  showScreen('victory');
  afterDodgeRun(b.earned, 'victory');
  for (let i = 0; i < stars; i++) setTimeout(() => audio.starDing(i), 250 + i * 350);
  audio.muffleMusic(2500, 0.4);
}

// ---- hyperspace ----
const WARP_DUR = 2.8;
function startWarp() {
  state.mode = 'warp';
  state.warpT = 0;
  state.warped = false;
  hud.show(true);
  showScreen(null);
  input.enabled = true;
  audio.warp(WARP_DUR);
  audio.muffleMusic(18000, 0.3);
  hud.showBanner('HYPERSPACE', 1200);
  obstacles.clearAhead(-300);
  chickens.clearAhead(-300);
  pickups.reset();
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
  if (state.effect) endEffect();
}

// Knock a hazard out of the way (shield absorb or Feather Dash).
function smash(hit) {
  if (hit.kind === 'chicken') {
    chickens.poof(hit.obj);
    audio.cluck(1.5, 0.2);
    pickups.spawnAt(hit.obj.x, -4);
    pickups.spawnAt(hit.obj.x + (Math.random() - 0.5), -6);
  } else if (hit.kind === 'puddle') {
    chickens.splat(hit.obj);
    audio.splat();
  } else if (hit.kind === 'rock') {
    const o = hit.obj;
    obstacles.destroy(o);
    particles.burst(o.x, 0, o.z, quality === 'high' ? 60 : 30, 11, 0.8, 0.5, [[0.8, 0.8, 0.85], [0.55, 0.5, 0.6]], 2, 0.4);
  }
}

function absorbHit(hit) {
  smash(hit);
  setShields(state.shields - 1);
  journey.stats.hits++;
  ship.invuln = CONFIG.shieldGrace;
  particles.burst(ship.x, 0, 0, quality === 'high' ? 60 : 30, 9, 0.6, 0.4, [[0.45, 0.7, 1], [0.8, 0.9, 1]], 2.5, 0.3);
  lighting.flashAt(ship.x, 0.6, 0.5, 70, 0x6fb8ff);
  fx.shake(0.5);
  fx.flash('rgba(111, 184, 255, 0.6)', 0.4, 350);
  audio.shieldBreak();
  haptics.shieldBreak();
  hud.popup(pick(QUIPS.shield), shipScreenX(), 'cyan');
}

function resolveHit(hit) {
  if (!hit || state.mode !== 'playing') return false;
  if (state.effect && state.effect.type === 'dash') {
    if (hit.kind !== 'laser') { smash(hit); fx.shake(0.2); audio.missileHit(); }
    return false;
  }
  if (ship.invuln > 0) return false;
  if (state.shields > 0) { absorbHit(hit); return false; }
  crash();
  return true;
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
  boss.stop();
  const final = Math.floor(state.score);
  const isBest = final > state.best;
  if (isBest) {
    state.best = final;
    store.set('best', final);
  }
  if (journey.endless) prog.recordEndless(journey.wave + 1, final);
  $('over-title').textContent = pick(QUIPS.gameOver);
  $('final-score').textContent = final.toLocaleString();
  $('over-best').textContent = state.best.toLocaleString();
  $('over-level').textContent = journey.endless
    ? `∞ Wave ${journey.wave + 1}`
    : `G${journey.gIndex + 1} · ${journey.isBossWave ? 'Boss' : `W${journey.localWave + 1}`}`;
  $('over-near').textContent = state.nearMisses;
  $('over-time').textContent = `${Math.floor(state.time)}s`;
  $('new-best').classList.toggle('hidden', !isBest);
  // Checkpoint: campaign retries resume at the wave (or boss) you crashed on.
  state.checkpoint = journey.endless ? null : { g: journey.gIndex, wave: journey.localWave };
  $('btn-restart').textContent = journey.endless ? 'RETRY ENDLESS'
    : journey.isBossWave ? '↻ RETRY BOSS'
    : journey.localWave > 0 ? `↻ RETRY WAVE ${journey.localWave + 1}` : '↻ RETRY GALAXY';

  const b = bank();
  $('pay-collected').textContent = '0';
  $('pay-bonus').textContent = '0';
  $('pay-total').textContent = '0';
  $('over-rank').textContent = b.before.title;
  $('over-xp').textContent = `+${b.xp.toLocaleString()} XP`;
  const fill = $('over-xp-fill');
  fill.style.transition = 'none';
  fill.style.width = `${(b.before.into / b.before.need) * 100}%`;
  showScreen('over');
  afterDodgeRun(b.earned, 'over');

  setTimeout(() => {
    countUp($('pay-collected'), b.collected, 500);
    countUp($('pay-bonus'), b.bonus, 500);
    countUp($('pay-total'), b.earned, 900);
    fill.style.transition = '';
    if (b.after.rank > b.before.rank) {
      fill.style.width = '100%';
      setTimeout(() => {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        void fill.offsetWidth;
        fill.style.transition = '';
        fill.style.width = `${(b.after.into / b.after.need) * 100}%`;
        $('over-rank').textContent = `RANK UP! ${b.after.title}`;
        audio.chime();
        haptics.milestone();
      }, 750);
    } else {
      fill.style.width = `${(b.after.into / b.after.need) * 100}%`;
      if (isBest) { audio.chime(); haptics.milestone(); }
    }
  }, 350);
}

function retry() {
  const cp = state.checkpoint;
  startRun(journey.endless ? 'endless' : journey.gIndex);
  if (cp && cp.wave > 0) {
    journey.wave = cp.wave;
    journey._startPhase();
    if (journey.isBossWave) onBossIntro(); else onWaveStart();
  }
}

$('btn-start').addEventListener('click', openMap);
$('btn-restart').addEventListener('click', retry);
$('btn-menu').addEventListener('click', openMap);
$('btn-quit').addEventListener('click', () => { audio.resume(); goHome(); });
$('btn-resume').addEventListener('click', resumeGame);
$('btn-pause').addEventListener('click', pauseGame);
$('btn-hangar').addEventListener('click', () => openHangar('start'));
$('btn-over-hangar').addEventListener('click', () => openHangar('over'));
$('btn-map-hangar').addEventListener('click', () => openHangar('map'));
$('btn-victory-hangar').addEventListener('click', () => openHangar('victory'));
$('btn-hangar-back').addEventListener('click', closeHangar);
$('btn-map-back').addEventListener('click', goHome);
$('btn-over-home').addEventListener('click', goHome);
$('btn-victory-home').addEventListener('click', goHome);
$('btn-victory-map').addEventListener('click', openMap);
$('btn-next-galaxy').addEventListener('click', () => {
  audio.click();
  if (state.nextAction === 'race') openRaceMenu();
  else startWarp();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  }
  if (state.mode === 'choosing' && cardPick && ['1', '2', '3'].includes(e.key)) cardPick(Number(e.key) - 1);
  if (e.key !== ' ' && e.key !== 'Enter') return;
  if (handoff.open) { e.preventDefault(); handoff.confirm(); return; }
  const visible = (n) => !screens[n].classList.contains('hidden');
  if (visible('welcome')) { e.preventDefault(); $('btn-welcome-go').click(); }
  else if (visible('start')) { e.preventDefault(); runStep(); }
  else if (visible('map')) { e.preventDefault(); if (starMap.briefingOpen) $('btn-brief-go').click(); else starMap.openBriefing(starMap.suggested); }
  else if (visible('over')) { e.preventDefault(); retry(); }
  else if (visible('victory') && !$('btn-next-galaxy').classList.contains('hidden')) { e.preventDefault(); $('btn-next-galaxy').click(); }
  else if (visible('raceResults')) { e.preventDefault(); $('btn-rr-retry').click(); }
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
  if (ev.hen) audio.cluck(1.3, 0.12);

  if (perfect) {
    hud.popup(`PERFECT +${bonus}`, shipScreenX(), '');
    hud.pop(1.4, '#ffd35c');
    particles.burst(sx, 0, 0.2, quality === 'high' ? 30 : 16, 8, 0.45, 0.32, PALETTES.spark, 3, 0.6);
    audio.nearMiss(ev.side, 1);
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

const GIFTS = {
  shield: { label: '🛡️ +1 SHIELD', dur: 0 },
  magnet: { label: '🧲 MEGA MAGNET', dur: 8 },
  double: { label: '🍗 DOUBLE DRUMSTICKS', dur: 8 },
  dash: { label: '🪶 FEATHER DASH', dur: 5 },
};

function applyGift() {
  const pool = ['magnet', 'double', 'dash'];
  if (state.shields < 5) pool.push('shield', 'shield');
  const type = pick(pool);
  const g = GIFTS[type];
  audio.giftOpen();
  haptics.gift();
  hud.popup(g.label, shipScreenX(), '');
  particles.burst(ship.x, 0.3, 0, 40, 7, 0.7, 0.4, [[1, 0.3, 0.3], [1, 0.85, 0.3], [1, 1, 1]], 2.5, 0.6);
  if (type === 'shield') { setShields(state.shields + 1); audio.shieldUp(); return; }
  if (state.effect) endEffect();
  state.effect = { type, t: g.dur };
  if (type === 'dash') { ship.setDash(true); fx.kickFov(6); }
}

function endEffect() {
  if (!state.effect) return;
  if (state.effect.type === 'dash') { ship.setDash(false); ship.invuln = 0.8; }
  state.effect = null;
  hud.setEffect(null);
}

function onPickup(ev) {
  if (ev.type === CRYSTAL) {
    const mult = state.mods.crystalMult * (state.effect && state.effect.type === 'double' ? 2 : 1);
    state.crystalAcc += mult;
    const n = Math.floor(state.crystalAcc);
    state.galaxyCrystals++;
    state.streak = state.streakTimer > 0 ? state.streak + 1 : 0;
    state.streakTimer = 1.2;
    state.score += CONFIG.crystalScoreBonus * state.mods.scoreMult;
    audio.pickup(state.streak);
    particles.burst(ev.x, 0.1, Math.min(ev.z, 0.3), quality === 'high' ? 12 : 6, 5, 0.4, 0.3, [[1, 0.8, 0.4], [0.85, 0.5, 0.2], [1, 1, 1]], 3, 0.8);
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
  } else if (ev.type === GIFT) {
    applyGift();
  } else if (ev.type === CORN) {
    boss.launchMissile(ship.x);
    audio.missileLaunch();
    hud.popup('🌽 CORN MISSILE!', shipScreenX(), '');
    particles.burst(ship.x, 0.2, 0, 20, 5, 0.4, 0.35, [[1, 0.85, 0.2], [1, 1, 0.6]], 3, 0.5);
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
    hud.pop(2.4, '#ffd35c');
    audio.chime();
    fx.flash('rgba(255, 211, 92, 0.4)', 0.25, 400);
    env.pulse(1);
    particles.burst(ship.x, 0.2, 0, quality === 'high' ? 70 : 35, 9, 0.9, 0.45, PALETTES.gold, 1.8, 0.5);
    ring.position.set(ship.x, -0.2, 0);
    ringT = 0;
    if (m % 1000 === 0) haptics.milestone();
  }
}

chickens.onEggLanded = () => {
  if (state.splatCd > 0) return;
  state.splatCd = 0.12;
  audio.splat();
};

// ---------------------------------------------------------------- race league
const raceHud = $('race-hud');
const rhCount = $('rh-count');
const rhMsg = $('rh-msg');
const rhMap = $('rh-map').getContext('2d');
const boostBtn = $('rbtn-boost');
const itemBtn = $('rbtn-item');
const ITEM_ICON = { missile: '🥚', shield: '🛡️', mine: '💣' };
let raceBoost = false;
let raceItem = false;
const raceFails = {};
let mapT = 0;
let msgTimer = null;
input._bindButton($('rbtn-left'), 'left');
input._bindButton($('rbtn-right'), 'right');
boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); raceBoost = true; boostBtn.classList.add('active'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boostBtn.addEventListener(ev, () => boostBtn.classList.remove('active'));
itemBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); raceItem = true; });
$('rbtn-go').addEventListener('click', () => { audio.click(); $('rh-intro').classList.add('hidden'); race.begin(); });
$('btn-race-pause').addEventListener('click', () => { if (state.mode !== 'race') return; race.paused = true; audio.click(); $('rh-pausebox').classList.remove('hidden'); });
$('rbtn-resume').addEventListener('click', () => { race.paused = false; audio.click(); $('rh-pausebox').classList.add('hidden'); });
$('rbtn-quit').addEventListener('click', () => { $('rh-pausebox').classList.add('hidden'); leaveRun(); raceMenu.render(); showScreen('race'); });

function setItemButton(item) {
  itemBtn.textContent = item ? ITEM_ICON[item] : '?';
  itemBtn.classList.toggle('ready', !!item);
}

const raceMenu = new RaceMenuUI(prog, { audio, onRace: (lg, t) => startRace(lg, t) });

function raceMsg(text, ms = 1200) {
  rhMsg.textContent = text;
  rhMsg.classList.remove('hidden');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => rhMsg.classList.add('hidden'), ms);
}

function openRaceMenu() {
  audio.unlock();
  audio.click();
  if (state.mode !== 'menu') leaveRun();
  raceMenu.render();
  showScreen('race');
}

// Stop whatever is running (dodge run or race) and return to menu state.
function leaveRun() {
  $('coach').classList.add('hidden');
  if (state.mode === 'sling' || sling.active) leaveSling();
  audio.stopMusic();
  audio.stopEngine();
  hud.show(false);
  raceHud.classList.add('hidden');
  if (race.running) race.dispose();
  stopWorld();
  ship.reset();
  ship.setShielded(false);
  input.enabled = false;
  input.raceMode = false;
  state.mode = 'menu';
}

function startRace(league, track) {
  audio.unlock();
  haptics.tap();
  stopWorld();
  hud.show(false);
  showScreen(null);
  state.mode = 'race';
  state.raceLeague = league;
  state.raceTrack = track;
  const g = GALAXIES[track.theme];
  const ci = careerIndex(track.id);
  // Beginner assist: after 2 failed attempts at race 1, rivals ease off a little.
  const assist = ci === 0 && (raceFails[track.id] || 0) >= 2;
  race.load(league, track, g, prog.raceStats, prog.skin, { careerIndex: ci, tutorial: ci === 0, assist, upgrades: upgradeLevels(prog) });
  input.reset();
  input.enabled = true;
  input.raceMode = true;
  raceBoost = false;
  raceItem = false;
  raceHud.classList.remove('hidden');
  rhCount.classList.add('hidden');
  $('rh-pausebox').classList.add('hidden');
  $('rh-total').textContent = `/${race.racers.length}`;
  // Only show the controls this race has unlocked.
  const f = race.feat;
  boostBtn.classList.toggle('hidden', !f.has('boost'));
  $('rh-boost-wrap').classList.toggle('hidden', !f.has('boost'));
  itemBtn.classList.toggle('hidden', !f.has('items'));
  setItemButton(null);
  // "NEW mechanic" card before the countdown.
  const power = prog.shipPower;
  $('rh-intro-race').textContent = `RACE ${ci + 1} OF ${CAREER.length} · ${league.name.toUpperCase()}`;
  $('rh-intro-name').textContent = track.name.toUpperCase();
  $('rh-intro-icon').textContent = track.intro.icon;
  $('rh-intro-title').textContent = track.intro.title;
  $('rh-intro-text').textContent = track.intro.text + (assist ? ' (The hens are going easy on you this time.)' : '');
  const pw = $('rh-intro-power');
  pw.textContent = `⚡ Ship Power ${power} · Recommended ${track.power}` + (power < track.power ? ' — upgrade in the Garage!' : '');
  pw.className = 'rh-intro-power ' + (power < track.power ? 'low' : 'ok');
  $('rh-intro').classList.remove('hidden');
  audio.setGalaxy(g.music);
  audio.setLevel(3);
  audio.setBoss(false);
  audio.stopMusic(0.05);
  setTimeout(() => { if (state.mode === 'race') { audio.startMusic(); audio.muffleMusic(18000, 0.1); } }, 60);
  audio.startEngine();
}

race.events = {
  onCountdown(n) {
    rhCount.textContent = n;
    rhCount.classList.remove('hidden');
    audio.countdown(false);
    haptics.tap();
  },
  onGo() {
    rhCount.textContent = 'GO!';
    setTimeout(() => rhCount.classList.add('hidden'), 600);
    audio.countdown(true);
    haptics.tap();
  },
  onLap(lap) { raceMsg(`LAP ${lap}`); audio.waveClear(); },
  onFinalLap() { raceMsg('FINAL LAP!', 1500); audio.setBoss(true); haptics.waveClear(); },
  onBoost() { audio.missileLaunch(); haptics.tap(); race.shake = 0.35; },
  onPad() { audio.giftOpen(); },
  onBump() { audio.splat(); haptics.bossHit(); race.shake = 0.45; },
  onCrash(kind) { audio.missileHit(); haptics.shieldBreak(); race.shake = 1; raceMsg(kind === 'egg' ? 'SCRAMBLED!' : 'OUCH!', 800); },
  onWall(hard) {
    if (!hard) return;
    audio.splat(); audio.missileHit(); haptics.bossHit(); race.shake = 0.8;
    raceMsg('WALL! STEER INTO THE CORNER', 1000);
  },
  onHint(text) { raceMsg(text, 1700); audio.countdown(false); },
  onItem(item) { setItemButton(item); if (item) { audio.giftOpen(); haptics.tap(); raceMsg(`GOT ${ITEM_ICON[item]} ${item.toUpperCase()}!`, 900); } },
  onFire() { audio.missileLaunch(); haptics.tap(); },
  onHitRival(r) { audio.cluck(0.8, 0.25); raceMsg(`EGGED ${r.name.toUpperCase()}! 🥚`, 1000); },
  onIncoming() { raceMsg('⚠ INCOMING EGG!', 900); audio.cluck(1.4, 0.2); },
  onShield() { audio.shieldUp(); },
  onShieldBlock() { audio.shieldBreak(); haptics.shieldBreak(); raceMsg('SHIELD BLOCKED IT!', 900); },
  onMine() { audio.countdown(false); },
  onDriftTurbo(t) { audio.missileLaunch(); haptics.tap(); raceMsg(t > 1.4 ? 'ULTRA DRIFT TURBO!' : 'DRIFT TURBO!', 800); race.shake = 0.3; },
  onHenDrop() { audio.cluck(0.45, 0.2); },
  onOvertake(r) { audio.cluck(1.25, 0.16); raceMsg(`PASSED ${r.name.toUpperCase()}!`, 900); },
  onFinish(results, place) {
    state.mode = 'raceDone';
    if (place > 3) raceFails[state.raceTrack.id] = (raceFails[state.raceTrack.id] || 0) + 1;
    raceMsg(place === 1 ? '🏁 YOU WIN! 🏁' : `🏁 ${ordinal(place)} PLACE`, 2000);
    if (place <= 3) { audio.victory(); haptics.bossDefeated(); } else { audio.waveClear(); haptics.waveClear(); }
    setTimeout(() => finishRace(results, place), 2200);
  },
};

function finishRace(results, place) {
  if (state.mode !== 'raceDone') return;
  state.mode = 'raceResults';
  raceHud.classList.add('hidden');
  const lg = state.raceLeague;
  const t = state.raceTrack;
  const prize = lg.prize[place - 1] || 0;
  const openBefore = GALAXIES.map((_, i) => prog.galaxyOpen(i));
  const nextDef = CAREER[careerIndex(t.id) + 1] || null;
  const nextWasOpen = nextDef && prog.raceUnlocked(nextDef.track.id);
  const firstTrophy = prog.trophies === 0;
  const tutBefore = tutorialStage(prog);
  const rec = prog.recordRace(t.id, place);
  prog.bankRun(prize, prize * 4);
  updateMenuMeta();

  // Explain what the trophy did (or what a podium would have done).
  const notes = [];
  const newGalaxy = GALAXIES.findIndex((g, i) => !openBefore[i] && prog.galaxyOpen(i));
  if (rec.newTrophy) notes.push(`🏆 Trophy earned! You now have ${prog.trophies}.`);
  if (newGalaxy >= 0) notes.push(`🔓 It unlocked ${GALAXIES[newGalaxy].name} (Galaxy ${newGalaxy + 1}) in the Dodge journey!`);
  else if (rec.newTrophy) {
    const gi = GALAXIES.findIndex((g, i) => prog.trophies < prog.galaxyTrophyReq(i));
    if (gi >= 0) notes.push(`🏆 ${prog.galaxyTrophyReq(gi) - prog.trophies} more to unlock Galaxy ${gi + 1}: ${GALAXIES[gi].name}.`);
  }
  const nextOpen = nextDef && prog.raceUnlocked(nextDef.track.id);
  if (nextDef && nextOpen && !nextWasOpen) notes.push(`🔓 ${raceLabel(nextDef.track.id)} unlocked!`);
  if (nextDef && !nextOpen) notes.push(`Finish top 3 to win a 🏆 and unlock ${raceLabel(nextDef.track.id)}.`);

  // Next race: the next career race, if unlocked.
  const next = nextOpen ? { lg: nextDef.league, t: nextDef.track } : null;
  state.nextRace = next;
  const title = place === 1 ? pick(RACE_QUIPS.win) : place <= 3 ? pick(RACE_QUIPS.podium) : pick(RACE_QUIPS.lose);
  showResults({
    results, place, prize, newTrophy: notes.join('<br>'), title, trackName: t.name,
    nextLabel: next ? `NEXT: ${next.t.name} ➜` : null,
    power: { have: prog.shipPower, need: t.power },
  });
  showScreen('raceResults');
  audio.muffleMusic(2500, 0.4);

  const stillHere = () => state.mode === 'raceResults' && !screens.raceResults.classList.contains('hidden');
  if (rec.newTrophy && firstTrophy && !prog.ftueSeen('trophy') && prog.galaxyOpen(0)) {
    // Hand-off (a): first trophy ever → the Dodge journey.
    prog.ftueMark('trophy');
    handoff.showLater(700, {
      forced: !!tutorialStage(prog),
      icon: '🏆',
      title: 'TROPHY EARNED!',
      text: `It unlocks the <b>${GALAXIES[0].name}</b> in the Dodge Journey. Dodge the hens there to earn 🍗 drumsticks for Garage upgrades.`,
      celebrate: true,
      buttons: [
        { label: '🐔 GO DODGE', primary: true, onClick: () => goGalaxy(0) },
        { label: 'LATER' },
      ],
    }, stillHere);
  } else if (place > 3 && prog.shipPower < t.power && !failHints.has(t.id)) {
    // Hand-off (d): lost while under-powered → earn drumsticks & upgrade (once per track per session).
    failHints.add(t.id);
    const buy = cheapestAffordableRaceUpgrade(prog);
    const fg = farmGalaxy(prog);
    const buttons = [];
    if (buy) buttons.push({ label: `🛠 UPGRADE ${buy.u.name.toUpperCase()}`, primary: true, onClick: () => openHangar('raceResults', buy.u.id) });
    if (fg >= 0) buttons.push({ label: '🐔 EARN 🍗 IN DODGE', primary: !buy, onClick: () => goGalaxy(fg) });
    buttons.push({ label: '↻ RETRY ANYWAY', onClick: () => goRace(lg, t) });
    handoff.showLater(700, {
      forced: !!tutorialStage(prog),
      icon: '⚡',
      title: 'NEED MORE POWER',
      text: `⚡ Ship Power ${prog.shipPower} · Recommended ${t.power}.<br>Earn 🍗 in the Dodge journey and upgrade your ship in the Garage.`,
      buttons,
    }, stillHere);
  }
  maybeFinishTutorial(tutBefore);
}
const failHints = new Set();

// Tutorial finished: everything opens up.
function maybeFinishTutorial(stageBefore) {
  if (stageBefore !== 'race2' || tutorialStage(prog)) return;
  prog.ftueMark('done');
  handoff.showLater(900, {
    icon: '🎓',
    title: 'TUTORIAL COMPLETE!',
    text: 'You know the loop: <b>🏁 Race</b> for 🏆 → <b>🐔 Dodge</b> for 🍗 → <b>🛠 Garage</b> upgrades → harder races.<br>Everything is unlocked now. Go get that Mother Hen!',
    celebrate: true,
    buttons: [{ label: '🏠 LET\'S GO', primary: true, onClick: () => goHome() }],
  });
}

$('btn-race').addEventListener('click', openRaceMenu);
// ---------------------------------------------------------------- Coco Catapult
const slingHud = $('sling-hud');
let slingSel = { w: 0, l: 0 };
function slingData() {
  if (!prog.data.sling || typeof prog.data.sling !== 'object') prog.data.sling = { stars: {}, best: {}, rewards: [] };
  const d = prog.data.sling;
  d.stars = d.stars || {}; d.best = d.best || {}; d.rewards = d.rewards || [];
  return d;
}
function slingStarsTotal() { return Object.values(slingData().stars).reduce((a, b) => a + b, 0); }
function slingWorldDone(w) { const d = slingData(); return WORLDS[w].levels.every((_, l) => (d.stars[levelId(w, l)] || 0) > 0); }
function slingWorldOpen(w) { return w === 0 || slingWorldDone(w - 1); }
function slingLevelOpen(w, l) { return slingWorldOpen(w) && (l === 0 || (slingData().stars[levelId(w, l - 1)] || 0) > 0); }
const addonName = (id) => { const c = COSMETICS.find((x) => x.id === id); return c ? `${c.icon} ${c.name}` : id; };

function openSlingMenu(world = null) {
  audio.unlock();
  audio.click();
  if (state.mode !== 'menu') leaveRun();
  if (world !== null) slingSel.w = world;
  else { let w = 0; while (w < WORLDS.length - 1 && slingWorldDone(w)) w++; slingSel.w = w; }
  renderSlingMenu();
  showScreen('sling');
}
function renderSlingMenu() {
  const d = slingData();
  $('sl-stars').textContent = slingStarsTotal();
  const tabs = $('sl-worlds');
  tabs.textContent = '';
  WORLDS.forEach((W, w) => {
    const b = document.createElement('button');
    const open = slingWorldOpen(w);
    b.className = 'tab' + (w === slingSel.w ? ' active' : '') + (open ? '' : ' locked');
    b.textContent = open ? W.name.split(' ')[0] : '🔒';
    b.addEventListener('click', () => { if (!open) { audio.denied(); return; } audio.click(); slingSel.w = w; renderSlingMenu(); });
    tabs.appendChild(b);
  });
  const W = WORLDS[slingSel.w];
  const got = d.rewards.includes(W.reward);
  $('sl-world-info').innerHTML = `<b>${W.name}</b> · clear every level to win <b>${addonName(W.reward)}</b>${got ? ' ✅' : ''}`;
  const grid = $('sl-levels');
  grid.textContent = '';
  W.levels.forEach((L, l) => {
    const id = levelId(slingSel.w, l);
    const open = slingLevelOpen(slingSel.w, l);
    const st = d.stars[id] || 0;
    const b = document.createElement('button');
    b.className = 'sl-level' + (open ? '' : ' locked') + (L.boss ? ' boss' : '');
    b.innerHTML = `<span class="sl-num">${open ? id : '🔒'}</span><span class="sl-name">${L.name}</span><span class="stars-row">${starsHTML(st)}</span>`;
    b.addEventListener('click', () => { if (!open) { audio.denied(); return; } startSling(slingSel.w, l); });
    grid.appendChild(b);
  });
}

function slingShots() {
  const el = $('sl-shots');
  el.innerHTML = Array.from({ length: sling.shotsLeft }, () => `<span class="sl-shot">${cocoSVG('happy')}</span>`).join('');
}
function slingHint(text, ms = 3200) {
  const el = $('sl-hint');
  if (!text) { el.classList.add('hidden'); return; }
  el.innerHTML = `${cocoSVG('happy', 'coco coco-mini')}<span></span>`;
  el.lastChild.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(slingHint.t);
  if (ms) slingHint.t = setTimeout(() => el.classList.add('hidden'), ms);
}

function startSling(w, l) {
  audio.unlock();
  audio.click();
  handoff.hide();
  if (state.mode !== 'menu' && state.mode !== 'sling') leaveRun();
  showScreen(null);
  hud.show(false);
  state.mode = 'sling';
  slingSel = { w, l };
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sling.load(w, l, { skin: prog.skin, upgrades: upgradeLevels(prog) });
  sling.paused = false;
  slingHud.classList.remove('hidden');
  $('sl-pause').classList.add('hidden');
  $('sl-hud-world').textContent = WORLDS[w].name.split(' ')[0].toUpperCase();
  $('sl-hud-level').textContent = levelId(w, l);
  $('sl-hud-score').textContent = '0';
  slingShots();
  const def = WORLDS[w].levels[l];
  slingHint(`${def.name}! Take out every hen. Clear it in ${def.par} shot${def.par > 1 ? 's' : ''} for ★★★`, 3000);
  audio.startMusic();
  audio.setGalaxy(GALAXIES[WORLDS[w].galaxy].music);
  audio.setBoss(!!def.boss);
}
function leaveSling() {
  sling.dispose();
  slingHud.classList.add('hidden');
  renderer.shadowMap.enabled = false;
  audio.stopMusic();
}

sling.events = {
  onAim() {
    const first = !prog.ftueSeen('slingAim');
    if (first) slingHint('Drag DOWN anywhere to pull me back, left/right to aim. Let go to launch!', 0);
  },
  onGrab() { audio.countdown(false); haptics.tap(); },
  onLaunch() {
    audio.missileLaunch(); haptics.tap(); slingShots();
    if (!prog.ftueSeen('slingAim')) { prog.ftueMark('slingAim'); slingHint('Tap while I\'m flying for a DIVE boost!', 2600); }
    else slingHint(null);
  },
  onDash() { audio.pickup(6); haptics.perfect(); sling.kick(0.2); },
  onFirstHit() { sling.kick(0.35); },
  onImpact(kind, k) { if (kind === 'hen') audio.cluck(1.3, 0.2); else audio.softHit(); if (k > 0.5) haptics.tap(); },
  onBreak(m) { if (m === 'ice') audio.splat(); else audio.collision(); },
  onHen(type, left) {
    audio.missileHit(); haptics.bossHit(); sling.kick(type === 'boss' ? 0.8 : 0.4);
    if (left === 0) slingHint('Every hen is down! 🎉', 1600);
  },
  onScore(total, pts, at) {
    $('sl-hud-score').textContent = total.toLocaleString();
    if (!at) return;
    const el = document.createElement('div');
    el.className = 'sl-pop' + (pts >= 5000 ? ' big' : '');
    el.textContent = pts.toLocaleString();
    el.style.left = `${at.x}px`; el.style.top = `${at.y}px`;
    $('sl-pops').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  },
  onEnd(r) { setTimeout(() => showSlingResult(r), r.won ? 1100 : 600); },
};

function showSlingResult(r) {
  if (state.mode !== 'sling') return;
  const d = slingData();
  const id = r.def.id;
  const prevStars = d.stars[id] || 0;
  const newStars = Math.max(0, r.stars - prevStars);
  const earned = r.won ? newStars * 25 + Math.round(r.score / 2000) : 0;
  if (r.won) {
    d.stars[id] = Math.max(prevStars, r.stars);
    d.best[id] = Math.max(d.best[id] || 0, r.score);
  }
  let note = '';
  const w = r.def.world;
  if (r.won && slingWorldDone(w) && !d.rewards.includes(WORLDS[w].reward)) {
    d.rewards.push(WORLDS[w].reward);
    const reward = WORLDS[w].reward;
    if (!prog.ownsAddon(reward)) {
      prog.data.addons.push(reward);
      const c = COSMETICS.find((x) => x.id === reward);
      prog.data.wear[c.slot] = reward;
      note = `🏆 World cleared! You won <b>${addonName(reward)}</b>. Your pod is wearing it now.`;
    } else { prog.data.crystals += 200; note = '🏆 World cleared! +🍗 200 bonus drumsticks.'; }
    if (w + 1 < WORLDS.length) note += `<br>🔓 ${WORLDS[w + 1].name} unlocked!`;
  }
  prog.bankRun(earned, Math.round(r.score / 400));
  prog.save();
  ship.setUpgrades(upgradeLevels(prog));
  updateMenuMeta();

  $('slr-level').textContent = `LEVEL ${id} · ${r.def.name.toUpperCase()}`;
  $('slr-title').textContent = r.won ? (r.stars === 3 ? 'EGG-CELLENT!' : 'LEVEL CLEAR!') : 'OUT OF SHOTS';
  $('slr-stars').innerHTML = starsHTML(r.stars, 3, true);
  $('slr-score').textContent = r.score.toLocaleString();
  $('slr-bonus').textContent = r.bonus ? `+${r.bonus.toLocaleString()}` : '0';
  $('slr-earned').textContent = r.won ? `+${earned}` : '0';
  $('slr-note').innerHTML = note;
  $('slr-note').classList.toggle('hidden', !note);
  const next = r.def.index + 1 < WORLDS[w].levels.length ? [w, r.def.index + 1] : (w + 1 < WORLDS.length && slingWorldOpen(w + 1) ? [w + 1, 0] : null);
  $('btn-slr-next').classList.toggle('hidden', !r.won || !next);
  $('btn-slr-next').onclick = () => next && startSling(next[0], next[1]);
  slingHud.classList.add('hidden');
  showScreen('slingResult');
  if (r.won) {
    audio.victory(); haptics.waveClear();
    for (let i = 0; i < r.stars; i++) setTimeout(() => audio.starDing(i), 400 + i * 350);
  } else audio.denied();
}

$('btn-sling').addEventListener('click', () => openSlingMenu());
$('btn-sl-home').addEventListener('click', goHome);
$('btn-sl-pause').addEventListener('click', () => { audio.click(); sling.paused = true; $('sl-pause').classList.remove('hidden'); });
$('btn-sl-resume').addEventListener('click', () => { audio.click(); sling.paused = false; $('sl-pause').classList.add('hidden'); });
$('btn-sl-restart').addEventListener('click', () => startSling(slingSel.w, slingSel.l));
$('btn-sl-levels').addEventListener('click', () => { leaveSling(); state.mode = 'menu'; openSlingMenu(slingSel.w); });
$('btn-slr-retry').addEventListener('click', () => startSling(slingSel.w, slingSel.l));
$('btn-slr-levels').addEventListener('click', () => { leaveSling(); state.mode = 'menu'; openSlingMenu(slingSel.w); });
$('btn-slr-home').addEventListener('click', goHome);


$('btn-next-step').addEventListener('click', () => runStep(currentStep || nextStep(prog)));
$('btn-map-race').addEventListener('click', () => { const r = prog.nextCareerRace; if (r) goRace(r.league, r.track); else openRaceMenu(); });
$('btn-welcome-go').addEventListener('click', () => {
  prog.ftueMark('welcome');
  audio.unlock();
  audio.click();
  startRace(CAREER[0].league, CAREER[0].track);
});
// First launch: welcome + the core loop instead of the start menu.
if (needsWelcome()) showScreen('welcome');
else showScreen('start');   // also starts the Home pod preview
$('btn-race-back').addEventListener('click', goHome);
$('btn-rr-home').addEventListener('click', goHome);
$('rbtn-home').addEventListener('click', goHome);
$('btn-race-garage').addEventListener('click', () => openHangar('race'));
$('btn-rr-retry').addEventListener('click', () => { audio.click(); startRace(state.raceLeague, state.raceTrack); });
$('btn-rr-next').addEventListener('click', () => { audio.click(); if (state.nextRace) startRace(state.nextRace.lg, state.nextRace.t); });
$('btn-rr-menu').addEventListener('click', () => { leaveRun(); raceMenu.render(); showScreen('race'); });
window.addEventListener('keydown', (e) => {
  if (state.mode !== 'race') return;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); raceBoost = true; }
  if (e.key === 'e' || e.key === 'E' || e.key === 'Shift') raceItem = true;
  if (e.key === 'Enter' && race.waiting) $('rbtn-go').click();
});

function updateRace(realDt) {
  if (!race.player) { renderer.render(scene, camera); return; }
  const steer = state.mode === 'race' ? input.raceSteer() : 0;
  const live = state.mode === 'race';
  race.update(realDt, steer, live && raceBoost, live && raceItem);
  raceBoost = false;
  raceItem = false;
  const h = race.hud;
  if (state.mode === 'race' || state.mode === 'raceDone') {
    $('rh-place').textContent = ordinal(h.place);
    $('rh-lap').textContent = `LAP ${h.lap}/${h.laps}`;
    $('rh-time').textContent = fmtTime(h.time);
    $('rh-speed').textContent = h.speed;
    $('rh-boost-fill').style.width = `${h.energy * 100}%`;
    boostBtn.classList.toggle('empty', h.energy < 0.05);
    $('rh-draft').classList.toggle('hidden', !h.drafting);
    mapT -= realDt;
    if (mapT <= 0) { mapT = 0.05; race.drawMinimap(rhMap, 96); }
  }
  audio.setEngine(Math.min(1, h.speed / 400), steer, 1);
  renderer.render(race.scene, race.camera);
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

function updateRun(dt, realDt) {
  const live = state.mode === 'playing';
  if (live) {
    state.time += dt;
    const ev = journey.update(dt);
    if (ev === 'waveStart') onWaveStart();
    else if (ev === 'waveClear') onWaveClear();
    else if (ev === 'bossFight') { bossQuarter = 4; hud.popup('AUTO-FIRE! DODGE THE EGGS!', 0.5, ''); }
  }

  state.speed = journey.speed * state.mods.speedMult;
  ship.setTarget(input.update(realDt, ship.x));

  const hitObs = obstacles.update(dt, state.speed, ship.x, nearEvents);
  const hitHen = chickens.update(dt, state.speed, ship.x, nearEvents);
  const laserHit = boss.active ? boss.update(dt, realDt, state.speed, ship.x) : false;
  ship.push = obstacles.pull;

  pickEvents.length = 0;
  pickups.update(dt, state.speed, ship.x, magnetRadius(), pickEvents);
  for (const ev of pickEvents) onPickup(ev);

  const hit = hitObs ? { obj: hitObs, kind: 'rock' } : hitHen || (laserHit ? { kind: 'laser' } : null);
  if (resolveHit(hit)) return;

  if (live && nearEvents.length) {
    // One near miss per frame, the tightest one.
    let best = nearEvents[0];
    for (const e of nearEvents) if (e.gap < best.gap) best = e;
    onNearMiss(best);
  }

  state.score += state.speed * dt * CONFIG.distanceScore * state.mods.scoreMult;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) { state.combo = 1; hud.setCombo(1); }
  }
  if (state.streakTimer > 0) state.streakTimer -= dt;
  if (state.effect && state.effect.t > 0) {
    state.effect.t -= realDt;
    if (state.effect.t <= 0) endEffect();
    else hud.setEffect(`${GIFTS[state.effect.type].label} · ${Math.ceil(state.effect.t)}`);
  }
  onScoreProgress();
  hud.setScore(state.score);
  if (boss.active) hud.setBossHp(boss.hpFrac);
  hud.setProgress(Math.min(journey.localWave, journey.waveCount), journey.waveFrac, journey.waveCount);
}

// Background drift for menus / post-run screens.
function updateAttract(dt, realDt, target) {
  state.menuTime += realDt;
  state.speed += (target - state.speed) * (1 - Math.exp(-realDt * 1.5));
  obstacles.update(dt, state.speed, 999, nearEvents);
  chickens.update(dt, state.speed, 999, nearEvents);
  pickups.update(dt, state.speed, 999, 0, pickEvents);
  ship.push = 0;
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
  if (state.mode === 'sling') {
    sling.update(realDt);
    renderer.render(sling.scene, sling.camera);
    return;
  }
  if (state.mode === 'race' || state.mode === 'raceDone' || state.mode === 'raceResults') {
    updateRace(realDt);
    if (DEBUG) debugEl.textContent = `fps ${perf.fps.toFixed(0)}  q:${quality}\ncalls ${renderer.info.render.calls}\n${state.mode} place ${race.playerPlace} v ${race.player ? race.player.v.toFixed(1) : '-'}`;
    return;
  }

  fx.update(realDt);
  state.perfectCd = Math.max(0, state.perfectCd - realDt);
  state.splatCd = Math.max(0, state.splatCd - realDt);

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
      advanceWave();
    }
  } else {
    state.worldScale = 1;
  }
  const ts = fx.timeScale * state.worldScale;
  const dt = realDt * ts;
  nearEvents.length = 0;
  env.warp += ((state.mode === 'warp' ? Math.sin(Math.min(1, state.warpT / WARP_DUR) * Math.PI) : 0) - env.warp) * (1 - Math.exp(-realDt * 6));

  if (state.mode === 'playing' || state.mode === 'choosing' || state.mode === 'resuming') {
    updateRun(dt, realDt);
  } else if (state.mode === 'victory') {
    // Celebration: world keeps flowing, drumsticks rain into the magnet.
    state.speed = journey.speed;
    ship.setTarget(input.update(realDt, ship.x));
    obstacles.update(dt, state.speed, 999, nearEvents);
    chickens.update(dt, state.speed, 999, nearEvents);
    boss.update(dt, realDt, state.speed, ship.x);
    pickEvents.length = 0;
    pickups.update(dt, state.speed, ship.x, magnetRadius(), pickEvents);
    for (const ev of pickEvents) onPickup(ev);
    hud.setScore(state.score);
    state.victoryT -= realDt;
    if (state.victoryT <= 0) {
      if (journey.endless) advanceWave();
      else showVictoryScreen();
    }
  } else if (state.mode === 'warp') {
    state.warpT += realDt;
    const k = state.warpT / WARP_DUR;
    state.speed = journey.speed * (1 + Math.sin(Math.min(1, k) * Math.PI) * 4);
    ship.setTarget(input.update(realDt, ship.x));
    fx.kickFov(Math.sin(Math.min(1, k) * Math.PI) * 26);
    if (k > 0.3) fx.shake(realDt * 0.8);
    if (k >= 0.6 && !state.warped) {
      state.warped = true;
      if (journey.endless) journey.afterWarp();
      else journey.nextGalaxy();
      enterGalaxy();
      fx.flash('rgba(255, 255, 255, 0.95)', 0.95, 600);
      haptics.waveClear();
    }
    obstacles.update(dt, state.speed, 999, nearEvents);
    pickups.update(dt, state.speed, 999, 0, pickEvents);
    if (k >= 1) {
      state.mode = 'playing';
      audio.startEngine();
    }
  } else if (state.mode === 'dying') {
    state.speed = Math.max(6, state.speed * Math.exp(-dt * 1.2));
    obstacles.update(dt, state.speed, 999, nearEvents);
    chickens.update(dt, state.speed, 999, nearEvents);
    if (boss.active) boss.update(dt, realDt, state.speed, 999);
    pickups.update(dt, state.speed, 999, 0, pickEvents);
    state.deathTimer -= realDt;
    if (state.deathTimer <= 0) gameOver();
  } else {
    updateAttract(dt, realDt, state.mode === 'menu' ? 16 : 8);
    if (state.mode === 'menu' || state.mode === 'victoryScreen') ship.setTarget(Math.sin(state.menuTime * 0.7) * 1.8);
  }

  if (state.slowMuffled && ts > 0.9 && state.mode === 'playing') {
    state.slowMuffled = false;
    audio.muffleMusic(18000, 0.15);
  }

  const speedNorm = THREE.MathUtils.clamp((state.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
  ship.update(state.mode === 'choosing' ? 0 : realDt, speedNorm);

  // Engine trail (skin-coloured)
  if (ship.group.visible) {
    ship.group.updateMatrixWorld();
    const tb = ship.trailBoost || 1;
    const rate = (quality === 'high' ? 110 : 65) * (1 + speedNorm * 0.5) * (tb > 1 ? 1.5 : 1);
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
          (0.3 + Math.random() * 0.18) * tb, (0.7 + speedNorm * 0.4) * (tb > 1 ? 1.5 : 1),
          c[0], c[1], c[2], 0.6, 1,
        );
      }
    }
    // Feather Dash: golden feathers streaming off the ship.
    if (state.effect && state.effect.type === 'dash' && Math.random() < 0.6) {
      particles.emit(ship.x + (Math.random() - 0.5), 0.2, 0.5, (Math.random() - 0.5) * 2, Math.random(), 8, 0.5, 0.5, 1, 0.85, 0.35, 1, 1);
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

  if (state.mode === 'playing' || state.mode === 'resuming' || state.mode === 'warp' || state.mode === 'victory') {
    audio.setEngine(speedNorm, input.steer, ts);
  }

  renderer.render(scene, camera);

  if (DEBUG) {
    const info = renderer.info.render;
    debugEl.textContent =
      `fps ${perf.fps.toFixed(0)}  q:${quality}\n` +
      `calls ${info.calls}  tris ${info.triangles}\n` +
      `particles ${particles.alive}  speed ${state.speed.toFixed(1)}\n` +
      `ts ${ts.toFixed(2)}  ${state.mode}/${journey.phase} g${journey.gIndex} w${journey.wave}`;
  }
}
requestAnimationFrame(frame);

if (DEBUG) {
  window.__game = {
    state, ship, obstacles, chickens, pickups, boss, journey, fx, input, prog,
    addCrystals(n) { prog.data.crystals += n; prog.save(); updateMenuMeta(); },
    // Set upgrade levels directly, e.g. setUpgrades({engine: 5, shield: 3}); 'max' maxes everything.
    setUpgrades(levels) {
      for (const u of [...UPGRADES, ...RACE_UPGRADES]) {
        if (levels === 'max') prog.data.upgrades[u.id] = u.max;
        else if (levels && u.id in levels) prog.data.upgrades[u.id] = Math.min(u.max, levels[u.id] | 0);
      }
      prog.save();
      ship.setUpgrades(upgradeLevels(prog));
      hangarUI.render();
      updateMenuMeta();
    },
    // Jump straight into a galaxy/wave (wave 4 = boss).
    jumpTo(g, wave = 0) {
      startRun(g);
      journey.wave = wave;
      journey._startPhase();
      if (journey.isBossWave) onBossIntro(); else onWaveStart();
    },
    unlockAll() { prog.data.galaxy.unlocked = 6; prog.save(); },
    race,
    startRace: (li, ti) => startRace(LEAGUES[li], LEAGUES[li].tracks[ti]),
    // FTUE / core-loop hooks
    handoff,
    ftue: { get flags() { return prog.data.ftue; }, nextStep: () => nextStep(prog), runStep: () => runStep(), needsWelcome },
    finishRace(place) {   // simulate the current (or first career) race ending in `place`
      if (!state.raceTrack) { state.raceLeague = CAREER[0].league; state.raceTrack = CAREER[0].track; }
      if (race.running) race.dispose();
      raceHud.classList.add('hidden');
      state.mode = 'raceDone';
      const others = ['Nugget', 'Drumstick Dave', 'Eggatha', 'Big Bertha'];
      const results = Array.from({ length: 5 }, (_, i) => {
        const me = i === place - 1;
        return { name: me ? 'You' : others.shift(), isPlayer: me, color: me ? 0x3cf2ff : 0xffd23a, time: 60 + i * 1.7, place: i + 1 };
      });
      finishRace(results, place);
    },
    endDodgeRun(drumsticks = 30, g = 0) {   // simulate a dodge run ending with drumsticks collected
      startRun(g);
      state.crystals = drumsticks;
      gameOver();
    },
    menu: () => { handoff.hide(); leaveRun(); updateMenuMeta(); showScreen('start'); },
    sling, startSling: (w, l) => startSling(w, l), slingData: () => slingData(),
    resetSave() { store.set('save', JSON.stringify({})); location.reload(); },
  };
}

// ---------------------------------------------------------------- PWA
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.has('nosw')) {
  window.addEventListener('load', () => {
    // When an updated service worker takes over, reload once so the new version shows right away.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch((e) => console.warn('SW registration failed', e));
  });
}
