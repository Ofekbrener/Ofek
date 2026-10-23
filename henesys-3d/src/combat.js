// Player attacks and skills, and monster contact damage with 1 s of
// invulnerability. Skills are data (config.SKILLS); this file turns each
// skill kind into targets, projectiles, buffs and heals.
import * as THREE from 'three';
import { JOBS, SKILLS, MOB_VOICE } from './config.js';
import { rollDamage, skillState } from './rules/stats.js';
import { applyBuff, endBuff, modifiers } from './rules/buffs.js';
import { toon } from './assets/toon.js';
import { shuriken, metal } from './assets/shuriken.js';

export const BASIC_COOLDOWN = 0.45;
export const GLOBAL_LOCK = 0.25;
export const INVULN = 1;
const MELEE_DELAY = 0.2;
const PROJECTILE_SPEED = 24;

// ------------------------------------------------------------ projectile looks
// Each factory returns an Object3D whose forward (+z) points along the flight.
const shaftGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.8, 6).rotateX(Math.PI / 2);
const headGeo = new THREE.ConeGeometry(0.06, 0.16, 6).rotateX(Math.PI / 2).translate(0, 0, 0.48);
const featherGeo = new THREE.PlaneGeometry(0.12, 0.2).rotateX(Math.PI / 2).translate(0, 0, -0.32);
const orbGeo = new THREE.SphereGeometry(0.2, 14, 10);
const glowGeo = new THREE.SphereGeometry(0.42, 14, 10);
const shellGeo = new THREE.SphereGeometry(0.2, 12, 10);
const swirlGeo = new THREE.TorusGeometry(0.12, 0.03, 6, 16, Math.PI * 1.6);
const enemyOrbMat = new THREE.MeshBasicMaterial({ color: 0xc060ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
const MAT = {
  wood: toon(0xb07a40), feather: toon(0xe8352a, { side: THREE.DoubleSide }),
  goldShaft: toon(0xffe066, { emissive: 0xc08000 }), goldHead: toon(0xfff1a0, { emissive: 0xffc040 }), goldFeather: toon(0xffffff, { side: THREE.DoubleSide }),
  goldGlow: additive(0xffd23f, 0.35), core: additive(0xffffff, 1), boltGlow: additive(0x6fc8ff, 0.55),
  shell: toon(0x5fae3e), swirl: toon(0xd8f0a0),
};

function arrow(gold = false) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shaftGeo, gold ? MAT.goldShaft : MAT.wood));
  g.add(new THREE.Mesh(headGeo, gold ? MAT.goldHead : metal));
  const f1 = new THREE.Mesh(featherGeo, gold ? MAT.goldFeather : MAT.feather), f2 = f1.clone(); f2.rotation.z = Math.PI / 2;
  g.add(f1, f2);
  if (gold) { g.scale.setScalar(1.8); g.add(new THREE.Mesh(glowGeo, MAT.goldGlow)); }
  return g;
}
function energyOrb() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(orbGeo, MAT.core), new THREE.Mesh(glowGeo, MAT.boltGlow));
  g.userData.pulse = true;
  return g;
}
function shell() {
  const g = new THREE.Group(); const m = new THREE.Mesh(shellGeo, MAT.shell); m.scale.set(1, 1, 0.8);
  const swirl = new THREE.Mesh(swirlGeo, MAT.swirl); swirl.position.z = 0.15;
  g.add(m, swirl); g.userData.spinner = g; return g;
}

const PROJECTILE = {
  bow: { make: () => arrow(), trail: 0xfff6c0, speed: 30 },
  doubleShot: { make: () => arrow(), trail: 0x9fe8ff, speed: 30 },
  arrowBlow: { make: () => arrow(true), trail: 0xffd23f, speed: 26, heavy: true },
  threeSnails: { make: shell, trail: 0xd8f0a0, speed: 16, spin: true },
  energyBolt: { make: energyOrb, trail: 0x6fc8ff, speed: 18, big: true },
  luckySeven: { make: () => shuriken({ glow: true }), trail: 0xe8f4ff, speed: 17, spin: true, star: true },
};
const SKILL_SOUND = { luckySeven: 'throw', threeSnails: 'throw', doubleStab: 'stab', powerStrike: 'slash', slashBlast: 'slash', thunderbolt: 'thunder', spin: 'spin', energyBolt: 'bolt', magicClaw: 'bolt', doubleShot: 'arrow', arrowBlow: 'arrow', arrowRain: 'arrow' };
// basic attack sound per weapon
const WEAPON_SOUND = { knife: 'swing', sword: 'slash', staff: 'staff', bow: 'arrow', daggers: 'stab' };
const SKILL_SFX = { buff: 'buff', heal: 'heal', aoe: 'heavy', rain: 'arrow', projectile: 'arrow', melee: 'heavy' };

