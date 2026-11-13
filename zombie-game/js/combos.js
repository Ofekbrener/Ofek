// Four more elements (BLEED, ACID, BLAST, GRAVITY) and the combo reactions between elements.
// A build means something because two elements together do a third thing neither does alone.
'use strict';
Object.assign(SVG, {
  bleed: '<path d="M32 4C24 18 14 28 14 40a18 18 0 0 0 36 0C50 28 40 18 32 4z" fill="url(#g)"/><path d="M24 38a8 8 0 0 0 8 10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/><path d="M48 50l6 8M54 46l4 4" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>',
  acid: '<path d="M14 10h36l-4 8H18z" fill="url(#g)"/><path d="M20 18h24v8c8 4 12 12 12 20a24 14 0 0 1-48 0c0-8 4-16 12-20z" fill="url(#g)"/><circle cx="26" cy="44" r="4" fill="#fff" opacity=".85"/><circle cx="38" cy="38" r="3" fill="#fff" opacity=".7"/><circle cx="36" cy="50" r="2.5" fill="#fff" opacity=".6"/>',
  blast: '<path d="M32 2l6 16 16-8-8 16 16 6-16 6 8 16-16-8-6 16-6-16-16 8 8-16-16-6 16-6-8-16 16 8z" fill="url(#g)"/><circle cx="32" cy="32" r="9" fill="#fff"/>',
  gravity: '<circle cx="32" cy="32" r="8" fill="#fff"/><path d="M32 8a24 24 0 0 1 24 24M56 32a24 24 0 0 1-24 24M32 56A24 24 0 0 1 8 32M8 32A24 24 0 0 1 32 8" stroke="url(#g)" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 14l6 0 0 6M14 50l-6 0 0-6" stroke="url(#g)" stroke-width="5" fill="none" stroke-linecap="round"/>',
});
Object.assign(CAT_COL, {bleed: ['#ff8a8a', '#b0101e'], acid: ['#f6ffa0', '#a8c400'], blast: ['#ffe0a0', '#ff3d2a'], gravity: ['#e2d4ff', '#6a4cff']});
Object.assign(ELEMENTS, {
  bleed: {name: 'BLEED', icon: 'bleed', col: 0xd01830, fx: 'bleed', lv: ['Hits open wounds: each stack bleeds 1 damage per second, up to 2 stacks.', 'Up to 4 stacks.', 'Bleeding kills spray blood that wounds zombies nearby.']},
  acid: {name: 'ACID', icon: 'acid', col: 0xd8ff2a, fx: 'acid', lv: ['Hits melt flesh: zombies take 25% more damage for 3 s.', 'They take 40% more, and riot shields melt twice as fast.', 'Melting zombies pass the acid to 2 others when they die.']},
  blast: {name: 'BLAST', icon: 'blast', col: 0xff4a2a, fx: 'blast', lv: ['Every 5th hit explodes: 2 damage around the target.', 'Every 4th hit explodes.', 'Bigger blasts: 3 damage, wider radius.']},
  gravity: {name: 'GRAVITY', icon: 'gravity', col: 0x8a6cff, fx: 'gravity', lv: ['Every 6th hit pulls nearby zombies into the target.', 'Every 4th hit, from further away.', 'Pulled zombies are stunned for 0.8 s.']},
});
for (const k of ['bleed', 'acid', 'blast', 'gravity']) if (UP.el[k] === undefined) UP.el[k] = 0;
// element cards for the new four (the card pool was built before this file loaded)
for (const k of ['bleed', 'acid', 'blast', 'gravity']) { const e = ELEMENTS[k];
  CARDS.splice(1, 0, {id: 'el_' + k, build: true, cat: k, icon: e.icon, rarity: 'epic', repeat: true, title: e.name, ok: () => (UP.el[k] || 0) < 3,
    flavor: () => e.lv[UP.el[k] || 0], stat: () => [['Element', UP.el[k] ? 'Lv ' + UP.el[k] : 'none', 'Lv ' + ((UP.el[k] || 0) + 1)]], apply: () => UP.el[k] = (UP.el[k] || 0) + 1}); }

