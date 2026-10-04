# S8-4 — Controlled Interaction Rebinding

Stage: S8-4 (REBIND only; not a redesign). Base: S8-3E final head `fe17ebb5c77fe86ef44a68d8a38eab65b5ce4751` (authoritatively assigned; the corrected S8 lineage is the successor spine). Historical presentation branches are donors, never bases.

Assembly: corrected S8-3E lineage + certified Canvas V2.0 + certified Canvas→Daughter bridge V2.0.1 + certified Universal Ask 2.0.1 + ATL-140 additive UX behaviour (rebound).

## Donors (see `s8-4-evidence/donor-provenance.json` for exact paths and blobs)

| Donor | Source | Authority | Handling |
|---|---|---|---|
| Canvas V2.0 (index `4dfa0a84`, css `860c8784`, js `672dd1b5`, freeze cert `cff24980`) | P6.2 `6ae00356…` | S7-IMP-029 / S6-LIN-007 | Already present in the S8 base, byte-identical; untouched. |
| Canvas→Daughter bridge V2.0.1 (`264e4ed2…`) | P6.2 `6ae00356…` | S7-IMP-030 / S6-LIN-008 | Imported byte-identically. |
| Universal Ask 2.0.1 (runtime `521c47a3`, API `8fa80f9d`, contract `608956d3`, retrieval `6f3c29dc`, cert `d0dfd8b2`) | P5 `814d2e7d…` | S7-IMP-031 / S6-LIN-010 | Runtime/contract/cert already in base (identical); API + governed retrieval + dependency closure imported byte-identically. |
| ATL-140 additive UX behaviour | ATL-140 `e0c17bbb…` | S7-IMP-005 / S6-LIN-009 SALVAGE_REBIND | Behaviour only; rebound (below). ATL-140 root `index.html` (`9cf88a86`) is not inherited. |

Prohibited and absent: ATL-142 `dba6968b…` (root `index.html` `379f988c`, WRONG_DONOR / REPLACE_ASSEMBLY) and the superseded Ask API blob `cb2bcfea…` (S7-IMP-037 / S6-LIN-011).

## What changed (minimum)

1. **Donor import (23 files, byte-identical to donor blobs, except one governed adaptation).** The certified Ask API and bridge require the P2/P3/P4 dependency closure (capability gate `requireCapabilities` in `_utils.js`, `lib/projections/execution-depth-projection.js`, `api/atlas.js` router, `daughter.html` + `assets/universal-daughter-renderer-v2.js`, governed target/source registries, `vercel.json`/`package.json` wiring, the donor's own p2–p5/router-smoke tests, and the materialized public-safe Ocean 0.6 projection payload). The closure was determined empirically: it is the smallest set that makes the certified P2–P5 suites and the router smoke pass on the S8 base. All 8 modified shared files were unchanged in S8 since the common ancestor, so donor blobs apply without merge.
2. **One governed adaptation.** `execution/ui/runtime-access-shell.js` = P5 donor blob `b72d0c88…` + exactly one appended line bootstrapping `/assets/atl-140-v15-journey.mjs`. Reason: the certified root `index.html` and Canvas assets must stay byte-identical (the certified P4 test asserts it), so ATL-140's journey is added the same additive way the certified bridge is. The donor blob stays separately identifiable in provenance.
3. **ATL-140 behaviour rebound (new files).**
   - `assets/atl-140-v15-journey.mjs` — the "Road LTL → governed work intelligence → Malkom output" journey (text, three links, public/protected note) as an additive fixed launcher. The work-detail link is built by the certified bridge (`resolveDaughterTarget` + `buildDaughterHref`) from the governed target registry; if the registry does not resolve, the link is disabled (fail closed).
   - `assets/atl-140-consumer-view.mjs` + `atl-140-malkom-consumer.html` — the Malkom consumer view (readiness cards, 7-column deterministic requirements crosswalk with the four ATL-140 requirements, fail-closed state, lineage-mismatch error, aria-live, responsive layout, export/lineage). It reads **only** the four public, non-reconstructive S8-3B..3E evidence summaries, validates every hash link against the pinned chain and fails closed on any mismatch or promotion claim. It adds a public "Generated flow" section (counts and hashes only).
4. **Tests and evidence.** `tests/s8-4-interaction-rebinding.test.mjs`, `s8-4-evidence/{donor-provenance.json, run-exact-qa.cjs, e2e-smoke.mjs, exact-qa.json}`.

## Behaviour differences from ATL-140 (corrections, not inventions)

- Stale ATL-140 lineage (`wd::road-ltl::LTL-04::v1`, `malkom-dw::…::v1`, `data/generated/*ltl04*`) is replaced by the corrected S8 identity `road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD` and the pinned S8-3B..3E hashes.
- The protected package detail ATL-140 displayed (source ids, nextQuestion text, downloadable package JSON) is EXECUTION_PROTECTED after S8-3C..3E and is not republished; the view shows non-reconstructive coverage/hash evidence instead.
- "Trace flow" targets the public generated-flow evidence section (the graph/BPMN/SVG are protected). "Road LTL work detail" targets the certified Daughter route; LTL-04 is not publicly materialized, so the Daughter and Ask surfaces fail closed (404) for LTL-04 by design.

## Not done / out of scope (STOP boundaries held)

No Canvas redesign; no V2 scope; ATL-142 not used; the ATL-167 interaction slice and ATL-178 explorer pages are not rebound (outside the S8-4 authorization); S8-3A–3E outputs untouched; no runtime/release promotion (runtime BLOCKED, `materializable=false`, executor `NOT_INDEPENDENTLY_PROVEN`); no S8-3F/S8-5/S8-6 work; ATL-181 blocked until S8-6; release DO NOT MERGE.

## Residuals

- Inherited `release/packages/{lab,stable}/lib/api/ask-atlas.js` still carry the superseded blob `cb2bcfea` (present in the S8-3E base and in the P5/P6.2 donor trees). S8-4 introduces none and does not touch `release/`; successor-assembly cleanup belongs to S8-6.
- DEF-DAU-007 (ATL-142 history-navigation release blocker) remains open and out of scope.
- The certified root `index.html` renders a stray literal `\n` text at the top-left (pre-existing in the certified blob; not altered).
- Pre-existing failures identical on the S8-3E base: `tests/v2-ui-browser-smoke.mjs`, `tests/v1.1.4-static-parity.mjs` (not part of the gating set).
- QA ran on Node v22 (repo `engines` states 24.x).
- A PR to `main` carries stacked unmerged S8 predecessors; its diff is NOT standalone merge authority.
