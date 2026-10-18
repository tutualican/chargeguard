// Linux EVRENSEL şarj-sınırı arka ucu.
//
// Amaç: "her dizüstü" — çekirdek ortak sysfs standardını kullanan tüm sürücüleri
// tek arka uçta toplar. Sabit isim listesine bağlı kalmaz; pil dizinindeki ve
// marka platform dizinlerindeki şarj denetim dosyalarını TARAYARAK bulur.
//
// Desteklenen aileler (bulunanı kullanır):
//   • charge_control_end_threshold / charge_stop_threshold   (eşik: stop / hi)
//   • charge_control_start_threshold / charge_start_threshold (eşik: lo)
//   • charge_behaviour          (auto | inhibit-charge | force-discharge)
//   • conservation_mode         (IdeaPad: 0/1)
//   • battery_care_limit        (lg-laptop: 80/100)
//
// Test/geliştirme: CG_SYSFS (pil kökü) ve CG_SYSFS_EXTRA (platform kökleri, ayraçlı).
import fs from 'node:fs';
import path from 'node:path';

const PS = process.env.CG_SYSFS || '/sys/class/power_supply';
const TEST_MODE = !!process.env.CG_SYSFS;
const EXTRA = process.env.CG_SYSFS_EXTRA
  ? process.env.CG_SYSFS_EXTRA.split(path.delimiter).filter(Boolean)
  : (TEST_MODE ? [] : [
    '/sys/devices/platform/lg-laptop',
    '/sys/bus/platform/devices/ideapad_laptop',
    '/sys/devices/platform/ideapad-laptop',
    '/sys/devices/platform/system76',
    '/sys/devices/platform/system76_acpi',
  ]);

const END_NAMES = ['charge_control_end_threshold', 'charge_stop_threshold', 'charge_end_threshold'];
const START_NAMES = ['charge_control_start_threshold', 'charge_start_threshold', 'charge_start_threshold_percent'];
const BEH_NAMES = ['charge_behaviour', 'charge_behavior'];
const CONS_NAMES = ['conservation_mode', 'battery_conservation_mode', 'conservation_charge'];
const CARE_NAMES = ['battery_care_limit'];

function listDirs(p) { try { return fs.readdirSync(p); } catch { return []; } }
function read(p) { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function pick(base, names) {
  for (const n of names) { const p = path.join(base, n); if (exists(p)) return p; }
  return null;
}
function pickExtra(names) {
  for (const root of EXTRA) {
    for (const n of names) { const p = path.join(root, n); if (exists(p)) return p; }
  }
  return null;
}
function write(p, v) {
  if (!p) return { ok: false, error: 'denetim dosyası yok' };
  try { fs.writeFileSync(p, String(v)); return { ok: true }; }
  catch (e) {
    return { ok: false, error: e.code === 'EACCES' || e.code === 'EPERM' ? 'root/yönetici yetkisi gerekli' : (e.message || String(e)) };
  }
}

function batteryDir() {
  for (const d of listDirs(PS)) {
    if (!d.startsWith('BAT')) continue;
    const base = path.join(PS, d);
    if (exists(path.join(base, 'capacity'))) return base;
  }
  return null;
}

function acOnline() {
  for (const d of listDirs(PS)) {
    if (d.startsWith('AC') || d.startsWith('ADP') || d.startsWith('ACAD')) {
      const o = read(path.join(PS, d, 'online'));
      if (o !== null) return o === '1';
    }
  }
  return null;
}

export function createLinuxSysfsBackend() {
  const base = batteryDir();
  if (!base) return null;

  // Denetim dosyalarını bul (pil dizini + marka platform dizinleri).
  const endP = pick(base, END_NAMES) || pickExtra(END_NAMES);
  const startP = pick(base, START_NAMES) || pickExtra(START_NAMES);
  const behP = pick(base, BEH_NAMES) || pickExtra(BEH_NAMES);
  const consP = pick(base, CONS_NAMES) || pickExtra(CONS_NAMES);
  const careP = pick(base, CARE_NAMES) || pickExtra(CARE_NAMES);

  // Hiçbir denetim yoksa bu arka uç işe yaramaz.
  if (!endP && !behP && !consP && !careP) return null;

  const num = (p) => { const v = p && exists(p) ? read(p) : null; return v === null ? null : Number(v); };

  // battery_care_limit: yalnızca 80/100 anlamlı (lg-laptop).
  const careToLimit = (pct) => (pct <= 80 ? 80 : 100);

  return {
    id: 'linux-sysfs',
    os: 'linux',
    brand: 'generic',
    path: base,
    control: { endP, startP, behP, consP, careP },

    capabilities() {
      const hasEnd = !!endP;
      return {
        stopAt: hasEnd || !!behP || !!careP || !!consP,
        range: hasEnd && !!startP,
        behaviour: !!behP,
        conservation: !!consP,
        disable: hasEnd || !!behP || !!careP || !!consP,
      };
    },

    getStatus() {
      const status = read(path.join(base, 'status'));
      const capacities = read(path.join(base, 'capacity'));
      const bev = behP ? read(behP) : null;
      return {
        percent: capacities === null ? null : Number(capacities),
        status,
        powerOnline: acOnline(),
        charging: status === 'Charging',
        discharging: status === 'Discharging',
        startThreshold: num(startP),
        endThreshold: hasEndNum(endP) ? num(endP) : null,
        behaviour: bev,
        conservation: consP ? (num(consP) === 1) : null,
        careLimit: careP ? num(careP) : null,
      };
    },

    stopAt(pct) {
      if (endP) return write(endP, pct);
      if (careP) return write(careP, careToLimit(pct));
      if (behP) return write(behP, pct < 100 ? 'inhibit-charge' : 'auto');
      if (consP) return write(consP, 1);
      return { ok: false, error: 'durak noktası desteklenmiyor' };
    },

    holdRange(lo, hi) {
      if (endP) {
        if (startP) { const a = write(startP, lo); if (!a.ok) return a; }
        return write(endP, hi);
      }
      if (careP) return write(careP, careToLimit(hi));
      if (behP) return write(behP, 'inhibit-charge');
      if (consP) return write(consP, 1);
      return { ok: false, error: 'aralık desteklenmiyor' };
    },

    disable() {
      const ops = [];
      if (endP) ops.push(write(endP, 100));
      if (startP) ops.push(write(startP, 0));
      if (careP) ops.push(write(careP, 100));
      if (behP) ops.push(write(behP, 'auto'));
      if (consP) ops.push(write(consP, 0));
      const failed = ops.find((o) => !o.ok);
      return failed || { ok: true };
    },

    conserve(on) {
      if (!consP) return { ok: false, error: 'koruma modu yok' };
      return write(consP, on ? 1 : 0);
    },
  };
}

function hasEndNum(p) { return !!p && exists(p); }
