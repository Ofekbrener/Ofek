import { CONFIG } from './config.js';

// Unified input: relative touch/mouse drag anywhere on the canvas, hold-to-steer
// on-screen buttons, and keyboard. Produces a target X for the ship.
export class Input {
  constructor(canvas, leftBtn, rightBtn) {
    this.enabled = false;
    this.target = 0;
    this.dir = 0;           // -1 / 0 / 1 from buttons + keys
    this.steer = 0;         // normalised steering signal for audio
    this.dragId = null;
    this.dragStartX = 0;
    this.dragStartTarget = 0;
    this.keys = { left: false, right: false };
    this.btn = { left: false, right: false };

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e), { passive: true });
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));

    this._bindButton(leftBtn, 'left');
    this._bindButton(rightBtn, 'right');

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.release());

    // Stop iOS from scrolling / zooming the page during play.
    document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  _bindButton(el, side) {
    const on = (e) => {
      e.preventDefault();
      this.btn[side] = true;
      el.classList.add('active');
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const off = () => { this.btn[side] = false; el.classList.remove('active'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _down(e) {
    if (!this.enabled || this.dragId !== null) return;
    this.dragId = e.pointerId;
    this.dragStartX = e.clientX;
    this.dragStartTarget = this.target;
  }

  _move(e) {
    if (!this.enabled || e.pointerId !== this.dragId) return;
    const w = Math.max(1, window.innerWidth);
    const field = CONFIG.halfWidth * 2;
    const dx = (e.clientX - this.dragStartX) / w;
    this.target = clamp(this.dragStartTarget + dx * field * CONFIG.dragSensitivity);
    // Re-anchor when pinned at an edge so reversing direction responds instantly.
    if (Math.abs(this.target) >= CONFIG.halfWidth) {
      this.dragStartX = e.clientX;
      this.dragStartTarget = this.target;
    }
  }

  _up(e) {
    if (e.pointerId === this.dragId) this.dragId = null;
  }

  _key(e, down) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { this.keys.left = down; e.preventDefault(); }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { this.keys.right = down; e.preventDefault(); }
  }

  release() {
    this.dragId = null;
    this.keys.left = this.keys.right = false;
    this.btn.left = this.btn.right = false;
  }

  reset() {
    this.release();
    this.target = 0;
  }

  update(realDt, shipX) {
    const left = this.keys.left || this.btn.left;
    const right = this.keys.right || this.btn.right;
    this.dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (this.dir !== 0 && this.enabled) {
      // Buttons steer from wherever the ship currently is, so switching
      // between drag and buttons never causes a jump.
      if (Math.abs(this.target - shipX) > 1.2) this.target = shipX;
      this.target = clamp(this.target + this.dir * CONFIG.buttonSteerSpeed * realDt);
      if (this.dragId !== null) {
        this.dragStartTarget = this.target;
      }
    }
    this.steer = Math.max(-1, Math.min(1, (this.target - shipX) / 2));
    return this.target;
  }
}

function clamp(x) {
  return Math.max(-CONFIG.halfWidth, Math.min(CONFIG.halfWidth, x));
}
