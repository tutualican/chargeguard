// doctor: saf hüküm + rehber mantığı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictFor, guidanceFor } from '../src/doctor.js';

const full = { stopAt: true, range: true, behaviour: false, conservation: false, disable: true };
const none = { stopAt: false, range: false, behaviour: false, conservation: false, disable: false };

test('verdict: bilinen ve yetenekli arka uç → CALISIYOR', () => {
  assert.equal(verdictFor('linux-sysfs', full), 'CALISIYOR');
  assert.equal(verdictFor('win-huawei', { stopAt: true }), 'CALISIYOR');
});

test('verdict: arka uç yok → DESTEKLENMIYOR', () => {
  assert.equal(verdictFor(null, none), 'DESTEKLENMIYOR');
  assert.equal(verdictFor('win-unsupported', none), 'DESTEKLENMIYOR');
});

test('guidance: Linux + sysfs → hold önerir', () => {
  const g = guidanceFor({ os: 'linux', brand: 'generic' }, 'linux-sysfs', full);
  assert.ok(g.join(' ').includes('hold'));
});

test('guidance: Windows bilinmeyen marka → BIOS/üretici yönlendirmesi', () => {
  const g = guidanceFor({ os: 'win32', brand: 'hp' }, null, none);
  const t = g.join(' ');
  assert.match(t, /BIOS|HP/i);
  assert.match(t, /WMI/);
});

test('guidance: macOS → optimize şarj notu', () => {
  const g = guidanceFor({ os: 'darwin', brand: 'apple' }, null, none);
  assert.match(g.join(' '), /macOS/);
});
