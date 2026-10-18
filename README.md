# ChargeGuard

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/tutualican/chargeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/tutualican/chargeguard/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey.svg)](#compatibility)

> **Battery-only** charge limiting for **Windows and Linux**. No fan, performance
> or thermal control — only *when the battery charges*.

ChargeGuard talks to your laptop's embedded controller (EC) to control **when the
battery charges**, so you can:

- **Stop charging at a point** — e.g. stop at 80%.
- **Hold a range** — e.g. 65–80%: stop at `hi`, resume at `lo`.
- **Conservation mode** — on models that only expose a fixed threshold (e.g. Lenovo IdeaPad).
- **Remove the limit** — charge to full again.

It is **honest by design**: if a device/brand has no supported path, it says
`unsupported` instead of pretending it worked.

[🇹🇷 Türkçe için `README.tr.md`](README.tr.md)

## Highlights

- **Cross-brand on Linux** via generic sysfs (`charge_control_*`).
- **Windows** via vendor WMI: Huawei (verified on real hardware), Asus (best-effort);
  other brands report `unsupported` honestly.
- **Read-back verification** after every write — never claims success blindly.
- **Capability reduction**: one `hold lo hi` request is adapted to whatever the
  device actually supports.
- **CLI**, **interactive menu**, **JSON API** (for a future GUI) and a **background
  daemon with auto-start**.

## Compatibility

| Brand | Linux | Windows |
|---|---|---|
| **Huawei** | ✅ sysfs (`huawei-wmi`) | ✅ ACPI-WMI `OemWMIfun` — **verified on a real device** |
| **Asus** | ✅ sysfs (`asus-wmi`) | ⚠️ `AsusAtkWmi_WMNB` — untested (no hardware) |
| **Lenovo** | ✅ ThinkPad `charge_*_threshold` / IdeaPad `conservation_mode` | ❌ no public API (Vantage/BIOS) |
| **Acer** | ✅ sysfs (`acer-wmi`) | ❌ no public API |
| **Dell** | ✅ sysfs (with the `dell-wmi-battery` driver) | ❌ no public API (Dell Command / BIOS) |
| **HP** | ⚠️ some models via sysfs | ❌ no public API (HP BIOS) |
| **LG** | ✅ `battery_care_limit` | ❌ no public API |
| **System76 / Framework / others** | ✅ universal sysfs scan | ❌ `unsupported` after probe |

> **Linux — universal by design.** The backend does not use a fixed name list:
> it scans the battery directory **and** vendor platform directories and uses
> whatever the kernel exposes — `charge_control_end_threshold`,
> `charge_control_start_threshold`, ThinkPad `charge_start/stop_threshold`,
> `charge_behaviour` (`auto`/`inhibit-charge`), `conservation_mode` and
> `battery_care_limit`. Because the kernel standardizes these, this covers the
> large majority of laptops.
>
> **Windows — no common API.** Support is a per-brand list; where a safe,
> documented path does not exist ChargeGuard reports `unsupported` rather than
> writing blindly. Run `chargeguard doctor` for a clear verdict and next steps.

Run **`chargeguard doctor`** (or menu **[9]**) on any machine to see exactly what
works there:

## Install

### Prebuilt binaries

Download from the [Releases](https://github.com/tutualican/chargeguard/releases) page:

- `chargeguard-win.exe` — Windows
- `chargeguard-linux` — Linux

No Node.js required.

### From source

Requires **Node.js >= 18**.

```bash
git clone https://github.com/tutualican/chargeguard.git
cd chargeguard
npm install
node src/cli.js status
```

## Usage

### Interactive menu

Double-click the binary (or run it with no arguments). The menu stays open and
offers status, capabilities, setting a range/point, the read-only watcher, and
auto-start.

### CLI

```
chargeguard detect            # brand / model / OS
chargeguard doctor            # what can this device do? (clear verdict + steps)
chargeguard probe             # Windows: WMI classes + BIOS candidates found
chargeguard caps              # what this device supports
chargeguard status            # battery %, AC/DC, thresholds
chargeguard stop 80           # stop charging at 80%
chargeguard hold 65 80        # hold between 65% and 80%
chargeguard conserve on|off   # conservation mode (e.g. IdeaPad)
chargeguard off               # remove the limit (charge to full)
chargeguard watch 65 80       # READ-ONLY: prove the charge cycle
chargeguard serve             # JSON API on http://127.0.0.1:8731
```

> Writing thresholds needs **administrator** (Windows) or **root** (Linux).

### Background + auto-start

Menu option **[7] Auto-start** saves your chosen setting and starts it at login:

- **Windows**: Scheduled Task, *highest privileges*, *at log on*, hidden — no UAC
  prompt and no console window.
- **Linux**: `systemd` service (`/etc/systemd/system/chargeguard.service`); the
  config is copied to `/etc/ChargeGuard/config.json` so the root daemon can read it.

```
chargeguard apply                  # apply the saved config now
chargeguard daemon                 # background loop (re-applies on drift)
chargeguard autostart on|off|status
```

Config / logs:

```
Windows  config : %APPDATA%\ChargeGuard\config.json
Windows  log    : %APPDATA%\ChargeGuard\daemon.log
Linux    config : /etc/ChargeGuard/config.json   (systemd install)
```

### About the lower threshold (`lo`)

The charge limit **stops charging** — it cannot force discharging. While plugged
in, the laptop runs on AC and the battery **stays** at `hi` (it does not drop on
its own). To reach `lo`, **unplug** (run on battery); when the level falls to
`lo`, charging resumes up to `hi`. Plugging back in *between* `lo` and `hi` does
**not** charge, which avoids needless top-ups.

## JSON API

`chargeguard serve` → `http://127.0.0.1:8731` (`CG_PORT` / `CG_HOST` to change).

| Method & path | Body | Returns |
|---|---|---|
| `GET /device` | — | brand / model / OS |
| `GET /caps` | — | capabilities |
| `GET /status` | — | battery status |
| `POST /stop` | `{"pct":80}` | result + read-back |
| `POST /hold` | `{"lo":65,"hi":80}` | result + read-back |
| `POST /conserve` | `{"on":true}` | result |
| `POST /off` | — | result |

## Build (Windows + Linux)

```bash
npm install
npm run build     # → dist/chargeguard-win.exe and dist/chargeguard-linux
```

Method: `esbuild` (ESM → single CJS) + `@yao-pkg/pkg` (Node 22 base). The outputs
are standalone (no Node.js needed on the target).

## Project structure

```
chargeguard/
├─ DESIGN.md              architecture (Turkish)
├─ docs/                  protocol notes (e.g. huawei-battery-wmi.md)
├─ src/
│  ├─ cli.js              CLI + entry point
│  ├─ menu.js             interactive menu
│  ├─ server.js           JSON API
│  ├─ core.js             unified API + capability reduction + read-back
│  ├─ detect.js           brand / model / OS (14+ brands)
│  ├─ config.js           persistent config + daemon log paths
│  ├─ service.js          apply / daemon
│  ├─ autostart.js        Task Scheduler (Win) + systemd (Linux)
│  ├─ info.js             user-facing explanations
│  ├─ doctor.js           per-device verdict + guidance
│  ├─ wmi.js              Windows WMI / PowerShell helpers
│  └─ backends/
│     ├─ index.js            OS + brand + probe selection
│     ├─ linux-sysfs.js      generic (multi-brand)
│     ├─ linux-ideapad.js    conservation mode
│     ├─ win-huawei.js       ACPI-WMI (verified)
│     ├─ win-asus.js         AsusAtkWmi (untested)
│     └─ win-unsupported.js  honest "unsupported"
└─ test/                  unit tests (fake sysfs/files; no special hardware)
```

## Principles

- Never report success without **read-back** verification.
- Be **honest** when no common API exists: `unsupported`.
- Only documented, vendor-specific safe paths — no random register writes.
- Battery only: no fan, performance, or thermal control.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Please read [`SECURITY.md`](SECURITY.md)
before reporting security issues. Participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

[Apache-2.0](LICENSE) © tutualican and ChargeGuard contributors.
