// Character creator: pick a survivor, recolor skin/hair/top/pants/shoes, pick the starting weapon. Live 3D preview.
'use strict';
const CREATOR = {el: null, spin: 0, drag: null, loading: false, from: 'menu'};
function openCreator(from = 'menu') {
  CREATOR.from = from; G.state = 'creator'; document.getElementById('menu').hidden = true;
  clearZombies(); clearPickups(); clearFX(); clearTrail();
  rebuildPreview(); renderCreator(); AU.resume(); AU.musicTo('music_calm');
}
async function rebuildPreview() {
  CREATOR.loading = true; renderCreator();
  try { await ensureCharacter(LOOK.char); } catch (e) { LOOK.char = 'Matt'; }
  CREATOR.loading = false;
  makePlayer(); const P = G.player; P.x = 0; P.z = 0; P.face = Math.PI / 2; P.rig.play('Idle', {fade: 0});
  G.cam.x = 0; G.cam.z = 0; renderCreator();
}
const sw = (part, c, on) => `<button class="sw${on ? ' on' : ''}" data-part="${part}" data-c="${c || ''}" style="--c:${c || 'transparent'}" aria-label="${part} ${c || 'original'}"${c ? '' : ' title="Original"'}></button>`;
function renderCreator() {
  const el = CREATOR.el = document.getElementById('creator'); el.hidden = false;
  const w = WEAPONS[LOOK.weapon];
  el.innerHTML = `<div class="panel">
    <h2>Your survivor</h2>
    <div class="gender"><button class="${survivorGender() === 'F' ? 'on' : ''}" data-g="F">Woman</button><button class="${survivorGender() === 'M' ? 'on' : ''}" data-g="M">Man</button></div>
    <div class="chars">${SURVIVORS.filter(s => s.g === survivorGender()).map(s => `<button class="char${LOOK.char === s.id ? ' on' : ''}" data-char="${s.id}"><b>${s.name}</b><small>${s.tag}</small></button>`).join('')}</div>
    ${CREATOR.loading ? '<p class="loadmsg">Loading survivor…</p>' : ''}
    <div class="parts">${LOOK_PARTS.map(p => `<div class="row"><span>${p.label}</span><div class="sws">${sw(p.id, null, !LOOK.colors[p.id])}${p.sw.map(c => sw(p.id, c, LOOK.colors[p.id] === c)).join('')}</div></div>`).join('')}</div>
    <h3>Starting weapon</h3>
    <div class="weps">${Object.keys(WEAPONS).map(k => `<button class="wep${LOOK.weapon === k ? ' on' : ''}" data-w="${k}"><img src="${WEAPON_ART[k] || ''}" alt=""><b>${WEAPONS[k].name}</b></button>`).join('')}</div>
    <p class="wdesc"><b>${w.name}</b> · ${w.desc} Finisher: ${w.fin}, ${w.finText}.</p>
    <div class="acts"><button id="cStart" class="primary">${G.player && TUT_DONE() ? 'Start run' : 'Start training'}</button><button id="cBack" class="ghost">Back</button></div>
  </div><p class="hint">Drag to turn your survivor</p>`;
  el.querySelectorAll('.gender button').forEach(b => b.onclick = () => { if (survivorGender() === b.dataset.g) return; LOOK.char = SURVIVORS.find(s => s.g === b.dataset.g).id; AU.play('cardHover', {vol: .4}); rebuildPreview(); renderCreator(); });
  el.querySelectorAll('.char').forEach(b => b.onclick = () => { if (LOOK.char === b.dataset.char) return; LOOK.char = b.dataset.char; AU.play('cardHover', {vol: .4}); rebuildPreview(); });
  el.querySelectorAll('.sw').forEach(b => b.onclick = () => { LOOK.colors[b.dataset.part] = b.dataset.c || null; if (G.player) applyLook(G.player.rig, LOOK); AU.play('cardHover', {vol: .3, rate: 1.3}); renderCreator(); });
  el.querySelectorAll('.wep').forEach(b => b.onclick = () => { LOOK.weapon = b.dataset.w; if (G.player) equipWeapon(LOOK.weapon); WSND_DRAW(LOOK.weapon); renderCreator(); });
  document.getElementById('cStart').onclick = () => { if (CREATOR.loading) return; saveLook(); renderPortrait(G.player.rig); el.hidden = true; AU.play('cardPick', {vol: .8}); newRun(null, {tutorial: !TUT_DONE()}); };
  document.getElementById('cBack').onclick = () => { saveLook(); renderPortrait(G.player.rig); el.hidden = true; G.state = 'menu'; showMenu(); };
}
// drag to rotate the preview
cv3.addEventListener('pointerdown', e => { if (G.state === 'creator') CREATOR.drag = e.clientX; });
addEventListener('pointermove', e => { if (G.state === 'creator' && CREATOR.drag !== null) { CREATOR.spin += (e.clientX - CREATOR.drag) * .012; CREATOR.drag = e.clientX; } });
addEventListener('pointerup', () => { CREATOR.drag = null; });
function updateCreator(dt) {
  const P = G.player; if (!P) return;
  if (CREATOR.drag === null) CREATOR.spin += dt * .35;
  P.face = Math.PI / 2 + CREATOR.spin; P.rig.mixer.update(dt); syncPlayer();
  // frame the survivor beside the panel (desktop) or above it (phone)
  const wide = W > 760;
  if (wide) { camera.position.set(1.25, 1.55, 4.3); camera.lookAt(1.25, 1.0, 0); }
  else { camera.position.set(0, 1.5, 3.7); camera.lookAt(0, -.3, 0); } // phone: the survivor fills the space above the 45% panel
  WORLD.moon.position.set(8, 22, 6); WORLD.moon.target.position.set(0, 0, 0);
}
