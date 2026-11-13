// Looping 3-second previews for element and gear cards: a survivor on the left, zombies walking in from the right,
// and the effect playing out on them (frost slows them and turns them blue, fire burns, lightning chains, ...).
'use strict';
const PV_DUR = '3s';
const anim = (attr, values, keyTimes, extra = '') => `<animate attributeName="${attr}" values="${values}" keyTimes="${keyTimes}" dur="${PV_DUR}" repeatCount="indefinite" ${extra}/>`;
const moveX = (values, keyTimes) => `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${keyTimes}" dur="${PV_DUR}" repeatCount="indefinite" additive="sum"/>`;
// a small zombie silhouette; body color can be animated
function pvZombie(x, y = 0, bodyAnim = '', inner = '', walk = '') {
  return `<g transform="translate(${x} ${y})">${walk}<g>
    <animateTransform attributeName="transform" type="rotate" values="-4 0 0;4 0 0;-4 0 0" dur=".6s" repeatCount="indefinite"/>
    <line x1="-4" y1="20" x2="-7" y2="34" stroke="#2c4a22" stroke-width="5" stroke-linecap="round"/><line x1="4" y1="20" x2="7" y2="34" stroke="#2c4a22" stroke-width="5" stroke-linecap="round"/>
    <rect x="-8" y="-2" width="16" height="24" rx="5" fill="#6fbf4a">${bodyAnim}</rect>
    <line x1="-6" y1="4" x2="-20" y2="6" stroke="#6fbf4a" stroke-width="5" stroke-linecap="round">${bodyAnim.replace(/fill/g, 'stroke')}</line>
    <circle cy="-10" r="8" fill="#7fd05a">${bodyAnim}</circle><circle cx="-4" cy="-11" r="1.6" fill="#ff3030"/><circle cx="2" cy="-11" r="1.6" fill="#ff3030"/>${inner}</g></g>`;
}
// the survivor swinging at about 0.25 of the loop
function pvHero(col = '#ffcc33') {
  return `<g transform="translate(42 84)"><line x1="-4" y1="20" x2="-6" y2="34" stroke="#1d2a44" stroke-width="5" stroke-linecap="round"/><line x1="4" y1="20" x2="6" y2="34" stroke="#1d2a44" stroke-width="5" stroke-linecap="round"/>
    <rect x="-8" y="-2" width="16" height="24" rx="5" fill="#3a6fb0"/><circle cy="-10" r="8" fill="#e0ac85"/>
    <g><animateTransform attributeName="transform" type="rotate" values="-70 4 4;-70 4 4;60 4 4;60 4 4;-70 4 4" keyTimes="0;.18;.26;.6;1" dur="${PV_DUR}" repeatCount="indefinite"/>
      <line x1="4" y1="4" x2="30" y2="-4" stroke="#d8dde8" stroke-width="4" stroke-linecap="round"/><line x1="26" y1="-3" x2="32" y2="-5" stroke="${col}" stroke-width="5" stroke-linecap="round"/></g></g>`;
}
const pvGround = `<rect x="0" y="118" width="220" height="22" fill="#141820"/><line x1="0" y1="118" x2="220" y2="118" stroke="#2a3040" stroke-width="2"/>`;
const pvTick = (x, y, col, t0, txt = '1') => `<text x="${x}" y="${y}" font-family="Oswald,sans-serif" font-size="13" font-weight="700" fill="${col}" text-anchor="middle" opacity="0">${txt}
  ${anim('opacity', '0;0;1;0;0', `0;${t0};${t0 + .02};${t0 + .2};1`)}<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -16;0 -16" keyTimes="0;${t0};${t0 + .2};1" dur="${PV_DUR}" repeatCount="indefinite"/></text>`;
const wrap = (inner, bg) => `<svg viewBox="0 0 220 140" class="pv" xmlns="http://www.w3.org/2000/svg"><rect width="220" height="140" fill="${bg}"/>${pvGround}${inner}</svg>`;

