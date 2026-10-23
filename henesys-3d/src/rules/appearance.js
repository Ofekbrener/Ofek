// Character appearance: palettes for the creator and validation for saves. Pure.

// Each style is one of the KayKit heads.
export const HAIR_STYLES = ['rogue', 'knight', 'mage', 'barbarian', 'hooded'];
const OLD_STYLES = { short: 'rogue', long: 'rogue', pigtails: 'rogue', spiky: 'barbarian', bald: 'knight' };

export const PALETTES = {
  hair: [0x7a4a24, 0x2a2220, 0xf1c34e, 0xc0392b, 0xe8e8f0, 0x3d6fd1, 0xf28cb8, 0x58b04a],
  skin: [0xffdcbc, 0xf6c79e, 0xd9a273, 0xa8673c, 0x6e4126],
  eyes: [0x4a2c14, 0x2f7de1, 0x2f7a3a, 0x7a3fb0, 0x1a1210],
  shirt: [0xf4f1ea, 0x58b04a, 0xe0483a, 0x3d6fd1, 0xf2c832, 0xf28cb8, 0x7a5a9a, 0x2a2a30],
  pants: [0x3d6fd1, 0x7a5232, 0x464a5a, 0x2a2a30, 0xf4f1ea, 0x2f6a38, 0xc0392b, 0xf28cb8],
};
const BOTTOMS = ['pants', 'skirt'];

export const defaultAppearance = () => ({
  hairStyle: 'rogue', hair: PALETTES.hair[0], skin: PALETTES.skin[0], eyes: PALETTES.eyes[0],
  shirt: PALETTES.shirt[0], pants: PALETTES.pants[0], bottom: 'pants',
});

// The three looks of the first version, kept so old saves load.
const LEGACY = [
  { hair: PALETTES.hair[0], shirt: PALETTES.shirt[0], pants: PALETTES.pants[0] },
  { hair: PALETTES.hair[1], shirt: PALETTES.shirt[1], pants: PALETTES.pants[1] },
  { hair: PALETTES.hair[2], shirt: PALETTES.shirt[2], pants: PALETTES.pants[2] },
];

/** Any stored look (old number, partial object, garbage) -> a valid appearance. */
export function normalizeLook(look) {
  const d = defaultAppearance();
  if (typeof look === 'number') return { ...d, ...(LEGACY[look] ?? {}) };
  if (!look || typeof look !== 'object') return d;
  const pick = (key, list) => (list.includes(look[key]) ? look[key] : d[key]);
  return {
    hairStyle: OLD_STYLES[look.hairStyle] ?? pick('hairStyle', HAIR_STYLES),
    hair: pick('hair', PALETTES.hair),
    skin: pick('skin', PALETTES.skin),
    eyes: pick('eyes', PALETTES.eyes),
    shirt: pick('shirt', PALETTES.shirt),
    pants: pick('pants', PALETTES.pants),
    bottom: pick('bottom', BOTTOMS),
  };
}

export function randomAppearance(rng = Math.random) {
  const any = list => list[Math.floor(rng() * list.length)];
  return {
    hairStyle: any(HAIR_STYLES), hair: any(PALETTES.hair), skin: any(PALETTES.skin), eyes: any(PALETTES.eyes),
    shirt: any(PALETTES.shirt), pants: any(PALETTES.pants), bottom: any(BOTTOMS),
  };
}
