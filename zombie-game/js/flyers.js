// Reward flights: a picked card's art flies from the card into the survivor with a glowing trail and bursts on arrival,
// then a small icon flies on to the HUD slot it fills. Coins and hearts picked up in the street fly to their counters.
'use strict';
const FLY = {list: [], bump: {}};
// slot -> screen point, read every frame so moving targets work
const HUD_SLOT = {
  player: () => { const P = G.player, [x, y] = toScreen(P.x, 1.3 * (POW.scale || 1), P.z); return {x, y}; },
  coins: () => ({x: 90, y: 58}), hearts: () => ({x: 120, y: 30}), fury: () => ({x: 90, y: 84}),
  weapon: () => ({x: 34, y: H - 38}),
  gear: i => () => ({x: 22 + i * 40, y: H - 92}), el: i => () => ({x: 70 + i * 16, y: H - 52}),
};
// launch one flyer; html is its look, from is a screen point, to() returns the moving target
function flyTo(html, from, to, {dur = .75, arc = 120, size = 96, endScale = .35, spin = 1, col = '#ffcc33', trail = true, onArrive = null} = {}) {
  const el = document.createElement('div'); el.className = 'flyer'; el.innerHTML = html; el.style.width = el.style.height = size + 'px'; el.style.setProperty('--fc', col);
  document.body.appendChild(el);
  const f = {el, from, to, t: 0, dur, arc, size, endScale, spin, col, trail, onArrive, last: 0}; FLY.list.push(f);
  // if animation frames stop (a hidden tab), the reward still lands
  setTimeout(() => { if (!f.done) { f.done = true; el.remove(); onArrive && onArrive(to()); } }, (dur + .6) * 1000);
  if (!FLY.raf) FLY.raf = requestAnimationFrame(flyLoop);
}
function flyLoop(ts) {
  const now = ts / 1000, dt = Math.min(.05, now - (FLY.prev || now)); FLY.prev = now;
  for (const f of FLY.list) {
    f.t += dt; const k = Math.min(1, f.t / f.dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, to = f.to();
    // a curved path: up and over, then down into the target
    const x = lerp(f.from.x, to.x, e), y = lerp(f.from.y, to.y, e) - Math.sin(Math.PI * e) * f.arc, s = lerp(1, f.endScale, e);
    f.el.style.transform = `translate(${x - f.size / 2}px,${y - f.size / 2}px) scale(${s}) rotate(${f.spin * 360 * e}deg)`;
    if (f.trail && now - f.last > .016) { f.last = now; const sp = document.createElement('i'); sp.className = 'flyspark'; sp.style.left = x + 'px'; sp.style.top = y + 'px'; sp.style.background = f.col; sp.style.setProperty('--sx', (Math.random() - .5) * 30 + 'px'); sp.style.setProperty('--sy', (Math.random() - .2) * 30 + 'px'); document.body.appendChild(sp); setTimeout(() => sp.remove(), 520); }
    if (k >= 1) { f.done = true; f.el.remove(); f.onArrive && f.onArrive(to); }
  }
  FLY.list = FLY.list.filter(f => !f.done);
  FLY.raf = FLY.list.length ? requestAnimationFrame(flyLoop) : 0;
}
// the survivor lights up: rings, a column of sparks, a flash and a rising title
function rewardBurst(col, title, sub) {
  const P = G.player, c = new THREE.Color(col).getHex(), css = '#' + new THREE.Color(col).getHexString();
  ring(P.x, P.z, 3.2, c, .5); ring(P.x, P.z, 1.8, 0xffffff, .3); boom(P.x, P.z, c, 6); flashLight(P.x, P.z, c, 8);
  for (let i = 0; i < 40; i++) { const a = rnd(0, 7), r = rnd(.2, .9); addPart({x: P.x + Math.cos(a) * r, y: rnd(0, .6), z: P.z + Math.sin(a) * r, vx: Math.cos(a) * .6, vz: Math.sin(a) * .6, vy: rnd(4, 9), g: 3, life: rnd(.6, 1.1), max: 1.1, size: rnd(.06, .14), col: i % 3 ? css : '#ffffff', drag: .96, rx: 0, ry: 0}); }
  P.rig.flash(.9, 1, 1, 1); setTimeout(() => P.rig.flash(0), 140);
  popText(P.x, P.z, title, css, 38, 3.2); if (sub) setTimeout(() => popText(P.x, P.z, sub, '#ffffff', 24, 2.6), 180);
  AU.play('levelUp', {vol: .8}); AU.play('heart', {vol: .5, rate: 1.4}); HAPTIC.fx('card'); shake(.25); slowmo(.25);
}
// draw the pop on a HUD slot that just got something (called from drawHUD)
FLY.slotPop = (key, x, y, r = 20) => {
  const t = FLY.bump[key]; if (t === undefined) return 1; const k = (G.time - t) / .7; if (k > 1 || k < 0) return 1;
  hx.save(); hx.globalAlpha = 1 - k; hx.strokeStyle = '#ffffff'; hx.lineWidth = 3; hx.beginPath(); hx.arc(x, y, r + k * 26, 0, 7); hx.stroke(); hx.restore();
  return 1 + .6 * Math.sin(Math.min(1, k * 1.4) * Math.PI);
};
// where a card's reward ends up on the HUD
function cardSlot(c) {
  if (c.id === 'wlvl') return ['weapon', HUD_SLOT.weapon];
  if (c.id.startsWith('gear_')) { const i = Object.keys(UP.gear).indexOf(c.id.slice(5)); return ['gear' + i, HUD_SLOT.gear(Math.max(0, i))]; }
  if (c.id.startsWith('el_')) { const i = elActive().indexOf(c.id.slice(3)); return ['el' + i, HUD_SLOT.el(Math.max(0, i))]; }
  if (c.id === 'hp' || c.id === 'heal' || c.id === 'life') return ['hearts', HUD_SLOT.hearts];
  return null;
}
// street pickups: a coin or heart icon flies from where it was picked up to its counter
function flyPickup(type, wx, wz) {
  const [x, y, ok] = toScreen(wx, .6, wz); if (!ok) return;
  if (type === 'coin') flyTo('<b class="fcoin"></b>', {x, y}, HUD_SLOT.coins, {dur: .45, arc: 40, size: 22, endScale: .8, spin: 0, col: '#ffc83a', trail: false, onArrive: () => { FLY.bump.coins = G.time; }});
  if (type === 'heart') flyTo('<b class="fheart">♥</b>', {x, y}, HUD_SLOT.hearts, {dur: .6, arc: 70, size: 34, endScale: .7, spin: 0, col: '#ff4a5a', onArrive: () => { FLY.bump.hearts = G.time; AU.play('heart', {vol: .4, rate: 1.3}); }});
  if (type === 'rage') flyTo('<b class="frage">▲</b>', {x, y}, HUD_SLOT.fury, {dur: .55, arc: 60, size: 30, endScale: .7, spin: 1, col: '#ff7a1a', onArrive: () => { FLY.bump.fury = G.time; }});
}
