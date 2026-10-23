// Screenshots every model in preview.html and soaks each animation state.
// Run: node henesys-3d/tests/preview-shots.mjs <outDir> [id ...]
import fs from 'node:fs';
import { serve, launch, sleep, check } from './browser.mjs';

const out = process.argv[2] || '/tmp/henesys-models';
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const server = await serve(8124);
const { browser, page, errors } = await launch();
try {
  await page.goto('http://localhost:8124/preview.html');
  await page.waitForFunction(() => window.__preview, null, { timeout: 15000 });
  const ids = only.length ? only : await page.evaluate(() => window.__preview.ids);
  for (const id of ids) {
    await page.evaluate(id => window.__preview.show(id), id);
    await sleep(400);
    await page.screenshot({ path: `${out}/${id}.png` });
    const states = await page.evaluate(() => window.__preview.ids && ['idle', 'move', 'walk', 'jump', 'attack']);
    for (const st of states) {
      const ok = await page.evaluate(([st]) => { window.__preview.hit(); return window.__preview.soak(st, 2); }, [st]);
      check(ok, `${id} ${st}: positions finite`);
    }
    await page.evaluate(id => { window.__preview.show(id); return window.__preview.soak('die', 1); }, id);
  }
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('PREVIEW OK');
} finally {
  await browser.close(); server.close();
}
