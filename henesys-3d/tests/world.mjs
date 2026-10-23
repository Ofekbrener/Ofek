// Every portal leads somewhere that builds and fills with monsters, and a
// quest goes from accept to reward. Run: node henesys-3d/tests/world.mjs
import { serve, launch, sleep, check } from './browser.mjs';

const server = await serve(8136);
const { browser, page, errors } = await launch();
const walkInto = (portalIndex) => page.evaluate((i) => {
  const g = window.__game, p = g.map.portals[i], from = g.map.id;
  g.player.place(p.x, p.z, g.map);
  for (let k = 0; k < 3 && g.map.id === from; k++) g.engine.tick(1 / 30, false);
  for (let k = 0; k < 30; k++) g.engine.tick(1 / 30, false);
  return { from, to: g.map.id, mobs: g.map.mobs?.filter(m => m.alive).map(m => m.id) ?? [] };
}, portalIndex);
try {
  await page.goto('http://localhost:8136/');
  await page.waitForSelector('#t-start', { timeout: 30000 });
  await page.click('#t-start');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 30000 });

  // Henesys -> Pig Farm -> Henesys -> HG I -> HG II -> Ruins -> HG II
  const route = [[1, 'pigfarm', ['pig', 'ribbonPig']], [0, 'henesys', []], [0, 'hunting', ['snail', 'orangeMushroom']], [1, 'hunting2', ['stump', 'greenMushroom', 'hornyMushroom']], [1, 'ruins', ['skeletonMinion', 'skeletonWarrior', 'skeletonMage']], [0, 'hunting2', []]];
  for (const [idx, want, mobs] of route) {
    const r = await walkInto(idx);
    check(r.to === want, `${r.from} portal ${idx} leads to ${want} (got ${r.to})`);
    for (const m of mobs) check(r.mobs.includes(m), `${want} has ${m}`);
  }

  // Snail Hunt: accept from Chief Stan, kill 15 snails, hand in for the reward
  const q = await page.evaluate(async () => {
    const g = window.__game;
    g.enterMap('henesys');
    const out = {};
    out.offered = g.questsFrom('stan').map(x => x.id);
    g.acceptQuest('snailHunt');
    g.engine.tick(1 / 30, false);
    out.trackerShown = !!document.querySelector('#h-quests .q');
    g.enterMap('hunting'); g.engine.tick(1 / 30, false);
    const ch = g.game.character;
    for (let k = 0; k < 15; k++) {
      const m = g.map.mobs.find(x => x.alive && x.id.includes('nail')) ?? g.map.mobs.find(x => x.alive && x.id === 'snail');
      if (!m) { for (let j = 0; j < 150; j++) g.engine.tick(1 / 30, false); k--; continue; }
      m.takeHit(9999, m.position.x + 1, m.position.z); g.ctx.onKill(m);
    }
    out.status = g.questStatus('snailHunt');
    const mesos = ch.mesos;
    g.enterMap('henesys');
    out.turnedIn = g.turnInQuest('snailHunt');
    out.mesosGained = ch.mesos - mesos;
    out.done = g.questStatus('snailHunt');
    return out;
  });
  check(q.offered.includes('snailHunt'), 'Chief Stan offers Snail Hunt');
  check(q.trackerShown, 'the quest tracker shows the active quest');
  check(q.status === 'ready', `15 snail kills finish the goal (${q.status})`);
  check(q.turnedIn && q.mesosGained >= 200 && q.done === 'done', `turning in pays the reward (+${q.mesosGained} mesos)`);

  await page.screenshot({ path: process.argv[2] || '/tmp/henesys-world.png' });
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('WORLD OK');
} finally {
  await browser.close(); server.close();
}
