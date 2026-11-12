// Upgrade draft: after each wave pick 1 of 3 cards. Coins pay for rerolls.
// Weapon cards show a 3D render of the actual weapon model; perk cards use hand-drawn SVG emblems.
'use strict';
const UP = {};
function resetUpgrades() {
  Object.assign(UP, {dmg: 0, atkSpeed: 1, range: 1, move: 1, crit: 0, slam: 1, dash: false, fire: false, chain: false,
    explosive: false, magnet: false, thorns: false, lifesteal: false, horde: false, infuse: null, taken: []});
}
resetUpgrades();

// ---------- weapon art: render each kit weapon mesh once to an image ----------
const WEAPON_ART = {}, WEAPON_IMG = {};
function renderWeaponArt() {
  const size = 320, r = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
  r.setSize(size, size); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.3;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .01, 50);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.1));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.2); key.position.set(2, 3, 4); sc.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-3, 1, -3); sc.add(rim);
  for (const name of Object.keys(WEAPONS)) {
    let src = null; MODELS.Characters_Matt.scene.traverse(o => { if (o.name === name && o.isMesh) src = o; });
    if (!src) continue;
    const m = src.clone(); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    const g = new THREE.Group(); g.add(m); sc.add(g);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    m.position.sub(c); const L = Math.max(s.x, s.y, s.z);
    // lay the longest axis along the card diagonal
    if (s.y >= s.x && s.y >= s.z) g.rotation.set(.35, .5, -Math.PI / 4); else if (s.x >= s.z) g.rotation.set(.35, .5, Math.PI / 4); else g.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    cam.position.set(0, 0, L * 1.95); cam.lookAt(0, 0, 0);
    r.render(sc, cam); WEAPON_ART[name] = r.domElement.toDataURL('image/png');
    const img = new Image(); img.src = WEAPON_ART[name]; WEAPON_IMG[name] = img;
    sc.remove(g);
  }
  r.dispose();
}

