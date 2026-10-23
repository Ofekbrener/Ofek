// Chibi humanoids: the player (3 looks, 3 weapons) and the 4 Henesys NPCs.
// buildPlayer(look, job) / buildNpc(id) -> CharModel:
//   { object3d, height, setWeapon(job), animate(state, dt, t, speed), attack(), hit() }
//   state: 'idle' | 'walk' | 'jump'. attack() and hit() are one-shots layered on top.
import * as THREE from 'three';
import { toon, flat, outline, paintY, lathe, materialsOf, ease, INK } from './toon.js';

export const LOOKS = [
  { name: 'Classic', hair: 0x7a4a24, shirt: 0xf4f1ea, pants: 0x3d6fd1, shoes: 0x5a3a20 },
  { name: 'Forest',  hair: 0x2a2220, shirt: 0x58b04a, pants: 0x7a5232, shoes: 0x3a2a1c },
  { name: 'Sunny',   hair: 0xf1c34e, shirt: 0xe0483a, pants: 0x464a5a, shoes: 0x2a2a30 },
];
const SKIN = 0xffdcbc;

function eye(ink, white, iris) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), ink);
  ball.scale.set(0.75, 1.35, 0.35);
  const col = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), flat(iris));
  col.position.set(0, -0.02, 0.012); col.scale.set(0.9, 1.2, 0.4);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), white);
  glint.position.set(0.012, 0.03, 0.02);
  g.add(ball, col, glint);
  return g;
}

