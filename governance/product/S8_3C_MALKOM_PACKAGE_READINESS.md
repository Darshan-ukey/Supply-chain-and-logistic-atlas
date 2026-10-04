# S8-3C — corrected LTL-04 package and readiness checkpoint

Base: S8-3B final evidence-only head `7c5384ec57c47cea3102911851a02add48d3007d`.
The protected canonical compilation is pinned at SHA-256
`fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61`.
Corrected semantic and binding digests are pinned in the generator and public summary.

The package preserves the frozen canonical leaf definition losslessly, with its
exact identity, coverage and provenance. It does not expand that single leaf into
the historical task-wide WD. Process-level governed client bindings are carried
separately and are not automatically applied to canonical leaf actors/systems.
No client value or consumer field is added to canonical truth.

Retained authorities:
- ATL-138 consumption contract at `d7dbabdb451b486c07fd443d01fa3cc105cd96a7`,
  blob `edcefecc310462967fffce0b853579c619c97a01`; exact snapshot included.
- ATL-139 package boundary at `a57ad4d4f9488f190737701736beb5f807a19867`:
  machine-readable export; no fabricated interface or canonical mutation.
- ATL-163 readiness schema at `fcf3206470455d6782a7c29cacd9bcf09651b8d9`,
  blob `42507e6053096f86e294df5e69d974c60fc3c105`; exact schema restored.

ATL-163's retained branch contains a frozen summary/schema rather than an
executable summarizer. This checkpoint computes a deterministic summary on the
corrected dependencies, validates the retained schema, and retests its bounded
fail-closed behavior. Counts and partial coverage come from the corrected leaf
compilation, not the stale historical summary. The schema's FROZEN literal is a
format requirement, not an operational or release promotion.

Package and readiness full artifacts remain in local protected custody outside
the repository. Public evidence contains only hashes, counts, dispositions and
`detailIncluded:false`. Readiness remains BLOCKED: one unresolved binding, four
noncompiled leaves, unconfirmed Malkom ingestion interface, and executor proof
NOT_INDEPENDENTLY_PROVEN. Universal execution readiness is false.

QA checks deterministic regeneration, canonical/binding nonmutation, lossless
leaf projection, preserved coverage, retained readiness schema, fail-closed
behavior and five rejection cases. The exact QA runner also executes eight
inherited compiler, donor and S8-3B suites. This is stage-specific component
evidence, not independent runtime or release certification. S8-3D/3E are not
implemented here. No merge, production deployment or protected-store mutation.

Reproduce: from a checkout with governed source objects available, run
`node governance/product/s8-3c-evidence/run-exact-qa.cjs <repo> <new-checkout> <evidence-json>`.
Optional local protected custody output is enabled only by
`S8_3C_PRIVATE_OUTPUT_DIR`, which must be outside the repository.
