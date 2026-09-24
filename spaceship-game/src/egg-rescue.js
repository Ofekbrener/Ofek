// Egg Rescue: a 60-second catching mini-game.
// Space Hens fly along the top dropping the eggs they stole; slide Coco's pod
// to catch them. White egg +1, golden egg +5, rotten egg -3 (and breaks the
// combo), egg-bomb costs a heart (3 hearts). Caught eggs pay drumsticks and
// fill Coco's Nest; a full Nest hatches a pet add-on.
//
// Drawn on its own 2D canvas overlay in the Retro Space Age palette.

import { cocoSVG } from './coco.js';

const INK = '#1f2a3a';
const CREAM = '#f3e6c8';
const DURATION = 60;
export const NEST_SIZE = 40;   // eggs needed to hatch a pet
export const PETS = ['chick', 'eggbot', 'ufo'];

const KIND = {
  egg: { pts: 1, r: 15 },
  gold: { pts: 5, r: 16 },
  rotten: { pts: -3, r: 15 },
  bomb: { pts: 0, r: 16 },
};

export class EggRescue {
  constructor({ audio, haptics, onExit }) {
    this.audio = audio;
    this.haptics = haptics;
    this.onExit = onExit;
    this.el = document.getElementById('egg-rescue');
    this.canvas = document.getElementById('er-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this._frame = this._frame.bind(this);

    // Coco sprite: the SVG portrait rasterised once.
    this.coco = new Image();
    this.coco.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      cocoSVG('happy').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" '));

    // Drag / touch anywhere to steer the pod.
    const move = (e) => { if (this.running) this.targetX = e.clientX; };
    this.canvas.addEventListener('pointerdown', (e) => { this.canvas.setPointerCapture(e.pointerId); move(e); });
    this.canvas.addEventListener('pointermove', move);
    window.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') this.targetX -= 60;
      if (e.key === 'ArrowRight' || e.key === 'd') this.targetX += 60;
    });
    document.getElementById('er-quit').addEventListener('click', () => this.finish(true));
  }

  start() {
    this.el.classList.remove('hidden');
    this._resize();
    this.W = this.canvas.clientWidth;
    this.H = this.canvas.clientHeight;
    Object.assign(this, {
      t: 0, left: DURATION, score: 0, caught: 0, combo: 0, best: 0, hearts: 3,
      x: this.W / 2, targetX: this.W / 2, eggs: [], pops: [], shake: 0,
      hens: [0, 1, 2].map((i) => ({ x: this.W * (0.2 + i * 0.3), dir: i % 2 ? -1 : 1, drop: 0.6 + i * 0.5, flap: i })),
    });
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._frame);
    this.audio.cluck(1.1, 0.2);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = this.canvas;
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Difficulty ramps over the 60 seconds.
  get ramp() { return Math.min(1, this.t / DURATION); }

  _spawn(hen) {
    const r = Math.random();
    const bombP = 0.06 + this.ramp * 0.1, rotP = 0.12 + this.ramp * 0.06, goldP = 0.08;
    const kind = r < bombP ? 'bomb' : r < bombP + rotP ? 'rotten' : r < bombP + rotP + goldP ? 'gold' : 'egg';
    this.eggs.push({ kind, x: hen.x, y: 156, vy: 120 + this.ramp * 170 + Math.random() * 40, spin: Math.random() * 6 });
  }

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._update(dt);
    this._draw();
    requestAnimationFrame(this._frame);
  }

  _update(dt) {
    this.t += dt;
    this.left = Math.max(0, DURATION - this.t);
    const W = this.W, H = this.H;
    // Pod follows the finger with a snappy spring.
    this.targetX = Math.max(34, Math.min(W - 34, this.targetX));
    this.x += (this.targetX - this.x) * (1 - Math.exp(-dt * 16));
    // Hens patrol and drop.
    for (const h of this.hens) {
      h.x += h.dir * (60 + this.ramp * 70) * dt;
      if (h.x < 30 || h.x > W - 30) h.dir *= -1;
      h.flap += dt * 10;
      h.drop -= dt;
      if (h.drop <= 0) { this._spawn(h); h.drop = (1.5 - this.ramp * 0.85) * (0.7 + Math.random() * 0.6); }
    }
    // Eggs fall; catch zone is the top of the pod.
    const podY = H - 150;
    for (const e of this.eggs) {
      e.y += e.vy * dt;
      e.spin += dt * 3;
      if (!e.done && e.y > podY - 20 && e.y < podY + 24 && Math.abs(e.x - this.x) < 46) { e.done = true; this._catch(e); }
      if (!e.done && e.y > H - 60) {
        e.done = true;
        if (e.kind === 'egg' || e.kind === 'gold') { this.combo = 0; this.pops.push({ x: e.x, y: H - 70, text: 'SPLAT', col: '#d9582b', t: 0 }); }
      }
    }
    this.eggs = this.eggs.filter((e) => !e.done);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.9);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.left <= 0 || this.hearts <= 0) this.finish(false);
  }

  _catch(e) {
    const pop = (text, col) => this.pops.push({ x: e.x, y: e.y - 20, text, col, t: 0 });
    if (e.kind === 'bomb') {
      this.hearts--; this.combo = 0; this.shake = 1;
      this.audio.collision(); this.haptics.shieldBreak();
      pop('BOOM!', '#d9582b');
      return;
    }
    if (e.kind === 'rotten') {
      this.score = Math.max(0, this.score - 3); this.combo = 0;
      this.audio.splat(); this.haptics.tap();
      pop('-3 YUCK', '#7a9150');
      return;
    }
    this.combo++;
    this.best = Math.max(this.best, this.combo);
    const mult = this.combo >= 15 ? 3 : this.combo >= 6 ? 2 : 1;
    const pts = KIND[e.kind].pts * mult;
    this.score += pts;
    this.caught += e.kind === 'gold' ? 3 : 1;
    this.audio.pickup(Math.min(10, this.combo));
    if (e.kind === 'gold') this.haptics.gift();
    pop(`+${pts}${mult > 1 ? ` x${mult}` : ''}`, e.kind === 'gold' ? '#b8841c' : INK);
  }

  finish(quit) {
    if (!this.running) return;
    this.running = false;
    this.el.classList.add('hidden');
    this.onExit(quit ? null : { score: this.score, caught: this.caught, bestCombo: this.best, hearts: this.hearts });
  }

  // ---------------------------------------------------------------- drawing
  _egg(x, y, r, kind, spin) {
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(spin) * 0.3);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    if (kind === 'bomb') {
      g.fillStyle = '#2a2a33';
      g.beginPath(); g.arc(0, 2, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = '#b8841c'; g.beginPath(); g.moveTo(4, -r + 2); g.quadraticCurveTo(10, -r - 8, 16, -r - 4); g.stroke();
      g.fillStyle = Math.sin(spin * 8) > 0 ? '#ffd35c' : '#d9582b';
      g.beginPath(); g.arc(16, -r - 4, 4, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = kind === 'gold' ? '#e8b23a' : kind === 'rotten' ? '#9aa86a' : '#fffaf0';
      g.beginPath(); g.ellipse(0, 0, r * 0.8, r, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = kind === 'rotten' ? '#6a7a40' : 'rgba(255,255,255,0.8)';
      if (kind === 'rotten') { g.beginPath(); g.arc(-3, 3, 3, 0, Math.PI * 2); g.arc(4, -4, 2, 0, Math.PI * 2); g.fill(); }
      else { g.beginPath(); g.ellipse(-4, -5, 3, 5, -0.4, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }

  _hen(h) {
    const g = this.ctx;
    const y = 128 + Math.sin(h.flap * 0.5) * 3;
    g.save(); g.translate(h.x, y); g.scale(h.dir, 1);
    g.lineWidth = 3; g.strokeStyle = INK;
    // saucer
    g.fillStyle = '#b8c2d6';
    g.beginPath(); g.ellipse(0, 12, 30, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // hen
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#d9582b';
    g.beginPath(); g.arc(-4, -14, 5, 0, Math.PI * 2); g.arc(3, -15, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#e8b23a';
    g.beginPath(); g.moveTo(12, -2); g.lineTo(21, 1); g.lineTo(12, 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(6, -3, 2.2, 0, Math.PI * 2); g.fill();
    // flapping wing
    g.fillStyle = '#eee4d2';
    g.beginPath(); g.ellipse(-6, 2 + Math.sin(h.flap) * 3, 8, 5, -0.5 + Math.sin(h.flap) * 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }

  _pod() {
    const g = this.ctx;
    const x = this.x + (Math.random() - 0.5) * this.shake * 10, y = this.H - 150;
    g.save(); g.translate(x, y);
    g.lineWidth = 3; g.strokeStyle = INK;
    // flame
    g.fillStyle = '#e8b23a';
    g.beginPath(); g.moveTo(-10, 30); g.lineTo(0, 48 + Math.random() * 10); g.lineTo(10, 30); g.fill();
    // basket rim (the catch zone)
    g.fillStyle = '#d9582b';
    g.beginPath(); g.ellipse(0, -2, 46, 10, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // egg hull
    g.fillStyle = '#eae2d0';
    g.beginPath(); g.ellipse(0, 12, 42, 22, 0, 0, Math.PI); g.lineTo(-42, 12); g.fill(); g.stroke();
    g.fillStyle = '#2f7f7a';
    g.fillRect(-42, 8, 84, 6); g.strokeRect(-42, 8, 84, 6);
    g.restore();
    if (this.coco.complete) g.drawImage(this.coco, x - 30, y - 62, 60, 60);
  }

  _draw() {
    const g = this.ctx, W = this.W, H = this.H;
    // retro sky + sunset planet
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#16202e'); sky.addColorStop(0.6, '#22364a'); sky.addColorStop(1, '#2f5358');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(243,230,200,0.55)';
    for (let i = 0; i < 40; i++) { const sx = (i * 97.3) % W, sy = (i * 53.7) % (H * 0.7); g.fillRect(sx, sy, 2, 2); }
    const bands = [['#2f7f7a', 0.62], ['#d9582b', 0.5], ['#e8b23a', 0.4]];
    for (const [c, r] of bands) { g.fillStyle = c; g.beginPath(); g.arc(W / 2, H + W * 0.05, W * r * 1.2, Math.PI, 0); g.fill(); }
    // nest / ground line
    g.fillStyle = '#8a5a2b'; g.fillRect(0, H - 52, W, 52);
    g.fillStyle = '#6b4428';
    for (let i = 0; i < W; i += 14) g.fillRect(i, H - 52 + ((i / 14) % 2) * 5, 10, 3);

    for (const h of this.hens) this._hen(h);
    for (const e of this.eggs) this._egg(e.x, e.y, KIND[e.kind].r, e.kind, e.spin);
    this._pod();

    // pops
    g.textAlign = 'center';
    for (const p of this.pops) {
      g.globalAlpha = 1 - p.t / 0.9;
      g.font = '24px Righteous, sans-serif';
      g.lineWidth = 5; g.strokeStyle = CREAM; g.strokeText(p.text, p.x, p.y - p.t * 40);
      g.fillStyle = p.col; g.fillText(p.text, p.x, p.y - p.t * 40);
    }
    g.globalAlpha = 1;

    // HUD
    document.getElementById('er-score').textContent = this.score;
    document.getElementById('er-time').textContent = Math.ceil(this.left);
    document.getElementById('er-hearts').textContent = '❤'.repeat(Math.max(0, this.hearts)) + '♡'.repeat(Math.max(0, 3 - this.hearts));
    const cb = document.getElementById('er-combo');
    cb.textContent = this.combo >= 6 ? `COMBO x${this.combo >= 15 ? 3 : 2}` : this.combo >= 3 ? `${this.combo} in a row!` : '';
  }
}
