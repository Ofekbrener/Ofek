import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Loads sw.js with fake service-worker globals and returns its fetch handler.
function loadSw({ cached, network }) {
  const handlers = {};
  const cache = { match: async () => cached, put: async () => {}, addAll: async () => {} };
  const self = { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } };
  const caches = { open: async () => cache, keys: async () => [], delete: async () => true };
  const fetch = async () => { if (network instanceof Error) throw network; return network; };
  new Function('self', 'caches', 'fetch', 'location', fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))(self, caches, fetch, { origin: 'https://x' });
  return req => new Promise(res => handlers.fetch({ request: req, respondWith: p => res(p) }));
}
const req = url => ({ method: 'GET', url });

test('online: the network copy wins over a cached old copy', async () => {
  const fresh = { ok: true, clone() { return this; }, tag: 'new' };
  const get = loadSw({ cached: { tag: 'old' }, network: fresh });
  assert.equal((await get(req('https://x/src/main.js'))).tag, 'new');
});

test('offline: the cached copy is served', async () => {
  const get = loadSw({ cached: { tag: 'old' }, network: new Error('offline') });
  assert.equal((await get(req('https://x/src/main.js'))).tag, 'old');
});