// ---------- reactions ----------
const COMBOS = [
  {id: 'steam', name: 'STEAM BURST', a: 'fire', b: 'frost', col: '#e8f6ff', text: 'Hit a burning, frozen zombie: steam scalds and stuns everything around it.'},
  {id: 'toxic', name: 'TOXIC BLAST', a: 'fire', b: 'poison', col: '#b6ff3a', text: 'Fire touching a poison cloud blows the cloud up.'},
  {id: 'super', name: 'SUPERCONDUCT', a: 'storm', b: 'frost', col: '#bfe0ff', text: 'Lightning deals double damage to frozen zombies and freezes them solid.'},
  {id: 'melt', name: 'MELTDOWN', a: 'acid', b: 'fire', col: '#ffb02a', text: 'Burning zombies covered in acid take double burn damage.'},
  {id: 'corrode', name: 'CORRODE', a: 'acid', b: 'poison', col: '#d8ff2a', text: 'Poison clouds deal double damage to zombies covered in acid.'},
  {id: 'bloodbomb', name: 'BLOOD BOMB', a: 'bleed', b: 'blast', col: '#ff3040', text: 'Bleeding zombies explode when they die.'},
  {id: 'vortex', name: 'VORTEX', a: 'gravity', b: 'poison', col: '#9dff6a', text: 'Every pull leaves a poison cloud in the middle of the pile.'},
  {id: 'implode', name: 'IMPLOSION', a: 'gravity', b: 'blast', col: '#ff8a5a', text: 'Blasts pull zombies in first, then hit 50% harder.'},
  {id: 'conduct', name: 'CONDUCTOR', a: 'storm', b: 'acid', col: '#f0ff8a', text: 'Lightning always jumps from zombies covered in acid, to 2 more targets.'},
  {id: 'hemo', name: 'HEMORRHAGE', a: 'bleed', b: 'frost', col: '#ff9ab0', text: 'Frozen wounds bleed twice as fast.'},
];
const hasCombo = id => { const c = COMBOS.find(x => x.id === id); return c && UP.el[c.a] > 0 && UP.el[c.b] > 0; };
// combos a card would unlock with what you already own (shown on the draft card)
const combosFor = el => COMBOS.filter(c => (c.a === el && UP.el[c.b] > 0) || (c.b === el && UP.el[c.a] > 0));
const combosWith = el => COMBOS.filter(c => c.a === el || c.b === el);
// a reaction fires: its name pops over the zombie (at most once per zombie per second); the first one of a run gets a banner
function react(zb, id) {
  const c = COMBOS.find(x => x.id === id); G.combosSeen = G.combosSeen || {};
  if (!G.combosSeen[id]) { G.combosSeen[id] = true; HUD.banner('COMBO: ' + c.name, c.text, c.col); AU.play('levelUp', {vol: .55, rate: 1.2}); }
  if (G.time - (zb.reactT || -9) > 1) { zb.reactT = G.time; popText(zb.x, zb.z, c.name, c.col, 30, 3.2); }
}
function steamBurst(zb) {
  react(zb, 'steam'); zb.burn = 0; zb.slow = 0;
  burst(zb.x, zb.z, 26, ['#ffffff', '#e8f6ff', '#cfd8e0'], 6, .25, 1.1, .8); ring(zb.x, zb.z, 3, 0xe8f6ff, .35, 1); AU.play('explosion', {vol: .4, rate: 1.8, x: zb.x, z: zb.z, max: 2});
  for (const o of G.zombies) if (!o.dying && o.state !== 'rise' && Math.hypot(o.x - zb.x, o.z - zb.z) < 2.8) { o.stun = Math.max(o.stun, 1); damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 3 + UP.dmg, {kind: 'pulse', kb: 3}); }
}
function blastAt(x, z, lv, mul = 1) {
  const r = lv >= 3 ? 3 : 2.2, d = Math.round((lv >= 3 ? 3 : 2) * mul) + UP.dmg;
  burst(x, z, 22, ['#ffcf3a', '#ff4a2a', '#2a2626'], 9, .2, .8, .6); ring(x, z, r, 0xff6a2a, .3, 1); flashLight(x, z, 0xff6a2a, 6); AU.play('explosion', {vol: .55, rate: 1.3, x, z, max: 3}); shake(.25);
  for (const o of G.zombies) if (!o.dying && o.state !== 'rise' && Math.hypot(o.x - x, o.z - z) < r) damageZombie(o, Math.atan2(o.z - z, o.x - x), d, {kind: 'pulse', kb: 5, blast: true});
}
function gravityPull(zb, lv) {
  const R = lv >= 2 ? 5 : 4; let n = 0;
  for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise' || o.T.boss) continue; const dx = zb.x - o.x, dz = zb.z - o.z, d = Math.hypot(dx, dz); if (d > R || d < .6) continue;
    o.vx += dx / d * (6 + d * 2.2); o.vz += dz / d * (6 + d * 2.2); if (lv >= 3) o.stun = Math.max(o.stun, .8); n++; }
  ring(zb.x, zb.z, R, 0x8a6cff, .4, -1); burst(zb.x, zb.z, 16, ['#8a6cff', '#e2d4ff', '#2a1a5a'], 3, .14, .7, 1); AU.play('swingHeavy', {vol: .5, rate: .5, x: zb.x, z: zb.z});
  if (n && hasCombo('vortex')) { react(zb, 'vortex'); FX.clouds.push({x: zb.x, z: zb.z, r: UP.el.poison >= 2 ? 2.4 : 1.6, life: 3.5, slow: UP.el.poison >= 3, tick: 0}); }
  return n;
}
// called from applyElements on every connected weapon hit
function applyElements2(zb, w) {
  const E = UP.el, P = G.player;
  if (zb.burn > 0 && zb.slow > 0 && hasCombo('steam') && G.time - (zb.steamT || -9) > 1.5) { zb.steamT = G.time; steamBurst(zb); }
  if (E.bleed) { const cap = E.bleed >= 2 ? 4 : 2; zb.bleedN = Math.min(cap, (zb.bleedN || 0) + 1); zb.bleed = 3; zb.bleedEl = true; }
  if (E.acid) { zb.acidT = 3; zb.acidV = E.acid >= 2 ? .4 : .25; zb.acidSpread = E.acid >= 3; if (Math.random() < .5) burst(zb.x, zb.z, 5, ['#d8ff2a', '#a8c400'], 3, .1, .5, 1); }
  if (E.blast) { P.blastN = (P.blastN || 0) + 1; if (P.blastN % (E.blast >= 2 ? 4 : 5) === 0) {
    const imp = hasCombo('implode'); if (imp) { react(zb, 'implode'); gravityPull(zb, Math.max(1, E.gravity)); }
    setTimeout(() => blastAt(zb.x, zb.z, E.blast, imp ? 1.5 : 1), imp ? 180 : 0); } }
  if (E.gravity) { P.gravN = (P.gravN || 0) + 1; if (P.gravN % (E.gravity >= 2 ? 4 : 6) === 0) gravityPull(zb, E.gravity); }
  // CONDUCTOR: acid-covered zombies always throw lightning to 2 more
  if (zb.acidT > 0 && hasCombo('conduct') && G.time - (zb.condT || -9) > .6) { zb.condT = G.time; let n = 0;
    for (const o of G.zombies) { if (o === zb || o.dying || o.state === 'rise' || n >= 2) continue; if (Math.hypot(o.x - zb.x, o.z - zb.z) < 6) { bolt(zb.x, zb.z, o.x, o.z); damageZombie(o, Math.atan2(o.z - zb.z, o.x - zb.x), 1 + UP.dmg, {w, kind: 'storm'}); o.acidT = Math.max(o.acidT || 0, 1.5); o.acidV = zb.acidV; n++; } }
    if (n) react(zb, 'conduct'); }
}
// damage changes from combos; called by damageZombie before the hit lands
function comboDamage(zb, dmg, o) {
  if (o.kind === 'storm' && zb.slow > 0 && hasCombo('super')) { react(zb, 'super'); zb.stun = Math.max(zb.stun, .7); dmg *= 2; }
  if (o.dot === 'burn' && zb.acidT > 0 && hasCombo('melt')) { react(zb, 'melt'); dmg *= 2; }
  if (o.dot === 'poison' && zb.acidT > 0 && hasCombo('corrode')) { react(zb, 'corrode'); dmg *= 2; }
  if (o.dot === 'bleed' && zb.slow > 0 && hasCombo('hemo')) { react(zb, 'hemo'); dmg *= 2; }
  if (zb.acidT > 0) dmg = Math.ceil(dmg * (1 + (zb.acidV || .25)));
  return dmg;
}
// per-frame status upkeep; called from the zombie update
function comboTick(zb, dt) {
  if (zb.acidT > 0) { zb.acidT -= dt; if (Math.random() < .2) addPart({x: zb.x + rnd(-.3, .3), y: rnd(.4, 1.6), z: zb.z + rnd(-.3, .3), vx: 0, vz: 0, vy: -1.2, g: 6, life: .45, max: .45, size: .07, col: '#d8ff2a', drag: 1, rx: 0, ry: 0}); }
}
// TOXIC BLAST: a burning zombie inside a poison cloud detonates it; called from the cloud update
function cloudCheck(c, zb) {
  if (c.boom || !(zb.burn > 0) || !hasCombo('toxic')) return false;
  c.boom = true; c.life = 0; react(zb, 'toxic');
  burst(c.x, c.z, 34, ['#b6ff3a', '#ff8a1a', '#3aa018', '#ffcf3a'], 10, .25, 1, .6); ring(c.x, c.z, c.r + 1.2, 0xb6ff3a, .35, 1); flashLight(c.x, c.z, 0xb6ff3a, 7); AU.play('explosion', {vol: .7, x: c.x, z: c.z, max: 3});
  for (const o of G.zombies) if (!o.dying && o.state !== 'rise' && Math.hypot(o.x - c.x, o.z - c.z) < c.r + 1.2) damageZombie(o, Math.atan2(o.z - c.z, o.x - c.x), 4 + UP.dmg, {kind: 'pulse', kb: 6, blast: true});
  return true;
}
// on death: blood spray, acid hand-off, blood bomb
function comboKill(zb) {
  const E = UP.el;
  if (zb.bleed > 0 && zb.bleedEl && E.bleed >= 3) for (const o of G.zombies) if (o !== zb && !o.dying && Math.hypot(o.x - zb.x, o.z - zb.z) < 2.2) { o.bleedN = Math.min(4, (o.bleedN || 0) + 1); o.bleed = 3; o.bleedEl = true; burst(o.x, o.z, 5, ['#b01818', '#7a1010'], 4, .08, .4, 1); }
  if (zb.acidT > 0 && zb.acidSpread) { let n = 0; for (const o of G.zombies) { if (o === zb || o.dying || n >= 2) continue; if (Math.hypot(o.x - zb.x, o.z - zb.z) < 4) { o.acidT = 3; o.acidV = zb.acidV; o.acidSpread = true; n++; } } }
  if (zb.bleed > 0 && hasCombo('bloodbomb')) { react(zb, 'bloodbomb'); const x = zb.x, z = zb.z; setTimeout(() => { burst(x, z, 20, ['#b01818', '#ff3040', '#5a0a0a'], 8, .2, .9, .8); blastAt(x, z, Math.max(1, E.blast)); }, 140); }
}
// weapon trail particles for the new elements
function trailFX2(fx, tip) {
  const r = Math.random;
  if (fx === 'bleed' && r() < .5) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-1, 1), vz: rnd(-1, 1), vy: rnd(-1, 1), g: 12, life: .4, max: .4, size: rnd(.04, .08), col: pick(['#b01818', '#ff3040']), drag: .95, rx: 0, ry: 0});
  if (fx === 'acid' && r() < .5) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-.5, .5), vz: rnd(-.5, .5), vy: -1, g: 8, life: .45, max: .45, size: rnd(.04, .08), col: pick(['#d8ff2a', '#a8c400']), drag: .95, rx: 0, ry: 0});
  if (fx === 'blast' && r() < .35) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-3, 3), vz: rnd(-3, 3), vy: rnd(0, 3), g: 4, life: .25, max: .25, size: rnd(.05, .1), col: pick(['#ffcf3a', '#ff4a2a']), drag: .9, rx: 0, ry: 0});
  if (fx === 'gravity' && r() < .5) addPart({x: tip.x + rnd(-.4, .4), y: tip.y + rnd(-.4, .4), z: tip.z + rnd(-.4, .4), vx: 0, vz: 0, vy: 0, g: 0, life: .3, max: .3, size: rnd(.04, .07), col: pick(['#8a6cff', '#e2d4ff']), drag: .7, rx: 0, ry: 0});
}
// draft card: combos this element unlocks with what you own (gold), or which elements it pairs with (grey)
function comboChips(el) {
  const now = combosFor(el), all = combosWith(el);
  if (now.length) return `<span class="combos">${now.map(c => `<b style="--cc:${c.col}">UNLOCKS ${c.name}</b>`).join('')}</span>`;
  const partners = [...new Set(all.map(c => c.a === el ? c.b : c.a))].map(p => ELEMENTS[p].name);
  return partners.length ? `<span class="combos"><i>Combos with ${partners.join(', ')}</i></span>` : '';
}
