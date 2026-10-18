# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/OWNER/chargeguard/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/OWNER/chargeguard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/OWNER/chargeguard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/OWNER/chargeguard/releases/tag/v0.1.0
