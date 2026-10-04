# S8-2E leaf compiler correction

This correction resolves S8-3B-GATE-001's implementation finding. The previous
ATL-159 materializer emitted a lineage plan and its test checked constants;
it did not exercise Canonical WorkDefinition compilation.

## Exact donor and correction scope

Base: S8-2E `7937e3726b1b4fda87fef5cae1f7b693a41d3463`.
Restore the generic leaf compiler, verifier, frozen schemas, frozen contracts,
and synthetic contract tests byte-for-byte from
`c72b50025d38c6ba103a98e6b698ac2181d5017b`.
The new S8 wrapper validates the protected decomposition schema, independently
pinned canonical input digest, exact Road LTL 1.5/LTL-04 tuple, inherited 1.4
semantic identity, and corrected semantic/binding fingerprints. It then invokes
the restored compiler, checks coverage and blocker preservation, and verifies
every definition against the frozen and local schemas.

The old plan remains available only through `--plan`; its regression output
explicitly labels the result as plan compatibility. Normal generation fails
closed without a protected decomposition and independently pinned digest.

Full output can only be written to a new file outside the public repository.
Parent-directory real paths are resolved before the boundary check. Standard
output contains only allowed counts, status, hashes and `detailIncluded:false`.
No application/API, database, runtime or production deployment changes.

## Verification

- `node tests/p6-2-canonical-workdefinition-compiler.mjs`
- `node tests/s8-2e-leaf-compiler-correction.mjs`
- prior S8-2A/B/C/D and S8-2E plan compatibility regressions

The new test compiles a synthetic ready leaf, preserves two blocked leaves,
checks byte determinism, lineage, schemas, input non-mutation, client-value
exclusion and sixteen negative cases. Synthetic fixtures do not certify any
real Road LTL decomposition or generated derivative.

## Separate real-input gate

The Drive custody export `1Wc9RdQSG8xMI0vg1vHzQIMsa1PrPFXPj` contains the
historical protected P6.1 payload. Its Brotli decoding fails before a JSON
decomposition can be obtained. This independently reproduces the documented
AR0.3 custody/storage recovery-control defect in
`1vXxBZX0vlJclaChw8uJIr0X2Z20aAX1I`. No corruption cause is inferred.
Neither declared hashes nor old counts are substitutes for restored content.

S8-3B remains NOT STARTED until a corrected governed protected decomposition
is available, its source/donor compatibility is proven, and its exact input
digest is frozen. Do not invent leaves, restore obsolete readiness obligations,
claim historical equivalence, or publish protected execution detail. Do not
merge, rebase main, or deploy production.
