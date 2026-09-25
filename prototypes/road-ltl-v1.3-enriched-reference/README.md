# Road LTL V1.3 — Enriched Daughter Module

Road LTL V1.3 is a non-lossy enrichment of the frozen V1.2 domain model. It retains the complete V1.2 semantics and adds the structured metadata required by the Atlas Daughter Module Production Standard V1.

## Files
- `model/road-ltl-v1.3.json` — canonical enriched daughter model.
- `reference/road-ltl-v1.3.html` — standalone daughter reference page using the V1.2 interaction donor with additive Inspector enrichment.
- `governance/road-ltl-rule-pack-v1.3.json` — declarative capture of current daughter-page rules; not wired into Canvas yet.
- `sidecars/` — certified v1.1.8 provenance/exchange/temporal sidecars used as enrichment evidence.
- `audits/` — pre/during/post regression and Canvas parity evidence.

## Key guarantee
No Canvas code is modified by this package. Final freeze requires Canvas resolver parity between V1.2 and V1.3.
