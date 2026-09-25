# Dependency lock status — v1.1.6

- `package.json` uses exact production dependency versions and Node `24.x`.
- No `package-lock.json` is included in this release.
- A lockfile-generation attempt was made in the build environment on 2026-08-24, but npm registry resolution did not complete within the available execution window.
- This is **not a runtime feature defect** and does not alter the certified source/package parity.
- It remains an external Stable-promotion hardening gate: generate and commit the lockfile when registry access is available, then rerun the release certification before final confidential production promotion.
