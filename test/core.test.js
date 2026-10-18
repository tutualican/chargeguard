// Çekirdek mantığı: doğrulama + yetenek indirgeme. Sahte backend ile test edilir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from '../src/core.js';

function fakeBackend(caps) {
  const state = { ended: null, started: null, conserved: null };
  return {
    id: 'fake', os: 'linux', brand: 'test',
    _state: state,
    capabilities: () => caps,
    getStatus: () => ({ percent: 60, powerOnline: true, charging: false, startThreshold: state.started, endThreshold: state.ended, mode: null, conservation: state.conserved }),
    stopAt: (p) => { state.ended = p; return { ok: true }; },
    holdRange: (lo, hi) => { state.started = lo; state.ended = hi; return { ok: true }; },
    conserve: (on) => { state.conserved = on; return { ok: true }; },
    disable: () => { state.ended = 100; return { ok: true }; },
  };
}

const dev = { os: 'linux', brand: 'test' };

test('doğrulama: aralık dışı ve ters değerler reddedilir', () => {
  const b = fakeBackend({ stopAt: true, range: true, disable: true });
  const app = open({ device: dev, backend: b });
  assert.equal(app.stopAt(30).ok, false);      // < 40
  assert.equal(app.stopAt(120).ok, false);     // > 100
  assert.equal(app.holdRange(70, 65).ok, false); // lo >= hi
  assert.equal(app.stopAt(80).ok, true);
  assert.equal(b._state.ended, 80);
});

test('aralık yoksa sadece üst eşik uygulanır (indirgeme)', () => {
  const b = fakeBackend({ stopAt: true, range: false, disable: true });
  const app = open({ device: dev, backend: b });
  const r = app.holdRange(65, 70);
  assert.equal(r.ok, true);
  assert.equal(b._state.ended, 70);
  assert.ok(r.reduced, 'indirgeme bildirilmeli');
});

test('stopAt yoksa net hata', () => {
  const b = fakeBackend({ stopAt: false, range: false, disable: true });
  const app = open({ device: dev, backend: b });
  assert.equal(app.stopAt(80).ok, false);
  assert.match(app.stopAt(80).error, /desteklemiyor/i);
});

test('koruma modu (conserve)', () => {
  const b = fakeBackend({ stopAt: false, range: false, conservation: true, disable: true });
  const app = open({ device: dev, backend: b });
  assert.equal(app.conserve(true).ok, true);
  assert.equal(b._state.conserved, true);
});

test('arka uç yoksa açık hata', () => {
  const app = open({ device: { os: 'win32', brand: 'hp' }, backend: null });
  assert.equal(app.stopAt(80).ok, false);
  assert.match(app.stopAt(80).error, /desteklen/i);
  assert.equal(app.status(), null);
  assert.deepEqual(app.capabilities(), { stopAt: false, range: false, behaviour: false, conservation: false, disable: false });
});
