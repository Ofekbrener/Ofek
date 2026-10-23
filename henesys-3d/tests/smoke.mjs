// End-to-end smoke test in phone-sized Chromium. Run: node henesys-3d/tests/smoke.mjs [screenshot.png]
import { serve, launch, sleep, check } from './browser.mjs';

const shot = process.argv[2] || '/tmp/henesys-smoke.png';
const server = await serve();
const { browser, page, errors, touch } = await launch();
try {
  await page.goto('http://localhost:8123/');
  await page.waitForSelector('#t-start', { timeout: 15000 });
  await page.fill('#t-name', 'Tester');
  await page.click('.look[data-look="2"]');
  await page.click('#t-start');
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 15000 });
  check(await page.evaluate(() => window.__game.game.character.name) === 'Tester', 'title screen sets the character name');
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
    for (let i = 0; i < 400; i++) g.engine.tick(10, false);
    g.input.move.x = 0; g.input.move.y = 0;
    const p = g.player.position, b = g.map.bounds;
    return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
  });
  check(inBounds, 'player stays inside map bounds after 400 frames with dt=10');

  // --- Henesys: houses block the player ---
  const outside = await page.evaluate(() => {
    const g = window.__game, house = g.map.colliders.find(c => c.type === 'circle' && Math.hypot(c.x + 15, c.z + 7) < 0.1);
    g.player.place(-10, -7, g.map);
    g.input.camYaw = 0; g.input.move.x = -1; g.input.move.y = 0;
    for (let i = 0; i < 90; i++) g.engine.tick(1 / 30, false);
    g.input.move.x = 0;
    return Math.hypot(g.player.position.x - house.x, g.player.position.z - house.z) >= house.r;
  });
  check(outside, 'player stays outside the mushroom house');

  // --- tap Chief Stan to open his dialog ---
  const at = await page.evaluate(() => {
    const g = window.__game, stan = g.map.npcs.find(n => n.id === 'stan');
    g.player.place(stan.position.x + 2.5, stan.position.z + 2.5, g.map);
    g.input.camYaw = Math.PI / 4; g.input.camPitch = 0.3;
    for (let i = 0; i < 60; i++) g.engine.tick(1 / 30, false);
    const v = stan.position.clone(); v.y += 1; v.project(g.engine.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  });
  await touch('touchStart', [{ x: at.x, y: at.y, id: 5 }]);
  await sleep(60);
  await touch('touchEnd', []);
  await sleep(300);
  check(await page.isVisible('.dialog'), 'tapping Chief Stan opens his dialog');
  await page.screenshot({ path: shot.replace(/\.png$/, '-dialog.png') });
  while (await page.isVisible('.dialog')) { await page.click('.dlg-btns button.pick'); await sleep(100); }

  // --- walk into the east-gate portal ---
  await page.evaluate(() => {
    const g = window.__game, portal = g.map.portals[0];
    g.player.place(portal.x - 3, portal.z, g.map);
    g.input.camYaw = -Math.PI / 2; g.input.move.x = 0; g.input.move.y = 1; // forward = +x
    for (let i = 0; i < 60 && g.map.id === 'henesys'; i++) g.engine.tick(1 / 30, false);
    g.input.move.y = 0;
  });
  check(await page.evaluate(() => window.__game.map.id) === 'hunting', 'portal leads to the Hunting Ground');

  // --- kill the nearest snail with the Attack button ---
  await page.evaluate(() => {
    const g = window.__game;
    g.engine.tick(1 / 30, false);
    const snail = g.map.mobs.filter(m => m.zone === 0).sort((a, b) => a.position.distanceTo(g.player.position) - b.position.distanceTo(g.player.position))[0];
    g.player.place(snail.position.x - 1.2, snail.position.z, g.map);
    window.__target = snail;
  });
  const btn = await page.locator('[data-btn=attack]').boundingBox();
  for (let i = 0; i < 40 && await page.evaluate(() => window.__target.alive); i++) {
    await touch('touchStart', [{ x: btn.x + btn.width / 2, y: btn.y + btn.height / 2, id: 9 }]);
    await sleep(80);
    await touch('touchEnd', []);
    await page.evaluate(() => { const g = window.__game, m = window.__target; if (m.alive) g.player.place(m.position.x - 1.2, m.position.z, g.map); });
    await sleep(250);
  }
  const after = await page.evaluate(() => ({ dead: !window.__target.alive, exp: window.__game.game.character.exp, drops: window.__game.map.drops.length }));
  check(after.dead, 'the snail died');
  check(after.exp > 0, `EXP gained (${after.exp})`);
  check(after.drops > 0, `loot dropped (${after.drops})`);
  await page.screenshot({ path: shot.replace(/\.png$/, '-hunt.png') });

  const maxMobs = await page.evaluate(() => {
    const g = window.__game; let max = 0;
    for (let i = 0; i < 600; i++) { g.engine.tick(1 / 30, false); max = Math.max(max, g.map.mobs.filter(m => m.alive).length); }
    return max;
  });
  check(maxMobs <= 15, `mob count stays within 15 (max ${maxMobs})`);

  // --- level 10, then Athena Pierce makes us a Bowman ---
  await page.evaluate(() => {
    const g = window.__game;
    g.debugSetLevel(10);
    g.enterMap('henesys');
    const a = g.map.npcs.find(n => n.id === 'athena');
    g.player.place(a.position.x, a.position.z + 3, g.map);
    g.input.camYaw = 0; g.input.camPitch = 0.3;
    for (let i = 0; i < 60; i++) g.engine.tick(1 / 30, false);
  });
  const ath = await page.evaluate(() => {
    const g = window.__game, a = g.map.npcs.find(n => n.id === 'athena');
    g.engine.tick(1 / 30);
    const v = a.position.clone(); v.y += 1; v.project(g.engine.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  });
  await touch('touchStart', [{ x: ath.x, y: ath.y, id: 11 }]); await sleep(60); await touch('touchEnd', []); await sleep(300);
  check(await page.isVisible('.dialog'), 'tapping Athena Pierce opens her dialog');
  for (let i = 0; i < 6 && !(await page.isVisible('.dlg-btns button:has-text("Become a Bowman")')); i++) { await page.click('.dlg-btns button.pick'); await sleep(100); }
  await page.click('.dlg-btns button:has-text("Become a Bowman")');
  await sleep(200);
  const job = await page.evaluate(() => ({ job: window.__game.game.character.job, s1: document.getElementById('btn-skill1').disabled, s2: document.getElementById('btn-skill2').disabled }));
  check(job.job === 'bowman' && !job.s1 && !job.s2, 'Athena makes the player a Bowman and both skill buttons are enabled');
  await page.screenshot({ path: shot.replace(/\.png$/, '-bowman.png') });

  // --- death: HP 1, a monster bumps us, we wake up in Henesys with less EXP ---
  const before = await page.evaluate(() => {
    const g = window.__game;
    g.enterMap('hunting');
    g.engine.tick(1 / 30, false);
    g.game.character.exp = 100;
    g.game.character.hp = 1;
    const m = g.map.mobs.find(x => x.alive);
    g.player.place(m.position.x, m.position.z, g.map);
    for (let i = 0; i < 30; i++) g.engine.tick(1 / 30, false);
    return g.game.character.exp;
  });
  await page.waitForSelector('#h-death:not([hidden])', { timeout: 3000 });
  await page.screenshot({ path: shot.replace(/\.png$/, '-death.png') });
  await page.click('#h-revive');
  await sleep(200);
  const after2 = await page.evaluate(() => ({ map: window.__game.map.id, exp: window.__game.game.character.exp, hp: window.__game.game.character.hp, max: window.__game.game.character.maxHp }));
  check(after2.map === 'henesys' && after2.exp === 90 && after2.hp === after2.max, `death returns to Henesys with full HP and 10% EXP lost (exp 100 -> ${after2.exp})`);

  await page.screenshot({ path: shot });
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('SMOKE OK');
} finally {
  await browser.close();
  server.close();
}
