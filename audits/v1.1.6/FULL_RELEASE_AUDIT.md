# v1.1.6 Full Release Audit

**Verdict: PASS — release-certified locally; external deployment/provider gates remain.**

## Certification result

- Final `npm run release:all`: **PASS**
- Explicit PASS lines: **142**
- Explicit FAIL lines: **0**
- Release ID: `scoip-v1.1.6-release-certified-2026.08.24`

## Product and knowledge parity

- Critical Stage 17–21 / canonical / Foundation content byte-identical across v1.1.4 → v1.1.5 → v1.1.6: **TRUE**.
- Frozen Page 0 and integrated Road LTL source HTML byte-identical: **TRUE**.
- Six SQL migrations unchanged from v1.1.5: **TRUE**.
- Page 0 JSON: `c8805c194f87cd795014e4a44f362d67c921f5e0e978b9a29014befafc0fbbd0`.
- Road LTL JSON: `2d5c78d4480bb693747bcb18a2c006b3fe0a63e6150c506e84ea3e4c5f3f6cfd`.
- Stage 17–21 donor JS hashes are unchanged.
- `index.html` differs from v1.1.5 only in release-identity text; the spatial renderer and Stage 17–21 logic are not rewritten.

## Versioning discipline

The **application release** is v1.1.6. Atlas schema/catalog versions remain at their prior values because their schemas/content did not change. This intentionally avoids conflating product release numbering with governed knowledge/schema versioning.

## Spatial canvas — real Chromium certification

Desktop 1440×900 and mobile 390×844 both passed:

- 15 spatial territories
- 0 boxed `.territory` nodes
- ambient mesh present
- 110 ambient dots
- minimap / ATLAS VIEW present
- semantic zoom active
- Play / Freeze / Trace / Lens / Compose / Fit / Inspector present
- Stage 17, 18, 19, 20 and 21 runtime objects initialized
- zero browser runtime errors
- zero horizontal overflow

The browser certificate is **fail-closed**: no Chromium means release certification fails. In this sandbox, administrator policy blocks localhost/file navigation, so the self-contained preview is injected into a real Chromium frame via Chrome DevTools Protocol `Page.setDocumentContent`; the assertions run against the live browser DOM, not stored JSON.

## Backend / release engineering

- 8 serverless functions
- 28 public API paths
- `/api/version` returns v1.1.6 release ID
- `/api/release-integrity` returns HTTP 200 with 28/28 critical files
- Generated Stable package: 105 files
- Generated Lab package: 132 files
- Stable excludes AP fixture and pilot corpus
- Lab retains AP fixture and evaluation workbench
- 80 active JS/MJS files syntax-checked: 0 failures
- 71 destinations / 2,130 synthetic processes scale smoke: PASS

## Security / pilot guards

- Supabase Security Advisor: **0 findings**
- Supabase Performance Advisor: INFO-only unused-index notices; no security blocker
- Session-ephemeral application persistence: NONE
- Gemini request `store=false`: PASS
- Gemini API key not placed in URL: PASS
- required LLM path fails closed: PASS
- Pilot User cannot directly publish Foundation changes: PASS
- Stage 23 prompt-injection and unsupported-FTL guard cases present

## What v1.1.6 changes from v1.1.5

Only release engineering / release metadata / certification assets changed: release identity, active integrity baseline and endpoint wiring, package builders/checkers, strict browser certificate, canonical guards, docs/audit evidence, and embedded standalone release metadata. Canonical Page 0, Road LTL, core/domain ontology content, Stage 17–21 JS, module/domain catalogs, migrations, and transformation/rule content are unchanged.

## Remaining external gates

1. Live Gemini synthetic certification after provider configuration.
2. Exact Vercel Lab deployed HTTP/browser E2E.
3. `package-lock.json` generation when npm registry access is available; exact dependency versions are pinned in `package.json`, but the lockfile is still absent.
4. Isolated Supabase restore/PITR rehearsal remains deferred and is not a runtime dependency; it remains a recovery-certification gate before persistent confidential production retention.

## Donor ZIP hashes

- v1.1.4 full-parity GitHub: `6a6578430e8b06e14536f03205190758fe444825132415de6f0da6dac42ef938`
- Claude v1.1.5: `006e3f2659ddc7164da2967b7c497976937de34cb55fd02c5744845c642b5ea3`
