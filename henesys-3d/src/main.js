// Boot and game loop: maps, player, NPC taps, portals.
import * as THREE from 'three';
import { createEngine } from './engine.js';
import { createInput } from './input.js';
import { Player } from './entities/player.js';
import { newCharacter, advance } from './rules/stats.js';
import { buildPlayer } from './assets/characters.js';
import { buildHenesys } from './world/henesys.js';
import { dialogOpen } from './dialog.js';
import { TALK_RANGE } from './entities/npc.js';

const engine = createEngine(document.getElementById('game'));
const input = createInput(document.getElementById('app'));

const game = {
  character: newCharacter('Beginner', 0),
  advance(job) {
    if (advance(game.character, job)) player.model.setWeapon(job);
  },
};

const builders = { henesys: () => buildHenesys(game) };
const maps = {};
let map = null;

const player = new Player(game.character, buildPlayer(game.character.look, game.character.job));

function enterMap(id, at) {
  map = maps[id] ??= builders[id]();
  map.scene.add(player.object3d);
  const p = at ?? map.spawn;
  player.place(p.x, p.z, map);
  engine.setScene(map.scene);
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
      enterMap(p.to, p.arrive);
      return;
    }
  }
}

engine.onFrame((dt, t) => {
  input.poll();
  if (dialogOpen()) { input.move.x = 0; input.move.y = 0; input.clear(); }
  player.update(dt, input, map, t);
  for (const n of map.npcs ?? []) n.update(dt, t, player);
  handleTap();
  checkPortals();
  map.animate?.(t, engine.camera);
  if (map.sun) {
    map.sun.position.set(player.position.x + 6, player.position.y + 12, player.position.z + 8);
    map.sun.target.position.copy(player.position);
  }
  player.updateCamera(engine.camera, input, dt);
});

enterMap('henesys');
engine.start();

window.__game = { engine, input, player, game, enterMap, get map() { return map; } };
