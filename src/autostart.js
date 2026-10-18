// Otomatik başlatma (oturum açılışı).
// Windows: Görev Zamanlayıcı — "En yüksek ayrıcalıklarla" (UAC sormaz, arka planda).
// Linux:   systemd servisi (root) — /etc/systemd/system/chargeguard.service
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { configPath } from './config.js';

const TASK = process.env.CG_TASK || 'ChargeGuard';
const LINUX_UNIT = '/etc/systemd/system/chargeguard.service';
const LINUX_CONFIG_DIR = '/etc'; // → /etc/ChargeGuard/config.json (CG_CONFIG_DIR)

// Arka plan komutu: exe (pkg) veya "node cli.js" + daemon
function daemonInvocation() {
  if (process.pkg) return { exe: process.execPath, arg: 'daemon' };
  const script = process.argv[1] || 'cli.js';
  return { exe: process.execPath, arg: `"${script}" daemon` };
}

function ps(command) {
  try {
    return { out: execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { encoding: 'utf8', windowsHide: true }).trim() };
  } catch (e) {
    const raw = String((e && (e.stderr || e.stdout || e.message)) || e).trim();
    return { error: /denied|erişim|0x80070005/i.test(raw) ? 'yönetici yetkisi gerekli (yönetici olarak çalıştırın)' : raw };
  }
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function statusWin() {
  const r = ps(`if (Get-ScheduledTask -TaskName ${q(TASK)} -ErrorAction SilentlyContinue) { 'KURULDU' } else { 'YOK' }`);
  if (r.error) return { installed: null, error: r.error };
  return { installed: r.out === 'KURULDU' };
}

function installWin() {
  // Gizli çalıştır: konsol penceresi açılmasın.
  const inner = process.pkg
    ? `& '${process.execPath}' daemon`
    : `& '${process.execPath}' '${process.argv[1] || 'cli.js'}' daemon`;
  const arg = `-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${inner}"`;
  const cmd = [
    "$ErrorActionPreference='Stop'",
    "$exe='powershell.exe'",
    `$arg=${q(arg)}`,
    '$act=New-ScheduledTaskAction -Execute $exe -Argument $arg',
    '$trg=New-ScheduledTaskTrigger -AtLogOn',
    '$set=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden',
    '$prn=New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType Interactive -RunLevel Highest',
    `Register-ScheduledTask -TaskName ${q(TASK)} -Action $act -Trigger $trg -Settings $set -Principal $prn -Force | Out-Null`,
    "'KURULDU'",
  ].join('; ');
  const r = ps(cmd);
  if (r.error) return { ok: false, error: r.error };
  return { ok: r.out.includes('KURULDU') };
}

function removeWin() {
  const r = ps(`Unregister-ScheduledTask -TaskName ${q(TASK)} -Confirm:$false -ErrorAction SilentlyContinue; 'KALDIRILDI'`);
  if (r.error) return { ok: false, error: r.error };
  return { ok: true };
}

// Saf: systemd unit metni (test edilebilir).
export function linuxUnitContent(exe, arg) {
  const exec = `${exe} ${arg}`.trim();
  return [
    '[Unit]',
    'Description=ChargeGuard battery charge limiter',
    'After=multi-user.target',
    '',
    '[Service]',
    'Type=simple',
    'Environment=CG_CONFIG_DIR=' + LINUX_CONFIG_DIR,
    'ExecStart=' + exec,
    'Restart=on-failure',
    'RestartSec=30',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n');
}

function statusLinux() {
  return { installed: fs.existsSync(LINUX_UNIT) };
}
function installLinux() {
  const { exe, arg } = daemonInvocation();
  try {
    // Kullanıcının yapılandırmasını sistem konumuna kopyala (root daemon okur).
    const src = configPath();
    if (fs.existsSync(src)) {
      const destDir = path.join(LINUX_CONFIG_DIR, 'ChargeGuard');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, 'config.json'));
    }
    fs.writeFileSync(LINUX_UNIT, linuxUnitContent(exe, arg));
    execFileSync('systemctl', ['daemon-reload']);
    execFileSync('systemctl', ['enable', '--now', 'chargeguard']);
    return { ok: true };
  } catch (e) {
    const raw = String((e && e.message) || e);
    return { ok: false, error: /EACCES|permission/i.test(raw) ? 'root gerekli (sudo ile çalıştırın)' : raw };
  }
}
function removeLinux() {
  try {
    execFileSync('systemctl', ['disable', '--now', 'chargeguard']);
    fs.rmSync(LINUX_UNIT, { force: true });
    execFileSync('systemctl', ['daemon-reload']);
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

export function autostartStatus() {
  return process.platform === 'win32' ? statusWin() : process.platform === 'linux' ? statusLinux() : { installed: null };
}
export function installAutostart() {
  return process.platform === 'win32' ? installWin() : process.platform === 'linux' ? installLinux() : { ok: false, error: 'desteklenmeyen platform' };
}
export function removeAutostart() {
  return process.platform === 'win32' ? removeWin() : process.platform === 'linux' ? removeLinux() : { ok: false, error: 'desteklenmeyen platform' };
}
