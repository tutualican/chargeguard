# ChargeGuard

[![Lisans: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/tutualican/chargeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/tutualican/chargeguard/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey.svg)](#uyumluluk)

> **Sadece pil** şarj sınırlama — **Windows + Linux**. Fan/performans/termal ayar **yok**;
> yalnızca *batarya ne zaman şarj olsun*.

ChargeGuard, dizüstünün gömülü denetleyicisine (EC) **ne zaman şarj edileceğini**
söyler:

- **Belirli bir noktada durdur** — örn. %80'de dur.
- **Aralıkta tut** — örn. %65–80: `hi`'de dur, `lo`ya inince başla.
- **Koruma modu** — yalnızca sabit eşik sunan modeller (örn. Lenovo IdeaPad).
- **Sınırı kaldır** — tekrar tam şarj.

**Dürüst çalışır:** cihaz/marka desteklenmiyorsa `desteklenmiyor` der, "uygulandı"
yalanı söylemez.

[🇬🇧 English README](README.md)

## Öne çıkanlar

- **Linux'ta çok marka**: jenerik sysfs (`charge_control_*`).
- **Windows**: marka-özel WMI — Huawei (gerçek cihazda doğrulandı), Asus (denenmedi);
  diğer markalar dürüstçe `desteklenmiyor`.
- Her yazma sonrası **geri-okuma**; asla körlemesine "başarılı" denmez.
- **Yetenek indirgeme**: tek bir `hold lo hi` isteği, cihazın desteklediği en yakın
  davranışa uyarlanır.
- **CLI**, **etkileşimli menü**, **JSON API** (gelecekteki GUI için) ve **arka plan
  daemon + otomatik başlatma**.

## Uyumluluk

| Marka | Linux | Windows |
|---|---|---|
| **Huawei** | ✅ jenerik sysfs (`huawei-wmi`) | ✅ ACPI-WMI `OemWMIfun` — **gerçek cihazda doğrulandı** |
| **Asus** | ✅ jenerik sysfs (`asus-wmi`) | ⚠️ `AsusAtkWmi_WMNB` — denenmedi (donanım yok) |
| **Lenovo** | ✅ ThinkPad `thinkpad_acpi` / IdeaPad koruma modu | ❌ açık API yok (Vantage/BIOS) |
| **Acer** | ✅ jenerik sysfs (`acer-wmi`) | ❌ açık API yok |
| **Dell** | ⚠️ `dell-wmi-battery` sürücüsü varsa | ❌ açık API yok |
| **HP** | ⚠️ bazı modellerde sysfs | ❌ açık API yok |
| **Diğer** (MSI/Samsung/Xiaomi…) | ⚠️ jenerik sysfs denenir | ❌ prob sonrası `desteklenmiyor` |

> Linux'ta jenerik `/sys/class/power_supply/BAT*/charge_control_*` **çok marka** çalışır.
> Windows'ta ortak API yoktur; kapsam marka başına belirlenir.

## Kurulum

### Hazır derlemeler

[Releases](https://github.com/tutualican/chargeguard/releases) sayfasından indir:

- `chargeguard-win.exe` — Windows
- `chargeguard-linux` — Linux

Node.js gerekmez.

### Kaynaktan

**Node.js >= 18** gerekir.

```bash
git clone https://github.com/tutualican/chargeguard.git
cd chargeguard
npm install
node src/cli.js status
```

## Kullanım

### Etkileşimli menü

Binary'ye **çift tıkla** (ya da argümansız çalıştır). Menü açık kalır; durum,
yetenekler, aralık/nokta ayarı, salt-okuma izleyici ve otomatik başlatma sunar.

### CLI

```
chargeguard detect            # marka / model / OS
chargeguard probe             # Windows'ta bulunan WMI sınıfları
chargeguard caps              # bu cihazın yetenekleri
chargeguard status            # pil %, AC/DC, eşikler
chargeguard stop 80           # %80'de durdur
chargeguard hold 65 80        # %65-80 aralığında tut
chargeguard conserve on|off   # koruma modu (örn. IdeaPad)
chargeguard off               # sınırı kaldır (tam şarj)
chargeguard watch 65 80       # SALT-OKUMA: döngüyü kanıtla
chargeguard serve             # JSON API → http://127.0.0.1:8731
```

> Windows'ta WMI, Linux'ta sysfs yazımı için **yönetici / root** gerekir.

### Arka plan + otomatik başlatma

Menüde **[7] Otomatik başlatma**: seçtiğin ayarı kaydeder ve **oturum açılışında**
başlatır:

- **Windows**: Görev Zamanlayıcı, *en yüksek ayrıcalık*, *oturum açılışında*, gizli —
  UAC sormaz, konsol penceresi açılmaz.
- **Linux**: `systemd` servisi (`/etc/systemd/system/chargeguard.service`); ayar
  `/etc/ChargeGuard/config.json` konumuna kopyalanır (root daemon okur).

```
chargeguard apply                  # kayıtlı ayarı şimdi uygula
chargeguard daemon                 # arka plan döngüsü (sapmayı düzeltir)
chargeguard autostart on|off|status
```

Ayar / günlük:

```
Windows  config : %APPDATA%\ChargeGuard\config.json
Windows  log    : %APPDATA%\ChargeGuard\daemon.log
Linux    config : /etc/ChargeGuard/config.json   (systemd kurulumu)
```

### Alt eşiğe (`lo`) düşme

Şarj sınırı **şarjı durdurur**, boşalmayı zorlayamaz. Fişteyken cihaz prizden
çalışır ve pil **`hi`'de sabit kalır** (kendiliğinden düşmez). `lo`'ya inmek için
**fişten çıkar** (bataryada kullan); seviye `lo`'ya gelince şarj `hi`'ye kadar
yeniden başlar. `lo`–`hi` arasında fişe takarsan şarj **etmez** (gereksiz doldurmaz).

## JSON API

`chargeguard serve` → `http://127.0.0.1:8731` (`CG_PORT` / `CG_HOST` ile değişir).

| Metot & yol | Gövde | Döner |
|---|---|---|
| `GET /device` | — | marka / model / OS |
| `GET /caps` | — | yetenekler |
| `GET /status` | — | pil durumu |
| `POST /stop` | `{"pct":80}` | sonuç + geri-okuma |
| `POST /hold` | `{"lo":65,"hi":80}` | sonuç + geri-okuma |
| `POST /conserve` | `{"on":true}` | sonuç |
| `POST /off` | — | sonuç |

## Derleme (Windows + Linux)

```bash
npm install
npm run build     # → dist/chargeguard-win.exe ve dist/chargeguard-linux
```

Yöntem: `esbuild` (ESM → tek CJS) + `@yao-pkg/pkg` (Node 22 tabanı). Çıktılar
bağımsızdır (hedefte Node.js gerekmez).

## Yapı

```
chargeguard/
├─ DESIGN.md              mimari (Türkçe)
├─ docs/                  protokol notları (örn. huawei-battery-wmi.md)
├─ src/
│  ├─ cli.js              CLI + giriş noktası
│  ├─ menu.js             etkileşimli menü
│  ├─ server.js           JSON API
│  ├─ core.js             birleşik API + yetenek indirgeme + geri-okuma
│  ├─ detect.js           marka / model / OS (14+ marka)
│  ├─ config.js           kalıcı ayar + günlük yolları
│  ├─ service.js          apply / daemon
│  ├─ autostart.js        Görev Zamanlayıcı (Win) + systemd (Linux)
│  ├─ info.js             kullanıcı bilgilendirmeleri
│  ├─ wmi.js              Windows WMI / PowerShell yardımcıları
│  └─ backends/
│     ├─ index.js            OS + marka + prob ile seçim
│     ├─ linux-sysfs.js      jenerik (çok marka)
│     ├─ linux-ideapad.js    koruma modu
│     ├─ win-huawei.js       ACPI-WMI (doğrulandı)
│     ├─ win-asus.js         AsusAtkWmi (denenmedi)
│     └─ win-unsupported.js  dürüst "desteklenmiyor"
└─ test/                  birim testleri (sahte sysfs/dosya; özel donanım gerekmez)
```

## İlkeler

- Yazma sonrası **geri-okuma** olmadan asla "başarılı" denmez.
- Ortak API yoksa **dürüst** ol: `desteklenmiyor`.
- Yalnızca belgelenmiş, marka-özel güvenli yollar; rastgele register yazımı yok.
- Sadece pil: fan/performans/termal kontrol yok.

## Katkı

[`CONTRIBUTING.md`](CONTRIBUTING.md) dosyasına bakın. Güvenlik bildirimi için önce
[`SECURITY.md`](SECURITY.md). Katılım [Davranış Kuralları](CODE_OF_CONDUCT.md) ile
yönetilir.

## Lisans

[Apache-2.0](LICENSE) © tutualican ve ChargeGuard katkıcıları.