/** A jointed chibi body. Returns the joints so callers can add gear. */
function humanoid(o) {
  const outlineMat = flat(INK, { side: THREE.BackSide });
  const ink = flat(0x1a1210), white = flat(0xffffff);
  const skin = toon(o.skin ?? SKIN), shirt = toon(o.shirt), pants = toon(o.pants), shoes = toon(o.shoes), hairM = toon(o.hair);
  const flashMats = [skin, shirt, pants];
  const bulk = o.bulk ?? 1;

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);          // bob + lean pivot at the feet
  const hips = new THREE.Group(); hips.position.y = 0.36; body.add(hips);

  // torso
  const torsoGeo = o.robe
    ? lathe([[0, -0.36], [0.3, -0.36], [0.26, -0.1], [0.2, 0.2], [0.17, 0.42], [0, 0.44]], 24)
    : lathe([[0, -0.02], [0.17 * bulk, -0.02], [0.19 * bulk, 0.12], [0.2 * bulk, 0.32], [0.16 * bulk, 0.44], [0, 0.45]], 24);
  const torso = outline(new THREE.Mesh(torsoGeo, shirt), 1.05, outlineMat);
  hips.add(torso);
  if (o.skirt) {
    const skirt = outline(new THREE.Mesh(lathe([[0, -0.2], [0.32, -0.2], [0.17, 0.08]], 24), toon(o.skirt)), 1.04, outlineMat);
    hips.add(skirt);
  }

  // legs (pivot at hip)
  const legs = [-1, 1].map(side => {
    const leg = new THREE.Group(); leg.position.set(side * 0.09 * bulk, 0.02, 0); hips.add(leg);
    const thigh = outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * bulk, 0.16, 4, 10), o.skirt ? skin : pants), 1.08, outlineMat);
    thigh.position.y = -0.17; leg.add(thigh);
    const shoe = outline(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), shoes), 1.08, outlineMat);
    shoe.scale.set(1, 0.6, 1.4); shoe.position.set(0, -0.33, 0.03); leg.add(shoe);
    if (o.robe) leg.visible = false;
    return leg;
  });

  // arms (pivot at shoulder)
  const arms = [-1, 1].map(side => {
    const arm = new THREE.Group(); arm.position.set(side * 0.22 * bulk, 0.38, 0); hips.add(arm);
    const sleeve = outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * bulk, 0.18, 4, 10), o.bareArms ? skin : shirt), 1.08, outlineMat);
    sleeve.position.y = -0.13; arm.rotation.z = side * 0.18; arm.add(sleeve);
    const hand = outline(new THREE.Mesh(new THREE.SphereGeometry(0.06 * bulk, 12, 8), skin), 1.08, outlineMat);
    hand.position.y = -0.28; arm.add(hand);
    const grip = new THREE.Group(); grip.position.y = -0.29; arm.add(grip);
    arm.userData.grip = grip;
    return arm;
  });

  // head
  const head = new THREE.Group(); head.position.y = 0.82; hips.add(head);
  const skull = outline(new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), skin), 1.03, outlineMat);
  skull.scale.set(1.04, 0.96, 0.98); head.add(skull);
  const eyes = [-1, 1].map(side => {
    const e = eye(ink, white, o.eyes ?? 0x4a2c14);
    e.position.set(side * 0.12, -0.02, 0.315); e.rotation.y = side * 0.32;
    head.add(e); return e;
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 5, 10, Math.PI), flat(0x8a3a2a));
  mouth.rotation.z = Math.PI; mouth.position.set(0, -0.15, 0.31); head.add(mouth);
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), flat(0xff9c8a, { transparent: true, opacity: 0.5 }));
    blush.position.set(side * 0.2, -0.11, 0.27); blush.rotation.y = side * 0.6; head.add(blush);
  }

  // hair
  const style = o.hairStyle ?? 'short';
  if (style !== 'bald') {
    const cap = outline(new THREE.Mesh(new THREE.SphereGeometry(0.37, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM), 1.03, outlineMat);
    cap.position.y = 0.02; cap.rotation.x = -0.25; head.add(cap);
    // bangs: a row of soft points over the forehead
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 8), hairM);
      b.position.set(i * 0.11, 0.12, 0.27 - Math.abs(i) * 0.04); b.rotation.set(Math.PI + 0.5, 0, i * 0.25);
      head.add(b);
    }
    for (const side of [-1, 1]) {
      const lock = outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, style === 'long' ? 0.55 : 0.16, 4, 8), hairM), 1.05, outlineMat);
      lock.position.set(side * 0.31, style === 'long' ? -0.2 : -0.05, -0.02); head.add(lock);
    }
    if (style === 'long') {
      const back = outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), hairM), 1.03, outlineMat);
      back.scale.set(1, 1, 0.45); back.position.set(0, -0.25, -0.2); head.add(back);
    }
    if (style === 'pigtails') for (const side of [-1, 1]) {
      const tail = outline(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hairM), 1.05, outlineMat);
      tail.scale.set(0.8, 1.3, 0.8); tail.position.set(side * 0.38, -0.1, -0.05); head.add(tail);
    }
    if (style === 'old') { head.children.filter(c => c.geometry?.type === 'ConeGeometry').forEach(c => c.visible = false); }
  }
  if (o.beard) {
    const beard = outline(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), toon(o.beard)), 1.04, outlineMat);
    beard.scale.set(1.1, 1.2, 0.6); beard.position.set(0, -0.3, 0.2); head.add(beard);
    mouth.visible = false;
  }

  return { root, body, hips, head, arms, legs, eyes, flashMats, outlineMat, hairM };
}

// ---------------------------------------------------------------- weapons

function weapon(kind, outlineMat) {
  const g = new THREE.Group();
  if (kind === 'club') {
    const club = outline(new THREE.Mesh(lathe([[0, -0.1], [0.025, -0.1], [0.03, 0.2], [0.055, 0.42], [0, 0.46]], 12), toon(0x9a6232)), 1.1, outlineMat);
    club.rotation.x = Math.PI / 2; g.add(club);
  } else if (kind === 'sword') {
    const blade = outline(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.015), toon(0xdfe6ee)), 1.08, outlineMat);
    blade.position.y = 0.38;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.05), toon(0xd4a73a));
    guard.position.y = 0.06;
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 8), toon(0x5a3a20));
    hilt.position.y = -0.02;
    const s = new THREE.Group(); s.add(blade, guard, hilt); s.rotation.x = Math.PI / 2; g.add(s);
  } else if (kind === 'bow') {
    const limb = outline(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.022, 6, 24, Math.PI * 0.85), toon(0x8a5a2a)), 1.15, outlineMat);
    limb.rotation.z = Math.PI / 2 - Math.PI * 0.425; limb.position.z = -0.24;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.62, 4), flat(0xf0f0f0));
    string.position.z = -0.24 + 0.34 * Math.cos(Math.PI * 0.425) - 0.24;
    const s = new THREE.Group(); s.add(limb, string); s.rotation.y = Math.PI / 2; s.position.z = 0.0;
    g.add(s);
  }
  return g;
}

