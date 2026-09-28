# Atlas v1.5 — Independent QA Outcome & Architecture Standard V1

**Owner directive:** 2026-09-28  
**Applies to:** every Atlas v1.5 build/remediation task in ATL-177  
**Builder:** ChatGPT  
**Independent QA:** Claude

## QA is not implementation-checking only

Claude must independently verify both:

1. **BUILD CORRECTNESS** — what was implemented satisfies the task contract and evidence is real/reproducible.
2. **OUTCOME + ARCHITECTURE FITNESS** — the implementation is capable of achieving the intended product/user outcome and remains compatible with the governed future Atlas architecture.

A task cannot PASS if either dimension fails.

## Mandatory QA dimensions

For every material task Claude must record PASS / FAIL / NOT_APPLICABLE with evidence for:

### A. Intended outcome
- Does the implementation actually achieve the user/business outcome the task exists to deliver?
- Is the acceptance proof end-to-end enough to establish usefulness rather than component existence?
- Is the result reachable/consumable by the intended user or downstream consumer?

### B. Product coherence
- Does it fit the Atlas v1.5 user journey and preserve Atlas identity?
- Does it avoid turning Atlas into Malkom, an ERP, workflow engine, BPMN runtime or another downstream executor?
- Does it preserve the useful-enough-for-Malkom / independent-enough-from-Malkom dual gate?

### C. Future-scope compatibility
- Does the bounded v1.5 implementation preserve the paired v2 continuation boundary?
- Will v2 be able to extend the implementation without semantic re-entry or architectural replacement?
- Does v1.5 avoid hard-coding a temporary consumer/schema into canonical truth?

### D. Canonical data ownership and storage
For every new or changed data class:
- what is canonical truth?
- where is it stored?
- what is candidate/reference/projection/runtime/client binding?
- who may write/validate/promote it?
- what identity/version/provenance is retained?
- is frozen history preserved rather than overwritten?

### E. Retrieval and pull model
- who/what retrieves the data?
- through what query/API/export/lookup?
- is access public/protected/admin/client/runtime appropriate?
- is retrieval deterministic/version-aware where required?
- does missing/ambiguous data fail closed?

### F. Consumption model
- how will the user, Malkom or other intended consumer use the data?
- is the consumer receiving canonical semantics, a governed projection, binding, or runtime copy as intended?
- are loss/unsupported/client-binding states explicit?
- does the consumer avoid rediscovering information Atlas claims to supply?

### G. Interaction model
- how does a fresh user reach the capability from the supported Atlas journey?
- does context/scope/version remain coherent across Canvas → Daughter/task → Depth → WD → readiness/binding → projection/output?
- are non-UI capabilities still callable/inspectable where the user does not need a dedicated screen?
- are public/private/admin boundaries truthful?

### H. Lineage, reproducibility and recovery
- exact source/input identities are known;
- derived artifacts are reproducible or explicitly classified otherwise;
- package/output lineage traces back to canonical knowledge;
- rollback/recovery is possible where material;
- no hidden reliance on chat memory or unretained state.

### I. Cross-layer architecture
Where applicable verify:
Source/Universe
→ Daughter
→ Operational Knowledge / information semantics
→ On-Demand Depth
→ Work Decomposition / WorkDefinition
→ Client Binding
→ Readiness
→ Projection/package
→ downstream consumer.

The implementation must not skip a layer by embedding semantics in UI/prompts/adapters that belong in canonical governed data.

### J. Negative controls / misuse
- stale/demo/reference assets cannot silently become production truth;
- unsupported semantics fail closed;
- client-specific values cannot leak into reusable domain truth;
- runtime-specific schema cannot become canonical Atlas semantics;
- builder cannot self-certify QA.

## Required QA disposition

Claude must end each QA with:
- BUILD_CORRECTNESS: PASS/FAIL
- OUTCOME_FITNESS: PASS/FAIL
- ARCHITECTURE_FITNESS: PASS/FAIL
- FUTURE_SCOPE_COMPATIBILITY: PASS/FAIL
- DATA_STORAGE_OWNERSHIP: PASS/FAIL/N/A
- RETRIEVAL_CONSUMPTION: PASS/FAIL/N/A
- INTERACTION_MODEL: PASS/FAIL/N/A
- LINEAGE_RECOVERY: PASS/FAIL
- MALKOM_UTILITY: PASS/FAIL/N/A
- CONSUMER_INDEPENDENCE: PASS/FAIL/N/A
- FINAL: PASS / REWORK_REQUIRED / BLOCKED

A technically correct build with an outcome/architecture FAIL is **REWORK_REQUIRED**, not PASS.

## Forward handoff

Claude may route the next ATL-177 task only after FINAL=PASS and durable read-back of both task evidence and Shared Baton handoff.
