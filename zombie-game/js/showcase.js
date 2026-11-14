// Right after a card is taken, a 4-second live demo shows what it does: training dummies appear around the survivor,
// new gear fires at them at once, a new element or stat is shown with a few automatic swings, and a card at the top
// explains the change. Then the next wave starts.
'use strict';
const SHOW = {active: false, dummies: [], timers: []};
function showDummy(a, r = 3.2) {
  const P = G.player; spawnZombie('walker'); const z = G.zombies[G.zombies.length - 1];
  const q = {x: P.x + Math.cos(a) * r, z: P.z + Math.sin(a) * r}; clampToBounds(q, 1);
  Object.assign(z, {dummy: true, x: q.x, z: q.z, hp: 99, maxHp: 99, speed: 0, state: 'rise', st: .6}); SHOW.dummies.push(z); return z;
}
const later = (ms, f) => SHOW.timers.push(setTimeout(() => { if (SHOW.active) f(); }, ms));
function autoSwing(n, gap = 420) { for (let i = 0; i < n; i++) later(900 + i * gap, () => { const P = G.player, t = nearestZombie(6); if (t) P.face = Math.atan2(t.z - P.z, t.x - P.x); startAttack(); }); }
function showcase(c, done, stat0, desc0) {
  SHOW.active = true; SHOW.only = c.id; SHOW.dummies = []; SHOW.timers = []; SHOW.done = done;
  const P = G.player, col = (CAT_COL[c.cat] || CAT_COL.epic)[1], st = (stat0 || [])[0] || [];
  for (let i = 0; i < 3; i++) showDummy(-Math.PI / 2 + (i - 1) * .9);
  const id = c.id;
  if (id.startsWith('gear_')) { const g = id.slice(5); GS.cd[g] = 0; if (g === 'molotov' || g === 'tesla' || g === 'pulse') later(1800, () => { GS.cd[g] = 0; }); }
  else if (id === 'dash') { later(900, () => { P.face = -Math.PI / 2; dash(); }); later(1900, () => { P.face = Math.PI / 2; dash(); }); }
  else if (id === 'slam') { later(800, () => jump()); later(1150, () => startAttack()); }
  else if (id === 'boom') later(900, () => { const z = SHOW.dummies[1]; if (z && !z.dying) { z.dummy = false; z.hp = 1; damageZombie(z, -Math.PI / 2, 5, {w: weapon()}); } });
  else if (id === 'magnet') later(700, () => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; dropPickup('coin', P.x + Math.cos(a) * 5, P.z + Math.sin(a) * 5); } UP.magnetPulse = 1.4; });
  else if (id === 'rng') { later(700, () => { ring(P.x, P.z, wRange(), new THREE.Color(col).getHex(), .9); popText(P.x, P.z, 'REACH ' + wRange().toFixed(1) + ' m', '#9fdcff', 26, 3); }); autoSwing(3); }
  else if (id === 'move') later(600, () => { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; addPart({x: P.x + Math.cos(a) * .6, y: .4, z: P.z + Math.sin(a) * .6, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, vy: .5, g: 0, life: .4, max: .4, size: .1, col: '#9fdcff', drag: .9, rx: 0, ry: 0}); } popText(P.x, P.z, 'FASTER', '#9fdcff', 30, 3); });
  else if (id === 'hp' || id === 'heal' || id === 'life') later(700, () => { ring(P.x, P.z, 2.2, 0xff4060, .5); popText(P.x, P.z, P.hp + ' / ' + P.maxHp + ' HP', '#ff5a6a', 32, 3); FLY.bump.hearts = G.time; });
  else autoSwing(id.startsWith('el_') || id.startsWith('mod_') || id === 'wlvl' || id === 'dmg' || id === 'crit' || id === 'spd' ? 4 : 2);
  // a small label low on the screen keeps the fight in view: the pick's icon, its name and the skip button
  const el = document.getElementById('showcase'), cardArt = c.weaponCard ? `<img src="${WEAPON_ART[P.weapon] || ''}" alt="">` : emblem(c.icon, CAT_COL[c.cat] ? c.cat : 'epic');
  el.style.setProperty('--sc', col);
  el.innerHTML = `<div class="scart">${cardArt}</div><div class="sctitle">${c.title}${st.length && st[2] ? ` <b>${st[2]}</b>` : ''}</div><button class="scskip" id="scskip">Next wave${icon('play')}</button><div class="scbar"><i></i></div>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); el.hidden = false;
  document.getElementById('scskip').onclick = () => endShowcase();
  later(4200, endShowcase);
}
function endShowcase() {
  if (!SHOW.active) return; SHOW.active = false; SHOW.only = null; for (const t of SHOW.timers) clearTimeout(t); SHOW.timers = [];
  for (const z of SHOW.dummies) if (!z.gone && !z.dying) { z.dummy = false; gibZombie(z, rnd(0, 7)); z.gone = true; }
  SHOW.dummies = []; for (const k of G.pickups) k.t = Math.max(k.t, 1); UP.magnetPulse = Math.max(UP.magnetPulse || 0, 1);
  const el = document.getElementById('showcase'); el.classList.remove('on'); setTimeout(() => { if (!SHOW.active) el.hidden = true; }, 300);
  const d = SHOW.done; SHOW.done = null; d && d();
}
