// Every job: advance, reach level 20, fire all four skills.
// Run: node henesys-3d/tests/jobs.mjs
import { serve, launch, sleep, check } from './browser.mjs';

const server = await serve(8133);
const { browser, page, errors } = await launch();
try {
  await page.goto('http://localhost:8133/');
  await page.waitForSelector('#t-start', { timeout: 30000 });
  await page.click('#t-start');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 30000 });

  for (const job of ['warrior', 'magician', 'bowman', 'thief']) {
    const r = await page.evaluate(async (job) => {
      const g = window.__game, out = { used: [], buffs: [], locked: false };
      // fresh beginner at level 20 with this job
      g.resetCharacterForTest();
      g.debugSetLevel(10);
      g.game.advance(job);
      // a locked skill refuses before level 13
      out.locked = g.combat.tryAttack(g.ctx, g.skillIds()[1]) === -1;
      g.debugSetLevel(20);
      g.enterMap('hunting');
      g.engine.tick(1 / 30, false);
      const ch = g.game.character;
      for (const id of g.skillIds()) {
        const m = g.map.mobs.filter(x => x.alive).sort((a, b) => a.position.distanceTo(g.player.position) - b.position.distanceTo(g.player.position))[0];
        if (m) g.player.place(m.position.x - 1.5, m.position.z, g.map);
        ch.mp = ch.maxMp; ch.hp = Math.max(1, ch.hp - 20);
        const hp0 = ch.hp;
        const res = g.combat.tryAttack(g.ctx, id);
        for (let k = 0; k < 40; k++) g.engine.tick(1 / 30, false);
        out.used.push({ id, res, mpUsed: ch.maxMp - ch.mp, healed: ch.hp > hp0 });
      }
      out.buffs = g.activeBuffIds();
      return out;
    }, job);
    check(r.locked, `${job}: the level-13 skill is refused at level 10`);
    for (const u of r.used) check(u.res !== -1 && u.mpUsed > 0, `${job}: ${u.id} fires and costs MP (${u.mpUsed})`);
    const wantBuffs = { warrior: ['rage'], magician: [], bowman: ['focus'], thief: ['haste'] }[job];
    for (const b of wantBuffs) check(r.buffs.includes(b), `${job}: ${b} is active`);
    if (job === 'magician') check(r.used.find(u => u.id === 'heal').healed, 'magician: Heal restores HP');
  }
  await page.screenshot({ path: process.argv[2] || '/tmp/henesys-jobs.png' });
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('JOBS OK');
} finally {
  await browser.close(); server.close();
}
