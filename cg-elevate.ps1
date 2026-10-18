# ChargeGuard - elevated (UAC) command runner (helper).
# Usage:  powershell -File cg-elevate.ps1 hold 65 80
# Runs the built exe as administrator and prints its captured output.
#
# The exe path is resolved relative to this script; override with the CG_EXE
# environment variable if you keep the binary elsewhere.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)

$exe = if ($env:CG_EXE) { $env:CG_EXE } else { Join-Path $PSScriptRoot 'dist\chargeguard-win.exe' }
if (-not (Test-Path $exe)) {
  Write-Output "Exe bulunamadi: $exe  (once 'npm run build' calistirin ya da CG_EXE ayarlayin)"
  exit 1
}

$id  = [guid]::NewGuid().ToString('N')
$tmp = Join-Path $env:TEMP "cg_$id.txt"
$runner = Join-Path $env:TEMP "cg_run_$id.ps1"

$argline = ($Rest | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }) -join ' '
Set-Content -Path $runner -Value "& '$exe' $argline *> '$tmp'" -Encoding UTF8

try {
  Start-Process -Verb RunAs -Wait -FilePath 'powershell.exe' `
    -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $runner
} catch {
  Write-Output ('YUKSELTME IPTAL EDILDI veya HATA: ' + $_.Exception.Message)
}

if (Test-Path $tmp) { Get-Content $tmp } else { Write-Output '(cikti alinamadi - UAC iptal edilmis olabilir)' }
Remove-Item $tmp, $runner -ErrorAction SilentlyContinue
