import * as THREE from 'three';
import { CONFIG } from './config.js';

export const BG_COLOR = new THREE.Color(0x05060f);

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality === 'high' && window.devicePixelRatio < 2,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setClearColor(BG_COLOR, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  setQualityPixelRatio(renderer, quality);

  const scene = new THREE.Scene();
  scene.background = BG_COLOR;
  scene.fog = new THREE.Fog(BG_COLOR, 45, 135);

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 400);
  const rig = { basePos: new THREE.Vector3(), lookAt: new THREE.Vector3(0, 0, -14), baseFov: 65 };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;

    // Keep the whole play field visible on narrow portrait screens by
    // widening FOV a bit and pulling the camera back as needed.
    rig.baseFov = aspect < 1 ? 72 : 60;
    const visibleHalf = CONFIG.halfWidth + 1.1;
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(rig.baseFov / 2)) * aspect);
    const dist = Math.max(7.5, visibleHalf / Math.tan(hHalf));
    rig.basePos.set(0, 1.2 + dist * 0.3, dist);
    camera.fov = rig.baseFov;
    camera.updateProjectionMatrix();
  }
  resize();

  return { renderer, scene, camera, rig, resize };
}

export function setQualityPixelRatio(renderer, quality) {
  const cap = quality === 'high' ? CONFIG.maxPixelRatio : CONFIG.lowPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
}
