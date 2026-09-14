# Canonical Work Decomposition Compiler Specification V1 — FROZEN

Asset ID: `CANONICAL-WORK-DECOMPOSITION-COMPILER-SPEC-V1`
Version: `1.0.0`
Status: `FROZEN FOR P6.1 V1 RECONSTRUCTION`
Historical semantic basis: P6.1 V1

## Purpose
Make the previously implicit P6.1 generation procedure reproducible without changing the historical P6.1 semantic contract.

Precedence: if this specification conflicts with the frozen Executability & Recursive Decomposition Standard V1, Canonical Work Decomposition Contract V1, or its schema, the historical frozen assets prevail.

## Pinned inputs
Every compiler run must pin the exact Daughter module/version/task, semantic hash/identity, applicable Operational Knowledge and Information Resolution assets, governing standard/contract/schema versions, and intended executor-class lens used for the historical V1 executability criterion.

Missing required source authority fails closed. Do not fill semantic gaps from general knowledge or historical aggregate counts.

## Generation sequence
1. Create one TASK_ROOT preserving exact module/version/task lineage.
2. Read governed Operational Knowledge for trigger, information/business objects, applicability, decisions/rules/controls, authority, actions, states/outcomes, timing/waits, exceptions/recovery, evidence and completion criteria.
3. Create canonical child units only where governed source supports a distinct execution-significant operation or control.
4. Use only the V1 unit types defined by the frozen contract.
5. Preserve deterministic parent-child lineage and sibling order.
6. Split multi-operation/conditional source actions into ACTION_GROUP/child operations or explicit blockers; lexical splitting alone cannot prove executability.
7. Make material decision/gate, timing/wait, evidence/completion and state semantics explicit.
8. Recurse until every leaf reaches a valid terminal classification.

## Historical V1 terminal test
A leaf is EXECUTOR_READY only when the frozen source material is sufficient, for the declared intended executor-class lens, to identify required input/object, entry/applicability, decision/gate logic without undocumented judgement, one unambiguous operation, success/failure condition, required evidence, resulting state/transition and resolved canonical authority/role.

Use BLOCKED_BY_KNOWLEDGE_GAP where canonical execution semantics are unresolved; stable requiredKnowledgeGaps references are mandatory.

Use BLOCKED_BY_CLIENT_BINDING where canonical work is understood but execution requires enterprise/client/site/runtime-specific values or mappings; stable requiredClientBindings references are mandatory and client values must not be embedded into canonical work.

NEEDS_DECOMPOSITION is valid only for non-terminal units with children. No terminal leaf may retain it.

## Information Resolution
Information Resolution remains governed Operational Knowledge. The compiler may consume only available governed semantics and must not fabricate precedence, source priority, validation, confidence, conflict-resolution or canonical-object meaning. Missing semantics become explicit blockers.

## Executor-class rule
P6.1 V1 intentionally uses the intended executor class as an executability lens. The run manifest must record that lens. The later AR0.2 candidate business-semantic-only stopping rule is not part of this V1 compiler.

## Determinism
Canonical IDs must be stable from pinned lineage and parent/sequence identity. Identical inputs, compiler version and executor-class lens must preserve structural identity unless an explicitly versioned compiler change is introduced. Random canonical IDs are prohibited.

## Required run manifest
Record compiler spec version/hash, compiler implementation commit/hash, governing standard/contract/schema hashes, Daughter/source module/version/hash, Operational Knowledge and Information Resolution input identities/hashes, executor-class lens, task list, generated output hashes, unit/status counts, validation result and authorized execution identity.

## Mandatory validation
Validate schema conformance, exact version/task lineage, one root per task, no orphan parents, no cycles, deterministic ordering, all leaves validly classified, no terminal NEEDS_DECOMPOSITION, stable blocker references, no client/runtime-native structures in canonical decomposition, and non-reconstructive PUBLIC_SAFE output.

Historical aggregate totals are evidence from the lost historical run and must not be hard-coded as compiler targets.

## Custody
Full decomposition output is EXECUTION_PROTECTED. Persistence encoding and aggregate/per-task row design are implementation choices and do not define semantics. Before runtime persistence, archive the generated bundle, manifest, output hashes and validation report in approved protected custody.

## Reconstruction label
Any output regenerated under this specification is `RECONSTRUCTED_P6_1_V1` unless byte-for-byte identity with the lost historical bundle is independently proven.

## Change control
Any change to canonical stopping semantics, unit-type semantics, readiness tests or executor-neutrality requires a successor version; do not silently mutate V1.
