// Etkileşimli konsol menüsü.
// exe'ye çift tıklandığında (argümansız) çalışır → pencere kapanmaz, menü bekler.
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { open } from './core.js';
import { runWatch } from './watch.js';
import { readConfig, writeConfig, describeConfig } from './config.js';
import { autostartStatus, installAutostart, removeAutostart } from './autostart.js';
import { rangeNote, dropNote } from './info.js';

const LINE = '='.repeat(52);
const IS_WIN = process.platform === 'win32';

function isAdmin() {
  if (process.platform !== 'win32') {
    return typeof process.getuid === 'function' ? process.getuid() === 0 : true;
  }
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "if(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){'1'}else{'0'}"],
      { encoding: 'utf8', windowsHide: true });
    return out.trim() === '1';
  } catch { return false; }
}

// Linux'ta yükseltme: kullanıcıya komut verilir (yeni terminal gerekir).
export function elevateHint() {
  if (process.pkg) return 'sudo ' + process.execPath;
  return `sudo ${process.execPath} ${process.argv[1] || 'cli.js'}`;
}

export function relaunchElevated() {
  if (!IS_WIN) return false; // Linux'ta konsolu sudo ile yeniden başlatmak gerekir
  const exe = process.execPath;
  const args = process.pkg ? [] : [process.argv[1], 'menu'];
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const argPart = args.length ? ` -ArgumentList ${args.map(q).join(',')}` : '';
  const cmd = `Start-Process -Verb RunAs -FilePath ${q(exe)}${argPart}`;
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { windowsHide: true }); return true; }
  catch { return false; }
}

export async function interactiveMenu() {
  const admin = isAdmin();
  const app = open();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  const pause = () => ask('  (devam için Enter) ');
  let asInstalled = autostartStatus().installed;

  while (true) {
    console.log('\n' + LINE);
    console.log('   ChargeGuard  —  Pil Sarj Sinirlama (salt pil)');
    console.log(LINE);
    console.log(`   Yetki: ${admin ? 'YONETICI' : 'NORMAL'}${admin ? '' : '   (yazma için: 8 = yönetici başlat)'}`);
    console.log(`   Kayıtlı: ${describeConfig(readConfig())}   |   Otomatik başlatma: ${asInstalled === true ? 'KURULU' : asInstalled === false ? 'kapalı' : '?'}`);
    console.log(LINE);
    const s = app.status();
    console.log(s ? JSON.stringify(s) : '(arka uç yok)');
    console.log('  [1] Durum        [2] Yetenekler');
    console.log('  [3] Aralıkta tut (lo hi)      [4] Noktada durdur (pct)');
    console.log('  [5] Sınırı kaldır             [6] İzle (salt-okuma, kanıt)');
    console.log('  [7] Otomatik başlatma (arka plan)');
    console.log(IS_WIN ? '  [8] Yönetici olarak yeniden başlat' : '  [8] Yönetici komutu (sudo) göster');
    console.log('  [0] Çıkış');
    console.log('  ' + '-'.repeat(50));
    console.log('  Bilgi: pil FİŞTEYKEN düşmez. Belirlenen alt eşiğe (lo) inmesi için');
    console.log('         FİŞTEN ÇIKAR; lo\'ya gelince yeniden şarj başlar.');

    const sec = (await ask('Seçim: ')).trim();

    if (sec === '0' || sec.toLowerCase() === 'q') break;
    if (sec === '1') continue;
    if (sec === '2') { console.log(JSON.stringify(app.capabilities(), null, 2)); await pause(); continue; }
    if (sec === '3') {
      const lo = Number((await ask('  lo: ')).trim());
      const hi = Number((await ask('  hi: ')).trim());
      console.log(JSON.stringify(app.holdRange(lo, hi), null, 2));
      if (Number.isFinite(lo) && Number.isFinite(hi) && lo < hi) console.log('\n' + rangeNote(lo, hi));
      await pause(); continue;
    }
    if (sec === '4') {
      const pct = Number((await ask('  pct: ')).trim());
      console.log(JSON.stringify(app.stopAt(pct), null, 2));
      console.log('\n' + dropNote());
      await pause(); continue;
    }
    if (sec === '5') { console.log(JSON.stringify(app.disable(), null, 2)); await pause(); continue; }
    if (sec === '6') {
      const lo = Number((await ask('  lo: ')).trim());
      const hi = Number((await ask('  hi (boş=bekle, Ctrl+C ile bitir): ')).trim());
      const dk = Number((await ask('  süre (dk, boş=5): ')).trim());
      const durationMs = (Number.isFinite(dk) && dk > 0 ? dk : 5) * 60000;
      console.log('');
      rl.pause();
      runWatch({ app, lo, hi, intervalMs: 30000, durationMs });
      await pause();
      rl.resume();
      continue;
    }
    if (sec === '7') {
      console.log(`  Otomatik başlatma: ${asInstalled === true ? 'KURULU' : asInstalled === false ? 'kapalı' : '?'}   |   Kayıtlı ayar: ${describeConfig(readConfig())}`);
      console.log('   [1] Kur (ayarı kaydet + oturum açılışında başlat)');
      console.log('   [2] Kaldır');
      console.log('   [3] Durum');
      console.log('   [0] Geri');
      const s7 = (await ask('  Seçim: ')).trim();
      if (s7 === '1') {
        console.log('  Otomatik başlatmada uygulanacak ayar:');
        console.log('   [1] Aralıkta tut   [2] Noktada durdur   [3] Sınır yok (tam şarj)');
        const m = (await ask('  Mod: ')).trim();
        let cfg;
        if (m === '1') { cfg = { mode: 'hold', lo: Number((await ask('    lo: ')).trim()), hi: Number((await ask('    hi: ')).trim()) }; }
        else if (m === '2') { cfg = { mode: 'stop', pct: Number((await ask('    pct: ')).trim()) }; }
        else cfg = { mode: 'off' };
        const p = writeConfig(cfg);
        console.log('  Yapılandırma yazıldı: ' + describeConfig(cfg) + '\n    ' + p);
        const r = installAutostart();
        console.log(JSON.stringify(r, null, 2));
        if (r && r.ok === false && !admin) {
          console.log(IS_WIN
            ? '  → Önce menüden [8] ile yönetici başlatıp tekrar dene.'
            : '  → Root gerekli. Yeni terminalde çalıştır:\n      ' + elevateHint());
        }
        asInstalled = autostartStatus().installed;
        await pause(); continue;
      }
      if (s7 === '2') { console.log(JSON.stringify(removeAutostart(), null, 2)); asInstalled = autostartStatus().installed; await pause(); continue; }
      if (s7 === '3') { console.log(JSON.stringify(autostartStatus(), null, 2)); await pause(); continue; }
      continue;
    }
    if (sec === '8') {
      if (admin) { console.log('Zaten yönetici (root).'); await pause(); continue; }
      if (!IS_WIN) {
        console.log('  Linux\'ta yönetici işlemleri için yeni bir terminalde şunu çalıştır:');
        console.log('      ' + elevateHint());
        await pause(); continue;
      }
      console.log('Yönetici olarak yeniden başlatılıyor...');
      rl.close();
      if (relaunchElevated()) return; // yeni yönetici pencere açılır
      console.log('Başlatılamadı. PowerShell\'i yönetici açıp programı oradan çalıştırın.');
      process.exitCode = 1; return;
    }
  }
  rl.close();
}
