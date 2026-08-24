# Final Package Inventory

**Product:** Supply Chain Operations Intelligence Platform — Pilot V1.0  
**Lineage:** Atlas V6.2.3 + frozen Page 0 V6.2.2 + Road LTL V1.2 + Intelligence v0.6.6 + Stage 23 V1  
**Files at inventory freeze:** 435

## Root runtime
- `index.html` — hosted application shell
- `preview-standalone.html` — fully inlined offline visual/runtime preview
- `assets/` — cumulative Stage-23 canvas/workbench runtime
- `api/` — Vercel Functions for grounded chat, auth/workspaces, document intelligence, exports, collaboration, telemetry and release health

## Governed data
- `data/page0/page0-v6.2.2.json`
- `data/modules/road-ltl-v1.2.json`
- `data/atlas-registry.json`
- Enterprise core/domain contracts + Supply Chain domain pack
- Lab-only Accounts-Payable neutrality fixture

## Frozen reference sources
- exact Page 0 V6.2.2 frozen original
- exact integrated Page 0 + Road LTL V1.2 original
- source manifest/download launcher

## Governance & production
- rule/overlay/evidence/command/version contracts
- Supabase RLS migrations
- production architecture/security/API documentation
- Pilot test plan, 10 synthetic cases and evaluation harness
- release/runbook/security/restore/checklist documentation

## Deployment packages
- `release/packages/lab/` — includes domain-neutrality fixtures and evaluation assets
- `release/packages/stable/` — excludes the non-publishable Accounts-Payable fixture

The final cryptographic inventory is in `FINAL_PACKAGE_MANIFEST.json`.
