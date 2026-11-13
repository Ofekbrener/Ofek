// Home screen between runs: the survivor in the middle wearing everything equipped, SHOP on the left, PLAY on the right.
// The shop has two tabs: the Safehouse (permanent perks for coins) and the Locker (cosmetics for emeralds).
'use strict';
const HOME = {on: false, tab: 'safe', cos: 'hat', spin: 0};
const firstTime = () => !STORY.seen() || !lookSaved() || !TUT_DONE();
const fmt = n => n.toLocaleString('en-US');
function walletHTML() { return `<span class="wc"><i class="ccoin"></i>${fmt(META.coins)}</span><span class="wg"><i class="cgem"></i>${fmt(META.gems)}</span>`; }
// clear the view: hide props and barrels between the camera and the survivor
function homeStage(on) {
  const P = G.player; for (const o of [...G.props, ...G.barrels.map(b => b.m)]) { const p = o.position, inFront = Math.abs(p.x - P.x) < 3.4 && p.z > P.z - 1 && p.z < P.z + 7; o.visible = on ? !inFront : true; }
}
function showHome() {
  HOME.on = true; homeStage(true); const cp = loadCheckpoint(), s = SURVIVORS.find(x => x.id === LOOK.char) || SURVIVORS[0];
  let best = 0; try { best = +localStorage.getItem('ozBest') || 0; } catch (e) {}
  const sub = cp ? `Continue: ${cp.endless ? 'Endless' : AREAS[areaIndex(cp.wave)].short} · wave ${cp.wave}` : storyFlag('ozEnding') ? 'New story or Endless' : 'Story: Area 1, St. Mercy';
  ui.innerHTML = `<div id="home">
    <div class="htop"><div class="hlogo">ZOMBIE RAID</div><div class="hwallet">${walletHTML()}</div></div>
    <div class="hicons"><button id="hCustom" title="Customize survivor">✎<small>Survivor</small></button><button id="hStory" title="Story">❝<small>Story</small></button><button id="hSet" title="Settings">⚙<small>Settings</small></button></div>
    <div class="hname"><b>${s.name}</b><span>${s.tag}</span>${best ? `<small>Best score ${fmt(best)}</small>` : ''}</div>
    <div class="hbtns"><button id="hShop" class="hbig shop"><span class="hico">🛒</span>SHOP<small>Safehouse · Locker</small></button>
      <button id="hPlay" class="hbig play"><span class="hico">▶</span>PLAY<small>${sub}</small></button></div>
    <div id="hsheet" hidden></div></div>`;
  ui.hidden = false;
  document.getElementById('hShop').onclick = () => openShop();
  document.getElementById('hPlay').onclick = () => playChooser();
  document.getElementById('hCustom').onclick = () => { HOME.on = false; openCreator('menu'); };
  document.getElementById('hStory').onclick = () => { HOME.on = false; STORY.intro(showMenu); };
  document.getElementById('hSet').onclick = () => settingsSheet();
  AU.play('cardOpen', {vol: .5}); showUpdate();
}
function sheet(html) { const el = document.getElementById('hsheet'); el.innerHTML = `<div class="hsbox">${html}<button class="ghost hsclose" id="hsClose">Close</button></div>`; el.hidden = false; document.getElementById('hsClose').onclick = () => { el.hidden = true; }; el.onclick = e => { if (e.target === el) el.hidden = true; }; return el; }
function playChooser() {
  const cp = loadCheckpoint(), endless = storyFlag('ozEndless');
  if (!cp && !endless) { HOME.on = false; newRun(null); return; }
  const el = sheet(`<h3>Play</h3>${cp ? `<button class="primary" id="pCont">Continue · wave ${cp.wave}<small>${cp.endless ? 'Endless' : AREAS[areaIndex(cp.wave)].name}</small></button>` : ''}
    <button class="${cp ? 'ghost' : 'primary'}" id="pNew">New story<small>from St. Mercy, wave 1</small></button>${endless ? '<button class="ghost" id="pEnd">Endless mode<small>the districts loop, bosses grow</small></button>' : ''}`);
  const go = (c, o) => { el.hidden = true; HOME.on = false; newRun(c, o); };
  if (cp) document.getElementById('pCont').onclick = () => go(cp);
  document.getElementById('pNew').onclick = () => go(null);
  if (endless) document.getElementById('pEnd').onclick = () => go(null, {endless: true});
}
function settingsSheet() {
  const el = sheet(`<h3>Settings</h3><button class="ghost" id="sVox">${voiceLabel()}</button><button class="ghost" id="sHap">${hapLabel()}</button><button class="ghost" id="sHow">How to play (training)</button>
    <p class="hcred">Models: Quaternius (CC0) · Sound: Meta Oculus Audio Pack (CC BY 4.0) · Voices: Piper, LibriTTS (CC BY 4.0)</p>`);
  document.getElementById('sVox').onclick = e => { VOICE.toggle(); e.target.textContent = voiceLabel(); };
  document.getElementById('sHap').onclick = e => { HAPTIC.toggle(); e.target.textContent = hapLabel(); };
  document.getElementById('sHow').onclick = () => { el.hidden = true; HOME.on = false; newRun(null, {tutorial: true}); };
}

