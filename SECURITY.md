# Security Policy

## Supported versions

This project is pre-1.0; security fixes target the latest release.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via GitHub's
[Security Advisories](https://github.com/tutualican/chargeguard/security/advisories/new).

Include: affected version, OS, laptop model, steps to reproduce, and impact.

## Scope & safety notes

ChargeGuard writes hardware charge thresholds through vendor WMI (Windows) or
sysfs (Linux). It:

- validates ranges and refuses dangerous values,
- reads the value back after **every** write,
- only uses documented, vendor-specific paths,
- says `"unsupported"` instead of guessing.

It never touches fans, performance modes, or BIOS. Please report any code path
that writes without read-back verification.
