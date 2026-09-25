# P6.1 V1 Reconstruction Repeatability Evidence v1 — FROZEN

**Status:** FROZEN_REPEATABILITY_EVIDENCE
**Freeze date:** 2026-09-15
**Scope:** Evidence that the recovered P6.1 V1 reconstruction baseline generalizes across materially different Road LTL A5 source shapes.
**Does not authorize:** bulk reconstruction of remaining A5 tasks, Supabase mutation, WorkDefinition persistence, main merge, or production promotion.

## Rule authority

Recovered P6.1 V1 reconstruction baseline:
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`
@ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

The frozen baseline contains corrected CR1–CR11 and remains unchanged by this evidence freeze.

## Worked example 1 — LTL-03 enriched / seed-driven source

Passing corrected reconstruction:
- artifact: `governance/baselines/p6_1_v1_ltl03_r2/`
- manifest: `30e9001b81569bb306371e02c82f7c0c307672bd`
- parts: `497d760d37148e5936b0119074b3dd409d481b53`, `070ace1bd5aca05c32e438c3314cd91f3cab1c33`, `17950d3746fda7fd8742bb32664a25b45faa5e2c`, `9afd03d8a0e6fbe6fee28913528d50029fb68242`
- independent focused re-QA PASS: `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`

Source shape:
- explicit 20-step `workDecompositionSeed`;
- enriched Operational Knowledge v2;
- information-resolution baseline + claim pack;
- canonical source-context gaps and client bindings both present.

Natural passing fingerprint:
- 38 work units
- 32 leaves
- 14 EXECUTOR_READY
- 11 BLOCKED_BY_KNOWLEDGE_GAP
- 7 BLOCKED_BY_CLIENT_BINDING

Historical `43 / 37 / 14 / 8 / 15` was post-generation comparison evidence only.

## Worked example 2 — LTL-01 inherited v1.4 / contract-structure source

Reconstruction:
- artifact: `governance/baselines/P6_1_V1_LTL01_RECONSTRUCTED_R1.json`
- candidate commit: `407c099e993ea9d27f870e06faf80a27b8c9c05f`
- self-QA: `f5ccc8ef15879fa80f63e31714d3793e407a17a3`
- independent QA PASS: `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`

Source custody:
- certified frozen Drive ZIP SHA-256 `b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289`
- exact v1.4 module SHA-256 `c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4`
- exact v1.4 operational knowledge SHA-256 `6e5899b2c31f7458a7959ead18950911ea916a366ac28d2aeee7077855dac13e`

Source shape:
- no `workDecompositionSeed`;
- tree derived only from explicit required-information, decision-gate, temporal, atomic-action, evidence and client-binding contracts;
- all canonical semantics resolved; remaining blockers are client binding only.

Natural passing fingerprint:
- 19 work units
- 15 leaves
- 7 EXECUTOR_READY
- 8 BLOCKED_BY_CLIENT_BINDING
- 0 BLOCKED_BY_KNOWLEDGE_GAP

Historical `23 / 16 / 7 / 9 / 0` was post-generation comparison evidence only.

## Repeatability conclusions

1. CR1–CR11 are not dependent on the LTL-03 enriched 20-step seed structure. LTL-01 has no such seed and still passed independent QA when reconstructed from its own explicit frozen task contracts.
2. CR1/CR2 generalize across source structures: LTL-03 preserves a governed seed spine; LTL-01 uses source-native arrays/contract groups without inventing a seed.
3. CR5 blocker taxonomy generalizes: LTL-03 contains genuine canonical knowledge gaps plus client bindings; LTL-01 contains client-binding blockers only, and zero knowledge gaps was independently verified.
4. CR10 generalizes beyond a uniform `NOT_MATERIAL` pattern. LTL-01's state-changing action `O01` was independently verified as `MATERIAL_AND_RESOLVED` using explicit performer/authority source fields, while mechanical leaves remain `NOT_MATERIAL` with leaf-specific reasons.
5. CR6 generalizes: an independently source-specified post-binding action may remain ready when its own execution contract is explicit; readiness is not inferred merely from its position after an unresolved binding.
6. Both examples passed independent Claude QA based on raw source and artifact inspection, not historical-count convergence.
7. Historical counts remain forensic comparison evidence only. Natural reconstructed structures may differ while content fidelity and readiness classification pass.

## Program implication

The recovered P6.1 V1 reconstruction method now has sufficient cross-task evidence for the **demo purpose**. This freeze does not justify reconstructing the remaining 20 Road LTL tasks before the demo. The approved sequence is:

`LTL-03 rule recovery → LTL-01 cross-task repeatability proof → resume Demo DUX/protected-detail wiring`

Remaining task reconstruction is deferred until a later governed decision.

## Disposition

`P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN__TWO_DISTINCT_SOURCE_SHAPES_PASS__RETURN_TO_DEMO`
