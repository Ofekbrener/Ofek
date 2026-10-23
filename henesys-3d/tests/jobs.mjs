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
  // holding Attack must not swallow a skill tap (warrior Rage on U)
  await page.evaluate(() => { const g = window.__game; g.resetCharacterForTest(); g.debugSetLevel(10); g.game.advance('warrior'); g.debugSetLevel(20); g.game.character.mp = 999; g.game.character.maxMp = 999; });
  await page.keyboard.down('KeyJ');
  await sleep(300);
  await page.keyboard.press('KeyU');
  // software rendering runs only a few frames a second here, so wait on game state
  const fired = await page.waitForFunction(() => window.__game.activeBuffIds().includes('rage'), null, { timeout: 8000 }).then(() => true, () => false);
  await page.keyboard.up('KeyJ');
  check(fired, 'a skill tap fires while Attack is held');

  // a buff does not cancel Dark Sight; an attack does
  const ds = await page.evaluate(() => {
    const g = window.__game, c = g.combat;
    g.resetCharacterForTest(); g.debugSetLevel(10); g.game.advance('thief'); g.debugSetLevel(20);
    const ch = g.game.character; ch.mp = ch.maxMp = 999;
    const t = () => { for (let k = 0; k < 40; k++) g.engine.tick(1 / 30, false); };
    c.tryAttack(g.ctx, 'darkSight'); t();
    c.tryAttack(g.ctx, 'haste'); t();
    const afterBuff = g.activeBuffIds().includes('darkSight');
    c.tryAttack(g.ctx); t();
    return { afterBuff, afterAttack: g.activeBuffIds().includes('darkSight') };
  });
  check(ds.afterBuff && !ds.afterAttack, `Dark Sight survives Haste and ends on attack (${JSON.stringify(ds)})`);

  // the creator's recolour cache stays small however many looks are tried
  const cache = await page.evaluate(async () => {
    const k = await import('./src/assets/kaykit.js');
    const { PALETTES } = await import('./src/rules/appearance.js');
    for (let i = 0; i < 24; i++) k.buildHero({ hair: PALETTES.hair[i % 8], shirt: PALETTES.shirt[(i * 3) % 8], pants: PALETTES.pants[(i * 5) % 8] }, 'beginner');
    return k.recolourCacheSize();
  });
  check(cache <= 8, `recolour cache stays bounded (${cache} textures)`);

  await page.screenshot({ path: process.argv[2] || '/tmp/henesys-jobs.png' });
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('JOBS OK');
} finally {
  await browser.close(); server.close();
}
