// Progress kept between runs: the coin and emerald wallet, Safehouse perks bought with coins,
// and cosmetics bought with emeralds. Saved in localStorage.
'use strict';
const META_KEY = 'ozMeta';
const META = {coins: 0, gems: 0, safe: {}, owned: {}, equip: {}};
try { Object.assign(META, JSON.parse(localStorage.getItem(META_KEY)) || {}); } catch (e) {}
let metaDirty = false;
const saveMeta = () => { metaDirty = false; try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch (e) {} };
setInterval(() => { if (metaDirty) saveMeta(); }, 2000);
// G.coins is the wallet: coins picked up in a run stay after death, rerolls and the Safehouse spend them
Object.defineProperty(G, 'coins', {get: () => META.coins, set: v => { META.coins = Math.max(0, Math.round(v)); metaDirty = true; }, configurable: true});
const addGems = n => { META.gems += n; saveMeta(); };

// ---------- Safehouse: permanent perks, bought with coins ----------
const SAFE = [
  {id: 'jacket', name: 'Thick Jacket', desc: '+20 max health at the start of every run', icon: 'hp', max: 3, cost: [120, 300, 650]},
  {id: 'sharpen', name: 'Whetstone', desc: 'Your weapon starts 1 level higher', icon: 'dmg', max: 2, cost: [250, 700]},
  {id: 'locker', name: 'Gun Locker', desc: 'Start every run with a random gear piece', icon: 'drone', max: 1, cost: [450]},
  {id: 'charm', name: 'Lucky Charm', desc: '+5% critical hit chance', icon: 'crit', max: 3, cost: [150, 350, 700]},
  {id: 'wind', name: 'Second Wind', desc: 'Once per run, get back up with 40 health', icon: 'heal', max: 1, cost: [600]},
  {id: 'scav', name: 'Scavenger', desc: '+25% coins from every zombie', icon: 'magnet', max: 2, cost: [200, 550]},
  {id: 'dice', name: 'Loaded Dice', desc: 'The first reroll after each wave is free', icon: 'spd', max: 1, cost: [350]},
];
const safeLv = id => META.safe[id] || 0;
function buySafe(id) {
  const s = SAFE.find(x => x.id === id), lv = safeLv(id); if (!s || lv >= s.max || META.coins < s.cost[lv]) return false;
  META.coins -= s.cost[lv]; META.safe[id] = lv + 1; saveMeta(); return true;
}
// called at the start of every run, after the survivor is made
function applySafehouse() {
  const P = G.player;
  P.maxHp += 20 * safeLv('jacket'); P.hp = P.maxHp;
  UP.wlvl += safeLv('sharpen'); UP.crit += .05 * safeLv('charm');
  P.revive = safeLv('wind');
  if (safeLv('locker')) { const g = pick(Object.keys(GEAR).filter(k => !UP.gear[k])); if (g) { UP.gear[g] = 1; buildGear(); } }
}

