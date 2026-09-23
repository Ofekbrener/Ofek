import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  createSky, createHero, applyHero, createWeather, applyWeatherStyle, createPropMaterial, propGeometry, toSRGB, setStyle,
} from './worlds.js';

const HERO_Z = -300;
const PROP_NEAR = 16;     // recycle props once they pass the camera
const PROP_SPAN = 195;    // spread from PROP_NEAR back to -179
const MAX_PROPS = [16, 12];
const FADE_OUT = 0.35;    // seconds: old world's style fades out…
const FADE_IN = 1.1;      // …then the new one fades in

// The whole galaxy "world": sky dome, styled floor, hero backdrop, starfield,
// streaming roadside props and ambient weather. Almost all motion happens in
// shaders driven by a "distance travelled" uniform → nearly free on the CPU.
// On a galaxy change colours/fog/lights tween continuously, while discrete
// styles (floor pattern, hero, props, weather shape) fade out → swap → fade in.
export class Environment {
  constructor(scene, starCount) {
    this.distance = 0;
    this.scene = scene;
    this.warp = 0;

    // ---- Sky dome (gradient + nebula + hero glow), replaces the flat background ----
    this.sky = createSky(360);
    this.skyU = this.sky.material.uniforms;
    scene.add(this.sky);

    // ---- Stars (stretched into streaks at high speed) ----
    const RANGE = 320;
    const pos = new Float32Array(starCount * 3);
    const tw = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      let x, y;
      do {
        x = (Math.random() * 2 - 1) * 90;
        y = Math.random() * 68 + 2;
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

    // ---- Styled floor: dark ground + per-world glowing pattern + lane edges ----
    // Premultiplied output: the ground tint occludes the sky, the glow is additive.
    const floorGeo = new THREE.PlaneGeometry(120, 260, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, CONFIG.floorY, -110);
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uDist: { value: 0 },
        uColor: { value: new THREE.Color(0x3cf2ff) },
        uColor2: { value: new THREE.Color(0xff3ca8) },
        uGround: { value: new THREE.Color(0x070520) },
        uSkyC: { value: new THREE.Color(0x6a2cd8) },
        uGroundA: { value: 0.55 },
        uHalf: { value: CONFIG.halfWidth + 1.0 },
        uPulse: { value: 0 },
        uTime: { value: 0 },
        uFade: { value: 1 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform float uDist, uHalf, uPulse, uTime, uFade, uGroundA;
        uniform vec3 uColor, uColor2, uGround, uSkyC;
        varying vec3 vWorld;
        float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float line(float v, float w) {
          float f = abs(fract(v) - 0.5);
          float d = fwidth(v);
          return 1.0 - smoothstep(w * 0.5 - d, w * 0.5 + d, 0.5 - f);
        }
        float ridge(float n, float k) { return pow(1.0 - abs(n * 2.0 - 1.0), k); }
        void main() {
          float wz = vWorld.z - uDist;
          vec2 P = vec2(vWorld.x, wz);
          float dist = -vWorld.z;
          float ax = abs(vWorld.x);
          float fade = smoothstep(150.0, 20.0, dist) * smoothstep(-14.0, 2.0, dist + 10.0);
          vec3 g = vec3(0.0);
          // One compiled variant per world style (defines.STYLE): no dead branches per pixel.
#if STYLE == 0
          {                                       // Coop: patchwork farm fields with furrows
            vec2 cell = floor(P / vec2(4.2, 7.0));
            float h = hash21(cell);
            vec3 patchC = mix(uColor, uColor * vec3(1.18, 1.05, 0.62), step(0.55, h));
            patchC = mix(patchC, uColor * vec3(0.78, 0.86, 0.7), step(0.85, h));
            float furrow = line((vWorld.x + h * 3.0) / 0.7, 0.28);
            float seam = max(line(vWorld.x / 4.2, 0.05), line(wz / 7.0, 0.035));
            g = patchC * (0.62 - furrow * 0.12);
            g = mix(g, uGround * 0.8, seam * 0.8);
          }
#elif STYLE == 1
          {                                       // Yolk: golden hex tiles
            vec2 hp = P / 1.7;
            const vec2 s = vec2(1.0, 1.7320508);
            vec4 hC = floor(vec4(hp, hp - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
            vec4 h = vec4(hp - hC.xy * s, hp - (hC.zw + 0.5) * s);
            vec4 hh = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
            float e = 0.5 - max(dot(abs(hh.xy), s * 0.5), abs(hh.x));
            float fw = fwidth(e);
            float edge = 1.0 - smoothstep(0.0, 0.035 + fw, e);
            float rnd = hash21(hh.zw);
            float cell = step(0.72, rnd) * (0.5 + 0.5 * sin(uTime * 1.6 + rnd * 40.0));
            g = uColor * (edge * 0.75 + cell * 0.22 * smoothstep(0.0, 0.3, e) + 0.05);
          }
#elif STYLE == 2
          {                                       // Pan: glowing lava cracks
            vec2 lp = P * vec2(0.2, 0.13);
            float n = vnoise(lp) * 0.65 + vnoise(lp * 2.3 + 7.0) * 0.35;
            float heat = ridge(n, 16.0);
#ifndef LOWQ
            heat += ridge(vnoise(lp * 4.3 + 3.0), 26.0) * 0.45;
#endif
            float pulse = 0.7 + 0.3 * sin(uTime * 2.2 + n * 14.0);
            g = mix(uColor, vec3(1.0, 0.88, 0.5), smoothstep(0.45, 1.0, heat)) * heat * 1.05 * pulse;
            g += uColor * 0.07 * n;
          }
#elif STYLE == 3
          {                                       // Frost: icy sheen + fractures + glints
            vec2 ip = P * 0.12;
            float cr = ridge(vnoise(ip * 1.3), 22.0);
#ifndef LOWQ
            cr += ridge(vnoise(ip * 3.1 + 5.0), 28.0) * 0.6;
#endif
            float sheen = pow(0.5 + 0.5 * sin(vWorld.x * 0.3 + wz * 0.045 + uTime * 0.5), 8.0);
            float fres = smoothstep(8.0, 120.0, dist);
            vec2 gc = floor(P * 1.3);
            float hsh = hash21(gc);
            float glint = step(0.965, hsh) * smoothstep(0.14, 0.0, length(fract(P * 1.3) - 0.5)) * (0.5 + 0.5 * sin(uTime * 7.0 + hsh * 60.0));
            g = uColor * cr * 0.7 + uSkyC * (fres * 0.6 + sheen * 0.22 + 0.06) + vec3(1.0) * glint * 1.3;
          }
#else
          {                                       // Core: pulsing cyber-feather pattern
            float chev = line((wz + ax * 0.9) / 5.0, 0.05);
            float barbs = line((wz * 0.5 + ax * 1.7) / 1.1, 0.04) * smoothstep(uHalf + 0.3, uHalf + 4.0, ax);
            float spine = line(vWorld.x / 3.4, 0.03);
            float run = smoothstep(0.86, 1.0, fract((wz + ax * 0.9) / 24.0 + uTime * 0.7));
            vec2 dp = (fract(P / vec2(1.7, 2.5)) - 0.5) * vec2(1.7, 2.5);
            float dots = smoothstep(0.1, 0.0, length(dp)) * step(0.6, hash21(floor(P / vec2(1.7, 2.5))));
            float breathe = 0.8 + 0.2 * sin(uTime * 3.0);
            g = uColor * (chev * 0.55 + barbs * 0.35 + spine * 0.2 + dots * 0.6) * breathe + uColor2 * chev * run * 1.6;
          }
#endif
          g *= uFade;
          float lane = smoothstep(0.35, 0.0, abs(ax - uHalf));
          g += uColor2 * lane * 1.2 + uColor * uPulse * 0.5;
          float baseA = uGroundA * smoothstep(175.0, 70.0, dist);
          gl_FragColor = vec4(uGround * baseA + g * fade, baseA);
        }`,
      defines: starCount < 1000 ? { STYLE: 0, LOWQ: 1 } : { STYLE: 0 },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    this.floor.renderOrder = -10;
    scene.add(this.floor);

    // ---- Hero backdrop (barn planet / egg sun / pan eclipse / aurora / mothership) ----
    this.hero = createHero();
    this.heroU = this.hero.material.uniforms;
    this.hero.position.set(0, 10, HERO_Z);
    this.heroGrow = 1;
    scene.add(this.hero);

    // ---- Ambient weather ----
    this.weather = createWeather(Math.round(starCount * 0.35));
    this.weather.uniforms.uBox.value.set(46, 22, 90);
    this.weather.uniforms.uCenter.value.set(0, 6, -32);
    scene.add(this.weather.points);

    // ---- Roadside props: two instanced slots whose geometry is swapped per world ----
    this.propMat = createPropMaterial();
    this.propSlots = MAX_PROPS.map((max) => {
      const mesh = new THREE.InstancedMesh(propGeometry('hay'), this.propMat, max);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      const items = [];
      for (let i = 0; i < max; i++) items.push({ x: 0, y: 0, z: 0, s: 1, ry: 0, rx: 0, spin: 0 });
      return { mesh, items, spec: null };
    });
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();

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

    // Tween state
    const C = () => new THREE.Color();
    this._cur = {
      top: C(), horizon: C(), bottom: C(), neb1: C(), neb2: C(), sun: C(),
      fog: C(), ground: C(), floor: C(), lane: C(), star: C(), wc: C(), wc2: C(), lsky: C(), lground: C(), lkey: C(),
    };
    this._num = { density: 0.5, scale: 1, rays: 0, scan: 0, near: 45, far: 140, groundA: 0.5 };
    this._target = null;
    this.world = null;       // world whose discrete style is currently shown
    this._pending = null;    // world waiting for the fade-out to finish
    this.styleFade = 1;
    this._tmpC = new THREE.Color();
  }

  // Tween the whole look to a galaxy's world. `instant` for the first frame / menu.
  setTheme(g, instant = false) {
    const w = g.world;
    const s = w.sky;
    this._target = {
      top: new THREE.Color(s.top), horizon: new THREE.Color(s.horizon), bottom: new THREE.Color(s.bottom),
      neb1: new THREE.Color(s.neb1), neb2: new THREE.Color(s.neb2), sun: new THREE.Color(s.sun),
      fog: new THREE.Color(w.fog.color), ground: new THREE.Color(w.floor.ground),
      floor: new THREE.Color(g.colors.floor), lane: new THREE.Color(g.colors.lane), star: new THREE.Color(g.colors.star),
      wc: new THREE.Color(w.weather.color), wc2: new THREE.Color(w.weather.color2),
      lsky: new THREE.Color(w.light.sky), lground: new THREE.Color(w.light.ground), lkey: new THREE.Color(w.light.key),
      num: { density: s.density, scale: s.scale, rays: s.rays, scan: s.scan, near: w.fog.near, far: w.fog.far, groundA: w.floor.alpha },
    };
    if (instant || !this.world) {
      this._applyTheme(1);
      this._swapStyle(w);
      this._pending = null;
      this.styleFade = 1;
      this.heroGrow = 1;
      this._placeHero(1);
    } else if (w !== this.world) {
      this._pending = w;
    } else {
      this._pending = null;
    }
  }

  _applyTheme(k) {
    const t = this._target;
    if (!t) return;
    const c = this._cur;
    for (const key in c) c[key].lerp(t[key], k);
    const n = this._num;
    for (const key in n) n[key] += (t.num[key] - n[key]) * k;

    const su = this.skyU;
    toSRGB(su.uTop.value, c.top);
    toSRGB(su.uHorizon.value, c.horizon);
    toSRGB(su.uBottom.value, c.bottom);
    toSRGB(su.uNeb1.value, c.neb1);
    toSRGB(su.uNeb2.value, c.neb2);
    toSRGB(su.uSun.value, c.sun);
    su.uDensity.value = n.density;
    su.uScale.value = n.scale;
    su.uRays.value = n.rays;
    su.uScan.value = n.scan;

    const fu = this.floorMat.uniforms;
    toSRGB(fu.uColor.value, c.floor);
    toSRGB(fu.uColor2.value, c.lane);
    toSRGB(fu.uGround.value, c.ground);
    toSRGB(fu.uSkyC.value, c.horizon);
    fu.uGroundA.value = n.groundA;
    this.starMat.uniforms.uTint.value.copy(c.star);
    toSRGB(this.weather.uniforms.uColor.value, c.wc);
    toSRGB(this.weather.uniforms.uColor2.value, c.wc2);
    const pu = this.propMat.uniforms;
    pu.uSky.value.copy(c.lsky);
    pu.uGround.value.copy(c.lground);
    pu.uKey.value.copy(c.lkey);

    // Fog (and the fallback clear colour) blend obstacles into the horizon haze.
    // Built-in materials mix fog after the sRGB conversion, so feed sRGB numbers.
    const fog = this.scene.fog;
    fog.color.copy(c.fog).convertLinearToSRGB();
    fog.near = n.near;
    fog.far = n.far;
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(c.bottom);
  }

  // Discrete per-world switches (done while faded out).
  _swapStyle(w) {
    this.world = w;
    setStyle(this.floorMat, w.style);
    setStyle(this.sky.material, w.style);
    applyHero(this.hero, w);
    applyWeatherStyle(this.weather, w);
    toSRGB(this.weather.uniforms.uColor.value, this._cur.wc.copy(this._target.wc));
    toSRGB(this.weather.uniforms.uColor2.value, this._cur.wc2.copy(this._target.wc2));
    this.propSlots.forEach((slot, i) => {
      const spec = w.props[i];
      slot.spec = spec || null;
      slot.mesh.visible = !!spec;
      if (!spec) return;
      slot.mesh.geometry = propGeometry(spec.kind);
      slot.mesh.count = Math.min(spec.count, slot.items.length);
      for (let j = 0; j < slot.mesh.count; j++) {
        this._respawnProp(slot, slot.items[j], j);
        slot.items[j].z = PROP_NEAR - (j + Math.random() * 0.8) * (PROP_SPAN / slot.mesh.count);
      }
    });
    // Sun glow direction follows the hero.
    this.skyU.uSunDir.value.set(w.hero.x, w.hero.y - 4, HERO_Z).normalize();
  }

  _respawnProp(slot, it, j) {
    const sp = slot.spec;
    const side = j % 2 === 0 ? -1 : 1;
    it.x = side * (sp.x[0] + Math.random() * (sp.x[1] - sp.x[0]));
    it.y = CONFIG.floorY + sp.y[0] + Math.random() * (sp.y[1] - sp.y[0]);
    it.s = sp.s[0] + Math.random() * (sp.s[1] - sp.s[0]);
    const aligned = sp.kind === 'fence' || sp.kind === 'pylon';
    it.ry = aligned ? (Math.random() - 0.5) * 0.15 : Math.random() * Math.PI * 2;
    it.rx = sp.spin ? Math.random() * Math.PI * 2 : 0;
    it.spin = sp.spin ? (Math.random() - 0.5) * 1.6 * sp.spin : 0;
    if (sp.kind === 'spatula') { it.ry = side * 0.4 + (Math.random() - 0.5) * 0.5; it.rx = 0; }
  }

  _placeHero(k) {
    if (!this.world) return;
    const h = this.world.hero;
    const tp = this.hero.position;
    tp.x += (h.x - tp.x) * k;
    tp.y += (h.y - tp.y) * k;
    tp.z = HERO_Z;
  }

  setViewportHeight(px) {
    this.starMat.uniforms.uScale.value = px;
    this.weather.uniforms.uScale.value = px;
  }

  update(dt, realDt, speed, speedNorm) {
    const step = speed * dt;
    this.distance += step;
    this.starMat.uniforms.uDist.value = this.distance;
    this.starMat.uniforms.uTime.value += realDt;
    this.floorMat.uniforms.uDist.value = this.distance;
    const ft = this.floorMat.uniforms.uTime;
    ft.value = (ft.value + realDt) % 1000;
    const p = this.floorMat.uniforms.uPulse;
    p.value = Math.max(0, p.value - realDt * 2.5);

    this._applyTheme(1 - Math.exp(-realDt * 1.8));

    // Style crossfade: fade out → swap → fade in.
    if (this._pending) {
      this.styleFade = Math.max(0, this.styleFade - realDt / FADE_OUT);
      if (this.styleFade === 0) {
        this._swapStyle(this._pending);
        this._pending = null;
        this.heroGrow = Math.min(this.heroGrow, 0.35);
        this.hero.position.set(this.world.hero.x * 0.3, this.world.hero.y * 0.6, HERO_Z);
      }
    } else {
      this.styleFade = Math.min(1, this.styleFade + realDt / FADE_IN);
    }
    const f = this.styleFade;
    const fe = f * f * (3 - 2 * f);
    this.floorMat.uniforms.uFade.value = fe;
    this.weather.uniforms.uFade.value = fe;
    this.propMat.uniforms.uGrow.value = Math.max(0.02, fe);

    // Hero: drifts in and grows as you enter a galaxy; shrinks away during warp.
    const hk = 1 - Math.exp(-realDt * 0.8);
    this.heroGrow += (1 - this.heroGrow) * hk;
    this._placeHero(hk);
    const hu = this.heroU;
    hu.uTime.value = (hu.uTime.value + realDt) % 1000;
    hu.uAlpha.value = fe * (1 - this.warp * 0.6);
    if (this.world) {
      const h = this.world.hero;
      const g = this.heroGrow * (1 - this.warp * 0.5);
      hu.uSize.value.set(h.size * h.asp * g, h.size * g);
    }

    // Sky
    const su = this.skyU;
    su.uTime.value = (su.uTime.value + realDt) % 1000;
    su.uWarp.value = this.warp;

    // Weather: carried by the world + wind.
    const wu = this.weather.uniforms;
    wu.uScroll.value.z = (wu.uScroll.value.z + step) % wu.uBox.value.z;
    this.weather.tick(realDt);

    // Props stream past (CPU matrices for ≤28 instances).
    this.propMat.uniforms.uTime.value = su.uTime.value;
    for (const slot of this.propSlots) {
      if (!slot.spec) continue;
      const mesh = slot.mesh;
      for (let j = 0; j < mesh.count; j++) {
        const it = slot.items[j];
        it.z += step;
        if (it.z > PROP_NEAR) {
          this._respawnProp(slot, it, j);
          it.z -= PROP_SPAN;
        }
        if (it.spin) it.rx += it.spin * dt;
        this._e.set(it.rx, it.ry + (it.spin ? it.rx * 0.6 : 0), 0);
        this._q.setFromEuler(this._e);
        this._v.set(it.x, it.y, it.z);
        this._s.setScalar(it.s);
        this._m4.compose(this._v, this._q, this._s);
        mesh.setMatrixAt(j, this._m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    this.warpMat.uniforms.uDist.value = this.distance;
    this.warpMat.uniforms.uWarp.value = this.warp;
    this.warpLines.visible = this.warp > 0.01;
    this.starMat.uniforms.uSpeed.value = speedNorm + this.warp * 4;
  }

  // Hyperspace / new run: the backdrop starts tiny in the distance and drifts in.
  hidePlanet() {
    this.heroGrow = 0.01;
    this.hero.position.set(0, 10, HERO_Z);
  }

  pulse(v = 1) {
    this.floorMat.uniforms.uPulse.value = v;
  }
}
