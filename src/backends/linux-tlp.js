// Linux TLP arka ucu — TLP kurulu sistemlerde eşikleri `tlp setcharge` ile yönetir.
//
// TLP (https://linrunner.de/tlp/) Linux'ta güç yönetimi standardıdır ve
// şarj eşiklerini `tlp setcharge <start> <stop> [BATn]` ile ayarlar.
// `tlp setcharge off` eşikleri kaldırır (tam şarja döner).
//
// Neden ayrı arka uç?
//   • TLP, askıya alma/açılışta eşikleri kendisi yeniden uygular.
//   • Bazı modellerde TLP, jenerik sysfs'in göremediği üretici yolunu kullanır.
//
// Seçim: `chargeguard --backend tlp ...` veya CG_BACKEND=tlp.
// (Otomatik modda jenerik sysfs yoksa TLP son çare olarak denenir.)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PS = process.env.CG_SYSFS || '/sys/class/power_supply';

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function read(p) { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } }
function listDirs(p) { try { return fs.readdirSync(p); } catch { return []; } }

// TLP ikilisini bul (test için CG_TLP ile ezilebilir).
export function findTlp() {
  if (process.env.CG_TLP) return process.env.CG_TLP;
  for (const p of ['/usr/sbin/tlp', '/usr/bin/tlp', '/sbin/tlp', '/bin/tlp']) {
    if (exists(p)) return p;
  }
  for (const d of String(process.env.PATH || '').split(path.delimiter)) {
    if (!d) continue;
    const p = path.join(d, 'tlp');
    if (exists(p)) return p;
  }
  return null;
}

// TLP hata çıktısını kullanıcıya anlaşılır biçime çevirir (saf; test edilebilir).
export function mapTlpError(raw) {
  const s = String(raw || '');
  if (/permission|must be root|root privileges|access denied|superuser|erişim engellendi/i.test(s)) {
    return 'root/yönetici yetkisi gerekli';
  }
  if (/unknown|invalid|unrecognized|usage:/i.test(s)) {
    return 'TLP bu sürümde `setcharge` desteklemiyor (TLP >= 1.3 gerekir)';
  }
  return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || 'TLP hatası';
}

function defaultRunner(tlp) {
  return (args) => {
    try {
      const out = execFileSync(tlp, args, {
        encoding: 'utf8', windowsHide: true, timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { ok: true, out: String(out || '').trim() };
    } catch (e) {
      const raw = String((e && (e.stderr || e.stdout || e.message)) || e);
      return { ok: false, error: mapTlpError(raw) };
    }
  };
}

function batteryDir() {
  for (const d of listDirs(PS)) {
    if (!d.startsWith('BAT')) continue;
    const b = path.join(PS, d);
    if (exists(path.join(b, 'capacity'))) return b;
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

function thresholds(base) {
  if (!base) return { start: null, end: null };
  const pick = (...names) => {
    for (const n of names) { const p = path.join(base, n); if (exists(p)) return read(p); }
    return null;
  };
  const end = pick('charge_control_end_threshold', 'charge_stop_threshold', 'charge_end_threshold');
  const start = pick('charge_control_start_threshold', 'charge_start_threshold');
  return { start: start === null ? null : Number(start), end: end === null ? null : Number(end) };
}

// doctor / `chargeguard tlp` için TLP bilgisi.
export function tlpInfo() {
  const p = findTlp();
  if (!p) return { installed: false };
  let version = null;
  try {
    version = String(execFileSync(p, ['--version'], {
      encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
    }) || '').trim().split(/\r?\n/)[0] || null;
  } catch { /* sürüm okunamadı; önemli değil */ }
  return { installed: true, path: p, version };
}

export function createLinuxTlpBackend(opts = {}) {
  const tlp = opts.tlpPath || findTlp();
  // Testler `runner: null` ile "TLP yok" durumunu deterministik olarak kurar.
  const runner = 'runner' in opts ? opts.runner : (tlp ? defaultRunner(tlp) : null);
  if (!runner) return null;

  const base = opts.batteryDir || batteryDir();

  const status = () => {
    const b = base || batteryDir();
    const th = thresholds(b);
    const st = b ? read(path.join(b, 'status')) : null;
    const cap = b ? read(path.join(b, 'capacity')) : null;
    return {
      percent: cap === null ? null : Number(cap),
      status: st,
      powerOnline: acOnline(),
      charging: st === 'Charging',
      discharging: st === 'Discharging',
      startThreshold: th.start,
      endThreshold: th.end,
      note: 'TLP (`tlp setcharge`)',
    };
  };

  return {
    id: 'linux-tlp',
    os: 'linux',
    brand: 'generic',
    tlpPath: tlp,
    path: base,

    capabilities() {
      return { stopAt: true, range: true, behaviour: false, conservation: false, disable: true };
    },

    getStatus() { return status(); },

    // `tlp setcharge 0 <stop>` → <stop>'ta durdur (alt eşik yok).
    stopAt(pct) { return runner(['setcharge', '0', String(pct)]); },

    // `tlp setcharge <start> <stop>` → aralıkta tut.
    holdRange(lo, hi) { return runner(['setcharge', String(lo), String(hi)]); },

    // `tlp setcharge off` → eşikleri kaldır (tam şarj).
    disable() { return runner(['setcharge', 'off']); },
  };
}
