// Offline support: pre-cache the game shell, then serve cache-first while
// refreshing in the background (stale-while-revalidate). Bump VERSION on release.
const VERSION = 'void-runner-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
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
  './src/ship.js',
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
  './src/race/leagues.js',
  './src/race/track.js',
  './src/race/race.js',
  './src/race/race-ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
