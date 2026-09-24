// Hand-drawn SVG icon set (24×24, ink outline + flat fills) that replaces the
// emoji the UI text uses. Emoji stay in the source strings for readability; the
// iconizer swaps them for <svg><use> as text lands in the DOM, so every screen
// gets consistent art instead of the platform's emoji font.

const INK = '#2a1c33';
const C = {
  ink: INK, paper: '#fff4dc', white: '#ffffff', yolk: '#ffc23a', yolkD: '#e08a12', tomato: '#ef4a36',
  tomatoD: '#b3281c', teal: '#1fb5a3', sky: '#5cc3ff', grass: '#78c850', meat: '#d9772f', meatD: '#a9531c',
  steel: '#b8c2d6', steelD: '#7d879c', plum: '#7a4fa3', pink: '#ff7eb6', brown: '#8a5a2b', ice: '#bfeeff',
};

// id: inner SVG markup (drawn on a 24×24 grid; the <symbol> sets stroke defaults)
const ICONS = {
  drum: `<path d="M9.4 14.6 5.7 18.3" stroke-width="4.4"/><path d="M9.4 14.6 5.7 18.3" stroke="${C.paper}" stroke-width="1.6"/>
    <circle cx="4.6" cy="17.4" r="1.7" fill="${C.paper}"/><circle cx="6.6" cy="19.4" r="1.7" fill="${C.paper}"/>
    <ellipse cx="14.3" cy="9.7" rx="6.6" ry="5.2" transform="rotate(-45 14.3 9.7)" fill="${C.meat}"/>
    <path d="M12.2 6.6c1.3-1.2 3.3-1.6 4.9-.9" stroke="${C.paper}" stroke-width="1.4" fill="none"/>`,
  trophy: `<path d="M7.5 6H4.8a2.6 2.6 0 0 0 3.2 4M16.5 6h2.7a2.6 2.6 0 0 1-3.2 4" fill="none"/>
    <path d="M7 3.5h10V8a5 5 0 0 1-10 0z" fill="${C.yolk}"/><path d="M10.6 13h2.8l.6 3.6h-4z" fill="${C.yolkD}"/>
    <rect x="7.2" y="16.6" width="9.6" height="3.8" rx="1.1" fill="${C.brown}"/><path d="M9.4 5.5v2.6" stroke="${C.white}" stroke-width="1.4"/>`,
  flag: `<path d="M6 21V3.5" stroke-width="2.2"/><path d="M6 4h13v8.5H6z" fill="${C.white}"/>
    <path d="M6 4h3.25v2.8H6zM12.5 4h3.25v2.8H12.5zM9.25 6.8h3.25v2.9H9.25zM15.75 6.8H19v2.9h-3.25zM6 9.7h3.25v2.8H6zM12.5 9.7h3.25v2.8H12.5z" fill="${INK}" stroke="none"/>`,
  bolt: `<path d="M13.5 2 5 13.6h6.2L9.8 22l9.2-12.4h-6.3z" fill="${C.yolk}"/>`,
  wrench: `<path d="M15 3a4.6 4.6 0 0 0-4.4 6.1l-6.8 6.8a2 2 0 0 0 2.8 2.8l6.8-6.8A4.6 4.6 0 0 0 19.5 7l-2.9 2.9-2.7-.8-.8-2.7z" fill="${C.steel}"/>`,
  chicken: `<circle cx="12" cy="13.4" r="7" fill="${C.white}"/>
    <path d="M8.8 7.3c-.4-2 1.2-3.3 2.2-2.2.4-1.6 2.7-1.6 2.9.1 1.5-.6 2.6 1.1 1.4 2.5" fill="${C.tomato}"/>
    <path d="M13.2 12.6 17 14l-3.8 1.4z" fill="${C.yolk}"/><circle cx="11.3" cy="11.6" r="1.1" fill="${INK}" stroke="none"/>
    <path d="M13.4 15.7c.2 1.9-1.9 2.4-1.9.6" fill="${C.tomato}"/>`,
  chick: `<circle cx="12" cy="14" r="6.8" fill="${C.yolk}"/><path d="M11 6.8c-.3-1.6 1.2-2.4 1.9-1.3" fill="none"/>
    <path d="M14.2 13.6 17.6 15l-3.4 1.2z" fill="${C.tomato}"/><circle cx="12.4" cy="12.2" r="1.1" fill="${INK}" stroke="none"/>
    <path d="M6.8 15.6c1.6.2 2.6 1 3 2.3" fill="none"/>`,
  home: `<path d="M5 11.2V20h14v-8.8" fill="${C.paper}"/><path d="M2.8 12.4 12 4l9.2 8.4" fill="none" stroke-width="2.4"/>
    <path d="M3.6 11.6 12 4l8.4 7.6" fill="none" stroke="${C.tomato}" stroke-width="1.2"/><rect x="10" y="14" width="4" height="6" rx="1" fill="${C.tomato}"/>`,
  lock: `<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke-width="2.2"/><rect x="5.5" y="10.5" width="13" height="10" rx="2.4" fill="${C.yolk}"/>
    <path d="M12 14.4v2.4" stroke-width="2.2"/>`,
  unlock: `<path d="M8 10.5V8a4 4 0 0 1 7.6-1.8" fill="none" stroke-width="2.2"/><rect x="5.5" y="10.5" width="13" height="10" rx="2.4" fill="${C.grass}"/>
    <path d="M12 14.4v2.4" stroke-width="2.2"/>`,
  shield: `<path d="M12 2.8 19.4 5.6v5.6c0 4.8-3.2 8.2-7.4 10-4.2-1.8-7.4-5.2-7.4-10V5.6z" fill="${C.sky}"/>
    <path d="M12 5.4v13.4" stroke="${C.white}" stroke-width="1.4"/><path d="M8 7.8c0 2-.1 4.2 1 6" stroke="${C.white}" stroke-width="1.2" fill="none"/>`,
  rocket: `<path d="M12 2.5c3.6 2.3 5 6.4 4.2 11.3H7.8C7 8.9 8.4 4.8 12 2.5z" fill="${C.white}"/><circle cx="12" cy="8.6" r="1.8" fill="${C.sky}"/>
    <path d="M7.8 11.6 5 15.4l3.2-.4M16.2 11.6 19 15.4l-3.2-.4" fill="${C.tomato}"/><path d="M10 13.8c0 2.6.8 4.8 2 6.6 1.2-1.8 2-4 2-6.6" fill="${C.yolk}"/>`,
  magnet: `<path d="M5.5 4.5v7a6.5 6.5 0 0 0 13 0v-7h-4.2v7a2.3 2.3 0 0 1-4.6 0v-7z" fill="${C.tomato}"/>
    <path d="M5.5 4.5h4.2v3.2H5.5zM14.3 4.5h4.2v3.2h-4.2z" fill="${C.steel}"/>`,
  warn: `<path d="M12 3 21.5 20h-19z" fill="${C.yolk}"/><path d="M12 9v5.2" stroke-width="2.4"/><circle cx="12" cy="17" r="1.2" fill="${INK}" stroke="none"/>`,
  gold: `<path d="M8 2.5h3l1 5-2.4 1zM16 2.5h-3l-1 5 2.4 1z" fill="${C.tomato}"/><circle cx="12" cy="14.5" r="6.4" fill="${C.yolk}"/><path d="M11 12.2l1.6-1v6.4" fill="none" stroke-width="2"/>`,
  silver: `<path d="M8 2.5h3l1 5-2.4 1zM16 2.5h-3l-1 5 2.4 1z" fill="${C.sky}"/><circle cx="12" cy="14.5" r="6.4" fill="${C.steel}"/><path d="M10 12.4a2 2 0 1 1 3.4 1.6L10.2 17.6h4" fill="none" stroke-width="1.8"/>`,
  bronze: `<path d="M8 2.5h3l1 5-2.4 1zM16 2.5h-3l-1 5 2.4 1z" fill="${C.grass}"/><circle cx="12" cy="14.5" r="6.4" fill="${C.meat}"/><path d="M10.2 11.6h3.6l-2 2.2a1.9 1.9 0 1 1-1.8 2.8" fill="none" stroke-width="1.8"/>`,
  fire: `<path d="M12 2.5c1 3.6 5.8 5.8 5.8 11a5.8 5.8 0 0 1-11.6 0c0-2.8 1.6-4.6 3-5.8 0 1.8.6 3 1.6 3.6C10.6 8.6 11 5 12 2.5z" fill="${C.tomato}"/>
    <path d="M12 12c.6 1.6 2.6 2.4 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.6 1.4-2.8 2.6-4.6z" fill="${C.yolk}"/>`,
  egg: `<path d="M12 3c3.8 0 6.6 6 6.6 10.4a6.6 6.6 0 0 1-13.2 0C5.4 9 8.2 3 12 3z" fill="${C.paper}"/><path d="M9.2 8.6c.6-1.4 1.4-2.4 2.3-2.9" stroke="${C.white}" stroke-width="1.4" fill="none"/>`,
  sound: `<path d="M4 9.5h3.6L12 5.5v13l-4.4-4H4z" fill="${C.white}"/><path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.8a7.4 7.4 0 0 1 0 10.4" fill="none"/>`,
  mute: `<path d="M4 9.5h3.6L12 5.5v13l-4.4-4H4z" fill="${C.white}"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="${C.tomato}" stroke-width="2.2"/>`,
  tilt: `<rect x="8" y="3.5" width="8" height="17" rx="2" fill="${C.white}" transform="rotate(-18 12 12)"/><path d="M3.5 15.5a9 9 0 0 1 2-8.5M20.5 8.5a9 9 0 0 1-2 8.5" stroke="${C.tomato}"/><path d="M5.5 7l.4 2.6M18.5 17l-.4-2.6" stroke="${C.tomato}"/>`,
  vibe: `<rect x="8" y="3.5" width="8" height="17" rx="2" fill="${C.white}"/><path d="M11 17.4h2" /><path d="M4.6 8v8M2.4 10v4M19.4 8v8M21.6 10v4" stroke="${C.tomato}"/>`,
  map: `<path d="M3 6.2 8.6 4l6.8 2.4L21 4.2v13.6L15.4 20l-6.8-2.4L3 19.8z" fill="${C.paper}"/><path d="M8.6 4v13.6M15.4 6.4V20" fill="none"/>
    <path d="M11 11.5l1.4 1.4m0-1.4L11 12.9" stroke="${C.tomato}" stroke-width="1.6"/>`,
  sparkle: `<path d="M12 2.5c.8 4.6 2.2 6 6.8 6.8-4.6.8-6 2.2-6.8 6.8-.8-4.6-2.2-6-6.8-6.8 4.6-.8 6-2.2 6.8-6.8z" fill="${C.yolk}"/>
    <path d="M18.5 14.5c.4 2 1 2.6 3 3-2 .4-2.6 1-3 3-.4-2-1-2.6-3-3 2-.4 2.6-1 3-3z" fill="${C.white}"/>`,
  tap: `<circle cx="12" cy="12" r="3.2" fill="${C.yolk}"/><circle cx="12" cy="12" r="6.6" fill="none" stroke-dasharray="2.2 2.4"/><circle cx="12" cy="12" r="9.6" fill="none" stroke-width="1.2" stroke-dasharray="1.6 2.8"/>`,
  stick: `<path d="M4 16.5h16v3.4H4z" fill="${C.steel}"/><path d="M12 16.5V9" stroke-width="2.2"/><circle cx="12" cy="7" r="3.4" fill="${C.tomato}"/>`,
  burst: `<path d="M12 2.4l2 5.2 5.4-2-2 5.4 5.2 2-5.2 2 2 5.4-5.4-2-2 5.2-2-5.2-5.4 2 2-5.4-5.2-2 5.2-2-2-5.4 5.4 2z" fill="${C.yolk}"/>`,
  rainbow: `<path d="M2.5 18a9.5 9.5 0 0 1 19 0" fill="none" stroke="${C.tomato}" stroke-width="2.6"/>
    <path d="M5.4 18a6.6 6.6 0 0 1 13.2 0" fill="none" stroke="${C.yolk}" stroke-width="2.6"/>
    <path d="M8.3 18a3.7 3.7 0 0 1 7.4 0" fill="none" stroke="${C.sky}" stroke-width="2.6"/>`,
  crown: `<path d="M3.5 8.5 7.8 12.5 12 5l4.2 7.5 4.3-4-1.8 10.5H5.3z" fill="${C.yolk}"/><circle cx="12" cy="14.2" r="1.3" fill="${C.tomato}"/>
    <path d="M5.3 19h13.4" stroke-width="2.4"/>`,
  swirl: `<path d="M12 12.2a1.6 1.6 0 1 1 1.6-1.6A3.2 3.2 0 0 1 10.4 14 4.8 4.8 0 0 1 5.6 9.2 6.4 6.4 0 0 1 12 2.8a8 8 0 0 1 8 8 9.6 9.6 0 0 1-9.6 9.6" fill="none" stroke="${C.plum}" stroke-width="2.2"/>`,
  gift: `<rect x="4" y="9.5" width="16" height="11" rx="1.4" fill="${C.tomato}"/><rect x="3" y="7" width="18" height="4" rx="1" fill="${C.tomato}"/>
    <path d="M12 7v13.5" stroke="${C.yolk}" stroke-width="2.6"/><path d="M12 7C10 3.6 6.8 4 7.4 6.2 7.8 7.4 10 7 12 7zm0 0c2-3.4 5.2-3 4.6-.8-.4 1.2-2.6.8-4.6.8z" fill="${C.yolk}"/>`,
  bomb: `<circle cx="11" cy="14" r="6.8" fill="${INK}"/><path d="M15.2 8.8l1.8-1.8" stroke-width="2.6"/><path d="M17 7c1-1.6 2.4-2 3.6-1.2" fill="none" stroke="${C.yolkD}"/>
    <circle cx="8.6" cy="11.6" r="1.4" fill="${C.white}" stroke="none"/>`,
  gear: `<path d="M10.3 2.8h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z" fill="${C.steel}"/><circle cx="12" cy="12" r="3" fill="${C.paper}"/>`,
  trash: `<path d="M5.5 7.5h13l-1.2 12.6a1.6 1.6 0 0 1-1.6 1.4H8.3a1.6 1.6 0 0 1-1.6-1.4z" fill="${C.tomato}"/><path d="M4 7.5h16M9.5 7.5V4.5h5v3M10 11v6.6M14 11v6.6" fill="none"/>`,
  palette: `<path d="M12 3a9 9 0 0 0 0 18c1.6 0 2-1.2 1.4-2.2-.8-1.3.1-2.8 1.6-2.8H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z" fill="${C.paper}"/>
    <circle cx="7.6" cy="11" r="1.6" fill="${C.tomato}"/><circle cx="10" cy="7" r="1.6" fill="${C.yolk}"/><circle cx="15" cy="7.2" r="1.6" fill="${C.teal}"/><circle cx="7.8" cy="15.6" r="1.6" fill="${C.sky}"/>`,
  gem: `<path d="M6.5 4h11l4 5.4L12 21 2.5 9.4z" fill="${C.sky}"/><path d="M2.5 9.4h19M9 4l-2 5.4L12 21l5-11.6L15 4" fill="none" stroke-width="1.3"/>`,
  target: `<circle cx="12" cy="12" r="9" fill="${C.white}"/><circle cx="12" cy="12" r="6" fill="${C.tomato}"/><circle cx="12" cy="12" r="2.6" fill="${C.white}"/>`,
  clover: `<circle cx="9" cy="9" r="3.6" fill="${C.grass}"/><circle cx="15" cy="9" r="3.6" fill="${C.grass}"/><circle cx="9" cy="14.2" r="3.6" fill="${C.grass}"/><circle cx="15" cy="14.2" r="3.6" fill="${C.grass}"/>
    <path d="M13.6 16.4c1.2 2 2.6 3.4 4.6 4.4" fill="none" stroke-width="2"/>`,
  tophat: `<path d="M7.5 4h9v12h-9z" fill="${INK}"/><path d="M7.5 12.4h9v2.4h-9z" fill="${C.tomato}"/><path d="M3.5 16h17v3.2h-17z" fill="${INK}"/>`,
  wing: `<path d="M3 17c2-8 8-12.6 18-13.5-1.2 2-2.4 3-4.4 3.8 1.6.2 2.6 0 3.8-.6-1.4 2.4-3 3.6-5.4 4.2 1.2.4 2.2.4 3.4.2-2.2 3.4-6 5.6-15.4 5.9z" fill="${C.white}"/>
    <path d="M7 15c2.6-4 5.8-6.8 10-8.6" fill="none" stroke-width="1.2"/>`,
  party: `<path d="M12 2.5 18.5 20.5h-13z" fill="${C.pink}"/><path d="M9.2 10.2l5.4 2.4M7.6 15.2l8.2 3.4" stroke="${C.yolk}" stroke-width="2"/><circle cx="12" cy="2.6" r="1.8" fill="${C.yolk}"/>`,
  cap: `<path d="M4.5 14.5a7.5 7.5 0 0 1 15 0z" fill="${C.sky}"/><path d="M12 14.5h10.2a1.3 1.3 0 0 1-1.1 2H12z" fill="${C.tomato}"/><path d="M12 7v-3" /><path d="M7 4h10" stroke="${C.yolk}" stroke-width="2.4"/>`,
  chef: `<path d="M7 13v6.5h10V13" fill="${C.white}"/><path d="M7 13.4a4 4 0 0 1-.4-7.8 5.4 5.4 0 0 1 10.8 0 4 4 0 0 1-.4 7.8z" fill="${C.white}"/><path d="M7 16.4h10" fill="none"/>`,
  viking: `<path d="M4.5 16a7.5 7.5 0 0 1 15 0z" fill="${C.steel}"/><path d="M4 16h16v3H4z" fill="${C.yolk}"/>
    <path d="M5.5 12C3 11.4 2.2 8.4 3 5.4c.6 2.2 2 3.4 4 3.8M18.5 12c2.5-.6 3.3-3.6 2.5-6.6-.6 2.2-2 3.4-4 3.8" fill="${C.paper}"/>`,
  jet: `<path d="M12 2.5c1 1 1.4 2.4 1.4 4v4l7.6 4.4v2.2l-7.6-2.2v3.6l2.4 1.8v1.6L12 20.8l-3.8 1.1v-1.6l2.4-1.8v-3.6L3 17.1v-2.2l7.6-4.4v-4c0-1.6.4-3 1.4-4z" fill="${C.steel}"/>`,
  angel: `<ellipse cx="12" cy="4.6" rx="5" ry="1.8" fill="none" stroke="${C.yolkD}" stroke-width="2"/>
    <path d="M12 21c-1-6-4-9.4-9-10.4 1.6 3.6 3.2 5.6 6 6.6-1.8.2-3 0-4.4-.8C6.4 19.6 9 20.8 12 21zm0 0c1-6 4-9.4 9-10.4-1.6 3.6-3.2 5.6-6 6.6 1.8.2 3 0 4.4-.8C17.6 19.6 15 20.8 12 21z" fill="${C.white}"/>`,
  bat: `<path d="M12 9.5c1-1.6 1.6-3.2 1.4-5 1 1 1.4 2.4 1.2 4 2.6-2 5.4-2.4 7.4-.6-1.8.2-2.8 1.4-3 3-1.6-.6-2.8.2-3 1.8-1.6-.8-3-.2-3.2 1.6L12 17l-.8-2.7c-.2-1.8-1.6-2.4-3.2-1.6-.2-1.6-1.4-2.4-3-1.8-.2-1.6-1.2-2.8-3-3 2-1.8 4.8-1.4 7.4.6-.2-1.6.2-3 1.2-4-.2 1.8.4 3.4 1.4 5z" fill="${C.plum}"/>`,
  dragon: `<path d="M3 18.5C4 11 9 5.5 20.5 3.5c-1.4 2-2.6 3-4.2 3.6l2.6.8c-1.6 1.6-3 2.2-4.8 2.2l2 1.4c-1.8 1-3.4 1.2-5 .8l.8 2c-2.4.2-4 1.4-5.6 4.2z" fill="${C.tomato}"/>
    <path d="M6.4 15.6c2.4-4.4 6-7.6 11-9.8" fill="none" stroke="${C.yolk}" stroke-width="1.4"/>`,
  toxic: `<circle cx="12" cy="12" r="9.4" fill="${C.grass}"/><path d="M12 12 8 5.2a8 8 0 0 1 8 0zM12 12l7.8.2a8 8 0 0 1-4 6.8zM12 12l-3.8 7a8 8 0 0 1-4-6.8z" fill="${INK}" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="${C.grass}"/>`,
  robot: `<path d="M12 4.5c3.6 0 6.4 5 6.4 9A6.4 6.4 0 0 1 5.6 13.5c0-4 2.8-9 6.4-9z" fill="${C.white}"/><rect x="7.6" y="10.6" width="8.8" height="3.4" rx="1.7" fill="${C.teal}"/>
    <path d="M12 4.5V2" /><circle cx="12" cy="1.8" r="1.2" fill="${C.tomato}"/>`,
  ufo: `<path d="M8.4 11a3.6 3.6 0 0 1 7.2 0z" fill="${C.sky}"/><ellipse cx="12" cy="13" rx="9.5" ry="3.2" fill="${C.steel}"/>
    <circle cx="7" cy="13" r=".9" fill="${C.yolk}" stroke="none"/><circle cx="12" cy="14" r=".9" fill="${C.yolk}" stroke="none"/><circle cx="17" cy="13" r=".9" fill="${C.yolk}" stroke="none"/>
    <path d="M9 16.4 7.4 20M15 16.4l1.6 3.6" fill="none" stroke="${C.yolkD}" stroke-width="1.4"/>`,
  hourglass: `<path d="M6.5 3h11M6.5 21h11" stroke-width="2.2"/><path d="M7.5 3h9c0 4-4.5 6-4.5 9s4.5 5 4.5 9h-9c0-4 4.5-6 4.5-9S7.5 7 7.5 3z" fill="${C.paper}"/>
    <path d="M9.4 19.4h5.2L12 16z" fill="${C.yolk}"/>`,
  devil: `<path d="M5.5 7.5 4 3l4.4 2.6M18.5 7.5 20 3l-4.4 2.6" fill="${C.tomato}"/><circle cx="12" cy="13" r="7.6" fill="${C.tomato}"/>
    <path d="M8.2 11l2.4 1M15.8 11l-2.4 1" stroke-width="2"/><path d="M8.6 15.6c1.8 1.8 5 1.8 6.8 0" fill="none"/>`,
  feather: `<path d="M19.5 3C10 4 5.5 10 5.2 17.2l3.4-3.4c1.6.6 3.2.4 4.8-.6l-2.4-.4 4.2-1.8c1.2-1.4 2-3 2.4-5l-3 .6 3.4-2.4c.6-.4 1-1 1.5-1.2z" fill="${C.sky}"/><path d="M3.5 20.5 13 11" fill="none"/>`,
  corn: `<path d="M12 3c3 1.6 4.2 5.4 3.4 9.4L12 19l-3.4-6.6C7.8 8.4 9 4.6 12 3z" fill="${C.yolk}"/><path d="M10 7h4M9.4 10h5.2M9.8 13h4.4" fill="none" stroke-width="1.2"/>
    <path d="M12 19c-2.4-.6-5.4-3.4-6.6-7.4 2.6 1.2 4.4 3 5.4 5M12 19c2.4-.6 5.4-3.4 6.6-7.4-2.6 1.2-4.4 3-5.4 5" fill="${C.grass}"/>`,
  grad: `<path d="M2 9.5 12 5l10 4.5-10 4.5z" fill="${INK}"/><path d="M6.5 11.6v4.4c3 2.4 8 2.4 11 0v-4.4" fill="${C.plum}"/><path d="M20 10.5v5" stroke="${C.yolk}" stroke-width="1.8"/>`,
  wind: `<path d="M3 9h11.5a2.8 2.8 0 1 0-2.8-2.8M3 13.5h15.5a2.8 2.8 0 1 1-2.8 2.8M3 17.5h7" fill="none" stroke="${C.sky}" stroke-width="2.4"/>`,
  ice: `<path d="M5 8.5 12 4.5l7 4v8l-7 4-7-4z" fill="${C.ice}"/><path d="M5 8.5l7 4 7-4M12 12.5v8" fill="none" stroke-width="1.4"/><path d="M8 8.6l2-1.2" stroke="${C.white}" stroke-width="1.4"/>`,
  friedegg: `<path d="M5.4 7.2c2.4-3.4 7-3.2 9.6-1.4 3 .2 5.6 2.6 5.2 6-.4 3.8-3.4 5.6-6.8 5.8-2.6 2.2-7.4 1.8-8.8-1.6C2.4 14 3 9.8 5.4 7.2z" fill="${C.white}"/><circle cx="11.6" cy="11.6" r="3.2" fill="${C.yolk}"/>`,
  galaxy: `<ellipse cx="12" cy="12" rx="9.6" ry="5" transform="rotate(-25 12 12)" fill="${C.plum}"/><circle cx="12" cy="12" r="2.6" fill="${C.yolk}"/><circle cx="6.5" cy="15" r=".9" fill="${C.white}" stroke="none"/><circle cx="17.5" cy="9" r=".9" fill="${C.white}" stroke="none"/>`,
  medal: `<path d="M8 2.5h3l1 5-2.4 1zM16 2.5h-3l-1 5 2.4 1z" fill="${C.tomato}"/><circle cx="12" cy="14.5" r="6.4" fill="${C.yolk}"/><path d="M12 11.2l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="${C.white}" stroke-width="1"/>`,
};