// --------------------------------------------------------------- animation

function animator(h, { weaponKind = null } = {}) {
  const s = { walk: 0, air: 0, ph: 0, atkT: -1, hitT: -1, flash: 0, blink: 1, lean: 0 };
  let held = null, heldKind = null;

  function setWeapon(kind) {
    if (held) held.parent.remove(held);
    heldKind = kind; held = null;
    if (!kind) return;
    held = weapon(kind, h.outlineMat);
    (kind === 'bow' ? h.arms[0] : h.arms[1]).userData.grip.add(held);
  }
  setWeapon(weaponKind);

  function animate(state, dt, t, speed = 0) {
    s.walk = ease(s.walk, state === 'walk' ? Math.max(0.4, speed) : 0, 10, dt);
    s.air = ease(s.air, state === 'jump' ? 1 : 0, 14, dt);
    s.ph += dt * (4 + 6 * s.walk);
    const sw = Math.sin(s.ph) * 0.75 * s.walk;

    let armR = -sw, armL = sw, legR = sw, legL = -sw;
    const breathe = Math.sin(t * 2.4) * 0.02;
    // jump: knees up, arms out
    legR = THREE.MathUtils.lerp(legR, -0.7, s.air); legL = THREE.MathUtils.lerp(legL, 0.3, s.air);
    armR = THREE.MathUtils.lerp(armR, -2.4, s.air * 0.6); armL = THREE.MathUtils.lerp(armL, -2.4, s.air * 0.6);

    if (s.atkT >= 0) {
      s.atkT += dt;
      const k = s.atkT / 0.38;
      if (heldKind === 'bow') {
        // raise the bow forward, draw, release
        const up = Math.min(1, k * 4);
        armL = THREE.MathUtils.lerp(armL, -Math.PI / 2, up);
        armR = THREE.MathUtils.lerp(armR, -Math.PI / 2 + 0.3, up);
        h.arms[1].position.z = -0.12 * Math.sin(Math.min(1, k) * Math.PI);
      } else {
        // overhead swing: wind up behind, strike forward-down
        const wind = k < 0.35 ? k / 0.35 : 1;
        const strike = k < 0.35 ? 0 : Math.min(1, (k - 0.35) / 0.3);
        armR = THREE.MathUtils.lerp(armR, -2.8, wind);
        armR = THREE.MathUtils.lerp(armR, -0.5, strike);
      }
      if (s.atkT > 0.5) { s.atkT = -1; h.arms[1].position.z = 0; }
    }

    let hitTilt = 0;
    if (s.hitT >= 0) {
      s.hitT += dt;
      hitTilt = 0.35 * Math.exp(-s.hitT * 8) * Math.cos(s.hitT * 14);
      if (s.hitT > 0.8) s.hitT = -1;
    }
    s.flash = ease(s.flash, 0, 8, dt);
    for (const m of h.flashMats) m.emissive.setRGB(0.6 * s.flash, 0.05 * s.flash, 0.05 * s.flash);

    const j = (g, x) => { g.rotation.x = ease(g.rotation.x, x, 18, dt); };
    j(h.arms[1], armR); j(h.arms[0], armL); j(h.legs[1], legR); j(h.legs[0], legL);
    h.hips.position.y = 0.36 + Math.abs(Math.cos(s.ph)) * 0.05 * s.walk + breathe;
    s.lean = ease(s.lean, 0.12 * s.walk, 8, dt);
    h.body.rotation.x = s.lean + hitTilt;
    h.head.rotation.x = -s.lean * 0.6 + Math.sin(t * 1.3) * 0.03;

    s.blink = ease(s.blink, (t % 3.7) < 0.12 ? 0.1 : 1, 30, dt);
    h.eyes.forEach(e => { e.scale.y = s.blink; });
  }

  return {
    animate, setWeapon,
    attack() { s.atkT = 0; },
    hit() { s.hitT = 0; s.flash = 1; },
    get attacking() { return s.atkT >= 0; },
    fadeAll(opacity) { materialsOf(h.root).forEach(m => { m.transparent = opacity < 1; m.opacity = opacity; }); },
  };
}

