// Coco Catapult levels: 3 worlds × 5 levels. Coordinates are in metres:
// x = left/right, y = up (ground at 0), z = depth (negative = away from the
// slingshot at the origin). Pieces are described bottom-up with helpers so the
// towers start perfectly stacked.

// Materials: hp (how much impact they soak), density, points when destroyed.
export const MATS = {
  wood: { hp: 5, density: 0.9, pts: 500 },
  stone: { hp: 12, density: 2.4, pts: 800 },
  ice: { hp: 2.6, density: 0.8, pts: 300 },
};
// Hens: radius, hp, points.
export const HENS = {
  hen: { r: 0.5, hp: 1.3, pts: 5000 },
  helmet: { r: 0.55, hp: 3.6, pts: 7000 },
  boss: { r: 0.95, hp: 9, pts: 15000 },
};

const T = 0.5;    // post / slab thickness
const D = 1.0;    // depth of a "wall" piece

function builder() {
  const blocks = [];
  const hens = [];
  const api = {
    blocks, hens,
    box(m, x, y, z, w, h, d = D) { blocks.push({ m, x, y: y + h / 2, z, w, h, d }); return y + h; },
    post(m, x, y, z, h = 1.8) { return api.box(m, x, y, z, T, h, D); },
    slab(m, x, y, z, w = 2.4) { return api.box(m, x, y, z, w, 0.45, D + 0.2); },
    cube(m, x, y, z, s = 0.9) { return api.box(m, x, y, z, s, s, s); },
    // Two posts with a slab on top; returns the y of the slab's top face.
    frame(m, x, y, z, w = 2.4, h = 1.8, slabM = m) {
      api.post(m, x - w / 2 + T / 2, y, z, h);
      api.post(m, x + w / 2 - T / 2, y, z, h);
      return api.slab(slabM, x, y + h, z, w);
    },
    hen(type, x, y, z) { hens.push({ type, x, y: y + HENS[type].r + 0.02, z }); },
  };
  return api;
}

// Each level: name, shots, par (shots for three stars), build(b).
const W1 = [
  { name: 'Barn Door', shots: 3, par: 1, build(b) {
    const top = b.frame('wood', 0, 0, -22);
    b.hen('hen', 0, 0, -22); b.hen('hen', 0, top, -22);
  } },
  { name: 'Twin Coops', shots: 3, par: 2, build(b) {
    const t1 = b.frame('wood', -1.45, 0, -22); b.frame('wood', 1.45, 0, -22);
    b.hen('hen', -1.45, 0, -22); b.hen('hen', 1.45, 0, -22); b.hen('hen', -1.45, t1, -22);
  } },
  { name: 'Hay Tower', shots: 3, par: 2, build(b) {
    let y = 0;
    y = b.frame('wood', 0, y, -24); b.hen('hen', 0, 0, -24);
    const f2 = y; y = b.frame('wood', 0, y, -24);
    y = b.frame('wood', 0, y, -24); b.hen('hen', 0, y, -24);
    b.cube('wood', -2.4, 0, -22); b.cube('wood', -2.4, 0.9, -22, 0.8);
    void f2;
  } },
  { name: 'Pecking Order', shots: 4, par: 2, build(b) {
    const t = b.frame('wood', -1.3, 0, -23); b.frame('wood', 1.3, 0, -23);
    const t2 = b.frame('wood', 0, t, -23, 2.6);
    b.hen('hen', -1.3, 0, -23); b.hen('hen', 1.3, 0, -23); b.hen('hen', 0, t, -23); b.hen('hen', 0, t2, -23);
  } },
  { name: 'Big Hen Barn', shots: 4, par: 3, boss: true, build(b) {
    b.post('wood', -1.8, 0, -24, 2); b.post('wood', 0, 0, -24, 2); b.post('wood', 1.8, 0, -24, 2);
    const top = b.slab('wood', 0, 2, -24, 4.2);
    b.hen('boss', 0, top, -24);
    const l = b.frame('wood', -4, 0, -22, 1.8, 1.4); b.hen('hen', -4, 0, -22); b.hen('hen', -4, l, -22);
    const r = b.frame('wood', 4, 0, -22, 1.8, 1.4); b.hen('hen', 4, 0, -22); b.hen('hen', 4, r, -22);
  } },
];

