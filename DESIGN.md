# ChargeGuard — Tasarım Dokümanı

> **Açık kaynak (Apache-2.0).** Bu doküman Türkçedir; İngilizce sürüm için [`README.md`](README.md).
> Amaç: **her markada**, **Windows + Linux** üzerinde çalışan, batarya **şarj sınırlama** çekirdeği.
> GUI sonra eklenecek (teknoloji kararı ertelendi); bu doküman dilden bağımsızdır.

---

## 1. Hedeflenen yetenekler ("her şey")

Her cihazda bulunabilecek yetenekler, tek bir ortak arayüz altında toplanır:

| Yetenek | Açıklama |
|---|---|
| `getStatus()` | Pil %, AC/DC, şarj oluyor mu, mevcut eşikler |
| `stopAt(pct)` | Şarjı **tek bir noktada** durdur (ör. %70) |
| `holdRange(lo, hi)` | **Aralıkta sabit tut**: `hi`'de dur, `lo`'ya inince tekrar başla |
| `resume()` | Eşiği kaldırıp normal şarja dön |
| `disable()` / `fullCharge()` | Sınırı tamamen kapat, %100'e şarj et |
| `getCapabilities()` | Bu cihaz hangi işlemleri destekliyor? |
| `readBack()` | Komuttan sonra gerçek değeri oku (doğrulama) |

**Yeteneğe göre uyarlama:** Bazı cihazlar yalnızca "bitiş eşiği" (tek nokta), bazıları
"başlangıç + bitiş" (aralık), bazıları ise yalnızca mantıksal bir "koruma modu"
(ör. sabit ~%60/80) destekler. Çekirdek, aralık isteğini cihazın yeteneğine göre en yakın
davranışa **indirger** (ör. aralık desteklemeyen cihazda sadece `hi` uygulanır).

---

## 2. Mimari

```
                +----------------------------+
                |        GUI (sonra)         |
                +-------------+--------------+
                              |  JSON / IPC / CLI
                +-------------v--------------+
                |        core (API)          |  <- birleşik komutlar + doğrulama
                +-------------+--------------+
                              |
                +-------------v--------------+
                |  detect  (marka/model/OS)  |
                +-------------+--------------+
                              |
              +---------------+----------------+
              |            backends            |
      +-------v-------+               +--------v--------+
      | Windows (WMI) |               |  Linux (sysfs)  |
      +---------------+               +-----------------+
```

- **detect**: Windows → WMI/DMI/SMBIOS; Linux → `/sys/class/dmi/id/*`.
- **backends**: marka + OS'e göre seçilir. Her arka uç aynı arayüzü uygular.
- **core**: yetenek indirgemesi, doğrulama (komut→geri-okuma), güvenli aralık kontrolü.
- **GUI**: ileride. Çekirdek, GUI'den bağımsız bir **JSON API** sunacak şekilde tasarlanır.

---

## 3. Arka uç matrisi

### 3.1 Linux (jenerik kazanç — "her marka" burada gerçek)

Çekirdek sürücüleri çoğu markayı **ortak sysfs** dosyalarına bağlar
(`/sys/class/power_supply/BAT*/`):

| Dosya | Yetenek |
|---|---|
| `charge_control_end_threshold` | `stopAt(hi)` |
| `charge_control_start_threshold` | aralık alt sınırı (`holdRange`) |
| `charge_behaviour` | `auto` / `inhibit-charge` / `force-discharge` (şarjı engelle/boşalt) |
| `charge_control_limit` | bazı sürücüler (alternatif) |

Birincil yol: **jenerik sysfs**. Markaya özel modüller:

| Marka | Modül | Arayüz |
|---|---|---|
| Lenovo (ThinkPad) | `thinkpad_acpi` | `charge_start_threshold`, `charge_stop_threshold` |
| Lenovo (IdeaPad) | `ideapad_laptop` | `conservation_mode` (0/1, sabit eşik) |
| Asus | `asus-wmi` | `charge_control_end_threshold` (+ eski WMI) |
| Acer | `acer-wmi` | `charge_control_end_threshold` |
| Huawei | `huawei-wmi` | `charge_control_start/end_threshold` |
| Dell | (`dell-laptop`) | genelde **BIOS** — sysfs eşiği yok |
| Diğer | — | jenerik sysfs denenir; yoksa "desteklenmiyor" |

