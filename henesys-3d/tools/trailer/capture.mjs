// Films the trailer inside the real game: scripted scenes, 30 fps, one JPEG per
// frame, plus a log of the game's sound effects with their times.
//   node henesys-3d/tools/trailer/capture.mjs OUT_DIR
// Then: python3 henesys-3d/tools/trailer/music.py OUT_DIR/music.wav and
//       python3 henesys-3d/tools/trailer/mix.py OUT_DIR
import fs from 'node:fs';
import { serve } from '../../tests/browser.mjs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const OUT = process.argv[2];
const EVERY = Number(process.argv[3] ?? 1); // e.g. 30 films one frame per second, for previews
fs.mkdirSync(OUT + '/frames', { recursive: true });
const FPS = 30, LENGTH = 38;

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const server = await serve(8150);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
// the script drives every frame itself; the game's own loop stays off
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
await page.goto('http://localhost:8150/');
await page.waitForSelector('#t-start', { timeout: 60000 });
await page.fill('#t-name', 'Ofek').catch(() => {});
await page.click('#t-start');
await page.waitForFunction(() => window.__game?.player, null, { timeout: 60000 });

await page.evaluate(() => {
  const g = window.__game, dt = 1 / 30;
  const css = document.createElement('style');
  css.textContent = `
    #trailer { position: fixed; inset: 0; pointer-events: none; z-index: 50; display: flex; flex-direction: column; align-items: center; font-family: 'Lilita One', sans-serif; color: #fff; text-align: center; }
    #trailer .big { margin-top: 18%; font-size: 58px; line-height: 1; letter-spacing: 1px; -webkit-text-stroke: 3px #5a2a00; paint-order: stroke fill; text-shadow: 0 5px 0 #5a2a00, 0 10px 18px rgba(0,0,0,.35); color: #ffcf3a; }
    #trailer .sub { margin-top: 10px; font-size: 21px; -webkit-text-stroke: 2px #3a2410; paint-order: stroke fill; text-shadow: 0 3px 8px rgba(0,0,0,.4); }
    #trailer .cap { margin-top: 13%; font-size: 30px; -webkit-text-stroke: 2.5px #2a1a08; paint-order: stroke fill; text-shadow: 0 4px 10px rgba(0,0,0,.4); }
    #trailer .low { position: absolute; bottom: 9%; font-size: 17px; font-family: 'Fredoka', sans-serif; font-weight: 700; background: rgba(40,24,8,.72); padding: 8px 16px; border-radius: 22px; }
    #trailer .pop { animation: pop .35s cubic-bezier(.2,1.6,.4,1) both; }
    @keyframes pop { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    body.cine #hud, body.cine #controls, body.cine #stick, .toast { display: none !important; }
    body.cine .npc-label, body.cine .nametag { opacity: .9; }`;
  document.head.appendChild(css);
  const layer = document.createElement('div'); layer.id = 'trailer'; document.body.appendChild(layer);
  let shown = '';
  const say = (html) => { if (html !== shown) { layer.innerHTML = html; shown = html; } };
  const cine = on => document.body.classList.toggle('cine', on);
  // wide shots: keep trees solid (the game fades the ones near the camera)
  const noFade = on => { if (on) { g.map.solid = g.map.occluders; g.map.occluders = []; } else if (g.map.solid) g.map.occluders = g.map.solid; };

  // every sound effect the combat code plays, with its time
  window.SFX = [];
  let now = 0;
  const realSfx = g.ctx.sfx;
  g.ctx.sfx = name => { if (name) window.SFX.push({ t: now, name }); };
  const sfx = name => window.SFX.push({ t: now, name });

  const ch = () => g.game.character, P = () => g.player, I = g.input;
  const tough = () => { const c = ch(); c.maxHp = Math.max(c.maxHp, 99999); c.hp = c.maxHp; c.mp = c.maxMp = 9999; };
  function asJob(job, level, mapId) {
    g.resetCharacterForTest();
    g.debugSetLevel(10);
    if (job !== 'beginner') g.game.advance(job);
    if (level > 10) g.debugSetLevel(level);
    g.enterMap(mapId);
    g.combat.reset();
    tough();
  }
  // move live monsters (of the given kinds) into an arc in front of the player
  function lineUp(kinds, n, dist, spread = 1.1) {
    const p = P().position, yaw = P().yaw;
    const mobs = g.map.mobs.filter(m => m.alive && (!kinds || kinds.includes(m.id))).slice(0, n);
    mobs.forEach((m, i) => {
      const a = yaw + (i - (mobs.length - 1) / 2) * spread / Math.max(1, dist / 3);
      m.position.set(p.x + Math.sin(a) * dist, p.y, p.z + Math.cos(a) * dist);
    });
    return mobs;
  }
  function face(yaw) { P().yaw = P().targetYaw = yaw; }
  function cam(yaw, pitch, dist) { I.camYaw = yaw; I.camPitch = pitch; I.zoom = dist / 12; }
  const attack = id => g.combat.tryAttack(g.ctx, id ?? null);
  const ease = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const card = (big, sub) => `<div class="big pop">${big}</div>${sub ? `<div class="sub pop" style="animation-delay:.12s">${sub}</div>` : ''}`;
  const cap = (t, low) => `<div class="cap pop">${t}</div>${low ? `<div class="low pop" style="animation-delay:.15s">${low}</div>` : ''}`;

  // [start s, end s, setup(), frame(local t, local frame)]
  const SCENES = [
    [0, 4, () => { cine(true); g.enterMap('henesys'); noFade(true); g.player.place(0, 9, g.map); face(Math.PI); tough(); },
      t => { const k = ease(t / 4); cam(lerp(0.3, 1.5, k), lerp(0.75, 0.45, k), lerp(30, 17, k)); say(t > 0.4 ? card('HENESYS 3D', 'A MapleStory tribute for your phone') : ''); }],
    [4, 8, () => { noFade(false); g.player.place(2, 10, g.map); },
      t => { const dir = 1.84; I.camYaw = dir + Math.PI; I.move.x = 0; I.move.y = t < 3.6 ? 1 : 0; cam(dir + Math.PI + 0.35 - t * 0.1, 0.42, 9); say(t > 0.3 ? cap('Explore Henesys', 'Make your own hero') : ''); }],
    [8, 12, () => { I.move.y = 0; cine(false); asJob('beginner', 7, 'hunting'); ch().level = 7; lineUp(['snail', 'blueSnail', 'redSnail', 'orangeMushroom'], 3, 2.6); },
      (t, f) => { cam(P().yaw + Math.PI + 0.35, 0.5, 11); if (f % 9 === 0) attack(); if (f % 40 === 20) lineUp(['snail', 'blueSnail', 'redSnail', 'orangeMushroom', 'slime'], 3, 2.6); say(t > 0.3 ? cap('Hunt monsters') : ''); }],
    [12, 14, () => { cine(true); lineUp(null, 0, 3); g.fx.levelUp(g.map.scene, P()); P().model.cheer?.(); ch().level = 8; sfx('levelup'); },
      t => { cam(P().yaw + Math.PI * 0.75 + t * 0.2, 0.18, lerp(7, 5, t / 2)); say(t > 0.2 ? cap('Level up fast!') : ''); }],
    // four jobs, three seconds each
    ...[
      ['warrior', 'pigfarm', ['pig', 'ribbonPig'], 2.2, ['slashBlast', null, 'spin', 'powerStrike'], 'WARRIOR', 'Slash Blast · Spin'],
      ['magician', 'hunting2', ['stump', 'greenMushroom', 'hornyMushroom'], 5, ['thunderbolt', 'energyBolt', 'magicClaw', 'energyBolt'], 'MAGICIAN', 'Thunderbolt · Energy Bolt'],
      ['bowman', 'hunting', ['orangeMushroom', 'slime', 'redSnail'], 6.5, ['arrowRain', 'doubleShot', 'arrowBlow', 'doubleShot'], 'BOWMAN', 'Arrow Rain · Arrow Blow'],
      ['thief', 'hunting2', ['stump', 'greenMushroom', 'hornyMushroom'], 5.5, ['luckySeven', 'luckySeven', 'luckySeven', 'luckySeven'], 'THIEF', 'Lucky Seven'],
    ].map(([job, mapId, kinds, dist, skills, name, low], i) => [14 + i * 3, 17 + i * 3,
      () => { asJob(job, 20, mapId); const sp = g.map.spawn; g.player.place(sp.x * 0.55, sp.z * 0.55, g.map); face(Math.atan2(-sp.x, -sp.z) + (i - 1.5) * 0.5); lineUp(kinds, 4, dist); },
      (t, f) => {
        tough();
        cam(P().yaw + Math.PI + (i % 2 ? -0.7 : 0.7) + t * (i % 2 ? 0.15 : -0.15), 0.32, 9);
        if (f % 20 === 4) { const m = lineUp(kinds, 4, dist); if (m[0]) P().faceTowards(m[0].position.x, m[0].position.z); attack(skills[Math.floor(f / 20) % skills.length]); }
        say(t > 0.15 ? cap(name, low) : '');
      }]),
    [26, 30, () => { asJob('magician', 30, 'ruins'); face(0.6); lineUp(['skeletonMinion', 'skeletonWarrior', 'skeletonMage'], 5, 5); },
      (t, f) => { tough(); cam(P().yaw + Math.PI + 0.4 - t * 0.2, 0.12, 8); if (f % 24 === 6) { lineUp(['skeletonMinion', 'skeletonWarrior', 'skeletonMage'], 5, 5); attack(f % 48 === 6 ? 'thunderbolt' : 'magicClaw'); } say(t > 0.2 ? cap('5 maps · 13 monsters', '4 jobs · 16 skills · 6 quests') : ''); }],
    [30, 32, () => { asJob('thief', 20, 'henesys'); cine(false); g.player.place(-4.5, 11.2, g.map); P().faceTowards(-7, 11); ch().mesos = 12345; g.map.npcs.find(n => n.id === 'rina').onTap(); },
      t => { cam(P().yaw + Math.PI + 0.5, 0.45, 9); say(''); }],
    [32, 38, () => { document.querySelectorAll('.dialog button').forEach(b => b.textContent === 'Not now' && b.click()); cine(true); asJob('warrior', 20, 'henesys'); g.player.place(3, 11, g.map); face(0.8); },
      (t, f) => {
        tough();
        cam(0.8 + Math.PI + t * 0.15, lerp(0.75, 1.0, ease(Math.min(1, t / 4))), lerp(8, 15, ease(Math.min(1, t / 4))));
        if (f === 20 || f === 70) { P().vy = 7; P().onGround = false; }
        if (f === 110) { P().model.cheer?.(); g.fx.levelUp(g.map.scene, P()); }
        if (f === 0) sfx('jump');
        say(t > 3.9 ? card('HENESYS 3D', 'Play free in your phone browser') + '<div class="low pop" style="animation-delay:.3s">ofekbrener.github.io/Ofek/henesys-3d</div>' : t > 0.2 ? cap('Your adventure starts now', 'Quests · shop · gear upgrades') : '');
      }],
  ];

  let current = -1, sceneFrame = 0;
  window.TR = {
    frame(f) {
      now = f / 30;
      const i = SCENES.findIndex(s => now >= s[0] && now < s[1]);
      if (i !== current) { current = i; sceneFrame = 0; SCENES[i][2](); }
      SCENES[i][3](now - SCENES[i][0], sceneFrame++);
      g.engine.tick(dt, true);
    },
  };
});

const total = FPS * LENGTH;
for (let f = 0; f < total; f++) {
  await page.evaluate(f => window.TR.frame(f), f);
  if (f % EVERY === (EVERY > 1 ? 15 : 0)) await page.screenshot({ path: `${OUT}/frames/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  if (f % 60 === 0) console.log('frame', f, '/', total);
}
fs.writeFileSync(OUT + '/sfx.json', JSON.stringify(await page.evaluate(() => window.SFX)));
console.log('errors', errors);
await browser.close(); server.close();
