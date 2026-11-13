// Menu motion and icons, from docs/UI-MOTION.md (plain globals, no modules).
// Springs use the guide's formula; presses start on pointerdown and release on a 22/0.45 spring.
'use strict';
const UI = {};
UI.easeOut = k => 1 - Math.pow(1 - k, 3);
UI.reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
UI.spring = (w0, z) => { const wd = w0 * Math.sqrt(1 - z * z); return t => t <= 0 ? 0 : 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); };
// runs fn(k), k 0..1 over ms on animation frames; returns cancel()
UI.tween = (ms, fn, done) => {
  const t0 = performance.now(); let id = 0, live = true;
  const step = now => { if (!live) return; const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1) id = requestAnimationFrame(step); else if (done) done(); };
  id = requestAnimationFrame(step); return () => { live = false; cancelAnimationFrame(id); };
};
UI.runSpring = (w0, z, ms, apply, done) => { const f = UI.spring(w0, z); return UI.tween(ms, k => apply(f(k * ms / 1000)), () => { apply(1); if (done) done(); }); };
// decaying shake x = A·sin(2π·9·t)·e^(−6t) over 800 ms  [UMP § Error Part 1 › Shake Input]
UI.shake = (el, amp = 14, ms = 800) => { if (UI.reduced()) return; UI.tween(ms, k => { const t = k * ms / 1000; el.style.translate = (amp * Math.sin(2 * Math.PI * 9 * t) * Math.exp(-6 * t)).toFixed(2) + 'px 0'; }, () => { el.style.translate = ''; }); };

// ---------- press feedback for every menu button ----------
// depth by weight: hero 0.88, button 0.92, row/card 0.97; in 100 ms ease-out, out on spring 22/0.45 (540 ms)
UI.depth = el => el.matches('.hero, #go, .hbig.play') ? .12 : el.matches('.card, .lk, .char, .wep, .sw, .ecard, .row-btn') ? .03 : .08;
UI.press = new WeakMap();
function uiPressIn(el) {
  const s = UI.press.get(el) || {d: 0, stop: () => {}}; UI.press.set(el, s); s.stop();
  const d0 = s.d, depth = UI.depth(el);
  s.stop = UI.tween(100, k => { s.d = d0 + (1 - d0) * UI.easeOut(k); el.style.scale = (1 - depth * s.d).toFixed(4); });
}
function uiPressOut(el) {
  const s = UI.press.get(el); if (!s) return; s.stop();
  const d0 = s.d, depth = UI.depth(el), f = UI.spring(22, .45);
  s.stop = UI.tween(540, k => { s.d = Math.max(-.3, Math.min(1, d0 * (1 - f(k * .54)))); el.style.scale = (1 - depth * s.d).toFixed(4); }, () => { s.d = 0; el.style.scale = ''; });
}
UI.held = null;
addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
  UI.held = b; uiPressIn(b);
  if (!b.classList.contains('card')) { AU.play('cardPick', {vol: .3, rate: 1.3, max: 2}); HAPTIC.fx('card'); }
});
const uiRelease = () => { if (UI.held) { uiPressOut(UI.held); UI.held = null; } };
addEventListener('pointerup', uiRelease); addEventListener('pointercancel', uiRelease);

// ---------- odometer numbers  [UMP § Number Counter Part 1 › Odometer Roll] ----------
// <span class="odo"></span>; columns roll 600 ms ease-out, rightmost first, 50 ms apart; tint mint up, pink down
UI.odo = (el, value, from) => {
  const s = String(value);
  if (from !== undefined && el.dataset.value === undefined) { el.dataset.value = from; UI.odo(el, from); void el.offsetWidth; }
  while (el.children.length < s.length) { const col = document.createElement('span'); col.className = 'odo-col'; col.innerHTML = '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>'; el.prepend(col); }
  while (el.children.length > s.length) el.firstElementChild.remove();
  const prev = Number(el.dataset.value ?? value); el.dataset.value = value; el.setAttribute('aria-label', s);
  [...el.children].forEach((col, i) => { col.style.transitionDelay = (s.length - 1 - i) * 50 + 'ms'; col.style.translate = '0 ' + (-1.15 * Number(s[i])).toFixed(2) + 'em'; });
  if (value !== prev) { el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(value > prev ? 'up' : 'down'); }
};
UI.odoHTML = (v, cls = '') => `<span class="odo ${cls}" data-n="${v}">${v}</span>`;
// turn every [data-n] odo inside root into rolling columns starting from 0, rows `delay` ms apart
UI.rollAll = (root, delay = 0, step = 120) => {
  root.querySelectorAll('.odo[data-n]').forEach((el, i) => { const n = +el.dataset.n; el.textContent = ''; UI.odo(el, 0); setTimeout(() => UI.odo(el, n), delay + i * step); });
};

// ---------- icons: one outlined style, 24 px grid, 2.4 px round strokes ----------
const ICON = {
  survivor: '<circle cx="12" cy="7" r="3.6"/><path d="M4.5 21c.6-4.6 3.6-7.2 7.5-7.2s6.9 2.6 7.5 7.2"/><path d="M8.6 5.2l6.8-1.6"/>',
  story: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10.5"/><path d="M9 8.5h6"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>',
  shop: '<path d="M3.5 9.5h17l-1.6 10.2a1.5 1.5 0 0 1-1.5 1.3H6.6a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8 9.5l2.2-6M16 9.5l-2.2-6M9 14v3M15 14v3"/>',
  play: '<path d="M8 4.8v14.4L19.5 12z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor"/><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor"/>',
  home: '<path d="M4 11.5L12 4.5l8 7M6.5 9.8V19.5h11V9.8"/><path d="M10 19.5v-5h4v5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M14.5 5L7.5 12l7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  skull: '<path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.8 5v3h9.4v-3c1.7-1 2.8-2.6 2.8-5 0-4-3.1-7-7.5-7z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/><path d="M10.5 18.5v-2M13.5 18.5v-2"/>',
  bolt: '<path d="M13 2.8L5.5 13.5h6l-1 7.7L18.5 10.5h-6z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/>',
  radio: '<rect x="3.5" y="8" width="17" height="12" rx="2"/><path d="M7 8l9-4.5"/><circle cx="15.5" cy="14" r="2.5"/><path d="M7 12.5h3M7 15.5h3"/>',
  vibrate: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4.5 8.5v7M19.5 8.5v7"/>',
  train: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  map: '<path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13l-5.5 2.5-6-2.5-5.5 2.5z"/><path d="M9 4v13M15 6.5v13"/>',
  infinity: '<path d="M7.5 15.5c-2 0-3.5-1.6-3.5-3.5s1.5-3.5 3.5-3.5c3.5 0 5.5 7 9 7 2 0 3.5-1.6 3.5-3.5s-1.5-3.5-3.5-3.5c-3.5 0-5.5 7-9 7z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
};
const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
// title letters that drop in 30 ms apart  [GFP § Game Over Part 1 › GAME OVER Drop]
UI.letters = (txt, delay = 0) => { let i = 0; // words stay unbroken; letters keep one running index
  return txt.split(' ').map(w => `<span class="lw">${[...w].map(c => `<span class="ltr" style="--i:${i++};--dl:${delay}ms">${c}</span>`).join('')}</span>`).join(' '); };
