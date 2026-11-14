// More ways to build a run: 3 swing mods (WAVE SLASH, WHIRLWIND, ECHO STRIKE, Lv 1 to 3) and 2 gear pieces
// (LANDMINES, BOOMERANG, Lv 1 to 5). Every level changes what the player sees, along with the numbers.
'use strict';
Object.assign(SVG, {
  wave: '<path d="M8 50C20 20 44 12 58 14C44 22 30 34 22 54z" fill="url(#g)"/><path d="M14 56C24 38 36 30 50 28" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>',
  whirl: '<circle cx="32" cy="32" r="7" fill="#fff"/><path d="M32 6a26 26 0 0 1 26 26h-8a18 18 0 0 0-18-18zM58 32a26 26 0 0 1-26 26v-8a18 18 0 0 0 18-18zM32 58A26 26 0 0 1 6 32h8a18 18 0 0 0 18 18zM6 32A26 26 0 0 1 32 6v8a18 18 0 0 0-18 18z" fill="url(#g)"/>',
  echo: '<path d="M10 52L44 12l6 6L16 58z" fill="url(#g)"/><path d="M22 52L52 18l4 4L28 56z" fill="url(#g)" opacity=".45"/><path d="M34 52L58 26l2 2L38 56z" fill="url(#g)" opacity=".2"/>',
  mines: '<ellipse cx="32" cy="40" rx="24" ry="10" fill="url(#g)"/><rect x="18" y="26" width="28" height="14" rx="4" fill="url(#g)"/><circle cx="32" cy="24" r="5" fill="#ff3030"/><circle cx="32" cy="24" r="10" fill="#ff3030" opacity=".3"/>',
  boomerang: '<path d="M10 14c14 2 22 10 24 22 6-10 14-16 22-16-6 8-10 18-10 30-8-14-20-22-36-24 6-2 8-6 0-12z" fill="url(#g)"/><circle cx="34" cy="36" r="3" fill="#fff"/>',
});
CAT_COL.mod = ['#ffe9a0', '#ff8a1a'];
const MODS = {
  wave: {name: 'WAVE SLASH', icon: 'wave', lv: ['Every swing sends a blade wave 4 m ahead: 1 damage to every zombie it passes.', 'The wave flies 6 m, hits for 2 and grows bigger.', 'Three waves in a fan, 8 m.']},
  whirl: {name: 'WHIRLWIND', icon: 'whirl', lv: ['Every 5th swing becomes a spin that hits everything around you.', 'Every 4th swing, 30% wider.', 'Every 3rd swing, and the spin drags zombies in.']},
  echo: {name: 'ECHO STRIKE', icon: 'echo', lv: ['A ghost blade repeats every swing 0.3 s later for half damage.', 'The ghost hits for 75% and leaves a second trail.', 'Two ghosts, full damage, and they stun.']},
};
Object.assign(GEAR, {
  mines: {name: 'LANDMINES', icon: 'mines', text: l => `drops a mine every ${(7 - .8 * (l - 1)).toFixed(1)} s, up to ${2 + l} at once, ${2 + Math.floor(l / 2)} damage blast`},
  boomerang: {name: 'BOOMERANG', icon: 'boomerang', text: l => `throws ${l >= 5 ? 3 : l >= 3 ? 2 : 1} spinning blade${l >= 3 ? 's' : ''} out and back every ${(3 - .25 * (l - 1)).toFixed(1)} s, ${1 + Math.floor(l / 2)} damage`},
});
// cards (the card pool was built before this file loaded)
const modRaw = k => (UP.mods || {})[k] || 0;
for (const [k, m] of Object.entries(MODS)) CARDS.splice(1, 0, {id: 'mod_' + k, build: true, cat: 'mod', icon: m.icon, rarity: 'epic', repeat: true, title: m.name, ok: () => modRaw(k) < 3,
  flavor: () => m.lv[modRaw(k)], stat: () => [['Mod', modRaw(k) ? 'Lv ' + modRaw(k) : 'none', 'Lv ' + (modRaw(k) + 1)]], apply: () => { UP.mods = UP.mods || {}; UP.mods[k] = modRaw(k) + 1; }});
