import * as THREE from 'three';
import { CONFIG } from './config.js';

// Scrolling starfield, neon grid floor and side rails. All motion happens in
// shaders driven by a single "distance travelled" uniform → almost free on the CPU.
export class Environment {
  constructor(scene, starCount) {
    this.distance = 0;
    this.scene = scene;
    this.warp = 0;

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
        uTint: { value: new THREE.Color(0xbfd6ff) },
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
        uniform vec3 uTint;
        varying float vA;
        varying float vSeed;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c)) * vA;
          vec3 col = mix(uTint, vec3(1.0, 0.85, 0.95), step(0.8, vSeed));
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

    // ---- Galaxy backdrop planet (banded gradient + fresnel rim + ring) ----
    this.planetMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: new THREE.Color(0x2fd6c3) }, uB: { value: new THREE.Color(0x1b2f7a) }, uTime: { value: 0 } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vP;
        void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uA, uB; uniform float uTime;
        varying vec3 vN; varying vec3 vP;
        void main() {
          float bands = 0.5 + 0.5 * sin(vP.y * 9.0 + sin(vP.x * 3.0 + uTime * 0.1) * 1.5);
          vec3 col = mix(uB, uA, bands * 0.6 + 0.4 * smoothstep(-1.0, 1.0, vP.y));
          float light = clamp(dot(vN, normalize(vec3(0.6, 0.5, 0.6))) * 0.8 + 0.3, 0.08, 1.0);
          float rim = pow(1.0 - abs(vN.z), 3.0);
          gl_FragColor = vec4(col * light + uA * rim * 0.8, 1.0);
        }`,
      fog: false,
    });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.planetMat);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.1, 48), this.ringMat);
    ring.rotation.x = -Math.PI / 2.4;
    this.planet.add(ring);
    this.planet.position.set(-70, 36, -260);
    this.planet.scale.setScalar(30);
    this.planet.renderOrder = -1;
    scene.add(this.planet);

    // ---- Hyperspace streaks (only visible while warping) ----
    const N = 260;
    const lp = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 26;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.7 + 3;
      const z = -Math.random() * 300;
      lp.set([x, y, z, x, y, z], i * 6);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const idx = new Float32Array(N * 2);
    for (let i = 0; i < N * 2; i++) idx[i] = i % 2;
    lg.setAttribute('tail', new THREE.BufferAttribute(idx, 1));
    lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.warpMat = new THREE.ShaderMaterial({
      uniforms: { uDist: { value: 0 }, uWarp: { value: 0 }, uTint: { value: new THREE.Color(0xbfe6ff) } },
      vertexShader: /* glsl */`
        attribute float tail;
        uniform float uDist, uWarp;
        varying float vA;
        void main() {
          vec3 p = position;
          p.z = mod(p.z + uDist * 3.0, 300.0) - 290.0 - tail * uWarp * 40.0;
          vA = smoothstep(-290.0, -120.0, p.z) * uWarp * (1.0 - tail * 0.8);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTint; varying float vA;
        void main() { gl_FragColor = vec4(uTint * vA, vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.warpLines = new THREE.LineSegments(lg, this.warpMat);
    this.warpLines.frustumCulled = false;
    this.warpLines.visible = false;
    scene.add(this.warpLines);

    this._target = null;
    this._tmpC = new THREE.Color();
  }

  // Tween the whole look to a galaxy's palette. `instant` for the first frame / menu.
  setTheme(g, instant = false) {
    this._target = {
      floor: new THREE.Color(g.colors.floor), lane: new THREE.Color(g.colors.lane),
      horizon: new THREE.Color(g.colors.horizon), bg: new THREE.Color(g.colors.bg), star: new THREE.Color(g.colors.star),
      pa: new THREE.Color(g.planet.a), pb: new THREE.Color(g.planet.b), ring: new THREE.Color(g.planet.ring),
    };
    this.planetSpec = g.planet;
    if (instant) {
      this._applyTheme(1);
      this.planet.position.set(g.planet.x, g.planet.y, -260);
      this.planet.scale.setScalar(g.planet.size);
    }
  }

  _applyTheme(k) {
    const t = this._target;
    if (!t) return;
    const u = this.floorMat.uniforms;
    u.uColor.value.lerp(t.floor, k);
    u.uColor2.value.lerp(t.lane, k);
    this.horizonMat.uniforms.uColor.value.lerp(t.horizon, k);
    this.starMat.uniforms.uTint.value.lerp(t.star, k);
    this.planetMat.uniforms.uA.value.lerp(t.pa, k);
    this.planetMat.uniforms.uB.value.lerp(t.pb, k);
    this.ringMat.color.lerp(t.ring, k);
    const bg = this.scene.background;
    bg.lerp(t.bg, k);
    this.scene.fog.color.copy(bg);
  }

  setViewportHeight(px) {
    this.starMat.uniforms.uScale.value = px;
  }


  update(dt, realDt, speed, speedNorm) {
    this.distance += speed * dt;
    this.starMat.uniforms.uDist.value = this.distance;
    this.starMat.uniforms.uSpeed.value = speedNorm;
    this.starMat.uniforms.uTime.value += realDt;
    this.floorMat.uniforms.uDist.value = this.distance;
    const p = this.floorMat.uniforms.uPulse;
    p.value = Math.max(0, p.value - realDt * 2.5);

    this._applyTheme(1 - Math.exp(-realDt * 1.8));
    this.planetMat.uniforms.uTime.value += realDt;
    this.planet.rotation.y += realDt * 0.02;
    if (this.planetSpec) {
      // Planet drifts in from far away as you enter a galaxy.
      const tp = this.planet.position;
      tp.x += (this.planetSpec.x - tp.x) * (1 - Math.exp(-realDt * 0.8));
      tp.y += (this.planetSpec.y - tp.y) * (1 - Math.exp(-realDt * 0.8));
      const sc = this.planet.scale.x + (this.planetSpec.size - this.planet.scale.x) * (1 - Math.exp(-realDt * 0.8));
      this.planet.scale.setScalar(sc);
    }

    this.warpMat.uniforms.uDist.value = this.distance;
    this.warpMat.uniforms.uWarp.value = this.warp;
    this.warpLines.visible = this.warp > 0.01;
    this.starMat.uniforms.uSpeed.value = speedNorm + this.warp * 4;
  }

  // Hyperspace: planet shrinks away while streaks stretch past.
  hidePlanet() {
    this.planet.scale.setScalar(0.01);
    this.planet.position.set(0, 10, -260);
  }

  pulse(v = 1) {
    this.floorMat.uniforms.uPulse.value = v;
  }
}
