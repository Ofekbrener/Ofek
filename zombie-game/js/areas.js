// Story areas for "Last Broadcast": 5 districts of 5 waves each, the 5th wave of each is its boss.
// Each area has its own layout, light, new zombie type, boss, and Doc's radio lines.
'use strict';
const STREET_LAMPS = [[-4.6, -4.6, Math.PI * .25], [4.6, 4.6, Math.PI * 1.25], [4.6, -4.6, -Math.PI * .25], [-4.6, 4.6, Math.PI * .75]];
const AREA_E = 19.5;
const OPEN_EDGE = [['TrafficBarrier_1', -5.5, -AREA_E, 0], ['TrafficBarrier_1', 5.5, -AREA_E, 0], ['TrafficBarrier_2', -5.5, AREA_E, 0], ['TrafficBarrier_2', 5.5, AREA_E, 0],
  ['PlasticBarrier', -AREA_E, -5.5, Math.PI / 2], ['PlasticBarrier', -AREA_E, 5.5, Math.PI / 2], ['PlasticBarrier', AREA_E, -5.5, Math.PI / 2], ['PlasticBarrier', AREA_E, 5.5, Math.PI / 2]];
// who: DOC (Dr. Adler), ARMY (the quarantine wall), NOTE (a found page)
const say = (who, ...lines) => lines.map(text => ({who, text}));

