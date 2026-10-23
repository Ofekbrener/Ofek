// Builds henesys-3d/assets/ from the KayKit CC0 packs on GitHub.
//   cd henesys-3d/tools && npm install && npm run assets
// Characters lose their (duplicated) animations; one shared anims.glb keeps
// the clips the game plays; props are converted from .gltf to .glb.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize } from '@gltf-transform/functions';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, '.cache');
const OUT = path.resolve(HERE, '../assets');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const PACKS = {
  adv: { repo: 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0', dir: 'addons/kaykit_character_pack_adventures/Characters/gltf' },
  hex: { repo: 'KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0', dir: 'addons/kaykit_medieval_hexagon_pack/Assets/gltf' },
  skel: { repo: 'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0', dir: 'addons/kaykit_character_pack_skeletons/Characters/gltf' },
  platformer: { repo: 'KenneyNL/Starter-Kit-3D-Platformer', dir: 'sounds' },
  city: { repo: 'KenneyNL/Starter-Kit-City-Builder', dir: 'sounds' },
};

export const SKELETONS = ['Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Mage'];
// Kenney Starter Kit sounds (MIT). [pack, file, output name, seconds to keep]
export const SOUNDS = [
  ['platformer', 'jump.ogg', 'jump'], ['platformer', 'land.ogg', 'land'], ['platformer', 'walking.ogg', 'step'],
  ['platformer', 'coin.ogg', 'coin'], ['city', 'ambience.ogg', 'ambience', 40],
];

export const CHARACTERS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
export const CLIPS = [
  'Idle', '2H_Melee_Idle', 'Unarmed_Idle', 'Walking_A', 'Walking_B', 'Walking_Backwards', 'Running_A', 'Running_B',
  'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Cheer', 'Interact', 'PickUp', 'Use_Item',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab',
  '1H_Ranged_Aiming', '1H_Ranged_Shoot', '2H_Ranged_Shoot', 'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Throw',
  'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick', 'Block',
];
export const PROPS = {
  'decoration/nature': ['tree_single_A', 'tree_single_B', 'trees_A_small', 'trees_A_medium', 'trees_B_small', 'trees_B_medium', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E', 'cloud_big', 'cloud_small'],
  'decoration/props': ['barrel', 'crate_A_big', 'crate_A_small', 'crate_B_big', 'sack', 'tent', 'target', 'flag_red', 'flag_green', 'flag_blue', 'flag_yellow', 'weaponrack', 'wheelbarrow', 'bucket_arrows', 'resource_lumber'],
};

function fetchPack({ repo, dir }, name) {
  const dest = path.join(CACHE, name);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(CACHE, { recursive: true });
    execSync(`git clone -q --depth 1 --filter=blob:none --sparse https://github.com/${repo} ${dest}`, { stdio: 'inherit' });
    execSync(`git -C ${dest} sparse-checkout set ${dir}`, { stdio: 'inherit' });
  }
  return path.join(dest, dir);
}

// Disposing an Animation leaves its samplers (and their accessors) alive, so free the
// samplers explicitly; prune() then drops accessors nothing references any more.
function disposeAnimation(a) {
  for (const s of a.listSamplers()) s.dispose();
  for (const c of a.listChannels()) c.dispose();
  a.dispose();
}
const dropAnimations = doc => doc.getRoot().listAnimations().forEach(disposeAnimation);

const findFile = (root, name) => {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) { const hit = findFile(p, name); if (hit) return hit; }
    else if (e.name === name) return p;
  }
  return null;
};

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'chars'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'props'), { recursive: true });

  const adv = fetchPack(PACKS.adv, 'adv');
  for (const n of CHARACTERS) {
    const doc = await io.read(path.join(adv, `${n}.glb`));
    dropAnimations(doc);
    await doc.transform(prune(), dedup(), quantize({ pattern: /^(NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/, quantizeNormal: 8, quantizeTexcoord: 12 }));
    await io.write(path.join(OUT, 'chars', `${n}.glb`), doc);
  }

  // One shared clip file: keep the skeleton nodes, drop meshes, materials and unused clips.
  const anim = await io.read(path.join(adv, 'Knight.glb'));
  const root = anim.getRoot();
  root.listAnimations().forEach(a => { if (!CLIPS.includes(a.getName())) disposeAnimation(a); });
  root.listNodes().forEach(nd => nd.setMesh(null).setSkin(null));
  root.listMeshes().forEach(m => m.dispose());
  root.listSkins().forEach(s => s.dispose());
  await anim.transform(resample({ tolerance: 1e-3 }), prune({ keepLeaves: true }), dedup());
  await io.write(path.join(OUT, 'anims.glb'), anim);

  const skel = fetchPack(PACKS.skel, 'skel');
  for (const n of SKELETONS) {
    const doc = await io.read(path.join(skel, `${n}.glb`));
    dropAnimations(doc);
    await doc.transform(prune(), dedup(), quantize({ pattern: /^(NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/, quantizeNormal: 8, quantizeTexcoord: 12 }));
    await io.write(path.join(OUT, 'chars', `${n}.glb`), doc);
  }

  // sounds: ogg -> mono mp3 so iPhones can play them too
  fs.mkdirSync(path.join(OUT, 'sfx'), { recursive: true });
  const sfxDirs = { platformer: fetchPack(PACKS.platformer, 'platformer'), city: fetchPack(PACKS.city, 'city') };
  for (const [pack, file, name, secs] of SOUNDS) {
    const t = secs ? `-t ${secs} -af "afade=t=out:st=${secs - 2}:d=2"` : '';
    execSync(`ffmpeg -loglevel error -y -i ${path.join(sfxDirs[pack], file)} ${t} -ac 1 -ar 44100 -b:a ${secs ? 48 : 64}k ${path.join(OUT, 'sfx', name + '.mp3')}`);
  }
  // sounds made with ElevenLabs live in tools/sfx-src/*.mp3 and are copied as they are
  const extra = path.join(HERE, 'sfx-src');
  if (fs.existsSync(extra)) for (const f of fs.readdirSync(extra)) if (f.endsWith('.mp3')) fs.copyFileSync(path.join(extra, f), path.join(OUT, 'sfx', f));

  const hex = fetchPack(PACKS.hex, 'hex');
  for (const list of Object.values(PROPS)) for (const n of list) {
    const file = findFile(hex, `${n}.gltf`);
    if (!file) throw new Error('missing prop ' + n);
    const doc = await io.read(file);
    await doc.transform(prune(), dedup(), quantize({ pattern: /^(NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/, quantizeNormal: 8, quantizeTexcoord: 12 }));
    await io.write(path.join(OUT, 'props', `${n}.glb`), doc);
  }

  fs.writeFileSync(path.join(OUT, 'CREDITS.md'), `# Asset credits

All models, textures and animations in this folder come from **KayKit** by Kay Lousberg (https://kaylousberg.com).
They are licensed CC0 1.0 Universal (public domain). Attribution is not required but given gladly.

- KayKit Character Pack: Adventures 1.0 (chars/, anims.glb)
- KayKit Medieval Hexagon Pack 1.0 (props/)
- KayKit Character Pack: Skeletons 1.0 (chars/Skeleton_*.glb)

Sounds in sfx/:
- jump, land, step, coin, ambience: Kenney Starter Kits (https://github.com/KenneyNL), MIT License, Copyright (c) 2023 Kenney.
- Any other sfx/*.mp3: generated for this game with ElevenLabs sound effects.

Rebuild with \`cd henesys-3d/tools && npm install && npm run assets\`.
`);

  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const total = walk(OUT).reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(`assets: ${walk(OUT).length} files, ${(total / 1048576).toFixed(2)} MB`);
  if (total > 6 * 1048576) { console.error('over the 6 MB budget'); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
