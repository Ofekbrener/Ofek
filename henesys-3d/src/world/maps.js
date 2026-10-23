// Field map definitions (see field.js). Henesys itself is built in henesys.js.
import { buildField } from './field.js';

export const ZONES = {
  hunting: [
    { id: 0, mobIds: ['snail', 'blueSnail'], area: { x: -18, z: 0, w: 18, d: 56 } },
    { id: 1, mobIds: ['redSnail', 'slime'], area: { x: 4, z: 0, w: 18, d: 56 } },
    { id: 2, mobIds: ['orangeMushroom'], area: { x: 26, z: 0, w: 18, d: 56 } },
  ],
  pigfarm: [
    { id: 0, mobIds: ['pig'], area: { x: 0, z: -8, w: 44, d: 18 } },
    { id: 1, mobIds: ['pig', 'ribbonPig'], area: { x: 0, z: 14, w: 44, d: 20 } },
  ],
  hunting2: [
    { id: 0, mobIds: ['stump'], area: { x: -18, z: 0, w: 18, d: 56 } },
    { id: 1, mobIds: ['greenMushroom', 'stump'], area: { x: 4, z: 0, w: 18, d: 56 } },
    { id: 2, mobIds: ['hornyMushroom', 'greenMushroom'], area: { x: 26, z: 0, w: 18, d: 56 } },
  ],
  ruins: [
    { id: 0, mobIds: ['skeletonMinion'], area: { x: -12, z: 0, w: 16, d: 48 } },
    { id: 1, mobIds: ['skeletonMinion', 'skeletonWarrior'], area: { x: 6, z: 0, w: 16, d: 48 } },
    { id: 2, mobIds: ['skeletonWarrior', 'skeletonMage'], area: { x: 22, z: 0, w: 14, d: 48 } },
  ],
};

const DEFS = {
  hunting: {
    id: 'hunting', name: 'Henesys Hunting Ground I', half: 40, seed: 11, spawn: { x: -33, z: 0 },
    paths: [[[[-41, 0], [-28, 2], [-14, -3], [0, 2], [14, -2], [30, 1], [41, 0]], 3]],
    hills: [[-20, -16, 8, 1.6], [-14, 18, 7, 1.3], [4, -18, 9, 2.2], [6, 17, 7, 1.6], [24, -14, 8, 2], [28, 18, 9, 2.4]],
    trees: [[-36, -30], [-30, 32], [-8, -34], [-2, 34], [14, -33], [18, 30], [36, -28], [36, 26], [-24, 6], [12, 8], [33, -6], [-6, -12]],
    rocks: 10, zones: ZONES.hunting,
    portals: [
      { x: -37.5, z: 0, to: 'henesys', arrive: { x: 25, z: 0 }, sign: 'Henesys' },
      { x: 37.5, z: 0, to: 'hunting2', arrive: { x: -33, z: 0 }, sign: 'Hunting Ground II' },
    ],
  },
  pigfarm: {
    id: 'pigfarm', name: 'Henesys Pig Farm', half: 32, seed: 21, spawn: { x: 0, z: -26 },
    theme: { ground: '#86c858', path: '#cfa26a', pathEdge: '#a8794a' },
    paths: [[[[0, -33], [0, -18], [-6, 0], [4, 14], [0, 30]], 3.4]],
    hills: [[-18, 18, 7, 1.2], [20, -14, 6, 1.0]],
    trees: [[-26, -24], [26, -26], [-26, 26], [26, 24], [-14, -2], [16, 6]],
    rocks: 6, border: 20,
    decor: [['crate_A_big', -8, -18, 0.3], ['crate_A_small', -9, -16.8, 1], ['barrel', 7, -17, 0], ['barrel', 8, -16, 0.6], ['sack', 6.4, -18.5, 0.2],
      ['wheelbarrow', -14, 8, 1.2], ['tent', 18, 20, -2.4, 1.2], ['resource_lumber', 12, -6, 0.4], ['flag_yellow', -3, -28, 0, 1.6], ['flag_yellow', 3, -28, 0, 1.6]],
    zones: ZONES.pigfarm,
    portals: [{ x: 0, z: -29.5, to: 'henesys', arrive: { x: 0, z: 23 }, sign: 'Henesys' }],
  },
  hunting2: {
    id: 'hunting2', name: 'Henesys Hunting Ground II', half: 40, seed: 31, spawn: { x: -33, z: 0 },
    theme: { ground: '#74c04c', grassDark: 'rgba(70,140,50,.4)', tuft: 0x3f9030 },
    paths: [[[[-41, 0], [-26, -4], [-8, 3], [10, -3], [26, 2], [41, 0]], 3]],
    hills: [[-22, 18, 9, 2.4], [-8, -20, 8, 1.8], [8, 20, 10, 2.8], [24, -18, 9, 2.2], [30, 22, 7, 1.6]],
    trees: [[-34, -28], [-30, 30], [-14, -34], [0, 32], [16, -32], [20, 30], [34, -26], [34, 28], [-20, 4], [6, -8], [18, 10], [-4, 14], [30, -4]],
    rocks: 14, border: 28, zones: ZONES.hunting2,
    portals: [
      { x: -37.5, z: 0, to: 'hunting', arrive: { x: 33, z: 0 }, sign: 'Hunting Ground I' },
      { x: 37.5, z: 0, to: 'ruins', arrive: { x: -27, z: 0 }, sign: 'Skeleton Ruins' },
    ],
  },
  ruins: {
    id: 'ruins', name: 'Skeleton Ruins', half: 34, seed: 41, spawn: { x: -27, z: 0 },
    theme: { ground: '#8a8f7a', grassDark: 'rgba(90,90,80,.4)', grassLight: 'rgba(150,150,130,.35)', path: '#a8a294', pathEdge: '#6f6a5e',
      tuft: 0x6f7a50, sky: 0x6f7fa8, fog: 0x7f88a0, hemi: 0xc8c8e0, sun: 0xffd8b0, dusk: true, flowers: false },
    paths: [[[[-35, 0], [-18, 4], [0, -3], [16, 3], [30, 0]], 3.6]],
    hills: [[-14, -20, 7, 1.6], [10, 20, 8, 2], [24, -16, 6, 1.4]],
    trees: [[-28, -26], [-26, 26], [28, -26], [26, 26], [0, -24], [2, 24]],
    rocks: 12, border: 16,
    decor: [['tent', -18, -12, 0.6], ['tent', 16, 14, -2], ['crate_B_big', -6, 10, 0.4], ['crate_A_small', -5, 11.4, 1.2], ['barrel', 8, -10, 0],
      ['weaponrack', 20, -4, -1.6, 1.3], ['flag_red', -24, -6, 0, 1.6], ['flag_red', -24, 6, 0, 1.6], ['bucket_arrows', 14, -12, 0, 1.2]],
    zones: ZONES.ruins,
    portals: [{ x: -31.5, z: 0, to: 'hunting2', arrive: { x: 33, z: 0 }, sign: 'Hunting Ground II' }],
  },
};

export const FIELD_IDS = Object.keys(DEFS);
export const buildMap = id => buildField(DEFS[id]);
