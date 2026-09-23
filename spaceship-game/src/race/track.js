import * as THREE from 'three';

export const TRACK_HALF = 6;   // half width of the drivable surface

// Small seeded RNG so every track is identical on every play.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A closed-loop neon race track generated from a seed. Provides sampled frames
// (position, forward, right, up, signed curvature) and builds its own meshes.
export class Track {
  constructor(def, galaxy) {
    this.def = def;
    this.galaxy = galaxy;
    const rng = mulberry32(def.seed);
    const K = 10 + Math.round(def.twist * 6);
    const pts = [];
    const ph = rng() * 6.28;
    for (let i = 0; i < K; i++) {
      const a = (i / K) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const r = def.radius * (1 + (rng() - 0.5) * def.twist * 0.9);
      const y = Math.sin(a * 2 + ph) * def.hills * (0.4 + rng() * 0.6);
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();
    const N = (this.N = Math.ceil(this.length / 2));
    this.step = this.length / N;
    this.P = []; this.T = []; this.R = []; this.U = []; this.K = new Float32Array(N);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u).normalize();
      const r = new THREE.Vector3().crossVectors(t, up).normalize();
      const uu = new THREE.Vector3().crossVectors(r, t).normalize();
      this.P.push(p); this.T.push(t); this.R.push(r); this.U.push(uu);
    }
    // Signed curvature in the ground plane (+ = turning left), lightly smoothed.
    const raw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = this.T[i];
      const b = this.T[(i + 1) % N];
      raw[i] = (a.z * b.x - a.x * b.z) / this.step;
    }
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = -3; j <= 3; j++) sum += raw[(i + j + N) % N];
      this.K[i] = sum / 7;
    }

    // Features enabled on this track (each career race adds one).
    const feat = (this.features = new Set(def.features || ['rocks', 'boost']));
    const L = this.length;
    const free = (s, gap = 14) => ![...this.pads, ...this.boxes || [], ...this.ice || [], ...this.walls || [], ...this.rollers || [], ...this.wells || []]
      .some((o) => Math.abs(o.s - s) < gap);

    // Boost pads and obstacles, placed deterministically (not on the start straight).
    this.pads = [];
    const nPads = feat.has('boost') ? def.pads : 0;
    for (let i = 0; i < nPads; i++) {
      const s = ((i + 0.5 + (rng() - 0.5) * 0.4) / nPads) * this.length;
      if (s < 40) continue;
      this.pads.push({ s, x: (rng() * 2 - 1) * (TRACK_HALF - 1.6) });
    }
    // Item boxes: rows of 3 "?" boxes.
    this.boxes = [];
    if (feat.has('items')) {
      const rows = 3;
      for (let i = 0; i < rows; i++) {
        const s = ((i + 0.3 + rng() * 0.3) / rows) * L;
        if (s < 60) continue;
        for (const x of [-3.2, 0, 3.2]) this.boxes.push({ s, x, respawn: 0 });
      }
    }
    // Ice slicks
    this.ice = [];
    if (feat.has('ice')) {
      for (let i = 0; i < 4; i++) {
        const s = ((i + 0.6 + rng() * 0.3) / 4) * L;
        if (!free(s, 20)) continue;
        this.ice.push({ s, len: 22, x: (rng() * 2 - 1) * 2.5, w: 3.4 + rng() * 1.5 });
      }
    }
    // Chicanes: barriers from alternating walls forcing a slalom.
    this.walls = [];
    if (feat.has('chicanes')) {
      for (let c = 0; c < 2; c++) {
        const s0 = ((c + 0.45) / 2) * L;
        if (!free(s0, 40)) continue;
        for (let k = 0; k < 3; k++) {
          const side = k % 2 ? 1 : -1;
          this.walls.push({ s: s0 + k * 26, x0: side < 0 ? -TRACK_HALF - 1 : 1.2, x1: side < 0 ? -1.2 : TRACK_HALF + 1 });
        }
      }
    }
    // Giant eggs rolling across the track
    this.rollers = [];
    if (feat.has('rollingEggs')) {
      for (let i = 0; i < 4; i++) {
        const s = ((i + 0.2 + rng() * 0.5) / 4) * L;
        if (!free(s, 30)) continue;
        this.rollers.push({ s, phase: rng() * 6.28, speed: 0.7 + rng() * 0.5, r: 1.1 });
      }
    }
    // Gravity wells
    this.wells = [];
    if (feat.has('wells')) {
      for (let i = 0; i < 3; i++) {
        const s = ((i + 0.7 + rng() * 0.2) / 3) * L;
        if (!free(s, 30)) continue;
        this.wells.push({ s, x: (rng() < 0.5 ? -1 : 1) * (1.5 + rng() * 2.5) });
      }
    }

    this.obstacles = [];
    for (let i = 0; i < def.obstacles; i++) {
      const s = 80 + ((i + rng() * 0.8) / def.obstacles) * (this.length - 100);
      if (!free(s, 12)) continue;
      const egg = rng() < 0.4;
      this.obstacles.push({ s, x: (rng() * 2 - 1) * (TRACK_HALF - 1.2), r: egg ? 0.8 : 0.7 + rng() * 0.4, egg, rot: rng() * 6 });
    }
  }

  _idx(s) {
    const L = this.length;
    const w = ((s % L) + L) % L;
    const f = w / this.step;
    const i = Math.floor(f) % this.N;
    return [i, (i + 1) % this.N, f - Math.floor(f)];
  }

  curvature(s) {
    const [i, j, k] = this._idx(s);
    return this.K[i] + (this.K[j] - this.K[i]) * k;
  }

  // Fill `out` {p, t, r, u} (Vector3s) with the interpolated frame at distance s, lateral x.
  frame(s, x, out) {
    const [i, j, k] = this._idx(s);
    out.p.lerpVectors(this.P[i], this.P[j], k);
    out.t.lerpVectors(this.T[i], this.T[j], k).normalize();
    out.r.lerpVectors(this.R[i], this.R[j], k).normalize();
    out.u.lerpVectors(this.U[i], this.U[j], k).normalize();
    out.p.addScaledVector(out.r, x);
    return out;
  }

  // ---- meshes ----
  build(scene) {
    const g = this.galaxy;
    const N = this.N;
    const W = TRACK_HALF + 1.4;
    const group = (this.group = new THREE.Group());

    // Road ribbon
    const pos = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const ii = i % N;
      const p = this.P[ii];
      const r = this.R[ii];
      for (let side = 0; side < 2; side++) {
        const sx = side ? W : -W;
        const o = (i * 2 + side) * 3;
        pos[o] = p.x + r.x * sx; pos[o + 1] = p.y + r.y * sx; pos[o + 2] = p.z + r.z * sx;
        uv[(i * 2 + side) * 2] = sx;
        uv[(i * 2 + side) * 2 + 1] = i * this.step;
      }
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    this.roadMat = new THREE.ShaderMaterial({
      uniforms: {
        uEdge: { value: new THREE.Color(g.colors.lane) },
        uLine: { value: new THREE.Color(g.colors.floor) },
        uHalf: { value: TRACK_HALF },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uEdge, uLine; uniform float uHalf, uTime;
        varying vec2 vUv;
        void main() {
          float x = vUv.x, s = vUv.y;
          float ax = abs(x);
          vec3 col = vec3(0.03, 0.035, 0.07);
          float edge = smoothstep(uHalf - 0.25, uHalf, ax) * (1.0 - smoothstep(uHalf + 0.9, uHalf + 1.4, ax));
          col += uEdge * edge * 1.6;
          float dash = step(0.5, fract(s / 8.0)) * (1.0 - smoothstep(0.06, 0.12, abs(ax - uHalf / 3.0)));
          col += uLine * dash * 0.7;
          float grid = 1.0 - smoothstep(0.0, 0.25, abs(fract(s / 12.0) - 0.5) * 12.0 - 5.7);
          col += uLine * grid * 0.12;
          float start = step(s, 3.0) * step(0.5, fract(floor(x * 1.0) * 0.5 + floor(s) * 0.5));
          col = mix(col, vec3(1.0), start * 0.8);
          gl_FragColor = vec4(col, 0.94);
        }`,
      transparent: true,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(geo, this.roadMat));

    // Glowing side rails (vertical ribbons)
    for (const side of [-1, 1]) {
      const rp = new Float32Array((N + 1) * 2 * 3);
      const ri = [];
      for (let i = 0; i <= N; i++) {
        const ii = i % N;
        const p = this.P[ii], r = this.R[ii], u = this.U[ii];
        const bx = p.x + r.x * side * (W - 0.2), by = p.y + r.y * side * (W - 0.2), bz = p.z + r.z * side * (W - 0.2);
        rp.set([bx, by, bz, bx + u.x * 0.7, by + u.y * 0.7, bz + u.z * 0.7], i * 6);
        if (i < N) { const a = i * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
      rg.setIndex(ri);
      const rail = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
        color: g.colors.lane, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      group.add(rail);
    }

    // Neon arches every ~70 units for a sense of speed
    const archGeo = new THREE.TorusGeometry(W + 0.6, 0.14, 6, 28, Math.PI);
    const nArch = Math.floor(this.length / 70);
    const arches = new THREE.InstancedMesh(archGeo, new THREE.MeshBasicMaterial({
      color: g.colors.floor, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    }), nArch);
    const m = new THREE.Matrix4();
    const f = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() };
    const back = new THREE.Vector3();
    for (let i = 0; i < nArch; i++) {
      this.frame((i + 0.5) * 70, 0, f);
      back.copy(f.t).negate();
      m.makeBasis(f.r, f.u, back).setPosition(f.p);
      arches.setMatrixAt(i, m);
    }
    group.add(arches);

    // Boost pads (animated chevrons)
    this.padMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x3cf2ff) } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main() {
          float v = fract(vUv.y * 3.0 + abs(vUv.x - 0.5) * 1.6 + uTime * 2.5);
          float chev = smoothstep(0.35, 0.5, v) * (1.0 - smoothstep(0.5, 0.65, v));
          float border = step(0.46, abs(vUv.x - 0.5)) + step(0.47, abs(vUv.y - 0.5));
          float a = clamp(chev + border * 0.6 + 0.12, 0.0, 1.0);
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const padGeo = new THREE.PlaneGeometry(2.6, 4.5);
    padGeo.rotateX(-Math.PI / 2);
    padGeo.rotateY(Math.PI);
    const pads = new THREE.InstancedMesh(padGeo, this.padMat, Math.max(1, this.pads.length));
    this.pads.forEach((pd, i) => {
      this.frame(pd.s, pd.x, f);
      back.copy(f.t).negate();
      m.makeBasis(f.r, f.u, back).setPosition(f.p.addScaledVector(f.u, 0.03));
      pads.setMatrixAt(i, m);
    });
    pads.count = this.pads.length;
    group.add(pads);

    // Obstacles: space rocks and giant eggs
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const eggGeo = new THREE.IcosahedronGeometry(1, 2);
    eggGeo.scale(0.8, 1.05, 0.8);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x9a8fb8, roughness: 0.9, flatShading: true }), Math.max(1, this.obstacles.length));
    const eggs = new THREE.InstancedMesh(eggGeo, new THREE.MeshStandardMaterial({ color: 0xfff3dc, roughness: 0.35, emissive: 0x2a2418 }), Math.max(1, this.obstacles.length));
    let rc = 0, ec = 0;
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (const o of this.obstacles) {
      this.frame(o.s, o.x, f);
      f.p.addScaledVector(f.u, o.r * 0.6);
      q.setFromEuler(new THREE.Euler(o.rot, o.rot * 1.3, 0));
      sc.setScalar(o.r);
      m.compose(f.p, q, sc);
      if (o.egg) eggs.setMatrixAt(ec++, m); else rocks.setMatrixAt(rc++, m);
    }
    rocks.count = rc; eggs.count = ec;
    group.add(rocks, eggs);

    // Ice slicks: flat translucent blue quads
    const iceMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    for (const ic of this.ice) {
      const n = 10;
      const ip = [], ii = [];
      for (let k = 0; k <= n; k++) {
        this.frame(ic.s + (k / n) * ic.len, 0, f);
        for (const side of [-1, 1]) {
          const p = f.p.clone().addScaledVector(f.r, ic.x + side * ic.w / 2).addScaledVector(f.u, 0.04);
          ip.push(p.x, p.y, p.z);
        }
        if (k < n) { const a = k * 2; ii.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(ip, 3));
      g2.setIndex(ii);
      group.add(new THREE.Mesh(g2, iceMat));
    }

    // Chicane barriers
    if (this.walls.length) {
      const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
        color: 0x401030, emissive: g.colors.lane, emissiveIntensity: 1.4, transparent: true, opacity: 0.9,
      }), this.walls.length);
      this.walls.forEach((w, i) => {
        const cx = (w.x0 + w.x1) / 2;
        this.frame(w.s, cx, f);
        back.copy(f.t).negate();
        m.makeBasis(f.r, f.u, back);
        m.scale(sc.set(Math.abs(w.x1 - w.x0), 1.2, 0.6));
        m.setPosition(f.p.addScaledVector(f.u, 0.6));
        wm.setMatrixAt(i, m);
      });
      group.add(wm);
    }

    // Gravity wells: spinning purple rings + dark core
    this.wellMeshes = [];
    for (const wl of this.wells) {
      const ringM = new THREE.Mesh(new THREE.RingGeometry(0.6, 3.2, 32), new THREE.MeshBasicMaterial({
        color: 0xb04bff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0x050008 }));
      this.frame(wl.s, wl.x, f);
      back.copy(f.t).negate();
      m.makeBasis(f.r, f.u, back).setPosition(f.p.addScaledVector(f.u, 0.1));
      ringM.quaternion.setFromRotationMatrix(m);
      ringM.rotateX(-Math.PI / 2);
      ringM.position.copy(f.p);
      core.position.copy(f.p).addScaledVector(f.u, 0.5);
      group.add(ringM, core);
      this.wellMeshes.push(ringM);
    }

    // Rolling eggs (animated in update())
    if (this.rollers.length) {
      this.rollerMesh = new THREE.InstancedMesh(eggGeo, new THREE.MeshStandardMaterial({ color: 0xfff3dc, roughness: 0.35, emissive: 0x2a2418 }), this.rollers.length);
      this.rollerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(this.rollerMesh);
    }

    // Item boxes (animated in update())
    if (this.boxes.length) {
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: 0xff8a1f, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.3 });
      this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), boxMat, this.boxes.length);
      this.boxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(this.boxMesh);
    }
    this._time = 0;
    this._f2 = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() };
    this._m2 = new THREE.Matrix4();
    this._q2 = new THREE.Quaternion();
    this._s2 = new THREE.Vector3();

    scene.add(group);
  }

  // Current lateral position of a rolling egg.
  rollerX(ro) {
    return Math.sin(this._time * ro.speed + ro.phase) * (TRACK_HALF - 1.2);
  }

  update(dt) {
    this._time += dt;
    this.roadMat.uniforms.uTime.value += dt;
    this.padMat.uniforms.uTime.value += dt;
    const f = this._f2, m = this._m2, q = this._q2, s = this._s2;
    const back = new THREE.Vector3();
    if (this.rollerMesh) {
      this.rollers.forEach((ro, i) => {
        const x = this.rollerX(ro);
        this.frame(ro.s, x, f);
        f.p.addScaledVector(f.u, ro.r * 0.7);
        back.copy(f.t).negate();
        m.makeBasis(f.r, f.u, back);
        q.setFromRotationMatrix(m);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -x * 1.2));
        s.setScalar(ro.r);
        this.rollerMesh.setMatrixAt(i, m.compose(f.p, q, s));
      });
      this.rollerMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.boxMesh) {
      this.boxes.forEach((b, i) => {
        b.respawn = Math.max(0, b.respawn - dt);
        this.frame(b.s, b.x, f);
        f.p.addScaledVector(f.u, 0.9 + Math.sin(this._time * 3 + i) * 0.15);
        q.setFromEuler(new THREE.Euler(this._time * 1.3 + i, this._time * 2 + i, 0));
        s.setScalar(b.respawn > 0 ? 0.001 : 1);
        this.boxMesh.setMatrixAt(i, m.compose(f.p, q, s));
      });
      this.boxMesh.instanceMatrix.needsUpdate = true;
    }
    for (const w of this.wellMeshes || []) w.rotateZ(dt * 2);
  }

  dispose(scene) {
    if (!this.group) return;
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
