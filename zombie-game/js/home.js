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
  AU.play('cardOpen', {vol: .5}); showUpdate(); checkUpdate();
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
// Item pictures are real 3D renders: the hat meshes, the survivor in each outfit, the weapon in each skin.
const THUMB = {};
function renderThumbs() {
  if (THUMB.done) return; THUMB.done = true;
  const size = 200, r = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
  r.setSize(size, size); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .01, 50);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x3a4050, 1.1)); const key = new THREE.DirectionalLight(0xfff0dd, 2.2); key.position.set(2, 3, 4); sc.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 1.8); rim.position.set(-3, 2, -3); sc.add(rim);
  const shot = (obj, k, fit = 2.1, tilt = .35) => {
    const g = new THREE.Group(); g.add(obj); sc.add(g); g.rotation.set(tilt, .6, 0); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    obj.position.sub(c.clone().applyQuaternion(g.quaternion.clone().invert())); const L = Math.max(sz.x, sz.y, sz.z);
    cam.position.set(0, 0, L * fit); cam.lookAt(0, 0, 0); r.render(sc, cam); THUMB[k] = r.domElement.toDataURL('image/png'); sc.remove(g);
  };
  for (const h of COSMETICS.hat) shot(hatMesh(h), 'hat:' + h.id, 2.3, .45);
  const P = G.player, wm = P && P.wMesh;
  if (wm) for (const sk of COSMETICS.skin) { const m = wm.clone(); m.position.set(0, 0, 0); m.rotation.set(0, 0, Math.PI / 4); m.scale.set(1, 1, 1);
    m.material = new THREE.MeshStandardMaterial({color: new THREE.Color(sk.col).convertSRGBToLinear(), metalness: Math.min(.6, sk.metal), roughness: sk.rough, emissive: new THREE.Color(sk.glow || 0), emissiveIntensity: sk.glow ? .8 : 0}); shot(m, 'skin:' + sk.id, 1.9, .2); }
  // the survivor wearing each outfit, full body, standing
  const name = 'Characters_' + (MODELS['Characters_' + LOOK.char] ? LOOK.char : 'Matt');
  for (const o of COSMETICS.outfit) {
    const rig = new Rig(name); scene.remove(rig.root); applyLook(rig, Object.assign({}, LOOK, {colors: Object.assign({}, LOOK.colors, o.colors)}));
    rig.model.traverse(x => { if (WEAPON_MESHES.includes(x.name)) x.visible = false; }); rig.play('Idle', {fade: 0}); rig.mixer.update(.4);
    shot(rig.root, 'outfit:' + o.id, 1.55, .05); rig.mixer.stopAllAction();
  }
  r.dispose();
}
const hex = c => '#' + (c === 'rainbow' ? 'ffffff' : c.toString(16).padStart(6, '0'));
function cosArt(kind, c) {
  if (THUMB[kind + ':' + c.id]) return `<img src="${THUMB[kind + ':' + c.id]}" alt="">`;
  if (kind === 'trail') { const grad = c.col === 'rainbow' ? '#ff4040,#ffcc33,#40ff80,#40a0ff,#c040ff' : `transparent,${hex(c.col)}`;
    return `<span class="trailart" style="--g:linear-gradient(90deg,${grad});--gc:${c.col === 'rainbow' ? '#ff80ff' : hex(c.col)}"><i></i><b></b></span>`; }
  if (kind === 'aura') return `<span class="auraart" style="--a1:${c.cols[0]};--a2:${c.cols[1]}">${Array.from({length: 9}, (_, i) => `<i style="--x:${10 + (i * 37) % 80}%;--d:${(i * .27) % 2}s;--s:${4 + i % 3 * 2}px"></i>`).join('')}<b></b></span>`;
  return '';
}
function openShop(tab) {
  if (tab) HOME.tab = tab; HOME.shop = true; HOME.sel = null; HOME.try = null;
  const el = document.getElementById('shop'); el.hidden = false; renderThumbs(); renderShop(); AU.play('cardOpen', {vol: .6});
}
const PERK_TAG = {jacket: 'ARMOR', sharpen: 'WEAPON', locker: 'GEAR', charm: 'LUCK', wind: 'SURVIVAL', scav: 'LOOT', dice: 'LOOT'};
function renderShop() {
  const el = document.getElementById('shop'), tab = HOME.tab;
  const safe = `<div class="bpgrid">${SAFE.map(s => { const lv = safeLv(s.id), max = lv >= s.max, cost = s.cost[lv], poor = !max && META.coins < cost;
      return `<div class="bp${max ? ' maxed' : ''}"><div class="bptag">${PERK_TAG[s.id]}</div><div class="bpic">${emblem(s.icon, 'utility')}</div>
        <div class="bpname">${s.name}</div><div class="bpdesc">${s.desc}</div>
        <div class="bplv">${Array.from({length: s.max}, (_, i) => `<i class="${i < lv ? 'on' : ''}">${i + 1}</i>`).join('')}</div>
        ${max ? '<div class="stamp">MAXED</div>' : `<button class="build${poor ? ' poor' : ''}" data-safe="${s.id}"><span>${lv ? 'UPGRADE' : 'BUILD'}</span><b><i class="ccoin"></i>${fmt(cost)}</b></button>`}</div>`; }).join('')}</div>`;
  const kind = HOME.cos, sel = HOME.sel && COSMETICS[kind].find(c => c.id === HOME.sel);
  const locker = `<div class="cats">${COS_TABS.map(([k, n]) => `<button class="${kind === k ? 'on' : ''}" data-cos="${k}">${n}</button>`).join('')}</div>
    <div class="lockers">${COSMETICS[kind].map(c => { const own = ownsCos(kind, c.id), on = META.equip[kind] === c.id;
      return `<button class="lk${on ? ' on' : ''}${own ? ' own' : ''}${HOME.sel === c.id ? ' sel' : ''}" data-id="${c.id}"><span class="lkart">${cosArt(kind, c)}</span>
        <span class="tape">${c.name}</span>${on ? '<span class="lkst eq">EQUIPPED</span>' : own ? '<span class="lkst">OWNED</span>' : `<span class="price"><i class="cgem"></i>${c.cost}</span>`}</button>`; }).join('')}</div>
    <div class="trybar${sel ? ' on' : ''}">${sel ? (() => { const own = ownsCos(kind, sel.id), on = META.equip[kind] === sel.id;
      return `<span class="tryname"><small>TRYING ON</small>${sel.name}</span>${own ? `<button class="tbtn" id="tEquip">${on ? 'TAKE OFF' : 'EQUIP'}</button>` : `<button class="tbtn buy${META.gems < sel.cost ? ' poor' : ''}" id="tBuy">BUY <i class="cgem"></i>${sel.cost}</button>`}`; })() : '<span class="tryname"><small>TIP</small>Tap an item to try it on</span>'}</div>`;
  el.innerHTML = `<div class="spanel"><div class="hazard"></div>
    <div class="shead"><h2>${tab === 'safe' ? 'SAFEHOUSE' : 'LOCKER'}</h2><div class="hwallet">${walletHTML()}</div><button class="sx" id="sBack">✕</button></div>
    <div class="stabs"><button class="${tab === 'safe' ? 'on' : ''}" data-tab="safe"><i class="ccoin"></i><span>SAFEHOUSE<small>permanent perks</small></span></button>
      <button class="${tab === 'locker' ? 'on' : ''}" data-tab="locker"><i class="cgem"></i><span>LOCKER<small>gear to wear</small></span></button></div>
    <div class="sbody">${tab === 'safe' ? safe : locker}</div></div>`;
  const hw = document.querySelector('#home .hwallet'); if (hw) hw.innerHTML = walletHTML();
  document.getElementById('sBack').onclick = closeShop;
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { HOME.tab = b.dataset.tab; HOME.sel = null; HOME.try = null; applyCosmetics(); AU.play('cardHover', {vol: .4}); renderShop(); });
  el.querySelectorAll('[data-cos]').forEach(b => b.onclick = () => { HOME.cos = b.dataset.cos; HOME.sel = null; HOME.try = null; applyCosmetics(); AU.play('cardHover', {vol: .4}); renderShop(); });
  el.querySelectorAll('[data-safe]').forEach(b => b.onclick = () => {
    if (buySafe(b.dataset.safe)) { AU.play('coin', {vol: .8}); AU.play('levelUp', {vol: .6}); HAPTIC.fx('card'); shopBurst(b, '#ffc83a'); renderShop(); }
    else { b.classList.add('nope'); AU.play('cardHover', {vol: .5, rate: .6}); setTimeout(() => b.classList.remove('nope'), 400); } });
  el.querySelectorAll('.lk').forEach(b => b.onclick = () => { HOME.sel = b.dataset.id; HOME.try = {kind, id: b.dataset.id}; applyCosmetics(); AU.play('cardHover', {vol: .5}); const P = G.player; ring(P.x, P.z, 1.4, 0x30e070, .3); renderShop(); });
  const tb = document.getElementById('tBuy'); if (tb) tb.onclick = () => {
    if (buyCos(kind, HOME.sel)) { HOME.try = null; applyCosmetics(); AU.play('levelUp', {vol: .8}); AU.play('heart', {vol: .5, rate: 1.5}); HAPTIC.fx('card'); shopBurst(tb, '#30e070'); const P = G.player; ring(P.x, P.z, 2.2, 0x30e070, .5); boom(P.x, P.z, 0x30e070, 4); renderShop(); }
    else { tb.classList.add('nope'); AU.play('cardHover', {vol: .5, rate: .6}); setTimeout(() => tb.classList.remove('nope'), 400); } };
  const te = document.getElementById('tEquip'); if (te) te.onclick = () => { HOME.try = null; equipCos(kind, HOME.sel); AU.play('cardPick', {vol: .6}); renderShop(); };
}
function shopBurst(el, col) { const r = el.getBoundingClientRect(); for (let i = 0; i < 14; i++) { const sp = document.createElement('i'); sp.className = 'flyspark'; sp.style.left = r.left + r.width / 2 + 'px'; sp.style.top = r.top + r.height / 2 + 'px'; sp.style.background = col; sp.style.setProperty('--sx', (Math.random() - .5) * 140 + 'px'); sp.style.setProperty('--sy', (Math.random() - .5) * 100 + 'px'); document.body.appendChild(sp); setTimeout(() => sp.remove(), 520); } }
function closeShop() { HOME.shop = false; HOME.try = null; HOME.sel = null; applyCosmetics(); document.getElementById('shop').hidden = true; if (HOME.on) showHome(); }
// the camera frames the survivor on the home screen
function homeCamera(raw) {
  const P = G.player; HOME.spin += raw * .35; P.face = Math.PI / 2 + Math.sin(HOME.spin) * .6;
  const narrow = W < H, x = HOME.shop && !narrow ? P.x - 1.2 : P.x, d = narrow ? 4.6 : 3.8;
  // with the shop open on a phone, the survivor moves to the top third, above the sheet
  if (HOME.shop && narrow) { camera.position.set(x + .2, 2.2, P.z + 3.4); camera.lookAt(x, .05, P.z); return; }
  camera.position.set(x + .2, 1.45, P.z + d); camera.lookAt(x, narrow ? 1.25 : 1.0, P.z);
}
