// Saving: a kill is saved at once, a returning player skips the title,
// and blocked storage shows a warning. Run: node henesys-3d/tests/save.mjs
import { serve, launch, sleep, check } from './browser.mjs';

const server = await serve(8127);
const { browser, page, errors } = await launch();
try {
  await page.goto('http://localhost:8127/');
  await page.waitForSelector('#t-start', { timeout: 15000 });
  await page.fill('#t-name', 'Saver');
  await page.click('#t-start');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });

  const exp = await page.evaluate(() => {
    const g = window.__game;
    g.enterMap('hunting');
    g.engine.tick(1 / 30, false);
    const m = g.map.mobs.find(x => x.alive);
    m.takeHit(9999, m.position.x + 1, m.position.z);
    g.ctx.onKill(m);
    return g.game.character.exp;
  });
  // reload at once: no 15 s autosave, no map change
  await page.reload();
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });
  check(!(await page.isVisible('.title')), 'a returning player skips the title screen');
  const back = await page.evaluate(() => ({ exp: window.__game.game.character.exp, name: window.__game.game.character.name }));
  check(back.exp === exp && back.name === 'Saver', `a kill is saved immediately (exp ${exp} -> ${back.exp})`);

  // storage blocked: the player is told progress will not be saved
  const ctx2 = await browser.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true });
  await ctx2.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  const p2 = await ctx2.newPage();
  await p2.goto('http://localhost:8127/');
  await p2.waitForSelector('#t-start', { timeout: 15000 });
  await p2.click('#t-start');
  await p2.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });
  await sleep(300);
  check((await p2.textContent('#h-toast')).includes("won't be saved"), 'blocked storage shows a warning toast');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('SAVE OK');
} finally {
  await browser.close(); server.close();
}
