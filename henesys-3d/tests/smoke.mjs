// End-to-end smoke test in phone-sized Chromium. Run: node henesys-3d/tests/smoke.mjs [screenshot.png]
import { serve, launch, sleep, check } from './browser.mjs';

const shot = process.argv[2] || '/tmp/henesys-smoke.png';
const server = await serve();
const { browser, page, errors, touch } = await launch();
try {
  await page.goto('http://localhost:8123/');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });
  await sleep(500);

  // --- movement + camera with two simultaneous touches ---
  const p0 = await page.evaluate(() => ({ ...window.__game.player.position }));
  const yaw0 = await page.evaluate(() => window.__game.input.camYaw);
  await touch('touchStart', [{ x: 100, y: 600, id: 1 }, { x: 300, y: 300, id: 2 }]);
  for (let i = 1; i <= 20; i++) {
    await touch('touchMove', [{ x: 100, y: 600 - Math.min(i * 5, 50), id: 1 }, { x: 300 + i * 3, y: 300, id: 2 }]);
    await sleep(50);
  }
  await touch('touchEnd', []);
  const p1 = await page.evaluate(() => ({ ...window.__game.player.position }));
  const yaw1 = await page.evaluate(() => window.__game.input.camYaw);
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, `player moved (${(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toFixed(2)} m)`);
  check(yaw1 !== yaw0, 'camera yaw changed by the second finger');

  // --- a 10 s frame is clamped and the player stays in bounds ---
  const inBounds = await page.evaluate(() => {
    const g = window.__game;
    g.input.move.x = 1; g.input.move.y = 1;
    for (let i = 0; i < 400; i++) g.engine.tick(10);
    g.input.move.x = 0; g.input.move.y = 0;
    const p = g.player.position, b = g.map.bounds;
    return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
  });
  check(inBounds, 'player stays inside map bounds after 400 frames with dt=10');

  for (const step of (globalThis.SMOKE_STEPS || [])) await step({ page, touch });

  await page.screenshot({ path: shot });
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('SMOKE OK');
} finally {
  await browser.close();
  server.close();
}
