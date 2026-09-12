# Atlas Architecture Decision Ledger V1

Status: ACTIVE  
Effective: 11 September 2026

> Historical AR-D001 through AR-D013 remain immutable/recoverable in Git history at blob `d13bfb2d87ed60c5eacd8b297ec6d70411a403a6`. They are not deleted or reversed by the additions below. In particular AR-D013 remains the approved Atlas platform boundary.

## AR-D013 — Atlas platform boundary
Decision: APPROVED BY OWNER / UNCHANGED.

> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

> **Atlas owns understanding and specification. Downstream platforms own execution.**

Canonical business/domain truth remains technology-neutral. Malkom and other downstream technologies consume Atlas outputs rather than defining Atlas semantics.

## AR-D014 — Split the monolithic architecture/recovery gate by certification boundary
Decision: CANDIDATE / WORKING ARCHITECTURE CORRECTION — OWNER FREEZE PENDING.

Evidence recovered on 12 September shows R0.3 closed, P6.1 recursive decomposition certified/live in protected persistence, and P6.2 compiler infrastructure technically implemented/rehearsed. Therefore the old blanket gate now over-couples distinct abstraction layers.

Candidate successor gates:
1. `P6_2_PARTIAL_WD_COMPILE_GATE` — terminal identity/boundary stable; certified P6.1 source hash; required canonical business/control semantics sufficient; explicit partial coverage/blockers; deterministic persistence/version/supersession; Owner authorization; independent QA/custody.
2. `SCOPE_EXECUTION_READINESS_GATE` — implementation-scope composition, blocker/dependency closure, enterprise/client binding, READY/NOT_READY certification and version-closed handoff.
3. `RUNTIME_PROJECTION_GATE` — runtime capability/constraint declaration, adapter translation/loss reporting and target-specific validation.
4. `FULL_DOMAIN_COVERAGE_GATE` — maturity/coverage objective, not a prerequisite for compiling already-ready work.

Rationale: recovery-era serialization was valid while provenance and architecture sufficiency were uncertain. New evidence removes those premises for some layers. A later-layer runtime/readiness question should not automatically prevent deterministic materialization of a semantically complete canonical unit.

This decision does not authorize persistence or indiscriminately lift AR0.2–AR0.6.

## AR-D015 — Partial canonical WorkDefinition materialization is permissible in principle
Decision: CANDIDATE / WORKING DECISION — OWNER FREEZE PENDING.

Atlas may materialize/certify the subset of terminal work that is genuinely ready while retaining all other terminal work as explicit blockers. It must not require artificial 100% domain closure before useful known-ready work can progress.

Current Road LTL evidence: 444 terminal leaves = 185 EXECUTOR_READY + 163 BLOCKED_BY_CLIENT_BINDING + 96 BLOCKED_BY_KNOWLEDGE_GAP. If the 185 pass semantic-sufficiency review, a governed partial compilation must preserve and report the full distribution and exact certified source hash. It must not be labeled full Road LTL execution readiness.

Rationale: client-binding dependencies are intentionally external and knowledge gaps are intentionally fail-closed. Treating either as a reason to suppress unrelated ready work would contradict Atlas's reusable execution-readiness objective.

## AR-D016 — Control-flow semantics are owned by meaning, not by mechanism
Decision: CANDIDATE / WORKING CLARIFICATION — OWNER FREEZE PENDING.

Where ordering, parallelism/join, multi-instance behavior, correlation, duplicate/stale handling, retry/idempotency, compensation/transaction boundary, durable state or timeout ownership are required **business semantics**, they must be governed before the affected unit can be called executor-ready. A runtime adapter may implement the mechanism but may not invent the business meaning.

Where canonical meaning is already complete and only the target technology's encoding remains, that encoding belongs to runtime projection and does not block canonical WD compilation.

Rationale: this preserves technology neutrality without stripping implementation-critical business semantics out of Atlas.

## AR-D017 — Recovery critical path should be re-baselined, not blindly resumed
Decision: CANDIDATE / WORKING SEQUENCING DECISION — OWNER FREEZE PENDING.

After the demo sprint, re-evaluate the serial AR0.2→AR0.6→R0.4→R0.6→P6.2→P6.5 chain. Candidate parallel tracks are canonical WD materialization, knowledge hardening, Client Binding framework, architecture refinement, security/public-protected certification and multi-mode proof. True upstream contract dependencies remain serial.

Rationale: recovered P6.1/P6.2 implementation evidence materially changes the critical path. Queue status must reflect real dependencies rather than historical recovery caution.

## Demo guardrail associated with AR-D014–D017
The demo does not authorize P6.2 persistence. Recent findings change the **truthful narrative**, not the shortest runtime proof path: Road LTL 1.5 now has certified decomposition and a technically proven WD compiler path, but the verified Malkom-consumable projection remains the older V1.2 → Domain Warehouse v2.3 → Malkom reference lineage unless new evidence proves otherwise.
