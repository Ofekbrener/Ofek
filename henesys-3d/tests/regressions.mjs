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
    g.engine.tick(1 / 30);
    const geoStart = g.engine.renderer.info.memory.geometries;
    for (let round = 0; round < 6; round++) {
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
