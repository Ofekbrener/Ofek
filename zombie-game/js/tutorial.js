// First-time training (FTUE): move, hit a training dummy, land a finisher, ground slam, blow up a barrel, then wave 1.
'use strict';
const TUT_DONE = () => { try { return localStorage.getItem('ozFtue') === 'done'; } catch (e) { return false; } };
const TUT = {active: false, i: 0, d: {}, dummy: null, marker: null, arrow: null, el: null, doneT: 0};
const touchUI = () => HUD.touch;
const TUT_STEPS = [
  {title: 'Move', text: () => touchUI() ? 'Put your thumb anywhere on the screen and drag to walk.' : 'Walk with WASD or the arrow keys.',
    start() { TUT.d.dist = 0; TUT.d.px = G.player.x; TUT.d.pz = G.player.z; },
    update() { const P = G.player; TUT.d.dist += Math.hypot(P.x - TUT.d.px, P.z - TUT.d.pz); TUT.d.px = P.x; TUT.d.pz = P.z; return TUT.d.dist > 5; },
    progress: () => Math.min(1, TUT.d.dist / 5)},
  {title: 'Attack', text: () => (touchUI() ? 'Tap ATTACK' : 'Click or press J') + ' to hit the training zombie. Your swing aims itself.',
    start() { spawnDummy(); TUT.d.hits = 0; }, target: () => TUT.dummy, on: {hit: () => ++TUT.d.hits >= 3}, progress: () => TUT.d.hits / 3},
  {title: 'Finisher', text: () => `Hit 4 times in a row without stopping. The 4th hit is your ${weapon().fin}: ${weapon().finText}.`,
    start() {}, target: () => TUT.dummy, on: {finisher: () => true}},
  {title: 'Ground slam', text: () => `${touchUI() ? 'Tap JUMP' : 'Press Space'} to jump, then attack in the air to slam down on everything around you.`,
    start() {}, target: () => TUT.dummy, on: {slam: () => true}},
  {title: 'Explosive barrels', text: () => 'Hit the marked barrel. It blows up and takes nearby zombies with it, so step back after.',
    start() { if (TUT.dummy && !TUT.dummy.gone) { TUT.dummy.dummy = false; gibZombie(TUT.dummy, 0); TUT.dummy.gone = true; TUT.dummy = null; } const P = G.player; let b = null, bd = 1e9; for (const x of G.barrels) { if (x.dead) continue; const d = Math.hypot(x.x - P.x, x.z - P.z); if (d < bd) { bd = d; b = x; } } TUT.d.barrel = b; if (!b) TUT.next(); },
    target: () => TUT.d.barrel && !TUT.d.barrel.dead ? TUT.d.barrel : null, on: {barrel: () => true}},
  {title: 'Survive the night', text: () => 'Zombies come in waves. Pick 1 of 3 upgrades after each wave, and coins pay for rerolls. Every 5th wave brings a boss: watch the red marks on the ground and get out of them.',
    start() { TUT.d.t = 0; }, update(dt) { TUT.d.t += dt; return TUT.d.t > 7; }, button: 'Start wave 1'},
];
function spawnDummy() {
  if (TUT.dummy && !TUT.dummy.gone) return;
  spawnZombie('walker'); const z = G.zombies[G.zombies.length - 1], P = G.player;
  z.dummy = true; z.x = P.x; z.z = P.z - 3.2; z.hp = z.maxHp = 99; z.speed = 0; TUT.dummy = z;
}
TUT.start = function () {
  TUT.active = true; TUT.i = -1; TUT.d = {};
  const ring = new THREE.Mesh(new THREE.RingGeometry(.75, .95, 40), new THREE.MeshBasicMaterial({color: 0xffcc33, transparent: true, depthWrite: false, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); TUT.marker = ring;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.22, .45, 4), new THREE.MeshBasicMaterial({color: 0xffcc33})); arrow.rotation.x = Math.PI; arrow.visible = false; scene.add(arrow); TUT.arrow = arrow;
  AU.musicTo('music_calm');
  TUT.next();
};
TUT.next = function () {
  TUT.i++; TUT.doneT = 0;
  if (TUT.i >= TUT_STEPS.length) return TUT.finish();
  const s = TUT_STEPS[TUT.i]; s.start(); TUT.render();
};
TUT.render = function () {
  const s = TUT_STEPS[TUT.i], el = TUT.el = document.getElementById('tut'); el.hidden = false;
  el.innerHTML = `<div class="tstep">TRAINING ${TUT.i + 1} / ${TUT_STEPS.length}</div><div class="ttitle">${s.title}</div><div class="ttext">${s.text()}</div>
    <div class="tbar"><i id="tbar"></i></div><div class="tacts">${s.button ? `<button id="tgo" class="primary">${s.button}</button>` : ''}<button id="tskip" class="ghost">Skip training</button></div>`;
  document.getElementById('tskip').onclick = () => TUT.finish(true);
  const go = document.getElementById('tgo'); if (go) go.onclick = () => TUT.complete();
};
TUT.complete = function () {
  if (TUT.doneT) return; TUT.doneT = .8; const P = G.player;
  AU.play('cardPick', {vol: .8}); AU.play('heart', {vol: .4}); ring(P.x, P.z, 2.2, 0x7dff8a, .4); HAPTIC.fx('card');
  const t = document.querySelector('#tut .ttitle'); if (t) t.classList.add('done');
  const bar = document.getElementById('tbar'); if (bar) bar.style.width = '100%';
};
TUT.event = function (name) {
  if (!TUT.active || TUT.doneT) return; const s = TUT_STEPS[TUT.i];
  if (s && s.on && s.on[name] && s.on[name]()) TUT.complete();
};
TUT.update = function (dt) {
  if (!TUT.active) return;
  const s = TUT_STEPS[TUT.i]; if (!s) return;
  if (TUT.doneT) { TUT.doneT -= dt; if (TUT.doneT <= 0) { TUT.doneT = 0; TUT.next(); } }
  else if (s.update && s.update(dt)) TUT.complete();
  const bar = document.getElementById('tbar'); if (bar && !TUT.doneT && s.progress) bar.style.width = (clamp(s.progress(), 0, 1) * 100) + '%';
  // keep the dummy standing and full of hit points
  if (TUT.dummy && TUT.dummy.gone) { TUT.dummy = null; if (TUT.i >= 1 && TUT.i <= 3) spawnDummy(); }
  const tg = s.target ? s.target() : null;
  TUT.marker.visible = TUT.arrow.visible = !!tg;
  if (tg) { const k = 1 + .1 * Math.sin(G.time * 6); TUT.marker.position.set(tg.x, .05, tg.z); TUT.marker.scale.setScalar(k); TUT.arrow.position.set(tg.x, 2.6 + .2 * Math.sin(G.time * 5), tg.z); TUT.arrow.rotation.y += dt * 2; }
};
TUT.finish = function (skipped) {
  TUT.active = false; try { localStorage.setItem('ozFtue', 'done'); } catch (e) {}
  if (TUT.el) TUT.el.hidden = true;
  if (TUT.marker) { scene.remove(TUT.marker); scene.remove(TUT.arrow); }
  if (TUT.dummy && !TUT.dummy.dying && !TUT.dummy.gone) { TUT.dummy.dummy = false; gibZombie(TUT.dummy, 0); TUT.dummy.gone = true; }
  TUT.dummy = null;
  for (const zb of G.zombies) if (zb.dummy) { zb.gone = true; }
  if (!skipped) { HUD.banner('TRAINING DONE', 'here they come', '#7dff8a'); AU.play('levelUp', {vol: .7}); }
  G.player.hp = G.player.maxHp; G.wave = 0; G.score = 0; G.kills = 0; G.combo = 0;
  setTimeout(() => { if (G.state === 'playing' && !G.player.dead) startWave(); }, skipped ? 300 : 1400);
};
TUT.abort = function () { if (!TUT.active) return; TUT.active = false; if (TUT.el) TUT.el.hidden = true; if (TUT.marker) { scene.remove(TUT.marker); scene.remove(TUT.arrow); } TUT.dummy = null; };
