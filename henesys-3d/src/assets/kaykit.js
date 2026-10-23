// KayKit characters (CC0, see assets/CREDITS.md): skinned meshes that share
// one skeleton, so parts mix freely and one clip set animates them all.
//   await loadKayKit(onProgress)
//   buildHero(look, job) / buildNpc(id) -> CharModel:
//     { object3d, height, setWeapon(job), animate(state, dt, t, speed), attack(skillId?), hit(), cheer(), die(), revive() }
//     state: 'idle' | 'walk' | 'back' | 'jump'
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { normalizeLook } from '../rules/appearance.js';

const BASES = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded', 'Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Mage'];
const HEIGHT = 1.75;
// (findMesh kept for gear lookups)
const lib = { gltf: {}, clips: {}, scale: 1 };

export const PROP_NAMES = ['tree_single_A', 'tree_single_B', 'trees_A_small', 'trees_A_medium', 'trees_B_small', 'trees_B_medium',
  'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E', 'cloud_big', 'cloud_small',
  'barrel', 'crate_A_big', 'crate_A_small', 'crate_B_big', 'sack', 'tent', 'target', 'flag_red', 'flag_green', 'flag_blue', 'flag_yellow',
  'weaponrack', 'wheelbarrow', 'bucket_arrows', 'resource_lumber'];
// KayKit hex props are modelled at about 1/5 of our metre scale.
export const PROP_SCALE = 5;

export async function loadKayKit(onProgress = () => {}) {
  if (lib.ready) return;
  const loader = new GLTFLoader();
  const files = [...BASES.map(b => `assets/chars/${b}.glb`), 'assets/anims.glb', ...PROP_NAMES.map(n => `assets/props/${n}.glb`)];
  let done = 0;
  const loaded = await Promise.all(files.map(f => loader.loadAsync(f).then(g => { onProgress(++done / files.length); return g; })));
  BASES.forEach((b, i) => { lib.gltf[b] = loaded[i]; });
  for (const c of loaded[BASES.length].animations) lib.clips[c.name] = c;
  lib.props = {};
  PROP_NAMES.forEach((n, i) => { lib.props[n] = loaded[BASES.length + 1 + i].scene; });
  const box = new THREE.Box3().setFromObject(lib.gltf.Rogue.scene);
  lib.scale = HEIGHT / (box.max.y - box.min.y);
  lib.ready = true;
}

// --------------------------------------------------------------- recolour

const CELL_W = 128, CELL_H = 256, COLS = 8;
const cellOf = (u, v) => Math.min(31, Math.floor(v * 4)) * COLS + Math.min(7, Math.floor(u * 8));

