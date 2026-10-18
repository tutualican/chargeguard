// Kalıcı yapılandırma + günlük (log) yolları.
// Windows: %APPDATA%\ChargeGuard   |   Linux: ~/.config/ChargeGuard
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function configDir() {
  const base = process.env.CG_CONFIG_DIR
    || (process.platform === 'win32' ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')) : path.join(os.homedir(), '.config'));
  return path.join(base, 'ChargeGuard');
}
export function configPath() { return path.join(configDir(), 'config.json'); }
export function logPath() { return path.join(configDir(), 'daemon.log'); }

export function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return null; }
}
export function writeConfig(cfg) {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n');
  return configPath();
}
export function appendLog(text) {
  try {
    fs.mkdirSync(configDir(), { recursive: true });
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${text}\n`);
  } catch { /* yok */ }
}

// İnsan-okur kısa açıklama (menü/CLI için).
export function describeConfig(cfg) {
  if (!cfg || !cfg.mode) return 'yok';
  if (cfg.mode === 'hold') return `aralıkta tut ${cfg.lo}-${cfg.hi}`;
  if (cfg.mode === 'stop') return `noktada durdur %${cfg.pct}`;
  if (cfg.mode === 'off') return 'sınır yok (tam şarj)';
  if (cfg.mode === 'conserve') return `koruma modu ${cfg.on ? 'açık' : 'kapalı'}`;
  return cfg.mode;
}