// ---------- perk emblems (64x64 SVG) ----------
const SVG = {
  dmg: '<path d="M32 4l5 15 15-6-8 14 15 6-15 5 6 15-14-8-6 15-5-15-15 6 8-14-15-6 15-5-6-15 14 8z" fill="url(#g)"/><path d="M14 52L44 22l4 4-30 30-6 2z" fill="#fff" opacity=".95"/><path d="M42 18l8-2-2 8z" fill="#fff"/>',
  spd: '<path d="M30 4L10 36h14l-6 24 28-36H32l8-20z" fill="url(#g)"/><path d="M48 14l-8 14h6l-3 12 12-16h-6l4-10z" fill="#fff" opacity=".8"/>',
  rng: '<path d="M6 32l12-12v8h28v-8l12 12-12 12v-8H18v8z" fill="url(#g)"/><path d="M22 48v8M32 46v10M42 48v8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>',
  hp: '<path d="M32 56S6 40 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 18-26 34-26 34z" fill="url(#g)"/><path d="M32 22v18M23 31h18" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
  heal: '<rect x="8" y="16" width="48" height="38" rx="7" fill="url(#g)"/><path d="M24 16v-6h16v6" fill="none" stroke="#fff" stroke-width="4"/><path d="M32 25v20M22 35h20" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  move: '<path d="M14 44c10 0 14-6 16-14l6-14 10 4-4 12c-2 6 2 10 8 10h6v8H14z" fill="url(#g)"/><path d="M4 26h14M2 34h12M6 42h8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>',
  crit: '<circle cx="32" cy="32" r="22" fill="none" stroke="url(#g)" stroke-width="6"/><circle cx="32" cy="32" r="9" fill="none" stroke="url(#g)" stroke-width="5"/><path d="M32 2v14M32 48v14M2 32h14M48 32h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="#fff"/>',
  slam: '<path d="M22 4h20v20l8 6H14l8-6z" fill="url(#g)"/><path d="M32 34l-4 10 6 4-4 12M18 46l-10 6M46 46l10 6M12 38l-8-2M52 38l8-2" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/>',
  dash: '<path d="M8 14l16 18-16 18h10l16-18-16-18zM28 14l16 18-16 18h10l16-18-16-18z" fill="url(#g)"/><path d="M46 14l14 18-14 18" stroke="#fff" stroke-width="4" fill="none" opacity=".6"/>',
  magnet: '<path d="M10 8h14v24a8 8 0 0 0 16 0V8h14v24a22 22 0 0 1-44 0z" fill="url(#g)"/><rect x="10" y="8" width="14" height="9" fill="#fff"/><rect x="40" y="8" width="14" height="9" fill="#fff"/>',
  thorns: '<path d="M32 2l5 12 11-7-2 13 13-1-8 10 11 7-12 4 6 12-13-3-1 13-9-9-9 9-1-13-13 3 6-12-12-4 11-7-8-10 13 1-2-13 11 7z" fill="url(#g)"/><circle cx="32" cy="32" r="11" fill="#1a1d28"/><circle cx="32" cy="32" r="5" fill="#fff"/>',
  life: '<path d="M32 4C22 22 12 32 12 42a20 20 0 0 0 40 0C52 32 42 22 32 4z" fill="url(#g)"/><path d="M22 40l4 10 4-10M34 40l4 10 4-10" fill="#fff"/><path d="M20 38h24" stroke="#fff" stroke-width="3"/>',
  fire: '<path d="M32 2c4 12 18 18 18 34a18 18 0 0 1-36 0c0-10 6-14 8-22 4 6 4 10 8 12 2-8 0-16 2-24z" fill="url(#g)"/><path d="M32 30c3 7 10 9 10 18a10 10 0 0 1-20 0c0-6 4-8 6-14 2 4 2 6 4 7z" fill="#fff" opacity=".85"/>',
  chain: '<path d="M18 26a12 12 0 0 1 22-8 10 10 0 0 1 14 12H14a7 7 0 0 1 4-4z" fill="url(#g)"/><path d="M30 34l-8 14h8l-4 14 14-18h-8l6-10z" fill="#fff"/><path d="M48 38l-4 8h4l-2 6" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>',
  frost: '<path d="M32 2v60M6 17l52 30M6 47l52-30" stroke="url(#g)" stroke-width="6" stroke-linecap="round"/><path d="M24 8l8 8 8-8M24 56l8-8 8 8M8 27l11-1-4-10M56 37l-11 1 4 10M8 37l11 1-4 10M56 27l-11-1 4-10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
  boom: '<circle cx="28" cy="38" r="20" fill="url(#g)"/><path d="M40 20l6-6" stroke="#fff" stroke-width="5"/><path d="M50 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffe14a"/><circle cx="21" cy="31" r="5" fill="#fff" opacity=".5"/>',
};
const CAT_COL = {offense: ['#ffb36b', '#ff3c3c'], defense: ['#9dff9d', '#18b04a'], utility: ['#9fdcff', '#2a7cff'], epic: ['#ffd36b', '#b03cff']};
function emblem(icon, cat) {
  const [a, b] = CAT_COL[cat];
  const id = 'g_' + icon; // unique per emblem: gradient ids are global in the document
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${SVG[icon].replaceAll('url(#g)', `url(#${id})`)}</svg>`;
}

// ---------- the card pool ----------
const pct = v => Math.round(v * 100) + '%';
const SPEED_WORD = s => s >= 1.3 ? 'FAST' : s >= 1 ? 'MEDIUM' : 'SLOW';
const CARDS = [
  ...Object.keys(WEAPONS).filter(k => k !== 'Knife').map(k => ({id: 'w_' + k, weapon: k, cat: 'offense', rarity: k === 'Axe' || k === 'Guitar' ? 'rare' : 'common',
    title: WEAPONS[k].name, flavor: `${WEAPONS[k].desc} Finisher: ${WEAPONS[k].fin}, ${WEAPONS[k].finText}.`, ok: () => G.player.weapon !== k, apply: () => equipWeapon(k)})),
  {id: 'dmg', cat: 'offense', icon: 'dmg', rarity: 'common', title: 'HEAVY HANDS', flavor: 'Every hit lands harder.', stat: () => [['Damage', `+${UP.dmg}`, `+${UP.dmg + 1}`]], apply: () => UP.dmg++},
  {id: 'spd', cat: 'offense', icon: 'spd', rarity: 'common', title: 'QUICK HANDS', flavor: 'Swing before they swing.', stat: () => [['Attack speed', pct(UP.atkSpeed), pct(UP.atkSpeed * 1.15)]], apply: () => UP.atkSpeed *= 1.15},
  {id: 'rng', cat: 'offense', icon: 'rng', rarity: 'common', title: 'LONG REACH', flavor: 'Keep them at arm\'s length.', stat: () => [['Reach', pct(UP.range), pct(UP.range * 1.2)]], apply: () => UP.range *= 1.2},
  {id: 'hp', cat: 'defense', icon: 'hp', rarity: 'common', title: 'TOUGH SKIN', flavor: 'Bites hurt less when there is more of you.', stat: () => [['Max hearts', G.player.maxHp, G.player.maxHp + 1]], apply: () => { G.player.maxHp++; G.player.hp++; }},
  {id: 'heal', cat: 'defense', icon: 'heal', rarity: 'common', title: 'FIRST AID', flavor: 'Patch up between waves.', ok: () => G.player.hp < G.player.maxHp, stat: () => [['Hearts', G.player.hp, Math.min(G.player.maxHp, G.player.hp + 3)]], apply: () => G.player.hp = Math.min(G.player.maxHp, G.player.hp + 3)},
  {id: 'move', cat: 'utility', icon: 'move', rarity: 'common', title: 'SPRINTER', flavor: 'Outrun the horde.', stat: () => [['Move speed', pct(UP.move), pct(UP.move * 1.12)]], apply: () => UP.move *= 1.12},
  {id: 'crit', cat: 'offense', icon: 'crit', rarity: 'rare', title: 'WEAK SPOTS', flavor: 'Aim for the soft parts.', stat: () => [['Double damage', pct(UP.crit), pct(UP.crit + .15)]], apply: () => UP.crit += .15},
  {id: 'slam', cat: 'offense', icon: 'slam', rarity: 'rare', title: 'METEOR SLAM', flavor: 'Jump, attack, crater.', stat: () => [['Slam radius', (3.2 * UP.slam).toFixed(1) + ' m', (4.8 * UP.slam).toFixed(1) + ' m']], apply: () => UP.slam *= 1.5},
  {id: 'dash', cat: 'utility', icon: 'dash', rarity: 'rare', title: 'DASH', flavor: 'Shift or the DASH button. Untouchable for a moment.', once: true, stat: () => [['Dodge', 'none', '0.3 s safe']], apply: () => UP.dash = true},
  {id: 'magnet', cat: 'utility', icon: 'magnet', rarity: 'common', title: 'COIN MAGNET', flavor: 'Coins come to you. Spend them on rerolls.', once: true, stat: () => [['Pickup range', '2 m', '4.5 m']], apply: () => UP.magnet = true},
  {id: 'thorns', cat: 'defense', icon: 'thorns', rarity: 'rare', title: 'SPIKED ARMOR', flavor: 'Bite me. Go on.', once: true, stat: () => [['Damage back', '0', '2 per hit']], apply: () => UP.thorns = true},
  {id: 'life', cat: 'defense', icon: 'life', rarity: 'rare', title: 'BLOODLUST', flavor: 'The more you kill, the better you feel.', once: true, stat: () => [['Heal', 'none', '1 per 12 kills']], apply: () => UP.lifesteal = true},
  {id: 'inf_fire', cat: 'epic', icon: 'fire', rarity: 'epic', title: 'FIRE INFUSION', flavor: 'Your weapon burns. Every hit sets zombies on fire.', ok: () => UP.infuse !== 'fire', stat: () => [['Weapon', UP.infuse ? INFUSE[UP.infuse].name.toLowerCase() : 'plain', 'burning']], apply: () => UP.infuse = 'fire'},
  {id: 'inf_frost', cat: 'epic', icon: 'frost', rarity: 'epic', title: 'FROST INFUSION', flavor: 'Hits slow zombies by half. Frozen ones shatter.', ok: () => UP.infuse !== 'frost', stat: () => [['Weapon', UP.infuse ? INFUSE[UP.infuse].name.toLowerCase() : 'plain', 'freezing']], apply: () => UP.infuse = 'frost'},
  {id: 'inf_storm', cat: 'epic', icon: 'chain', rarity: 'epic', title: 'STORM INFUSION', flavor: 'Every 3rd hit arcs lightning into 2 more zombies.', ok: () => UP.infuse !== 'storm', stat: () => [['Weapon', UP.infuse ? INFUSE[UP.infuse].name.toLowerCase() : 'plain', 'lightning']], apply: () => UP.infuse = 'storm'},
  {id: 'boom', cat: 'epic', icon: 'boom', rarity: 'epic', title: 'VOLATILE', flavor: 'Some of them just... pop.', once: true, stat: () => [['Kill explodes', '0%', '15%']], apply: () => UP.explosive = true},
];
const RARITY_W = {common: 10, rare: 5, epic: 2};
const DRAFT = {cards: [], rerollCost: 10, el: null};
function rollCards() {
  const pool = CARDS.filter(c => (!c.once || !UP.taken.includes(c.id)) && (!c.ok || c.ok()));
  const w = c => RARITY_W[c.rarity] * (c.rarity === 'epic' ? 1 + G.wave * .15 : 1) * (c.weapon ? 1.4 : 1);
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = pool.reduce((s, c) => s + w(c), 0), r = Math.random() * tot, i = 0;
    while ((r -= w(pool[i])) > 0) i++;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
// weapon stat bars compare the new weapon with the one in hand
function weaponStats(k) {
  const n = WEAPONS[k], o = weapon();
  const row = (lab, nv, ov, max, fmt) => {
    const cls = nv > ov ? 'up' : nv < ov ? 'down' : '';
    return `<div class="bar ${cls}"><span>${lab}</span><i><b style="width:${Math.min(100, nv / max * 100)}%"></b><em style="left:${Math.min(100, ov / max * 100)}%"></em></i><small>${fmt(nv)}</small></div>`;
  };
  return row('DAMAGE', n.dmg, o.dmg, 3, v => v) + row('REACH', n.range, o.range, 3, v => v.toFixed(1) + ' m') + row('SPEED', n.speed, o.speed, 1.4, SPEED_WORD) + row('WIDTH', n.arc, o.arc, 1.8, v => v < .8 ? 'NARROW' : v < 1.3 ? 'MEDIUM' : 'WIDE');
}
function cardHTML(c, i) {
  const art = c.weapon ? `<img src="${WEAPON_ART[c.weapon] || ''}" alt="">` : emblem(c.icon, c.cat);
  const tag = c.weapon ? 'NEW WEAPON' : {offense: 'OFFENSE', defense: 'DEFENSE', utility: 'UTILITY', epic: 'FINISHER'}[c.cat];
  const body = c.weapon ? `<div class="bars">${weaponStats(c.weapon)}</div>` :
    `<div class="stats">${c.stat().map(([l, a, b]) => `<div class="st"><span>${l}</span><b><s>${a}</s> → ${b}</b></div>`).join('')}</div>`;
  return `<button class="card ${c.rarity} cat-${c.cat}" data-i="${i}" id="card${i}" style="--d:${i * .14}s">
    <span class="key">${i + 1}</span><span class="tag">${tag}</span>
    <span class="art">${art}</span>
    <span class="title">${c.title}</span>${body}<span class="flavor">${c.flavor}</span>
    <span class="rar"><i></i>${c.rarity}</span></button>`;
}
function openDraft() {
  G.state = 'draft'; DRAFT.cards = rollCards(); AU.musicTo('music_calm'); AU.play('cardOpen', {vol: .8});
  renderDraft(true);
}
function renderDraft(deal) {
  const el = DRAFT.el = document.getElementById('draft'); el.hidden = false;
  el.innerHTML = `<h2>WAVE ${G.wave} SURVIVED</h2><p class="sub">Take one. The night gets worse.</p>
    <div class="cards ${deal ? 'deal' : 'deal'}">${DRAFT.cards.map(cardHTML).join('')}</div>
    <button class="reroll" id="reroll" ${G.coins < DRAFT.rerollCost ? 'disabled' : ''}><span class="coin"></span>Reroll · ${DRAFT.rerollCost} <small>(you have ${G.coins})</small></button>`;
  el.querySelectorAll('.card').forEach((b, i) => {
    b.onclick = () => pickCard(+b.dataset.i);
    b.onpointerenter = () => AU.play('cardHover', {vol: .25, max: 1});
    b.onpointermove = e => { const r = b.getBoundingClientRect(); b.style.setProperty('--rx', ((e.clientY - r.top) / r.height - .5) * -10 + 'deg'); b.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 12 + 'deg'); };
    b.onpointerleave = () => { b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); };
    setTimeout(() => AU.play(DRAFT.cards[i].rarity === 'epic' ? 'levelUp' : 'cardHover', {vol: DRAFT.cards[i].rarity === 'epic' ? .5 : .3, rate: 1 + i * .12, max: 3}), 140 * i + 120);
  });
  document.getElementById('reroll').onclick = reroll;
  setTimeout(() => { const f = document.getElementById('card0'); f && f.focus({preventScroll: true}); }, 500);
}
function reroll() {
  if (G.coins < DRAFT.rerollCost) return; G.coins -= DRAFT.rerollCost; DRAFT.rerollCost += 10;
  DRAFT.cards = rollCards(); AU.play('coin', {vol: .7}); AU.play('cardOpen', {vol: .6}); renderDraft(true);
}
function pickCard(i) {
  const c = DRAFT.cards[i]; if (!c || G.state !== 'draft') return;
  G.state = 'picking';
  const btn = document.getElementById('card' + i); btn.classList.add('picked');
  DRAFT.el.querySelectorAll('.card').forEach(b => { if (b !== btn) b.classList.add('gone'); });
  c.apply(); UP.taken.push(c.id); AU.play('cardPick', {vol: .9}); HAPTIC.fx('card'); AU.play('levelUp', {vol: .5});
  if (c.weapon) WSND_DRAW(c.weapon);
  setTimeout(() => {
    DRAFT.el.hidden = true; G.state = 'playing';
    const P = G.player; ring(P.x, P.z, 2.5, 0xffcc33, .4); popText(P.x, P.z, c.title, '#ffcc33', 34, 3);
    setTimeout(startWave, 700);
  }, 650);
}
function WSND_DRAW(k) { const cls = WEAPONS[k].cls; AU.play(cls === 'blade' || cls === 'pierce' ? 'swingBlade' : cls === 'saw' ? 'hitSaw' : cls === 'heavy' ? 'hitAxe' : k === 'Guitar' ? 'guitarHit' : 'hitWood', {vol: .8, dur: .8}); }
