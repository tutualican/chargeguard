// Linux sysfs arka ucunun mantığını, sahte bir sysfs ağacıyla (Linux'suz) test eder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgsys-'));
  const bat = path.join(root, 'BAT0');
  const ac = path.join(root, 'AC');
  fs.mkdirSync(bat);
  fs.mkdirSync(ac);
  fs.writeFileSync(path.join(bat, 'capacity'), '73');
  fs.writeFileSync(path.join(bat, 'status'), 'Discharging');
  fs.writeFileSync(path.join(bat, 'charge_control_start_threshold'), '0');
  fs.writeFileSync(path.join(bat, 'charge_control_end_threshold'), '100');
  fs.writeFileSync(path.join(bat, 'charge_behaviour'), 'auto');
  fs.writeFileSync(path.join(ac, 'online'), '1');
  return root;
}

test('linux-sysfs: durum, stop, range, kaldır', async () => {
  process.env.CG_SYSFS = setup();
  const { createLinuxSysfsBackend } = await import('../src/backends/linux-sysfs.js?v=' + Date.now());
  const b = createLinuxSysfsBackend();

  assert.ok(b, 'backend olusmali');
  assert.deepEqual(b.capabilities(), { stopAt: true, range: true, behaviour: true, disable: true });

  const s0 = b.getStatus();
  assert.equal(s0.percent, 73);
  assert.equal(s0.powerOnline, true);
  assert.equal(s0.charging, false);
  assert.equal(s0.endThreshold, 100);

  assert.equal(b.stopAt(80).ok, true);
  assert.equal(b.getStatus().endThreshold, 80);

  assert.equal(b.holdRange(65, 70).ok, true);
  assert.equal(b.getStatus().startThreshold, 65);
  assert.equal(b.getStatus().endThreshold, 70);

  assert.equal(b.disable().ok, true);
  assert.equal(b.getStatus().endThreshold, 100);
  assert.equal(b.getStatus().startThreshold, 0);
});

test('linux-sysfs: yetenek yoksa backend null', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgsys-'));
  fs.mkdirSync(path.join(root, 'BAT0'));
  fs.writeFileSync(path.join(root, 'BAT0', 'capacity'), '50');
  fs.writeFileSync(path.join(root, 'BAT0', 'status'), 'Full');
  process.env.CG_SYSFS = root;
  const { createLinuxSysfsBackend } = await import('../src/backends/linux-sysfs.js?v=' + Date.now());
  assert.equal(createLinuxSysfsBackend(), null);
});
