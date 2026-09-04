# P3O Certification Criteria

P3O certifies Ocean FCL/LCL 0.6 for the P2/P3 projection + Universal Daughter Renderer path only. It does not promote either module to production.

## Required evidence
- Exact Ocean 0.6 module, operational knowledge, client binding, source claim and system exchange files are present in-repository.
- Every file SHA-256 matches the immutable frozen manifest.
- P2 source registry resolves `ocean-fcl@0.6` and `ocean-lcl@0.6` exactly.
- No fallback to Ocean 0.5.
- Renderer consumes the same generic projection contract used by Road LTL.
- Operational Knowledge v1 content is rendered without fabricated OKv2 / Information Resolution semantics.
- Public payload contains no protected Work Decomposition, WorkDefinition, client values, runtime projections or restricted provenance.
- 30/30 FCL and 30/30 LCL A5 task tuples resolve.
- Existing Road LTL P2/P3 regression remains green.
- Canvas and production baselines remain unchanged.
