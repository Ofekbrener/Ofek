import { CONFIG } from './config.js';

// Unified input: relative touch/mouse drag anywhere on the canvas, hold-to-steer
// on-screen buttons, and keyboard. Produces a target X for the ship.
export class Input {
  constructor(canvas, leftBtn, rightBtn) {
    this.enabled = false;
    this.target = 0;        // smoothed target handed to the ship
    this.raw = 0;           // un-smoothed target from finger / buttons
    this.holdTime = 0;      // how long a steer button / key has been held
    this.handling = 1;      // upgrade multiplier for button speed
    this.raceMode = false;  // race: drag acts like a steering wheel (see raceSteer)
    this.dir = 0;           // -1 / 0 / 1 from buttons + keys
    this.steer = 0;         // normalised steering signal for audio
    this.dragId = null;
    this.dragStartX = 0;
    this.dragStartTarget = 0;
    this.keys = { left: false, right: false };
    this.btn = { left: false, right: false };
    // Tilt steering (device orientation). `tiltOn` is the player's setting;
    // `tiltLive` turns true once the sensor actually reports angles.
    this.tiltOn = false;
    this.tiltLive = false;
    this.tiltAngle = 0;     // left/right lean in degrees, relative to the screen
    this.tiltCenter = 0;    // neutral lean captured at the start of a run / race
    this._tiltListening = false;
    this._onTilt = (e) => this._tilt(e);

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
    document.addEventListener('touchmove', (e) => {
      if (e.cancelable && !(e.target.closest && e.target.closest('.scroll'))) e.preventDefault();
    }, { passive: false });
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

  // Start listening to the gyroscope. iOS needs this to run inside a tap
  // (permission prompt); elsewhere it just adds the listener.
  enableTilt() {
    this.tiltOn = true;
    if (this._tiltListening || typeof window.DeviceOrientationEvent === 'undefined') return Promise.resolve(this.tiltLive);
    const listen = () => {
      if (this._tiltListening) return;
      this._tiltListening = true;
      window.addEventListener('deviceorientation', this._onTilt);
    };
    const req = window.DeviceOrientationEvent.requestPermission;
    if (typeof req === 'function') {
      return req.call(window.DeviceOrientationEvent)
        .then((r) => { if (r === 'granted') listen(); return r === 'granted'; })
        .catch(() => false);
    }
    listen();
    return Promise.resolve(true);
  }

  disableTilt() {
    this.tiltOn = false;
  }

  get tiltActive() { return this.tiltOn && this.tiltLive; }

  _tilt(e) {
    if (e.gamma == null || e.beta == null) return;
    const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    const a = ((ang % 360) + 360) % 360;
    // Lean toward the right edge of the screen = positive, in any orientation.
    this.tiltAngle = a === 90 ? e.beta : a === 270 ? -e.beta : a === 180 ? -e.gamma : e.gamma;
    if (!this.tiltLive) { this.tiltLive = true; this.calibrateTilt(); document.body.classList.add('tilt-live'); }
  }

  // Treat however the phone is held right now as "straight".
  calibrateTilt() {
    this.tiltCenter = Math.max(-20, Math.min(20, this.tiltAngle));
  }

  // -1..1 with a small dead zone; ~22° of lean is full lock.
  tiltValue() {
    if (!this.tiltActive) return 0;
    const d = this.tiltAngle - this.tiltCenter;
    const dz = 2.5, full = 22;
    if (Math.abs(d) < dz) return 0;
    return Math.max(-1, Math.min(1, (d - Math.sign(d) * dz) / (full - dz)));
  }

  _down(e) {
    if (!this.enabled || this.dragId !== null) return;
    this.dragId = e.pointerId;
    this.dragStartX = this.lastX = e.clientX;
    this.dragStartTarget = this.raw;
  }

  _move(e) {
    if (!this.enabled || e.pointerId !== this.dragId) return;
    const w = Math.max(1, window.innerWidth);
    const field = CONFIG.halfWidth * 2;
    this.lastX = e.clientX;
    if (this.raceMode) return;
    const dx = (e.clientX - this.dragStartX) / w;
    this.raw = clamp(this.dragStartTarget + dx * field * CONFIG.dragSensitivity);
    // Re-anchor when pinned at an edge so reversing direction responds instantly.
    if (Math.abs(this.raw) >= CONFIG.halfWidth) {
      this.dragStartX = e.clientX;
      this.dragStartTarget = this.raw;
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
    this.raw = 0;
    this.holdTime = 0;
  }

  // Race steering in -1..1: buttons/keys give full lock; dragging works like a
  // steering wheel (distance from where the finger went down = how hard you turn).
  raceSteer() {
    const left = this.keys.left || this.btn.left;
    const right = this.keys.right || this.btn.right;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir) return dir;
    if (this.dragId !== null) {
      const w = Math.max(1, window.innerWidth);
      return Math.max(-1, Math.min(1, (this.lastX - this.dragStartX) / (w * 0.16)));
    }
    return this.tiltValue();
  }

  update(realDt, shipX) {
    const left = this.keys.left || this.btn.left;
    const right = this.keys.right || this.btn.right;
    this.dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (this.dir !== 0 && this.enabled) {
      // Accelerating buttons: a tap nudges, a hold sweeps across the field.
      this.holdTime += realDt;
      const t = Math.min(1, this.holdTime / CONFIG.buttonAccelTime);
      const speed = (CONFIG.buttonSteerMin + (CONFIG.buttonSteerMax - CONFIG.buttonSteerMin) * t) * this.handling;
      this.raw = clamp(this.raw + this.dir * speed * realDt);
      if (this.dragId !== null) {
        // Re-anchor an active drag so letting go of the button never jumps.
        this.dragStartTarget = this.raw;
        this.dragStartX = this.lastX;
      }
    } else {
      this.holdTime = 0;
      // Tilt: the lean picks a spot across the field (like a steering wheel
      // for the lane), unless a finger is dragging.
      if (this.enabled && this.tiltActive && this.dragId === null) {
        this.raw = clamp(this.tiltValue() * CONFIG.halfWidth * 1.1);
      }
    }
    // Light low-pass on the target: removes touch-sampling jitter without adding lag you can feel.
    const k = 1 - Math.exp(-realDt / CONFIG.dragSmoothing);
    this.target += (this.raw - this.target) * k;
    this.steer = Math.max(-1, Math.min(1, (this.target - shipX) / 2));
    return this.target;
  }
}

function clamp(x) {
  return Math.max(-CONFIG.halfWidth, Math.min(CONFIG.halfWidth, x));
}
