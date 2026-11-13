// Upgrade draft: after each wave pick 1 of 3 cards. Coins pay for rerolls.
// Weapon cards show a 3D render of the actual weapon model; perk cards use hand-drawn SVG emblems.
'use strict';
const UP = {};
function resetUpgrades() {
  Object.assign(UP, {dmg: 0, atkSpeed: 1, range: 1, move: 1, crit: 0, slam: 1, dash: false, fire: false, chain: false,
    explosive: false, magnet: false, thorns: false, lifesteal: false, horde: false, wlvl: 1, el: {fire: 0, frost: 0, storm: 0, poison: 0}, gear: {}, taken: []});
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
  poison: '<path d="M32 4C22 22 12 30 12 42a20 20 0 0 0 40 0C52 30 42 22 32 4z" fill="url(#g)"/><circle cx="25" cy="40" r="5" fill="#1a1d28"/><circle cx="39" cy="40" r="5" fill="#1a1d28"/><path d="M26 52h12M29 48v8M35 48v8" stroke="#1a1d28" stroke-width="3"/>',
  blades: '<circle cx="32" cy="32" r="22" fill="none" stroke="url(#g)" stroke-width="3" stroke-dasharray="6 5"/><path d="M32 2l5 12h-10zM62 32l-12 5V27zM32 62l-5-12h10zM2 32l12-5v10z" fill="url(#g)"/><circle cx="32" cy="32" r="7" fill="#fff"/>',
  dog: '<ellipse cx="32" cy="42" rx="14" ry="12" fill="url(#g)"/><ellipse cx="16" cy="24" rx="6" ry="8" fill="url(#g)"/><ellipse cx="27" cy="14" rx="6" ry="8" fill="url(#g)"/><ellipse cx="38" cy="14" rx="6" ry="8" fill="url(#g)"/><ellipse cx="49" cy="24" rx="6" ry="8" fill="url(#g)"/>',
  molotov: '<path d="M26 22h12v8l6 8v20a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V38l6-8z" fill="url(#g)"/><rect x="27" y="14" width="10" height="8" fill="#fff"/><path d="M32 2c3 4 6 6 4 10-1 2-4 2-5 0-2-3 1-6 1-10z" fill="#ffcf3a"/>',
  tesla: '<rect x="24" y="40" width="16" height="20" rx="3" fill="url(#g)"/><path d="M20 40h24M22 34h20M24 28h16" stroke="url(#g)" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="16" r="8" fill="#fff"/><path d="M14 8l6 6M50 8l-6 6M8 20h6M56 20h-6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  pulse: '<circle cx="32" cy="32" r="8" fill="url(#g)"/><circle cx="32" cy="32" r="17" fill="none" stroke="url(#g)" stroke-width="5"/><circle cx="32" cy="32" r="27" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>',
  drone: '<rect x="18" y="26" width="28" height="16" rx="8" fill="url(#g)"/><circle cx="40" cy="34" r="4" fill="#fff"/><path d="M6 18h20M38 18h20M16 18v8M48 18v8" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M28 42l-4 10M36 42l4 10" stroke="url(#g)" stroke-width="4"/>',
  boom: '<circle cx="28" cy="38" r="20" fill="url(#g)"/><path d="M40 20l6-6" stroke="#fff" stroke-width="5"/><path d="M50 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffe14a"/><circle cx="21" cy="31" r="5" fill="#fff" opacity=".5"/>',
};
const CAT_COL = {offense: ['#ffb36b', '#ff3c3c'], defense: ['#9dff9d', '#18b04a'], utility: ['#9fdcff', '#2a7cff'], epic: ['#ffd36b', '#b03cff'], gear: ['#a8fff0', '#10a58a'],
  fire: ['#ffd36b', '#ff4a10'], frost: ['#ffffff', '#3ab8ff'], storm: ['#e8f6ff', '#5a7bff'], poison: ['#d4ff7a', '#3aa018']};
