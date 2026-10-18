# Huawei ACPI-WMI **pil/şarj** protokolü (doğrulanmış)

> Bu belge **yalnızca şarj** içindir. Fan/turbo/performans modu **kapsam dışıdır**
> (ChargeGuard sadece pile odaklanır).

Cihaz: **HUAWEI MateBook D15 (BOD-WXX9)**, BIOS 2.31.
Notlar mevcut MateBook Kontrol projesinde ampirik olarak test edilip doğrulanmıştır.

## Erişim

- WMI sınıfı: `root\WMI` → `OemWMIMethod`
- Metot: `OemWMIfun`
- Girdi: `u8Input` (64 bayt), dolu kısım komut.
- Çıktı: `u8Output` (bayt dizisi). **Yönetici yetkisi gerekir.**

## Yanıt sözleşmesi

| out[0] | Anlam |
|---|---|
| `00` | **OK** — komut destekleniyor/başarılı |
| `01` | **DESTEKLENMİYOR / hata** (geçersiz komutla aynı yanıt) |

> Anlamsız komut (`FF FF FF`) da `01 00 00 00…` döndü → `01` = hata/desteksiz.
> Bu yüzden yazma sonrası **mutlaka geri-oku**.

## Şarj komutları

| İşlem | Komut | Yanıt / Sonuç |
|---|---|---|
| Şarj durumunu oku | `03 16` | `out[1]=mode`, `out[2]` (sabit 0x48), `out[3]=lo`, `out[4]=hi` |
| Sabit sınır koy (stop) | `03 15 01 48 <lo> <hi>` | Çalışır → `mode=1` |
| "Akıllı" aç (DİKKAT) | `03 15 04 48 41 46` | `mode=4` — **şarjı DURDURMAZ, %100'e şarj eder** |
| Sınır tipi 0 | `03 15 00 48 41 46` | `mode=0` — **şarjı durdurur** (fişte olsa bile doldurmaz) |
| Sınır tipi 2 | `03 15 02 48 41 46` | `mode=2` |
| Yeniden başlatmayı oku | `03 13` | `out[1]=1` → açık |
| Yeniden başlatmayı ayarla | `03 12 <0|1>` | |

### Doğrulanmış davranış (fişte / AC, pil ~%90)

| Ayar | Şarj oluyor mu? |
|---|---|
| `mode=1` (lo=65, hi=70) | **HAYIR** → `Charging=False` ✅ (sınır çalışıyor) |
| `mode=4` | **EVET** → `Charging=True` ❌ (sınırı yok sayar) |
| `mode=0` | **HAYIR** → şarj durur |

- **65–70 aralığında tutmak:** `03 15 01 48 41 46` → `mode=1`, lo=65 / hi=70.
- **Belirli noktada durdurmak (ör. %80):** `03 15 01 48 4B 50` → lo=75 / hi=80.
- **Sınırı kaldır / tam şarj:** `mode=1` lo=95 / hi=100 (`03 15 01 48 5F 64`) → şarj eder; veya `mode=4`.

## Taşınabilir dersler (diğer markalar için)

- Şarj eşiği **EC/firmware** seviyesindedir; OS sadece "şu yüzdeyi geçme" der.
- Her komuttan sonra **geri-okuma** şart; aksi halde "uygulandı" yalanı olur.
- Windows'ta ortak API yok → marka-özel WMI. **Linux'ta jenerik sysfs** ile çok marka mümkün.

## Eşleme (ChargeGuard sözleşmesi)

| ChargeGuard | Huawei karşılığı |
|---|---|
| `stopAt(hi)` | `SET_LIMIT` mode=1, lo=hi-5, hi |
| `holdRange(lo, hi)` | `SET_LIMIT` mode=1, lo, hi |
| `resume()` | `SET_LIMIT` lo=95, hi=100 (veya `SET_RESUME(1)`) |
| `disable()` | `mode=4` (tam şarj) |
| `getStatus()` | `GET_CHARGE` + WMI `BatteryStatus` (Charging/…) |
