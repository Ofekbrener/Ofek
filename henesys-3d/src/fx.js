// Screen-space effects layered over the canvas: damage numbers, mob HP bars,
// floating text, and the LEVEL UP banner with a 3D light column.
import * as THREE from 'three';

export function createFx(root, camera) {
  const layer = document.createElement('div');
  layer.id = 'fx';
  root.appendChild(layer);
  const bars = new Map();
  const columns = [];
  const v = new THREE.Vector3();

  function toScreen(pos, lift = 0) {
    v.set(pos.x, pos.y + lift, pos.z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 };
  }

  function float(pos, lift, html, cls, life = 1000, dy = 0) {
    const s = toScreen(pos, lift);
    if (s.behind) return;
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    el.style.left = s.x + 'px';
    el.style.top = (s.y - dy) + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), life);
  }

  return {
    /** i stacks multi-hit numbers upward, like the classic client. */
    damage(pos, lift, amount, crit, i = 0, taken = false) {
      float(pos, lift, String(amount), 'dmg' + (crit ? ' crit' : '') + (taken ? ' taken' : ''), 1000, i * 30);
    },
    text(pos, lift, str, cls = 'gain') { float(pos, lift, str, cls, 1400); },

    levelUp(scene, player) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 6, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      col.position.copy(player.position); col.position.y += 3;
      scene.add(col);
      columns.push({ mesh: col, t: 0, player });
      const el = document.createElement('div');
      el.className = 'levelup';
      el.textContent = 'LEVEL UP!';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    },

    /** Per frame: HP bars over hurt mobs, fade light columns. */
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
      for (let i = columns.length - 1; i >= 0; i--) {
        const c = columns[i];
        c.t += dt;
        c.mesh.position.x = c.player.position.x; c.mesh.position.z = c.player.position.z;
        c.mesh.material.opacity = 0.7 * Math.max(0, 1 - c.t / 1.6);
        c.mesh.scale.set(1 + c.t * 0.4, 1 + c.t * 0.2, 1 + c.t * 0.4);
        if (c.t > 1.6) { c.mesh.removeFromParent(); columns.splice(i, 1); }
      }
    },

    clear() { for (const el of bars.values()) el.remove(); bars.clear(); },
  };
}
