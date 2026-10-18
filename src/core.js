// Birleşik çekirdek API: yetenek indirgeme + yazma sonrası geri-okuma.
// open({ device, backend }) ile test için enjeksiyon yapılabilir.
import { detect } from './detect.js';
import { selectBackend } from './backends/index.js';
import { rangeNote, dropNote } from './info.js';

const EMPTY_CAPS = { stopAt: false, range: false, behaviour: false, conservation: false, disable: false };

export function open(opts = {}) {
  const device = opts.device || detect();
  const backend = 'backend' in opts ? opts.backend : selectBackend(device);

  const caps = () => (backend ? { ...EMPTY_CAPS, ...backend.capabilities() } : { ...EMPTY_CAPS });
  const status = () => (backend ? { backend: backend.id, ...backend.getStatus() } : null);

  function readBack() {
    if (!backend) return null;
    try {
      const s = backend.getStatus();
      return {
        percent: s.percent ?? null,
        startThreshold: s.startThreshold ?? null,
        endThreshold: s.endThreshold ?? null,
        mode: s.mode ?? null,
        conservation: s.conservation ?? null,
      };
    } catch { return null; }
  }
  const finish = (applied) => ({ ok: true, applied, readBack: readBack() });
  const noBackend = () => (backend ? null : { ok: false, error: 'desteklenen arka uç yok (bu marka/OS henüz desteklenmiyor)' });

  function stopAt(pct) {
    const e = noBackend(); if (e) return e;
    if (!Number.isFinite(pct) || pct < 40 || pct > 100) return { ok: false, error: 'pct 40–100 arasında olmalı' };
    if (!caps().stopAt) return { ok: false, error: 'bu cihaz noktada durdurmayı desteklemiyor' };
    const r = backend.stopAt(pct);
    if (!r.ok) return r;
    const o = finish(pct);
    o.note = dropNote();
    return o;
  }

  function holdRange(lo, hi) {
    const e = noBackend(); if (e) return e;
    if (!Number.isFinite(hi) || hi < 40 || hi > 100) return { ok: false, error: 'hi 40–100 arasında olmalı' };
    if (!Number.isFinite(lo) || lo < 0 || lo >= hi) return { ok: false, error: 'lo, hi’den küçük ve ≥0 olmalı' };
    const c = caps();
    if (c.range) {
      const r = backend.holdRange(lo, hi);
      if (!r.ok) return r;
      const o = finish({ lo, hi });
      o.note = rangeNote(lo, hi);
      return o;
    }
    if (c.stopAt) {
      const r = backend.stopAt(hi);
      if (!r.ok) return r;
      const o = finish(hi);
      o.reduced = 'aralık desteklenmiyor → sadece üst eşik uygulandı';
      o.note = dropNote();
      return o;
    }
    return { ok: false, error: 'aralık/nokta desteklenmiyor' };
  }

  function conserve(on) {
    const e = noBackend(); if (e) return e;
    if (!caps().conservation || typeof backend.conserve !== 'function') return { ok: false, error: 'bu cihaz koruma modunu desteklemiyor' };
    const r = backend.conserve(!!on);
    return r.ok ? finish(on ? 'koruma modu açık' : 'koruma modu kapalı') : r;
  }

  function disable() {
    const e = noBackend(); if (e) return e;
    if (!caps().disable) return { ok: false, error: 'desteklemiyor' };
    const r = backend.disable();
    return r.ok ? finish('sınır kaldırıldı') : r;
  }

  return { device, backend: backend ? backend.id : null, capabilities: caps, status, stopAt, holdRange, conserve, disable };
}
