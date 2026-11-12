// HUD: canvas overlay for hearts, coins, wave progress, combo, boss bar, floating text, banners and touch controls.
'use strict';
const hudCv = document.getElementById('hud'), hx = hudCv.getContext('2d');
const face = new Image(); face.src = 'assets/face.png';
const HUD = {bannerT: 0, bannerTxt: '', bannerSub: '', bannerCol: '#ffcc33', touch: false,
  btn: {atk: {r: 56, lab: 'ATTACK', col: '#ffcc33'}, jmp: {r: 38, lab: 'JUMP', col: '#8fd0ff'}, dash: {r: 34, lab: 'DASH', col: '#b9a3ff'}}};
try { HUD.touch = matchMedia('(pointer: coarse)').matches; } catch (e) {} // phones show the buttons from the first frame
HUD.resize = () => { hudCv.width = W * DPR; hudCv.height = H * DPR; };
HUD.banner = (t, s, c) => { HUD.bannerT = 2.2; HUD.bannerTxt = t; HUD.bannerSub = s; HUD.bannerCol = c; };
HUD.layout = () => { const b = HUD.btn, R = W - 24, B = H - 24; b.atk.x = R - 50; b.atk.y = B - 60; b.jmp.x = R - 150; b.jmp.y = B - 30; b.dash.x = R - 130; b.dash.y = B - 130; };
const _pv = new THREE.Vector3();
function toScreen(x, y, z) { _pv.set(x, y, z).project(camera); return [(_pv.x + 1) / 2 * W, (1 - _pv.y) / 2 * H, _pv.z < 1]; }
function stroked(txt, x, y, font, fill, lw = 5, align = 'center') { hx.font = font; hx.textAlign = align; hx.lineWidth = lw; hx.strokeStyle = '#000'; hx.lineJoin = 'round'; hx.strokeText(txt, x, y); hx.fillStyle = fill; hx.fillText(txt, x, y); }
const FONT = s => `${s}px Oswald, Impact, system-ui, sans-serif`;

