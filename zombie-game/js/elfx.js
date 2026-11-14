// Each element looks different on the weapon, beyond the trail color:
// 1. elAura: its own particles on the weapon every frame (flames, cold mist, crackles, drips, fuse sparks, orbiting motes).
// 2. elTrail: its own particles behind the blade during the swing.
// 3. elStrike: its own effect where the swing lands (flame crescent, ice shards, lightning forks, toxic puff,
//    blood fan, sizzling drops, shock ring, implosion).
'use strict';
const ELFX_P = (hz, dt) => Math.random() < Math.min(1, hz * dt);
const flame = (p, s = 1) => addPart({x: p.x + rnd(-.05, .05), y: p.y, z: p.z + rnd(-.05, .05), vx: rnd(-.3, .3), vz: rnd(-.3, .3), vy: rnd(1.2, 2.4) * s, g: -2, life: .35, max: .35, size: rnd(.07, .15) * s, col: pick(['#ff8a1a', '#ffcf3a', '#ff4a10']), drag: .9, rx: 0, ry: 0, fade: 1});
const drop = (p, col, g = 10) => addPart({x: p.x, y: p.y, z: p.z, vx: rnd(-.2, .2), vz: rnd(-.2, .2), vy: rnd(-.5, 0), g, life: .6, max: .6, size: rnd(.04, .07), col, drag: .98, rx: 0, ry: 0});
function elAura(dt) {
  const P = G.player; if (!P || P.dead || !P.wMesh || !P.wMesh.visible || G.state !== 'playing') return;
  const els = elShown(); if (!els.length) return;
  const s = trailSample(P.wMesh, weapon()), tip = s.tip, base = s.base;
  const along = (a = .4, b = 1) => { const k = rnd(a, b); return {x: lerp(base.x, tip.x, k), y: lerp(base.y, tip.y, k), z: lerp(base.z, tip.z, k)}; };
  for (const e of els) {
    const lv = UP.el[e] || 1;
    if (e === 'fire' && ELFX_P(18 + 8 * lv, dt)) flame(along(.5), .8);
    if (e === 'frost' && ELFX_P(10 + 4 * lv, dt)) { const p = along(.3); addPart({x: p.x, y: p.y, z: p.z, vx: rnd(-.2, .2), vz: rnd(-.2, .2), vy: rnd(-.6, -.2), g: .6, life: .8, max: .8, size: rnd(.08, .16), col: pick(['#e8fbff', '#bff0ff']), drag: .95, rx: 0, ry: 0, fade: 1}); }
    if (e === 'frost' && ELFX_P(3, dt)) { const p = along(.6); addPart({x: p.x, y: p.y, z: p.z, vx: 0, vz: 0, vy: 0, g: 0, life: .18, max: .18, size: .09, col: '#ffffff', drag: 1, rx: 0, ry: 0}); }
    if (e === 'storm' && ELFX_P(5 + 2 * lv, dt)) { const p = along(.2); for (let i = 0; i < 3; i++) addPart({x: p.x, y: p.y, z: p.z, vx: rnd(-7, 7), vz: rnd(-7, 7), vy: rnd(-4, 4), g: 0, life: .07, max: .07, size: .03, col: '#e8f6ff', drag: .7, streak: 1}); flashLight(p.x, p.z, 0xbfe0ff, 1.2); }
    if (e === 'poison' && ELFX_P(5, dt)) drop(tip, pick(['#8aff3a', '#4ad018']), 9);
    if (e === 'poison' && ELFX_P(3, dt)) { const p = along(.5); addPart({x: p.x, y: p.y, z: p.z, vx: rnd(-.2, .2), vz: rnd(-.2, .2), vy: .5, g: -.3, life: .9, max: .9, size: rnd(.1, .18), col: '#5ad02a', drag: .96, rx: 0, ry: 0, fade: 1}); }
    if (e === 'bleed' && ELFX_P(6, dt)) drop(along(.7), pick(['#b01818', '#7a0e0e']), 12);
    if (e === 'acid' && ELFX_P(5, dt)) drop(tip, pick(['#d8ff2a', '#a8c400']), 8);
    if (e === 'acid' && ELFX_P(4, dt)) { const p = along(.6); addPart({x: p.x, y: p.y, z: p.z, vx: rnd(-.15, .15), vz: rnd(-.15, .15), vy: .7, g: -.4, life: .7, max: .7, size: rnd(.06, .12), col: '#c8d8a0', drag: .96, rx: 0, ry: 0, fade: 1}); }
    if (e === 'blast' && ELFX_P(9, dt)) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-2, 2), vz: rnd(-2, 2), vy: rnd(1, 3), g: 6, life: .22, max: .22, size: .04, col: pick(['#ffcf3a', '#ff7a2a', '#ffffff']), drag: .9, streak: 1});
    if (e === 'gravity' && ELFX_P(14, dt)) { const a = rnd(0, 7), R = .45; addPart({x: tip.x + Math.cos(a) * R, y: tip.y + rnd(-.25, .25), z: tip.z + Math.sin(a) * R, vx: -Math.cos(a) * R * 3 - Math.sin(a) * 1.5, vz: -Math.sin(a) * R * 3 + Math.cos(a) * 1.5, vy: 0, g: 0, life: .3, max: .3, size: rnd(.04, .07), col: pick(['#8a6cff', '#e2d4ff', '#4a2ab0']), drag: .9, rx: 0, ry: 0}); }
  }
}
// behind the blade in the swing: every shown element adds its own particles (fire, frost and storm use the weapon trail styles)
function elTrail(tip, base) {
  for (const e of elShown()) {
    if (e === 'poison') { if (Math.random() < .6) addPart({x: tip.x, y: tip.y, z: tip.z, vx: rnd(-.6, .6), vz: rnd(-.6, .6), vy: rnd(0, .6), g: -.2, life: .6, max: .6, size: rnd(.1, .2), col: pick(['#8aff3a', '#4ad018']), drag: .93, rx: 0, ry: 0, fade: 1}); }
    else trailFX(ELEMENTS[e].fx, tip, base);
  }
}
// where the swing lands: one effect per shown element, around the middle of the arc
// strike effects read at game zoom: 1.5x the particle size
const bigPart = p => addPart(Object.assign(p, {size: p.size * 1.5}));
function elStrike(a) {
  const els = elShown(); if (!els.length) return;
  const P = G.player, d = a.dir, R = wRange() * .75, cx = P.x + Math.cos(d) * R, cz = P.z + Math.sin(d) * R;
  const arc = (n, f) => { for (let i = 0; i < n; i++) { const t = d + (i / (n - 1) - .5) * 1.8; f(P.x + Math.cos(t) * R, P.z + Math.sin(t) * R, t); } };
  for (const e of els) {
    const lv = UP.el[e] || 1;
    if (e === 'fire') { arc(6 + lv, (x, z) => { for (let i = 0; i < 3; i++) flame({x: x + rnd(-.15, .15), y: .15, z: z + rnd(-.15, .15)}, 1.6); }); flashLight(cx, cz, 0xff6a1a, 3); }
    if (e === 'frost') { arc(5 + lv, (x, z, t) => { for (let i = 0; i < 3; i++) bigPart({x, y: .3, z, vx: Math.cos(t) * rnd(1, 3), vz: Math.sin(t) * rnd(1, 3), vy: rnd(3, 6), g: 20, life: .5, max: .5, size: rnd(.06, .12), col: pick(['#ffffff', '#cff6ff', '#8fe8ff']), drag: .97, rx: rnd(0, 3), ry: rnd(0, 3)}); }); ring(cx, cz, 1.1, 0xbff4ff, .3); }
    if (e === 'storm') { for (let i = 0; i < 1 + Math.min(2, lv); i++) { const t = d + rnd(-.6, .6), L = wRange() * rnd(1.1, 1.5); bolt(P.x + Math.cos(d) * .6, P.z + Math.sin(d) * .6, P.x + Math.cos(t) * L, P.z + Math.sin(t) * L); } flashLight(cx, cz, 0xbfe0ff, 4); }
    if (e === 'poison') { for (let i = 0; i < 8 + 2 * lv; i++) { const t = rnd(0, 7), s = rnd(.4, 1.2); bigPart({x: cx, y: .5, z: cz, vx: Math.cos(t) * s, vz: Math.sin(t) * s, vy: rnd(.2, .6), g: -.2, life: 1, max: 1, size: rnd(.2, .35), col: pick(['#5ad02a', '#8aff3a', '#2e7a14']), drag: .94, rx: 0, ry: 0, fade: 1}); } }
    if (e === 'bleed') arc(7, (x, z, t) => { for (let i = 0; i < 2; i++) bigPart({x, y: 1, z, vx: Math.cos(t) * rnd(3, 6), vz: Math.sin(t) * rnd(3, 6), vy: rnd(1, 3), g: 22, life: .5, max: .5, size: rnd(.05, .09), col: pick(['#b01818', '#ff3040', '#7a0e0e']), drag: .96, rx: 0, ry: 0}); });
    if (e === 'acid') { arc(5, (x, z) => drop({x, y: 1.1, z}, pick(['#d8ff2a', '#a8c400']), 14)); setTimeout(() => { for (let i = 0; i < 6; i++) bigPart({x: cx + rnd(-.6, .6), y: .1, z: cz + rnd(-.6, .6), vx: 0, vz: 0, vy: rnd(.6, 1.2), g: -.5, life: .7, max: .7, size: rnd(.1, .18), col: '#c8d8a0', drag: .95, rx: 0, ry: 0, fade: 1}); }, 180); }
    if (e === 'blast') { ring(cx, cz, .9 + .2 * lv, 0xff8a2a, .22); sparks(cx, cz, d, 6 + 2 * lv, '#ffcf3a'); }
    if (e === 'gravity') { for (let i = 0; i < 14; i++) { const t = i / 14 * Math.PI * 2, r0 = 1.6; bigPart({x: cx + Math.cos(t) * r0, y: rnd(.4, 1.2), z: cz + Math.sin(t) * r0, vx: -Math.cos(t) * 5, vz: -Math.sin(t) * 5, vy: 0, g: 0, life: .3, max: .3, size: .07, col: pick(['#8a6cff', '#e2d4ff']), drag: .98, streak: 1}); } ring(cx, cz, .6, 0x8a6cff, .3); }
  }
}
