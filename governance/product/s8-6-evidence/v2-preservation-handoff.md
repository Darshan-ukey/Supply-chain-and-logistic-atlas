# v2 preservation handoff (S8-6)

The following obligations are **DEFERRED to v2** and are **not** PASS in the successor RC. The successor manifest records each as
`status: DEFERRED_NOT_PASS`, `markedPass: false`; `verifySuccessorManifest` fails closed (`DEFERRED_MARKED_PASS`) if any is marked PASS and
(`DEFERRED_OBLIGATION_MISSING`) if any is dropped.

| ID | Obligation | Preserved as |
|---|---|---|
| ATL-71 | Deferred v2 obligation (empirical Atlas-knowledge-only execution-readiness test; blocked upstream on the ATL-70 benchmark/metrics contract) | DEFERRED_NOT_PASS |
| F-130-06 | F-130-06 runtime integration (as recorded in the program's deferral list) | DEFERRED_NOT_PASS |
| ATL-107 | Deferred v2 obligation | DEFERRED_NOT_PASS |
| V2-GENERALIZED-INTERACTION | Generalized v2 interaction beyond the bounded Road LTL / LTL-04 journey | DEFERRED_NOT_PASS |
| V2-RUNTIME-READINESS-PROFILES | Runtime-readiness profiles | DEFERRED_NOT_PASS |
| V2-BOL-FIRI | v2 BOL / FIRI | DEFERRED_NOT_PASS |

What the successor RC does and does not claim:

- It carries the bounded Road LTL / LTL-04 successor interaction only (Canvas + bridge, Universal Ask 2.0.1, governed-depth-summary Deepen/Inspect, history sync).
- It does not claim runtime readiness. LTL-04 remains `projectionDisposition: BLOCKED`, `runtimeReadiness: NOT_PROMOTED`, with 1 unresolved binding,
  4 not-compiled leaves (2 client-binding-blocked, 2 knowledge-gap-blocked). The manifest verifier fails closed (`READINESS_PROMOTED`, `BLOCKED_LEAVES_HIDDEN`) if any of that changes.
- No v2 obligation is discharged, narrowed or relabelled by S8-6. A v2 stage that takes any of them on starts from the preserved identities in
  `release/manifests/atlas-v1.5-successor-s8-rc.json`, not from this note.
- ATL-157 is not materialized for LTL-04 (Daughter/execution-depth/Ask paths return 404 by design); that is a fail-closed behaviour, not a deferred pass.