const JOB_WEAPON = { beginner: 'club', bowman: 'bow', warrior: 'sword' };

export function buildPlayer(look = 0, job = 'beginner') {
  const L = LOOKS[look] ?? LOOKS[0];
  const h = humanoid({ hair: L.hair, shirt: L.shirt, pants: L.pants, shoes: L.shoes });
  const a = animator(h, { weaponKind: JOB_WEAPON[job] });
  return { object3d: h.root, height: 1.6, ...a, setWeapon: j => a.setWeapon(JOB_WEAPON[j] ?? j) };
}

const NPCS = {
  athena: () => {
    const h = humanoid({ hair: 0xf3e0a0, hairStyle: 'long', shirt: 0x3f8f4a, pants: 0x2f6a38, skirt: 0x2f6a38, shoes: 0x6a4424, eyes: 0x2f7a3a });
    // pointed elf ears and a bow on her back
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), toon(SKIN));
      ear.position.set(side * 0.36, 0.0, 0); ear.rotation.z = -side * 1.2; h.head.add(ear);
    }
    const bow = weapon('bow', h.outlineMat); bow.position.set(0, 0.25, -0.24); bow.rotation.z = 0.5; h.hips.add(bow);
    return h;
  },
  balrog: () => {
    const h = humanoid({ skin: 0xa8673c, hair: 0x1a1210, hairStyle: 'bald', shirt: 0xa8673c, bareArms: true, pants: 0x6a4a2a, shoes: 0x3a2a1c, bulk: 1.3 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 24), toon(0xc0392b));
    band.rotation.x = Math.PI / 2; band.position.y = 0.12; h.head.add(band);
    const sword = weapon('sword', h.outlineMat); sword.scale.setScalar(1.6); sword.position.set(0.05, 0.75, -0.26); sword.rotation.set(Math.PI / 2, 0, 0.5); h.hips.add(sword);
    h.root.scale.setScalar(1.12);
    return h;
  },
  stan: () => {
    const h = humanoid({ hair: 0xeeeeee, hairStyle: 'old', beard: 0xf2f2f2, shirt: 0x7a5a9a, pants: 0x4a3a5a, shoes: 0x3a2a1c, robe: true });
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), toon(0x7a4a24));
    cane.position.y = -0.2; h.arms[1].userData.grip.add(cane);
    h.arms[1].rotation.x = -0.3;
    return h;
  },
  mia: () => humanoid({ hair: 0x8a4a2a, hairStyle: 'pigtails', shirt: 0xf28cb8, pants: 0xf28cb8, skirt: 0xf6a8c8, shoes: 0xc0392b }),
};

export const NPC_IDS = Object.keys(NPCS);

export function buildNpc(id) {
  const h = NPCS[id]();
  const a = animator(h);
  return { object3d: h.root, height: 1.6, ...a };
}

export const CHARACTER_IDS = ['player0', 'player1', 'player2', 'bowman', 'warrior', ...NPC_IDS];
export function buildCharacter(id) {
  if (id.startsWith('player')) return buildPlayer(Number(id.slice(6)), 'beginner');
  if (id === 'bowman') return buildPlayer(0, 'bowman');
  if (id === 'warrior') return buildPlayer(1, 'warrior');
  return buildNpc(id);
}