const W2 = [
  { name: 'Yolk Bunker', shots: 3, par: 2, build(b) {
    b.frame('stone', 0, 0, -22); b.hen('helmet', 0, 0, -22);
    const t = b.frame('wood', 0, 0, -26); b.hen('hen', 0, 0, -26); b.hen('hen', 0, t, -26);
  } },
  { name: 'Shell Wall', shots: 3, par: 2, build(b) {
    for (const x of [-2.2, -0.75, 0.75, 2.2]) b.post('stone', x, 0, -20, 1.2);
    const a = b.frame('wood', -1.4, 0, -24); const c = b.frame('wood', 1.4, 0, -24);
    b.hen('hen', -1.4, 0, -24); b.hen('helmet', 1.4, 0, -24); b.hen('hen', -1.4, a, -24); b.hen('hen', 1.4, c, -24);
  } },
  { name: 'Sunny Spire', shots: 3, par: 2, build(b) {
    let y = b.frame('stone', 0, 0, -25); b.hen('helmet', 0, 0, -25);
    y = b.frame('wood', 0, y, -25);
    y = b.frame('wood', 0, y, -25, 2.2, 1.5);
    y = b.frame('wood', 0, y, -25, 2.0, 1.3);
    b.hen('hen', 0, y, -25);
  } },
  { name: 'Drawbridge', shots: 4, par: 2, build(b) {
    let top = 0;
    for (const x of [-2.4, 2.4]) {
      const y = b.frame('stone', x, 0, -24, 2.2); b.hen('hen', x, 0, -24);
      top = b.frame('wood', x, y, -24, 2.2, 1.5);
      b.hen('helmet', x, y, -24);
    }
    const bridge = b.slab('wood', 0, top, -24, 7.2);
    b.hen('hen', 0, bridge, -24);
  } },
  { name: 'The Eggsecutioner', shots: 4, par: 3, boss: true, build(b) {
    const y = b.frame('stone', 0, 0, -25, 3.4, 2.3);
    b.hen('boss', 0, 0, -25);
    const y2 = b.frame('stone', 0, y, -25, 3.4, 1.5);
    b.hen('helmet', 0, y, -25); b.hen('hen', 0, y2, -25);
    b.frame('wood', -3.6, 0, -23, 1.8, 1.4); b.hen('hen', -3.6, 0, -23);
    b.frame('wood', 3.6, 0, -23, 1.8, 1.4); b.hen('hen', 3.6, 0, -23);
  } },
];

const W3 = [
  { name: 'Thin Ice', shots: 3, par: 1, build(b) {
    const a = b.frame('ice', -1.45, 0, -23); const c = b.frame('ice', 1.45, 0, -23);
    b.hen('hen', -1.45, 0, -23); b.hen('hen', 1.45, 0, -23); b.hen('hen', -1.45, a, -23); b.hen('hen', 1.45, c, -23);
  } },
  { name: 'Icicle Tower', shots: 3, par: 2, build(b) {
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const ny = b.frame(i === 0 ? 'stone' : 'ice', 0, y, -25, 2.4 - i * 0.15, 1.6);
      if (i % 2 === 0) b.hen(i === 0 ? 'helmet' : 'hen', 0, y, -25);
      y = ny;
    }
    b.hen('hen', 0, y, -25);
  } },
  { name: 'Frozen Keep', shots: 3, par: 2, build(b) {
    for (const x of [-1.6, 0, 1.6]) b.post('stone', x, 0, -20, 1.4);
    const y = b.frame('ice', 0, 0, -24, 3.2, 1.8);
    b.hen('helmet', -0.6, 0, -24); b.hen('hen', 0.6, 0, -24);
    const y2 = b.frame('ice', 0, y, -24, 2.4, 1.5); b.hen('hen', 0, y, -24); b.hen('hen', 0, y2, -24);
  } },
  { name: 'Aurora Row', shots: 4, par: 3, build(b) {
    [[-3, 'ice'], [0, 'stone'], [3, 'ice']].forEach(([x, m], i) => {
      let y = b.frame(m, x, 0, -24 - i, 2);
      b.hen(i === 1 ? 'helmet' : 'hen', x, 0, -24 - i);
      y = b.frame('ice', x, y, -24 - i, 1.8, 1.4);
      b.hen('hen', x, y, -24 - i);
    });
  } },
  { name: 'Supreme Mother Hen', shots: 5, par: 3, boss: true, build(b) {
    const y1 = b.frame('stone', 0, 0, -26, 4.2, 2.1);
    b.hen('helmet', -1, 0, -26); b.hen('helmet', 1, 0, -26);
    const y2 = b.frame('ice', 0, y1, -26, 3.4, 1.6);
    b.hen('hen', 0, y1, -26);
    b.hen('boss', 0, y2, -26);
    b.frame('ice', -4.2, 0, -23, 1.8, 1.4); b.hen('hen', -4.2, 0, -23);
    b.frame('ice', 4.2, 0, -23, 1.8, 1.4); b.hen('hen', 4.2, 0, -23);
  } },
];

// Worlds reuse the Dodge galaxies' look (index into GALAXIES) and award a
// cosmetic add-on when every level in them is cleared.
export const WORLDS = [
  { name: 'Coop Nebula', galaxy: 0, reward: 'viking', levels: W1 },
  { name: 'Yolk Belt', galaxy: 1, reward: 'dragon', levels: W2 },
  { name: 'Frostfeather Expanse', galaxy: 3, reward: 'crown', levels: W3 },
];

export function levelId(w, l) { return `${w + 1}-${l + 1}`; }

export function buildLevel(w, l) {
  const def = WORLDS[w].levels[l];
  const b = builder();
  def.build(b);
  return { ...def, id: levelId(w, l), world: w, index: l, blocks: b.blocks, hens: b.hens };
}

// Stars: 3 at or under par, 2 with one extra shot, else 1 (0 = lost).
export function starsFor(def, shotsUsed, won) {
  if (!won) return 0;
  if (shotsUsed <= def.par) return 3;
  if (shotsUsed <= def.par + 1) return 2;
  return 1;
}
