// Test panel (temporary, remove before release): opened from Settings on the home screen and from the pause menu.
// Wallet, start at any area, and in a run: god mode, kill all, skip wave, heal, and take any upgrade card.
'use strict';
const CHEAT = {god: false};
function cheatStartAt(wave) {
  resetUpgrades(); const {magnetPulse, ...up} = JSON.parse(JSON.stringify(UP));
  document.getElementById('cheats').hidden = true; document.getElementById('pause').hidden = true; const hs = document.getElementById('hsheet'); if (hs) hs.hidden = true;
  if (G.state === 'paused') quitToHome();
  newRun(wave > 1 ? {wave, endless: false, weapon: LOOK.weapon, maxHp: 5, score: 0, kills: 0, reroll: 10, up} : null);
}
function cheatSkipWave() {
  WAVE.queue = []; for (const z of [...G.zombies]) if (!z.dying && !z.dummy) damageZombie(z, 0, 9999, {w: weapon()});
}
function openCheats() {
  let el = document.getElementById('cheats');
  if (!el) { el = document.createElement('div'); el.id = 'cheats'; document.body.appendChild(el); }
  const inRun = G.state === 'paused' || G.state === 'playing' || G.state === 'draft';
  const b = (id, t) => `<button data-c="${id}">${t}</button>`;
  el.innerHTML = `<div class="chbox"><h3>Cheats<small>test panel, removed before release</small></h3>
    <div class="chrow">${b('coins', '+1000 coins')}${b('gems', '+50 emeralds')}</div>
    <h4>Start at</h4><div class="chrow">${AREAS.map((A, i) => b('area' + i, `Area ${i + 1}<small>${A.short || A.name}</small>`)).join('')}${b('boss', 'Wave 5 boss')}</div>
    ${inRun ? `<h4>This run</h4><div class="chrow">${b('god', 'God mode: ' + (CHEAT.god ? 'ON' : 'off'))}${b('heal', 'Full hearts')}${b('kill', 'Kill all')}${b('skip', 'Skip wave')}${b('rc', '+200 run coins')}${b('fury', 'Fury full')}</div>
    <h4>Take a card</h4><div class="chrow cards">${CARDS.map((c, i) => b('card' + i, c.title)).join('')}</div>` : '<p class="chnote">Open this from the pause menu in a fight for god mode, kill all and upgrade cards.</p>'}
    <button class="chclose" data-c="close">${icon('close')}Close</button></div>`;
  el.hidden = false;
  el.onclick = e => {
    const t = e.target.closest('[data-c]'); if (!t) { if (e.target === el) el.hidden = true; return; }
    const c = t.dataset.c, P = G.player, say = m => { t.classList.add('done'); setTimeout(() => t.classList.remove('done'), 400); if (m) t.firstChild.textContent = m; };
    if (c === 'close') { el.hidden = true; if (HOME.on) showHome(); return; }
    if (c === 'coins') { META.coins += 1000; saveMeta(); say(); }
    if (c === 'gems') { addGems(50); say(); }
    if (c.startsWith('area')) return cheatStartAt(+c.slice(4) * 5 + 1);
    if (c === 'boss') return cheatStartAt(5);
    if (c === 'god') { CHEAT.god = !CHEAT.god; say('God mode: ' + (CHEAT.god ? 'ON' : 'off')); }
    if (c === 'heal' && P) { P.hp = P.maxHp; say(); }
    if (c === 'kill') { for (const z of [...G.zombies]) if (!z.dying && !z.dummy) damageZombie(z, 0, 9999, {w: weapon()}); say(); }
    if (c === 'skip') { cheatSkipWave(); el.hidden = true; resumeGame(); }
    if (c === 'rc') { G.coins += 200; say(); }
    if (c === 'fury') { POW.add(999); say(); }
    if (c.startsWith('card')) { const k = CARDS[+c.slice(4)]; k.apply(); UP.taken.push(k.id + (k.repeat ? '#' : '')); say(); }
  };
}
