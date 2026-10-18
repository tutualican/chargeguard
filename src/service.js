// Yapılandırmayı cihaza uygulama + arka plan (daemon) döngüsü.
import { readConfig, appendLog, describeConfig } from './config.js';
import { open } from './core.js';

export function applyConfig(app, cfg) {
  if (!cfg || !cfg.mode) return { ok: false, error: 'geçersiz yapılandırma' };
  switch (cfg.mode) {
    case 'hold': return app.holdRange(cfg.lo, cfg.hi);
    case 'stop': return app.stopAt(cfg.pct);
    case 'off': return app.disable();
    case 'conserve': return app.conserve(!!cfg.on);
    default: return { ok: false, error: `bilinmeyen mod: ${cfg.mode}` };
  }
}

// Cihazdaki ayar yapılandırmadan farklı mı? (drift algılama)
export function needsReapply(cfg, s) {
  if (!cfg || !s) return false;
  if (cfg.mode === 'hold') return s.startThreshold !== cfg.lo || s.endThreshold !== cfg.hi || s.mode !== 1;
  if (cfg.mode === 'stop') return s.endThreshold !== cfg.pct;
  if (cfg.mode === 'conserve') return s.conservation !== !!cfg.on;
  return false;
}

// Tek seferlik uygula (oturum açılışında kullanılır).
export function applyOnce() {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: 'yapılandırma yok — menüden "otomatik başlatma" kurun' };
  const app = open();
  const result = applyConfig(app, cfg);
  appendLog(`apply (${describeConfig(cfg)}) → ${JSON.stringify(result)}`);
  return { config: cfg, result };
}

// Arka plan: başlangıçta uygula, sonra periyodik olarak sapmayı düzelt.
export function runDaemon({ reapplyMinutes = 15 } = {}) {
  const cfg = readConfig();
  const app = open();
  if (!cfg) { appendLog('yapılandırma yok — daemon çıkıyor'); return null; }

  appendLog(`daemon başladı: ${describeConfig(cfg)}`);
  const apply = (why) => {
    const r = applyConfig(app, cfg);
    appendLog(`${why} → ${JSON.stringify(r)}`);
    return r;
  };
  apply('başlangıç');

  const ms = Math.max(1, reapplyMinutes) * 60000;
  const iv = setInterval(() => {
    try {
      const s = app.status() || {};
      if (needsReapply(cfg, s)) apply('drift-düzeltme');
      else appendLog('ok (değişiklik yok)');
    } catch (e) { appendLog('hata: ' + (e && e.message)); }
  }, ms);

  return { stop: () => clearInterval(iv) };
}
