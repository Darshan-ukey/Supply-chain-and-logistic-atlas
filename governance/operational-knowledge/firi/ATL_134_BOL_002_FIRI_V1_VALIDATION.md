# ATL-134 — BOL-002 FIRI v1 Candidate

Implementation evidence for ATL-134. This is a **candidate pending independent QA**, not a self-frozen asset.

## Design gate

- **MALKOM_UTILITY: PASS_CANDIDATE** — the contract provides reusable field-resolution semantics a Malkom implementation can consume rather than rediscover.
- **CONSUMER_INDEPENDENCE: PASS_CANDIDATE** — canonical rules are runtime-neutral and a VLM/agent/document-digitization consumer can use the same contract without Malkom constructs.

## Non-blocking unresolved research

- Handling Unit Line No universal semantics: deliberately not inferred.
- Continuation/attachment universal precedence: deliberately not invented.

## Adversarial vectors

- T01 — **1 pallet / 1 commodity: PASS** — Preserve one HandlingUnit and one positively established CommodityItem; associate description by evidence, not pallet count.
- T02 — **1 pallet / multiple commodities: PASS** — Represent multiple CommodityItems under/shared with one HandlingUnit when evidence establishes them; descriptions remain separate.
- T03 — **multiple pallets / same commodity: PASS** — Do not duplicate commodity identity solely from HU count; preserve HU↔commodity associations.
- T04 — **multiple commodities / multiple handling units: PASS** — Many-to-many association permitted; no forced 1:1 collapse.
- T05 — **description + NMFC: PASS** — Description is observed separately; NMFC corroborates/validates but does not replace observed text.
- T06 — **vague description PARTS: PASS** — OBSERVED_DESCRIPTION/SEMANTICALLY_IDENTIFIED_DESCRIPTION may pass while CLASSIFICATION_SUFFICIENT_DESCRIPTION remains unresolved.
- T07 — **abbreviated description: PASS** — Preserve observed abbreviation; use authoritative item/subitem evidence to validate; do not expand without evidence.
- T08 — **general vs specific NMFC candidate: PASS** — Apply Rule 420 specific-over-general only if article/material is embraced by specific provision and relevant notes/references support it.
- T09 — **hazmat commodity: PASS** — Separate proper shipping name/ID/hazard class/packing group/technical name from commodity-description object while preserving conditional relationships.
- T10 — **compound commodity line: PASS** — Decompose package qty/type, description, NMFC/sub, class, weight and hazmat attributes before association.
- T11 — **missing association: PASS** — Return UNRESOLVED association and request next evidence; do not attach description arbitrarily.
- T12 — **conflicting evidence: PASS** — Retain conflict/provenance; apply governed authority/precedence only where established; otherwise unresolved/escalate.
- T13 — **incomplete ClassIT+ response: PASS** — Do not treat missing API references/subitem-selection logic as negative evidence; seek governed additional source/evidence.

## Sufficiency correction

The previous Explorer logic classified BOL-002 as `EXECUTION_SUFFICIENT` generically because it was a Canonical BOL/domain field. ATL-134 replaces that assumption with an explicit field-specific FIRI contract. Candidate state is `EXECUTION_SUFFICIENT_PENDING_INDEPENDENT_QA`.

## Boundary

Atlas supplies governed reusable identification/resolution intelligence. Runtime consumers observe and execute.
