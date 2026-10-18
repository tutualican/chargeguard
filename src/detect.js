// Marka / model / OS tespiti.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BRANDS = [
  [/(huawei)/i, 'huawei'],
  [/(lenovo)/i, 'lenovo'],
  [/(asustek|asus)/i, 'asus'],
  [/(acer)/i, 'acer'],
  [/(dell)/i, 'dell'],
  [/(hp|hewlett)/i, 'hp'],
  [/(msi|micro-star)/i, 'msi'],
  [/(samsung)/i, 'samsung'],
  [/(toshiba|dynabook)/i, 'toshiba'],
  [/(xiaomi|redmi)/i, 'xiaomi'],
  [/(apple)/i, 'apple'],
  [/(razer)/i, 'razer'],
  [/(gigabyte)/i, 'gigabyte'],
  [/(clevo|tongfang)/i, 'clevo'],
  [/(framework)/i, 'framework'],
];

export function normalizeBrand(vendor = '', model = '') {
  const s = `${vendor} ${model}`;
  for (const [re, b] of BRANDS) if (re.test(s)) return b;
  return 'unknown';
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return ''; }
}

function psJson(cmd) {
  const out = execFileSync('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', cmd],
    { encoding: 'utf8', windowsHide: true });
  return JSON.parse(out.trim());
}

function detectLinux() {
  const vendor = readFileSafe('/sys/class/dmi/id/sys_vendor') || readFileSafe('/sys/class/dmi/id/board_vendor');
  const model = readFileSafe('/sys/class/dmi/id/product_name') || readFileSafe('/sys/class/dmi/id/board_name');
  return { os: 'linux', vendor, model, brand: normalizeBrand(vendor, model) };
}

function detectWindows() {
  let vendor = '', model = '';
  try {
    const o = psJson('$c=Get-CimInstance Win32_ComputerSystem; @{m=$c.Manufacturer;d=$c.Model} | ConvertTo-Json -Compress');
    vendor = o.m || ''; model = o.d || '';
  } catch { /* yoksay */ }
  return { os: 'win32', vendor, model, brand: normalizeBrand(vendor, model) };
}

export function detect() {
  if (process.platform === 'linux') return detectLinux();
  if (process.platform === 'win32') return detectWindows();
  return { os: process.platform, vendor: '', model: '', brand: 'unknown' };
}
