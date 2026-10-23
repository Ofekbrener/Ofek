// Touch controls: a floating joystick on the left half, camera drag on the
// right half, on-screen buttons. Each pointer keeps the role it started with,
// so a thumb on the joystick and a thumb on a button work together.
// WASD / arrows / space / J / K / L work on desktop for testing.

const BUTTONS = ['attack', 'jump', 'skill1', 'skill2', 'red', 'blue'];
const STICK_RADIUS = 55;
const TAP_SLOP = 10;

export function createInput(root) {
  const state = {
    move: { x: 0, y: 0 },
    camYaw: 0,
    camPitch: 0.35,
    tapPoint: null,
    enabled: true,
  };
  const taps = new Set();
  const held = new Set();
  const keys = new Set();
  const pointers = new Map(); // pointerId -> { role, x0, y0, x, y, t0 }

  const stick = root.querySelector('#stick');
  const knob = root.querySelector('#stick-knob');

  function stickVector(p) {
    let dx = p.x - p.x0, dy = p.y - p.y0;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) { dx *= STICK_RADIUS / d; dy *= STICK_RADIUS / d; }
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.move.x = dx / STICK_RADIUS;
    state.move.y = -dy / STICK_RADIUS; // up on screen = forward
  }

  root.addEventListener('pointerdown', e => {
    if (!state.enabled) return;
    const btn = e.target.closest('[data-btn]');
    if (btn) {
      e.preventDefault();
      const name = btn.dataset.btn;
      if (btn.disabled) return;
      taps.add(name); held.add(name);
      btn.classList.add('active');
      pointers.set(e.pointerId, { role: 'btn', name, el: btn });
      return;
    }
    if (e.target.closest('.ui')) return; // dialogs, menus
    const role = e.clientX < root.clientWidth / 2 ? 'stick' : 'cam';
    const p = { role, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now() };
    pointers.set(e.pointerId, p);
    if (role === 'stick' && stick) {
      stick.style.left = e.clientX + 'px';
      stick.style.top = e.clientY + 'px';
      stick.classList.add('on');
    }
  });

  addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p || p.role === 'btn') return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.role === 'stick') stickVector(p);
    else {
      state.camYaw -= dx * 0.008;
      state.camPitch = Math.min(1.1, Math.max(0.05, state.camPitch + dy * 0.005));
    }
  });

  function release(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (p.role === 'btn') { held.delete(p.name); p.el.classList.remove('active'); return; }
    if (p.role === 'stick') {
      state.move.x = 0; state.move.y = 0;
      if (knob) knob.style.transform = '';
      if (stick) stick.classList.remove('on');
    }
    const moved = Math.hypot(p.x - p.x0, p.y - p.y0);
    if (moved < TAP_SLOP && performance.now() - p.t0 < 350) state.tapPoint = { x: p.x, y: p.y };
  }
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('blur', () => {
    pointers.clear(); held.clear(); keys.clear();
    state.move.x = 0; state.move.y = 0;
  });

  const keyMap = { Space: 'jump', KeyJ: 'attack', KeyK: 'skill1', KeyL: 'skill2', Digit1: 'red', Digit2: 'blue' };
  addEventListener('keydown', e => {
    if (e.repeat || e.target.closest?.('input')) return;
    keys.add(e.code);
    if (keyMap[e.code]) { taps.add(keyMap[e.code]); held.add(keyMap[e.code]); }
  });
  addEventListener('keyup', e => {
    keys.delete(e.code);
    if (keyMap[e.code]) held.delete(keyMap[e.code]);
  });

  // Prevent page scroll / zoom while playing.
  document.addEventListener('touchmove', e => { if (e.cancelable && !e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  return Object.assign(state, {
    /** True once per tap or key press. */
    pressed(name) { const had = taps.has(name); taps.delete(name); return had; },
    held(name) { return held.has(name); },
    /** Call once per frame before reading move; folds keyboard into the stick. */
    poll() {
      if (keys.size) {
        const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
        const ky = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
        if (kx || ky) { const d = Math.hypot(kx, ky); state.move.x = kx / d; state.move.y = ky / d; }
        else if (![...pointers.values()].some(p => p.role === 'stick')) { state.move.x = 0; state.move.y = 0; }
      }
    },
    takeTap() { const t = state.tapPoint; state.tapPoint = null; return t; },
    clear() { taps.clear(); },
    BUTTONS,
  });
}
