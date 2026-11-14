// HUD: canvas overlay for hearts, coins, wave progress, combo, boss bar, floating text, banners and touch controls.
'use strict';
const hudCv = document.getElementById('hud'), hx = hudCv.getContext('2d');
const HUD = {bannerT: 0, bannerTxt: '', bannerSub: '', bannerCol: '#ffcc33', touch: false,
  btn: {atk: {r: 50, lab: 'ATTACK', col: '#ffcc33', down: null}, jmp: {r: 34, lab: 'JUMP', col: '#8fd0ff', down: null}, dash: {r: 32, lab: 'DASH', col: '#b9a3ff', down: null}}};
try { HUD.touch = matchMedia('(pointer: coarse)').matches; } catch (e) {} // phones show the buttons from the first frame
HUD.resize = () => { hudCv.width = W * DPR; hudCv.height = H * DPR; };
// a banner replaces the area title card if it is still up (both sit near the top on phones)
HUD.banner = (t, s, c) => { HUD.bannerT = 2.2; HUD.bannerTxt = t; HUD.bannerSub = s; HUD.bannerCol = c; const ac = document.getElementById('areacard'); if (ac) ac.classList.remove('on'); };
HUD.layout = () => { const b = HUD.btn, R = W - 24, B = H - 24; b.atk.x = R - 44; b.atk.y = B - 56; b.jmp.x = R - 128; b.jmp.y = B - 26; b.dash.x = R - 112; b.dash.y = B - 118; };
const _pv = new THREE.Vector3();
function toScreen(x, y, z) { _pv.set(x, y, z).project(camera); return [(_pv.x + 1) / 2 * W, (1 - _pv.y) / 2 * H, _pv.z < 1]; }
// shiny coin and emerald pictures (assets/ui), with a glint that passes every few seconds
const CUR_IMG = {coin: new Image(), gem: new Image()}; CUR_IMG.coin.src = 'assets/ui/coin.svg'; CUR_IMG.gem.src = 'assets/ui/gem.svg';
function curIcon(img, x, y, s, ph) {
  if (img.complete && img.naturalWidth) hx.drawImage(img, x, y, s, s);
  const k = ((G.time * .45 + ph) % 2.6); if (k < .5) { const a = Math.sin(k / .5 * Math.PI), r = 6 * a; hx.save(); hx.globalAlpha = a; hx.fillStyle = '#fff'; hx.translate(x + s * .78, y + s * .2);
    hx.beginPath(); hx.moveTo(0, -r); hx.lineTo(r * .25, -r * .25); hx.lineTo(r, 0); hx.lineTo(r * .25, r * .25); hx.lineTo(0, r); hx.lineTo(-r * .25, r * .25); hx.lineTo(-r, 0); hx.lineTo(-r * .25, -r * .25); hx.fill(); hx.restore(); }
}
const HUD_POS = {gx: 20, gy: 120, ex: 20};
function stroked(txt, x, y, font, fill, lw = 5, align = 'center') { hx.font = font; hx.textAlign = align; hx.lineWidth = lw; hx.strokeStyle = '#000'; hx.lineJoin = 'round'; hx.strokeText(txt, x, y); hx.fillStyle = fill; hx.fillText(txt, x, y); }
// touch button icons, drawn as strokes so they stay sharp at any size: axe blade, up chevron, double right chevron
function btnIcon(k, x, y, s) {
  hx.save(); hx.translate(x, y); hx.strokeStyle = '#fff'; hx.fillStyle = '#fff'; hx.lineWidth = 3.5; hx.lineCap = 'round'; hx.lineJoin = 'round'; hx.beginPath();
  if (k === 'atk') { hx.moveTo(-s * .55, s * .7); hx.lineTo(s * .35, -s * .45); // handle
    hx.moveTo(s * .05, -s * .75); hx.quadraticCurveTo(s * .75, -s * .7, s * .8, -s * .05); hx.quadraticCurveTo(s * .45, -s * .1, s * .25, -s * .3); hx.quadraticCurveTo(s * .15, -s * .5, s * .05, -s * .75); hx.stroke(); hx.globalAlpha *= .35; hx.fill(); }
  else if (k === 'jmp') { hx.moveTo(-s * .5, s * .3); hx.lineTo(0, -s * .3); hx.lineTo(s * .5, s * .3); hx.stroke(); }
  else { for (const o of [-.28, .28]) { hx.moveTo(s * (o - .22), -s * .45); hx.lineTo(s * (o + .22), 0); hx.lineTo(s * (o - .22), s * .45); } hx.stroke(); }
  hx.restore();
}
const GEAR_IMGS = {};
function gearImg(id) { if (!GEAR_IMGS[id]) { const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(emblem(GEAR[id].icon, 'gear').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); GEAR_IMGS[id] = i; } return GEAR_IMGS[id]; }
const FONT = s => `${s}px Oswald, Impact, system-ui, sans-serif`;
// the largest font size (down to min) at which txt fits in maxW; measured with the HUD font
function fitSize(txt, size, min, maxW = W - 32) { hx.font = FONT(size); const w = hx.measureText(txt).width; return w <= maxW ? size : Math.max(min, Math.floor(size * maxW / w)); }