// ---------- shop ----------
const COS_ICON = {
  hat: c => `<svg viewBox="0 0 40 40"><path d="M6 28h28l-3-4H9z" fill="#${c.col.toString(16).padStart(6, '0')}"/><path d="M11 24c0-9 4-14 9-14s9 5 9 14z" fill="#${c.col.toString(16).padStart(6, '0')}"/></svg>`,
  outfit: c => `<svg viewBox="0 0 40 40"><path d="M12 8l-7 6 4 5 3-2v15h16V17l3 2 4-5-7-6-4 3h-8z" fill="${c.colors.top}"/><rect x="12" y="30" width="16" height="6" fill="${c.colors.bottom}"/></svg>`,
  skin: c => `<svg viewBox="0 0 40 40"><path d="M30 4l6 6-20 20-6 2 2-6z" fill="#${c.col.toString(16).padStart(6, '0')}" stroke="#fff" stroke-width="1"/><path d="M8 28l4 4-4 4-4-4z" fill="#6a5a4a"/></svg>`,
  trail: c => `<svg viewBox="0 0 40 40"><defs><linearGradient id="tg${c.id}"><stop offset="0" stop-color="${c.col === 'rainbow' ? '#ff4040' : '#' + c.col.toString(16).padStart(6, '0')}" stop-opacity="0"/><stop offset="1" stop-color="${c.col === 'rainbow' ? '#40a0ff' : '#' + c.col.toString(16).padStart(6, '0')}"/></linearGradient></defs><path d="M4 30C14 10 26 8 36 8c-8 6-14 14-16 26z" fill="url(#tg${c.id})"/></svg>`,
  aura: c => `<svg viewBox="0 0 40 40">${[[10, 12], [28, 8], [32, 26], [8, 30], [20, 20], [22, 34]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${2 + i % 3}" fill="${c.cols[i % 2]}"/>`).join('')}</svg>`,
};
function openShop(tab) {
  if (tab) HOME.tab = tab; HOME.shop = true;
  const el = document.getElementById('shop'); el.hidden = false; renderShop(); AU.play('cardOpen', {vol: .6});
}
function renderShop() {
  const el = document.getElementById('shop');
  const body = HOME.tab === 'safe' ? `<p class="shint">Coins you pick up stay with you, even when you fall. Perks here last forever.</p><div class="sgrid">${SAFE.map(s => {
      const lv = safeLv(s.id), max = lv >= s.max, cost = s.cost[lv];
      return `<div class="sitem${max ? ' maxed' : ''}"><div class="sic">${emblem(s.icon, 'defense')}</div><div class="sinfo"><b>${s.name}</b><span>${s.desc}</span>
        <i class="spips">${Array.from({length: s.max}, (_, i) => `<em class="${i < lv ? 'on' : ''}"></em>`).join('')}</i></div>
        <button class="sbuy" data-safe="${s.id}" ${max || META.coins < cost ? 'disabled' : ''}>${max ? 'MAX' : `<i class="ccoin"></i>${fmt(cost)}`}</button></div>`; }).join('')}</div>`
    : `<div class="ctabs">${COS_TABS.map(([k, n]) => `<button class="${HOME.cos === k ? 'on' : ''}" data-cos="${k}">${n}</button>`).join('')}</div>
      <p class="shint">Emeralds are rare: about 1 in 60 zombies, and every boss drops some.</p>
      <div class="cgrid">${COSMETICS[HOME.cos].map(c => { const own = ownsCos(HOME.cos, c.id), on = META.equip[HOME.cos] === c.id;
        return `<button class="citem${on ? ' on' : ''}${own ? ' own' : ''}" data-kind="${HOME.cos}" data-id="${c.id}"><span class="cic">${COS_ICON[HOME.cos](c)}</span><b>${c.name}</b>
          <span class="cprice">${on ? 'EQUIPPED' : own ? 'EQUIP' : `<i class="cgem"></i>${c.cost}`}</span></button>`; }).join('')}</div>`;
  el.innerHTML = `<div class="spanel"><div class="shead"><h2>SHOP</h2><div class="hwallet">${walletHTML()}</div><button class="ghost" id="sBack">✕</button></div>
    <div class="stabs"><button class="${HOME.tab === 'safe' ? 'on' : ''}" data-tab="safe"><i class="ccoin"></i>SAFEHOUSE</button><button class="${HOME.tab === 'locker' ? 'on' : ''}" data-tab="locker"><i class="cgem"></i>LOCKER</button></div>${body}</div>`;
  document.getElementById('sBack').onclick = closeShop;
  const hw = document.querySelector('#home .hwallet'); if (hw) hw.innerHTML = walletHTML();
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { HOME.tab = b.dataset.tab; AU.play('cardHover', {vol: .4}); renderShop(); });
  el.querySelectorAll('[data-cos]').forEach(b => b.onclick = () => { HOME.cos = b.dataset.cos; AU.play('cardHover', {vol: .4}); renderShop(); });
  el.querySelectorAll('[data-safe]').forEach(b => b.onclick = () => { if (buySafe(b.dataset.safe)) { AU.play('coin', {vol: .8}); AU.play('levelUp', {vol: .6}); HAPTIC.fx('card'); shopBurst(b, '#ffc83a'); renderShop(); } });
  el.querySelectorAll('.citem').forEach(b => b.onclick = () => {
    const k = b.dataset.kind, id = b.dataset.id;
    if (ownsCos(k, id)) { equipCos(k, id); AU.play('cardPick', {vol: .6}); }
    else if (buyCos(k, id)) { applyCosmetics(); AU.play('levelUp', {vol: .8}); AU.play('heart', {vol: .5, rate: 1.5}); HAPTIC.fx('card'); shopBurst(b, '#30e070'); const P = G.player; ring(P.x, P.z, 2, 0x30e070, .5); }
    else { AU.play('cardHover', {vol: .5, rate: .6}); b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 400); return; }
    renderShop();
  });
}
function shopBurst(el, col) { const r = el.getBoundingClientRect(); for (let i = 0; i < 14; i++) { const sp = document.createElement('i'); sp.className = 'flyspark'; sp.style.left = r.left + r.width / 2 + 'px'; sp.style.top = r.top + r.height / 2 + 'px'; sp.style.background = col; sp.style.setProperty('--sx', (Math.random() - .5) * 140 + 'px'); sp.style.setProperty('--sy', (Math.random() - .5) * 100 + 'px'); document.body.appendChild(sp); setTimeout(() => sp.remove(), 520); } }
function closeShop() { HOME.shop = false; document.getElementById('shop').hidden = true; if (HOME.on) showHome(); }
// the camera frames the survivor on the home screen
function homeCamera(raw) {
  const P = G.player; HOME.spin += raw * .35; P.face = Math.PI / 2 + Math.sin(HOME.spin) * .6;
  const narrow = W < H, x = HOME.shop && !narrow ? P.x - 1.2 : P.x, d = narrow ? 4.6 : 3.8;
  camera.position.set(x + .2, 1.45, P.z + d); camera.lookAt(x, narrow ? 1.25 : 1.0, P.z);
}