function drawHUD(dt) {
  hx.setTransform(DPR, 0, 0, DPR, 0, 0); hx.clearRect(0, 0, W, H);
  const P = G.player, t = G.time; if (!P) return;
  // floating text in the world
  for (const tx of FX.texts) {
    const [x, y, ok] = toScreen(tx.x, tx.y, tx.z); if (!ok) continue;
    const life = tx.size > 50 ? 1.3 : .9, k = tx.t / life, sc = tx.t < .12 ? easeOutBack(tx.t / .12) : 1;
    hx.save(); hx.translate(x, y + tx.off); hx.scale(sc, sc); hx.globalAlpha = 1 - k * k; stroked(tx.txt, 0, 0, FONT(tx.size), tx.col, 6); hx.restore();
  }
  hx.globalAlpha = 1;
  if (G.flash > 0) { hx.fillStyle = `rgba(255,255,255,${G.flash * .45})`; hx.fillRect(0, 0, W, H); }
  if (G.hurtFlash > 0) { hx.fillStyle = `rgba(200,20,20,${G.hurtFlash * .45})`; hx.fillRect(0, 0, W, H); }
  if (P.hp <= 1 && !P.dead) { const v = hx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); v.addColorStop(0, 'rgba(255,0,0,0)'); v.addColorStop(1, `rgba(255,0,0,${.28 + .12 * Math.sin(t * 6)})`); hx.fillStyle = v; hx.fillRect(0, 0, W, H); }
  if (P.rage > 0) { hx.strokeStyle = `rgba(255,120,20,${.4 + .2 * Math.sin(t * 10)})`; hx.lineWidth = 10; hx.strokeRect(5, 5, W - 10, H - 10); }
  // portrait, hearts, coins
  const L = 16, T = 14;
  if (face.complete && face.naturalWidth) { hx.save(); hx.beginPath(); hx.arc(L + 28, T + 28, 28, 0, 7); hx.fillStyle = '#000'; hx.fill(); hx.clip(); hx.drawImage(face, L, T - 6, 56, 88); hx.restore(); }
  hx.lineWidth = 3; hx.strokeStyle = G.hurtFlash > 0 ? '#ff4040' : '#ffcc33'; hx.beginPath(); hx.arc(L + 28, T + 28, 28, 0, 7); hx.stroke();
  let hs = ''; for (let i = 0; i < P.maxHp; i++) hs += i < P.hp ? '♥' : '♡';
  stroked(hs, L + 66, T + 22, FONT(24), '#ff4a5a', 4, 'left');
  stroked('● ' + G.coins, L + 66, T + 50, FONT(18), '#ffc83a', 4, 'left');
  // score, wave, remaining
  stroked(String(G.score), W - 16, 38, FONT(30), '#ffffff', 5, 'right');
  const left = WAVE.total - WAVE.killed;
  stroked(`WAVE ${G.wave}` + (G.state === 'playing' && WAVE.active ? `  ·  ${Math.max(0, left)} left` : ''), W - 16, 64, FONT(17), '#cfd6ff', 4, 'right');
  if (G.combo > 2) { const s = 1 + Math.max(0, G.comboT - 1.7) * 3; hx.save(); hx.translate(W - 16, 104); hx.scale(s, s); stroked('x' + G.combo, 0, 0, FONT(26 + Math.min(G.combo, 30) * .7), '#ffcc33', 5, 'right'); hx.restore(); }
  // weapon + upgrade badges
  const w = weapon(), wi = WEAPON_IMG[P.weapon]; if (wi && wi.complete) hx.drawImage(wi, 6, H - 66, 56, 56);
  stroked((UP.infuse ? INFUSE[UP.infuse].name + ' ' : '') + w.name, 62, H - 26, FONT(20), '#' + new THREE.Color(w.col).getHexString(), 4, 'left');
    
  // boss bar
  const B = WAVE.boss; if (B && !B.dying) {
    const bw = Math.min(520, W - 40), bx = (W - bw) / 2, by = W < 640 ? 84 : 18; hx.fillStyle = 'rgba(0,0,0,.6)'; hx.fillRect(bx - 3, by - 3, bw + 6, 20);
    hx.fillStyle = '#7a1010'; hx.fillRect(bx, by, bw, 14); hx.fillStyle = '#ff3b3b'; hx.fillRect(bx, by, bw * Math.max(0, B.hp / B.maxHp), 14);
    stroked('THE BUTCHER', W / 2, by + 36, FONT(16), '#ffdddd', 4);
  }
  // banner
  if (HUD.bannerT > 0) {
    HUD.bannerT -= dt; const k = 1 - HUD.bannerT / 2.2, a = k < .1 ? k / .1 : k > .8 ? (1 - k) / .2 : 1, s = k < .1 ? easeOutBack(k / .1) : 1;
    hx.save(); hx.translate(W / 2, H * .27); hx.scale(s, s); hx.globalAlpha = a; stroked(HUD.bannerTxt, 0, 0, FONT(54), HUD.bannerCol, 9);
    if (HUD.bannerSub) stroked(HUD.bannerSub, 0, 36, FONT(22), '#ffffff', 5); hx.restore();
  }
  // touch controls
  if (HUD.touch && G.state === 'playing' && !P.dead) {
    HUD.layout();
    for (const [k, b] of Object.entries(HUD.btn)) { if (k === 'dash' && !UP.dash) continue; hx.globalAlpha = .3; hx.fillStyle = b.col; hx.beginPath(); hx.arc(b.x, b.y, b.r, 0, 7); hx.fill(); hx.globalAlpha = .9; stroked(b.lab, b.x, b.y + 5, FONT(14), '#fff', 3); }
    const j = INPUT.joy; if (j) { hx.globalAlpha = .35; hx.strokeStyle = '#fff'; hx.lineWidth = 3; hx.beginPath(); hx.arc(j.ox, j.oy, 55, 0, 7); hx.stroke(); const dx = j.x - j.ox, dy = j.y - j.oy, l = Math.min(55, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); hx.fillStyle = '#fff'; hx.beginPath(); hx.arc(j.ox + Math.cos(a) * l, j.oy + Math.sin(a) * l, 24, 0, 7); hx.fill(); }
    hx.globalAlpha = 1;
  }
}
