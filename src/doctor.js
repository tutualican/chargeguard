// "doctor": bu dizüstünde ChargeGuard ne yapabilir? Net hüküm + ne yapmalı.
import { open } from './core.js';
import { detect } from './detect.js';
import { probeClasses, biosCandidates } from './wmi.js';
import { tlpInfo } from './backends/linux-tlp.js';

const KNOWN = ['linux-sysfs', 'linux-ideapad', 'linux-tlp', 'win-huawei', 'win-asus'];

// Saf hüküm mantığı (test edilebilir).
export function verdictFor(backendId, caps) {
  const any = Object.values(caps || {}).some(Boolean);
  if (KNOWN.includes(backendId)) return any ? 'CALISIYOR' : 'KISMI';
  if (!backendId) return 'DESTEKLENMIYOR';
  return any ? 'KISMI' : 'DESTEKLENMIYOR';
}

const WIN_BRAND_GUIDE = {
  lenovo: "Lenovo: BIOS'ta 'Battery Charge Threshold' veya Lenovo Vantage → Pil → Şarj Eşiği.",
  dell: "Dell: BIOS'ta 'Battery' / 'Custom Charge' veya Dell Command | Power Manager (DCPM).",
  hp: "HP: BIOS'ta 'Battery Health Manager' veya HP Support Assistant.",
  acer: "Acer: BIOS'ta 'Battery Charge Limit' veya Acer Care Center.",
  msi: "MSI: BIOS'ta 'Battery Charge Limit' veya MSI Center.",
  samsung: "Samsung: BIOS'ta 'Battery Life Extender' (genelde %80 sabit).",
  asus: "Asus: MyASUS → Pil Bakımı (şarj limiti).",
  xiaomi: "Xiaomi: BIOS'ta pil/şarj limiti (model bazlı).",
  toshiba: "Dynabook/Toshiba: BIOS'ta şarj limiti (model bazlı).",
  clevo: "Clevo/Tongfang: BIOS'ta 'Battery Charge Limit' (model bazlı).",
};

// Saf rehber metinleri (test edilebilir).
export function guidanceFor(device, backendId, caps) {
  const lines = [];
  const os = device.os;

  if (backendId === 'linux-sysfs') {
    lines.push('Linux: jenerik sysfs bulundu. `sudo chargeguard hold <lo> <hi>` çalışır.');
    if (!caps.range) lines.push('Bu sürücü yalnızca üst eşiği (stop) sunuyor; aralık için çekirdek sürücüsü gerekir.');
    return lines;
  }
  if (backendId === 'linux-tlp') {
    lines.push('Linux: TLP bulundu; eşikler `tlp setcharge` ile yönetiliyor.');
    lines.push('`sudo chargeguard --backend tlp hold <lo> <hi>` (veya `stop <pct>` / `off`).');
    lines.push('Not: TLP yapılandırması (/etc/tlp.conf) ayrıca geçerlidir; kalıcılık için ChargeGuard otomatik başlatmayı kullanın.');
    return lines;
  }
  if (backendId === 'linux-ideapad') {
    lines.push('Linux: IdeaPad koruma modu (sabit ~%60-80). `sudo chargeguard conserve on`.');
    return lines;
  }
  if (backendId === 'win-huawei') {
    lines.push('Windows: Huawei ACPI-WMI (bu projede doğrulandı). `chargeguard hold <lo> <hi>` çalışır.');
    return lines;
  }
  if (backendId === 'win-asus') {
    lines.push('Windows: Asus AsusAtkWmi yolu var (denenmedi). `chargeguard stop <pct>`.');
    return lines;
  }

  if (os === 'linux') {
    lines.push('Linux: hiçbir şarj denetim dosyası bulunamadı.');
    lines.push('Öneri: çekirdek sürücüsünü yükleyin (ör. `sudo modprobe thinkpad_acpi` / `asus-wmi` / `huawei-wmi`) ve tekrar deneyin.');
    lines.push('`ls /sys/class/power_supply/BAT*/` çıktısını bir issue olarak paylaşın.');
    return lines;
  }

  if (os === 'win32') {
    lines.push('Windows: bu marka için açık ve güvenli bir şarj-sınırı API\'si yok.');
    const g = WIN_BRAND_GUIDE[device.brand];
    if (g) lines.push(g);
    lines.push('Körlemesine WMI yazımı YAPILMAZ (donanıma zarar riski). BIOS/üretici yazılımı en güvenli yol.');
    return lines;
  }

  if (os === 'darwin') {
    lines.push('macOS: genel bir şarj-sınırı API\'si yok (yalnızca "Optimized Battery Charging").');
  }
  return lines;
}

export function doctor() {
  const device = detect();
  const app = open();
  const caps = app.capabilities();
  const backend = app.backend;
  const status = app.status() || {};

  const report = {
    device,
    backend,
    capabilities: caps,
    status: {
      percent: status.percent ?? null,
      powerOnline: status.powerOnline ?? null,
      charging: status.charging ?? null,
      startThreshold: status.startThreshold ?? null,
      endThreshold: status.endThreshold ?? null,
      conservation: status.conservation ?? null,
    },
    verdict: verdictFor(backend, caps),
    ne_yapmali: guidanceFor(device, backend, caps),
  };

  if (device.os === 'win32') {
    try {
      report.windows_probe = { classes: probeClasses(), bios_candidates: (biosCandidates().candidates || []) };
    } catch (e) { report.windows_probe = { error: String((e && e.message) || e) }; }
  }

  if (device.os === 'linux') {
    try { report.linux_power = { tlp: tlpInfo() }; }
    catch (e) { report.linux_power = { error: String((e && e.message) || e) }; }
  }

  return report;
}
