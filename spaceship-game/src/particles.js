import * as THREE from 'three';

// One pooled, additive point-sprite system for every effect in the game.
// No per-frame allocations: particles live in typed arrays and are recycled.
export class Particles {
  constructor(scene, max) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.worldDrift = new Float32Array(max); // how much the particle is carried by world speed
    this.cursor = 0;
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('pcolor', this.colAttr);
    geo.setAttribute('psize', this.sizeAttr);
    geo.setAttribute('palpha', this.alphaAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 } },
      vertexShader: /* glsl */`
        attribute vec3 pcolor;
        attribute float psize;
        attribute float palpha;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = pcolor;
          vAlpha = palpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          a = a * a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setViewportHeight(px) {
    // Keep sprite size consistent across screen sizes and pixel ratios.
    this.material.uniforms.uScale.value = px * 0.5;
  }

  emit(x, y, z, vx, vy, vz, life, size, r, g, b, drag = 0, worldDrift = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = size;
    this.drag[i] = drag;
    this.worldDrift[i] = worldDrift;
  }

  // Radial burst — used for explosions, sparks and celebrations.
  burst(x, y, z, count, speed, life, size, palette, drag = 1.5, worldDrift = 0.4) {
    for (let n = 0; n < count; n++) {
      // Random direction on a sphere
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.3 + Math.random() * 0.9);
      const c = palette[(Math.random() * palette.length) | 0];
      this.emit(
        x, y, z,
        s * Math.cos(t) * sp, u * sp * 0.8, s * Math.sin(t) * sp,
        life * (0.5 + Math.random() * 0.8),
        size * (0.6 + Math.random() * 0.8),
        c[0], c[1], c[2], drag, worldDrift,
      );
    }
  }

  update(dt, worldSpeed) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      let l = this.life[i];
      if (l <= 0) {
        if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; }
        continue;
      }
      l -= dt;
      this.life[i] = l;
      if (l <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      alive++;
      const i3 = i * 3;
      const damp = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= damp; this.vel[i3 + 1] *= damp; this.vel[i3 + 2] *= damp;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += (this.vel[i3 + 2] + worldSpeed * this.worldDrift[i]) * dt;
      const k = l / this.maxLife[i];
      this.alpha[i] = k;
      this.size[i] = this.baseSize[i] * (0.35 + 0.65 * k);
    }
    this.alive = alive;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }
}

export const PALETTES = {
  explosion: [[1, 0.85, 0.4], [1, 0.5, 0.15], [1, 0.25, 0.1], [1, 1, 0.9], [0.6, 0.2, 0.1]],
  spark: [[0.4, 1, 1], [0.8, 1, 1], [0.3, 0.7, 1]],
  gold: [[1, 0.85, 0.3], [1, 1, 0.7], [1, 0.6, 0.2]],
  pink: [[1, 0.3, 0.7], [1, 0.6, 0.9], [0.8, 0.3, 1]],
};
