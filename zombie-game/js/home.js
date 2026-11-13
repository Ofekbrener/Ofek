// Home screen between runs: the survivor in the middle wearing everything equipped, SHOP on the left, PLAY on the right.
// The shop has two tabs: the Safehouse (permanent perks for coins) and the Locker (cosmetics for emeralds).
'use strict';
const HOME = {on: false, tab: 'safe', cos: 'hat', spin: 0};
const firstTime = () => !STORY.seen() || !lookSaved() || !TUT_DONE();
const fmt = n => n.toLocaleString('en-US');
function walletHTML() { return `<span class="wc"><i class="ccoin"></i><span class="odo" data-v="${META.coins}">${META.coins}</span></span><span class="wg"><i class="cgem"></i><span class="odo" data-v="${META.gems}">${META.gems}</span></span>`; }
// wallet numbers roll from the last shown value  [UMP § Number Counter Part 1 › Odometer Roll]
HOME.shown = {c: null, g: null};
function rollWallet(root) {
  root.querySelectorAll('.hwallet').forEach(w => { const c = w.querySelector('.wc .odo'), g = w.querySelector('.wg .odo');
    const roll = (el, v, from) => { if (!el) return; if (!el.querySelector('.odo-col')) el.textContent = ''; UI.odo(el, v, from ?? v); };
    roll(c, META.coins, HOME.shown.c); roll(g, META.gems, HOME.shown.g); });
  HOME.shown.c = META.coins; HOME.shown.g = META.gems;
}
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
    <div class="hicons"><button id="hCustom" style="--i:0" aria-label="Customize survivor">${icon('survivor')}<small>Survivor</small></button><button id="hStory" style="--i:1" aria-label="Story">${icon('story')}<small>Story</small></button><button id="hSet" style="--i:2" aria-label="Settings">${icon('settings')}<small>Settings</small></button></div>
    <div class="hname"><b>${s.name}</b><span>${s.tag}</span>${best ? `<small>Best score ${fmt(best)}</small>` : ''}</div>
    <div class="hbtns"><button id="hShop" class="hbig shop">${icon('shop')}SHOP<small>Safehouse · Locker</small></button>
      <div class="play-wrap"><span class="play-halo" aria-hidden="true"></span><button id="hPlay" class="hbig play hero">${icon('play')}PLAY<small>${sub}</small></button></div></div>
    <div id="hsheet" hidden></div></div>`;
  ui.hidden = false; rollWallet(ui);
  document.getElementById('hShop').onclick = () => openShop();
  document.getElementById('hPlay').onclick = () => playChooser();
  document.getElementById('hCustom').onclick = () => { HOME.on = false; openCreator('menu'); };
  document.getElementById('hStory').onclick = () => { HOME.on = false; STORY.intro(showMenu); };
  document.getElementById('hSet').onclick = () => settingsSheet();
  AU.play('cardOpen', {vol: .5}); showUpdate(); checkUpdate();
}
function sheet(html) { const el = document.getElementById('hsheet'); el.innerHTML = `<div class="hsbox"><span class="hzstrip"></span>${html}<button class="ghost hsclose" id="hsClose">${icon('close')}Close</button></div>`; el.hidden = false; const close = () => { el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 240); };
  document.getElementById('hsClose').onclick = close; el.onclick = e => { if (e.target === el) close(); }; return el; }
function playChooser() {
  const cp = loadCheckpoint(), endless = storyFlag('ozEndless');
  if (!cp && !endless) { HOME.on = false; newRun(null); return; }
  const row = (id, ic, t, sub, main) => `<button class="row-btn${main ? ' main' : ''}" id="${id}"><span class="rico">${icon(ic)}</span><span class="rtx">${t}<small>${sub}</small></span>${icon('play')}</button>`;
  const el = sheet(`<h3>Play</h3>${cp ? row('pCont', 'map', 'Continue · wave ' + cp.wave, cp.endless ? 'Endless' : AREAS[areaIndex(cp.wave)].name, true) : ''}
    ${row('pNew', 'story', 'New story', 'from St. Mercy, wave 1', !cp)}${endless ? row('pEnd', 'infinity', 'Endless mode', 'the districts loop, bosses grow') : ''}`);
  const go = (c, o) => { el.hidden = true; HOME.on = false; newRun(c, o); };
  if (cp) document.getElementById('pCont').onclick = () => go(cp);
  document.getElementById('pNew').onclick = () => go(null);
  if (endless) document.getElementById('pEnd').onclick = () => go(null, {endless: true});
}
function settingsSheet() {
  const tog = on => `<span class="tog${on ? ' on' : ''}">${on ? 'ON' : 'OFF'}</span>`;
  const el = sheet(`<h3>Settings</h3><button class="row-btn" id="sVox"><span class="rico">${icon('radio')}</span><span class="rtx">Radio voices<small>Doc, the army and the narrator</small></span>${tog(VOICE.on)}</button>
    <button class="row-btn" id="sHap"><span class="rico">${icon('vibrate')}</span><span class="rtx">Vibration<small>on hits, kills and damage</small></span>${tog(HAPTIC.on)}</button>
    <button class="row-btn" id="sHow"><span class="rico">${icon('train')}</span><span class="rtx">How to play<small>replay the training run</small></span>${icon('play')}</button>
    <p class="hcred">Models: Quaternius (CC0) · Sound: Meta Oculus Audio Pack (CC BY 4.0) · Voices: Piper, LibriTTS (CC BY 4.0) · Fonts: SIL OFL</p>`);
  const setTog = (id, on) => { document.querySelector('#' + id + ' .tog').outerHTML = tog(on); };
  document.getElementById('sVox').onclick = () => { VOICE.toggle(); setTog('sVox', VOICE.on); };
  document.getElementById('sHap').onclick = () => { HAPTIC.toggle(); setTog('sHap', HAPTIC.on); };
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
  const el = document.getElementById('shop'); el.hidden = false; ui.classList.add('shopping'); renderThumbs(); renderShop(); AU.play('cardOpen', {vol: .6});
}
const PERK_TAG = {jacket: 'ARMOR', sharpen: 'WEAPON', locker: 'GEAR', charm: 'LUCK', wind: 'SURVIVAL', scav: 'LOOT', dice: 'LOOT'};
function renderShop() {
  const el = document.getElementById('shop'), tab = HOME.tab;
  const safe = `<div class="bpgrid">${SAFE.map((s, i) => { const lv = safeLv(s.id), max = lv >= s.max, cost = s.cost[lv], poor = !max && META.coins < cost;
      return `<div class="bp${max ? ' maxed' : ''}" style="--i:${i}"><div class="bptag">${PERK_TAG[s.id]}</div><div class="bpic">${emblem(s.icon, 'utility')}</div>
        <div class="bpname">${s.name}</div><div class="bpdesc">${s.desc}</div>
        <div class="bplv">${Array.from({length: s.max}, (_, i) => `<i class="${i < lv ? 'on' : ''}">${i + 1}</i>`).join('')}</div>
        ${max ? `<div class="stamp">${icon('check')}MAXED</div>` : `<button class="build${poor ? ' poor' : ''}" data-safe="${s.id}"><span>${lv ? 'UPGRADE' : 'BUILD'}</span><b><i class="ccoin"></i>${fmt(cost)}</b></button>`}</div>`; }).join('')}</div>`;
  const kind = HOME.cos, sel = HOME.sel && COSMETICS[kind].find(c => c.id === HOME.sel);
  const enter = HOME.enterKey !== tab + kind ? ' enter' : ''; HOME.enterKey = tab + kind; // items stagger in only when the list changes
  const locker = `<div class="cats">${COS_TABS.map(([k, n]) => `<button class="${kind === k ? 'on' : ''}" data-cos="${k}">${n}</button>`).join('')}</div>
    <div class="lockers">${COSMETICS[kind].map((c, i) => { const own = ownsCos(kind, c.id), on = META.equip[kind] === c.id;
      return `<button class="lk${on ? ' on' : ''}${own ? ' own' : ''}${HOME.sel === c.id ? ' sel' : ''}" data-id="${c.id}" style="--i:${i}"><span class="lkart">${cosArt(kind, c)}</span>
        <span class="tape">${c.name}</span>${on ? '<span class="lkst eq">EQUIPPED</span>' : own ? '<span class="lkst">OWNED</span>' : `<span class="price"><i class="cgem"></i>${c.cost}</span>`}</button>`; }).join('')}</div>
    <div class="trybar${sel ? ' on' : ''}">${sel ? (() => { const own = ownsCos(kind, sel.id), on = META.equip[kind] === sel.id;
      return `<span class="tryname"><small>TRYING ON</small>${sel.name}</span>${own ? `<button class="tbtn" id="tEquip">${on ? 'TAKE OFF' : 'EQUIP'}</button>` : `<button class="tbtn buy${META.gems < sel.cost ? ' poor' : ''}" id="tBuy">BUY <i class="cgem"></i>${sel.cost}</button>`}`; })() : '<span class="tryname"><small>TIP</small>Tap an item to try it on</span>'}</div>`;
  el.innerHTML = `<div class="spanel"${HOME.shopOpen ? ' style="animation:none"' : ''}><div class="hazard"></div>
    <div class="shead"><h2>${tab === 'safe' ? 'SAFEHOUSE' : 'LOCKER'}</h2><div class="hwallet">${walletHTML()}</div><button class="sx" id="sBack" aria-label="Close">${icon('close')}</button></div>
    <div class="stabs"><span class="seg-pill snap"></span><button class="${tab === 'safe' ? 'on' : ''}" data-tab="safe"><i class="ccoin"></i><span>SAFEHOUSE<small>permanent perks</small></span></button>
      <button class="${tab === 'locker' ? 'on' : ''}" data-tab="locker"><i class="cgem"></i><span>LOCKER<small>gear to wear</small></span></button></div>
    <div class="sbody${enter}">${tab === 'safe' ? safe : locker}</div></div>`;
  HOME.shopOpen = true; rollWallet(document);
  // tab pill: starts on the previous tab, then each edge springs to the new one  [UMP § Tab Bar Part 1 › Sliding Pill]
  const pill = el.querySelector('.seg-pill'), bar = pill.parentElement.getBoundingClientRect(), place = b => { const r = b.getBoundingClientRect(); return [r.left - bar.left, r.right - bar.left]; };
  const tabs = [...el.querySelectorAll('[data-tab]')], to = place(tabs.find(b => b.dataset.tab === tab)), from = HOME.pillTab ? place(tabs.find(b => b.dataset.tab === HOME.pillTab)) : to;
  pill.style.setProperty('--l', from[0] + 'px'); pill.style.setProperty('--r', from[1] + 'px'); void pill.offsetWidth;
  pill.classList.remove('snap'); pill.classList.toggle('to-right', to[0] > from[0]); pill.classList.toggle('to-left', to[0] <= from[0]);
  requestAnimationFrame(() => { pill.style.setProperty('--l', to[0] + 'px'); pill.style.setProperty('--r', to[1] + 'px'); }); HOME.pillTab = tab;
  document.getElementById('sBack').onclick = closeShop;
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { HOME.tab = b.dataset.tab; HOME.sel = null; HOME.try = null; applyCosmetics(); AU.play('cardHover', {vol: .4}); renderShop(); });
  el.querySelectorAll('[data-cos]').forEach(b => b.onclick = () => { HOME.cos = b.dataset.cos; HOME.sel = null; HOME.try = null; applyCosmetics(); AU.play('cardHover', {vol: .4}); renderShop(); });
  el.querySelectorAll('[data-safe]').forEach(b => b.onclick = () => {
    if (buySafe(b.dataset.safe)) { AU.play('coin', {vol: .8}); AU.play('levelUp', {vol: .6}); HAPTIC.fx('card'); shopBurst(b, '#ffc83a'); renderShop(); }
    else { denyBuy(b, SAFE.find(s => s.id === b.dataset.safe), 'coins'); } });
  el.querySelectorAll('.lk').forEach(b => b.onclick = () => { HOME.sel = b.dataset.id; HOME.try = {kind, id: b.dataset.id}; applyCosmetics(); AU.play('cardHover', {vol: .5}); const P = G.player; ring(P.x, P.z, 1.4, 0x30e070, .3); renderShop(); });
  const tb = document.getElementById('tBuy'); if (tb) tb.onclick = () => {
    if (buyCos(kind, HOME.sel)) { HOME.try = null; applyCosmetics(); AU.play('levelUp', {vol: .8}); AU.play('heart', {vol: .5, rate: 1.5}); HAPTIC.fx('card'); shopBurst(tb, '#30e070'); const P = G.player; ring(P.x, P.z, 2.2, 0x30e070, .5); boom(P.x, P.z, 0x30e070, 4); renderShop(); }
    else { denyBuy(tb, COSMETICS[kind].find(c => c.id === HOME.sel), 'gems'); } };
  const te = document.getElementById('tEquip'); if (te) te.onclick = () => { HOME.try = null; equipCos(kind, HOME.sel); AU.play('cardPick', {vol: .6}); renderShop(); };
}
// not enough money: decaying shake, red border, and how much is missing slides in  [UMP § Error Part 1 › Shake Input]
function denyBuy(btn, item, cur) {
  AU.play('cardHover', {vol: .5, rate: .6}); UI.shake(btn, 14); btn.classList.add('is-error'); setTimeout(() => btn.classList.remove('is-error'), 1300);
  const cost = cur === 'coins' ? item.cost[safeLv(item.id)] : item.cost, have = cur === 'coins' ? META.coins : META.gems;
  const box = btn.parentElement; let m = box.querySelector('.need'); if (!m) { m = document.createElement('span'); m.className = 'need'; box.appendChild(m); }
  m.textContent = `Need ${cost - have} more ${cur === 'coins' ? 'coins' : 'emeralds'}`; m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
}
function shopBurst(el, col) { const r = el.getBoundingClientRect(); for (let i = 0; i < 14; i++) { const sp = document.createElement('i'); sp.className = 'flyspark'; sp.style.left = r.left + r.width / 2 + 'px'; sp.style.top = r.top + r.height / 2 + 'px'; sp.style.background = col; sp.style.setProperty('--sx', (Math.random() - .5) * 140 + 'px'); sp.style.setProperty('--sy', (Math.random() - .5) * 100 + 'px'); document.body.appendChild(sp); setTimeout(() => sp.remove(), 520); } }
function closeShop() { HOME.shopOpen = false; HOME.pillTab = null; HOME.enterKey = null; HOME.shop = false; HOME.try = null; HOME.sel = null; applyCosmetics(); document.getElementById('shop').hidden = true; ui.classList.remove('shopping'); if (HOME.on) showHome(); }
// the camera frames the survivor on the home screen
function homeCamera(raw) {
  const P = G.player; HOME.spin += raw * .35; P.face = Math.PI / 2 + Math.sin(HOME.spin) * .6;
  const narrow = W < H, x = HOME.shop && !narrow ? P.x - 1.2 : P.x, d = narrow ? 4.6 : 3.8;
  // with the shop open on a phone, the survivor moves to the top third, above the sheet
  if (HOME.shop && narrow) { camera.position.set(x + .2, 2.2, P.z + 3.4); camera.lookAt(x, .05, P.z); return; }
  camera.position.set(x + .2, 1.45, P.z + d); camera.lookAt(x, narrow ? 1.25 : 1.0, P.z);
}
