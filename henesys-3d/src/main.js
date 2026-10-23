// Boot: engine, input, map, player, frame loop.
import * as THREE from 'three';
import { createEngine } from './engine.js';
import { createInput } from './input.js';
import { Player } from './entities/player.js';
import { newCharacter } from './rules/stats.js';

const engine = createEngine(document.getElementById('game'));
const input = createInput(document.getElementById('app'));

// Temporary test map, replaced by Henesys in a later task.
function buildTestMap() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 10, 4); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x7ccf4e }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshLambertMaterial({ color: 0xc08050 }));
  box.position.set(6, 1.5, -6); scene.add(box);
  const tree = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4), new THREE.MeshLambertMaterial({ color: 0x8a5a30 }));
  tree.position.set(-6, 2, -6); scene.add(tree);
  return {
    id: 'test', scene,
    colliders: [{ type: 'box', x: 6, z: -6, hw: 2, hd: 2 }, { type: 'circle', x: -6, z: -6, r: 1 }],
    bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
    heightFns: [], spawn: { x: 0, z: 0 }, portals: [], npcs: [],
  };
}

function placeholderModel() {
  const object3d = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 12), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  object3d.position.y = 0.8;
  return { object3d, height: 1.6, animate() {} };
}

const map = buildTestMap();
const player = new Player(newCharacter('Player', 0), placeholderModel());
map.scene.add(player.object3d);
player.place(map.spawn.x, map.spawn.z, map);
engine.setScene(map.scene);

engine.onFrame((dt, t) => {
  input.poll();
  player.update(dt, input, map, t);
  player.updateCamera(engine.camera, input, dt);
});
engine.start();

window.__game = { engine, input, player, get map() { return map; } };
