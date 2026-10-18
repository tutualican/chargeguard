// JSON API — sahte app ile gerçek HTTP üzerinden test (donanımsız).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serve } from '../src/server.js';

function fakeApp() {
  const calls = [];
  return {
    calls,
    device: { os: 'linux', brand: 'test' },
    backend: 'fake',
    capabilities: () => ({ stopAt: true, range: true, behaviour: false, conservation: false, disable: true }),
    status: () => ({ percent: 50, charging: false }),
    stopAt: (p) => { calls.push(['stop', p]); return { ok: true, applied: p }; },
    holdRange: (lo, hi) => { calls.push(['hold', lo, hi]); return { ok: true }; },
    conserve: (on) => { calls.push(['conserve', on]); return { ok: true }; },
    disable: () => { calls.push(['off']); return { ok: true }; },
  };
}

async function withServer(app, fn) {
  const server = serve({ app, port: 0, quiet: true });
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, app); } finally { await new Promise((r) => server.close(r)); }
}

const jpost = (base, p, b) => fetch(base + p, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
});

test('GET uçları: device/caps/status + 404', async () => {
  await withServer(fakeApp(), async (base) => {
    assert.equal((await (await fetch(base + '/device')).json()).brand, 'test');
    assert.equal((await (await fetch(base + '/caps')).json()).backend, 'fake');
    assert.equal((await (await fetch(base + '/status')).json()).percent, 50);
    assert.equal((await fetch(base + '/bilinmeyen')).status, 404);
  });
});

test('POST uçları doğru değerleri iletir', async () => {
  const app = fakeApp();
  await withServer(app, async (base) => {
    assert.equal((await (await jpost(base, '/stop', { pct: 80 })).json()).applied, 80);
    assert.equal((await (await jpost(base, '/hold', { lo: 65, hi: 70 })).json()).ok, true);
    assert.equal((await (await jpost(base, '/conserve', { on: true })).json()).ok, true);
    assert.equal((await (await jpost(base, '/off', {})).json()).ok, true);
    assert.deepEqual(app.calls, [['stop', 80], ['hold', 65, 70], ['conserve', true], ['off']]);
  });
});
