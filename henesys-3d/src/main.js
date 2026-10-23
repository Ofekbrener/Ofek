// Boot and game loop: maps, player, NPC taps, portals.
import * as THREE from 'three';
import { createEngine } from './engine.js';
import { createInput } from './input.js';
import { Player } from './entities/player.js';
import { newCharacter, advance, gainExp, deathPenalty, killExp, canAdvance } from './rules/stats.js';
import { rollDrops } from './rules/drops.js';
import { Spawner } from './rules/spawner.js';
import { JOBS, MOBS } from './config.js';
import { loadKayKit, buildHero } from './assets/kaykit.js';
import { buildHenesys } from './world/henesys.js';
import { buildMap, FIELD_IDS } from './world/maps.js';
import { buildMob } from './assets/mobs.js';
import { disposeObject } from './assets/toon.js';
import { Mob } from './entities/mob.js';
import { Drop } from './entities/drop.js';
import { createCombat } from './combat.js';
import { createFx } from './fx.js';
import { groundHeight } from './rules/collision.js';
import { followYaw } from './rules/camera.js';
import { createHud } from './hud.js';
import { showTitle } from './title.js';
import { EXP_TABLE } from './config.js';
import { load, save, clear, loadSettings, saveSettings } from './storage.js';
import { sfx, configureAudio, loadSamples, ambience } from './audio.js';
import { modifiers, activeBuffs } from './rules/buffs.js';
import { QUESTS, questStatus, acceptQuest, onMobKilled, completeQuest, availableQuests, activeQuests } from './rules/quests.js';
import { dialogOpen } from './dialog.js';
import { TALK_RANGE } from './entities/npc.js';

const engine = createEngine(document.getElementById('game'));
const input = createInput(document.getElementById('app'));
const fx = createFx(document.getElementById('app'), engine.camera, engine);
const combat = createCombat(fx);

const app = document.getElementById('app');
const settings = loadSettings();
configureAudio(settings);

const game = {
  character: newCharacter('Beginner', 0),
  time: 0, // simulation clock (s) for buffs and skill cooldowns
  advance(job) {
    if (!advance(game.character, job)) return;
    player.model.setWeapon(job);
    fx.levelUp(map.scene, player);
    sfx('levelup');
    persist();
    hud.toast(`You are now a ${JOBS[job].name}! Your skills are on the round buttons. More unlock at levels 13, 16 and 20.`, 5000);
  },
  onLevelUp() {
    sfx('levelup');
    hud.bump('lv');
    persist();
    const ch = game.character;
    if (ch.level === 10 && ch.job === 'beginner') hud.toast('Level 10! Visit Athena Pierce or Dances with Balrog in Henesys to choose a job.', 6000);
  },
};

// ------------------------------------------------------------------ quests
const JOB_NPCS = ['athena', 'balrog', 'grendel', 'darklord'];
const announced = new Set(); // quests whose "done" toast was shown this session (not saved)
const NPC_NAMES = { stan: 'Chief Stan', mia: 'Mia', athena: 'Athena Pierce', balrog: 'Dances with Balrog', grendel: 'Grendel the Really Old', darklord: 'Dark Lord' };
game.quests = {
  marker(npc) {
    const qs = availableQuests(game.character, npc);
    return qs.some(q => q.status === 'ready') ? '?' : qs.some(q => q.status === 'available') ? '!' : '';
  },
  /** A quest dialog for this NPC if it has one to offer or take back, else null. */
  dialog(npc) {
    const qs = availableQuests(game.character, npc);
    // turning in a finished quest comes first; then a job instructor's job change
    if (JOB_NPCS.includes(npc) && canAdvance(game.character) && !qs.some(x => x.status === 'ready')) return null;
    const q = qs.find(x => x.status === 'ready') ?? qs.find(x => x.status === 'available') ?? qs.find(x => x.status === 'active');
    if (!q) return null;
    const g = q.goal;
    if (q.status === 'available') return { lines: [`[${q.name}]`, q.text, `Reward: ${rewardText(q.reward)}.`], choices: [{ label: 'Accept', onPick: () => acceptQuestUI(q.id) }] };
    if (q.status === 'active') return { lines: [`[${q.name}] ${g.label}: ${game.character.quests[q.id].count}/${g.count}.`, 'Come back when you are done.'] };
    return { lines: [`[${q.name}]`, q.done], choices: [{ label: 'Complete', onPick: () => turnIn(q.id) }] };
  },
};
const rewardText = r => [r.exp && `${r.exp} EXP`, r.mesos && `${r.mesos} mesos`, ...Object.entries(r.potions ?? {}).map(([k, n]) => `${n} ${k === 'red' ? 'Red' : 'Blue'} Potions`)].filter(Boolean).join(', ');
function acceptQuestUI(id) {
  if (!acceptQuest(game.character, id)) return false;
  hud.toast(`New quest: ${QUESTS[id].name}. ${QUESTS[id].goal.label} 0/${QUESTS[id].goal.count}.`, 3500);
  sfx('buff'); persist();
  return true;
}
function turnIn(id) {
  const before = game.character.level;
  const r = completeQuest(game.character, id);
  if (!r.ok) return false;
  fx.banner('QUEST COMPLETE', QUESTS[id].name);
  sfx('quest');
  hud.toast(`Reward: ${rewardText(QUESTS[id].reward)}`, 4000);
  if (game.character.level > before) { fx.levelUp(map.scene, player); player.model.cheer?.(); game.onLevelUp?.(); }
  persist();
  return true;
}

