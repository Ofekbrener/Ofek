// Coco: the chicken hero who pilots the pod and talks the player through the
// journey (welcome, next steps, coach tips, hand-offs, race intros).

const INK = '#2a1c33';

// Hand-drawn portrait (120×120). `mood`: 'happy' | 'wow' | 'wink'.
export function cocoSVG(mood = 'happy', cls = 'coco') {
  const eyes = mood === 'wink'
    ? `<circle cx="51" cy="48" r="5" fill="#fff"/><circle cx="52" cy="49" r="2.6" fill="${INK}" stroke="none"/>
       <path d="M64.5 48.5c2.5-2.4 6.5-2.4 9 0" fill="none"/>`
    : `<circle cx="51" cy="48" r="5.2" fill="#fff"/><circle cx="69" cy="48" r="5.2" fill="#fff"/>
       <circle cx="52" cy="49" r="${mood === 'wow' ? 3.2 : 2.6}" fill="${INK}" stroke="none"/><circle cx="70" cy="49" r="${mood === 'wow' ? 3.2 : 2.6}" fill="${INK}" stroke="none"/>
       <circle cx="53" cy="47.6" r="1" fill="#fff" stroke="none"/><circle cx="71" cy="47.6" r="1" fill="#fff" stroke="none"/>`;
  const beak = mood === 'wow'
    ? `<path d="M53.5 55h13l-6.5 5z" fill="#ffb21f"/><path d="M55 60.5h10l-5 5z" fill="#e8901a"/>`
    : `<path d="M53.5 55h13l-6.5 9z" fill="#ffb21f"/>`;
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true">
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M73 76c10 2 18 8 22 18-6-1-11-4-15-8l-3 9c-4-6-6-12-4-19z" fill="#e8412c"/>
    <path d="M30 90c0-19 13-31 30-31s30 12 30 31c0 14-13 23-30 23S30 104 30 90z" fill="#d17f36"/>
    <path d="M45 94c0-9 7-15 15-15s15 6 15 15c0 7-7 12-15 12s-15-5-15-12z" fill="#f4c98f" stroke="none"/>
    <path d="M33 82c-11-3-17-13-16-24 7 3 12 8 14 14 1-5 4-8 8-9-1 7-1 13-6 19z" fill="#b8652a"/>
    <path d="M88 84c6 3 9 10 8 17-5-2-9-6-11-12z" fill="#b8652a"/>
    <circle cx="60" cy="46" r="24" fill="#d98a3c"/>
    <path d="M47 27c-3-7 3-12 8-8 1-8 10-8 11-1 5-5 12 0 9 7" fill="#e8412c"/>
    <path d="M37 37c14-7 32-7 46 0" fill="none" stroke-width="7" stroke="${INK}"/>
    <path d="M37 37c14-7 32-7 46 0" fill="none" stroke-width="3.5" stroke="#6b4428"/>
    <circle cx="50" cy="34" r="7.5" fill="#8fd8ff"/><circle cx="70" cy="34" r="7.5" fill="#8fd8ff"/>
    <path d="M46.5 31.5l3-2.5M66.5 31.5l3-2.5" stroke="#fff" stroke-width="2"/>
    ${eyes}
    <circle cx="44" cy="57" r="3.6" fill="#ff8c7a" stroke="none" opacity=".75"/><circle cx="76" cy="57" r="3.6" fill="#ff8c7a" stroke="none" opacity=".75"/>
    ${beak}
    <path d="M60 64c3.4 0 4.4 6.4 0 7.4-3.6-1-3.4-6.4 0-7.4z" fill="#e8412c"/>
    <path d="M41 67c12 6 26 6 38 0l2 7.5c-13 7-29 7-42 0z" fill="#e8412c"/>
  </g></svg>`;
}

// Short lines Coco says in coach tips and hand-offs (first person, a bit silly).
export const COCO = {
  name: 'Coco',
  welcome: "Bawk! I'm <b>Coco</b>, your pilot. The Space Hens stole every egg in the galaxy, and we're getting them back. Buckle up!",
};
