// Linux EVRENSEL sysfs arka ucu — çok senaryolu sahte sysfs ağaçlarıyla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'cgsys-')); }

async function load() {
  return import('../src/backends/linux-sysfs.js?v=' + Math.random());
}

function baseTree() {
  const root = tmp();
  const bat = path.join(root, 'BAT0');
  const ac = path.join(root, 'AC');
  fs.mkdirSync(bat); fs.mkdirSync(ac);
  fs.writeFileSync(path.join(bat, 'capacity'), '73');
  fs.writeFileSync(path.join(bat, 'status'), 'Discharging');
  fs.writeFileSync(path.join(ac, 'online'), '1');
  return { root, bat };
}

test('sysfs: start+end+behaviour (tam yetenek)', async () => {
  const { root, bat } = baseTree();
  fs.writeFileSync(path.join(bat, 'charge_control_start_threshold'), '0');
  fs.writeFileSync(path.join(bat, 'charge_control_end_threshold'), '100');
  fs.writeFileSync(path.join(bat, 'charge_behaviour'), 'auto');
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  const b = createLinuxSysfsBackend();

  assert.deepEqual(b.capabilities(), { stopAt: true, range: true, behaviour: true, conservation: false, disable: true });
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

test('sysfs: yalnızca end (stop, aralık yok)', async () => {
  const { root, bat } = baseTree();
  fs.writeFileSync(path.join(bat, 'charge_control_end_threshold'), '90');
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  const b = createLinuxSysfsBackend();
  assert.deepEqual(b.capabilities(), { stopAt: true, range: false, behaviour: false, conservation: false, disable: true });
  assert.equal(b.stopAt(75).ok, true);
  assert.equal(b.getStatus().endThreshold, 75);
});

test('sysfs: ThinkPad charge_stop_threshold adı da tanınır', async () => {
  const { root, bat } = baseTree();
  fs.writeFileSync(path.join(bat, 'charge_start_threshold'), '60');
  fs.writeFileSync(path.join(bat, 'charge_stop_threshold'), '80');
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  const b = createLinuxSysfsBackend();
  assert.equal(b.capabilities().range, true);
  assert.equal(b.holdRange(55, 85).ok, true);
  assert.equal(b.getStatus().startThreshold, 55);
  assert.equal(b.getStatus().endThreshold, 85);
});

test('sysfs: yalnızca charge_behaviour (şarjı engelle)', async () => {
  const { root, bat } = baseTree();
  fs.writeFileSync(path.join(bat, 'charge_behaviour'), 'auto');
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  const b = createLinuxSysfsBackend();
  assert.equal(b.capabilities().behaviour, true);
  assert.equal(b.capabilities().stopAt, true);
  assert.equal(b.stopAt(80).ok, true);
  assert.equal(b.getStatus().behaviour, 'inhibit-charge');
  assert.equal(b.disable().ok, true);
  assert.equal(b.getStatus().behaviour, 'auto');
});

test('sysfs: conservation_mode (IdeaPad tarzı, pil dizininde)', async () => {
  const { root, bat } = baseTree();
  fs.writeFileSync(path.join(bat, 'conservation_mode'), '0');
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  const b = createLinuxSysfsBackend();
  assert.equal(b.capabilities().conservation, true);
  assert.equal(b.conserve(true).ok, true);
  assert.equal(b.getStatus().conservation, true);
});

test('sysfs: battery_care_limit (lg-laptop) ek platform kökünde', async () => {
  const { root, bat } = baseTree();
  fs.writeFileSync(path.join(bat, 'capacity'), '50');
  const extra = tmp();
  fs.writeFileSync(path.join(extra, 'battery_care_limit'), '100');
  process.env.CG_SYSFS = root; process.env.CG_SYSFS_EXTRA = extra;
  const { createLinuxSysfsBackend } = await load();
  const b = createLinuxSysfsBackend();
  assert.equal(b.capabilities().stopAt, true);
  assert.equal(b.stopAt(80).ok, true);
  assert.equal(b.getStatus().careLimit, 80);
  assert.equal(b.stopAt(95).ok, true);
  assert.equal(b.getStatus().careLimit, 100);
  delete process.env.CG_SYSFS_EXTRA;
});

test('sysfs: hiç denetim yoksa backend null', async () => {
  const { root } = baseTree();
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  assert.equal(createLinuxSysfsBackend(), null);
});

test('sysfs: pil dizini yoksa backend null', async () => {
  const root = tmp();
  process.env.CG_SYSFS = root; delete process.env.CG_SYSFS_EXTRA;
  const { createLinuxSysfsBackend } = await load();
  assert.equal(createLinuxSysfsBackend(), null);
});