// Emoji → icon id (variation selectors are stripped before lookup).
const EMOJI = {
  '🍗': 'drum', '🏆': 'trophy', '🏁': 'flag', '⚡': 'bolt', '🛠': 'wrench', '🐔': 'chicken', '🏠': 'home', '🔒': 'lock',
  '🔓': 'unlock', '🛡': 'shield', '🚀': 'rocket', '🧲': 'magnet', '⚠': 'warn', '🥇': 'gold', '🥈': 'silver', '🥉': 'bronze',
  '🔥': 'fire', '🥚': 'egg', '🔊': 'sound', '🔇': 'mute', '📳': 'vibe', '📱': 'tilt', '🗺': 'map', '✨': 'sparkle', '👆': 'tap',
  '🕹': 'stick', '✴': 'burst', '🌈': 'rainbow', '👑': 'crown', '🌀': 'swirl', '🎁': 'gift', '💣': 'bomb', '⚙': 'gear',
  '🗑': 'trash', '🎨': 'palette', '💎': 'gem', '🎯': 'target', '🍀': 'clover', '🎩': 'tophat', '🪽': 'wing', '🐣': 'chick',
  '🥳': 'party', '🧢': 'cap', '👨‍🍳': 'chef', '🍳': 'friedegg', '🪖': 'viking', '✈': 'jet', '👼': 'angel', '🦇': 'bat',
  '🐉': 'dragon', '☢': 'toxic', '🐥': 'chick', '🤖': 'robot', '🛸': 'ufo', '⏳': 'hourglass', '😈': 'devil', '🪶': 'feather',
  '🌽': 'corn', '🎓': 'grad', '💨': 'wind', '🧊': 'ice', '🌌': 'galaxy', '🏅': 'medal',
};

