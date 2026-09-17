# A2 Custody Package — Integrity Recheck

**Status:** VERIFICATION ONLY. No file uploaded. No file rewritten. No prior record edited.

## Reconfirmation against commit `9b89d8f`

**Finding, stated precisely:** the four drill files and `F7_CUSTODY_MANIFEST.sha256` were never committed to git. Only `F7_CUSTODY_RECORD_PC5_DRILL_V1.md` — the record *describing* them and citing their hashes in prose — exists at `9b89d8f`. That record is confirmed present and unchanged.

The actual files exist only in this session's container filesystem, at `/home/claude/drill/custody/`. Rechecked directly:

```
road-ltl-1.5-drill-package.json      9b080cff0ea377a5ce939e3708787f9d790759f1f5d16e637bfd14021ca7b963  OK
proof-original.json                  1dc75fcf6d4b0d5741a1725cbe929c6c480f7410080c47d8cd515b8a9007005e  OK
proof-rebuilt.json                   42e735ce6fdeea85cf0cd235fccbad81753d39fc619bc27578476ff34c009469  OK
PC5_DRILL_RECORD_ROAD_LTL_1_5_V1.md  131d7284d0aae8c2d08a2f1407be6c95354a602975060b9bf9fad04a340b7715  OK
F7_CUSTODY_MANIFEST.sha256 (bundle)  d071e7dc60d915ea43ced4aea2fa6375553f2cfe08caa7420bbc2ed69e2045a2  OK
```

**All five: `sha256sum -c` OK. Zero bytes have changed since the manifest was frozen.**

**The sharper finding:** this bundle has now survived unchanged across multiple session turns, but it has done so by accident of container persistence, not by governance. Nothing about its survival was guaranteed. This is the exact condition — proof of recoverability sitting somewhere with no actual custody — that A2 exists to close. It is not closed yet.

## Intended Drive location

**Folder:** `Atlas AR0.3 PC-5 Recovery Drill Custody — Road LTL 1.5 — 2026-09-17`, created at Drive root (parent `0ABy9ZZnbvOFuUk9PVA`), matching the naming convention observed on existing frozen-evidence folders (`D2.0 Atlas V2 Demo Sprint Closure — 2026-09-14`, `Atlas V2 Demo Recovery Checkpoint - 2026-09-12`).

## Archive vs. separate files — recommendation

**Recommend one archive**, not five separate uploads: `atlas-ar0-3-pc5-road-ltl-1.5-drill-custody-2026-09-17.zip`, containing all four files plus the manifest.

**Reasoning, not just preference:** the specific hazard already identified for this bundle is Drive's automatic conversion of uploaded JSON/text to a Google-native type, which silently rewrites content and breaks the hash. That conversion applies to convertible types — it does not apply to a zip binary. Five separate uploads are five independent chances to forget `disableConversionToGoogleType` on any one of them; one zip removes the hazard structurally rather than relying on remembering a flag five times. This also matches existing precedent in Drive for this exact kind of bundle (`atlas-r0-1c-post-qa-governed-custody.zip`, `atlas-r0-2-post-qa-governed-custody-wrapper.zip`).

If uploaded as separate files instead, each of the 5 uploads individually requires `disableConversionToGoogleType: true` — noted here so the requirement is on record regardless of which approach is used.

**Not done in this document:** no folder created, no file uploaded, no existing Drive record touched. Drive write remains unapproved.