const hud = createHud(app, {
  settings,
  onToggle(key, val) { settings[key] = val; configureAudio(settings); saveSettings(settings); if (key === 'controls') input.scheme = val; },
  onReset() { resetting = true; clear(); location.reload(); },
});

const RED_HEAL = 50, BLUE_HEAL = 100;
function drinkPotions() {
  const ch = game.character;
  if (input.pressed('red')) {
    if (ch.potions.red > 0 && ch.hp < ch.maxHp) { ch.potions.red--; ch.hp = Math.min(ch.maxHp, ch.hp + RED_HEAL); sfx('potion'); fx.text(player.position, 2.2, `+${RED_HEAL} HP`, 'gain'); }
    else if (ch.potions.red === 0) hud.toast('No Red Potions left. Monsters drop them.', 2000);
  }
  if (input.pressed('blue')) {
    if (ch.potions.blue > 0 && ch.mp < ch.maxMp) { ch.potions.blue--; ch.mp = Math.min(ch.maxMp, ch.mp + BLUE_HEAL); sfx('potion'); fx.text(player.position, 2.2, `+${BLUE_HEAL} MP`, 'gain'); }
    else if (ch.potions.blue === 0) hud.toast('No Blue Potions left. Monsters drop them.', 2000);
  }
}

async function die() {
  player.dead = true;
  player.model.die?.();
  const lost = deathPenalty(game.character);
  // Save the outcome now, so closing the app on the death notice cannot apply the penalty twice.
  save({ ...game.character, hp: game.character.maxHp }, 'henesys');
  await hud.death(lost);
  const ch = game.character;
  ch.hp = ch.maxHp;
  player.dead = false;
  player.model.revive?.();
  enterMap('henesys');
}

const builders = { henesys: () => buildHenesys(game), ...Object.fromEntries(FIELD_IDS.map(id => [id, () => buildMap(id)])) };
const maps = {};
let map = null;

let player = null;

function enterMap(id, at) {
  map = maps[id] ??= builders[id]();
  map.scene.add(player.object3d);
  if (map.zones && !map.spawner) map.spawner = new Spawner(map.zones);
  fx.clear(); fx.attach(map.scene); combat.reset();
  const p = at ?? map.spawn;
  player.place(p.x, p.z, map);
  engine.setScene(map.scene);
  hud.mapName(map.name);
  persist();
}

const SAVE_EVERY = 15;
let saveTimer = 0, resetting = false, warnedNoSave = false;
function persist() {
  if (!player || player.dead || resetting) return;
  if (!save(game.character, map?.id ?? 'henesys') && !warnedNoSave) {
    warnedNoSave = true;
    hud.toast("This browser blocks saving, so your progress won't be saved. Private browsing often does this.", 6000);
  }
}