// Longest keys first so multi-codepoint sequences (👨‍🍳) win.
const KEYS = Object.keys(EMOJI).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?`, 'gu');
const svgUse = (id) => `<svg class="ic ic-${id}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${id}"/></svg>`;

export function iconSVG(id) { return svgUse(id); }

function injectSprite() {
  const syms = Object.entries(ICONS).map(([id, body]) =>
    `<symbol id="i-${id}" viewBox="0 0 24 24"><g style="stroke: var(--icon-line, ${INK})" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${body}</g></symbol>`).join('');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${syms}</svg>`;
  document.body.prepend(holder);
}

// Replace emoji in one text node with icon <svg>s.
function iconizeText(node) {
  const text = node.nodeValue;
  RE.lastIndex = 0;
  if (!RE.test(text)) return;
  const parent = node.parentNode;
  if (!parent || parent.closest?.('svg, textarea, input, [data-noicon]')) return;
  const frag = document.createDocumentFragment();
  let last = 0;
  RE.lastIndex = 0;
  for (let m; (m = RE.exec(text));) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const span = document.createElement('span');
    span.className = 'ic-wrap';
    span.innerHTML = svgUse(EMOJI[m[1]]);
    frag.appendChild(span.firstChild);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  parent.replaceChild(frag, node);
}

function walk(root) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n; (n = tw.nextNode());) nodes.push(n);
  nodes.forEach(iconizeText);
}

// Swap emoji for icons now and whenever new text appears.
export function installIcons() {
  injectSprite();
  walk(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') iconizeText(r.target);
      else for (const n of r.addedNodes) {
        if (n.nodeType === 3) iconizeText(n);
        else if (n.nodeType === 1 && n.tagName !== 'svg' && n.textContent) walk(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
