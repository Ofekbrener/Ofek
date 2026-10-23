// Pooled billboard particles: sparks, stars, dust, confetti. A fixed pool
// means a busy fight never allocates or leaks scene objects.
import * as THREE from 'three';
import { canvasTexture } from './assets/toon.js';

const POOL = 220;

const textures = {
  star: () => canvasTexture('p-star', 64, 64, (c) => {
    c.translate(32, 32); c.fillStyle = '#fff';
    c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 30, a = i / 10 * Math.PI * 2 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill();
  }),
  dot: () => canvasTexture('p-dot', 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }),
  square: () => canvasTexture('p-square', 16, 16, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 16, 16); }),
};

export function createParticles() {
  const items = [];
  for (let i = 0; i < POOL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    s.visible = false;
    items.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, size: 1, spin: 0, add: false });
  }
  let cursor = 0, scene = null;

  function attach(sc) {
    if (scene === sc) return;
    scene = sc;
    for (const p of items) { p.s.removeFromParent(); sc.add(p.s); p.s.visible = false; p.life = 0; }
  }

  /**
   * opts: { count, color (hex or array), speed, up, size, life, gravity, shape: 'star'|'dot'|'square', additive, spread }
   */
  function burst(pos, o = {}) {
    const count = o.count ?? 10, colors = [].concat(o.color ?? 0xffffff);
    for (let k = 0; k < count; k++) {
      const p = items[cursor]; cursor = (cursor + 1) % POOL;
      const a = Math.random() * Math.PI * 2, el = (Math.random() - 0.3) * Math.PI * (o.spread ?? 0.6);
      const sp = (o.speed ?? 4) * (0.5 + Math.random() * 0.7);
      p.vx = Math.cos(a) * Math.cos(el) * sp; p.vz = Math.sin(a) * Math.cos(el) * sp; p.vy = Math.sin(el) * sp + (o.up ?? 2);
      p.g = o.gravity ?? 9; p.life = p.max = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.size = (o.size ?? 0.25) * (0.7 + Math.random() * 0.6); p.spin = (Math.random() - 0.5) * 10;
      const m = p.s.material;
      m.map = textures[o.shape ?? 'star']();
      m.color.setHex(colors[k % colors.length]);
      m.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.rotation = Math.random() * 6;
      m.needsUpdate = true;
      p.s.position.set(pos.x, pos.y, pos.z);
      p.s.visible = true;
    }
  }

  function update(dt) {
    for (const p of items) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.vy -= p.g * dt;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const k = p.life / p.max;
      p.s.material.opacity = Math.min(1, k * 2);
      p.s.material.rotation += p.spin * dt;
      p.s.scale.setScalar(p.size * (0.4 + 0.6 * Math.min(1, k * 1.5)));
    }
  }

  return {
    attach, burst, update,
    get active() { return items.filter(p => p.life > 0).length; },
    size: POOL,
  };
}
