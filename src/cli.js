#!/usr/bin/env node
// ChargeGuard CLI — sadece pil şarj sınırlama (özel proje).
import { open } from './core.js';
import { serve } from './server.js';
import { classExists } from './wmi.js';
import { detect } from './detect.js';
import { runWatch } from './watch.js';
import { interactiveMenu } from './menu.js';
import { applyOnce, runDaemon } from './service.js';
import { autostartStatus, installAutostart, removeAutostart } from './autostart.js';

const show = (o) => console.log(JSON.stringify(o, null, 2));

function parseArgs(list) {
  const pos = []; const flags = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = list[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else pos.push(a);
  }
  return { pos, flags };
}

function help() {
  console.log(`ChargeGuard — pil şarj sınırlama (ÖZEL, sadece pil)

Kullanım:
  chargeguard                  # MENÜ (argümansız; çift tıklayınca da bu açılır)
  chargeguard menu             # aynı menü
  chargeguard detect           # marka/model/OS
  chargeguard probe            # Windows'ta bulunan WMI sınıfları
  chargeguard caps             # bu cihazın yetenekleri
  chargeguard status           # pil %, AC/DC, eşikler
  chargeguard stop <pct>       # şu yüzdede durdur (40-100)
  chargeguard hold <lo> <hi>   # lo-hi aralığında tut
  chargeguard conserve <on|off># koruma modu (örn. Lenovo IdeaPad)
  chargeguard off              # sınırı kaldır (tam şarj)
  chargeguard watch [lo] [hi]  # SALT-OKUMA: döngüyü kanıtla (--interval sn --duration dk --json)
  chargeguard apply            # kayıtlı ayarı şimdi uygula (açılışta kullanılır)
  chargeguard daemon           # arka plan: uygula + periyodik düzelt
  chargeguard autostart on|off|status   # otomatik başlatma (Görev Zamanlayıcı/systemd)
  chargeguard serve            # JSON API (GUI için) — http://127.0.0.1:8731

Not: Windows'ta WMI, Linux'ta sysfs yazımı için yönetici/root gerekir.`);
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  if (cmd === undefined || cmd === 'menu') { await interactiveMenu(); return; }
  const app = open();

  switch (cmd) {
    case 'detect': show(app.device); break;
    case 'caps': show({ device: app.device, backend: app.backend, capabilities: app.capabilities() }); break;
    case 'status': show(app.status()); break;
    case 'stop': show(app.stopAt(Number(args[0]))); break;
    case 'hold': show(app.holdRange(Number(args[0]), Number(args[1]))); break;
    case 'conserve': show(app.conserve(args[0] === 'on' || args[0] === '1' || args[0] === 'true')); break;
    case 'off': case 'disable': case 'resume': show(app.disable()); break;
    case 'probe': {
      const device = detect();
      if (device.os !== 'win32') { show({ device, note: 'prob yalnızca Windows için' }); break; }
      show({
        device,
        classes: {
          'root\\WMI:OemWMIMethod': classExists('root\\WMI', 'OemWMIMethod'),
          'root\\WMI:AsusAtkWmi_WMNB': classExists('root\\WMI', 'AsusAtkWmi_WMNB'),
        },
      });
      break;
    }
    case 'serve': serve(); break;
    case 'apply': show(applyOnce()); break;
    case 'daemon': { const d = runDaemon(); if (d) console.error('daemon çalışıyor (arka plan)'); break; }
    case 'autostart': {
      const sub = args[0];
      if (sub === 'on' || sub === 'kur') show({ install: installAutostart(), status: autostartStatus() });
      else if (sub === 'off' || sub === 'kaldir') show({ remove: removeAutostart(), status: autostartStatus() });
      else show({ status: autostartStatus(), kullanim: 'autostart on|off|status' });
      break;
    }
    case 'watch': {
      const { pos, flags } = parseArgs(args);
      runWatch({
        app,
        lo: pos[0] !== undefined ? Number(pos[0]) : undefined,
        hi: pos[1] !== undefined ? Number(pos[1]) : undefined,
        intervalMs: flags.interval !== undefined ? Number(flags.interval) : undefined,
        durationMs: flags.duration !== undefined ? Number(flags.duration) : undefined,
        json: !!flags.json,
      });
      break;
    }
    case '--version': case 'version': console.log('0.3.0'); break;
    case 'help': case '--help': case '-h': help(); break;
    default: help();
  }
}

main();
