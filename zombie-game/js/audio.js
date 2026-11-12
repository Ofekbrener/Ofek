// Audio: recorded samples only (Meta Oculus Audio Pack, CC BY 4.0; music rendered from Meta Piano, CC0).
// Buses: master (limiter) <- music, sfx, voice, ambience. Each event plays one sample family.
'use strict';
const AU = {
  ctx: null, buf: {}, master: null, music: null, sfx: null, voice: null, amb: null,
  playing: {}, musicSrc: null, musicName: '', ambSrc: null, muted: false,
};

// event name -> list of files (without .mp3). Each play picks one at random.
const FAM = (base, n) => Array.from({length: n}, (_, i) => `${base}_${String(i + 1).padStart(2, '0')}`);
const SFX_FAMILIES = {
  // swings, by weapon class
  swingLight: FAM('WHSH_WhooshSmall_OS', 3),
  swingHeavy: FAM('WHSH_WhooshMedium_OS', 3),
  swingWide: FAM('SWSH_Swoosh_OS', 6),
  swingBlade: FAM('WEAPSwrd_Sword_OS', 2),
  // impacts
  hitFlesh: FAM('FGHTImpt_PunchRegular_OS', 6),
  hitHeavy: FAM('FGHTImpt_PunchHarder_OS', 4),
  hitHardest: ['FGHTImpt_PunchHardest_OS_01'],
  hitKick: FAM('FGHTImpt_Kick_OS', 5),
  hitKnife: ['WEAPKnif_KnifeScrape_OS_01'],
  hitAxe: ['WEAPAxe_WoodCutAxe_OS_01'],
  hitSaw: ['TOOLHand_WoodCutSaw_OS_01'],
  hitMetal: FAM('METLImpt_MetalHitSurface_OS', 5),
  hitWood: ['WOODImpt_LargeWoodDrop_OS_01'],
  guitarHit: ['MUSCStngr_ElectricGuitarNegative_OS_01', 'MUSCStngr_ElectricGuitarPositive_OS_01', 'MUSCStngr_ElectricGuitarPositive_OS_02'],
  gore: FAM('GORESqsh_BloodSquishSlimy_OS', 4),
  bone: FAM('GOREBone_BonesBreaking_OS', 3),
  skull: FAM('GOREBone_SkullCracking_OS', 2),
  // zombies
  zGroan: ['VOXMale_GroanCreepy_OS_01', 'VOXFem_GroanCreepy_OS_01', ...FAM('CREAMnstr_CreatureCreepy_OS', 3)],
  zAttack: ['CREAHmn_TrollEffort_OS_01', 'CREAHmn_OgreEffort_OS_01'],
  zHurt: FAM('CREAHmn_TrollHurt_OS', 3),
  zDeath: [...FAM('CREAHmn_TrollDeath_OS', 2), ...FAM('CREAHmn_OgreDeath_OS', 3)],
  bossLaugh: FAM('CREAHmn_GiantLaugh_OS', 3),
  bossHurt: FAM('CREAHmn_GiantHurt_OS', 3),
  bossDeath: ['CREAHmn_GiantDeathScream_OS_01'],
  bossEffort: ['CREAHmn_GiantEffort_OS_01'],
  evilLaugh: FAM('VOXLaff_EvilLaugh_OS', 3),
  // player
  pEffort: ['VOXEfrt_Male01Effort_OS_01', 'VOXEfrt_Male02Effort_OS_01'],
  pHurt: FAM('VOXMale_Male01Hurt_OS', 3),
  pDeath: ['VOXMale_Male01DeathScream_OS_01'],
  step: FAM('FEETHmn_ShoeConcreteRun_OS', 5),
  land: FAM('FEETHmn_ShoeConcreteLand_OS', 2),
  jump: FAM('CLOTHMvmt_MovementWithGear_OS', 4),
  // world
  explosion: FAM('DSGNImpt_ImpactCreepyReverb_OS', 3),
  glass: ['GLASBrk_WindowPaneSmallBreak_OS_01'],
  metalDrop: FAM('METLImpt_MetalObjDrop_OS', 4),
  coin: ['OBJCoin_CoinDrop_OS_01'],
  heart: ['UIMisc_Powerup_OS_01', 'UIMisc_Powerup_OS_02'],
  rage: FAM('MAGSpel_MagicSpell_OS', 2),
  // UI and stingers
  cardOpen: ['UIClick_MetalOpen_OS_01'],
  cardPick: ['UIClick_MetalConfirm_OS_01'],
  cardHover: FAM('UIAlert_MusicTone_OS', 5),
  waveStart: ['MUSCStngr_MarchingSnare_OS_01'],
  waveClear: FAM('MUSCStngr_VictoryOrchestral_OS', 3),
  levelUp: FAM('MUSCStngr_LevelUpOrchestral_OS', 2),
  lose: FAM('MUSCStngr_LossOrchestral_OS', 3),
  bossIntro: FAM('DSGNDron_DroneCreepy_OS', 2),
  chains: FAM('CHAINMvmt_ChainsCreepy_OS', 2),
};
const MUSIC_FILES = ['music_combat', 'music_boss', 'music_calm', 'RAIN_CityRain_LOOP_01'];