const raycaster = new THREE.Raycaster();
function handleTap() {
  const tap = input.takeTap();
  if (!tap || dialogOpen() || !map.npcs) return;
  const ndc = new THREE.Vector2(tap.x / innerWidth * 2 - 1, -(tap.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, engine.camera);
  const hit = raycaster.intersectObjects(map.npcs.map(n => n.hitbox), false)[0];
  const npc = hit?.object.userData.npc;
  if (npc && npc.position.distanceTo(player.position) < TALK_RANGE + 2) npc.onTap();
}

function checkPortals() {
  for (const p of map.portals) {
    if (Math.hypot(player.position.x - p.x, player.position.z - p.z) < p.r && builders[p.to]) {
      sfx('portal');
      enterMap(p.to, p.arrive);
      return;
    }
  }
}

const ctx = {
  now: () => game.time,
  get player() { return player; }, get character() { return game.character; }, get map() { return map; },
  sfx,
  onKill(mob) {
    const ch = game.character;
    const before = ch.level;
    for (const d of onMobKilled(ch, mob.id)) fx.text(mob.position, 1.6, d.item, 'gain quest');
    for (const q of activeQuests(ch)) if (q.status === 'ready' && !announced.has(q.id)) {
      hud.toast(`${q.name}: done! Return to ${NPC_NAMES[q.npc]}.`, 4000);
      announced.add(q.id);
    }
    const exp = killExp(mob.id);
    gainExp(ch, exp);
    fx.text(player.position, 2.3, `+${exp} EXP`, 'gain');
    map.spawner.onDeath(mob.zone);
    fx.kill(mob.position);
    sfx('mobdie');
    fx.particles.burst(mob.position.clone().setY(mob.position.y + 0.3), { count: 10, color: 0xf0ece0, shape: 'dot', speed: 1.6, up: 1.2, size: 1.1, life: 0.6, gravity: -0.5 });
    const y = groundHeight(map.heightFns, mob.position.x, mob.position.z);
    for (const loot of rollDrops(mob.id)) {
      const d = new Drop(loot, mob.position.x, mob.position.z, y);
      map.scene.add(d.object3d); map.drops.push(d);
    }
    if (ch.level > before) { fx.levelUp(map.scene, player); player.model.cheer?.(); game.onLevelUp?.(); }
    persist();
  },
};

function updateMobs(dt, t) {
  if (!map.spawner) return;
  for (const r of map.spawner.update(dt)) {
    const m = new Mob(r.mobId, buildMob(r.mobId), r.x, r.z, r.zone);
    m.position.y = groundHeight(map.heightFns, r.x, r.z);
    map.scene.add(m.object3d); map.mobs.push(m);
  }
  for (let i = map.mobs.length - 1; i >= 0; i--) {
    const m = map.mobs[i];
    m.update(dt, t, player, map);
    if (m.wantsShot) { m.wantsShot = false; if (m.alive) combat.enemyShot(ctx, m); }
    if (m.removable) { m.object3d.removeFromParent(); disposeObject(m.object3d); map.mobs.splice(i, 1); }
  }
  for (let i = map.drops.length - 1; i >= 0; i--) {
    const d = map.drops[i], res = d.update(dt, t, player);
    if (!res) continue;
    if (res === 'picked') {
      const ch = game.character;
      if (d.loot.kind === 'mesos') { ch.mesos += d.loot.amount; fx.text(d.position, 0.8, `+${d.loot.amount} mesos`, 'gain meso'); hud.bump('mesos'); ctx.sfx('coin'); }
      else { ch.potions[d.loot.item]++; fx.text(d.position, 0.8, d.loot.item === 'red' ? 'Red Potion' : 'Blue Potion', 'gain'); hud.bump(d.loot.item); ctx.sfx('pickup'); }
      fx.particles.burst(d.position, { count: 6, color: d.loot.kind === 'mesos' ? [0xffe066, 0xffffff] : [0xffffff], speed: 2.5, up: 2, size: 0.25, life: 0.4, gravity: 4, additive: true });
      persist();
    }
    d.object3d.removeFromParent(); map.drops.splice(i, 1);
  }
}

// A skill tap waits up to 0.4 s for the short lock after the previous action,
// so it is never lost to a held Attack button.
let queuedSkill = null, queuedFor = 0;
function handleCombatInput(dt) {
  if (dialogOpen() || player.dead) { queuedSkill = null; return; }
  const skills = JOBS[game.character.job].skills;
  for (let i = 0; i < 4; i++) if (input.pressed('skill' + (i + 1)) && skills[i]) { queuedSkill = skills[i]; queuedFor = 0.4; }
  if (queuedSkill) {
    const locked = combat.locked;
    const r = combat.tryAttack(ctx, queuedSkill);
    queuedFor -= dt;
    if (r !== -1 || !locked || queuedFor <= 0) queuedSkill = null;
    return;
  }
  if (input.pressed('attack') || input.held('attack')) combat.tryAttack(ctx);
}

let dustT = 0, wasOnGround = true;
engine.onFrame((dt, t, realDt) => {
  if (!player) return;
  input.poll();
  if (dialogOpen() || player.dead) { input.move.x = 0; input.move.y = 0; input.clear(); }
  drinkPotions();
  player.update(dt, input, map, t);
  for (const n of map.npcs ?? []) n.update(dt, t, player);
  handleCombatInput(dt);
  updateMobs(dt, t);
  combat.update(dt, ctx);
  fx.update(dt, map.mobs ?? []);
  handleTap();
  checkPortals();
  map.animate?.(t, engine.camera);
  if (map.sun) {
    map.sun.position.set(player.position.x + 6, player.position.y + 12, player.position.z + 8);
    map.sun.target.position.copy(player.position);
  }
  if (game.character.hp <= 0 && !player.dead) die();
  game.time += dt;
  const mods = modifiers(game.character, game.time);
  player.speedMod = mods.speed;
  player.setHidden?.(mods.hidden);
  hud.update(game.character, { quests: activeQuests(game.character), buffs: activeBuffs(game.character, game.time), cooldown: id => combat.cooldownLeft(id, game.time) });
  saveTimer += dt;
  if (saveTimer > SAVE_EVERY) { saveTimer = 0; persist(); }
  const mag = Math.hypot(input.move.x, input.move.y);
  // Classic: the camera always settles behind the back. Free: it follows only while walking.
  input.camYaw = input.scheme === 'classic'
    ? followYaw(input.camYaw, player.yaw, dt, { moving: true, forward: 1, dragging: input.camDragging })
    : followYaw(input.camYaw, player.yaw, dt, { moving: mag > 0.15 && !player.dead, forward: mag ? input.move.y / mag : 0, dragging: input.camDragging });
  player.updateCamera(engine.camera, input, dt, map.occluders);
  fx.applyShake(engine.camera, realDt);
  dustT -= dt;
  if (player.onGround && player.speed > 0.5 && dustT <= 0) { dustT = 0.3 / player.speedMod; fx.dust(player.position); sfx('step'); }
  if (player.onGround && !wasOnGround) sfx('land');
  wasOnGround = player.onGround;
  ambience(!!map.zones && settings.sound);
});

engine.start();

async function loadAssets() {
  const el = document.createElement('div');
  el.className = 'ui loading';
  el.innerHTML = '<div class="logo small"><span>Henesys</span> <em>3D</em></div><div class="bar"><i></i></div><p>Loading…</p>';
  app.appendChild(el);
  for (;;) {
    try {
      await loadKayKit(k => { el.querySelector('i').style.width = Math.round(k * 100) + '%'; });
      el.remove();
      return;
    } catch (err) {
      el.querySelector('p').textContent = 'Could not load the game files. Check your connection.';
      const retry = document.createElement('button');
      retry.className = 'start'; retry.textContent = 'Retry';
      el.appendChild(retry);
      await new Promise(r => { retry.onclick = r; });
      retry.remove();
      el.querySelector('p').textContent = 'Loading…';
    }
  }
}

async function boot() {
  input.scheme = settings.controls ?? 'classic';
  await loadAssets();
  loadSamples();
  // A returning player goes straight back in; a new character needs Settings > Reset progress.
  const saved = load();
  const pick = saved ? { continue: true } : await showTitle(app);
  let mapId = 'henesys';
  if (pick.continue) { game.character = saved.character; game.character.buffs = {}; mapId = saved.mapId; }
  else game.character = newCharacter(pick.name, pick.look);
  const ch = game.character;
  player = new Player(ch, buildHero(ch.look, ch.job));
  player.onJump = () => sfx('jump');
  enterMap(mapId);
  if (!warnedNoSave) hud.toast(pick.continue ? `Welcome back, ${ch.name}!` : `Welcome, ${ch.name}! Talk to Chief Stan, then head east to the Hunting Ground.`, 5000);
}
boot();

addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
addEventListener('pagehide', persist);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

window.__game = {
  engine, input, game, enterMap, combat, ctx, hud, fx,
  expToNext: () => EXP_TABLE[game.character.level],
  get player() { return player; }, get map() { return map; },
  /** Test hook: jump straight to a level. */
  skillIds: () => JOBS[game.character.job].skills,
  questsFrom: npc => availableQuests(game.character, npc),
  acceptQuest: id => acceptQuestUI(id),
  turnInQuest: id => turnIn(id),
  questStatus: id => questStatus(game.character, id),
  npcDialogFor: npc => game.quests.dialog(npc),
  activeBuffIds: () => activeBuffs(game.character, game.time).map(b => b.id),
  /** Test hook: a fresh level-1 beginner with the same look. */
  resetCharacterForTest() {
    const look = game.character.look;
    game.character = newCharacter('Tester', look);
    player.character = game.character;
    player.model.object3d.removeFromParent();
    player.model = buildHero(look, 'beginner');
    player.object3d.add(player.model.object3d);
    combat.reset();
  },
  debugSetLevel(n) { const ch = game.character; gainExp(ch, EXP_TABLE.slice(ch.level, n).reduce((a, b) => a + b, 0) - ch.exp); },
};
