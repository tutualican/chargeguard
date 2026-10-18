// Linux TLP arka ucu — komut üretimi, durum okuma ve hata eşleme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLinuxTlpBackend, mapTlpError } from '../src/backends/linux-tlp.js';

function fakeBattery() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgtlp-'));
  const bat = path.join(root, 'BAT0');
  fs.mkdirSync(bat);
  fs.writeFileSync(path.join(bat, 'capacity'), '72');
  fs.writeFileSync(path.join(bat, 'status'), 'Charging');
  fs.writeFileSync(path.join(bat, 'charge_control_start_threshold'), '65');
  fs.writeFileSync(path.join(bat, 'charge_control_end_threshold'), '80');
  return bat;
}

test('tlp: holdRange/stopAt/off doğru setcharge komutlarını üretir', () => {
  const calls = [];
  const runner = (args) => { calls.push(args); return { ok: true, out: '' }; };
  const b = createLinuxTlpBackend({ runner, batteryDir: fakeBattery() });
  assert.ok(b);
  assert.equal(b.id, 'linux-tlp');

  assert.equal(b.holdRange(65, 80).ok, true);
  assert.equal(b.stopAt(75).ok, true);
  assert.equal(b.disable().ok, true);

  assert.deepEqual(calls, [
    ['setcharge', '65', '80'],
    ['setcharge', '0', '75'],
    ['setcharge', 'off'],
  ]);
});

test('tlp: yetenekler stopAt + range + disable', () => {
  const b = createLinuxTlpBackend({ runner: () => ({ ok: true }), batteryDir: fakeBattery() });
  assert.deepEqual(b.capabilities(), {
    stopAt: true, range: true, behaviour: false, conservation: false, disable: true,
  });
});

test('tlp: durum sysfs üzerinden okunur (eşikler dahil)', () => {
  const b = createLinuxTlpBackend({ runner: () => ({ ok: true }), batteryDir: fakeBattery() });
  const s = b.getStatus();
  assert.equal(s.percent, 72);
  assert.equal(s.charging, true);
  assert.equal(s.startThreshold, 65);
  assert.equal(s.endThreshold, 80);
  assert.match(s.note, /TLP/);
});

test('tlp: runner yoksa (TLP kurulu değil) backend null', () => {
  assert.equal(createLinuxTlpBackend({ runner: null, batteryDir: fakeBattery() }), null);
});

test('tlp: hata mesajları anlaşılır biçime çevrilir', () => {
  assert.match(mapTlpError('Error: You must be root to run this.'), /root/i);
  assert.match(mapTlpError('Unknown command setcharge'), /setcharge/i);
  assert.equal(mapTlpError('birinci satır\nikinci'), 'birinci satır');
});
