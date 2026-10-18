// İzleyici mantığı (saf) — histerezis döngüsü kanıtı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, createTracker } from '../src/watch.js';

const st = (percent, charging) => ({ percent, charging, powerOnline: true });

test('classify: ilk örnek sessizdir (baseline)', () => {
  assert.deepEqual(classify(null, st(50, false), { lo: 65, hi: 80 }), []);
});

test('classify: eşik geçişleri ve şarj değişimi', () => {
  const evs = classify(st(70, true), st(80, true), { lo: 65, hi: 80 });
  assert.deepEqual(evs.map((e) => e.type), ['high']);
  const evs2 = classify(st(80, true), st(79, false), { lo: 65, hi: 80 });
  assert.deepEqual(evs2.map((e) => e.type), ['charge-stop']);
});

test('TAM DÖNGÜ kanıtlanır: hi durur → lo başlar', () => {
  const tr = createTracker({ lo: 65, hi: 80 });
  tr.tick(st(55, false)); // baseline
  tr.tick(st(70, true));  // şarj başladı (lo üstünde, kanıt sayılmaz)
  tr.tick(st(80, true));  // hi'ye ulaştı, hâlâ şarj ediyor
  tr.tick(st(79, false)); // DURDU (>= hi-1)  → stoppedAtHigh
  tr.tick(st(70, false)); // düşüyor
  tr.tick(st(65, true));  // YENİDEN BAŞLADI (<= lo+1) → resumedAtLow
  const s = tr.summary();
  assert.equal(s.stoppedAtHigh, true);
  assert.equal(s.resumedAtLow, true);
  assert.equal(s.cycleComplete, true);
  assert.equal(s.min, 55);
  assert.equal(s.max, 80);
  assert.equal(s.samples, 6);
});

test('yalnızca DURMA görülürse döngü tamam sayılmaz', () => {
  const tr = createTracker({ lo: 65, hi: 80 });
  tr.tick(st(70, true));
  tr.tick(st(81, false)); // hi üstünde durdu
  const s = tr.summary();
  assert.equal(s.stoppedAtHigh, true);
  assert.equal(s.resumedAtLow, false);
  assert.equal(s.cycleComplete, false);
});

test('yalnızca BAŞLAMA görülürse döngü tamam sayılmaz', () => {
  const tr = createTracker({ lo: 65, hi: 80 });
  tr.tick(st(64, false)); // baseline, lo altında
  tr.tick(st(65, true));  // lo civarında şarj başladı → resumedAtLow
  const s = tr.summary();
  assert.equal(s.resumedAtLow, true);
  assert.equal(s.stoppedAtHigh, false);
  assert.equal(s.cycleComplete, false);
});

test('zaman damgası enjekte edilir', () => {
  let t = 1000;
  const tr = createTracker({ lo: 65, hi: 80, now: () => (t += 500) });
  tr.tick(st(70, true));
  tr.tick(st(80, true));
  const s = tr.summary();
  assert.equal(s.events[0].type, 'high');
  assert.equal(s.events[0].at, 2000);
});
