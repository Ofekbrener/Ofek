import * as THREE from 'three';
import { Ship } from './ship.js';

// Live turntable preview of the player's pod in a small 2D <canvas>.
//
// All previews share ONE lazily-created offscreen WebGLRenderer (a single
// extra GL context no matter how many previews exist). Each frame the preview
// renders its own little scene there and copies the pixels into its 2D canvas
// with drawImage, so the page never holds more than two GL contexts.
//
//   const pv = new ShipPreview(canvasEl);
//   pv.setSkin(prog.skin); pv.setUpgrades(upgradeLevels(prog));
//   pv.start();  …  pv.pop();  …  pv.stop();

let shared;   // undefined = not tried yet, null = WebGL unavailable

function getRenderer() {
  if (shared !== undefined) return shared;
  try {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(1);
    shared = renderer;
  } catch (e) {
    console.warn('Ship preview unavailable', e);
    shared = null;
  }
  return shared;
}

// Opaque void backdrop: black space, faint stars and a dim horizon arc
// (additive flames need something to add onto).
let backdropTex = null;
function backdrop() {
  if (backdropTex) return backdropTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#050508';
  g.fillRect(0, 0, 512, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const r = rnd() < 0.9 ? 0.7 : 1.4;
    g.fillStyle = `rgba(236, 230, 216, ${0.25 + rnd() * 0.6})`;
    g.beginPath(); g.arc(rnd() * 512, rnd() * 256, r, 0, Math.PI * 2); g.fill();
  }
  // Planet limb glowing at the bottom edge.
  const glow = g.createRadialGradient(256, 560, 300, 256, 560, 390);
  glow.addColorStop(0, 'rgba(255, 176, 90, 0)');
  glow.addColorStop(0.78, 'rgba(255, 176, 90, 0.18)');
  glow.addColorStop(0.8, 'rgba(255, 194, 58, 0.55)');
  glow.addColorStop(0.83, 'rgba(255, 176, 90, 0.08)');
  glow.addColorStop(1, 'rgba(255, 176, 90, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#0b0a10';
  g.beginPath(); g.arc(256, 560, 318, 0, Math.PI * 2); g.fill();
  backdropTex = new THREE.CanvasTexture(c);
  backdropTex.colorSpace = THREE.SRGBColorSpace;
  return backdropTex;
}

export class ShipPreview {
  constructor(canvas, { spin = 0.7, pitch = 0.32 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spin = spin;
    this.scene = new THREE.Scene();
    this.scene.background = backdrop();
    this.camera = new THREE.PerspectiveCamera(28, 2, 0.1, 50);
    this.pitch = pitch;
    this.dist = 5.7;
    this._frameCamera(5.7, 0.05);

    this.scene.add(new THREE.HemisphereLight(0xc4dcff, 0x3a1a55, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight(0x7fd8ff, 1.6);
    rim.position.set(-4, 2, -5);
    this.scene.add(key, rim);

    this.ship = new Ship(this.scene);
    this.ship.engineLight.intensity = 4;
    this.ship.model.position.z = -0.3;   // turn around the pod + flame centre
    this.angle = -0.9;
    this.popT = -1;
    this.running = false;
    this._raf = 0;
    this._last = 0;
    this._frame = this._frame.bind(this);
  }

  setSkin(skin) { this.ship.setSkin(skin); }
  setUpgrades(levels) { return this.ship.setUpgrades(levels); }

  // Scale-bounce (after a purchase).
  pop() { this.popT = 0; }

  start() {
    if (this.running) return;
    if (!getRenderer()) { this.canvas.style.display = 'none'; return; }
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    // While the canvas has no size (screen fading in / hidden) just wait; stop() ends the loop.
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this._raf = requestAnimationFrame(this._frame);
    if (w && h) this.render(dt, w, h);
  }

  _frameCamera(dist, y) {
    this.camera.position.set(0, Math.sin(this.pitch) * dist + y, Math.cos(this.pitch) * dist);
    this.camera.lookAt(0, y, 0);
  }

  _frameCamera(dist, y) {
    this.camera.position.set(0, Math.sin(this.pitch) * dist + y, Math.cos(this.pitch) * dist);
    this.camera.lookAt(0, y, 0);
  }

  render(dt = 0, w = this.canvas.clientWidth, h = this.canvas.clientHeight) {
    const renderer = getRenderer();
    if (!renderer || !w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== pw || size.y !== ph) renderer.setSize(pw, ph, false);
    if (this.camera.aspect !== pw / ph) { this.camera.aspect = pw / ph; this.camera.updateProjectionMatrix(); }

    const ship = this.ship;
    // Zoom out when add-ons (wings, pet, hat) make the pod bigger, so nothing is clipped.
    const c = ship.cosmetics || {};
    const want = c.wings || c.pet ? 8.4 : c.hat ? 6.6 : 5.7;
    const k = dt > 0 ? 1 - Math.exp(-dt * 6) : 1;
    this.dist += (want - this.dist) * k;
    this._frameCamera(this.dist, c.hat || c.pet ? 0.35 : 0.05);
    ship.time += dt;
    let spinK = 1;
    let s = 1;
    if (this.popT >= 0) {
      this.popT += dt;
      const e = this.popT;
      s = 1 + 0.3 * Math.exp(-e * 5) * Math.sin(e * 20);
      spinK = 1 + 6 * Math.exp(-e * 4);
      if (e > 1.2) this.popT = -1;
    }
    this.angle += dt * this.spin * spinK;
    ship.group.rotation.y = this.angle;
    ship.group.position.set(0, Math.sin(ship.time * 2) * 0.06, 0);
    ship.group.scale.setScalar(s);
    ship.model.rotation.z = Math.sin(ship.time * 1.3) * 0.08;
    ship.setThrust(1.1 + Math.random() * 0.25);
    ship.animate(dt);

    renderer.render(this.scene, this.camera);
    this.ctx.clearRect(0, 0, pw, ph);
    this.ctx.drawImage(renderer.domElement, 0, 0, pw, ph);
  }
}
