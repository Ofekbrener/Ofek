// Game-feel checks: hit stop, combo counter, particle pool, coin magnet,
// level-up celebration. Run: node henesys-3d/tests/juice.mjs
import { serve, launch, sleep, check } from './browser.mjs';

const server = await serve(8128);
const { browser, page, errors } = await launch();
try {
  await page.goto('http://localhost:8128/');
  await page.waitForSelector('#t-start', { timeout: 15000 });
  await page.click('#t-start');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });

  const r = await page.evaluate(() => {
    const g = window.__game, out = {};
    g.enterMap('hunting');
    g.engine.tick(1 / 30, false);
    // a landed hit freezes the game for a moment
    const m = g.map.mobs.filter(x => x.alive).sort((a, b) => a.position.distanceTo(g.player.position) - b.position.distanceTo(g.player.position))[0];
    g.player.place(m.position.x - 1.2, m.position.z, g.map);
    g.combat.tryAttack(g.ctx);
    for (let i = 0; i < 8 && !g.engine.frozen; i++) g.engine.tick(1 / 30, false);
    out.hitStop = g.engine.frozen;
    // three quick kills build a combo
    for (const x of g.map.mobs.filter(y => y.alive).slice(0, 3)) { x.takeHit(9999, x.position.x + 1, x.position.z); g.ctx.onKill(x); }
    out.combo = document.getElementById('combo')?.textContent || '';
    // particles never exceed the pool
    for (let k = 0; k < 20; k++) for (const x of g.map.mobs.filter(y => y.alive).slice(0, 2)) { x.takeHit(9999, x.position.x + 1, x.position.z); g.ctx.onKill(x); }
    for (let i = 0; i < 30; i++) g.engine.tick(1 / 30, false);
    out.particles = g.fx.particles.active;
    out.pool = g.fx.particles.size;
    // a nearby coin flies to the player
    const d = g.map.drops.find(x => x.loot.kind === 'mesos');
    if (d) {
      g.player.place(d.position.x + 4, d.position.z, g.map);
      const before = Math.hypot(d.position.x - g.player.position.x, d.position.z - g.player.position.z);
      d.landed = true; d.age = 1;
      for (let i = 0; i < 6; i++) g.engine.tick(1 / 30, false);
      out.magnet = Math.hypot(d.position.x - g.player.position.x, d.position.z - g.player.position.z) < before - 0.5 || !g.map.drops.includes(d);
    }
    // level up: flash overlay, slow motion, full HP and MP
    for (let i = 0; i < 160; i++) g.engine.tick(1 / 30, false);
    const ch = g.game.character; ch.hp = 1; ch.mp = 0;
    ch.exp = g.expToNext() - 1;
    const last = g.map.mobs.find(y => y.alive);
    last.takeHit(9999, last.position.x + 1, last.position.z); g.ctx.onKill(last);
    out.flash = !!document.querySelector('.flash.on');
    out.slow = g.engine.timeScale < 1;
    out.full = ch.hp === ch.maxHp && ch.mp === ch.maxMp;
    return out;
  });
  check(r.hitStop, 'a landed hit triggers hit stop');
  check(/x\s*3/i.test(r.combo), `three quick kills show a combo (${r.combo})`);
  check(r.particles <= r.pool, `particles stay within the pool (${r.particles}/${r.pool})`);
  check(r.magnet === true, 'a coin within 5 m flies to the player');
  check(r.flash && r.slow && r.full, `level up flashes, slows time and refills HP/MP (${JSON.stringify({ f: r.flash, s: r.slow, full: r.full })})`);
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('JUICE OK');
} finally {
  await browser.close(); server.close();
}
