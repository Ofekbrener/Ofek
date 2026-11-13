// Renders tools/icon.svg into Android launcher icons.
// Usage: node tools/render-icon.js <creepster.woff2> [previewDir]
// Writes mipmap-*/ic_launcher.png + ic_launcher_round.png (legacy) and
// mipmap-*/ic_launcher_fg.png + ic_launcher_bg.png (adaptive layers, 108dp).
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');
const game = path.resolve(__dirname, '..');
const res = path.join(game, 'android/app/src/main/res');
const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const font = fs.readFileSync(process.argv[2]).toString('base64');
const preview = process.argv[3];
const DENS = {mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4};
// layer: 'all' | 'fg' | 'bg'; shape: 'square' | 'circle' | 'squircle'; crop: legacy icons show the middle 72/108
function page(layer, shape, crop) {
  const hide = layer === 'fg' ? '#background{display:none}' : layer === 'bg' ? '#foreground{display:none}' : '';
  const clip = shape === 'circle' ? 'border-radius:50%' : shape === 'squircle' ? 'border-radius:28%' : '';
  const k = crop ? 108 / 72 : 1;
  return `<html><head><style>@font-face{font-family:Creepster;src:url(data:font/woff2;base64,${font})}
  html,body{margin:0;background:transparent}${hide}
  .c{width:100vw;height:100vh;overflow:hidden;position:relative;${clip}}
  svg{position:absolute;width:${k * 100}vw;height:${k * 100}vh;left:${-(k - 1) * 50}vw;top:${-(k - 1) * 50}vh}</style></head>
  <body><div class="c">${svg}</div></body></html>`;
}
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  async function shot(file, size, layer, shape, crop) {
    await p.setViewportSize({width: size, height: size});
    await p.setContent(page(layer, shape, crop)); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({path: file, omitBackground: true});
  }
  for (const [d, m] of Object.entries(DENS)) {
    const dir = path.join(res, 'mipmap-' + d); fs.mkdirSync(dir, {recursive: true});
    await shot(path.join(dir, 'ic_launcher.png'), 48 * m, 'all', 'squircle', true);
    await shot(path.join(dir, 'ic_launcher_round.png'), 48 * m, 'all', 'circle', true);
    await shot(path.join(dir, 'ic_launcher_fg.png'), 108 * m, 'fg', 'square', false);
    await shot(path.join(dir, 'ic_launcher_bg.png'), 108 * m, 'bg', 'square', false);
  }
  if (preview) for (const s of ['circle', 'squircle', 'square']) await shot(path.join(preview, 'icon-' + s + '.png'), 288, 'all', s, true);
  await b.close();
})();
