// Core: shared state, renderer, helpers, model loading and animated rigs.
'use strict';
const G = {
  player: null, zombies: [], pickups: [], props: [], colliders: [], barrels: [],
  wave: 0, score: 0, coins: 0, kills: 0, combo: 0, comboT: 0,
  hitstop: 0, trauma: 0, timeScale: 1, slowT: 0, flash: 0, hurtFlash: 0,
  state: 'loading', // loading | menu | playing | draft | dead
  cam: {x: 0, z: 0, kx: 0, kz: 0, zoom: 1, zk: 0, roll: 0},
  time: 0, arena: 19,
};
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)], lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2), easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const damp = (k, dt) => 1 - Math.pow(k, dt); // frame-rate independent lerp factor
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const yawFor = a => Math.PI / 2 - a; // Quaternius models face +Z; sim angle a is measured from +X toward +Z

// ---------- renderer ----------
const cv3 = document.getElementById('c3');
const renderer = new THREE.WebGLRenderer({canvas: cv3, antialias: true, powerPreference: 'high-performance'});
// phones and high-DPI screens: plain PCF and a 1024 shadow map (world.js), soft 2048 shadows elsewhere
let LOW_GPU = (devicePixelRatio || 1) > 1.5; try { LOW_GPU = LOW_GPU || matchMedia('(pointer: coarse)').matches; } catch (e) {}
renderer.shadowMap.enabled = true; renderer.shadowMap.type = LOW_GPU ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12); scene.fog = new THREE.Fog(0x070a12, 18, 40);
const camera = new THREE.PerspectiveCamera(45, 1, .1, 200);
let W = 1, H = 1, DPR = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.fov = W < H ? 70 : 45; camera.updateProjectionMatrix();
  if (typeof HUD !== 'undefined') HUD.resize();
}
addEventListener('resize', resize);

// ---------- models ----------
const MODELS = {};
const MODEL_FILES = ['Characters_Matt', 'Zombie_Basic', 'Zombie_Chubby', 'Zombie_Ribcage', 'Zombie_Arm',
  'Barrel', 'Blood_1', 'Blood_2', 'Blood_3', 'CinderBlock', 'Container_Green', 'Container_Red', 'Couch', 'FireHydrant',
  'Pallet', 'Pallet_Broken', 'Pipes', 'PlasticBarrier', 'StreetLights', 'Street_4Way', 'Street_Straight', 'Street_Straight_Crack1',
  'Street_Straight_Crack2', 'Street_T', 'TownSign', 'TrafficBarrier_1', 'TrafficBarrier_2', 'TrafficCone_1', 'TrafficCone_2',
  'TrafficLight_1', 'TrashBag_1', 'TrashBag_2', 'WaterTower', 'Wheels_Stack', 'Chest_Special',
  'Vehicle_Pickup', 'Vehicle_Sports', 'Vehicle_Truck_Armored'];
async function loadModels(onEach) {
  const loader = new THREE.GLTFLoader();
  await Promise.all(MODEL_FILES.map(async n => {
    const txt = await (await fetch('assets/models/' + n + '.json')).text(); // glTF JSON with embedded buffers
    MODELS[n] = await new Promise((res, rej) => loader.parse(txt, '', res, rej));
    MODELS[n].scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    onEach && onEach();
  }));
}
function propClone(name) { const s = MODELS[name].scene.clone(true); return s; }

// An animated character instance with cross-faded clips.
class Rig {
  constructor(name, {tint = null, scale = 1} = {}) {
    const src = MODELS[name];
    this.root = new THREE.Group();     // position + facing
    this.body = new THREE.Group();     // mirroring, tumbling, squash
    this.model = THREE.SkeletonUtils.clone(src.scene);
    this.model.scale.setScalar(scale);
    this.root.add(this.body); this.body.add(this.model);
    this.mats = [];
    this.model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        o.material = o.material.clone(); o.material.emissive = new THREE.Color(0); this.mats.push(o.material);
        if (tint) o.material.color.multiply(new THREE.Color(tint));
      }
    });
    this.bones = {}; this.model.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.mixer = new THREE.AnimationMixer(this.model); this.acts = {};
    for (const c of src.animations) this.acts[c.name] = this.mixer.clipAction(c);
    this.cur = null; this.curName = '';
    scene.add(this.root);
  }
  // play a clip; one-shots clamp on their last frame
  play(name, {fade = .12, loop = true, speed = 1, restart = false} = {}) {
    if (!this.acts[name] && this.alias && this.alias[name]) name = this.alias[name]; // bosses on other bodies map missing clips
    const a = this.acts[name]; if (!a) return null;
    if (this.cur === a && !restart) { a.timeScale = speed; return a; }
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop;
    a.timeScale = speed; a.enabled = true; a.setEffectiveWeight(1);
    if (this.cur && fade > 0) a.crossFadeFrom(this.cur, fade, false); else if (this.cur) this.cur.stop();
    a.play(); this.cur = a; this.curName = name; return a;
  }
  dur(name) { if (!this.acts[name] && this.alias && this.alias[name]) name = this.alias[name]; const a = this.acts[name]; return a ? a.getClip().duration : 1; }
  flash(v, r = 1, g = 1, b = 1) { for (const m of this.mats) m.emissive.setRGB(v * r, v * g, v * b); }
  dispose() { scene.remove(this.root); this.mixer.stopAllAction(); }
}
