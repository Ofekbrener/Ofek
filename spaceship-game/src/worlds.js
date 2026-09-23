import * as THREE from 'three';

// Per-galaxy "world" building blocks shared by the Dodge environment and the
// race scene: gradient/nebula sky dome, procedural hero backdrop (one billboard
// quad), ambient weather points and instanced roadside props. Everything here
// is one draw call per object and animates on the GPU.

const NOISE = /* glsl */`
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
  }`;

const col = (hex) => new THREE.Color(hex);
// The hero quad is padded so glows fade out well before its edges.
export const HERO_PAD = 1.4;

// Sky/hero/floor/weather shaders skip the per-pixel colour-space conversion, so
// their colour uniforms are fed sRGB numbers: toSRGB(target, hexOrColor).
// Style-specific shader code is selected with a compile-time define so each
// world gets its own lean program (three caches programs, so swapping back is free).
export function setStyle(material, style) {
  if (material.defines.STYLE === style) return;
  material.defines.STYLE = style;
  material.needsUpdate = true;
}

export function toSRGB(target, src) {
  if (typeof src === 'number') target.set(src); else target.copy(src);
  return target.convertLinearToSRGB();
}

// ---------------------------------------------------------------- sky dome
export function createSky(radius) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: col(0x060a2e) }, uHorizon: { value: col(0x6a2cd8) }, uBottom: { value: col(0x0c0620) },
      uNeb1: { value: col(0x2fd6c3) }, uNeb2: { value: col(0xff4fb0) }, uSun: { value: col(0xffffff) },
      uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
      uDensity: { value: 0.5 }, uScale: { value: 1 }, uRays: { value: 0 }, uScan: { value: 0 },
      uTime: { value: 0 }, uWarp: { value: 0 },
    },
    // Colour uniforms hold sRGB values (see toSRGB) so no per-pixel colour-space
    // conversion is needed. The gradient + soft nebula are evaluated per vertex on
    // a dense dome (≈4k verts); per pixel only the hero glow / rays remain, so the
    // full-screen pass stays cheap on mobile.
    vertexShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uBottom, uNeb1, uNeb2;
      uniform float uDensity, uScale, uTime, uWarp;
      varying vec3 vDir;
      varying vec3 vCol;
      ${NOISE}
      void main() {
        vDir = position;
        vec3 d = normalize(position);
        float h = d.y;
        vec3 c = mix(uHorizon, uTop, pow(smoothstep(-0.03, 0.34, h), 0.8));
        c = mix(c, uBottom, smoothstep(0.0, -0.22, h));
        c += uHorizon * exp(-abs(h) * 22.0) * 0.35;
        vec2 uv = vec2(atan(d.x, -d.z) * 1.4, h * 2.6) * 1.6 * uScale;
        uv.y *= 1.0 + uWarp * 3.0;
        float n = fbm3(uv + vec2(uTime * 0.012, uTime * 0.02));
        float n2 = vnoise(uv * 2.7 - vec2(uTime * 0.03, 0.0));
        float neb = smoothstep(1.0 - uDensity * 0.85, 1.05, n + 0.3 * n2);
        c += mix(uNeb1, uNeb2, smoothstep(0.35, 0.75, n2)) * neb * smoothstep(-0.05, 0.3, h) * (0.85 + uWarp * 0.5);
        vCol = c;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;   // pin to the far plane
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uNeb2, uSun, uSunDir;
      uniform float uRays, uScan, uTime;
      varying vec3 vDir;
      varying vec3 vCol;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = vCol;
        float sd = max(dot(d, uSunDir), 0.0);
        c += uSun * pow(sd, 24.0) * 0.35;
#if STYLE == 1
        {                          // god rays (Yolk Belt)
          vec3 r = d - uSunDir * sd;
          float ang = atan(r.y, r.x + r.z * 0.7);
          float rays = (0.5 + 0.5 * sin(ang * 16.0 + uTime * 0.15)) * (0.5 + 0.5 * sin(ang * 7.0 - uTime * 0.1));
          c += uSun * pow(sd, 5.0) * rays * uRays * 0.3;
        }
#elif STYLE == 4
        {                          // cyber scanlines (Omelette Core)
          c += uNeb2 * smoothstep(0.92, 1.0, sin(d.y * 160.0 - uTime * 2.0)) * smoothstep(0.02, 0.4, d.y) * uScan * 0.12;
        }
#endif
        gl_FragColor = vec4(c, 1.0);
      }`,
    defines: { STYLE: 0 },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- hero backdrop
// One camera-facing quad; the fragment shader paints the galaxy's landmark.
// Output is premultiplied alpha so glows add and solid bodies occlude.
export function createHero() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAlpha: { value: 1 }, uAsp: { value: 1.8 },
      uSize: { value: new THREE.Vector2(80, 44) },
      uA: { value: col(0xd8362c) }, uB: { value: col(0xffcf5a) }, uC: { value: col(0x3cf2ff) },
    },
    vertexShader: /* glsl */`
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * uSize * 2.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha, uAsp;
      uniform vec3 uA, uB, uC;
      varying vec2 vUv;
      ${NOISE}
      const vec3 L = vec3(-0.45, 0.55, 0.7);
      const float HERO_PAD = 1.4;
      void over(inout vec4 o, vec3 c, float a) { o.rgb = c * a + o.rgb * (1.0 - a); o.a = a + o.a * (1.0 - a); }
      mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
      float sdEll(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
      float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

      // A band of tumbling rocks on a tilted ellipse (front or back half).
      void rocks(inout vec4 o, vec2 q, float rad, float sq, float cnt, float w, float front, vec3 tint) {
        vec2 rq = rot(0.18) * q;
        vec2 eq = vec2(rq.x, rq.y / sq);
        float step_ = 6.2831 / cnt;
        float ang = atan(eq.y, eq.x) - uTime * w;
        float cell = floor(ang / step_);
        float h1 = hash21(vec2(cell, rad)), h2 = hash21(vec2(rad, cell + 3.1));
        float ca = (cell + 0.5 + (h1 - 0.5) * 0.5) * step_ + uTime * w;
        if (step(0.0, -sin(ca)) != front || h2 < 0.2) return;
        vec2 cp = vec2(cos(ca), sin(ca) * sq) * rad * (0.94 + h1 * 0.12);
        float size = 0.018 + 0.03 * h2;
        float d = length(rq - cp) / size;
        if (d >= 1.0) return;
        vec3 n = vec3((rq - cp) / size, sqrt(1.0 - d * d));
        vec3 c = tint * (0.25 + 0.9 * max(dot(n, normalize(L)), 0.0));
        over(o, c, smoothstep(1.0, 0.8, d) * (front > 0.5 ? 1.0 : 0.8));
      }

      void barn(inout vec4 o, vec2 p) {
        float R = 0.56;
        vec2 q = p - vec2(0.0, 0.02);
        float r = length(q);
        o.rgb += uC * 0.28 * exp(-max(r - R, 0.0) * 5.0);
        vec2 rq = rot(-0.26) * q;
        float e = length(vec2(rq.x, rq.y / 0.24));
        float ring = smoothstep(1.22 * R, 1.26 * R, e) * smoothstep(1.98 * R, 1.93 * R, e);
        ring *= 0.55 + 0.45 * smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(e * 70.0));
        ring *= smoothstep(0.004, 0.02, abs(e - 1.58 * R));
        vec3 rc = uB * (0.75 + 0.35 * vnoise(vec2(e * 90.0, 0.0)));
        if (rq.y > 0.0) over(o, rc, ring * 0.9);
        float d = r / R;
        if (d < 1.0) {
          vec3 n = vec3(q / R, sqrt(1.0 - d * d));
          float lon = atan(n.x, n.z) + uTime * 0.04;
          float f = fract(lon * 3.2);
          float plank = smoothstep(0.0, 0.05, min(f, 1.0 - f));
          vec3 c = uA * (0.8 + 0.25 * vnoise(vec2(lon * 40.0, n.y * 3.0))) * (0.55 + 0.45 * plank);
          // shingled roof cap + white trim
          c = mix(c, vec3(0.28, 0.14, 0.12) * (0.8 + 0.4 * step(0.5, fract(n.x * 12.0 + step(0.5, fract(n.y * 14.0)) * 0.5))), step(0.72, n.y));
          float trim = max(smoothstep(0.035, 0.0, abs(n.y - 0.72)), smoothstep(0.03, 0.0, abs(n.y + 0.52)));
          // barn door with X-brace
          vec2 dq = vec2(n.x, n.y + 0.08);
          float door = step(abs(dq.x), 0.3) * step(abs(dq.y), 0.3);
          float frame = door * (1.0 - step(abs(dq.x), 0.25) * step(abs(dq.y), 0.25));
          float xb = door * max(smoothstep(0.035, 0.0, abs(dq.x - dq.y)), smoothstep(0.035, 0.0, abs(dq.x + dq.y)));
          c = mix(c, c * 0.7, door);
          c = mix(c, vec3(1.0, 0.95, 0.88), max(max(trim, frame), xb));
          float lit = 0.22 + 0.9 * max(dot(n, normalize(L)), 0.0);
          c = c * lit + uC * pow(1.0 - n.z, 3.0) * 0.9;
          over(o, c, smoothstep(1.0, 0.985, d));
        }
        if (rq.y <= 0.0) over(o, rc, ring * 0.95);
      }

      void eggSun(inout vec4 o, vec2 p) {
        vec2 q = p;
        float r = length(q), a = atan(q.y, q.x);
        o.rgb += uA * 0.6 * exp(-r * 2.8) + vec3(1.0, 0.9, 0.6) * 0.25 * exp(-r * 5.0);
        o.rgb += uA * 0.16 * (0.5 + 0.5 * sin(a * 12.0 + uTime * 0.3)) * exp(-r * 2.2);
        vec3 rockC = vec3(0.62, 0.42, 0.26);
        rocks(o, q, 0.95, 0.26, 36.0, 0.05, 0.0, rockC);
        rocks(o, q, 1.25, 0.32, 48.0, -0.035, 0.0, rockC);
        float wr = 0.6 * (1.0 + 0.1 * sin(3.0 * a + 0.7 + uTime * 0.15) + 0.06 * sin(5.0 * a - 1.1) + 0.03 * sin(9.0 * a + uTime * 0.4));
        vec3 wc = mix(vec3(1.0, 0.98, 0.93), vec3(1.0, 0.86, 0.62), smoothstep(0.15, wr, r));
        over(o, wc * 1.05, smoothstep(wr, wr - 0.015, r));
        vec2 yq = q - vec2(0.05, 0.04);
        float yr = length(yq) / 0.29;
        o.rgb += uA * 0.35 * exp(-abs(yr - 1.0) * 10.0) * step(1.0, yr) * smoothstep(wr, wr - 0.02, r);
        if (yr < 1.0) {
          vec3 n = vec3(yq / 0.29, sqrt(1.0 - yr * yr));
          vec3 c = mix(uB, uA * 1.1, n.z * 0.8 + 0.2);
          c += vec3(1.0, 0.95, 0.8) * pow(max(dot(n, normalize(vec3(-0.4, 0.5, 0.8))), 0.0), 24.0) * 0.8;
          over(o, c, smoothstep(1.0, 0.96, yr));
        }
        rocks(o, q, 0.95, 0.26, 36.0, 0.05, 1.0, rockC);
        rocks(o, q, 1.25, 0.32, 48.0, -0.035, 1.0, rockC);
      }

      void panEclipse(inout vec4 o, vec2 p) {
        float R = 0.5;
        vec2 q = p - vec2(-0.18, 0.06);
        float r = length(q);
        vec2 dv = q / max(r, 1e-3);
        float fl = 0.0;
        if (r > R * 0.97 && r < R + 0.6) {   // flames only live in the corona band
          float n1 = fbm3(dv * 2.6 + vec2(uTime * 0.12, -uTime * 0.08));
          float n2 = vnoise(dv * 8.0 + vec2(r * 6.0 - uTime * 2.2, r * 3.0));
          fl = smoothstep(R + 0.06 + 0.42 * n1 * n1 + 0.09 * n2, R, r);
        }
        fl = fl * fl;
        vec3 fc = mix(uB, uA, fl);
        fc = mix(fc, vec3(1.0, 0.95, 0.75), smoothstep(0.7, 1.0, fl));
        o.rgb += fc * fl * 1.8;
        o.rgb += uA * 0.5 * exp(-max(r - R, 0.0) * 4.0);
        // handle
        vec2 hd = normalize(vec2(1.0, -0.42));
        vec2 hn = vec2(-hd.y, hd.x);
        float s = dot(q, hd), t = dot(q, hn);
        float hw = 0.055 + 0.03 * smoothstep(R + 0.2, R + 0.9, s);
        float handle = smoothstep(R * 0.8, R * 0.82, s) * smoothstep(R + 0.98, R + 0.96, s) * smoothstep(hw, hw - 0.006, abs(t));
        handle *= smoothstep(0.03, 0.037, length(vec2(s - (R + 0.84), t)));
        float disk = smoothstep(R, R - 0.006, r);
        float body = max(disk, handle);
        vec3 bc = vec3(0.07, 0.055, 0.06) * (0.85 + 0.15 * sin(r * 140.0));
        bc += fc * smoothstep(R - 0.05, R, r) * disk * 1.3;
        bc += uA * 0.9 * smoothstep(hw - 0.025, hw, abs(t)) * handle * step(R, r);
        bc += vec3(0.15, 0.1, 0.1) * handle * (0.5 + 0.5 * dot(hn, vec2(0.0, 1.0)) * sign(t));
        over(o, bc, body);
        o.rgb += vec3(1.0, 0.95, 0.8) * exp(-length(q - R * vec2(cos(2.2), sin(2.2))) * 30.0) * 1.3;
      }

      void aurora(inout vec4 o, vec2 p) {
        float edge = smoothstep(1.0, 0.6, abs(vUv.x));
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float y0 = -0.05 + fi * 0.2 + 0.16 * sin(p.x * 1.1 + uTime * 0.22 + fi * 2.0) + 0.05 * sin(p.x * 2.9 - uTime * 0.35 + fi);
          float dy = p.y - y0;
          float cur = smoothstep(-0.015, 0.03, dy) * exp(-max(dy, 0.0) * (2.4 + fi));
          if (cur < 0.004) continue;
          float rays = 0.45 + 0.55 * (0.5 + 0.5 * sin(p.x * 23.0 + fi * 7.0 + uTime * 0.7) * sin(p.x * 9.3 - uTime * 0.4 + fi));
          vec3 ac = mix(uA, uB, smoothstep(0.0, 0.45, dy));
          o.rgb += ac * cur * rays * (0.6 - 0.14 * fi) * edge;
        }
        vec2 mq = p - vec2(uAsp * 0.42, -0.34);
        float MR = 0.34;
        float r = length(mq);
        o.rgb += uC * 0.3 * exp(-max(r - MR, 0.0) * 7.0);
        float d = r / MR;
        if (d < 1.0) {
          vec3 n = vec3(mq / MR, sqrt(1.0 - d * d));
          vec3 c = mix(vec3(0.7, 0.85, 1.0), vec3(0.97, 0.99, 1.0), vnoise(n.xy * 4.0 + 2.0));
          c *= 1.0 - 0.28 * smoothstep(0.62, 0.75, vnoise(n.xy * 7.0 + 3.0));
          float rid = 1.0 - abs(vnoise(n.xy * 5.0 + 9.0) * 2.0 - 1.0);
          c = mix(c, vec3(0.45, 0.85, 1.0) * 1.2, pow(rid, 14.0) * 0.8);
          c = c * (0.2 + 0.9 * max(dot(n, normalize(vec3(-0.6, 0.5, 0.6))), 0.0)) + uC * pow(1.0 - n.z, 3.0);
          over(o, c, smoothstep(1.0, 0.985, d));
        }
      }

      void motherHen(inout vec4 o, vec2 p) {
        vec2 q = p - vec2(0.0, 0.12);
        o.rgb += uB * 0.4 * exp(-length(q * vec2(0.6, 1.0)) * 3.2);
        // tractor beam
        float by = -0.36 - q.y;
        float bw = 0.12 + by * 0.4;
        float beam = step(0.0, by) * smoothstep(bw, bw * 0.5, abs(q.x - 0.05)) * smoothstep(0.7, 0.0, by);
        o.rgb += uB * beam * (0.35 + 0.25 * sin(by * 50.0 - uTime * 6.0));
        float sd = sdEll(q, vec2(0.74, 0.34));
        sd = smin(sd, length(q - vec2(0.6, 0.3)) - 0.21, 0.08);
        for (int i = 0; i < 3; i++) sd = min(sd, length(q - vec2(0.5 + float(i) * 0.09, 0.53 + 0.02 * float(i == 1))) - 0.065);
        sd = min(sd, max(q.x - 0.98, max(abs(q.y - 0.3) - (0.98 - q.x) * 0.45, 0.78 - q.x)));
        for (int i = 0; i < 3; i++) {
          float a = 2.1 + float(i) * 0.33;
          vec2 dir = vec2(cos(a), sin(a));
          vec2 tq = q - (vec2(-0.55, 0.1) + dir * 0.28);
          tq = rot(-a) * tq;
          sd = smin(sd, sdEll(tq, vec2(0.3, 0.075)), 0.05);
        }
        sd = smin(sd, sdEll(q - vec2(0.0, -0.28), vec2(1.12, 0.12)), 0.06);
        float fill = smoothstep(0.004, -0.004, sd);
        vec3 bc = vec3(0.07, 0.025, 0.1);
        bc += uA * 0.12 * step(0.88, fract(q.y * 16.0)) * step(-0.2, q.y);
        bc += uB * smoothstep(-0.035, 0.0, sd) * 1.1;
        vec2 wq = vec2((fract(q.x / 0.12) - 0.5) * 0.12, q.y + 0.28);
        float cell = floor(q.x / 0.12);
        float win = smoothstep(0.028, 0.018, length(wq)) * step(abs(q.x), 1.0);
        bc += uC * win * (0.6 + 1.2 * (0.5 + 0.5 * sin(uTime * 4.0 - cell * 0.9)));
        bc += vec3(1.0, 0.25, 0.3) * smoothstep(0.035, 0.02, length(q - vec2(0.66, 0.34))) * 2.0;
        over(o, bc, fill);
        o.rgb += uB * 0.5 * exp(-max(sd, 0.0) * 35.0) * step(0.0, sd);
      }

      void main() {
        if (dot(vUv, vUv) > 1.2) discard;   // skip the empty corners of the padded quad
        vec2 p = vec2(vUv.x * uAsp, vUv.y) * HERO_PAD;
        vec4 o = vec4(0.0);
#if STYLE == 0
        barn(o, p);
#elif STYLE == 1
        eggSun(o, p);
#elif STYLE == 2
        panEclipse(o, p);
#elif STYLE == 3
        aurora(o, p);
#else
        motherHen(o, p);
#endif
        float edge = smoothstep(1.0, 0.72, abs(vUv.x)) * smoothstep(1.0, 0.72, abs(vUv.y));
        gl_FragColor = o * edge * uAlpha;
      }`,
    defines: { STYLE: 0 },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -50;
  return mesh;
}

export function applyHero(mesh, w, sizeMul = 1) {
  const u = mesh.material.uniforms;
  setStyle(mesh.material, w.style);
  u.uAsp.value = w.hero.asp;
  u.uSize.value.set(w.hero.size * w.hero.asp * sizeMul * HERO_PAD, w.hero.size * sizeMul * HERO_PAD);
  toSRGB(u.uA.value, w.hero.a);
  toSRGB(u.uB.value, w.hero.b);
  toSRGB(u.uC.value, w.hero.c);
}

// ---------------------------------------------------------------- weather
// Camera-relative points that wrap inside a box: feathers, dust, embers, snow, sparks.
export function createWeather(count) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random();
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBox: { value: new THREE.Vector3(44, 22, 90) }, uCenter: { value: new THREE.Vector3(0, 4, -30) },
      uScroll: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3() },
      uTime: { value: 0 }, uScale: { value: 300 }, uSize: { value: 2 }, uSway: { value: 0.5 },
      uFade: { value: 1 }, uAlpha: { value: 1 },
      uColor: { value: col(0xffffff) }, uColor2: { value: col(0xffffff) },
    },
    vertexShader: /* glsl */`
      attribute float seed;
      uniform vec3 uBox, uCenter, uScroll, uWind;
      uniform float uTime, uScale, uSize, uSway, uFade, uAlpha;
      varying float vA, vRot, vSeed;
      void main() {
        float f = 0.75 + floor(seed * 4.0) * 0.25;
        vec3 p = position * uBox + uScroll + uWind * f;
        p.x += sin(uTime * (0.5 + seed) + seed * 40.0) * uSway;
        p.z += cos(uTime * (0.4 + seed * 0.7) + seed * 20.0) * uSway * 0.5;
        p = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 q = abs(p - uCenter) / (uBox * 0.5);
        float edge = 1.0 - smoothstep(0.7, 1.0, max(q.x, max(q.y, q.z)));
#if STYLE == 2 || STYLE == 4
        float flick = 0.55 + 0.45 * sin(uTime * (6.0 + seed * 10.0) + seed * 50.0);
#else
        float flick = 1.0;
#endif
        vA = edge * uFade * uAlpha * (0.45 + 0.55 * seed) * flick * smoothstep(1.5, 6.0, -mv.z);
        vRot = seed * 6.2831 + uTime * (seed - 0.5) * 2.5;
        vSeed = seed;
        gl_PointSize = min(uSize * (0.55 + seed * 0.9) * uScale * 0.055 / max(1.0, -mv.z), 56.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uColor2;
      varying float vA, vRot, vSeed;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a;
        vec3 k = mix(uColor, uColor2, step(0.75, vSeed));
#if STYLE == 0
        {                              // feather: long vane with a shaft
          float s = sin(vRot), co = cos(vRot);
          vec2 q = mat2(co, -s, s, co) * c;
          a = smoothstep(0.5, 0.3, length(q * vec2(3.0, 1.05)));
          a *= 1.0 - 0.5 * smoothstep(0.03, 0.0, abs(q.x));
        }
#elif STYLE == 1
        {                              // golden dust: tiny bright core
          float d = length(c);
          a = smoothstep(0.5, 0.0, d) * 0.5 + smoothstep(0.15, 0.0, d);
        }
#elif STYLE == 2
        {                              // ember
          float d = length(c);
          a = smoothstep(0.5, 0.05, d);
          k = mix(k, vec3(1.0, 0.95, 0.7), smoothstep(0.2, 0.0, d));
        }
#elif STYLE == 3
        {                              // snow
          a = smoothstep(0.5, 0.25, length(c));
        }
#else
        {                              // spark: 4-point star
          float s = sin(vRot), co = cos(vRot);
          vec2 q = abs(mat2(co, -s, s, co) * c);
          a = max(smoothstep(0.08, 0.0, q.x) * smoothstep(0.5, 0.0, q.y), smoothstep(0.08, 0.0, q.y) * smoothstep(0.5, 0.0, q.x));
          a = max(a, smoothstep(0.14, 0.0, length(c)));
        }
#endif
        a *= vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(k * a, a);
      }`,
    defines: { STYLE: 0 },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  const wind = new THREE.Vector3();
  return {
    points: pts,
    uniforms: mat.uniforms,
    // Accumulated wind offset, wrapped so that 0.75/1/1.25/1.5 speed variants stay seamless.
    tick(dt) {
      const u = mat.uniforms;
      u.uTime.value += dt;
      if (u.uTime.value > 1000) u.uTime.value -= 1000;
      const w = u.uWind.value, b = u.uBox.value;
      w.addScaledVector(wind, dt);
      w.x %= b.x * 4; w.y %= b.y * 4; w.z %= b.z * 4;
    },
    wind,
  };
}

export function applyWeatherStyle(weather, w) {
  const u = weather.uniforms;
  setStyle(weather.points.material, w.style);
  toSRGB(u.uColor.value, w.weather.color);
  toSRGB(u.uColor2.value, w.weather.color2);
  u.uSize.value = w.weather.size;
  u.uSway.value = w.weather.sway;
  u.uAlpha.value = w.weather.alpha;
  weather.wind.fromArray(w.weather.wind);
}

// ---------------------------------------------------------------- roadside props
function mergeParts(parts) {
  const pos = [], nor = [], colr = [], glow = [];
  const c = new THREE.Color();
  for (const { geo, color, glow: gl = 0, smooth = false } of parts) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!smooth || !g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    c.set(color);
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(n[i], n[i + 1], n[i + 2]);
      colr.push(c.r, c.g, c.b);
      glow.push(gl);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  out.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
  out.computeBoundingSphere();
  return out;
}

function T(geo, s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0]) {
  geo.scale(s[0], s[1], s[2]);
  if (r[0]) geo.rotateX(r[0]);
  if (r[1]) geo.rotateY(r[1]);
  if (r[2]) geo.rotateZ(r[2]);
  geo.translate(p[0], p[1], p[2]);
  return geo;
}

function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const k = 1 + ((h - Math.floor(h)) * 2 - 1) * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return geo;
}

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const PROP_BUILDERS = {
  hay: () => mergeParts([
    { geo: B(1.6, 0.8, 0.9).translate(0, 0.4, -0.5), color: 0xe6bb52, glow: 0.15 },
    { geo: B(1.6, 0.8, 0.9).translate(0.1, 0.4, 0.45), color: 0xd9aa44, glow: 0.15 },
    { geo: B(1.6, 0.8, 0.9).rotateY(0.3).translate(0, 1.2, 0), color: 0xf0cc66, glow: 0.15 },
    { geo: B(0.08, 0.84, 0.94).translate(0.4, 0.4, -0.5), color: 0x8a4a1a },
    { geo: B(0.08, 0.84, 0.94).translate(-0.4, 0.4, -0.5), color: 0x8a4a1a },
    { geo: B(0.08, 0.84, 0.94).translate(0.5, 0.4, 0.45), color: 0x8a4a1a },
    { geo: B(0.08, 0.84, 0.94).translate(-0.3, 0.4, 0.45), color: 0x8a4a1a },
    { geo: B(0.08, 0.84, 0.94).rotateY(0.3).translate(0, 1.2, 0), color: 0x8a4a1a },
  ]),
  fence: () => mergeParts([
    { geo: B(0.2, 1.4, 0.2).translate(0, 0.7, -1.3), color: 0xf4ece0 },
    { geo: B(0.2, 1.4, 0.2).translate(0, 0.7, 1.3), color: 0xf4ece0 },
    { geo: B(0.08, 0.14, 2.8).translate(0, 1.05, 0), color: 0xff3ca8, glow: 1.3 },
    { geo: B(0.08, 0.14, 2.8).translate(0, 0.55, 0), color: 0xff3ca8, glow: 1.3 },
    { geo: T(new THREE.ConeGeometry(0.16, 0.25, 4), [1, 1, 1], [0, Math.PI / 4, 0], [0, 1.52, -1.3]), color: 0x3cf2ff, glow: 1.2 },
    { geo: T(new THREE.ConeGeometry(0.16, 0.25, 4), [1, 1, 1], [0, Math.PI / 4, 0], [0, 1.52, 1.3]), color: 0x3cf2ff, glow: 1.2 },
  ]),
  eggshell: () => mergeParts([
    { geo: T(jitter(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), 0.05), [0.85, 1.1, 0.85]), color: 0xfff1dc, glow: 0.15, smooth: true },
    { geo: T(new THREE.SphereGeometry(0.42, 10, 6), [1, 0.7, 1], [0, 0, 0], [0, -0.55, 0]), color: 0xffb21f, glow: 0.9, smooth: true },
  ]),
  eggrock: () => mergeParts([
    { geo: jitter(new THREE.IcosahedronGeometry(0.8, 1), 0.2), color: 0x8a5a34 },
    { geo: T(new THREE.OctahedronGeometry(0.25), [1, 1.8, 1], [0.3, 0, 0.4], [0.5, 0.45, 0.2]), color: 0xffd23a, glow: 1.2 },
    { geo: T(new THREE.OctahedronGeometry(0.2), [1, 1.6, 1], [-0.5, 0, -0.3], [-0.45, 0.3, -0.35]), color: 0xffd23a, glow: 1.2 },
  ]),
  spatula: () => mergeParts([
    { geo: B(0.16, 3.2, 0.12).translate(0, 1.6, 0), color: 0x2a2a30 },
    { geo: B(0.24, 1.1, 0.18).translate(0, 0.9, 0), color: 0xc8261a, glow: 0.3 },
    { geo: B(1.5, 1.7, 0.08).translate(0, 4.0, 0), color: 0xb8bcc8 },
    { geo: B(0.12, 1.2, 0.1).translate(-0.4, 4.1, 0), color: 0x222226 },
    { geo: B(0.12, 1.2, 0.1).translate(0, 4.1, 0), color: 0x222226 },
    { geo: B(0.12, 1.2, 0.1).translate(0.4, 4.1, 0), color: 0x222226 },
    { geo: B(1.54, 0.08, 0.1).translate(0, 4.86, 0), color: 0xff8a2a, glow: 1.4 },
  ]),
  flame: () => mergeParts([
    { geo: new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8).translate(0, 0.25, 0), color: 0x3a2e2c },
    { geo: new THREE.TorusGeometry(0.5, 0.07, 5, 12).rotateX(Math.PI / 2).translate(0, 0.52, 0), color: 0xff5a1f, glow: 1.3 },
    // flame tongues (glow > 1.55 → flicker in the vertex shader)
    { geo: T(new THREE.OctahedronGeometry(0.5), [0.7, 3.4, 0.7], [0, 0, 0], [0, 2.0, 0]), color: 0xff3c0a, glow: 1.9 },
    { geo: T(new THREE.OctahedronGeometry(0.4), [0.6, 2.4, 0.6], [0.2, 0, 0.35], [0.28, 1.5, 0.1]), color: 0xff7a14, glow: 1.9 },
    { geo: T(new THREE.OctahedronGeometry(0.4), [0.6, 2.2, 0.6], [-0.2, 0, -0.35], [-0.28, 1.4, -0.1]), color: 0xff7a14, glow: 1.9 },
    { geo: T(new THREE.OctahedronGeometry(0.42), [1.0, 1.3, 1.0], [0, 0.4, 0], [0, 0.95, 0]), color: 0xffe07a, glow: 2.4 },
  ]),
  spire: () => mergeParts([
    { geo: new THREE.ConeGeometry(0.8, 7, 5).translate(0, 3.5, 0), color: 0xcdefff, glow: 0.3 },
    { geo: T(new THREE.ConeGeometry(0.45, 3.6, 5), [1, 1, 1], [0, 0, 0.35], [0.7, 1.6, 0.2]), color: 0x9fdcff, glow: 0.45 },
    { geo: T(new THREE.ConeGeometry(0.35, 2.6, 5), [1, 1, 1], [0.3, 0, -0.4], [-0.6, 1.1, -0.2]), color: 0xe8fbff, glow: 0.3 },
  ]),
  crystal: () => mergeParts([
    { geo: T(new THREE.OctahedronGeometry(0.5), [0.7, 2.0, 0.7], [0, 0, 0], [0, 0.9, 0]), color: 0x7ae8ff, glow: 0.8 },
    { geo: T(new THREE.OctahedronGeometry(0.35), [0.7, 1.8, 0.7], [0, 0, 0.5], [0.45, 0.5, 0.1]), color: 0xbff6ff, glow: 0.6 },
    { geo: T(new THREE.OctahedronGeometry(0.3), [0.7, 1.6, 0.7], [0.4, 0, -0.5], [-0.4, 0.4, -0.1]), color: 0x9ab8ff, glow: 0.7 },
  ]),
  pylon: () => mergeParts([
    { geo: B(0.42, 7, 0.42).translate(0, 3.5, 0), color: 0x1c0c2c },
    { geo: new THREE.TorusGeometry(0.42, 0.07, 5, 14).rotateX(Math.PI / 2).translate(0, 2.2, 0), color: 0xff3cae, glow: 1.6 },
    { geo: new THREE.TorusGeometry(0.42, 0.07, 5, 14).rotateX(Math.PI / 2).translate(0, 4.0, 0), color: 0xff3cae, glow: 1.6 },
    { geo: new THREE.TorusGeometry(0.42, 0.07, 5, 14).rotateX(Math.PI / 2).translate(0, 5.8, 0), color: 0xff3cae, glow: 1.6 },
    { geo: new THREE.IcosahedronGeometry(0.35, 1).translate(0, 7.3, 0), color: 0x5af2ff, glow: 2.0 },
  ]),
  block: () => mergeParts([
    { geo: B(1.4, 1.4, 1.4).translate(0, 0.7, 0), color: 0x160828 },
    { geo: B(1.44, 0.12, 1.44).translate(0, 1.0, 0), color: 0x5af2ff, glow: 1.6 },
    { geo: B(1.44, 0.12, 1.44).translate(0, 0.4, 0), color: 0xb04bff, glow: 1.3 },
  ]),
};
const propCache = {};
export function propGeometry(kind) {
  if (!propCache[kind]) propCache[kind] = PROP_BUILDERS[kind]();
  return propCache[kind];
}

// Lit, fogged, vertex-coloured instanced material with a per-vertex glow term.
export function createPropMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uGrow: { value: 1 },
      uSky: { value: col(0x8fb8ff) }, uGround: { value: col(0x3a1450) },
      uKey: { value: col(0xffffff) }, uKeyDir: { value: new THREE.Vector3(0.4, 0.8, 0.6).normalize() },
    }]),
    vertexShader: /* glsl */`
      attribute float glow;
      uniform float uTime, uGrow;
      varying vec3 vCol, vN;
      varying float vGlow;
      #include <fog_pars_vertex>
      void main() {
        float seed = fract(sin(instanceMatrix[3].x * 12.9898) * 43758.5453);
        vec3 pos = position;
        if (glow > 1.55) pos.y *= 1.0 + 0.22 * sin(uTime * 13.0 + seed * 30.0);   // flame flicker
        pos.y *= uGrow;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(pos, 1.0);
        vN = normalize(mat3(m) * normal);
        vCol = color;
        vGlow = glow * (0.8 + 0.2 * sin(uTime * 3.0 + seed * 20.0));
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSky, uGround, uKey, uKeyDir;
      varying vec3 vCol, vN;
      varying float vGlow;
      #include <fog_pars_fragment>
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * 0.55;
        float dif = max(dot(n, uKeyDir), 0.0);
        vec3 c = vCol * (amb + uKey * dif * 0.75) + vCol * vGlow * 1.4;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: true,
  });
}