> Kök (root) yetkisi gerekir. Doğrulama: yazdıktan sonra dosyayı geri oku.

### 3.2 Windows (marka-özel WMI — ortak API yok)

| Marka | Arayüz | Not |
|---|---|---|
| Huawei | ACPI-WMI `OemWMIfun` (`root\WMI`) | **Bu projede doğrulandı** (bkz. `docs/huawei-wmi.md`) |
| Asus | `root\WMI` `AsusAtkWmi_WMNB` (`DSTS`/`DEVS`) | charge threshold register'ları |
| Lenovo | `root\WMI` / Vantage sürücüsü | model bazlı; değişken |
| Dell | Dell Command \| Power Manager / SMBiOS | çoğu zaman **BIOS** |
| Acer | `AcerWMI` / oyun bölgesi | model bazlı |
| HP | BIOS "Battery Health Manager" | genelde OS'ten kapalı |
| Diğer | — | "desteklenmiyor + BIOS yönlendirmesi" |

> Windows'ta ortak API olmadığı için kapsam **desteklenen markalar listesi** olur.
> Bilinmeyen cihazda çekirdek dürüstçe "desteklenmiyor" der (yanlış "uygulandı" demez).

---

## 4. Birleşik arayüz (backend sözleşmesi)

Her arka uç şu imzayı uygular (dil-bağımsız sözleşme):

```
detect()           -> { brand, model, os, backendId, confidence }
capabilities()     -> { stopAt: bool, range: bool, behaviour: bool, disable: bool }
getStatus()        -> { percent, powerOnline, charging, startThreshold?, endThreshold?, mode? }
stopAt(pct)        -> { ok, applied, readBack }
holdRange(lo, hi)  -> { ok, applied, readBack }
resume()           -> { ok }
disable()          -> { ok }
```

**Kurallar**
- `pct` aralığı doğrulanır (ör. 40–100); tehlikeli değerler reddedilir.
- Her yazma sonrası **geri-okuma**; tutmuyorsa `ok=true` ama `verified=false` + neden.
- Yetenek yoksa: `range` istenip `stopAt` varsa sadece `hi` uygulanır ve bu bildirilir.
- Kök/yönetici yoksa: anlaşılır hata ("yönetici gerekli").

---

## 5. Güvenlik / geri dönüş

- Varsayılan/iyi huylu değerler; kullanıcıya "sınırı kaldır" kolay çıkışı.
- Yazma öncesi mevcut değeri **fotoğrafla** (restore için).
- Geri-okuma olmadan asla "başarılı" denmez.
- Bilinmeyen komut denemesi yok; yalnızca belgelenmiş arka uç yolları.

---

## 6. Yol haritası

| # | Adım | Durum |
|---|---|---|
| 1 | **detect** (Win + Linux) + yetenek modeli | ✅ |
| 2 | Linux jenerik sysfs arka ucu (stop + range) | ✅ |
| 3 | Linux IdeaPad koruma modu | ✅ |
| 4 | Windows Huawei arka ucu | ✅ (test edildi) |
| 5 | Windows Asus arka ucu | ✅ kodlandı (⚠️ denenmedi) |
| 6 | Windows diğer markalar | ⚠️ dürüst "desteklenmiyor" + prob |
| 7 | CLI + **JSON API** | ✅ |
| 8 | Birim testleri | ✅ |
| 9 | **Win + Linux derleme** (`pkg`) | ✅ |
| 10 | **GUI** | ⬜ (teknoloji sonra) |

---

## 7. Yapılmayacaklar

- Fan/performans modu, termal ayar, BIOS değişikliği **yok** (yalnızca şarj).
- Tehlikeli/uid doğrulanmamış komutlar yok.
- Kullanıcı onayı olmadan kalıcı BIOS değişikliği yok.