const AREAS = [
  {name: 'ST. MERCY HOSPITAL', layout: 'mercy', short: 'St. Mercy', goal: 'Get the cure case out of the cold room', newZombie: null, boss: 'orderly', rain: true,
    look: {sky: 0x5a6aa0, ground: 0x120e0a, hemiI: .3, moon: 0x9fb4ff, moonI: .72, fog: 0x070a12, fogNear: 18, fogFar: 40, exposure: .9},
    lampCol: 0xd8ecff, lampI: 3,
    cover: [['Vehicle_Pickup', -9, -10, 0], ['Vehicle_Sports', 10, 9, Math.PI / 2], ['Container_Red', 12, -12, 0], ['WaterTower', -14, 13, 0, -.4], ['Wheels_Stack', 7, -7, 0, -.1], ['Couch', -7, 8, Math.PI / 2, -.1]],
    decor: [['TrafficCone_1', 2.5, 6, 0], ['TrafficCone_2', -2.6, -6.5, 1], ['TrafficCone_1', 6, -2.4, 2], ['TrashBag_1', -10.5, -5, 0], ['TrashBag_2', 9.5, 4.5, 1], ['Pallet_Broken', -5, 12, .4],
      ['CinderBlock', 5, 12, .2], ['FireHydrant', -4.4, -9, 0], ['TrafficLight_1', 4.3, -4.3, -Math.PI / 4], ['TownSign', -6, -15.5, 0], ['Pipes', 14, 3, Math.PI / 2], ['Pallet', -14, -3, 0], ['TrashBag_1', 13.5, -6, 2]],
    edge: [['Container_Green', -12, -AREA_E - 1.3, 0], ['Vehicle_Truck_Armored', 12, -AREA_E - 2, Math.PI / 2], ['Container_Red', -12, AREA_E + 1.3, 0], ['Container_Green', 12, AREA_E + 1.3, 0],
      ['Container_Green', -AREA_E - 1.3, -12, Math.PI / 2], ['Vehicle_Pickup', -AREA_E - 1.5, 11, .1], ['Container_Red', AREA_E + 1.3, 12, Math.PI / 2], ['Vehicle_Sports', AREA_E + 1.5, -11, .2], ...OPEN_EDGE],
    dress() {
      signPlane(['ST. MERCY', 'HOSPITAL'], 7, 2.6, {bg: '#f2f2ee', fg: '#c01818', x: -12, y: 4.2, z: -AREA_E - 2.95, glow: .5});
      for (const [x, z, r] of [[12, AREA_E - .1, Math.PI], [AREA_E - .1, 12, -Math.PI / 2], [-AREA_E + .1, -12, Math.PI / 2]]) signPlane(['+'], 1.6, 1.6, {bg: '#f4f4f4', fg: '#d01010', x, y: 1.6, z, rot: r});
    },
    radio: {
      0: say('DOC', 'This is Dr. Adler. You\'re alive. Good.', 'The cure is in the hospital cold room. Clear the lot and I\'ll talk you in.'),
      2: say('DOC', 'They follow noise. You are making a lot of it.'),
      3: say('DOC', 'The cold room door is open. Keep them off you a little longer.'),
      boss: say('DOC', 'That\'s the night orderly. Big man. He charges in a straight line.', 'Step aside, then hit him while he\'s dazed.'),
      after: say('DOC', 'You have the case. Don\'t drop it.', 'Head for the subway. It\'s the only way across the river.'),
    }},
  {name: 'SUBWAY PLAZA', layout: 'subway', short: 'Subway', goal: 'Cross the plaza to the river tunnel', newZombie: 'crawler', boss: 'conductor', rain: false,
    look: {sky: 0x2e4a38, ground: 0x050806, hemiI: .18, moon: 0x8ab89a, moonI: .4, fog: 0x040806, fogNear: 14, fogFar: 34, exposure: .95, groundCol: 0x101410},
    lampCol: 0x6aff8a, lampI: 2.4, slab: 0x1c201e,
    cover: [['Container_Green', -9, -9, 0], ['Container_Green', -9, -3.6, 0], ['Container_Red', 9, 9, 0], ['Container_Red', 9, 3.6, 0], ['Wheels_Stack', 8, -8, 0, -.1], ['Couch', -8, 9, 0, -.1]],
    decor: [['TrashBag_1', -3, -7, 0], ['TrashBag_2', 4, 7, 1], ['TrashBag_1', -12, 2, 2], ['Pallet_Broken', 3, -12, .3], ['CinderBlock', -4, 12, 0], ['Pipes', 13, -3, 0], ['TrafficCone_2', 6, -2, 0], ['TownSign', 6, -15.5, 0]],
    edge: [['Container_Green', -12, -AREA_E - 1.3, 0], ['Container_Green', 12, -AREA_E - 1.3, 0], ['Container_Red', -12, AREA_E + 1.3, 0], ['Container_Red', 12, AREA_E + 1.3, 0],
      ['Container_Green', -AREA_E - 1.3, -12, Math.PI / 2], ['Container_Red', -AREA_E - 1.3, 12, Math.PI / 2], ['Container_Green', AREA_E + 1.3, 12, Math.PI / 2], ['Container_Red', AREA_E + 1.3, -12, Math.PI / 2], ...OPEN_EDGE],
    dress() { signPlane(['SUBWAY'], 6, 1.6, {bg: '#0e3a1e', fg: '#9dffb4', x: 0, y: 4, z: -AREA_E - .6, glow: 1}); },
    radio: {
      0: say('DOC', 'The trains stopped on day one. Stay out of the dark corners.'),
      1: say('DOC', 'Watch the ground. Some of them crawl now.'),
      2: [...say('NOTE', 'LAB NOTE 14. Subject zero: Dr. M. Adler. Dose given to self.'), ...say('DOC', 'Those are old notes. Ignore them.')],
      boss: say('DOC', 'The Conductor still blows his whistle.', 'Every time he does, more of them come running.'),
      after: say('DOC', 'The docks are next. Hurry. I don\'t have much time.', 'I mean... the city doesn\'t.'),
    }},
  {name: 'THE DOCKS', layout: 'docks', short: 'Docks', goal: 'Find a boat across the harbor', newZombie: 'bloater', boss: 'harbor', rain: false,
    look: {sky: 0x8a6040, ground: 0x0a0806, hemiI: .26, moon: 0xffa868, moonI: .45, fog: 0x120d0a, fogNear: 11, fogFar: 32, exposure: .92, groundCol: 0x15120f},
    lampCol: 0xff9a40, lampI: 3.6, slab: 0x2a241e,
    cover: [['Container_Red', -10, -8, Math.PI / 2], ['Container_Green', 10, -10, 0], ['Container_Green', -10, 10, 0], ['Container_Red', 11, 9, Math.PI / 2], ['Pallet', 6, 6, .2], ['Wheels_Stack', -6, -12, 0, -.1]],
    decor: [['Pallet_Broken', -4, 7, .5], ['Pallet', 4, -7, 0], ['CinderBlock', -13, 0, 0], ['Pipes', 13, 0, Math.PI / 2], ['TrashBag_1', 2, 12, 0], ['TrafficCone_1', -7, 3, 0], ['FireHydrant', 7, 3, 0]],
    edge: [['Container_Red', -12, -AREA_E - 1.3, 0], ['Container_Green', 12, -AREA_E - 1.3, 0], ['Container_Green', -12, AREA_E + 1.3, 0], ['Container_Red', 12, AREA_E + 1.3, 0],
      ['Container_Red', -AREA_E - 1.3, -12, Math.PI / 2], ['Container_Green', -AREA_E - 1.3, 12, Math.PI / 2], ['Container_Red', AREA_E + 1.3, 12, Math.PI / 2], ['Container_Green', AREA_E + 1.3, -12, Math.PI / 2], ...OPEN_EDGE],
    dress() { signPlane(['PIER 9'], 4, 1.4, {bg: '#20160e', fg: '#ffb060', x: 12, y: 3.6, z: -AREA_E - 2.95, glow: .6}); },
    radio: {
      0: say('DOC', 'The bridge is gone. Find a boat across the harbor.'),
      1: say('DOC', 'Don\'t hit the swollen ones up close. They burst.'),
      2: [...say('ARMY', '...any survivor on this channel... do not trust Adler. Repeat, do not trust Adler...'), ...say('DOC', 'Static. Ignore it.')],
      boss: say('DOC', 'The harbor master. Watch for shadows on the ground.', 'He throws whole containers.'),
      after: say('DOC', 'You\'re across. The highway is next. My people will meet you there.'),
    }},
  {name: 'THE HIGHWAY', layout: 'highway', short: 'Highway', goal: 'Get past Doc\'s convoy', newZombie: 'riot', boss: 'convoy', rain: false,
    look: {sky: 0xff9a70, ground: 0x2a1a14, hemiI: .42, moon: 0xffa070, moonI: .9, fog: 0x2a1c1c, fogNear: 20, fogFar: 46, exposure: .95, groundCol: 0x1c1816},
    lampCol: 0xffc890, lampI: 2, slab: 0x332c28,
    cover: [['Vehicle_Sports', -9, -6, .3], ['Vehicle_Pickup', 9, 7, -.4], ['TrafficBarrier_1', -6, 10, 0], ['TrafficBarrier_2', 6, -10, 0], ['Vehicle_Sports', 11, -12, 1.4]],
    decor: [['TrafficCone_1', 2, 4, 0], ['TrafficCone_2', -2, -4, 0], ['TrafficCone_1', 3, -6, 0], ['TrafficCone_2', -3, 6, 0], ['TrashBag_2', -12, 3, 0], ['Wheels_Stack', 13, 2, 0], ['TownSign', -6, -15.5, 0]],
    edge: [['Vehicle_Truck_Armored', -12, -AREA_E - 2, Math.PI / 2], ['Vehicle_Pickup', 12, -AREA_E - 1.5, 0], ['Vehicle_Sports', -12, AREA_E + 1.5, 0], ['Vehicle_Truck_Armored', 12, AREA_E + 2, Math.PI / 2],
      ['Vehicle_Pickup', -AREA_E - 1.5, -12, Math.PI / 2], ['Vehicle_Sports', -AREA_E - 1.5, 12, Math.PI / 2], ['Vehicle_Pickup', AREA_E + 1.5, 12, Math.PI / 2], ['Vehicle_Sports', AREA_E + 1.5, -12, Math.PI / 2], ...OPEN_EDGE],
    dress() { signPlane(['I-9', 'QUARANTINE 2 MI'], 5, 2.4, {bg: '#0e5a2a', fg: '#ffffff', x: 0, y: 4.5, z: -AREA_E - .6}); },
    radio: {
      0: say('DOC', 'I\'m sending a truck. Hand the case to my people.'),
      1: say('DOC', 'Shields? Those were riot police. Get behind them.'),
      2: say('DOC', 'Fine. You read the notes. Yes, I was subject zero.', 'The cure is the only thing keeping me human. Give it to me. I can fix what I did.'),
      boss: say('DOC', 'If you won\'t give it to me, my truck will take it.'),
      after: say('ARMY', 'Survivor, we see you. Get to the quarantine wall. We\'ll open the gate.'),
    }},
  {name: 'QUARANTINE WALL', layout: 'wall', short: 'The Wall', goal: 'Hold the yard until the gate opens', newZombie: 'screamer', boss: 'zero', rain: true,
    look: {sky: 0x5a6688, ground: 0x0a0a10, hemiI: .28, moon: 0xdfe6ff, moonI: .7, fog: 0x07080c, fogNear: 16, fogFar: 40, exposure: .92},
    lampCol: 0xffffff, lampI: 3.8, slab: 0x26262c,
    cover: [['WaterTower', 0, -13, 0, -.4], ['Container_Green', -11, 8, 0], ['Container_Red', 11, 8, 0], ['TrafficBarrier_1', -6, -6, 0], ['TrafficBarrier_2', 6, -6, 0], ['Wheels_Stack', 0, 10, 0, -.1]],
    decor: [['PlasticBarrier', -3, 4, 0], ['PlasticBarrier', 3, 4, 0], ['TrafficCone_1', -8, 0, 0], ['TrafficCone_2', 8, 0, 0], ['Pallet', -13, -4, 0], ['CinderBlock', 13, -4, 0], ['TrashBag_1', -4, 13, 0]],
    edge: [['Vehicle_Truck_Armored', -12, -AREA_E - 2, Math.PI / 2], ['Vehicle_Truck_Armored', 12, -AREA_E - 2, Math.PI / 2], ['Container_Green', -12, AREA_E + 1.3, 0], ['Container_Green', 12, AREA_E + 1.3, 0],
      ['Container_Red', -AREA_E - 1.3, -12, Math.PI / 2], ['Container_Red', -AREA_E - 1.3, 12, Math.PI / 2], ['Container_Red', AREA_E + 1.3, 12, Math.PI / 2], ['Container_Red', AREA_E + 1.3, -12, Math.PI / 2], ...OPEN_EDGE],
    dress() { signPlane(['QUARANTINE ZONE', 'NO ENTRY'], 8, 2.4, {bg: '#f2c400', fg: '#111111', x: 0, y: 4.4, z: -AREA_E - .6, glow: .4}); },
    radio: {
      0: say('ARMY', 'Floodlights are on. Hold the yard until we get the gate open.'),
      1: say('DOC', 'Can you hear them screaming? I can. I\'m starting to understand them.'),
      3: say('DOC', 'Last chance. Bring the case to me.'),
      boss: say('DOC', 'No more radio. I\'m coming myself.'),
      after: [],
    }},
];
// one boss per area; moves: charge, slam, summon (more to come per area)
const BOSSES = {
  orderly: {name: 'THE ORDERLY', sub: 'he charges in straight lines', tint: 0xcfeee8, scale: 2.0, hp: 30, moves: ['charge', 'charge', 'slam']},
  conductor: {name: 'THE CONDUCTOR', sub: 'his whistle calls runners', tint: 0x9fd0a8, scale: 2.0, hp: 40, moves: ['summon', 'charge', 'summon', 'slam'], summon: 'runner'},
  harbor: {name: 'THE HARBOR MASTER', sub: 'watch for shadows', tint: 0xffb080, scale: 2.3, hp: 52, moves: ['throw', 'slam', 'throw', 'charge'], drops: 3},
  convoy: {name: 'THE CONVOY BOSS', sub: 'stay out of the red lanes', tint: 0xff9a8a, scale: 2.2, hp: 64, moves: ['lanes', 'charge', 'lanes', 'slam']},
  zero: {name: 'PATIENT ZERO', sub: 'Dr. Adler', tint: 0xd0a0ff, scale: 2.4, hp: 90, moves: ['charge', 'slam'], summon: 'mix', drops: 4,
    phases: [['charge', 'slam', 'throw'], ['summon', 'charge', 'lanes', 'slam'], ['charge', 'throw', 'lanes', 'slam', 'summon']]},
};
// story waves 1 to 25 walk the 5 districts once; endless mode (wave 26 and up) loops them
const areaIndex = wave => Math.floor((Math.max(1, wave) - 1) / 5) % AREAS.length;
const storyFlag = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const curArea = () => AREAS[G.area || 0];
const bossProfile = () => BOSSES[curArea().boss];
