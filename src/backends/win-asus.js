// Windows Asus arka ucu — ACPI-WMI AsusAtkWmi_WMNB.
// Battery charge limit (RSOC) cihaz kimliği: 0x00120057
// Kaynak: linux asus-wmi (ASUS_WMI_DEVID_RSOC), g-helper, asus-battery-widget.
//
// NOT: Asus'ta eşik OKUNAMAZ (donanım yalnızca yazar; güç kesilince sıfırlanır).
// Bu yüzden getStatus eşikleri null döner, yazma sonrası gerçek doğrulama sınırlıdır.
import { asusCall, windowsBattery } from '../wmi.js';

const DEVID_RSOC = 0x00120057;

export function createWinAsusBackend() {
  return {
    id: 'win-asus',
    os: 'win32',
    brand: 'asus',

    capabilities() {
      return { stopAt: true, range: false, behaviour: false, conservation: false, disable: true };
    },

    getStatus() {
      const base = windowsBattery();
      // Okunabilir eşik yok; destek testi DSTS ile yapılır (desteklenmiyorsa ~0 dönebilir).
      const r = asusCall('DSTS', DEVID_RSOC);
      return {
        ...base,
        mode: null,
        startThreshold: null,
        endThreshold: null,
        note: r.error ? r.error : 'Asus: eşik donanımdan okunamaz (yalnızca yazılır)',
      };
    },

    // Asus yalnızca tek "bitiş eşiği" (RSOC) destekler.
    stopAt(pct) {
      const r = asusCall('DEVS', DEVID_RSOC, pct);
      if (r.error) return { ok: false, error: r.error };
      const res = r.result && (r.result.result ?? r.result.ReturnValue);
      return res === 1 ? { ok: true } : { ok: false, error: `Asus DEVS yanıtı: ${res}` };
    },

    disable() { return this.stopAt(100); },
  };
}