AU.init = function () {
  if (AU.ctx) return;
  try {
    AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { AU.ctx = null; return; }
  const c = AU.ctx;
  const lim = c.createDynamicsCompressor(); // limiter: stops clipping when many sounds overlap
  lim.threshold.value = -8; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .15;
  AU.master = c.createGain(); AU.master.connect(lim); lim.connect(c.destination);
  for (const [k, v] of [['music', .55], ['sfx', .9], ['voice', .8], ['amb', .35]]) {
    AU[k] = c.createGain(); AU[k].gain.value = v; AU[k].connect(AU.master);
  }
};

AU.fileList = function () {
  const s = new Set(MUSIC_FILES);
  for (const k in SFX_FAMILIES) for (const f of SFX_FAMILIES[k]) s.add(f);
  return [...s];
};

AU.load = async function (onEach) {
  AU.init();
  const files = AU.fileList();
  await Promise.all(files.map(async f => {
    try {
      const ab = await (await fetch('assets/audio/' + f + '.mp3')).arrayBuffer();
      if (AU.ctx) AU.buf[f] = await new Promise((res, rej) => AU.ctx.decodeAudioData(ab, res, rej));
    } catch (e) { console.warn('audio', f, e); }
    onEach && onEach();
  }));
};

AU.resume = function () { if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume(); };

// Play one sample from a family. opts: vol, rate, dur (trim seconds), x/z (world pos for pan + distance), bus.
AU.play = function (fam, o = {}) {
  if (!AU.ctx || AU.muted) return;
  const list = SFX_FAMILIES[fam]; if (!list) return;
  const n = AU.playing[fam] || 0; if (n >= (o.max || 3)) return; // voice limit per family
  const name = list[Math.floor(Math.random() * list.length)], buf = AU.buf[name]; if (!buf) return;
  const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf; src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * (o.var ?? .06));
  let vol = o.vol ?? 1, pan = 0;
  if (o.x !== undefined && G.player) { // simple spatialization relative to the player
    const dx = o.x - G.player.x, dz = o.z - G.player.z, d = Math.hypot(dx, dz);
    vol *= 1 / (1 + Math.max(0, d - 4) * .12); pan = Math.max(-1, Math.min(1, dx / 14));
  }
  g.gain.setValueAtTime(vol, t);
  const dur = Math.min(o.dur || buf.duration, buf.duration);
  if (dur < buf.duration) { g.gain.setValueAtTime(vol, t + dur * .75); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
  let node = src.connect(g);
  if (c.createStereoPanner && pan) { const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(AU[o.bus || 'sfx']);
  src.start(t, o.offset || 0, dur + .02);
  AU.playing[fam] = n + 1; src.onended = () => { AU.playing[fam]--; };
};

// Music: one looping track at a time, cross-faded.
AU.musicTo = function (name, fade = 1.2) {
  if (!AU.ctx || AU.musicName === name) return;
  const c = AU.ctx, t = c.currentTime;
  if (AU.musicSrc) { const old = AU.musicSrc; old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + fade); old.stop(t + fade + .05); }
  AU.musicName = name; AU.musicSrc = null;
  const buf = AU.buf[name]; if (!buf) return;
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.loop = true; s.g = g;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade); s.connect(g).connect(AU.music); s.start(t);
  AU.musicSrc = s;
};
AU.ambience = function (on) {
  if (!AU.ctx) return;
  if (on && !AU.ambSrc && AU.buf.RAIN_CityRain_LOOP_01) {
    const s = AU.ctx.createBufferSource(); s.buffer = AU.buf.RAIN_CityRain_LOOP_01; s.loop = true; s.connect(AU.amb); s.start(); AU.ambSrc = s;
  } else if (!on && AU.ambSrc) { AU.ambSrc.stop(); AU.ambSrc = null; }
};
// Duck music under big hits so impacts punch through (about -6 dB).
AU.duck = function (depth = .5, hold = .25) {
  if (!AU.ctx) return; const g = AU.music.gain, t = AU.ctx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(.55 * depth, t); g.linearRampToValueAtTime(.55, t + hold + .35);
};
AU.toggleMute = function () { AU.muted = !AU.muted; if (AU.master) AU.master.gain.value = AU.muted ? 0 : 1; };