function emblem(icon, cat) {
  const [a, b] = CAT_COL[cat];
  const id = 'g_' + icon; // unique per emblem: gradient ids are global in the document
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${SVG[icon].replaceAll('url(#g)', `url(#${id})`)}</svg>`;
}

// ---------- elements (stack, each up to Lv 3) ----------
const ELEMENTS = {
  fire: {name: 'FIRE', icon: 'fire', col: 0xff6a1a, fx: 'fire', lv: ['Hits set zombies on fire, 1 damage per second.', 'Fire burns twice as hot: 2 damage per second.', 'Burning zombies spread the fire when they die.']},
  frost: {name: 'FROST', icon: 'frost', col: 0x8fe8ff, fx: 'frost', lv: ['Hits slow zombies by half for 2 s.', 'Slow 65%. Frozen zombies shatter when they die.', 'Shattering ice hurts every zombie nearby.']},
  storm: {name: 'STORM', icon: 'chain', col: 0xbfe0ff, fx: 'storm', lv: ['Every 3rd hit arcs lightning into 2 zombies.', 'Every 2nd hit arcs.', 'Lightning arcs into 4 zombies.']},
  poison: {name: 'POISON', icon: 'poison', col: 0x8aff3a, fx: 'poison', lv: ['Hits leave a toxic cloud: 1 damage per second for 3 s.', 'Clouds are much wider.', 'Clouds also slow zombies by 30%.']},
};
const elActive = () => Object.keys(UP.el).filter(k => UP.el[k] > 0);

// ---------- the card pool ----------
const pct = v => Math.round(v * 100) + '%';
const SPEED_WORD = s => s >= 1.3 ? 'FAST' : s >= 1 ? 'MEDIUM' : 'SLOW';
const CARDS = [
  {id: 'wlvl', build: true, cat: 'offense', rarity: 'common', weaponCard: true, title: 'WEAPON LEVEL', repeat: true, ok: () => UP.wlvl < 5,
    flavor: () => ({2: '+1 damage.', 3: '+1 damage and 15% more reach.', 4: '+1 damage.', 5: `+1 damage and a bigger finisher: ${weapon().fin}.`})[UP.wlvl + 1],
    stat: () => [['Level', 'Lv ' + UP.wlvl, 'Lv ' + (UP.wlvl + 1)], ['Damage', weapon().dmg + UP.wlvl - 1, weapon().dmg + UP.wlvl]], apply: () => { UP.wlvl++; WSND_DRAW(G.player.weapon); }},
  ...Object.entries(ELEMENTS).map(([k, e]) => ({id: 'el_' + k, build: true, cat: k, icon: e.icon, rarity: 'epic', repeat: true, title: e.name, ok: () => UP.el[k] < 3,
    flavor: () => e.lv[UP.el[k]], stat: () => [['Element', UP.el[k] ? 'Lv ' + UP.el[k] : 'none', 'Lv ' + (UP.el[k] + 1)]], apply: () => UP.el[k]++})),
  ...Object.entries(GEAR).map(([k, g]) => ({id: 'gear_' + k, build: true, cat: 'gear', icon: g.icon, rarity: 'rare', repeat: true, title: g.name,
    ok: () => gearLvl(k) ? gearLvl(k) < 5 : Object.keys(UP.gear).length < GEAR_MAX,
    flavor: () => (gearLvl(k) ? 'Next: ' : '') + g.text(gearLvl(k) + 1) + '.', stat: () => [['Gear', gearLvl(k) ? 'Lv ' + gearLvl(k) : 'new', 'Lv ' + (gearLvl(k) + 1)]],
    apply: () => { UP.gear[k] = gearLvl(k) + 1; buildGear(); }})),
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
  {id: 'boom', cat: 'epic', icon: 'boom', rarity: 'epic', title: 'VOLATILE', flavor: 'Some of them just... pop.', once: true, stat: () => [['Kill explodes', '0%', '15%']], apply: () => UP.explosive = true},
];
const RARITY_W = {common: 10, rare: 5, epic: 2};
const DRAFT = {cards: [], rerollCost: 10, el: null};
function rollCards() {
  const pool = CARDS.filter(c => (!c.once || !UP.taken.includes(c.id)) && (!c.ok || c.ok()));
  const w = c => RARITY_W[c.rarity] * (c.rarity === 'epic' ? 1 + G.wave * .15 : 1) * (c.build ? 1.6 : 1);
  const out = [];
  // every draft builds on the run: at least one weapon level, element or gear card
  const builds = pool.filter(c => c.build); if (builds.length) { const c = pick(builds); out.push(c); pool.splice(pool.indexOf(c), 1); }
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
// the player's build so far: weapon level, elements and gear, shown under the cards
function buildBarHTML() {
  const w = weapon(), els = elActive(), gear = Object.keys(UP.gear);
  const chip = (art, lab, lv, max, col) => `<div class="bchip" style="--bc:${col}"><span class="bart">${art}</span><span class="blab">${lab}</span><span class="bpips">${Array.from({length: max}, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span></div>`;
  return `<div class="buildbar"><div class="btitle">YOUR BUILD</div><div class="bchips">
    ${chip(`<img src="${WEAPON_ART[G.player.weapon] || ''}" alt="">`, w.name, UP.wlvl, 5, '#ffcc33')}
    ${els.map(e => chip(emblem(ELEMENTS[e].icon || e, e), e.toUpperCase(), UP.el[e], 3, CAT_COL[e] ? CAT_COL[e][1] : '#fff')).join('')}
    ${gear.map(g => chip(emblem(GEAR[g].icon, 'gear'), GEAR[g].name || g.toUpperCase(), gearLvl(g), 5, '#10a58a')).join('')}
    ${!els.length && !gear.length ? '<span class="bempty">Elements and gear you pick show up here.</span>' : ''}</div></div>`;
}
// level pips on a card: filled up to the current level, the next level pulses
function cardPips(c) {
  const max = c.id === 'wlvl' ? 5 : c.id.startsWith('el_') ? 3 : c.id.startsWith('gear_') ? 5 : 0; if (!max) return '';
  const cur = c.id === 'wlvl' ? UP.wlvl : c.id.startsWith('el_') ? UP.el[c.id.slice(3)] : gearLvl(c.id.slice(5));
  return `<span class="pips">${Array.from({length: max}, (_, i) => `<i class="${i < cur ? 'on' : i === cur ? 'nx' : ''}"></i>`).join('')}</span>`;
}
function cardHTML(c, i) {
  const pv = cardPreview(c), icon = c.weaponCard ? '' : emblem(c.icon, CAT_COL[c.cat] ? c.cat : 'epic');
  const art = c.weaponCard ? `<img src="${WEAPON_ART[G.player.weapon] || ''}" alt="">` : pv ? pv + `<span class="arti">${icon}</span>` : icon;
  const tag = c.weaponCard ? weapon().name : c.id.startsWith('el_') ? 'ELEMENT' : c.cat === 'gear' ? 'AUTO GEAR' : {offense: 'OFFENSE', defense: 'DEFENSE', utility: 'UTILITY', epic: 'SPECIAL'}[c.cat];
  const body = `<div class="stats">${c.stat().map(([l, a, b]) => `<div class="st"><span>${l}</span><b><s>${a}</s> → ${b}</b></div>`).join('')}</div>`;
  const flavor = typeof c.flavor === 'function' ? c.flavor() : c.flavor;
  return `<button class="card ${c.rarity} cat-${c.cat}" data-i="${i}" id="card${i}" style="--d:${i * .14}s">
    <span class="key">${i + 1}</span><span class="tag">${tag}</span>
    <span class="art">${art}</span>
    ${(c.id.startsWith('el_') && !UP.el[c.id.slice(3)]) || (c.id.startsWith('gear_') && !gearLvl(c.id.slice(5))) ? '<span class="ribbon">NEW</span>' : ''}
    <span class="title">${c.title}</span>${cardPips(c)}${body}<span class="flavor">${flavor}</span>
    <span class="rar"><i></i>${c.rarity}</span></button>`;
}
function openDraft() {
  G.state = 'draft'; DRAFT.free = safeLv('dice'); DRAFT.cards = rollCards(); AU.musicTo('music_calm'); AU.play('cardOpen', {vol: .8});
  renderDraft(true);
}
function renderDraft(deal) {
  const el = DRAFT.el = document.getElementById('draft'); el.hidden = false;
  const nx = G.wave + 1, nA = AREAS[areaIndex(nx)], boss = nx % 5 === 0, newArea = areaIndex(nx) !== G.area;
  const next = newArea ? `Next: travel to <b>${nA.name}</b>` : boss ? `Next: <b class="bossn">BOSS · ${BOSSES[nA.boss].name}</b>` : `Next: <b>wave ${nx}</b>`;
  el.innerHTML = `<div class="drays"></div>
    <div class="dhead"><div class="dwave">WAVE ${G.wave}</div><h2>CLEARED</h2>
      <div class="dchips"><span><i>☠</i><b data-n="${G.kills - (G.waveKills0 || 0)}">${G.kills - (G.waveKills0 || 0)}</b> kills</span><span><i>✦</i>best combo x<b data-n="${G.waveBest || 0}">${G.waveBest || 0}</b></span><span><i class="ccoin"></i><b data-n="${G.coins}">${G.coins}</b></span><span><i class="cheart">♥</i>${G.player.hp}/${G.player.maxHp}</span></div>
      <div class="dnext">${next}</div></div>
    <p class="sub">Choose 1 upgrade</p>
    <div class="cards ${deal ? 'deal' : ''}">${DRAFT.cards.map(cardHTML).join('')}</div>
    <button class="reroll" id="reroll" ${G.coins < DRAFT.rerollCost && !DRAFT.free ? 'disabled' : ''}><span class="dice">⚄</span>Reroll ${DRAFT.free ? '<b class="free">FREE</b>' : `<span class="coin"></span>${DRAFT.rerollCost}`}</button>
    ${buildBarHTML()}`;
  el.querySelectorAll('.card').forEach((b, i) => {
    b.onclick = () => pickCard(+b.dataset.i);
    b.onpointerenter = () => AU.play('cardHover', {vol: .25, max: 1});
    b.onpointermove = e => { const r = b.getBoundingClientRect(); b.style.setProperty('--rx', ((e.clientY - r.top) / r.height - .5) * -10 + 'deg'); b.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 12 + 'deg'); };
    b.onpointerleave = () => { b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); };
    setTimeout(() => AU.play(DRAFT.cards[i].rarity === 'epic' ? 'levelUp' : 'cardHover', {vol: DRAFT.cards[i].rarity === 'epic' ? .5 : .3, rate: 1 + i * .12, max: 3}), 140 * i + 120);
  });
  document.getElementById('reroll').onclick = reroll;
  if (deal) countUp(el.querySelector('.dchips'));
  setTimeout(() => { const f = document.getElementById('card0'); f && f.focus({preventScroll: true}); }, 500);
}
function reroll() {
  if (DRAFT.free) DRAFT.free = 0; else { if (G.coins < DRAFT.rerollCost) return; G.coins -= DRAFT.rerollCost; DRAFT.rerollCost += 10; }
  DRAFT.cards = rollCards(); AU.play('coin', {vol: .7}); AU.play('cardOpen', {vol: .6}); renderDraft(true);
}
function pickCard(i) {
  const c = DRAFT.cards[i]; if (!c || G.state !== 'draft') return;
  G.state = 'picking';
  const btn = document.getElementById('card' + i); btn.classList.add('picked');
  DRAFT.el.querySelectorAll('.card').forEach(b => { if (b !== btn) b.classList.add('gone'); });
  const stat0 = c.stat(), desc0 = typeof c.flavor === 'function' ? c.flavor() : c.flavor;
  c.apply(); if (!c.repeat) UP.taken.push(c.id); else UP.taken.push(c.id + '#'); AU.play('cardPick', {vol: .9}); HAPTIC.fx('card'); AU.play('levelUp', {vol: .5});
  // the card's art flies out of the card into the survivor, bursts, then a small icon flies to its HUD slot
  const col = (CAT_COL[c.cat] || CAT_COL.epic)[1], sub = (stat0[0] || [])[2];
  setTimeout(() => {
    const art = btn.querySelector('.art'), r = art.getBoundingClientRect(), html = art.innerHTML;
    DRAFT.el.classList.add('fading'); art.style.visibility = 'hidden'; AU.play('swingWide', {vol: .6, rate: 1.3});
    flyTo(html, {x: r.left + r.width / 2, y: r.top + r.height / 2}, HUD_SLOT.player, {dur: .8, arc: 140, size: Math.max(r.width, r.height), endScale: .3, spin: 1, col, onArrive: () => {
      DRAFT.el.hidden = true; DRAFT.el.classList.remove('fading'); G.state = 'playing';
      rewardBurst(col, c.title, sub ? 'now ' + sub : '');
      const slot = cardSlot(c);
      if (slot) setTimeout(() => flyTo(html, HUD_SLOT.player(), slot[1], {dur: .55, arc: 60, size: 46, endScale: .55, spin: 0, col, onArrive: () => { FLY.bump[slot[0]] = G.time; AU.play('cardPick', {vol: .6, rate: 1.3}); }}), 350);
      setTimeout(() => showcase(c, nextWave, stat0, desc0), 700);
    }});
  }, 420);
}
function WSND_DRAW(k) { const cls = WEAPONS[k].cls; AU.play(cls === 'blade' || cls === 'pierce' ? 'swingBlade' : cls === 'saw' ? 'hitSaw' : cls === 'heavy' ? 'hitAxe' : k === 'Guitar' ? 'guitarHit' : 'hitWood', {vol: .8, dur: .8}); }
