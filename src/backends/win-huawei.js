// Windows Huawei arka ucu — ACPI-WMI OemWMIfun.
// Protokol: ../../docs/huawei-battery-wmi.md
import { huaweiWmi, windowsBattery, huaweiLimit } from '../wmi.js';

function apply(hex) {
  const r = huaweiWmi(hex);
  if (r.error) return { ok: false, error: r.error };
  if (!r.bytes || r.bytes[0] !== 0) return { ok: false, error: 'desteklenmiyor' };
  return { ok: true };
}

export function createWinHuaweiBackend() {
  return {
    id: 'win-huawei',
    os: 'win32',
    brand: 'huawei',

    capabilities() {
      return { stopAt: true, range: true, behaviour: false, conservation: false, disable: true };
    },

    getStatus() {
      const base = windowsBattery();
      const r = huaweiWmi('03 16');
      if (r.error) return { ...base, mode: null, startThreshold: null, endThreshold: null, note: r.error };
      if (!r.bytes || r.bytes[0] !== 0) return { ...base, mode: null, startThreshold: null, endThreshold: null, note: 'şarj komutu desteklenmiyor' };
      return { ...base, mode: r.bytes[1], startThreshold: r.bytes[3], endThreshold: r.bytes[4] };
    },

    stopAt(pct) { return apply(huaweiLimit(Math.max(0, pct - 5), pct)); },
    holdRange(lo, hi) { return apply(huaweiLimit(lo, hi)); },
    // Sınırı kaldır → tam şarj (mode=4 bu EC'de %100'e şarj eder).
    disable() { return apply('03 15 04 48 5F 64'); },
  };
}
