# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-10-18

### Added
- **TLP backend (Linux).** On systems that already use
  [TLP](https://linrunner.de/tlp/), ChargeGuard can drive it directly through
  `tlp setcharge <start> <stop>` and `tlp setcharge off`:
  - `chargeguard tlp` — is TLP installed? (path/version)
  - `chargeguard --backend tlp hold 65 80` / `stop 75` / `off`
  - `--backend tlp` (or `CG_BACKEND=tlp`) forces TLP; automatic mode still
    prefers direct kernel sysfs and falls back to TLP only when no sysfs charge
    control exists.
- `doctor` now reports TLP presence/version on Linux.
- Tests for TLP command generation, status read-back and error mapping.

### Changed
- Help text no longer says "private" (the project is public).
- Documented TLP usage in both READMEs.

## [0.4.0] - 2026-10-18

### Added
- **Universal Linux discovery.** The generic sysfs backend no longer relies on a
  fixed name list: it scans the battery directory **and** vendor platform
  directories and uses whatever charge control is present — `charge_control_*`,
  ThinkPad `charge_start/stop_threshold`, `charge_behaviour`
  (`auto`/`inhibit-charge`), `conservation_mode` (IdeaPad) and `battery_care_limit`
  (`lg-laptop`). This is what makes "works on every laptop" real on Linux, where
  the kernel standardizes these attributes.
- **`doctor` command** (also menu option **[9]** and `npm run doctor`): prints a
  clear per-device verdict (`CALISIYOR` / `KISMI` / `DESTEKLENMIYOR`) with the
  detected backend, capabilities, live status, and concrete next steps.
- **Deeper Windows probe.** `probe` now checks a broad list of candidate vendor
  WMI classes (Huawei, Asus, Lenovo, MSI, Acer, Dell DCPM, HP InstrumentedBIOS)
  and reads any battery/charge **BIOS settings** exposed via HP/Dell/Lenovo WMI
  (read-only) so unsupported machines can be diagnosed instead of failing silently.
- New Linux tests covering the extra attribute families (ThinkPad, behaviour,
  conservation, `battery_care_limit`) and `doctor` verdict/guidance logic.

### Changed
- `linux-sysfs` reports `conservation` as a first-class capability.
- Updated compatibility docs and the Windows guidance strings.

## [0.3.0] - 2026-10-18

### Added
- **Background daemon + auto-start at login.**
  - Windows: Scheduled Task with *highest privileges*, triggered *at log on*,
    running hidden (no console window, no UAC prompt).
  - Linux: `systemd` service (`/etc/systemd/system/chargeguard.service`); the
    user configuration is copied to `/etc/ChargeGuard/config.json` so the root
    daemon can read it.
- Persistent configuration (`%APPDATA%\ChargeGuard\config.json`,
  `~/.config/ChargeGuard/config.json`) and a daemon log
  (`daemon.log`).
- **"Lower-threshold" informational notes** in the interactive menu, in
  `hold`/`stop` results (`note` field) and in the watcher header, explaining
  that the battery does not discharge while plugged in and that reaching `lo`
  requires unplugging.
- Linux hardening: the menu uses `getuid()` for privilege checks and prints a
  `sudo` hint (`[8]`) instead of invoking PowerShell; the systemd unit is built
  by a pure, unit-tested function.

### Changed
- The auto-start task runs hidden and elevates without a UAC prompt.

## [0.2.0] - 2026-10-17

### Added
- Interactive menu when launched with no arguments (double-clicking the binary).
- Read-only hysteresis watcher (`watch`) that proves the charge cycle at the
  `lo`/`hi` edges and prints a verdict.
- Windows + Linux single-file builds via `esbuild` + `@yao-pkg/pkg`.

## [0.1.0] - 2026-10-16

### Added
- Initial core: brand/OS detection (`detect`), capability model and probe.
- Backends: Huawei ACPI-WMI (Windows, device-verified), generic Linux sysfs
  (multi-brand), Lenovo IdeaPad conservation mode, honest "unsupported" fallback.
- Unified core API with capability reduction and mandatory read-back
  verification.
- CLI (`detect`, `probe`, `caps`, `status`, `stop`, `hold`, `conserve`, `off`).
- JSON API (`serve`) intended for a future GUI.

[Unreleased]: https://github.com/tutualican/chargeguard/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/tutualican/chargeguard/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/tutualican/chargeguard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/tutualican/chargeguard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/tutualican/chargeguard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/tutualican/chargeguard/releases/tag/v0.1.0
