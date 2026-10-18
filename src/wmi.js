// Paylaşımlı Windows WMI / PowerShell yardımcıları.
import { execFileSync } from 'node:child_process';

const PS_OPTS = { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 };

function firstLine(s) {
  return String(s || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
}

export function friendlyPsError(e) {
  const raw = String((e && (e.stderr || e.stdout || e.message)) || e);
  if (/access denied|0x80041003|permissiondenied|erişim engellendi/i.test(raw)) return 'yönetici yetkisi gerekli (yönetici olarak çalıştırın)';
  if (/0x80041010|invalid class|geçersiz sınıf/i.test(raw)) return 'WMI sınıfı yok (desteklenmiyor)';
  return firstLine(raw) || 'PowerShell hatası';
}

export function ps(command) {
  try {
    return { out: execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      PS_OPTS).trim() };
  } catch (e) {
    return { error: friendlyPsError(e) };
  }
}

export function psJson(command) {
  const r = ps(command);
  if (r.error) return r;
  try { return { data: JSON.parse(r.out) }; } catch { return { error: 'JSON çözümlenemedi' }; }
}

export function classExists(namespace, className) {
  const r = ps(`if (Get-CimClass -Namespace '${namespace}' -ClassName '${className}' -ErrorAction SilentlyContinue) { 'YES' } else { 'NO' }`);
  return r.out === 'YES';
}

// Windows pil durumu (yönetici gerekmez).
export function windowsBattery() {
  const r = psJson(
    "$s=Get-CimInstance -Namespace root\\wmi -ClassName BatteryStatus -ErrorAction SilentlyContinue;" +
    "$b=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue;" +
    "@{p=$b.EstimatedChargeRemaining;on=$s.PowerOnline;ch=$s.Charging;dis=$s.Discharging}|ConvertTo-Json -Compress"
  );
  if (r.error || !r.data) return {};
  return { percent: r.data.p ?? null, powerOnline: r.data.on ?? null, charging: r.data.ch ?? null, discharging: r.data.dis ?? null };
}

// ---- Huawei: ACPI-WMI OemWMIfun (64 baytlık komut) ----
export function huaweiWmi(hex) {
  const arr = hex.trim().split(/\s+/).filter(Boolean).map((h) => '0x' + h).join(',');
  const cmd =
    "$ErrorActionPreference='Stop';" +
    "$o=Get-CimInstance -Namespace 'root\\WMI' -ClassName 'OemWMIMethod' -ErrorAction Stop | Select-Object -First 1;" +
    `$p=@(${arr});$f=New-Object 'byte[]' 64;for($i=0;$i -lt $p.Length;$i++){$f[$i]=[byte]$p[$i]};` +
    "$r=Invoke-CimMethod -InputObject $o -MethodName 'OemWMIfun' -Arguments @{u8Input=$f};" +
    "($r.u8Output | ForEach-Object { $_.ToString('X2') }) -join ' '";
  const r = ps(cmd);
  if (r.error) return { error: r.error };
  return { bytes: r.out.split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16)) };
}

// Huawei sabit-eşik komutu (mode=1 → şarjı durdur). Güvenli, saf fonksiyon.
export function huaweiLimit(lo, hi) {
  const h = (n) => (n & 0xff).toString(16).padStart(2, '0').toUpperCase();
  return `03 15 01 48 ${h(lo)} ${h(hi)}`;
}

// ---- Geniş prob: bilinen tüm marka WMI sınıflarını SALT-OKUMA yokla ----
const CANDIDATE_CLASSES = [
  ['root\\WMI', 'OemWMIMethod'],                 // Huawei
  ['root\\WMI', 'AsusAtkWmi_WMNB'],              // Asus
  ['root\\WMI', 'Lenovo_BatteryChargeMode'],     // Lenovo (bazı ThinkPad)
  ['root\\WMI', 'Lenovo_BiosSetting'],           // Lenovo BIOS ayarları
  ['root\\WMI', 'Lenovo_SetBiosSetting'],
  ['root\\WMI', 'MSI_ACPI'],                     // MSI
  ['root\\WMI', 'AcerWMI'],                      // Acer
  ['root\\WMI', 'AcerGameZone'],
  ['root\\dcim\\sysman', 'DCIM_BIOSEnumeration'],// Dell (DCPM)
  ['root\\dcim\\sysman', 'DCIM_BIOSService'],
  ['root\\HP\\InstrumentedBIOS', 'HP_BIOSSetting'],         // HP
  ['root\\HP\\InstrumentedBIOS', 'HP_BIOSSettingInterface'],
  ['root\\HP\\InstrumentedBIOS', 'HP_BIOSEnumeration'],
];

export function probeClasses() {
  const out = {};
  for (const [ns, cls] of CANDIDATE_CLASSES) out[`${ns}:${cls}`] = classExists(ns, cls);
  return out;
}

// BIOS WMI'si üzerinden şarj/pil ile ilgili AYARLARI OKU (yazma yapmaz).
// HP (HP_BIOSEnumeration), Dell (DCIM_BIOSEnumeration), Lenovo (Lenovo_BiosSetting).
export function biosCandidates() {
  const script = `
$out = @()
$sources = @(
  @{ ns='root\\HP\\InstrumentedBIOS'; cls='HP_BIOSEnumeration' },
  @{ ns='root\\dcim\\sysman';         cls='DCIM_BIOSEnumeration' },
  @{ ns='root\\WMI';                  cls='Lenovo_BiosSetting' }
)
foreach ($s in $sources) {
  try {
    Get-CimInstance -Namespace $s.ns -ClassName $s.cls -ErrorAction Stop | ForEach-Object {
      $n = $_.AttributeName; if (-not $n) { $n = $_.Name }; if (-not $n) { $n = $_.SettingName }
      if ($n -and ($n -match 'batter|charge')) {
        $out += [pscustomobject]@{ source=$s.ns; name=$n; value=$_.CurrentValue; possible=$_.PossibleValues }
      }
    }
  } catch {}
}
if ($out.Count -eq 0) { '[]' } else { $out | ConvertTo-Json -Compress -Depth 4 }
`;
  const r = psJson(script);
  if (r.error) return { error: r.error };
  const data = r.data;
  return { candidates: Array.isArray(data) ? data : (data ? [data] : []) };
}

// ---- Asus: ACPI-WMI AsusAtkWmi_WMNB (DSTS/DEVS) ----
export function asusCall(method, deviceId, value = 0) {
  const id = '0x' + (deviceId >>> 0).toString(16).padStart(8, '0');
  const args = method === 'DEVS'
    ? `@{Device_ID=[uint32]${id};Control_status=[uint32]${value >>> 0}}`
    : `@{Device_ID=[uint32]${id}}`;
  const cmd =
    "$ErrorActionPreference='Stop';" +
    "$o=Get-CimInstance -Namespace 'root\\WMI' -ClassName 'AsusAtkWmi_WMNB' -ErrorAction Stop | Select-Object -First 1;" +
    `$r=Invoke-CimMethod -InputObject $o -MethodName '${method}' -Arguments ${args};` +
    "$r | ConvertTo-Json -Compress";
  const r = psJson(cmd);
  if (r.error) return { error: r.error };
  return { result: r.data };
}
