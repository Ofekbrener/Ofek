// Game feel. Screen-space: damage numbers, mob HP bars, floating text,
// combo counter, flashes, LEVEL UP banner. World-space: pooled particles,
// weapon swipes, shockwaves, the level-up ring and light column.
// Camera shake is applied after the follow camera each frame.
import * as THREE from 'three';
import { createParticles } from './particles.js';

const swipeGeo = new THREE.RingGeometry(0.55, 1.35, 28, 1, -Math.PI * 0.55, Math.PI * 1.1);
const waveGeo = new THREE.RingGeometry(0.85, 1, 48);
const ringGeo = new THREE.TorusGeometry(1, 0.08, 8, 48);
const columnGeo = new THREE.CylinderGeometry(0.9, 0.9, 6, 24, 1, true);
const rayGeo = new THREE.PlaneGeometry(0.35, 7);
const glow = (color, opacity = 0.9) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function createFx(root, camera, engine) {
  const layer = document.createElement('div');
  layer.id = 'fx';
  root.appendChild(layer);
  const flashEl = document.createElement('div'); flashEl.className = 'flash'; root.appendChild(flashEl);
  const comboEl = document.createElement('div'); comboEl.id = 'combo'; comboEl.hidden = true; root.appendChild(comboEl);
  const bars = new Map();
  const transients = []; // { obj, t, life, step(k, obj) }
  const particles = createParticles();
  const v = new THREE.Vector3();
  let shake = 0, combo = 0, lastKill = -1e9, comboHide = 0, scene = null;

  function toScreen(pos, lift = 0) {
    v.set(pos.x, pos.y + lift, pos.z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 };
  }

  function float(pos, lift, html, cls, life = 1000, dy = 0) {
    const s = toScreen(pos, lift);
    if (s.behind) return;
    const el = document.createElement('div');
    el.className = cls; el.innerHTML = html;
    el.style.left = s.x + 'px'; el.style.top = (s.y - dy) + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), life);
  }

  function addTransient(obj, life, step) {
    scene.add(obj);
    transients.push({ obj, t: 0, life, step });
  }

  function flash(color = '#fff', strength = 0.6) {
    flashEl.style.background = color;
    flashEl.style.setProperty('--strength', strength);
    flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
  }

  return {
    particles,
    attach(sc) { scene = sc; particles.attach(sc); },

    /** i stacks multi-hit numbers upward, like the classic client. */
    damage(pos, lift, amount, crit, i = 0, taken = false) {
      const html = crit ? `<small>CRITICAL</small>${amount}` : String(amount);
      float(pos, lift, html, 'dmg' + (crit ? ' crit' : '') + (taken ? ' taken' : ''), 1000, i * 32);
    },
    text(pos, lift, str, cls = 'gain') { float(pos, lift, str, cls, 1400); },

    /** A landed hit: sparks, hit stop, shake. */
    impact(pos, crit, heavy = false, color = null) {
      const c = pos.clone();
      particles.burst(c, { count: crit ? 16 : 9, color: crit ? [0xffe066, 0xff7a2a, 0xffffff] : color ? [color, 0xffffff] : [0xfff1a0, 0xffc040], speed: crit ? 7 : 5, up: 1.5, size: crit ? 0.45 : 0.3, life: 0.35, gravity: 6, additive: true });
      particles.burst(c, { count: 4, color: 0xffffff, shape: 'dot', speed: 1.5, up: 0.5, size: crit ? 1.4 : 0.9, life: 0.18, gravity: 0, additive: true });
      engine.hitStop(crit || heavy ? 0.09 : 0.05);
      shake = Math.max(shake, crit || heavy ? 0.28 : 0.1);
    },

    /** A kill: star burst, a pop ring, and the combo counter. */
    kill(pos) {
      const c = pos.clone(); c.y += 0.6;
      particles.burst(c, { count: 18, color: [0xffe066, 0xffffff, 0x9fe8ff, 0xff9ad0], speed: 6, up: 3, size: 0.4, life: 0.7, gravity: 7, additive: true });
      const ring = new THREE.Mesh(ringGeo, glow(0xfff1a0)); ring.position.copy(c); ring.rotation.x = Math.PI / 2;
      addTransient(ring, 0.35, k => { ring.scale.setScalar(0.3 + k * 1.6); ring.material.opacity = 0.9 * (1 - k); });
      const now = performance.now();
      combo = now - lastKill < 3000 ? combo + 1 : 1;
      lastKill = now;
      if (combo >= 2) {
        comboEl.innerHTML = `<b>x${combo}</b> COMBO`;
        comboEl.hidden = false;
        comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
        comboHide = 3;
      }
    },

    /** Weapon swipe arc in front of the player. */
    swipe(player, color = 0xfff6c0, big = false) {
      const m = new THREE.Mesh(swipeGeo, glow(color, 0.85));
      const g = new THREE.Group(); g.add(m);
      m.rotation.x = -Math.PI / 2 + 0.35;
      g.position.copy(player.position); g.position.y += 0.9;
      g.rotation.y = player.yaw;
      m.position.z = 0.3;
      if (big) g.scale.setScalar(1.6);
      addTransient(g, 0.2, k => { m.rotation.z = -1.2 + k * 2.4; m.material.opacity = 0.85 * (1 - k); });
    },

    /** Ground shockwave (Slash Blast). */
    shockwave(pos, radius = 3.4, color = 0x9fe8ff) {
      const w = new THREE.Mesh(waveGeo, glow(color));
      w.rotation.x = -Math.PI / 2; w.position.copy(pos); w.position.y += 0.08;
      addTransient(w, 0.4, k => { w.scale.setScalar(0.3 + k * radius); w.material.opacity = 0.9 * (1 - k); });
      particles.burst(pos.clone().setY(pos.y + 0.2), { count: 14, color: [color, 0xffffff], speed: 7, up: 1, spread: 0.1, size: 0.35, life: 0.4, gravity: 2, additive: true });
      shake = Math.max(shake, 0.2);
    },

    /** Buff cast: a coloured ring rising around the player and sparkles. */
    aura(player, id) {
      const color = { rage: 0xff4a3a, focus: 0xffd23f, haste: 0x5ad1ff, darkSight: 0x8a5ad8 }[id] ?? 0xffffff;
      for (let i = 0; i < 2; i++) {
        const r = new THREE.Mesh(ringGeo, glow(color)); r.rotation.x = Math.PI / 2;
        addTransient(r, 0.8, k => { r.position.set(player.position.x, player.position.y + 0.1 + k * 1.8 + i * 0.4, player.position.z); r.scale.setScalar(1.1 - k * 0.4); r.material.opacity = 0.9 * (1 - k); });
      }
      particles.burst(player.position.clone().setY(player.position.y + 1), { count: 22, color: [color, 0xffffff], speed: 3, up: 3, size: 0.35, life: 0.8, gravity: -1, additive: true });
      if (id === 'darkSight') particles.burst(player.position.clone().setY(player.position.y + 0.8), { count: 18, color: 0x3a2a4a, shape: 'dot', speed: 2, up: 1, size: 1.2, life: 0.9, gravity: -0.5 });
      flash(id === 'rage' ? '#ff6a4a' : id === 'darkSight' ? '#3a2a5a' : '#fff6c0', 0.25);
    },

    /** Heal: green crosses rising and a soft ring. */
    heal(player, amount) {
      const p = player.position.clone(); p.y += 0.2;
      particles.burst(p, { count: 26, color: [0x7cf05a, 0xd8ffb0, 0xffffff], speed: 1.5, up: 4, size: 0.4, life: 1.1, gravity: -1, additive: true, spread: 0.2 });
      const r = new THREE.Mesh(ringGeo, glow(0x9cff7a)); r.rotation.x = Math.PI / 2; r.position.copy(p);
      addTransient(r, 0.7, k => { r.scale.setScalar(0.5 + k * 2.5); r.material.opacity = 0.9 * (1 - k); });
      float(player.position, 2.3, `+${amount} HP`, 'gain heal', 1400);
    },

    /** Magic Claw: three purple slashes across the target. */
    claw(mob) {
      const c = mob.position.clone(); c.y += mob.model.height * 0.55;
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(rayGeo, glow(0xc080ff));
        m.position.copy(c); m.position.x += (i - 1) * 0.22;
        addTransient(m, 0.3, k => { m.quaternion.copy(camera.quaternion); m.rotateZ(0.6); m.scale.set(0.5, 0.25 * Math.min(1, k * 4), 1); m.material.opacity = 1 - k; });
      }
      particles.burst(c, { count: 10, color: [0xc080ff, 0xffffff], speed: 3, up: 1, size: 0.3, life: 0.4, gravity: 2, additive: true });
    },

    /** Thunderbolt: a jagged bolt from the sky onto pos. */
    lightning(pos) {
      const pts = [], top = 9;
      for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(pos.x + (i && i < 8 ? (Math.random() - 0.5) * 0.9 : 0), pos.y + top * (1 - i / 8), pos.z + (i && i < 8 ? (Math.random() - 0.5) * 0.9 : 0)));
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 5, false);
      const bolt = new THREE.Mesh(geo, glow(0xd8f0ff));
      addTransient(bolt, 0.3, k => { bolt.material.opacity = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7; bolt.visible = k < 0.15 || k > 0.25; });
      setTimeout(() => geo.dispose(), 400);
      particles.burst(pos.clone().setY(pos.y + 0.3), { count: 14, color: [0xbfe8ff, 0xffffff], speed: 5, up: 3, size: 0.35, life: 0.45, gravity: 6, additive: true });
      shake = Math.max(shake, 0.2);
    },

    /** Arrow Rain: arrows fall onto a circle, then a ring marks the area. */
    arrowRain(center, radius) {
      const mark = new THREE.Mesh(waveGeo, glow(0xffd23f, 0.6)); mark.rotation.x = -Math.PI / 2; mark.position.copy(center); mark.position.y += 0.06;
      addTransient(mark, 1.1, k => { mark.scale.setScalar(radius); mark.material.opacity = 0.6 * (1 - k); });
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
        const arrow = new THREE.Mesh(rayGeo, glow(0xfff1a0, 0.9));
        arrow.scale.set(0.12, 0.18, 1);
        const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r, delay = Math.random() * 0.35;
        addTransient(arrow, 0.75, k => {
          const u = Math.max(0, (k * 0.75 - delay) / 0.4);
          arrow.visible = u > 0 && u < 1;
          arrow.position.set(x, center.y + 8 * (1 - Math.min(1, u)) + 0.6, z);
          arrow.quaternion.copy(camera.quaternion);
        });
      }
      setTimeout(() => particles.burst(center.clone().setY(center.y + 0.2), { count: 16, color: [0xffe066, 0xffffff], speed: 5, up: 2, size: 0.3, life: 0.4, gravity: 6, additive: true, spread: 0.2 }), 550);
    },

    /** Little dust puff at the feet while walking. */
    dust(pos) {
      particles.burst(pos.clone().setY(pos.y + 0.1), { count: 2, color: 0xe8d8b8, shape: 'dot', speed: 0.8, up: 0.8, size: 0.45, life: 0.45, gravity: 0.5 });
    },

    levelUp(sc, player) {
      const p = player.position;
      // light column
      const col = new THREE.Mesh(columnGeo, glow(0xfff1a0, 0.35)); col.position.copy(p); col.position.y += 3;
      addTransient(col, 1.6, k => { col.position.x = player.position.x; col.position.z = player.position.z; col.material.opacity = 0.35 * (1 - k); col.scale.set(1 + k * 0.6, 1 + k * 0.3, 1 + k * 0.6); });
      // expanding golden rings
      for (let i = 0; i < 2; i++) {
        const r = new THREE.Mesh(ringGeo, glow(0xffd23f)); r.position.copy(p); r.position.y += 0.2 + i * 0.9; r.rotation.x = Math.PI / 2;
        addTransient(r, 0.9 + i * 0.2, k => { r.scale.setScalar(0.5 + k * (4 + i * 2)); r.material.opacity = (1 - k); });
      }
      // spinning rays
      const rays = new THREE.Group(); rays.position.copy(p); rays.position.y += 1;
      for (let i = 0; i < 8; i++) { const ray = new THREE.Mesh(rayGeo, glow(0xfff6c0, 0.3)); ray.rotation.z = i / 8 * Math.PI; rays.add(ray); }
      addTransient(rays, 1.4, k => { rays.quaternion.copy(camera.quaternion); rays.rotateZ(k * 2); rays.scale.setScalar(0.4 + k * 1.2); rays.children.forEach(c => { c.material.opacity = 0.3 * (1 - k); }); });
      // confetti and stars
      const top = p.clone(); top.y += 2.2;
      particles.burst(top, { count: 36, shape: 'square', color: [0xff5a5a, 0xffd23f, 0x5ad1ff, 0x7cf05a, 0xff8ad8, 0xffffff], speed: 6, up: 6, size: 0.11, life: 1.8, gravity: 6 });
      particles.burst(top, { count: 20, color: [0xffe066, 0xffffff], speed: 5, up: 4, size: 0.5, life: 1, gravity: 3, additive: true });
      flash('#fff3b0', 0.7);
      engine.slowMo(0.35, 0.9);
      shake = Math.max(shake, 0.25);
      const el = document.createElement('div');
      el.className = 'levelup';
      el.innerHTML = 'LEVEL UP!';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 2400);
    },

    flash,

    /** Per frame: HP bars over hurt mobs, transients, particles, combo timer. */
    update(dt, mobs) {
      const seen = new Set();
      for (const m of mobs) {
        if (!m.alive || m.hpShownFor <= 0) continue;
        seen.add(m);
        let el = bars.get(m);
        if (!el) { el = document.createElement('div'); el.className = 'hpbar'; el.innerHTML = '<i></i>'; layer.appendChild(el); bars.set(m, el); }
        const s = toScreen(m.position, m.model.height + 0.35 + m.model.hop);
        el.hidden = s.behind;
        el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
        el.firstChild.style.width = (m.hp / m.def.hp * 100) + '%';
      }
      for (const [m, el] of bars) if (!seen.has(m)) { el.remove(); bars.delete(m); }
      for (let i = transients.length - 1; i >= 0; i--) {
        const tr = transients[i];
        tr.t += dt;
        const k = Math.min(1, tr.t / tr.life);
        tr.step(k, tr.obj);
        if (k >= 1) {
          tr.obj.removeFromParent();
          tr.obj.traverse(o => o.material?.dispose());
          transients.splice(i, 1);
        }
      }
      particles.update(dt);
      if (comboHide > 0) { comboHide -= dt; if (comboHide <= 0) comboEl.hidden = true; }
    },

    /** Call after the follow camera is placed. Uses real time so it also shakes during hit stop. */
    applyShake(cam, realDt) {
      if (shake <= 0.002) return;
      cam.position.x += (Math.random() - 0.5) * shake;
      cam.position.y += (Math.random() - 0.5) * shake;
      shake *= Math.exp(-realDt * 14);
    },

    clear() {
      for (const el of bars.values()) el.remove();
      bars.clear();
      for (const tr of transients) { tr.obj.removeFromParent(); tr.obj.traverse(o => o.material?.dispose()); }
      transients.length = 0;
    },
  };
}