for (const k of ['mines', 'boomerang']) { const g = GEAR[k];
  CARDS.push({id: 'gear_' + k, build: true, cat: 'gear', icon: g.icon, rarity: 'rare', repeat: true, title: g.name,
    ok: () => gearLvl(k) ? gearLvl(k) < 5 : Object.keys(UP.gear).length < GEAR_MAX,
    flavor: () => (gearLvl(k) ? 'Next: ' : '') + g.text(gearLvl(k) + 1) + '.', stat: () => [['Gear', gearLvl(k) ? 'Lv ' + gearLvl(k) : 'new', 'Lv ' + (gearLvl(k) + 1)]],
    apply: () => { UP.gear[k] = gearLvl(k) + 1; buildGear(); }}); }
// during the demo after a pick, only the picked mod works
const modLv = k => SHOW.active && SHOW.only && SHOW.only !== 'mod_' + k ? 0 : modRaw(k);
const MODS_S = {waves: [], mines: [], booms: [], swings: 0};
const LV_COL = ['#ffffff', '#ffffff', '#9fe8ff', '#ffc83a'];

// ---------- swing mods, called from strike() ----------
function modStrike(a, range, arc, dmg) {
  const P = G.player, w = weapon(); MODS_S.swings++;
  const lw = modLv('wave');
  if (lw) for (const off of lw >= 3 ? [-.3, 0, .3] : [0]) {
    const d = a.dir + off, len = lw === 1 ? 4 : lw === 2 ? 6 : 8, g = new THREE.RingGeometry(.78, 1, 24, 1, -.9, 1.8);
    g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: LV_COL[lw], transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending}));
    m.rotation.y = -d; m.scale.setScalar(.8 + .35 * lw); scene.add(m);
    MODS_S.waves.push({m, x: P.x + Math.cos(d) * .6, z: P.z + Math.sin(d) * .6, dir: d, dist: 0, len, dmg: lw >= 2 ? 2 : 1, lv: lw, hit: new Set()});
    AU.play('swingWide', {vol: .35, rate: 1.5, max: 3});
  }
  const lh = modLv('whirl');
  if (lh && MODS_S.swings % (6 - lh) === 0) {
    const R = range * (lh >= 2 ? 1.3 : 1.05) + .4;
    hitArea(P.x, P.z, 0, R, 9, dmg, {kind: 'whirl', w, kb: 6});
    for (const k of [0, 1, 2]) setTimeout(() => ring(P.x, P.z, R * (.6 + k * .2), lh >= 3 ? 0xffc83a : 0xd8e8ff, .25), k * 60);
    for (let i = 0; i < 18 + lh * 6; i++) { const t = i / (18 + lh * 6) * Math.PI * 2; addPart({x: P.x + Math.cos(t) * R * .8, y: rnd(.6, 1.4), z: P.z + Math.sin(t) * R * .8, vx: -Math.sin(t) * 12, vz: Math.cos(t) * 12, vy: 0, g: 0, life: .2, max: .2, size: .06, col: LV_COL[lh], drag: .9, streak: 1}); }
    if (lh >= 3) for (const zb of G.zombies) { if (zb.dying || zb.T.boss) continue; const dx = P.x - zb.x, dz = P.z - zb.z, d = Math.hypot(dx, dz); if (d < R * 1.6 && d > 1) { zb.x += dx / d * Math.min(1.4, d - 1); zb.z += dz / d * Math.min(1.4, d - 1); } }
    P.rig.body.rotation.y += Math.PI; AU.play('swingWide', {vol: .8, rate: .8}); shake(.12); popText(P.x, P.z, 'WHIRLWIND', LV_COL[lh] === '#ffffff' ? '#d8e8ff' : LV_COL[lh], 24, 2.6);
  }
  const le = modLv('echo');
  if (le) for (let g = 0; g < (le >= 3 ? 2 : 1); g++) setTimeout(() => {
    if (G.state !== 'playing' || P.dead) return; const mul = le === 1 ? .5 : le === 2 ? .75 : 1, dir = a.dir + (g ? .35 : 0);
    hitArea(P.x, P.z, dir, range, arc, Math.max(1, Math.round(dmg * mul)), {kind: 'echo', w, light: true});
    if (le >= 3) for (const zb of G.zombies) if (!zb.dying && Math.hypot(zb.x - P.x, zb.z - P.z) < range + zb.r && Math.abs(angDiff(dir, Math.atan2(zb.z - P.z, zb.x - P.x))) < arc) zb.stun = Math.max(zb.stun || 0, .4);
    arcWave(P.x, P.z, dir, range, arc, le >= 3 ? 0xffc83a : 0xbfd8ff, .3); if (le >= 2) arcWave(P.x, P.z, dir, range * .7, arc, 0xffffff, .25);
    for (let i = 0; i < 10; i++) { const t = dir + rnd(-arc, arc), r = rnd(.5, 1) * range; addPart({x: P.x + Math.cos(t) * r, y: rnd(.8, 1.5), z: P.z + Math.sin(t) * r, vx: 0, vz: 0, vy: .6, g: 0, life: .35, max: .35, size: .09, col: le >= 3 ? '#ffe9a0' : '#cfe0ff', drag: 1, rx: 0, ry: 0, fade: 1}); }
    AU.play(weapon().swing, {vol: .35, rate: 1.3, max: 3});
  }, 300 + g * 180);
}