function drawHUD(dt) {
  hx.setTransform(DPR, 0, 0, DPR, 0, 0); hx.clearRect(0, 0, W, H);
  const P = G.player, t = G.time; if (!P || HOME.on || G.state === 'creator' || G.state === 'intro' || G.state === 'cutscene' || MAP3D.on) return;
  // floating text in the world
  for (const tx of FX.texts) {
    const [x, y, ok] = toScreen(tx.x, tx.y, tx.z); if (!ok) continue;
    const life = tx.size > 50 ? 1.3 : .9, k = tx.t / life, sc = tx.t < .12 ? (tx.dmg ? 1.4 - .4 * tx.t / .12 : easeOutBack(tx.t / .12)) : 1;
    hx.save(); hx.translate(x, y + tx.off); hx.scale(sc, sc); hx.globalAlpha = 1 - k * k; stroked(tx.txt, 0, 0, FONT(tx.size), tx.col, tx.dmg ? 5 : 6); hx.restore();
  }
  hx.globalAlpha = 1;
  if (G.flash > 0) { hx.fillStyle = `rgba(255,255,255,${G.flash * .45})`; hx.fillRect(0, 0, W, H); }
  if (G.hurtFlash > 0) { hx.fillStyle = `rgba(200,20,20,${G.hurtFlash * .45})`; hx.fillRect(0, 0, W, H); }
  if (P.hp <= P.maxHp * .25 && !P.dead) { const v = hx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); v.addColorStop(0, 'rgba(255,0,0,0)'); v.addColorStop(1, `rgba(255,0,0,${.28 + .12 * Math.sin(t * 6)})`); hx.fillStyle = v; hx.fillRect(0, 0, W, H); }
  // active power-up: colored glow on the screen edge (and a blue tint for TIME WARP)
  if (POW.active) {
    const c = POWERS[POW.active].css, a = .35 + .15 * Math.sin(t * 9), gw = Math.min(W, H) * .12;
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, gw, 0, 0, W, gw], [0, H, 0, H - gw, 0, H - gw, W, gw], [0, 0, gw, 0, 0, 0, gw, H], [W, 0, W - gw, 0, W - gw, 0, gw, H]]) {
      const g = hx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); hx.fillStyle = g; hx.fillRect(rx, ry, rw, rh); }
    if (POW.is('warp')) { hx.fillStyle = 'rgba(40,70,200,.12)'; hx.fillRect(0, 0, W, H); }
  }
  // portrait, hearts, coins
  const L = 16, T = 14;
  const pi = PORTRAIT.img; hx.save(); hx.beginPath(); hx.arc(L + 28, T + 28, 28, 0, 7); const bg = hx.createRadialGradient(L + 28, T + 20, 4, L + 28, T + 28, 30); bg.addColorStop(0, '#3a3f58'); bg.addColorStop(1, '#14161f'); hx.fillStyle = bg; hx.fill(); hx.clip(); if (pi && pi.complete && pi.naturalWidth) hx.drawImage(pi, L - 4, T - 4, 64, 64); hx.restore();
  hx.lineWidth = 3; hx.strokeStyle = G.hurtFlash > 0 ? '#ff4040' : '#ffcc33'; hx.beginPath(); hx.arc(L + 28, T + 28, 28, 0, 7); hx.stroke();
  // health bar: red fill, a white chunk that drains after a hit shows how much it took, numbers inside
  const hsc = FLY.slotPop('hearts', L + 140, T + 14), csc = FLY.slotPop('coins', L + 76, T + 44, 12);
  { const bx = L + 66, by = T + 4, bw = 150, bh = 20, k = clamp(P.hp / P.maxHp, 0, 1);
    HUD.hpLag = HUD.hpLag == null ? k : (G.time - (HUD.hpHit || 0) > .45 ? Math.max(k, HUD.hpLag - (dt || .016) * .6) : Math.max(k, HUD.hpLag)); if (k > HUD.hpLag) HUD.hpLag = k;
    hx.save(); hx.translate(bx + bw / 2, by + bh / 2); hx.scale(hsc, hsc); hx.translate(-bx - bw / 2, -by - bh / 2);
    hx.fillStyle = 'rgba(0,0,0,.6)'; hx.fillRect(bx - 2, by - 2, bw + 4, bh + 4); hx.fillStyle = '#3a1218'; hx.fillRect(bx, by, bw, bh);
    hx.fillStyle = '#ffe8e8'; hx.fillRect(bx, by, bw * HUD.hpLag, bh);
    const low = k <= .25, g = hx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, low ? '#ff6a4a' : '#ff5a68'); g.addColorStop(1, low ? '#b01010' : '#b81830');
    hx.fillStyle = low && Math.sin(G.time * 10) > 0 ? '#ff8a6a' : g; hx.fillRect(bx, by, bw * k, bh);
    hx.fillStyle = 'rgba(255,255,255,.18)'; hx.fillRect(bx, by, bw * k, bh * .4);
    hx.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 25; x < P.maxHp; x += 25) hx.fillRect(bx + bw * x / P.maxHp, by, 1.5, bh);
    hx.strokeStyle = G.hurtFlash > 0 ? '#ff4040' : '#000'; hx.lineWidth = 2; hx.strokeRect(bx, by, bw, bh);
    stroked(Math.ceil(P.hp) + ' / ' + P.maxHp, bx + bw / 2, by + 15, FONT(14), '#fff', 3); hx.restore(); }
  // in a run only this run's pickups show; the bank totals live on the home screen
  const inRun = G.state === 'playing' || G.state === 'paused', coins = inRun ? G.runCoins || 0 : G.coins, gems = inRun ? G.runGems || 0 : META.gems;
  hx.save(); hx.translate(L + 66, T + 50); hx.scale(csc, csc); curIcon(CUR_IMG.coin, -1, -18, 21, 0); stroked('' + coins, 25, 0, FONT(18), '#ffd44a', 4, 'left'); hx.restore();
  if (!inRun || gems) { const gsc = FLY.slotPop('gems', L + 150, T + 44, 12); hx.save(); hx.translate(L + 138, T + 50); hx.scale(gsc, gsc); curIcon(CUR_IMG.gem, 0, -19, 21, 1.4); stroked('' + gems, 24, 0, FONT(18), '#5cf598', 4, 'left'); hx.restore(); }
  // FURY meter: fills from hits and kills, fires a power-up when full
  { const bx = L, by = T + 66, bw = 150, bh = 9, k = POW.active ? clamp(POW.t / POWERS[POW.active].dur, 0, 1) : POW.fury / 100;
    if (k > 0) { hx.fillStyle = 'rgba(0,0,0,.55)'; hx.fillRect(bx - 2, by - 2, bw + 4, bh + 4); }
    else { hx.globalAlpha = .35; hx.strokeStyle = '#ffb070'; hx.lineWidth = 1; hx.strokeRect(bx - .5, by - .5, bw + 1, bh + 1); hx.globalAlpha = 1; }
    const col = POW.active ? CSS(POWERS[POW.active].col) : POW.fury > 85 ? `hsl(${20 + 20 * Math.sin(t * 12)},100%,55%)` : '#ff7a1a';
    hx.fillStyle = col; hx.fillRect(bx, by, bw * k, bh);
    FLY.slotPop('fury', bx + bw / 2, by + 4, 10);
    stroked(POW.active ? POWERS[POW.active].name + ' ' + Math.ceil(POW.t) + 's' : 'FURY', bx + bw + 8, by + 9, FONT(13), POW.active ? col : '#ffb070', 3, 'left'); }
  // score, wave, remaining
  // wave progress is the main read on the right, the score sits small under it
  const left = WAVE.total - WAVE.killed;
  stroked(TUT.active ? 'TRAINING' : `WAVE ${G.wave}` + (G.state === 'playing' && WAVE.active ? `  ·  ${Math.max(0, left)} left` : ''), W - 16, 38, FONT(22), '#ffffff', 5, 'right');
  stroked(String(G.score), W - 16, 62, FONT(20), '#cfd6ff', 4, 'right');
  // combo: anchored at its top-right corner under the wave label (and under the boss bar on phones), pops on each hit
  const narrow = W < 640, comboY = narrow ? 130 : 84;
  if (G.combo > 2) { const s = 1 + Math.min(.4, Math.max(0, G.comboT - 1.7) * 3), fs = 26 + Math.min(G.combo, 30) * .7; hx.save(); hx.translate(W - 16, comboY); hx.scale(s, s); stroked('x' + G.combo, 0, fs * .82, FONT(fs), '#ffcc33', 5, 'right'); stroked('COMBO', 0, fs * .82 + 15, FONT(12), '#ffe9a8', 3, 'right'); hx.restore(); }
  // weapon + upgrade badges
  const w = weapon(), wi = WEAPON_IMG[P.weapon], wsc = FLY.slotPop('weapon', 34, H - 38, 28); if (wi && wi.complete) hx.drawImage(wi, 34 - 28 * wsc, H - 38 - 28 * wsc, 56 * wsc, 56 * wsc);
  // element dots and gear icons with cooldown rings above the weapon name
  // they sit top-left under FURY, away from the move thumb; on phones they drop below the boss bar while a boss is up
  const nG = Object.keys(UP.gear).length, bossUp = WAVE.boss && !WAVE.boss.dying;
  HUD_POS.gy = T + (narrow && bossUp ? 146 : 104); HUD_POS.gx = L + 20; HUD_POS.ex = L + 20 + nG * 40 - (nG ? 8 : 12);
  elActive().forEach((e, i) => { const ex = HUD_POS.ex + i * 22, ey = HUD_POS.gy, es = FLY.slotPop('el' + i, ex, ey, 9); hx.fillStyle = CSS(ELEMENTS[e].col); hx.beginPath(); hx.arc(ex, ey, 9 * es, 0, 7); hx.fill(); hx.strokeStyle = '#000'; hx.lineWidth = 2.5; hx.stroke(); stroked(String(UP.el[e]), ex, ey + 4, FONT(11), '#000', 0); });
  Object.keys(UP.gear).forEach((g, i) => { const x = HUD_POS.gx + i * 40, y = HUD_POS.gy, img = gearImg(g), gs = FLY.slotPop('gear' + i, x, y, 17);
    hx.fillStyle = 'rgba(0,0,0,.6)'; hx.beginPath(); hx.arc(x, y, 17 * gs, 0, 7); hx.fill(); if (img.complete) hx.drawImage(img, x - 13 * gs, y - 13 * gs, 26 * gs, 26 * gs);
    const cdMax = {molotov: 4 - .4 * (gearLvl(g) - 1), tesla: 2.5 - .2 * (gearLvl(g) - 1), pulse: 5 - .3 * (gearLvl(g) - 1)}[g];
    if (cdMax && GS.cd[g] !== undefined) { hx.strokeStyle = '#a8fff0'; hx.lineWidth = 3; hx.beginPath(); hx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - clamp(GS.cd[g] / cdMax, 0, 1))); hx.stroke(); }
    stroked(String(gearLvl(g)), x + 13, y + 15, FONT(12), '#a8fff0', 3); });
  stroked(w.name + (UP.wlvl > 1 ? ' Lv ' + UP.wlvl : ''), 62, H - 26, FONT(20), CSS(w.col), 4, 'left');
    
  // boss bar
  const B = WAVE.boss; if (B && !B.dying) {
    // phones: a full-width strip under the FURY meter; wide screens: centered between the two top corners
    const bw = narrow ? W - 32 : Math.min(520, W - 560), bx = (W - bw) / 2, by = narrow ? 100 : 18, bh = 20;
    hx.fillStyle = 'rgba(0,0,0,.65)'; hx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    hx.fillStyle = '#5a0c0c'; hx.fillRect(bx, by, bw, bh); hx.fillStyle = '#ff3b3b'; hx.fillRect(bx, by, bw * Math.max(0, B.hp / B.maxHp), bh);
    hx.fillStyle = 'rgba(255,255,255,.18)'; hx.fillRect(bx, by, bw * Math.max(0, B.hp / B.maxHp), bh / 3);
    const bt = (B.bossName || 'BOSS') + '   ' + Math.max(0, Math.ceil(B.hp)) + ' / ' + B.maxHp; stroked(bt, W / 2, by + 15, FONT(fitSize(bt, 14, 10, bw - 8)), '#fff0f0', 3);
  }
  // banner
  if (HUD.bannerT > 0) {
    HUD.bannerT -= dt; const k = 1 - HUD.bannerT / 2.2, a = k < .1 ? k / .1 : k > .8 ? (1 - k) / .2 : 1, s = k < .1 ? easeOutBack(k / .1) : 1;
    hx.save(); hx.translate(W / 2, H * (W < 640 ? .2 : .27)); hx.scale(s, s); hx.globalAlpha = a; stroked(HUD.bannerTxt, 0, 0, FONT(fitSize(HUD.bannerTxt, Math.min(54, (W - 24) * 1.15 / Math.max(1, HUD.bannerTxt.length)), 20)), HUD.bannerCol, 9);
    if (HUD.bannerSub) stroked(HUD.bannerSub, 0, 36, FONT(fitSize(HUD.bannerSub, 22, 14)), '#ffffff', 5); hx.restore();
  }
  // touch controls
  if (HUD.touch && G.state === 'playing' && !P.dead) {
    HUD.layout();
    for (const k in HUD.btn) { const b = HUD.btn[k]; if (k === 'dash' && !UP.dash) continue;
      const dn = b.down !== null, r = b.r * (dn ? .9 : 1);
      hx.globalAlpha = dn ? .45 : .18; hx.fillStyle = b.col; hx.beginPath(); hx.arc(b.x, b.y, r, 0, 7); hx.fill();
      hx.globalAlpha = .7; hx.strokeStyle = b.col; hx.lineWidth = 2.5; hx.stroke();
      hx.globalAlpha = .95; btnIcon(k, b.x, b.y - r * .12, r * .5); hx.globalAlpha = .6; stroked(b.lab, b.x, b.y + r * .62, FONT(10), '#fff', 2); }
    const j = INPUT.joy;
    if (!j) { hx.globalAlpha = .15; hx.strokeStyle = '#fff'; hx.lineWidth = 3; hx.beginPath(); hx.arc(90, H - 110, 55, 0, 7); hx.stroke(); }
    else { hx.globalAlpha = .35; hx.strokeStyle = '#fff'; hx.lineWidth = 3; hx.beginPath(); hx.arc(j.ox, j.oy, 55, 0, 7); hx.stroke(); const dx = j.x - j.ox, dy = j.y - j.oy, l = Math.min(55, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); hx.fillStyle = '#fff'; hx.beginPath(); hx.arc(j.ox + Math.cos(a) * l, j.oy + Math.sin(a) * l, 24, 0, 7); hx.fill(); }
    hx.globalAlpha = 1;
    // training: a pulsing ring and a bouncing finger on the control the current step needs
    const st = TUT.active && !TUT.doneT ? TUT_STEPS[TUT.i] : null;
    if (st && st.touch) {
      const which = st.touch === 'slam' ? (Math.floor(t / 1.1) % 2 ? 'atk' : 'jmp') : st.touch, k = (t * 1.6) % 1;
      if (which === 'drag') {
        const x0 = W * .25, y0 = H * .62, x = x0 + Math.sin(t * 2.2) * 60;
        hx.globalAlpha = .5; hx.strokeStyle = '#fff'; hx.lineWidth = 3; hx.beginPath(); hx.arc(x0, y0, 55, 0, 7); hx.stroke();
        hx.globalAlpha = .9; hx.fillStyle = '#ffcc33'; hx.beginPath(); hx.arc(x, y0, 18, 0, 7); hx.fill();
        hx.globalAlpha = 1; stroked('👆', x + 6, y0 + 40, FONT(34), '#fff', 0); stroked('DRAG', x0, y0 - 68, FONT(16), '#ffcc33', 4);
      } else { const b = HUD.btn[which];
        hx.strokeStyle = '#ffcc33'; hx.lineWidth = 4; hx.globalAlpha = 1 - k; hx.beginPath(); hx.arc(b.x, b.y, b.r + 6 + k * 26, 0, 7); hx.stroke();
        hx.globalAlpha = 1; stroked('👇', b.x, b.y - b.r - 10 + Math.sin(t * 8) * 6, FONT(36), '#fff', 0); stroked('TAP', b.x, b.y - b.r - 52, FONT(16), '#ffcc33', 4); }
      hx.globalAlpha = 1;
    }
  }
}
