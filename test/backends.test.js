// Arka uç davranışları (donanımsız, saf kısımlar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWinUnsupportedBackend } from '../src/backends/win-unsupported.js';
import { huaweiLimit } from '../src/wmi.js';

test('desteklenmeyen marka dürüst hata verir (yanlış "ok" yok)', () => {
  const b = createWinUnsupportedBackend({ brand: 'hp' });
  assert.deepEqual(b.capabilities(), { stopAt: false, range: false, behaviour: false, conservation: false, disable: false });
  assert.equal(b.stopAt(80).ok, false);
  assert.equal(b.holdRange(65, 70).ok, false);
  assert.equal(b.disable().ok, false);
  assert.match(b.getStatus().note, /BIOS|üretici/i);
});

test('Huawei limit komutu doğru kodlanır (mode=1, 0x48)', () => {
  assert.equal(huaweiLimit(65, 70), '03 15 01 48 41 46');
  assert.equal(huaweiLimit(95, 100), '03 15 01 48 5F 64');
  assert.equal(huaweiLimit(0, 255), '03 15 01 48 00 FF');
});