// ---------- cosmetics, bought with emeralds ----------
const COSMETICS = {
  hat: [
    {id: 'cap', name: 'Ball Cap', cost: 3, col: 0xc0392b}, {id: 'cowboy', name: 'Cowboy Hat', cost: 5, col: 0x8a5a2a}, {id: 'horns', name: 'Viking Horns', cost: 6, col: 0xe8e0c8},
    {id: 'headphones', name: 'Headphones', cost: 5, col: 0x2a2a2a}, {id: 'halo', name: 'Halo', cost: 9, col: 0xffe680}, {id: 'crown', name: 'Crown', cost: 12, col: 0xffc83a},
  ],
  outfit: [
    {id: 'camo', name: 'Camo', cost: 3, colors: {top: '#556b2f', bottom: '#3a4a2a', shoes: '#2b2b2b'}}, {id: 'street', name: 'Street Red', cost: 3, colors: {top: '#c0392b', bottom: '#2b2b2b', shoes: '#ececec'}},
    {id: 'ghost', name: 'Ghost', cost: 4, colors: {top: '#ececec', bottom: '#d8d8d8', shoes: '#ececec', hair: '#d8d8d8'}}, {id: 'midnight', name: 'Midnight', cost: 4, colors: {top: '#2c3e57', bottom: '#1b2333', shoes: '#8e44ad'}},
    {id: 'toxic', name: 'Toxic', cost: 6, colors: {top: '#7ad82a', bottom: '#2b2b2b', shoes: '#7ad82a', hair: '#7ad82a'}},
  ],
  trail: [
    {id: 'pink', name: 'Neon Pink', cost: 4, col: 0xff4fd8}, {id: 'gold', name: 'Gold', cost: 5, col: 0xffd040}, {id: 'toxic', name: 'Toxic Green', cost: 5, col: 0x7dff3a}, {id: 'rainbow', name: 'Rainbow', cost: 10, col: 'rainbow'},
  ],
  skin: [
    {id: 'gold', name: 'Gold Plated', cost: 8, col: 0xffd040, metal: 1, rough: .25}, {id: 'obsidian', name: 'Obsidian', cost: 8, col: 0x18141e, metal: .4, rough: .2, glow: 0x6a2aa0},
    {id: 'neon', name: 'Neon', cost: 10, col: 0x40f0ff, metal: 0, rough: .4, glow: 0x20c0ff}, {id: 'blood', name: 'Bloodied', cost: 6, col: 0xa01818, metal: .2, rough: .6},
  ],
  aura: [
    {id: 'embers', name: 'Embers', cost: 6, cols: ['#ff8a1a', '#ffcf3a']}, {id: 'snow', name: 'Snowfall', cost: 6, cols: ['#ffffff', '#cfefff']},
    {id: 'fireflies', name: 'Fireflies', cost: 7, cols: ['#e8ff6a', '#b8ff3a']}, {id: 'shadow', name: 'Shadow', cost: 9, cols: ['#6a3aa0', '#2a1040']},
  ],
};
const COS_TABS = [['hat', 'Hats'], ['outfit', 'Outfits'], ['skin', 'Weapon skins'], ['trail', 'Trails'], ['aura', 'Auras']];
const cosKey = (kind, id) => kind + ':' + id;
const ownsCos = (kind, id) => !!META.owned[cosKey(kind, id)];
const equipped = kind => { const t = typeof HOME !== 'undefined' && HOME.try; const id = t && t.kind === kind ? t.id : META.equip[kind]; return id ? COSMETICS[kind].find(c => c.id === id) : null; };
function buyCos(kind, id) {
  const c = COSMETICS[kind].find(x => x.id === id); if (!c || ownsCos(kind, id) || META.gems < c.cost) return false;
  META.gems -= c.cost; META.owned[cosKey(kind, id)] = 1; META.equip[kind] = id; saveMeta(); return true;
}
function equipCos(kind, id) { META.equip[kind] = META.equip[kind] === id ? null : id; saveMeta(); applyCosmetics(); }