const REASON = { mp: 'Not enough MP', cooldown: 'Not ready yet', job: 'Not your skill', locked: lv => `Unlocks at Lv. ${lv}` };

/** ctx (per call): { player, character, map, onKill(mob), sfx(name), now() } */
export function createCombat(fx) {
  let basic = 0, lock = 0, invuln = 0;
  const cooldowns = {};
  const pending = []; // { delay, mob, dmg, i, mesh?, trail?, heavy }
  const enemyShots = []; // { mesh, mob, target, life }

  function inRange(player, mobs, range) {
    return mobs.filter(m => m.alive && Math.hypot(m.position.x - player.position.x, m.position.z - player.position.z) <= range + m.radius)
      .sort((a, b) => a.position.distanceToSquared(player.position) - b.position.distanceToSquared(player.position));
  }

  function land(ctx, p) {
    const { mob, dmg, i } = p;
    if (!mob.alive) return;
    const killed = mob.takeHit(dmg.amount, ctx.player.position.x, ctx.player.position.z, p.heavy ? 2 : 1);
    fx.damage(mob.position, mob.model.height + 0.4, dmg.amount, dmg.crit, i);
    const chest = mob.position.clone(); chest.y += mob.model.height * 0.5;
    fx.impact(chest, dmg.crit, p.heavy, p.color);
    if (p.look?.star) ctx.sfx?.('tink');
    ctx.sfx?.(dmg.crit ? 'crit' : 'hit');
    if (Math.random() < 0.35 || killed) ctx.sfx?.(MOB_VOICE[mob.id]);
    if (killed) ctx.onKill(mob);
  }

  function queueHits(ctx, mob, skillId, hits, delay, extra = {}) {
    const mods = modifiers(ctx.character, ctx.now());
    for (let h = 0; h < hits; h++) {
      pending.push({ delay: delay + h * (extra.gap ?? 0.12), mob, dmg: rollDamage(ctx.character, skillId, Math.random, mods), i: h, ...extra });
    }
  }

  function launch(ctx, mob, skillId, look, hits) {
    const mods = modifiers(ctx.character, ctx.now());
    for (let h = 0; h < hits; h++) {
      const mesh = look.make();
      mesh.visible = false;
      ctx.map.scene.add(mesh);
      // released from the throwing hand when the animation lets go
      pending.push({ delay: (look.star ? 0.22 : MELEE_DELAY) + h * 0.14, mob, dmg: rollDamage(ctx.character, skillId, Math.random, mods), i: h, mesh, look, launched: false, heavy: !!look.heavy });
    }
  }

  return {
    get cooldown() { return basic; },
    get invulnerable() { return invuln > 0; },
    /** True during the short pause after any action. */
    get locked() { return lock > 0; },
    /** Seconds until a skill is ready (0 when ready). */
    cooldownLeft(id, now) { return Math.max(0, (cooldowns[id] ?? 0) - now); },

    /** Returns the number of targets (0 for buffs and heals), or -1 if nothing happened. */
    tryAttack(ctx, skillId = null) {
      if (lock > 0 || ctx.player.dead) return -1;
      const { player, character: c, map } = ctx;
      const now = ctx.now();
      const job = JOBS[c.job];
      const skill = skillId ? SKILLS[skillId] : null;

      if (skill) {
        const st = skillState(c, skillId, now, cooldowns);
        if (!st.ok) {
          if (st.reason !== 'cooldown') fx.text(player.position, 2.2, st.reason === 'locked' ? REASON.locked(skill.level) : REASON[st.reason], 'warn');
          return -1;
        }
        c.mp -= skill.mp;
        cooldowns[skillId] = now + skill.cooldown;
      } else {
        if (basic > 0) return -1;
        basic = BASIC_COOLDOWN;
      }
      lock = GLOBAL_LOCK;
      player.model.attack(skillId ?? undefined);
      ctx.sfx?.(skill ? (SKILL_SOUND[skillId] ?? SKILL_SFX[skill.kind]) : WEAPON_SOUND[job.weapon] ?? 'swing');

      const kind = skill?.kind ?? (job.weapon === 'bow' ? 'projectile' : 'melee');
      // attacking reveals you; casting a buff or heal does not
      if (kind !== 'buff' && kind !== 'heal') endBuff(c, 'darkSight');

      if (kind === 'buff') {
        applyBuff(c, skillId, now);
        fx.aura(player, skillId);
        return 0;
      }
      if (kind === 'heal') {
        const amount = 40 + (c.int ?? 4) * 3;
        c.hp = Math.min(c.maxHp, c.hp + amount);
        fx.heal(player, amount);
        return 0;
      }

      const range = skill?.range ?? job.range;
      const found = inRange(player, map.mobs ?? [], range);
      if (found[0]) player.faceTowards(found[0].position.x, found[0].position.z);
      const hits = skill?.hits ?? 1;

      if (kind === 'melee') {
        player.lunge();
        const heavy = skillId === 'powerStrike';
        setTimeout(() => fx.swipe(player, heavy ? 0xffb050 : skillId === 'doubleStab' ? 0xc8a0ff : 0xfff6c0, heavy), 110);
        if (found[0]) queueHits(ctx, found[0], skillId, hits, MELEE_DELAY, { heavy, gap: skillId === 'doubleStab' ? 0.14 : 0.12 });
        return found[0] ? 1 : 0;
      }

      if (kind === 'projectile') {
        if (!found[0]) return 0;
        if (skillId === 'magicClaw') {
          setTimeout(() => fx.claw(found[0]), 180);
          queueHits(ctx, found[0], skillId, hits, 0.25, { color: 0xc080ff, gap: 0.1 });
          return 1;
        }
        const look = PROJECTILE[skillId] ?? PROJECTILE.bow;
        if (look.star) ctx.player.model.holdStar?.(0.22 + (hits - 1) * 0.14);
        if (look.star) fx.particles.burst(player.position.clone().setY(player.position.y + 1.2), { count: 6, color: 0xe8f4ff, speed: 2, up: 1, size: 0.3, life: 0.25, gravity: 0, additive: true });
        launch(ctx, found[0], skillId, look, hits);
        return 1;
      }

      if (kind === 'aoe') {
        if (skillId === 'thunderbolt') {
          for (const m of found) { setTimeout(() => fx.lightning(m.position), 150 + Math.random() * 150); queueHits(ctx, m, skillId, hits, 0.3, { heavy: true, color: 0xbfe8ff }); }
          fx.flash('#d8f0ff', 0.35);
        } else if (skillId === 'spin') {
          for (let k = 0; k < 3; k++) setTimeout(() => fx.shockwave(player.position, range, 0xffd090), 120 + k * 180);
          for (const m of found) queueHits(ctx, m, skillId, hits, 0.2, { gap: 0.18 });
        } else {
          player.lunge();
          setTimeout(() => fx.swipe(player, 0x9fe8ff, true), 110);
          setTimeout(() => fx.shockwave(player.position, range), 150);
          for (const m of found) queueHits(ctx, m, skillId, hits, MELEE_DELAY, { heavy: true });
        }
        return found.length;
      }

      if (kind === 'rain') {
        const center = found[0]?.position.clone() ?? player.position.clone().add(new THREE.Vector3(Math.sin(player.yaw) * 5, 0, Math.cos(player.yaw) * 5));
        fx.arrowRain(center, skill.radius);
        const inside = (map.mobs ?? []).filter(m => m.alive && Math.hypot(m.position.x - center.x, m.position.z - center.z) <= skill.radius + m.radius);
        for (const m of inside) queueHits(ctx, m, skillId, hits, 0.45, { gap: 0.15 });
        return inside.length;
      }
      return 0;
    },

    update(dt, ctx) {
      basic -= dt; lock -= dt; invuln -= dt;
      for (let k = pending.length - 1; k >= 0; k--) {
        const p = pending[k];
        p.delay -= dt;
        if (p.delay > 0) continue;
        if (!p.mesh) { pending.splice(k, 1); land(ctx, p); continue; }
        // projectile: appears in the hand, then flies at the (moving) target's chest
        if (!p.launched) {
          p.launched = true; p.mesh.visible = true;
          if (!ctx.player.model.handPosition?.(p.mesh.position)) p.mesh.position.copy(ctx.player.position).add(new THREE.Vector3(Math.sin(ctx.player.yaw) * 0.5, 1.1, Math.cos(ctx.player.yaw) * 0.5));
        }
        const to = p.mob.position.clone(); to.y += p.mob.model.height * 0.5;
        const d = to.clone().sub(p.mesh.position), dist = d.length(), step = (p.look?.speed ?? PROJECTILE_SPEED) * dt;
        p.mesh.lookAt(to);
        // stars face the camera so you see the whole star spinning, like the 2D game
        if (p.look?.star && ctx.camera) { p.mesh.quaternion.copy(ctx.camera.quaternion); p.mesh.userData.spinner.rotation.z -= dt * 28; }
        else if (p.look?.spin) p.mesh.userData.spinner.rotation.x += dt * 20;
        if (p.look?.big) p.mesh.scale.setScalar(1 + Math.sin(performance.now() / 50) * 0.12);
        if (dist <= step || !p.mob.alive) {
          p.mesh.removeFromParent(); pending.splice(k, 1);
          land(ctx, p);
        } else {
          p.mesh.position.addScaledVector(d, step / dist);
          fx.particles.burst(p.mesh.position, { count: p.look?.big ? 2 : 1, color: p.look?.trail ?? 0xffffff, shape: 'dot', speed: 0.2, up: 0, size: p.look?.big || p.heavy ? 0.8 : 0.5, life: 0.3, gravity: 0, additive: true });
        }
      }

      // monster orbs: fly 14 m/s to where the player was; hit if still close
      const { player, character, map } = ctx;
      for (let k = enemyShots.length - 1; k >= 0; k--) {
        const e = enemyShots[k];
        e.life -= dt;
        const d = e.target.clone().sub(e.mesh.position), dist = d.length(), step = 14 * dt;
        fx.particles.burst(e.mesh.position, { count: 1, color: 0xc060ff, shape: 'dot', speed: 0.2, up: 0, size: 0.6, life: 0.25, gravity: 0, additive: true });
        if (dist > step && e.life > 0) { e.mesh.position.addScaledVector(d, step / dist); continue; }
        e.mesh.removeFromParent(); enemyShots.splice(k, 1);
        fx.particles.burst(e.mesh.position, { count: 10, color: [0xc060ff, 0xffffff], speed: 3, up: 1, size: 0.35, life: 0.35, gravity: 2, additive: true });
        const near = e.mesh.position.distanceTo(player.position.clone().setY(player.position.y + 1)) < 1.2;
        if (near && invuln <= 0 && character.hp > 0 && !modifiers(character, ctx.now()).hidden) {
          const amount = Math.max(1, Math.round(e.mob.def.atk * (0.85 + Math.random() * 0.3)));
          character.hp = Math.max(0, character.hp - amount);
          invuln = INVULN;
          fx.damage(player.position, 2.0, amount, false, 0, true);
          player.model.hit();
          fx.flash('#c060ff', 0.25);
          ctx.sfx?.('hurt');
        }
      }

      // contact damage (Dark Sight hides you from monsters)
      if (invuln > 0 || character.hp <= 0 || modifiers(character, ctx.now()).hidden) return;
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
          m.model.lunge?.();
          fx.flash('#ff3b30', 0.25);
          ctx.sfx?.('hurt');
          break;
        }
      }
    },

    /** A monster's magic orb flying at where the player stands now. */
    enemyShot(ctx, mob) {
      const mesh = new THREE.Mesh(orbGeo, enemyOrbMat);
      mesh.position.copy(mob.position); mesh.position.y += mob.model.height * 0.6;
      ctx.map.scene.add(mesh);
      enemyShots.push({ mesh, mob, target: ctx.player.position.clone().setY(ctx.player.position.y + 1), life: 2 });
      ctx.sfx?.('bolt');
    },

    reset() {
      for (const e of enemyShots) e.mesh.removeFromParent();
      enemyShots.length = 0;
      for (const p of pending) p.mesh?.removeFromParent();
      pending.length = 0; basic = 0; lock = 0;
    },
  };
}