// ---------- gear, called from updateGear() with its demo-aware level lookup ----------
function updateGear2(dt, lvl) {
  const P = G.player;
  // blade waves fly ahead and hit each zombie once
  for (const v of MODS_S.waves) {
    const s = 16 * dt; v.dist += s; v.x += Math.cos(v.dir) * s; v.z += Math.sin(v.dir) * s; v.m.position.set(v.x, .7, v.z); v.m.material.opacity = .85 * (1 - v.dist / v.len);
    const R = .7 + .35 * v.lv;
    for (const zb of G.zombies) if (!zb.dying && zb.state !== 'rise' && !v.hit.has(zb) && Math.hypot(zb.x - v.x, zb.z - v.z) < R + zb.r) { v.hit.add(zb); damageZombie(zb, v.dir, v.dmg, {w: weapon(), kind: 'wave', kb: 3}); }
    if (Math.random() < .6) addPart({x: v.x + rnd(-.4, .4), y: .7, z: v.z + rnd(-.4, .4), vx: 0, vz: 0, vy: .5, g: 0, life: .2, max: .2, size: .07, col: LV_COL[v.lv], drag: 1, rx: 0, ry: 0, fade: 1});
  }
  for (const v of MODS_S.waves) if (v.dist >= v.len) { scene.remove(v.m); v.m.geometry.dispose(); }
  MODS_S.waves = MODS_S.waves.filter(v => v.dist < v.len);
  // landmines: dropped at your feet, armed after 0.6 s, a zombie stepping close sets one off
  const lm = lvl('mines');
  for (const mi of MODS_S.mines) mi.m.visible = !!lm;
  if (lm) {
    if (cdReady('mines', 7 - .8 * (lm - 1), dt) && MODS_S.mines.length < 2 + lm) {
      const g = new THREE.Group(), s = .85 + .1 * lm, col = lm >= 5 ? 0xc8a020 : lm >= 3 ? 0x5a6a7a : 0x3a4030;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.24, .28, .08, 14), new THREE.MeshStandardMaterial({color: col, metalness: .6, roughness: .4}));
      const led = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({color: 0xff2020})); led.position.y = .07; g.add(base, led);
      if (lm >= 3) for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(.03, .1, 6), base.material); sp.position.set(Math.cos(i * 1.57) * .18, .07, Math.sin(i * 1.57) * .18); g.add(sp); }
      g.scale.setScalar(s); g.position.set(P.x, .04, P.z); scene.add(g); MODS_S.mines.push({m: g, led, x: P.x, z: P.z, t: 0, lv: lm});
      AU.play('metalDrop', {vol: .3, rate: 1.6});
    }
    for (const mi of MODS_S.mines) {
      mi.t += dt; mi.led.visible = mi.t < .6 || Math.sin(G.time * (mi.t < .6 ? 30 : 8)) > 0;
      if (mi.t < .6 || mi.boom) continue;
      for (const zb of G.zombies) if (!zb.dying && zb.state !== 'rise' && Math.hypot(zb.x - mi.x, zb.z - mi.z) < .8 + zb.r) { mi.boom = true; break; }
      if (mi.boom) { scene.remove(mi.m); explodeAt(mi.x, mi.z, 2 + .3 * mi.lv, 2 + Math.floor(mi.lv / 2), 0, 'mine'); if (mi.lv >= 5) ring(mi.x, mi.z, 3.5, 0xffc83a, .4); }
    }
    MODS_S.mines = MODS_S.mines.filter(mi => !mi.boom);
  }
  // boomerang: spins out toward the nearest zombie (or ahead) and comes back to you, hitting on both legs
  const lb = lvl('boomerang');
  if (lb && cdReady('boomerang', 3 - .25 * (lb - 1), dt)) {
    const t = nearestTo(P.x, P.z, 9), d0 = t ? Math.atan2(t.z - P.z, t.x - P.x) : P.face, n = lb >= 5 ? 3 : lb >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const d = d0 + (i - (n - 1) / 2) * .5, g = new THREE.Group(), col = lb >= 5 ? 0xffc83a : lb >= 3 ? 0xc8d4e0 : 0x9a6a3a;
      const mat = new THREE.MeshStandardMaterial({color: col, metalness: lb >= 3 ? .8 : .1, roughness: .35, emissive: lb >= 5 ? 0x5a3a00 : 0});
      for (const a of [0, 1.9]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, .1), mat); arm.position.set(Math.cos(a) * .22, 0, Math.sin(a) * .22); arm.rotation.y = -a; g.add(arm); }
      g.scale.setScalar(1 + .12 * lb); g.position.set(P.x, 1, P.z); scene.add(g);
      MODS_S.booms.push({m: g, d, t: 0, len: 5.5 + .5 * lb, dmg: 1 + Math.floor(lb / 2), lv: lb, hit: new Set(), back: false});
    }
    AU.play('swingWide', {vol: .4, rate: 1.4});
  }
  for (const b of MODS_S.booms) {
    b.t += dt / .55; const out = b.t < 1, k = out ? easeOutCubic(b.t) : 1 - easeOutCubic(Math.min(1, b.t - 1));
    if (!out && !b.back) { b.back = true; b.hit.clear(); }
    const x = P.x + Math.cos(b.d) * b.len * k + (out ? 0 : Math.cos(b.d + 1.57) * Math.sin(k * Math.PI) * 1.2), z = P.z + Math.sin(b.d) * b.len * k + (out ? 0 : Math.sin(b.d + 1.57) * Math.sin(k * Math.PI) * 1.2);
    b.m.position.set(x, 1, z); b.m.rotation.y += dt * 22;
    if (Math.random() < .7) addPart({x, y: 1, z, vx: 0, vz: 0, vy: 0, g: 0, life: .18, max: .18, size: .06, col: b.lv >= 5 ? '#ffc83a' : b.lv >= 3 ? '#e0ecff' : '#d8b080', drag: 1, rx: 0, ry: 0, fade: 1});
    for (const zb of G.zombies) if (!zb.dying && zb.state !== 'rise' && !b.hit.has(zb) && Math.hypot(zb.x - x, zb.z - z) < .6 + zb.r) { b.hit.add(zb); damageZombie(zb, b.d, b.dmg, {w: weapon(), kind: 'boomerang', kb: 2}); sparks(zb.x, zb.z, b.d, 4, '#ffffff'); }
  }
  for (const b of MODS_S.booms) if (b.t >= 2) disposeTree(b.m);
  MODS_S.booms = MODS_S.booms.filter(b => b.t < 2);
}
function clearGear2() {
  for (const v of MODS_S.waves) scene.remove(v.m); for (const m of MODS_S.mines) scene.remove(m.m); for (const b of MODS_S.booms) scene.remove(b.m);
  MODS_S.waves = []; MODS_S.mines = []; MODS_S.booms = []; MODS_S.swings = 0;
}
