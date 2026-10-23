// Renderer, camera and the frame loop. dt is clamped so a resumed tab
// (one frame of several seconds) cannot teleport anything.
import * as THREE from 'three';

export const MAX_DT = 0.05;

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  let scene = new THREE.Scene();
  const frameFns = [];
  let last = performance.now() / 1000, elapsed = 0, scale = 1;

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * scale);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 50;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  /** render=false lets tests advance the simulation quickly. */
  function tick(rawDt, render = true) {
    const dt = Math.min(Math.max(rawDt, 0), MAX_DT);
    elapsed += dt;
    for (const fn of frameFns) fn(dt, elapsed);
    if (render) renderer.render(scene, camera);
  }

  function loop() {
    const now = performance.now() / 1000;
    tick(now - last);
    last = now;
    requestAnimationFrame(loop);
  }

  return {
    renderer, camera,
    get scene() { return scene; },
    setScene(s) { scene = s; },
    onFrame(fn) { frameFns.push(fn); },
    tick,
    start() { last = performance.now() / 1000; requestAnimationFrame(loop); },
    setScale(s) { scale = s; resize(); },
    get scale() { return scale; },
  };
}