// ---------- putting cosmetics on the survivor ----------
function hatMesh(h) {
  // colors are picked as screen colors, so convert them to the renderer's linear space
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: new THREE.Color(c).convertSRGBToLinear(), roughness: .55}, o)), g = new THREE.Group();
  if (h.id === 'cap') { const d = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(h.col)); g.add(d); const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .02, 16, 1, false, -Math.PI / 2, Math.PI), M(h.col)); b.position.set(0, 0, .1); g.add(b); }
  if (h.id === 'cowboy') { const br = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .03, 24), M(h.col)); g.add(br); const t = new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, .2, 20), M(h.col)); t.position.y = .1; g.add(t); const band = new THREE.Mesh(new THREE.CylinderGeometry(.171, .171, .04, 20), M(0x2a1a0a)); band.position.y = .03; g.add(band); }
  if (h.id === 'horns') { const cap = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x8a8a90, {metalness: .7})); g.add(cap); for (const s of [-1, 1]) { const hn = new THREE.Mesh(new THREE.ConeGeometry(.05, .26, 12), M(h.col)); hn.position.set(s * .18, .1, 0); hn.rotation.z = -s * .9; g.add(hn); } }
  if (h.id === 'headphones') { const band = new THREE.Mesh(new THREE.TorusGeometry(.18, .02, 8, 20, Math.PI), M(h.col)); band.rotation.z = 0; g.add(band); for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .05, 16), M(0xe03a3a)); cup.rotation.z = Math.PI / 2; cup.position.set(s * .18, -.06, 0); g.add(cup); } g.position.y = -.05; }
  if (h.id === 'halo') { const r = new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 8, 28), new THREE.MeshBasicMaterial({color: h.col})); r.rotation.x = Math.PI / 2; r.position.y = .18; g.add(r); const l = new THREE.PointLight(h.col, 1.2, 3); l.position.y = .2; g.add(l); }
  if (h.id === 'crown') { const ring = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .1, 20, 1, true), M(h.col, {metalness: .55, roughness: .3, emissive: 0x3a2800, side: THREE.DoubleSide})); ring.position.y = .05; g.add(ring); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(.03, .09, 8), M(h.col, {metalness: .55, roughness: .3, emissive: 0x3a2800})); sp.position.set(Math.cos(a) * .15, .14, Math.sin(a) * .15); g.add(sp); } const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.03), M(0x30d070, {emissive: 0x106030})); gem.position.set(0, .06, .155); g.add(gem); }
  return g;
}
// a hat sits just above the head bone and stays level with the body
function wearHat(rig, m) {
  const head = rig.bones.Head; if (!head) { rig.model.add(m); m.position.y = 1.25; return; }
  rig.root.updateMatrixWorld(true);
  const s = rig.model.scale.y * rig.root.scale.y, top = head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .33 * s, .02 * s));
  head.add(m); m.position.copy(head.worldToLocal(top));
  const hq = head.getWorldQuaternion(new THREE.Quaternion()).invert(), rq = rig.root.getWorldQuaternion(new THREE.Quaternion()); m.quaternion.copy(hq.multiply(rq));
}
function applyCosmetics(rig) {
  rig = rig || (G.player && G.player.rig); if (!rig) return;
  // hat on the head bone
  if (rig.cosHat) { rig.cosHat.parent && rig.cosHat.parent.remove(rig.cosHat); rig.cosHat = null; }
  const h = equipped('hat');
  if (h) { const m = hatMesh(h); wearHat(rig, m); rig.cosHat = m; }
  // outfit colors over the creator's colors
  const o = equipped('outfit'); applyLook(rig, o ? Object.assign({}, LOOK, {colors: Object.assign({}, LOOK.colors, o.colors)}) : LOOK);
  // weapon skin
  if (G.player && G.player.rig === rig) skinWeapon();
}
function skinWeapon() {
  const P = G.player, m = P && P.wMesh; if (!m) return; const s = equipped('skin');
  if (!m.userData.baseMat) m.userData.baseMat = m.material;
  if (!s) { m.material = m.userData.baseMat; return; }
  m.material = new THREE.MeshStandardMaterial({color: new THREE.Color(s.col).convertSRGBToLinear(), metalness: Math.min(.6, s.metal), roughness: s.rough, emissive: new THREE.Color(s.glow || 0), emissiveIntensity: s.glow ? .8 : 0});
}
// the weapon trail color: elements show their own colors, otherwise the equipped trail
function cosTrailCol() { const t = equipped('trail'); if (!t) return null; return t.col === 'rainbow' ? new THREE.Color().setHSL((G.time * .6) % 1, 1, .6).getHex() : t.col; }
// a few drifting particles around the survivor
function cosAura(P, dt) {
  const a = equipped('aura'); if (!a || Math.random() > dt * 14) return; const an = rnd(0, 7), r = rnd(.3, .9);
  const up = a.id === 'snow' ? -1 : 1;
  addPart({x: P.x + Math.cos(an) * r, y: a.id === 'snow' ? rnd(1.6, 2.4) : rnd(.1, 1.6), z: P.z + Math.sin(an) * r, vx: rnd(-.2, .2), vz: rnd(-.2, .2), vy: up * rnd(.3, .9), g: 0, life: 1.1, max: 1.1, size: rnd(.04, .09), col: pick(a.cols), drag: .98, rx: 0, ry: 0});
}

// ---------- emeralds: rare drops ----------
function maybeDropGem(zb) {
  const chance = zb.T.boss ? 1 : .015 + (zb.T.score >= 30 ? .01 : 0);
  if (Math.random() < chance) { const n = zb.T.boss ? 2 + Math.floor(G.wave / 10) : 1; for (let i = 0; i < n; i++) dropPickup('gem', zb.x + rnd(-.6, .6), zb.z + rnd(-.6, .6)); }
}
