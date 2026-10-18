// Windows: bilinen bir şarj-sınırı arka ucu olmayan markalar için.
// Yalnızca pil durumunu okur; yazma yapmaz ve açıkça "desteklenmiyor" der.
import { windowsBattery } from '../wmi.js';

const MSG = "Bu marka için Windows'ta açık şarj-sınırı API'si yok. Üretici yazılımı (Vantage/Care Center/MyASUS/Dell Command) veya BIOS kullanın.";

export function createWinUnsupportedBackend(dev) {
  return {
    id: 'win-unsupported',
    os: 'win32',
    brand: dev.brand || 'unknown',
    capabilities() {
      return { stopAt: false, range: false, behaviour: false, conservation: false, disable: false };
    },
    getStatus() {
      return { ...windowsBattery(), mode: null, startThreshold: null, endThreshold: null, note: MSG };
    },
    stopAt() { return { ok: false, error: MSG }; },
    holdRange() { return { ok: false, error: MSG }; },
    disable() { return { ok: false, error: MSG }; },
  };
}
