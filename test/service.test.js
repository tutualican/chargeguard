// Yapılandırma + arka plan mantığı (saf/dosya tabanlı).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('config: yaz / oku / açıkla', async () => {
  process.env.CG_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cgcfg-'));
  const { writeConfig, readConfig, describeConfig } = await import('../src/config.js?v=' + Date.now());
  assert.equal(readConfig(), null);
  writeConfig({ mode: 'hold', lo: 65, hi: 80 });
  assert.deepEqual(readConfig(), { mode: 'hold', lo: 65, hi: 80 });
  assert.equal(describeConfig(readConfig()), 'aralıkta tut 65-80');
  assert.equal(describeConfig(null), 'yok');
});

test('applyConfig: her modu doğru arka uca yönlendirir', async () => {
  const { applyConfig } = await import('../src/service.js');
  const calls = [];
  const app = {
    holdRange: (lo, hi) => { calls.push(['hold', lo, hi]); return { ok: true }; },
    stopAt: (p) => { calls.push(['stop', p]); return { ok: true }; },
    disable: () => { calls.push(['off']); return { ok: true }; },
    conserve: (on) => { calls.push(['conserve', on]); return { ok: true }; },
  };
  applyConfig(app, { mode: 'hold', lo: 65, hi: 80 });
  applyConfig(app, { mode: 'stop', pct: 90 });
  applyConfig(app, { mode: 'off' });
  applyConfig(app, { mode: 'conserve', on: true });
  applyConfig(app, { mode: 'bilinmeyen' });
  assert.deepEqual(calls, [['hold', 65, 80], ['stop', 90], ['off'], ['conserve', true]]);
});

test('needsReapply: sapmayı (drift) doğru algılar', async () => {
  const { needsReapply } = await import('../src/service.js');
  assert.equal(needsReapply({ mode: 'hold', lo: 65, hi: 80 }, { startThreshold: 65, endThreshold: 80, mode: 1 }), false);
  assert.equal(needsReapply({ mode: 'hold', lo: 65, hi: 80 }, { startThreshold: 60, endThreshold: 80, mode: 1 }), true);
  assert.equal(needsReapply({ mode: 'hold', lo: 65, hi: 80 }, { startThreshold: 65, endThreshold: 80, mode: 4 }), true);
  assert.equal(needsReapply({ mode: 'stop', pct: 90 }, { endThreshold: 90 }), false);
  assert.equal(needsReapply({ mode: 'stop', pct: 90 }, { endThreshold: 100 }), true);
});
