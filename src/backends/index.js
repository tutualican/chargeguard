// Arka uç seçimi — OS + marka + WMI sınıf probu.
import { classExists } from '../wmi.js';
import { createLinuxSysfsBackend } from './linux-sysfs.js';
import { createLinuxIdeapadBackend } from './linux-ideapad.js';
import { createWinHuaweiBackend } from './win-huawei.js';
import { createWinAsusBackend } from './win-asus.js';
import { createWinUnsupportedBackend } from './win-unsupported.js';

// Backend sözleşmesi:
//   { id, os, brand,
//     capabilities() -> { stopAt, range, behaviour, conservation, disable },
//     getStatus()    -> { percent, powerOnline, charging, startThreshold?, endThreshold?, mode?, note? },
//     stopAt(pct)    -> { ok, error? },
//     holdRange(lo,hi) -> { ok, error? },
//     disable()      -> { ok, error? },
//     conserve(on)?  -> { ok, error? }   // yalnızca conservation yeteneği varsa
//   }

function selectLinux() {
  // Jenerik sysfs çoğu markayı kapsar (thinkpad/acpi, asus-wmi, acer-wmi, huawei-wmi, dell-wmi-battery...).
  return createLinuxSysfsBackend() || createLinuxIdeapadBackend() || null;
}

function selectWindows(dev) {
  const tryHuawei = () => (classExists('root\\WMI', 'OemWMIMethod') ? createWinHuaweiBackend() : null);
  const tryAsus = () => (classExists('root\\WMI', 'AsusAtkWmi_WMNB') ? createWinAsusBackend() : null);

  if (dev.brand === 'huawei') return tryHuawei() || tryAsus() || createWinUnsupportedBackend(dev);
  if (dev.brand === 'asus') return tryAsus() || tryHuawei() || createWinUnsupportedBackend(dev);
  // Bilinmeyen marka: sınıf var mı diye prob et.
  return tryHuawei() || tryAsus() || createWinUnsupportedBackend(dev);
}

export function selectBackend(dev) {
  if (dev.os === 'linux') return selectLinux();
  if (dev.os === 'win32') return selectWindows(dev);
  return null;
}
