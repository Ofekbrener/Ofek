// Character creator: name, hair style and colour, skin, eyes, shirt, and
// pants or skirt, with a live rotating 3D preview. Resolves { name, look }.
import * as THREE from 'three';
import { buildHero } from './assets/kaykit.js';
import { addDaylight, disposeObject } from './assets/toon.js';
import { HAIR_STYLES, PALETTES, defaultAppearance, randomAppearance } from './rules/appearance.js';

const hex = n => '#' + n.toString(16).padStart(6, '0');
const STYLE_NAMES = { rogue: 'Long', knight: 'Short', mage: 'Neat', barbarian: 'Beard', hooded: 'Hood' };

function swatches(key, list) {
  return `<div class="swatches" data-key="${key}">${list.map(c => `<button class="sw" data-v="${c}" style="background:${hex(c)}" aria-label="${key} ${hex(c)}"></button>`).join('')}</div>`;
}

export function showTitle(root) {
  const look = defaultAppearance();
  const el = document.createElement('div');
  el.className = 'ui title creator';
  el.innerHTML = `
    <div class="logo small"><span>Henesys</span> <em>3D</em></div>
    <div class="stage"><canvas id="t-preview"></canvas><span class="hint">Drag to turn</span></div>
    <div class="card scroll">
      <label for="t-name">Character name</label>
      <input id="t-name" maxlength="12" autocomplete="off" spellcheck="false" placeholder="Beginner">
      <h3>Hair</h3>
      <div class="chips" data-key="hairStyle">${HAIR_STYLES.map(s => `<button class="chip" data-v="${s}">${STYLE_NAMES[s]}</button>`).join('')}</div>
      ${swatches('hair', PALETTES.hair)}
      <h3>Skin</h3>${swatches('skin', PALETTES.skin)}
      <h3>Eyes</h3>${swatches('eyes', PALETTES.eyes)}
      <h3>Shirt</h3>${swatches('shirt', PALETTES.shirt)}
      <h3>Bottom</h3>
      <div class="chips" data-key="bottom"><button class="chip" data-v="pants">Pants</button><button class="chip" data-v="skirt">Skirt</button></div>
      ${swatches('pants', PALETTES.pants)}
      <div class="row"><button class="random" id="t-random">🎲 Random</button><button class="start" id="t-start">Start</button></div>
    </div>
    <p class="fine">Fan project. MapleStory and its characters belong to Nexon.</p>`;
  root.appendChild(el);

  // live preview
  const canvas = el.querySelector('#t-preview');
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { /* preview is optional */ }
  const scene = new THREE.Scene();
  addDaylight(scene);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshToonMaterial({ color: 0x7fcf52 }));
  disc.rotation.x = -Math.PI / 2; scene.add(disc);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.3, 4.4); camera.lookAt(0, 0.9, 0);
  let model = null, yaw = 0.4, spin = 0.5, drag = null, raf = 0, t = 0, last = performance.now();

  function rebuild() {
    if (model) { scene.remove(model.object3d); disposeObject(model.object3d); }
    model = buildHero({ ...look }, 'beginner');
    scene.add(model.object3d);
  }
  function resize() {
    if (!renderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (!drag) yaw += spin * dt;
    model.object3d.rotation.y = yaw;
    model.animate('idle', dt, t, 0);
    renderer?.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag != null) { yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  addEventListener('resize', resize);

  // controls
  function sync() {
    el.querySelectorAll('[data-key]').forEach(group => {
      const key = group.dataset.key;
      group.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', String(look[key]) === b.dataset.v));
    });
  }
  el.querySelectorAll('[data-key]').forEach(group => group.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const key = group.dataset.key;
    look[key] = typeof look[key] === 'number' ? Number(b.dataset.v) : b.dataset.v;
    sync(); rebuild();
  }));
  el.querySelector('#t-random').onclick = () => { Object.assign(look, randomAppearance()); sync(); rebuild(); };

  rebuild(); sync(); resize();
  raf = requestAnimationFrame(frame);

  return new Promise(resolve => {
    el.querySelector('#t-start').onclick = () => {
      const name = el.querySelector('#t-name').value.trim().replace(/[^\w ]/g, '') || 'Beginner';
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      disposeObject(scene);
      renderer?.dispose();
      el.remove();
      resolve({ name, look: { ...look } });
    };
  });
}
