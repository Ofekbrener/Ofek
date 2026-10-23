// Regression checks for the final-review findings. Run: node henesys-3d/tests/regressions.mjs
import { serve, launch, sleep, check } from './browser.mjs';

const server = await serve(8126);
const { browser, page, errors } = await launch();
const start = async () => {
  await page.waitForSelector('#t-start', { timeout: 15000 });
  await page.click('#t-start');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });
};
try {
  await page.goto('http://localhost:8126/');
  await start();

  // #1 dead mobs leave the scene; #4 GPU memory stays bounded; #3 fade recompiles the shader
  const r = await page.evaluate(() => {
    const g = window.__game;
    g.enterMap('hunting');
    g.engine.tick(1 / 30, false);
    let fadeOk = true;
    const geo0 = g.engine.renderer.info.memory.geometries;
    let geoStart = 0;
    for (let round = 0; round < 6; round++) {
      // measure from the second round, once the zones are full and steady
      if (round === 1) { g.engine.tick(1 / 30); geoStart = g.engine.renderer.info.memory.geometries; }
      for (const m of g.map.mobs.filter(x => x.alive)) {
        m.takeHit(9999, m.position.x + 1, m.position.z);
        g.ctx.onKill(m);
      }
      g.engine.tick(1 / 30, false);
      const dying = g.map.mobs.find(x => !x.alive);
      if (dying) {
        const mats = [];
        dying.object3d.traverse(o => { if (o.material) mats.push(o.material); });
        if (!mats.every(mt => mt.transparent && mt.version > 0)) fadeOk = false;
      }
      for (let i = 0; i < 300; i++) g.engine.tick(1 / 30, false);
      g.engine.tick(1 / 30);
    }
    return { total: g.map.mobs.length, alive: g.map.mobs.filter(m => m.alive).length, fadeOk, geoStart, geoEnd: g.engine.renderer.info.memory.geometries, geo0 };
  });
  check(r.total === r.alive, `dead mobs are removed (${r.total} in list, ${r.alive} alive)`);
  check(r.fadeOk, 'death fade marks materials for recompilation');
  check(r.geoEnd - r.geoStart < 60, `GPU geometries stay bounded (${r.geoStart} -> ${r.geoEnd})`);

  // #7 dying saves the penalty with full HP in town
  await page.evaluate(() => { const g = window.__game, m = g.map.mobs.find(x => x.alive); g.game.character.hp = 1; g.game.character.exp = 50; g.player.place(m.position.x, m.position.z, g.map); for (let i = 0; i < 30; i++) g.engine.tick(1 / 30, false); });
  await page.waitForSelector('#h-death:not([hidden])', { timeout: 3000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('henesys3d.save.v1')));
  check(saved.character.hp === saved.character.maxHp && saved.mapId === 'henesys' && saved.character.exp === 45, `death is saved once, in town, with full HP (${JSON.stringify({ hp: saved.character.hp, map: saved.mapId, exp: saved.character.exp })})`);
  await page.click('#h-revive');

  // phase 2: a chasing monster cannot climb a 1 m log after the player
  const climb = await page.evaluate(() => {
    const g = window.__game;
    g.enterMap('hunting'); g.engine.tick(1 / 30, false);
    const m = g.map.mobs.find(x => x.alive), mx = m.position.x, mz = m.position.z, y0 = m.position.y;
    const box = (px, pz) => Math.abs(px - (mx + 2.5)) <= 1 && Math.abs(pz - mz) <= 1 ? y0 + 1 : null;
    g.map.heightFns.push(box);
    m.state = 'chase'; m.leashFrom = { x: mx, z: mz };
    for (let k = 0; k < 120; k++) { g.player.position.set(mx + 2.5, y0 + 1, mz); g.player.vy = 0; m.update(1 / 30, k / 30, g.player, g.map); }
    g.map.heightFns.splice(g.map.heightFns.indexOf(box), 1);
    return m.position.y - y0;
  });
  check(climb < 0.3, `a monster cannot climb onto a 1 m log (rose ${climb.toFixed(2)} m)`);

  // phase 2: the "quest done" toast shows once, not on every later kill
  const toasts = await page.evaluate(() => {
    const g = window.__game, ch = g.game.character;
    ch.quests = {}; g.acceptQuest('snailHunt'); ch.quests.snailHunt.count = 14;
    g.enterMap('hunting'); g.engine.tick(1 / 30, false);
    let n = 0;
    for (let k = 0; k < 3; k++) {
      const m = g.map.mobs.find(x => x.alive && /nail/i.test(x.id));
      document.getElementById('h-toast').textContent = '';
      m.takeHit(9999, m.position.x + 1, m.position.z); g.ctx.onKill(m);
      if (document.getElementById('h-toast').textContent.includes('Return to')) n++;
    }
    return { n, saved: JSON.stringify(ch.quests) };
  });
  check(toasts.n === 1 && !toasts.saved.includes('announced'), `the quest-done toast shows once and stays out of the save (${JSON.stringify(toasts)})`);

  // phase 2: a ready quest at a job instructor can be turned in before choosing a job
  const ready = await page.evaluate(() => {
    const g = window.__game, ch = g.game.character;
    g.resetCharacterForTest(); g.debugSetLevel(10);
    g.acceptQuest('caps'); g.game.character.quests.caps.count = 8;
    return g.npcDialogFor('athena')?.choices?.map(c => c.label) ?? [];
  });
  check(ready.includes('Complete'), `Athena takes back a finished quest before the job talk (${ready})`);

  // the shop turns mesos into potions and a glowing weapon tier
  const shop = await page.evaluate(() => {
    const g = window.__game;
    g.resetCharacterForTest(); g.enterMap('henesys');
    const ch = g.game.character;
    const rina = g.map.npcs.some(n => n.id === 'rina');
    ch.mesos = 1000;
    const d = g.game.shop();
    d.choices.find(c => c.label.startsWith('Red Potion')).onPick();
    d.choices.find(c => c.label.startsWith('Weapon')).onPick();
    let glow = 0; g.player.model.object3d.traverse(m => { if (m.isMesh && m.name === 'Knife') glow = m.material.emissive.getHex(); });
    const broke = g.game.shop(); broke.choices.find(c => c.label.startsWith('Blue Potion')).onPick();
    return { rina, mesos: ch.mesos, red: ch.potions.red, weapon: ch.gear.weapon, glow, blue: ch.potions.blue };
  });
  check(shop.rina && shop.mesos === 200 && shop.red === 15 && shop.weapon === 1 && shop.glow > 0 && shop.blue === 5, `Rina sells potions and a weapon upgrade (${JSON.stringify(shop)})`);

  // the shop reopens itself after each purchase; close it until it stays closed
  for (let k = 0; k < 6; k++) {
    await sleep(400);
    await page.evaluate(() => { for (const b of document.querySelectorAll('.dialog button')) if (b.textContent === 'Not now') b.click(); });
  }

  // #2 reset progress really deletes the save
  await page.click('#h-gear');
  await page.click('#h-reset');
  await page.click('#h-yes');
  await page.waitForLoadState('load');
  await sleep(800);
  check(!(await page.isVisible('#t-cont')), 'after Reset the title has no Continue button');
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('REGRESSIONS OK');
} finally {
  await browser.close(); server.close();
}
