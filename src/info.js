// Kullanıcı bilgilendirmeleri (menü / CLI / izleyici için ortak metin).

// Aralık (lo–hi) ayarının ne yaptığını açıklar — özellikle "alt eşiğe düşme".
export function rangeNote(lo, hi) {
  return [
    `Bu ayar (%${lo}–%${hi}) ne yapar:`,
    `  • Fişteyken pil %${hi}'de DURUR (şarj etmez).`,
    `  • Pil fişteyken KENDİLİĞİNDEN DÜŞMEZ (cihaz prizden çalışır).`,
    `  • %${lo}'e inmesi için FİŞTEN ÇIKAR (bataryada kullan).`,
    `  • Pil %${lo}'e gelince YENİDEN şarj başlar → %${hi}'e kadar.`,
    `  • %${lo}–%${hi} arasında fişe takarsan şarj ETMEZ (gereksiz doldurmaz).`,
  ].join('\n');
}

// Tek noktada durdurma (stop) için kısa not.
export function dropNote() {
  return 'Not: Fişteyken pil kendiliğinden düşmez; düşmesi için FİŞTEN ÇIKAR (bataryada kullan).';
}
