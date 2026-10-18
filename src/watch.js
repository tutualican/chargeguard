// Salt-okuma histerezis izleyicisi — HİÇBİR yazma yapmaz.
// Amaç: "hi'de durur (charge-stop) / lo'ya düşünce yeniden başlar (charge-start)"
// döngüsünü ampirik olarak KANITLAMAK.
//
// İki parça:
//   createTracker()  → saf mantık (test edilebilir, zaman enjekte edilebilir)
//   runWatch()       → gerçek zamanlayıcı + konsol çıktısı
import { open } from './core.js';
import { rangeNote } from './info.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const isBool = (v) => typeof v === 'boolean';

// İki örnek arasındaki olayları üret (yarış yok, saf).
export function classify(prev, cur, { lo, hi }) {
  const events = [];
  if (!prev) return events; // ilk örnek = temel çizgi (baseline), olay üretme

  const pp = num(prev.percent);
  const cp = num(cur.percent);

  // Şarj durumu değişimi (yalnızca ikisi de biliniyorken)
  if (isBool(prev.charging) && isBool(cur.charging) && cur.charging !== prev.charging) {
    events.push({ type: cur.charging ? 'charge-start' : 'charge-stop', percent: cp });
  }
  // Eşik geçişleri
  if (cp !== null && pp !== null) {
    if (pp > lo && cp <= lo) events.push({ type: 'low', percent: cp });
    if (pp < hi && cp >= hi) events.push({ type: 'high', percent: cp });
  }
  return events;
}

// Kanıt durum makinesi.
export function createTracker({ lo, hi, now = () => Date.now() }) {
  let prev = null;
  const s = { stoppedAtHigh: false, resumedAtLow: false, samples: 0, min: null, max: null };
  const events = [];

  function tick(cur) {
    const evs = classify(prev, cur, { lo, hi });
    const at = now();
    s.samples++;
    const cp = num(cur.percent);
    if (cp !== null) {
      s.min = s.min === null ? cp : Math.min(s.min, cp);
      s.max = s.max === null ? cp : Math.max(s.max, cp);
    }
    for (const e of evs) {
      events.push({ at, ...e, charging: cur.charging });
      // --- Kanıt kuralları ---
      // DURMA: şarj true→false ve yüzde hi civarında (>= hi-1), veya hi geçişi + şarj etmiyor
      if (e.type === 'charge-stop' && cp !== null && cp >= hi - 1) s.stoppedAtHigh = true;
      if (e.type === 'high' && cur.charging === false) s.stoppedAtHigh = true;
      // BAŞLAMA: şarj false→true ve yüzde lo civarında (<= lo+1), veya lo geçişi + şarj ediyor
      if (e.type === 'charge-start' && cp !== null && cp <= lo + 1) s.resumedAtLow = true;
      if (e.type === 'low' && cur.charging === true) s.resumedAtLow = true;
    }
    prev = cur;
    return evs;
  }

  function summary() {
    return { ...s, lo, hi, cycleComplete: s.stoppedAtHigh && s.resumedAtLow, events };
  }

  return { tick, summary };
}

const chgTxt = (c) => (c === true ? 'şarj EDİYOR' : c === false ? 'şarj ETMİYOR' : 'bilinmiyor');
const pwrTxt = (st) => {
  if (st.powerOnline === true) return 'FİŞTE/AC';
  if (st.discharging === true || st.powerOnline === false) return 'BATARYA/DC';
  return 'güç?';
};
const note = (e) => ({
  high: "↑ hi'ye ulaştı",
  low: "↓ lo'ya düştü",
  'charge-stop': '⏹ şarj DURDU',
  'charge-start': '▶ şarj BAŞLADI',
}[e.type] || e.type);
const hhmmss = (ms) => new Date(ms).toTimeString().slice(0, 8);

function safeStatus(app) {
  try { return app.status(); } catch { return null; }
}

export function runWatch(opts = {}) {
  const app = opts.app || open();
  const json = !!opts.json;

  // lo/hi: argümandan, yoksa cihazın mevcut eşiklerinden
  let lo = opts.lo;
  let hi = opts.hi;
  const first = safeStatus(app);
  if (lo === undefined) lo = first ? num(first.startThreshold) : null;
  if (hi === undefined) hi = first ? num(first.endThreshold) : null;

  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    console.error('lo/hi belirlenemedi. Örnek: chargeguard watch 65 80');
    process.exitCode = 2;
    return null;
  }

  const intervalMs = Number.isFinite(opts.intervalMs) ? opts.intervalMs : 30000;
  const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 0;
  const tracker = createTracker({ lo, hi });

  if (!json) {
    console.log('ChargeGuard izleyici — SALT-OKUMA (yazma yapmaz)');
    console.log(`Aralık: %${lo}–%${hi}   Örnekleme: ${Math.round(intervalMs / 1000)} sn` +
      (durationMs ? `   Süre: ${Math.round(durationMs / 60000)} dk` : ''));
    console.log(`Beklenen: %${hi}'de DURUR, %${lo}'ye düşünce YENİDEN BAŞLAR.`);
    console.log(rangeNote(lo, hi));
    console.log(`Not: döngü kanıtı için cihaz FİŞTE (AC) olmalı. Çıkmak için Ctrl+C.\n`);
  }

  const sample = () => {
    const st = safeStatus(app);
    if (!st) return;
    const evs = tracker.tick(st);
    if (json) {
      console.log(JSON.stringify({ at: Date.now(), percent: st.percent ?? null, charging: st.charging ?? null, events: evs }));
    } else {
      const suffix = evs.length ? '   ' + evs.map(note).join('  ') : '';
      console.log(`[${hhmmss(Date.now())}] %${st.percent ?? '?'}  (${chgTxt(st.charging)})  [${pwrTxt(st)}]${suffix}`);
    }
  };

  const finish = () => {
    clearInterval(iv);
    if (timer) clearTimeout(timer);
    printSummary(tracker.summary(), json);
  };

  sample();
  const iv = setInterval(sample, intervalMs);
  const timer = durationMs > 0 ? setTimeout(finish, durationMs) : null;
  process.once('SIGINT', () => { finish(); process.exit(0); });
  return { tracker, stop: finish };
}

export function printSummary(s, json) {
  if (json) { console.log(JSON.stringify({ summary: s })); return; }
  console.log('\n=== ÖZET ===');
  console.log(`Örnek: ${s.samples}   Ölçülen aralık: %${s.min ?? '?'}–%${s.max ?? '?'}   Hedef: %${s.lo}–%${s.hi}`);
  console.log(`hi'de durdu:      ${s.stoppedAtHigh ? '✅ kanıtlandı' : '⬜ görülmedi'}`);
  console.log(`lo'da başladı:    ${s.resumedAtLow ? '✅ kanıtlandı' : '⬜ görülmedi'}`);
  console.log(`DÖNGÜ KANITI:     ${s.cycleComplete ? '✅ TAM DÖNGÜ ÇALIŞIYOR' : '⬜ henüz tamamlanmadı'}`);
}
