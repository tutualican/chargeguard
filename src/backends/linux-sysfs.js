// Linux jenerik sysfs arka ucu.
// Çoğu markayı ortak /sys/class/power_supply/BAT*/charge_control_* dosyalarıyla kapsar.
import fs from 'node:fs';
import path from 'node:path';

// Test/geliştirme için CG_SYSFS ile sahte bir sysfs kökü verilebilir.
const PS = process.env.CG_SYSFS || '/sys/class/power_supply';

function listDirs() { try { return fs.readdirSync(PS); } catch { return []; } }
function read(p) { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function pick(base, names) { for (const n of names) { const p = path.join(base, n); if (exists(p)) return p; } return null; }

// Sürücüden sürücüye küçük ad farkları olabilir (thinkpad/acpi vs. jenerik).
const END_NAMES = ['charge_control_end_threshold', 'charge_stop_threshold'];
const START_NAMES = ['charge_control_start_threshold', 'charge_start_threshold'];
const BEH_NAMES = ['charge_behaviour'];
function write(p, v) {
  try { fs.writeFileSync(p, String(v)); return { ok: true }; }
  catch (e) {
    return { ok: false, error: e.code === 'EACCES' ? 'root/yönetici yetkisi gerekli' : (e.message || String(e)) };
  }
}

function batteryDir() {
  for (const d of listDirs()) {
    if (!d.startsWith('BAT')) continue;
    const base = path.join(PS, d);
    if (exists(path.join(base, 'capacity'))) return base;
  }
  return null;
}

function acOnline() {
  for (const d of listDirs()) {
    if (d.startsWith('AC') || d.startsWith('ADP')) {
      const o = read(path.join(PS, d, 'online'));
      if (o !== null) return o === '1';
    }
  }
  return null;
}

export function createLinuxSysfsBackend() {
  const base = batteryDir();
  if (!base) return null;

  const endP = pick(base, END_NAMES);
  const startP = pick(base, START_NAMES);
  const behP = pick(base, BEH_NAMES);

  if (!exists(endP) && !exists(behP)) return null;

  const num = (p) => { const v = exists(p) ? read(p) : null; return v === null ? null : Number(v); };

  return {
    id: 'linux-sysfs',
    os: 'linux',
    brand: 'generic',
    path: base,

    capabilities() {
      return {
        stopAt: exists(endP),
        range: exists(endP) && exists(startP),
        behaviour: exists(behP),
        disable: exists(endP) || exists(behP),
      };
    },

    getStatus() {
      const status = read(path.join(base, 'status'));
      return {
        percent: num(path.join(base, 'capacity')),
        status,
        powerOnline: acOnline(),
        charging: status === 'Charging',
        discharging: status === 'Discharging',
        startThreshold: num(startP),
        endThreshold: num(endP),
        behaviour: exists(behP) ? read(behP) : null,
      };
    },

    stopAt(pct) {
      if (!exists(endP)) return { ok: false, error: 'charge_control_end_threshold yok' };
      return write(endP, pct);
    },

    holdRange(lo, hi) {
      if (!exists(endP)) return { ok: false, error: 'charge_control_end_threshold yok' };
      if (exists(startP)) {
        const a = write(startP, lo);
        if (!a.ok) return a;
      }
      return write(endP, hi);
    },

    disable() {
      if (exists(behP) && !exists(endP)) return write(behP, 'auto');
      const r = write(endP, 100);
      if (r.ok && exists(startP)) write(startP, 0);
      return r;
    },
  };
}
