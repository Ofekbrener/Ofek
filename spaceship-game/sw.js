// Offline support. Network-first so players always get the latest release when
// online; the cache is only a fallback for offline play. Bump VERSION on release.
const VERSION = 'void-runner-v13';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './skin.css',
  './themes.css',
  './fonts/bangers.woff2',
  './fonts/righteous.woff2',
  './src/coco.js',
  './fonts/lilita-one.woff2',
  './fonts/fredoka.woff2',
  './src/icons.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three.module.min.js',
  './src/main.js',
  './src/config.js',
  './src/renderer.js',
  './src/lighting.js',
  './src/environment.js',
  './src/worlds.js',
  './src/ship.js',
  './src/ship-preview.js',
  './src/obstacles.js',
  './src/particles.js',
  './src/fx.js',
  './src/hud.js',
  './src/input.js',
  './src/audio.js',
  './src/haptics.js',
  './src/storage.js',
  './src/pickups.js',
  './src/progression.js',
  './src/hangar-ui.js',
  './src/geo.js',
  './src/galaxies.js',
  './src/journey.js',
  './src/chickens.js',
  './src/boss.js',
  './src/starmap-ui.js',
  './src/ftue.js',
  './src/race/leagues.js',
  './src/race/track.js',
  './src/race/race.js',
  './src/race/race-ui.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' bypasses the browser HTTP cache so we never pre-cache stale files.
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
