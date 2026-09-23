import * as THREE from 'three';
import { CONFIG } from './config.js';

// Scrolling starfield, neon grid floor and side rails. All motion happens in
// shaders driven by a single "distance travelled" uniform → almost free on the CPU.
export class Environment {
  constructor(scene, starCount) {
    this.distance = 0;

    // ---- Stars (stretched into streaks at high speed) ----
    const RANGE = 320;
    const pos = new Float32Array(starCount * 3);
    const tw = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      let x, y;
      do {
        x = (Math.random() * 2 - 1) * 90;
        y = Math.random() * 70 - 20;
      } while (Math.abs(x) < 7 && y < 4); // keep the flight corridor clear
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = -Math.random() * RANGE;
      tw[i] = Math.random();
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('seed', new THREE.BufferAttribute(tw, 1));
    starGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.starMat = new THREE.ShaderMaterial({
      uniforms: {
        uDist: { value: 0 },
        uScale: { value: 300 },
        uSpeed: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */`
        attribute float seed;
        uniform float uDist, uScale, uSpeed, uTime;
        varying float vA;
        varying float vSeed;
        void main() {
          vec3 p = position;
          p.z = mod(p.z + uDist * (0.6 + seed * 0.4), ${RANGE.toFixed(1)}) - ${(RANGE - 10).toFixed(1)};
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float fade = smoothstep(-${RANGE.toFixed(1)}, -150.0, mv.z) * smoothstep(8.0, -10.0, p.z);
          vA = fade * (0.55 + 0.45 * sin(uTime * (1.0 + seed * 3.0) + seed * 40.0));
          vSeed = seed;
          gl_PointSize = (1.0 + seed * 1.8 + uSpeed * 1.5) * uScale / max(1.0, -mv.z) * 0.12;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        varying float vSeed;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c)) * vA;
          vec3 col = mix(vec3(0.6, 0.8, 1.0), vec3(1.0, 0.75, 0.9), step(0.8, vSeed));
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // ---- Neon grid floor ----
    const floorGeo = new THREE.PlaneGeometry(120, 260, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, CONFIG.floorY, -110);
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uDist: { value: 0 },
        uColor: { value: new THREE.Color(0x3cf2ff) },
        uColor2: { value: new THREE.Color(0xff3ca8) },
        uHalf: { value: CONFIG.halfWidth + 1.0 },
        uPulse: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform float uDist, uHalf, uPulse;
        uniform vec3 uColor, uColor2;
        varying vec3 vWorld;
        float line(float v, float w) {
          float f = abs(fract(v) - 0.5);
          float d = fwidth(v);
          return 1.0 - smoothstep(w * 0.5 - d, w * 0.5 + d, 0.5 - f);
        }
        void main() {
          float gx = line(vWorld.x / 2.0, 0.06);
          float gz = line((vWorld.z - uDist) / 4.0, 0.06);
          float grid = max(gx, gz);
          float dist = -vWorld.z;
          float fade = smoothstep(150.0, 20.0, dist) * smoothstep(-14.0, 2.0, dist + 10.0);
          float lane = smoothstep(0.35, 0.0, abs(abs(vWorld.x) - uHalf));
          vec3 col = uColor * grid * 0.55 + uColor2 * lane * 1.2;
          col += uColor * uPulse * grid;
          float a = clamp((grid * 0.55 + lane) * fade, 0.0, 1.0);
          gl_FragColor = vec4(col * fade, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    scene.add(this.floor);

    // Faint horizon glow
    const glowGeo = new THREE.PlaneGeometry(1000, 80);
    this.horizonMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x6a2cff) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
        void main(){ float a = pow(1.0 - abs(vUv.y - 0.25) * 1.6, 3.0) * 0.55; a = clamp(a, 0.0, 1.0) * smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x); gl_FragColor = vec4(uColor * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const horizon = new THREE.Mesh(glowGeo, this.horizonMat);
    horizon.position.set(0, 12, -200);
    scene.add(horizon);
  }

  setViewportHeight(px) {
    this.starMat.uniforms.uScale.value = px;
  }

  // Shift the neon palette as the player levels up.
  setLevelHue(level) {
    const h = (0.52 + (level - 1) * 0.11) % 1;
    this.floorMat.uniforms.uColor.value.setHSL(h, 1, 0.6);
    this.floorMat.uniforms.uColor2.value.setHSL((h + 0.42) % 1, 1, 0.6);
    this.horizonMat.uniforms.uColor.value.setHSL((h + 0.2) % 1, 0.9, 0.5);
  }

  update(dt, realDt, speed, speedNorm) {
    this.distance += speed * dt;
    this.starMat.uniforms.uDist.value = this.distance;
    this.starMat.uniforms.uSpeed.value = speedNorm;
    this.starMat.uniforms.uTime.value += realDt;
    this.floorMat.uniforms.uDist.value = this.distance;
    const p = this.floorMat.uniforms.uPulse;
    p.value = Math.max(0, p.value - realDt * 2.5);
  }

  pulse(v = 1) {
    this.floorMat.uniforms.uPulse.value = v;
  }
}
