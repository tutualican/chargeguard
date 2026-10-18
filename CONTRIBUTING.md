# Contributing to ChargeGuard

Thanks for your interest! ChargeGuard is a cross-brand battery charge limiter for
Windows and Linux. Contributions are welcome — especially new **backend** support
and issue reports from real hardware.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Contributions are accepted under the [Apache-2.0](LICENSE) license.

## Development

Requirements: **Node.js >= 18**. No build step is needed to run from source.

```bash
git clone https://github.com/OWNER/chargeguard.git
cd chargeguard
npm install
npm test                 # run the unit tests
node src/cli.js status   # run from source
```

## Project layout

- `src/core.js` — unified API (capability reduction + read-back verification)
- `src/detect.js` — brand/model/OS detection
- `src/backends/` — one file per OS/brand; all implement the same contract
- `src/cli.js`, `src/menu.js`, `src/server.js` — interfaces
- `test/` — unit tests (fake sysfs/files; no special hardware needed)

See [`DESIGN.md`](DESIGN.md) for the architecture and the backend contract.

## Adding a backend

1. Implement the contract (`capabilities`, `getStatus`, `stopAt`, `holdRange`,
   `disable` / `conserve`) in `src/backends/`.
2. Register it in `src/backends/index.js` (OS + brand + probe).
3. **Always read back** after a write and report the truth; never claim success
   without verification.
4. Add tests using an injected/fake device — do not rely on CI hardware.
5. Document the protocol in `docs/`.

## Guidelines

- Keep changes focused; match the existing style (2-space indent, ESM).
- **No machine-specific paths, serial numbers, or personal data** in code, tests,
  docs, or issues.
- Every new write path must be covered by a test and must read back.
- Run `npm test` before opening a pull request.

## Commit messages

Clear, imperative subject lines (e.g. `win: add MSI backend probe`). Reference an
issue where relevant.

---

Türkçe katkı da memnuniyetle karşılanır. Lütfen testlerin (`npm test`) geçtiğinden
ve kişisel/makineye özel bilgi eklemediğinizden emin olun.
