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

  // Game-feel time controls: hit stop freezes the simulation for a few
  // frames; slow motion scales time down (level up).
  let freeze = 0, slowScale = 1, slowFor = 0;

  /** render=false lets tests advance the simulation quickly. */
  function tick(rawDt, render = true) {
    const real = Math.min(Math.max(rawDt, 0), MAX_DT);
    let dt = real;
    if (freeze > 0) { freeze -= real; dt = 0; }
    else if (slowFor > 0) { slowFor -= real; dt *= slowScale; }
    elapsed += dt;
    for (const fn of frameFns) fn(dt, elapsed, real);
    if (render) renderer.render(scene, camera);
  }

  // Adaptive resolution: step the render scale down when the phone cannot
  // hold 45 fps for 3 s in a row.
  const SCALES = [1, 0.8, 0.65];
  let slowFrames = 0, fpsAvg = 60;
  function adapt(rawDt) {
    if (rawDt <= 0 || rawDt > 0.5) return;
    fpsAvg += (1 / rawDt - fpsAvg) * 0.1;
    slowFrames = fpsAvg < 45 ? slowFrames + rawDt : 0;
    const i = SCALES.indexOf(scale);
    if (slowFrames > 3 && i < SCALES.length - 1) { scale = SCALES[i + 1]; slowFrames = 0; resize(); }
  }

  function loop() {
    const now = performance.now() / 1000;
    adapt(now - last);
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
    hitStop(sec) { freeze = Math.max(freeze, sec); },
    slowMo(k, sec) { slowScale = k; slowFor = sec; },
    get frozen() { return freeze > 0; },
    get timeScale() { return freeze > 0 ? 0 : slowFor > 0 ? slowScale : 1; },
  };
}
