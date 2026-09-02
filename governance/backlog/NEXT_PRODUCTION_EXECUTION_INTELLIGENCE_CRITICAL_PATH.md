# Next Production Release — Execution Intelligence + Adapter Ready Critical Path

Status: ACTIVE BACKLOG / RELEASE GATE  
Baseline policy date: 2 September 2026

## Production policy
The production release last deployed on 23 August 2026 remains the only live production version. All subsequent frozen assets are governed development/reference assets until the complete execution-intelligence release gate below is satisfied.

The next production version MUST NOT be promoted merely because Universe, daughter pages, Operational Knowledge, Canvas or other individual assets are richer. The next production release must demonstrate lossless governed knowledge-to-execution transformation and adapter readiness.

## Required production chain
Authoritative Sources
→ Supply Chain Universe
→ Verified Daughter A5
→ Operational Knowledge v2
→ Recursive Work Decomposition
→ Canonical WorkDefinition
→ Atlas Warehouse
→ Universal Adapter Contract
→ Runtime-specific Projection / Domain Warehouse
→ Compiler / Verifier
→ Client Binding
→ Runtime Connector
→ Executable Intelligence
→ Execution Evidence / Feedback
→ Governed Learning Loop

## Critical-path backlog

### CP-01 — Canonical Work Decomposition Contract v1
Status: IMPLEMENTATION_PENDING

Deliverables:
- Implement the frozen recursive-decomposition architecture as a machine-readable canonical contract.
- Recursively decompose A5 work until every leaf satisfies the executability criterion; do not stop at a fixed hierarchy depth.
- Preserve canonical task/object/source/provenance lineage at every decomposition node.
- Define executor-neutral inputs, outputs, decisions, controls, exceptions, evidence and state transitions.
- Define explicit stop/executability tests.

Acceptance gate:
- LTL-03 can be recursively decomposed without semantic loss from Road LTL v1.5 + Operational Knowledge v2.
- Every leaf is unambiguous enough to be assigned to an executor class or explicitly marked unresolved.

### CP-02 — Canonical WorkDefinition VNext
Status: IMPLEMENTATION_COMPILATION_PENDING

Deliverables:
- Implement WorkDefinition at executable nodes rather than one monolithic definition per A5.
- Define input/output contracts, action/decision semantics, validation, state, temporal constraints, authority, exception paths, evidence and completion criteria.
- Preserve sourceRefs, operational-knowledge lineage and client-binding slots.
- Make the contract executor-neutral and compilable to human, workflow, RPA, agent, API/system, document-AI and Malkom runtimes where applicable.

Acceptance gate:
- Every executable LTL-03 decomposition leaf can compile to a valid WorkDefinition or produces an explicit governed gap.

### CP-03 — Atlas Warehouse materialization
Status: REQUIRED FOR NEXT PRODUCTION

Deliverables:
- Materialize the canonical knowledge/execution warehouse schema in the selected backend.
- Persist Universe, daughter, Operational Knowledge, Information Resolution, Work Decomposition, WorkDefinition, provenance, client-binding requirements and version lineage.
- Preserve immutable frozen versions plus mutable governed pointers.
- Support trace from runtime execution back to authoritative basis.

Acceptance gate:
- LTL-03 knowledge-to-execution graph is queryable end-to-end from warehouse records without relying on static files as the runtime source of truth.

### CP-04 — Universal Adapter Contract
Status: REQUIRED FOR NEXT PRODUCTION

Deliverables:
- Define the stable interface between canonical Atlas WorkDefinitions and runtime-specific projections.
- Specify capability negotiation, supported executor types, input/output mapping, state/outcome mapping, exception semantics, evidence callbacks, version compatibility and validation.
- Prevent runtime-specific semantics from leaking upstream into canonical Atlas knowledge.

Acceptance gate:
- A runtime adapter can consume the same canonical WorkDefinition without changing the canonical definition.

### CP-05 — Malkom Adapter + Domain Warehouse Projection
Status: REQUIRED REFERENCE IMPLEMENTATION

Deliverables:
- Project the required Atlas subset into the Malkom Domain Warehouse.
- Map WorkDefinitions to Malkom queue/sub-queue, worktype, outcome, outcome route/status, next-step and lifecycle structures.
- Map BOL Information Resolution into Malkom document-AI/IDP work units and exception/HITL paths.
- Keep client-specific bindings downstream of canonical resolution.

Acceptance gate:
- LTL-03 / BOL can generate valid Malkom execution structures from canonical Atlas assets without manual semantic reconstruction.

### CP-06 — Compiler / Verifier
Status: REQUIRED FOR NEXT PRODUCTION

Deliverables:
- Compile canonical WorkDefinitions through the adapter into runtime artifacts.
- Validate schema compatibility, required mappings, state transitions, outcomes, evidence requirements, unresolved bindings and version compatibility.
- Fail closed on unresolved critical semantics.

