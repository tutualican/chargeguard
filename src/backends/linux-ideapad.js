// Linux IdeaPad "koruma modu" (conservation_mode) arka ucu.
// Lenovo IdeaPad'lerde eşik yerine mantıksal bir mod: 1 = ~%60-80 sabit, 0 = normal.
import fs from 'node:fs';
import path from 'node:path';

function candidates() {
  const out = [];
  if (process.env.CG_IDEAPAD_PATH) out.push(process.env.CG_IDEAPAD_PATH);
  out.push('/sys/bus/platform/devices/ideapad_laptop/conservation_mode');
  try {
    const base = '/sys/bus/platform/drivers/ideapad_acpi';
    for (const d of fs.readdirSync(base)) {
      if (d.includes(':')) out.push(path.join(base, d, 'conservation_mode'));
    }
  } catch { /* yok */ }
  return out;
}

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function battRead(file) {
  try { return fs.readFileSync(path.join('/sys/class/power_supply', 'BAT0', file), 'utf8').trim(); } catch { return null; }
}
function acOnline() {
  try {
    for (const d of fs.readdirSync('/sys/class/power_supply')) {
      if (d.startsWith('AC') || d.startsWith('ADP')) {
        try { return fs.readFileSync(path.join('/sys/class/power_supply', d, 'online'), 'utf8').trim() === '1'; } catch { /* devam */ }
      }
    }
  } catch { /* yok */ }
  return null;
}

export function createLinuxIdeapadBackend() {
  const p = candidates().find(exists);
  if (!p) return null;

  const read = () => { try { return Number(fs.readFileSync(p, 'utf8').trim()); } catch { return null; } };
  const write = (v) => {
    try { fs.writeFileSync(p, String(v)); return { ok: true }; }
    catch (e) { return { ok: false, error: e.code === 'EACCES' ? 'root/yönetici yetkisi gerekli' : (e.message || String(e)) }; }
  };
  const cap = battRead('capacity');
  const status = battRead('status');

  return {
    id: 'linux-ideapad',
    os: 'linux',
    brand: 'lenovo',
    path: p,

    capabilities() {
      return { stopAt: false, range: false, behaviour: false, conservation: true, disable: true };
    },

    getStatus() {
      return {
        percent: cap === null ? null : Number(cap),
        status,
        powerOnline: acOnline(),
        charging: status === 'Charging',
        conservation: read() === 1,
        startThreshold: null,
        endThreshold: null,
      };
    },

    stopAt() { return { ok: false, error: 'IdeaPad yalnızca koruma modunu (sabit ~%60-80) destekler' }; },
    holdRange() { return { ok: false, error: 'IdeaPad aralık desteklemiyor' }; },
    conserve(on) { return write(on ? 1 : 0); },
    disable() { return write(0); },
  };
}