/** Which atlas cells a mesh samples, most used first. */
function cellsUsed(mesh) {
  const uv = mesh.geometry.attributes.uv, n = new Map();
  for (let i = 0; i < uv.count; i++) { const c = cellOf(uv.getX(i), uv.getY(i)); n.set(c, (n.get(c) ?? 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

function atlasCanvas(tex) {
  const img = tex.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return c;
}

function cellAvg(g, cell) {
  const x = (cell % COLS) * CELL_W, y = Math.floor(cell / COLS) * CELL_H;
  const d = g.getImageData(x + 32, y + 32, 64, 128).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const k = d.length / 4;
  return new THREE.Color(r / k / 255, gg / k / 255, b / k / 255);
}


/** Recolours whole atlas cells to a target colour, keeping each cell's light-to-dark gradient. */
function paintCells(g, cells, target) {
  const t = {}; new THREE.Color(target).getHSL(t);
  for (const cell of cells) {
    const x = (cell % COLS) * CELL_W, y = Math.floor(cell / COLS) * CELL_H;
    const avg = {}; cellAvg(g, cell).getHSL(avg);
    const img = g.getImageData(x, y, CELL_W, CELL_H), d = img.data, c = new THREE.Color(), p = {};
    for (let i = 0; i < d.length; i += 4) {
      c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).getHSL(p);
      const l = THREE.MathUtils.clamp(t.l + (p.l - avg.l) * 0.9, 0.02, 0.98);
      c.setHSL(t.h, t.s, l).getRGB(c, THREE.SRGBColorSpace);
      d[i] = c.r * 255; d[i + 1] = c.g * 255; d[i + 2] = c.b * 255;
    }
    g.putImageData(img, x, y);
  }
}

// Recoloured atlases are 1024² canvases (about 4 MB each), so keep only the
// most recent few; evicted textures are freed on the GPU.
const recolourCache = new Map();
const RECOLOUR_KEEP = 8;
export const recolourCacheSize = () => recolourCache.size;
/**
 * One recoloured texture per (source atlas, look). roles maps each role to the
 * cells it owns in that atlas: { skin: [...], hair: [...], shirt: [...], pants: [...] }.
 */
function recoloured(srcTex, key, roles, look) {
  const k = key + JSON.stringify(look);
  if (recolourCache.has(k)) {
    const hit = recolourCache.get(k);
    recolourCache.delete(k); recolourCache.set(k, hit); // most recently used last
    return hit;
  }
  const c = atlasCanvas(srcTex), g = c.getContext('2d', { willReadFrequently: true });
  if (look.skin != null && roles.skin?.length) paintCells(g, roles.skin, look.skin);
  if (look.hair != null && roles.hair?.length) paintCells(g, roles.hair, look.hair);
  if (look.shirt != null && roles.shirt?.length) paintCells(g, roles.shirt, look.shirt);
  if (look.pants != null && roles.pants?.length) paintCells(g, roles.pants, look.pants);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = srcTex.magFilter; tex.minFilter = srcTex.minFilter;
  recolourCache.set(k, tex);
  while (recolourCache.size > RECOLOUR_KEEP) {
    const [oldKey, old] = recolourCache.entries().next().value;
    recolourCache.delete(oldKey);
    old.dispose();
  }
  return tex;
}

// ---------------------------------------------------------------- assembly

// Which meshes a body base brings, and which of them are gear we hide or show per job.
const PARTS = ['ArmLeft', 'ArmRight', 'Body', 'LegLeft', 'LegRight'];
const HEAD_OF = { rogue: ['Rogue', 'Rogue_Head'], knight: ['Knight', 'Knight_Head'], mage: ['Mage', 'Mage_Head'], barbarian: ['Barbarian', 'Barbarian_Head'], hooded: ['Rogue_Hooded', 'Rogue_Head_Hooded'] };
const OUTFIT = {
  beginner: { base: 'Rogue', gear: ['Knife'] },
  warrior: { base: 'Knight', gear: ['1H_Sword', 'Badge_Shield', 'Knight_Cape'] },
  magician: { base: 'Mage', gear: ['2H_Staff', 'Mage_Cape', 'Mage_Hat'] },
  bowman: { base: 'Rogue', gear: ['2H_Crossbow', 'Rogue_Cape'] },
  thief: { base: 'Rogue_Hooded', gear: ['Knife', 'Knife_Offhand', 'Rogue_Cape'] },
};

function findMesh(root, name) {
  let hit = null;
  root.traverse(o => { if (!hit && o.name === name && (o.isMesh || o.isGroup)) hit = o; });
  return hit;
}

/** Role cells for an atlas, worked out from the meshes that use it. */
function rolesFor(meshes) {
  const roles = { skin: new Set(), hair: new Set(), shirt: new Set(), pants: new Set() };
  const g = atlasCanvas(meshes[0].material.map).getContext('2d', { willReadFrequently: true });
  // Every KayKit atlas keeps the skin tone in cell 0; blond hair is skin-coloured
  // too, so match cells by closeness to cell 0 instead of by hue.
  const skin0 = cellAvg(g, 0), skinCells = new Set([0]);
  for (const m of meshes) for (const c of cellsUsed(m)) {
    const a = cellAvg(g, c);
    if (Math.abs(a.r - skin0.r) + Math.abs(a.g - skin0.g) + Math.abs(a.b - skin0.b) < 0.08) skinCells.add(c);
  }
  for (const m of meshes) {
    const cells = cellsUsed(m).filter(c => !skinCells.has(c));
    const dark = c => { const h = {}; cellAvg(g, c).getHSL(h); return h.l < 0.07; };
    const main = cells.filter(c => !dark(c));
    if (/Head/.test(m.name) && !/Hooded/.test(m.name)) main.slice(0, 1).forEach(c => roles.hair.add(c));
    else if (/Body/.test(m.name)) main.slice(0, 1).forEach(c => roles.shirt.add(c));
    else if (/Leg/.test(m.name)) main.slice(0, 1).forEach(c => roles.pants.add(c));
  }
  skinCells.forEach(c => roles.skin.add(c));
  for (const k of Object.keys(roles)) roles[k] = [...roles[k]];
  return roles;
}

const rolesCache = new Map(); // atlas + parts -> role cells; independent of the look

function assemble(look, outfitKey, extraGear = []) {
  const outfit = OUTFIT[outfitKey];
  const root = cloneSkinned(lib.gltf[outfit.base].scene);
  let skeleton = null;
  root.traverse(o => { if (o.isSkinnedMesh && !skeleton) skeleton = o.skeleton; });

  // hide everything, then show the body parts and this job's gear
  const keep = new Set([...PARTS.map(p => `${outfit.base.replace('_Hooded', '')}_${p}`), ...outfit.gear, ...extraGear]);
  root.traverse(o => { if (o.isMesh) o.visible = keep.has(o.name) || keep.has(o.parent?.name); });

  // Head from the chosen base. Every KayKit character shares the rig and bind pose,
  // so the head geometry drops into this body's own head mesh, which is already skinned.
  const [headBase, headName] = HEAD_OF[look.hairStyle];
  let ownHead = null;
  root.traverse(o => { if (o.isSkinnedMesh && /_Head/.test(o.name)) { if (!ownHead) ownHead = o; else o.visible = false; } });
  let srcHead = null;
  lib.gltf[headBase].scene.traverse(o => { if (o.name === headName && o.isSkinnedMesh) srcHead = o; });
  if (ownHead && srcHead) {
    ownHead.geometry = srcHead.geometry;
    ownHead.material = srcHead.material;
    ownHead.visible = true;
  }

  // recolour each atlas once per look
  const byTex = new Map();
  root.traverse(o => { if (o.isMesh && o.visible && o.material?.map) { const t = o.material.map; if (!byTex.has(t)) byTex.set(t, []); byTex.get(t).push(o); } });
  for (const [tex, meshes] of byTex) {
    const skinned = meshes.filter(m => m.isSkinnedMesh);
    const rkey = tex.uuid + skinned.map(m => m.name).sort().join();
    const roles = rolesCache.get(rkey) ?? rolesCache.set(rkey, rolesFor(skinned)).get(rkey);
    const map = recoloured(tex, tex.uuid, roles, look);
    for (const m of meshes) { m.material = m.material.clone(); m.material.map = map; }
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return root;
}

// --------------------------------------------------------------- animation

const BASIC = {
  beginner: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Slice_Diagonal'],
  warrior: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal'],
  magician: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal'],
  bowman: ['2H_Ranged_Shoot'],
  thief: ['Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'],
};
const SKILL_CLIP = {
  threeSnails: 'Throw', powerStrike: '1H_Melee_Attack_Chop', slashBlast: '1H_Melee_Attack_Slice_Horizontal', rage: 'Cheer',
  spin: '2H_Melee_Attack_Spinning', energyBolt: 'Spellcast_Shoot', magicClaw: 'Spellcast_Shoot', heal: 'Spellcast_Raise',
  thunderbolt: 'Spellcast_Long', doubleShot: '2H_Ranged_Shoot', arrowBlow: '2H_Ranged_Shoot', focus: 'Spellcast_Raise',
  arrowRain: '2H_Ranged_Shoot', luckySeven: 'Throw', doubleStab: 'Dualwield_Melee_Attack_Stab', haste: 'Use_Item', darkSight: 'Spellcast_Raise',
};
// target play length (s) for one-shots, so attacks stay snappy
const ONE_SHOT_LEN = { attack: 0.45, skill: 0.6, hit: 0.35, cheer: 1.4 };

function animator(root, job) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  const act = name => (actions[name] ??= mixer.clipAction(lib.clips[name]));
  let base = null, baseName = '', shot = null, combo = 0, dead = false, currentJob = job;

  function setBase(name, fade = 0.2, timeScale = 1) {
    if (baseName === name) { base.timeScale = timeScale; return; }
    const next = act(name);
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    next.timeScale = timeScale;
    if (base) base.fadeOut(fade);
    base = next; baseName = name;
  }

  function oneShot(name, length, fade = 0.12) {
    if (dead) return;
    const a = act(name), clip = lib.clips[name];
    if (shot && shot !== a) shot.fadeOut(fade);
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = clip.duration / length;
    a.setEffectiveWeight(1).fadeIn(fade).play();
    shot = a;
    shot.userData = { endsIn: length };
  }

  setBase('Idle', 0);

  return {
    animate(state, dt, t, speed = 0) {
      if (!dead) {
        if (state === 'jump') setBase('Jump_Idle', 0.15);
        else if (state === 'back') setBase('Walking_Backwards', 0.2, 1.1);
        else if (state === 'walk') setBase(speed > 0.7 ? 'Running_A' : 'Walking_A', 0.2, speed > 0.7 ? 0.9 + speed * 0.25 : 1.2);
        else setBase('Idle', 0.25);
      }
      if (shot && !dead) {
        shot.userData.endsIn -= dt;
        if (shot.userData.endsIn <= 0.1) { shot.fadeOut(0.18); shot = null; }
      }
      mixer.update(dt);
    },
    attack(skillId) {
      const clip = skillId ? SKILL_CLIP[skillId] : BASIC[currentJob][combo++ % BASIC[currentJob].length];
      oneShot(clip, skillId ? ONE_SHOT_LEN.skill : ONE_SHOT_LEN.attack);
    },
    hit() { oneShot(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', ONE_SHOT_LEN.hit, 0.08); },
    cheer() { oneShot('Cheer', ONE_SHOT_LEN.cheer, 0.2); },
    die() {
      if (dead) return;
      dead = true;
      const a = act('Death_A');
      a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.fadeIn(0.15).play();
      if (shot) shot.fadeOut(0.15);
      if (base) base.fadeOut(0.15);
      base = a; baseName = 'Death_A'; shot = null;
    },
    revive() { dead = false; baseName = ''; mixer.stopAllAction(); base = null; setBase('Idle', 0); },
    setJob(j) { currentJob = j; },
    get attacking() { return !!shot; },
  };
}

// ------------------------------------------------------------------ public

export function buildHero(look, job = 'beginner') {
  const L = normalizeLook(look);
  const holder = new THREE.Group();
  holder.scale.setScalar(lib.scale);
  let root = assemble(L, job), anim = animator(root, job);
  holder.add(root);
  const model = {
    object3d: holder, height: HEIGHT,
    animate: (...a) => anim.animate(...a),
    attack: id => anim.attack(id), hit: () => anim.hit(), cheer: () => anim.cheer(), die: () => anim.die(), revive: () => anim.revive(),
    get attacking() { return anim.attacking; },
    /** Swap outfit and weapon for a new job; the look stays. */
    setWeapon(j) {
      holder.remove(root);
      root = assemble(L, j); anim = animator(root, j);
      holder.add(root);
    },
  };
  return model;
}

const NPCS = {
  stan: { look: { hairStyle: 'barbarian', hair: 0xe8e8f0, skin: 0xf6c79e, shirt: 0x7a5a9a, pants: 0x464a5a }, outfit: 'magician', gear: ['2H_Staff'] },
  mia: { look: { hairStyle: 'rogue', hair: 0x7a4a24, skin: 0xffdcbc, shirt: 0xf28cb8, pants: 0xf28cb8 }, outfit: 'beginner', gear: [] },
  athena: { look: { hairStyle: 'rogue', hair: 0xf1c34e, skin: 0xffdcbc, shirt: 0x58b04a, pants: 0x2f6a38 }, outfit: 'bowman' },
  balrog: { look: { hairStyle: 'barbarian', hair: 0x2a2220, skin: 0xa8673c, shirt: 0x7a5232, pants: 0x464a5a }, outfit: 'warrior', gear: ['2H_Sword'] },
  grendel: { look: { hairStyle: 'mage', hair: 0xe8e8f0, skin: 0xf6c79e, shirt: 0x3d6fd1, pants: 0x2a2a30 }, outfit: 'magician' },
  darklord: { look: { hairStyle: 'hooded', hair: 0x2a2220, skin: 0xd9a273, shirt: 0x2a2a30, pants: 0x2a2a30 }, outfit: 'thief' },
};
export const NPC_IDS = Object.keys(NPCS);

export function buildNpc(id) {
  const d = NPCS[id];
  const look = { ...normalizeLook(d.look), ...d.look };
  const holder = new THREE.Group();
  holder.scale.setScalar(lib.scale);
  const root = assemble(look, d.outfit, d.gear ?? []);
  const anim = animator(root, d.outfit);
  holder.add(root);
  return { object3d: holder, height: HEIGHT, animate: (...a) => anim.animate(...a), attack: id2 => anim.attack(id2), hit: () => anim.hit(), cheer: () => anim.cheer() };
}

/**
 * A KayKit prop at game scale. Returns { object3d, collider } where the collider
 * is a circle covering `solid` of the footprint (trees: just the trunk).
 */
export function prop(name, { scale = 1, solid = 0.8, shadow = true, platform = false } = {}) {
  const o = lib.props[name].clone();
  o.scale.setScalar(PROP_SCALE * scale);
  o.traverse(m => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.z) / 2 * solid;
  // platform: something you can jump onto and stand on (logs, low rocks) instead of a wall
  if (platform) return { object3d: o, collider: null, platform: { hw: size.x / 2 * 0.95, hd: size.z / 2 * 0.95, top: size.y }, height: size.y };
  return { object3d: o, collider: solid > 0 ? { type: 'circle', r } : null, height: size.y };
}


// ---------------------------------------------------------------- skeletons

const SKELETON = {
  skeletonMinion: { base: 'Skeleton_Minion', weapon: ['Knight', '1H_Sword'], attack: '1H_Melee_Attack_Chop', scale: 1.0 },
  skeletonWarrior: { base: 'Skeleton_Warrior', weapon: ['Barbarian', '1H_Axe'], offhand: ['Barbarian', 'Barbarian_Round_Shield'], attack: '1H_Melee_Attack_Slice_Diagonal', scale: 1.12 },
  skeletonMage: { base: 'Skeleton_Mage', weapon: ['Mage', '2H_Staff'], attack: 'Spellcast_Shoot', scale: 1.05 },
};

/** Copies a weapon node from another KayKit character into this skeleton's hand slot. */
function attachGear(root, [from, name], slot) {
  let src = null;
  lib.gltf[from].scene.traverse(o => { if (o.name === name) src = o; });
  let bone = null;
  // GLTFLoader strips the dot from bone names: handslot.r -> handslotr
  const want = slot.replace('.', '');
  root.traverse(o => { if (o.name === slot || o.name === want) bone = o; });
  if (!src || !bone) return;
  const g = src.clone(true);
  g.visible = true;
  g.traverse(o => { o.visible = true; if (o.isMesh) o.castShadow = true; });
  bone.add(g);
}

/** A KayKit skeleton as a MobModel: { object3d, height, radius, hop, dead, animate(state), hit(), lunge() }. */
export function buildSkeletonMob(id) {
  const d = SKELETON[id];
  const holder = new THREE.Group();
  holder.scale.setScalar(lib.scale * d.scale);
  const root = cloneSkinned(lib.gltf[d.base].scene);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); } });
  attachGear(root, d.weapon, 'handslot.r');
  if (d.offhand) attachGear(root, d.offhand, 'handslot.l');
  holder.add(root);

  const mixer = new THREE.AnimationMixer(root);
  const act = n => mixer.clipAction(lib.clips[n]);
  let base = act('Idle'); base.play();
  let baseName = 'Idle', shot = null, shotLeft = 0, dieT = -1, mats = null;
  const setBase = (n, ts = 1) => {
    if (baseName === n) return;
    const a = act(n); a.reset().fadeIn(0.2).play(); a.timeScale = ts;
    base.fadeOut(0.2); base = a; baseName = n;
  };
  const once = (n, len) => {
    const a = act(n); if (shot && shot !== a) shot.fadeOut(0.1);
    a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    a.timeScale = lib.clips[n].duration / len; a.fadeIn(0.08).play();
    shot = a; shotLeft = len;
  };
  const flash = { v: 0 };
  const lit = []; root.traverse(o => { if (o.material?.emissive) lit.push(o.material); });
  return {
    object3d: holder, height: HEIGHT * d.scale, radius: 0.55 * d.scale, hop: 0,
    get dead() { return dieT > 1.6; },
    animate(state, dt) {
      if (state === 'die') {
        if (dieT < 0) {
          dieT = 0;
          const a = act('Death_A'); a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.fadeIn(0.1).play();
          base.fadeOut(0.1); if (shot) shot.fadeOut(0.1);
          mats = []; root.traverse(o => { if (o.material) { o.material.transparent = true; o.material.needsUpdate = true; mats.push(o.material); } });
        }
        dieT += dt;
        if (dieT > 1.0) mats.forEach(m => { m.opacity = Math.max(0, 1 - (dieT - 1.0) / 0.6); });
      } else {
        setBase(state === 'move' ? 'Walking_A' : 'Idle', state === 'move' ? 1.1 : 1);
        if (shot) { shotLeft -= dt; if (shotLeft <= 0.1) { shot.fadeOut(0.15); shot = null; } }
      }
      flash.v = Math.max(0, flash.v - dt * 4);
      if (!mats) for (const m of lit) m.emissive.setRGB(0.5 * flash.v, 0.15 * flash.v, 0.1 * flash.v);
      mixer.update(dt);
    },
    hit() { flash.v = 1; if (dieT < 0) once(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', 0.35); },
    lunge() { if (dieT < 0) once(d.attack, 0.55); },
  };
}