Acceptance gate:
- Invalid or incomplete runtime projections are rejected with traceable errors; valid LTL-03 projection compiles deterministically.

### CP-07 — Client Binding + Runtime Connector
Status: REQUIRED FOR NEXT PRODUCTION

Deliverables:
- Bind canonical fields/objects to client-specific layouts, target systems, field names, policies and validation overrides.
- Resolve the currently explicit SOURCE_CONTEXT_PENDING / CLIENT_BINDING_REQUIRED BOL semantics from governing Malkom/client schemas.
- Implement runtime connector/materialization path.

Acceptance gate:
- Client-specific configuration changes do not mutate canonical Atlas knowledge.
- Bound LTL-03 can execute through the Malkom connector in a controlled environment.

### CP-08 — End-to-end LTL execution proof
Status: RELEASE BLOCKER

Reference proof: LTL-03 / BOL Information Resolution.

Required proof:
1. Start from frozen Road LTL v1.5 + Operational Knowledge v2.
2. Recursively decompose LTL-03.
3. Compile executable-node WorkDefinitions.
4. Persist/read through Atlas Warehouse.
5. Project through Universal Adapter.
6. Materialize Malkom Domain Warehouse/queue structures.
7. Apply client binding.
8. Execute or simulate the runtime path.
9. Capture evidence/outcomes/exceptions.
10. Trace runtime result back to WorkDefinition → Work Decomposition → Operational Knowledge → daughter A5 → authoritative source claim.

Acceptance gate:
- No semantic reconstruction outside governed Atlas contracts.
- Full bidirectional trace works.

### CP-09 — Runtime quality and measurement proof
Status: RELEASE BLOCKER

Deliverables:
- Resolve the Malkom source-reported Accuracy metric definition, including values currently above 100%.
- Implement governed metrics: Extraction Recall, Value Accuracy, Object Association Accuracy, Semantic Classification Accuracy, Normalization Accuracy, Validation Pass Rate, Critical False-Negative Rate, HITL Rate and Validated STP Yield.
- Compare pre/post execution-intelligence performance on a controlled sample.

Acceptance gate:
- Metric definitions are mathematically valid and versioned.
- Post-change Validated STP Yield and critical-error performance are measurable and defensible.

### CP-10 — Regression, governance, security and public/protected presentation
Status: RELEASE BLOCKER

Deliverables:
- Regression-test unchanged Road LTL tasks and downstream LTL-03 consumers.
- Verify frozen-asset immutability and version lineage.
- Verify role/capability access and protected execution IP.
- Ensure public/sanitized views expose Operational Knowledge/Execution Readiness at the approved level while detailed Work Decomposition, WorkDefinition, machine-readable runtime contracts and protected sources remain controlled.
- Verify Trace/Audit across changes and runtime execution.

Acceptance gate:
- No regression against frozen baselines.
- Protected/private execution intelligence cannot leak through public views.

### CP-11 — Next production release gate
Status: BLOCKED UNTIL CP-01 THROUGH CP-10 PASS

Production-ready definition:
> Atlas is production-ready only when governed domain knowledge can be transformed losslessly into executor-ready WorkDefinitions and projected through an adapter into at least one real execution runtime, while preserving provenance, client-binding boundaries, validation, traceability and governed runtime feedback.

Minimum runtime proof for first release: Malkom using Road LTL LTL-03 / BOL Information Resolution.

## Explicit non-gates
The following are not sufficient by themselves to promote the next production release:
- richer Universe/daughter HTML pages;
- Operational Knowledge v2 freeze;
- Work Decomposition architecture without implementation;
- WorkDefinition schema without compilation;
- Canvas 2.0 completion;
- Atlas Warehouse schema without materialization;
- adapter architecture without a working runtime projection;
- Malkom UI/demo without canonical Atlas lineage;
- isolated extraction accuracy improvements without governed information resolution and end-to-end proof.

## Current starting assets
- Supply Chain Universe 7.3 — frozen baseline/reference as governed.
- Road LTL 1.5 — FROZEN_EXECUTION_REFERENCE_CANDIDATE.
- Road LTL 1.5 Operational Knowledge — FROZEN_OPERATIONAL_REFERENCE.
- Operational Knowledge Contract v2 — FROZEN_SCHEMA_CANDIDATE.
- Information Resolution Contract v1 — FROZEN_SCHEMA_REFERENCE.
- BOL Information Resolution Baseline v0.1 — FROZEN_REFERENCE_BASELINE.
- Frozen Stack Lock v2.2.

## Release principle
No intermediate asset freeze changes the live-production declaration. The 23 August 2026 production release remains live until CP-01 through CP-10 pass and CP-11 is explicitly approved/promoted through governance.