const PREVIEW = {
  // frost: the hit turns the zombie blue and it slows to a crawl, ice crystals form
  frost: () => wrap(pvHero('#8fe8ff') + pvZombie(150, 84,
    anim('fill', '#6fbf4a;#6fbf4a;#bfefff;#bfefff;#6fbf4a', '0;.25;.27;.95;1'),
    `<g opacity="0">${anim('opacity', '0;0;1;1;0', '0;.25;.3;.92;1')}<path d="M-12 -2l-6-6M12 0l6-6M0 -20v-7M-10 22l-6 4M10 22l6 4" stroke="#e8fbff" stroke-width="2.5" stroke-linecap="round"/></g>`,
    moveX('40 0;-50 0;-56 0;-70 0;40 0', '0;.25;.3;.95;1')) +
    `<g opacity="0">${anim('opacity', '0;0;1;0', '0;.25;.3;1')}<text x="120" y="46" font-family="Oswald,sans-serif" font-size="15" fill="#bfefff" text-anchor="middle">SLOWED 50%</text></g>` +
    Array.from({length: 7}, (_, i) => `<circle cx="${30 + i * 26}" cy="0" r="2" fill="#fff" opacity=".7"><animateTransform attributeName="transform" type="translate" values="0 ${-10 - i * 9};${(i % 2 ? 6 : -6)} 130" dur="${2 + i * .3}s" repeatCount="indefinite"/></circle>`).join(''), '#0b1622'),
  // fire: the zombie catches fire and burn ticks pop above it
  fire: () => wrap(pvHero('#ff8a1a') + pvZombie(150, 84,
    anim('fill', '#6fbf4a;#6fbf4a;#ff9a40;#c85a20;#6fbf4a', '0;.25;.27;.95;1'),
    `<g opacity="0">${anim('opacity', '0;0;1;1;0', '0;.25;.28;.95;1')}${[-8, 0, 8].map((x, i) => `<path d="M${x} 18 q-5 -12 0 -26 q5 14 0 26z" fill="${['#ff4a10', '#ffcf3a', '#ff8a1a'][i]}"><animateTransform attributeName="transform" type="scale" values="1 1;1 1.3;1 .9;1 1" dur=".4s" repeatCount="indefinite" additive="sum"/></path>`).join('')}</g>`,
    moveX('40 0;-46 0;-60 0;-66 0;40 0', '0;.25;.5;.95;1')) + pvTick(100, 66, '#ff9a3a', .4) + pvTick(98, 66, '#ff9a3a', .65) + pvTick(96, 66, '#ff9a3a', .9 - .02), '#1a0e08'),
  // storm: lightning jumps from the hit zombie to two more
  storm: () => wrap(pvHero('#bfe0ff') + pvZombie(108, 84, anim('fill', '#6fbf4a;#6fbf4a;#e8f6ff;#6fbf4a', '0;.25;.3;.45')) + pvZombie(155, 70, anim('fill', '#6fbf4a;#6fbf4a;#e8f6ff;#6fbf4a', '0;.3;.34;.5')) + pvZombie(190, 92, anim('fill', '#6fbf4a;#6fbf4a;#e8f6ff;#6fbf4a', '0;.34;.38;.55')) +
    `<polyline points="108,82 125,70 135,80 155,68" fill="none" stroke="#e8f6ff" stroke-width="3" opacity="0">${anim('opacity', '0;0;1;0;0', '0;.28;.3;.36;1')}</polyline>
     <polyline points="155,68 166,82 176,76 190,90" fill="none" stroke="#e8f6ff" stroke-width="3" opacity="0">${anim('opacity', '0;0;1;0;0', '0;.32;.34;.4;1')}</polyline>
     <rect width="220" height="140" fill="#cfe6ff" opacity="0">${anim('opacity', '0;0;.25;0;0', '0;.28;.3;.4;1')}</rect>` + pvTick(108, 60, '#bfe0ff', .3) + pvTick(155, 46, '#bfe0ff', .34) + pvTick(190, 68, '#bfe0ff', .38), '#0a0f1e'),
  // poison: a green cloud stays where the hit landed and hurts zombies walking through
  poison: () => wrap(pvHero('#9dff4a') +
    `<g opacity="0">${anim('opacity', '0;0;.85;.85;0', '0;.25;.3;.9;1')}<ellipse cx="112" cy="104" rx="34" ry="16" fill="#7ad82a" opacity=".45"><animate attributeName="rx" values="24;38;34" dur="1.2s" repeatCount="indefinite"/></ellipse>
      ${[96, 112, 126].map((x, i) => `<circle cx="${x}" cy="104" r="3" fill="#c8ff8a"><animate attributeName="cy" values="106;86" dur="${.9 + i * .2}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="${.9 + i * .2}s" repeatCount="indefinite"/></circle>`).join('')}</g>` +
    pvZombie(150, 84, anim('fill', '#6fbf4a;#6fbf4a;#a8e04a;#6fbf4a', '0;.3;.4;1'), '', moveX('40 0;-38 0;-62 0;-96 0;40 0', '0;.25;.55;.95;1')) + pvTick(112, 70, '#9dff4a', .45) + pvTick(106, 70, '#9dff4a', .7), '#0c160a'),
  // gear previews
  blades: () => wrap(pvHero() + `<g transform="translate(46 96)"><g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="1.2s" repeatCount="indefinite"/>
    ${[0, 120, 240].map(a => `<g transform="rotate(${a}) translate(30 0)"><path d="M-7 0l14 -3 0 6z" fill="#dfe8ff"/></g>`).join('')}</g><circle r="30" fill="none" stroke="#a8fff0" stroke-dasharray="3 6" opacity=".5"/></g>` +
    pvZombie(150, 84, anim('fill', '#6fbf4a;#6fbf4a;#ffffff;#6fbf4a', '0;.45;.47;.52'), '', moveX('50 0;-70 0;-70 0;50 0', '0;.45;.95;1')) + pvTick(80, 66, '#a8fff0', .46), '#0b1418'),
  dog: () => wrap(pvHero() + `<g><animateTransform attributeName="transform" type="translate" values="40 100;120 100;120 100;40 100" keyTimes="0;.35;.85;1" dur="${PV_DUR}" repeatCount="indefinite"/>
    <ellipse rx="14" ry="6" fill="#8a5a2a"/><circle cx="14" cy="-6" r="6" fill="#8a5a2a"/><path d="M12 -12l3 -6 3 6z" fill="#5a3a1a"/><line x1="-8" y1="4" x2="-10" y2="14" stroke="#5a3a1a" stroke-width="3"/><line x1="8" y1="4" x2="10" y2="14" stroke="#5a3a1a" stroke-width="3"/></g>` +
    pvZombie(150, 84, anim('fill', '#6fbf4a;#6fbf4a;#ffffff;#6fbf4a', '0;.36;.38;.44')) + pvTick(150, 60, '#a8fff0', .37, '2') + pvTick(150, 60, '#a8fff0', .62, '2'), '#14100a'),
  molotov: () => wrap(pvHero() + `<g><animateMotion path="M48 80 Q100 10 150 108" dur="${PV_DUR}" keyPoints="0;0;1;1" keyTimes="0;.1;.4;1" calcMode="linear" repeatCount="indefinite"/>
    <rect x="-3" y="-8" width="6" height="12" rx="2" fill="#7ad8a0"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.4;.41;1" dur="${PV_DUR}" repeatCount="indefinite"/></rect></g>
    <g opacity="0">${anim('opacity', '0;0;1;1;0', '0;.4;.42;.9;1')}${[130, 145, 160, 172].map((x, i) => `<path d="M${x} 118 q-6 -16 0 -30 q6 16 0 30z" fill="${['#ff4a10', '#ffcf3a', '#ff8a1a', '#ff4a10'][i]}"><animateTransform attributeName="transform" type="scale" values="1 1;1 1.25;1 1" dur=".35s" repeatCount="indefinite" additive="sum"/></path>`).join('')}</g>` +
    pvZombie(160, 84, anim('fill', '#6fbf4a;#6fbf4a;#ff9a40;#6fbf4a', '0;.42;.46;1')) + pvTick(160, 60, '#ff9a3a', .5) + pvTick(160, 60, '#ff9a3a', .75), '#140c08'),
  tesla: () => wrap(pvHero() + `<g transform="translate(70 92)"><rect x="-5" y="0" width="10" height="26" fill="#4a5a6a"/><circle r="8" fill="#a8fff0"><animate attributeName="opacity" values=".5;1;.5" dur=".5s" repeatCount="indefinite"/></circle></g>` +
    pvZombie(150, 84, anim('fill', '#6fbf4a;#6fbf4a;#e8fff8;#6fbf4a', '0;.3;.33;.4')) +
    `<polyline points="70,92 95,78 110,92 130,76 148,82" fill="none" stroke="#a8fff0" stroke-width="3" opacity="0">${anim('opacity', '0;0;1;0;0', '0;.28;.3;.36;1')}</polyline>` + pvTick(150, 60, '#a8fff0', .31), '#081418'),
  pulse: () => wrap(pvHero() + `<circle cx="46" cy="100" r="10" fill="none" stroke="#a8fff0" stroke-width="4" opacity="0">${anim('r', '10;10;90;90', '0;.3;.5;1')}${anim('opacity', '0;0;1;0;0', '0;.3;.31;.5;1')}</circle>` +
    pvZombie(120, 84, '', '', moveX('20 0;-20 0;-20 0;30 0;30 0;20 0', '0;.3;.38;.48;.95;1')) + pvZombie(170, 84, '', '', moveX('20 0;-20 0;-20 0;30 0;30 0;20 0', '0;.3;.42;.52;.95;1')) + pvTick(120, 60, '#a8fff0', .4), '#0b1418'),
  drone: () => wrap(pvHero() + `<g transform="translate(60 56)"><animateTransform attributeName="transform" type="translate" values="60 56;60 50;60 56" dur="1s" repeatCount="indefinite"/><rect x="-12" y="-4" width="24" height="8" rx="3" fill="#6a7a8a"/><circle r="3" fill="#ff3030"/><line x1="-16" y1="-6" x2="-6" y2="-6" stroke="#ccc" stroke-width="2"/><line x1="6" y1="-6" x2="16" y2="-6" stroke="#ccc" stroke-width="2"/></g>` +
    [.2, .45, .7].map(t => `<circle r="3" fill="#ffe14a" opacity="0"><animateMotion path="M60 58 L150 84" dur="${PV_DUR}" keyPoints="0;0;1;1" keyTimes="0;${t};${t + .08};1" calcMode="linear" repeatCount="indefinite"/>${anim('opacity', '0;0;1;0;0', `0;${t};${t + .01};${t + .08};1`)}</circle>`).join('') +
    pvZombie(150, 84, anim('fill', '#6fbf4a;#6fbf4a;#ffffff;#6fbf4a;#ffffff;#6fbf4a', '0;.28;.3;.53;.55;.6')) + pvTick(150, 60, '#ffe14a', .29) + pvTick(150, 60, '#ffe14a', .54), '#0e1016'),
};
// which preview a card shows, if any
function cardPreview(c) {
  if (c.id.startsWith('el_')) return PREVIEW[c.id.slice(3)] ? PREVIEW[c.id.slice(3)]() : '';
  if (c.id.startsWith('gear_')) return PREVIEW[c.id.slice(5)] ? PREVIEW[c.id.slice(5)]() : '';
  return '';
}
