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
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
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

export class ShipPreview {
  // drag: the player can spin the pod with a finger. zoom: >1 frames the pod larger.
  constructor(canvas, { spin = 0.7, pitch = 0.32, drag = false, zoom = 1 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spin = spin;
    this.scene = new THREE.Scene();
    this.scene.background = null;   // transparent: the theme's CSS backdrop shows through
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
    this.zoom = zoom;
    this.spinVel = 0;       // extra spin from a flick, decays back to the idle turntable
    this.dragging = false;
    if (drag) this._enableDrag();
  }

  // Drag horizontally to turn the pod; a flick keeps it spinning for a moment.
  _enableDrag() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    let lastX = 0, lastT = 0;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true; lastX = e.clientX; lastT = performance.now();
      this.spinVel = 0;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const d = dx * 0.012;
      this.angle += d;
      this.spinVel = d / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX; lastT = now;
    });
    const end = () => { this.dragging = false; this.spinVel = Math.max(-12, Math.min(12, this.spinVel)); };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
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
    // Framing was tuned for a wide (2:1) preview; tall canvases pull the camera back to keep the pod whole.
    const fit = Math.max(1, 1.12 / Math.max(0.3, this.camera.aspect));
    const want = (c.wings || c.pet ? 8.4 : c.hat ? 6.6 : 5.7) * fit / this.zoom;
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
    if (!this.dragging) {
      this.spinVel *= Math.exp(-dt * 2.5);
      this.angle += dt * (this.spin * spinK + this.spinVel);
    }
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
