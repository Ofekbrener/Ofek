// Player attacks (melee swings, arrows, thrown shells), skill MP and
// cooldowns, and monster contact damage with 1 s of invulnerability.
import * as THREE from 'three';
import { JOBS, SKILLS } from './config.js';
import { rollDamage } from './rules/stats.js';
import { toon } from './assets/toon.js';

export const BASIC_COOLDOWN = 0.45;
export const INVULN = 1;
const MELEE_DELAY = 0.2;
const PROJECTILE_SPEED = 26;

const arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5).rotateX(Math.PI / 2);
const arrowMat = toon(0xc89050);
const shellGeo = new THREE.SphereGeometry(0.14, 10, 8);
const shellMat = toon(0x5fae3e);

/** ctx (per call): { player, character, map, onKill(mob), sfx(name) } */
export function createCombat(fx) {
  let cooldown = 0, invuln = 0;
  const pending = []; // { delay, mob, dmg, i, mesh?, from, to }

  function inRange(player, mobs, range) {
    return mobs.filter(m => m.alive && Math.hypot(m.position.x - player.position.x, m.position.z - player.position.z) <= range + m.radius)
      .sort((a, b) => a.position.distanceToSquared(player.position) - b.position.distanceToSquared(player.position));
  }

  function land(ctx, p) {
    const { mob, dmg, i } = p;
    if (!mob.alive) return;
    const killed = mob.takeHit(dmg.amount, ctx.player.position.x, ctx.player.position.z);
    fx.damage(mob.position, mob.model.height + 0.4, dmg.amount, dmg.crit, i);
    ctx.sfx?.('hit');
    if (killed) ctx.onKill(mob);
  }

  return {
    get cooldown() { return cooldown; },
    get invulnerable() { return invuln > 0; },

    /** Returns the number of targets, or -1 if the attack could not start. */
    tryAttack(ctx, skillId = null) {
      if (cooldown > 0) return -1;
      const { player, character, map } = ctx;
      const job = JOBS[character.job], skill = skillId ? SKILLS[skillId] : null;
      if (skill && character.mp < skill.mp) {
        fx.text(player.position, 2.1, 'Not enough MP', 'warn');
        cooldown = 0.3;
        return -1;
      }
      if (skill) character.mp -= skill.mp;
      const range = skill ? skill.range : job.range;
      const found = inRange(player, map.mobs ?? [], range);
      const targets = skill?.aoe ? found : found.slice(0, 1);
      cooldown = skill?.cooldown ?? BASIC_COOLDOWN;
      player.model.attack();
      if (targets[0]) player.faceTowards(targets[0].position.x, targets[0].position.z);
      const ranged = job.weapon === 'bow' || skillId === 'threeSnails';
      ctx.sfx?.(ranged ? 'arrow' : 'swing');
      for (const mob of targets) {
        for (let h = 0; h < (skill?.hits ?? 1); h++) {
          const dmg = rollDamage(character, skillId);
          const p = { delay: MELEE_DELAY + h * 0.12, mob, dmg, i: h };
          if (ranged) {
            p.mesh = new THREE.Mesh(skillId === 'threeSnails' ? shellGeo : arrowGeo, skillId === 'threeSnails' ? shellMat : arrowMat);
            p.from = player.position.clone().add(new THREE.Vector3(0, 1.0, 0));
            p.mesh.position.copy(p.from);
            p.mesh.visible = false;
            map.scene.add(p.mesh);
          }
          pending.push(p);
        }
      }
      return targets.length;
    },

    update(dt, ctx) {
      cooldown -= dt; invuln -= dt;
      for (let k = pending.length - 1; k >= 0; k--) {
        const p = pending[k];
        p.delay -= dt;
        if (p.delay > 0) continue;
        if (!p.mesh) { pending.splice(k, 1); land(ctx, p); continue; }
        // projectile: fly toward the (moving) target's chest
        p.mesh.visible = true;
        const to = p.mob.position.clone(); to.y += p.mob.model.height * 0.5;
        const d = to.clone().sub(p.mesh.position), dist = d.length(), step = PROJECTILE_SPEED * dt;
        p.mesh.lookAt(to);
        if (dist <= step || !p.mob.alive) {
          p.mesh.removeFromParent(); pending.splice(k, 1);
          land(ctx, p);
        } else p.mesh.position.addScaledVector(d, step / dist);
      }

      // contact damage
      const { player, character, map } = ctx;
      if (invuln > 0 || character.hp <= 0) return;
      for (const m of map.mobs ?? []) {
        if (!m.alive) continue;
        const dx = player.position.x - m.position.x, dz = player.position.z - m.position.z, d = Math.hypot(dx, dz);
        if (d < m.radius + 0.45 && Math.abs(player.position.y - m.position.y) < 1.2) {
          const amount = Math.max(1, Math.round(m.def.atk * (0.85 + Math.random() * 0.3)));
          character.hp = Math.max(0, character.hp - amount);
          invuln = INVULN;
          fx.damage(player.position, 2.0, amount, false, 0, true);
          player.model.hit();
          player.knockFrom(m.position.x, m.position.z);
          ctx.sfx?.('hurt');
          break;
        }
      }
    },

    reset(map) {
      for (const p of pending) p.mesh?.removeFromParent();
      pending.length = 0; cooldown = 0;
    },
  };
}
