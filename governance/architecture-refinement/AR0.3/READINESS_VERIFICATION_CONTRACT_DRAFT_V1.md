# AR0.3 — Readiness Verification Contract / Resolver — VERIFIED CANDIDATE V1

**Status:** INDEPENDENTLY VERIFIED SPECIFICATION CANDIDATE — NOT OWNER-FROZEN — NOT IMPLEMENTED  
**Original draft:** Claude @ `3c67cd4619d49ada8ddb5a4c6395a4ba9d041727`  
**Independent verification/correction:** ChatGPT  
**Effective:** N/A until Owner freeze/authorization  
**Governed by:** `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` @ `58d6d0572636ad40f86943a39350b7237bb48f76`; `CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md` @ `a523ad3ac1288e68a6dfc764d8c2aa5ea77a2644`; `BOUNDED_CORRECTIONS_CLOSURE_V1.md` @ `5041441a811b739ea7d59c6a207ad1e47b9ecb6b` §5; `ATLAS_PRODUCT_CONSTITUTION_V1.md` @ `c126f07fcbf405356a8312377ee934fe0c724b36` §6.  
**Sequence note:** this readiness contract is intentionally reviewed before several upstream AR0.3 object contracts exist, on Owner direction, to establish the verification/recovery mechanism. That exception authorizes specification work only. It does not waive missing upstream contracts, implementation gates, F0–F7 requirements, PC-1–PC-7, or recovery proof.

## 0. Governing intent

Readiness is a machine-verifiable, version-closed proof over governed Atlas state. It is never a manual assertion, a UI flag, a floating status, or a mechanism for hiding unresolved reusable semantics in Client Binding or runtime configuration.

The resolver must support the Owner's build-process condition: no unverified state becomes permanent truth, failures resume from the last verified governed checkpoint, and a new operator/agent can independently locate, reproduce or restore, validate and continue from the same state without the originating chat/session.

This contract specifies that mechanism. It does **not** itself prove recovery. PC-5 requires an actual recovery/deterministic rebuild proof after implementation.

## 1. Purpose and scope

Given:
1. a declared readiness target;
2. an exact, version-closed scope manifest;
3. the complete frozen dependency closure required by that target;
4. an exact resolver implementation, ruleset and configuration identity;

the resolver deterministically evaluates whether the declared scope satisfies the applicable readiness definition and emits either a reproducible readiness proof or an explicit fail-closed result with complete blocker/dependency evidence.

The resolver does not create, infer, approve, repair or mutate domain semantics, enterprise bindings, transformation decisions, Work Decomposition, WorkDefinitions, runtime mappings or evidence. Missing upstream truth remains missing upstream truth.

## 2. Engine classification and invariants

**Engine class:** `G1 — Deterministic materializer/compiler/resolver`.

Mandatory invariants:
- same frozen semantic inputs + same implementation + same ruleset + same configuration produce the same canonical semantic result;
- canonical serialization used for semantic hashing is deterministic;
- no live/floating dependency participates in evaluation;
- no network retrieval, current-time lookup, randomness, LLM call or mutable external state participates in the evaluation function;
- metadata such as execution timestamp/run ID may differ between runs but is excluded from the **semantic result hash**; reproducibility is proven by canonical semantic equality/hash, not by pretending operational metadata is deterministic;
- any unresolved mandatory dependency fails closed;
- no later readiness state may be READY unless every mandatory predecessor state is READY for the exact same version-closed scope/dependency lineage.

## 3. Generator Contract — mandatory 13 elements

### 3.1 Engine ID and semantic purpose

**Engine ID:** `atlas-readiness-resolver-v1`.

Semantic purpose: evaluate and prove one of the three Constitution-defined execution-readiness states for an exact governed scope without creating or mutating the business meaning being evaluated.

### 3.2 Owned input contracts and required versions

The resolver consumes a **Readiness Scope Manifest**. It must be a version-closed manifest, not an ad-hoc list supplied at runtime.

Minimum required fields/relationships:
- `scope_id` and immutable `scope_version`;
- `target_readiness_state`;
- exact governed object identities required for the scope;
- exact contract/schema identities governing those objects;
- exact upstream dependency identities and hashes/references sufficient to prove dependency closure;
- applicable approved `NOT_APPLICABLE` decisions and their governing authority/identity;
- predecessor readiness proof identities when evaluating a later state, or sufficient frozen inputs to deterministically re-evaluate predecessors in the same run;
- resolver implementation identity;
- Generator Contract identity;
- ruleset identity;
- configuration/parameter identity.

Every consumed governed object must resolve to stable identity and authoritative location through the applicable AR0.3 contracts/registries. A floating label (`latest`, current UI state, current database row without immutable version identity, etc.) is invalid input.

**Open dependency:** several upstream AR0.3 object/identity contracts are not yet frozen. Therefore this contract defines the resolver's required identity/dependency envelope but does not invent the upstream schemas. Until those contracts exist and satisfy this envelope, a real scope that depends on them cannot receive READY.

### 3.3 Output contract/schema and lifecycle state

Conceptual output:

```text
ReadinessResult {
  proof_id
  scope_id
  scope_version
  state_evaluated: DOMAIN_EXECUTION_READY | ENTERPRISE_EXECUTION_READY | RUNTIME_IMPLEMENTATION_READY
  result: READY | NOT_READY | BLOCKED | NOT_APPLICABLE
  blockers: [
    { blocker_id, blocker_type, zone, object_id, dependency_id, rule_id, reason, severity, causal_parent_id? }
  ]
  dependency_chain: [
    { dependency_id, dependency_version, dependency_hash, status, authoritative_location_ref }
  ]
  predecessor_proofs: [
    { state, proof_id, semantic_result_hash, result }
  ]
  rule_evaluations: [
    { rule_id, rule_version, result, evidence_refs[] }
  ]
  monotonicity_check: { passed, predecessor_states_checked[] }
  identity: {
    generator_contract_version,
    resolver_implementation_version,
    resolver_commit,
    ruleset_version,
    configuration_hash,
    input_manifest_hash,
    semantic_result_hash
  }
  run_metadata: { evaluation_run_id, evaluation_timestamp }
  lifecycle: CANDIDATE | QA_VERIFIED | OWNER_APPROVED | SUPERSEDED
}
```

`semantic_result_hash` is computed from canonicalized semantic output excluding non-semantic run metadata. Exact serialization/canonicalization rules must be frozen in F2 before implementation closure.

Lifecycle rule: resolver output begins as a derived `CANDIDATE`. It may become a frozen governed readiness state/proof under F4 only after applicable independent QA/promotion and phase controls. A resolver cannot self-promote its own output.

### 3.4 Transformation/resolution/generation rules

The ruleset must implement the Constitution definitions, not replace them with narrower proxy checks.

#### DOMAIN_EXECUTION_READY
READY only when, for the declared scope:
- all **required reusable, tool-neutral execution semantics** are present;
- those semantics are version-closed, internally consistent and source/provenance controlled;
- no mandatory reusable semantic gap/conflict remains unresolved;
- required canonical references/dependencies resolve without dangling/orphan/floating identity;
- applicable Work Decomposition/Canonical WorkDefinition structures required by the scope satisfy their frozen contracts and validation rules;
- only explicitly declared enterprise-specific binding values may remain unresolved.

The resolver must not equate "all terminal leaves exist" or "all Z1 objects have no gap" with domain readiness unless the frozen ruleset proves those checks cover the Constitution's required semantics for that scope.

#### ENTERPRISE_EXECUTION_READY
READY only when:
- the exact predecessor `DOMAIN_EXECUTION_READY` proof is READY for the same version-closed lineage; and
- all mandatory enterprise/client bindings, mappings, authorities, policies, thresholds and operating constraints required for the scope are resolved; or
- an item is explicitly governed `NOT_APPLICABLE` by the correct authority under a versioned decision identity.

Client Binding must never close a reusable domain knowledge gap.

#### RUNTIME_IMPLEMENTATION_READY
READY only when:
- the exact predecessor `ENTERPRISE_EXECUTION_READY` proof is READY for the same version-closed lineage; and
- a chosen downstream tool/runtime and its capability profile are version-identified; and
- a version-closed specification/projection exists for that target; and
- capability gaps plus required implementation, configuration and integration requirements are explicitly resolved or governed under the applicable contract.

A runtime adapter/projection must never repair missing business semantics.

### 3.5 Ordering, precedence and conflict rules

Evaluation order is strict:

`DOMAIN_EXECUTION_READY → ENTERPRISE_EXECUTION_READY → RUNTIME_IMPLEMENTATION_READY`.

Rules:
- later-state READY requires predecessor READY;
- if predecessor evaluation cannot be performed because required evidence/dependency/control identity is absent, malformed, unreadable, unfrozen or unresolved, later state = `BLOCKED`;
- if predecessor was validly evaluated and is `NOT_READY`, later state = `BLOCKED` with causal reference to that predecessor proof/blockers;
- contradictory governed inputs are blockers unless a frozen precedence/conflict rule resolves the contradiction;
- no "best effort", majority, newest-file, UI-state or implicit precedence is allowed;
- `NOT_APPLICABLE` may only be used where the governing readiness contract/ruleset permits applicability to be waived and a governed authority decision exists. It is not a substitute for missing data.

### 3.6 Deterministic/non-deterministic classification

Deterministic G1.

The evaluation function receives only frozen/version-closed inputs. Retrieval of those inputs may occur before evaluation through governed storage/registry mechanisms, but the resolved evaluation package must itself be frozen/hashable. A changed live source is a different input baseline, not reproduction.

Operational `run_id` and `timestamp` are audit metadata and do not participate in semantic-result determinism.

### 3.7 External dependencies and versions

No external service is permitted **inside the deterministic evaluation function**.

Before implementation freeze, F2 must pin:
- runtime/language version;
- dependency lockfile/environment manifest;
- canonicalization/hash implementation;
- parser/schema validator versions;
- any local libraries used by evaluation.

"Pin at implementation time" is not sufficient for phase closure; the exact identities must be frozen before the engine is accepted as governed.

### 3.8 Parameters/configuration/defaults

Required configuration:
- exact `ruleset_version`;
- exact canonicalization/hash profile;
- any scope/rule feature flags explicitly allowed by the frozen contract.

Fail-closed behavior is **not optional configuration**. There is no permissive `strict_mode=false` path for governed readiness evaluation. Any diagnostic/non-governed exploratory mode, if ever introduced, must use a different explicit lifecycle/classification and can never emit governed READY.

No implicit defaults may materially change readiness semantics. Material defaults must be versioned in the ruleset/configuration and included in `configuration_hash`.

### 3.9 Provenance/lineage emitted into outputs

Every result must identify:
- output/proof ID;
- exact scope manifest identity/hash;
- exact input asset IDs/versions/hashes or immutable references;
- authoritative-location references sufficient for recovery;
- Generator Contract version;
- resolver implementation/commit identity;
- ruleset version;
- configuration hash;
- dependency/environment identity;
- predecessor proof identities where applicable;
- semantic result hash;
- run identity/timestamp;
- validator/QA/promotion identity when those lifecycle transitions occur.

The output alone is not the complete recovery record. The Generation Registry and F7 custody/closure evidence remain mandatory.

### 3.10 Validation rules and failure states

Hard validation failures include at minimum:
- unknown readiness target;
- malformed or schema-invalid scope/input/result;
- floating/unversioned required dependency;
- missing/unreadable required input;
- hash/identity mismatch;
- incomplete dependency closure;
- unknown/unfrozen ruleset or resolver identity;
- missing predecessor proof/re-evaluation path for later-state evaluation;
- predecessor lineage mismatch;
- unauthorized `NOT_APPLICABLE`;
- unresolved mandatory semantic/binding/runtime gap;
- canonical-reference integrity failure;
- non-deterministic dependency detected in the evaluation package.

Result semantics:
- `READY` — all applicable rules for the target state pass and predecessor monotonicity is satisfied;
- `NOT_READY` — the target state was validly evaluable on complete/valid inputs, but one or more target-state readiness criteria fail;
- `BLOCKED` — the target state cannot be validly evaluated/promoted because prerequisite proof, dependency closure, input integrity, governing identity or mandatory predecessor readiness is unresolved/invalid;
- `NOT_APPLICABLE` — only when the target/readiness applicability is explicitly governed as not applicable for the declared scope; never inferred from absence.

All blockers must be returned, not merely the first discovered blocker, except where an unreadable root package prevents safe enumeration; that condition itself must be explicit.

Applicable phase-closure failures must map to the canonical Recovery Gate states (e.g. `BLOCKED_GENERATOR_CONTRACT_INCOMPLETE`, `BLOCKED_GENERATION_REGISTRY_INCOMPLETE`, `BLOCKED_FREEZE_ASSET_SET_INCOMPLETE`, `BLOCKED_RECOVERY_NOT_PROVEN`, `BLOCKED_DEPENDENCY_CLOSURE_INCOMPLETE`) rather than inventing competing phase-state vocabulary.

### 3.11 Promotion rule

Readiness is **derived proof** and, once relied upon as a governed baseline/downstream gate, is an F4 freeze candidate (`readiness state/proof`).

Promotion path:

`CANDIDATE → INDEPENDENT QA → GOVERNED/FROZEN READINESS PROOF → CUSTODY/RECOVERY RECORD`.

A READY computation alone does not authorize promotion or next-phase consumption. Promotion requires:
- validator/QA closure;
- Generation Registry entry;
- applicable F0–F7 freeze coverage;
- immutable output identity/hash;
- authoritative location/custody references;
- applicable PC-1–PC-7 closure;
- explicit next-phase authorization.

Any material input/ruleset/implementation change produces a successor evaluation/proof. Frozen history is never overwritten.

### 3.12 Rollback/rebuild method

For deterministic rebuild:
1. locate the exact closed baseline/Generation Registry entry;
2. restore/resolve the exact frozen input package and dependency closure;
3. restore the exact Generator Contract, resolver implementation, ruleset, configuration, runtime/dependency environment and validator path;
4. run the resolver without the originating session;
5. canonicalize semantic output using the frozen profile;
6. compare semantic result hash and required rule/blocker/dependency content to the frozen proof;
7. independently validate the rebuilt result;
8. record recovery/rebuild evidence and result under F7/PC-5;
9. restore/confirm the rollback point and safe next-phase state.

If exact inputs/engine/control artifacts cannot be located, rebuild fails closed. A new approximation is not recovery.

This method defines **how PC-5 will be tested**. It does not satisfy PC-5 until an actual drill is executed and independently verified.

### 3.13 Compatibility rules with prior/successor versions

- previous frozen results remain immutable evidence under their original identities;
- a successor resolver/ruleset never silently reinterprets or overwrites an earlier proof;
- semantic-affecting changes require successor version, dependency-impact analysis, downstream regeneration/revalidation, new hashes/registry entries and Recovery Gate closure;
- consumers reference exact proof identity, never `latest`;
- compatibility/migration logic required to read prior proofs must itself be versioned/frozen where needed for recovery;
- if a prior proof cannot be read/validated by the retained recovery path, it cannot be treated as safely recoverable merely because a status label survives.

## 4. BC-3 traceability

| BC-3 requirement | Contract enforcement |
|---|---|
| Exact version-closed scope/dependencies | §§1, 3.2, 3.9 |
| Fail closed on unresolved mandatory predecessor gaps | §§3.4, 3.5, 3.10 |
| Monotonic readiness | §§2, 3.5 |
| Blocker IDs + causal dependency chain | §§3.3, 3.10 |
| Distinguish NOT_READY/BLOCKED/NOT_APPLICABLE | §§3.3, 3.5, 3.10 |
| Verifier/ruleset/proof identity | §§3.3, 3.9 |
| Deterministic same frozen inputs/rules | §§2, 3.6, 3.12 |

No conditional readiness state is introduced by V1. If a future approved conditional state is required, it needs an explicit successor contract/ruleset rather than being smuggled through a flag.

## 5. Generation/Freeze Standard traceability

This resolver is governed through the full mandatory chain:

`FROZEN INPUTS → VERSIONED GENERATOR CONTRACT → GENERATOR IMPLEMENTATION → VALIDATOR/QA → GOVERNED OUTPUT → HASH/IDENTITY → CUSTODY/RECOVERY RECORD`.

Required freeze coverage when the implementation/proof becomes governed:
- **F0:** Constitution/readiness definitions + architecture/phase controls;
- **F1:** this readiness contract plus applicable upstream semantic contracts;
- **F2:** resolver contract/code/rules/decision tables/config/dependency environment/validator/golden fixtures/migrations if any;
- **F3:** exact authoritative input baselines/scope/dependencies;
- **F4:** frozen readiness state/proof when approved/consumed;
- **F5:** only where a readiness-derived output is decision-significant beyond F4;
- **F6:** schema/migrations/runtime/build/restore assets where implementation requires them;
- **F7:** QA, hashes, Generation Registry, registries, closure record, custody and recovery proof.

The **Generation Registry entry is mandatory** for every governed generated readiness proof and must include the fields required by Generation Standard §8.

## 6. Recovery Gate traceability

A readiness implementation/proof cannot be declared CLOSED merely because the resolver returns READY.

Closure requires, as applicable:
- **PC-1:** exact output enumeration, independent QA, explicit gaps/exceptions;
- **PC-2:** exact authoritative inputs/code/contracts/rules with immutable identities and locations;
- **PC-3:** preserved control system, including Generator Contract/Registry and F0–F7 applicability;
- **PC-4:** working-system protection where the resolver/schema/runtime has operational state;
- **PC-5:** actual recovery/deterministic rebuild proof from preserved artifacts, without original session;
- **PC-6:** exact upstream/downstream dependency and immutability closure;
- **PC-7:** known-good rollback point and explicit next-phase entry decision.

Because this work introduces version-resolution/readiness logic and a downstream-consumed governed baseline, the first real implementation/drill is **HIGH-RISK by default** under PC-5. Neither implementing agent may self-downgrade it.

## 7. Open dependencies and hard stops

The contract is specification-complete enough to govern implementation behavior, but real readiness evaluation remains dependent on upstream AR0.3 contracts supplying stable identities, semantics, applicability/authority and dependency closure.

Until those dependencies are frozen or a bounded test fixture provides their exact equivalent:
- no production READY may be emitted;
- no missing identity may be invented;
- no Client Binding/runtime mapping may hide a domain semantic gap;
- no live UI/database state may substitute for version-closed input;
- no implementation may mutate production Supabase or restart R0.4/P6.x without separate authorization.

## 8. Required test vectors before implementation can be certified

At minimum F2 golden fixtures must prove:
1. exact positive DOMAIN readiness;
2. open reusable semantic gap → NOT_READY;
3. missing/unreadable dependency → BLOCKED;
4. floating `latest` dependency → BLOCKED;
5. enterprise binding missing while domain READY → ENTERPRISE NOT_READY;
6. domain NOT_READY → enterprise BLOCKED (monotonicity);
7. unauthorized NOT_APPLICABLE → BLOCKED;
8. governed NOT_APPLICABLE accepted only under correct rule/authority;
9. runtime capability/config/integration gap → RUNTIME NOT_READY;
10. enterprise NOT_READY → runtime BLOCKED;
11. hash/lineage mismatch → BLOCKED;
12. same frozen semantic inputs/rules/configuration → same semantic result hash across clean runs;
13. changed semantic input/ruleset → successor result identity, no overwrite;
14. recovery run without originating chat/session reproduces the frozen semantic result and passes independent validation.

These fixtures supplement, not replace, the real PC-5 drill.

## 9. First real recovery/rebuild drill — specification only

**Proposed candidate:** Road LTL 1.5, because it exercises real inherited/versioned dependencies and therefore tests whether the mechanism actually exposes dependency closure rather than merely passing a synthetic fixture.

The drill must not assume historical P6.1 certification counts prove current recoverability. It must begin from the exact preserved authoritative identities available at drill time and fail closed if Road LTL 1.5's required dependency chain cannot be located/read/validated.

Minimum drill proof:
1. identify the exact Road LTL 1.5 scope and all required upstream identities;
2. build a frozen evaluation package without relying on chat/session memory;
3. run the independently implemented resolver;
4. record all blockers/readiness results and proof identity;
5. freeze/custody the applicable test baseline/evidence;
6. destroy or isolate the working evaluation environment as appropriate;
7. restore/rebuild from governed artifacts only;
8. reproduce the semantic result hash and validate independently;
9. record PC-5 result, dependency closure, rollback point and next-phase decision.

A BLOCKED readiness result can still constitute a successful **resolver/recovery-mechanism** test if the blocker is genuine, complete, reproducible and independently verified. It must not be relabelled as Road LTL readiness success.

## 10. Verification disposition

Claude's first-pass draft contained the correct core direction but required material hardening before implementation. The principal corrections in this verified candidate are:
- separated deterministic semantic result from non-deterministic run metadata;
- made the scope a version-closed manifest with contract/dependency identity rather than a loose object list;
- aligned readiness rules directly to the Product Constitution instead of proxying domain readiness to terminal leaves/no Z1 gaps;
- clarified NOT_READY vs BLOCKED vs NOT_APPLICABLE;
- removed optional permissive fail-open behavior;
- added mandatory Generation Registry, F0–F7 and PC-1–PC-7 closure;
- corrected the claim that the design itself satisfies PC-5 — only a real drill can do so;
- made readiness proof an F4 governed freeze candidate when promoted/consumed;
- strengthened runtime readiness to require version-closed target specification/projection plus capability/configuration/integration closure;
- added compatibility/recovery readability and explicit test vectors.

**Verification outcome:** `SPECIFICATION_VERIFIED_WITH_MATERIAL_CORRECTIONS`.

This is not Owner freeze, implementation authorization, schema authorization, production mutation authorization or proof that Road LTL 1.5 is ready.

## 11. Next step / work division

Per the canonical work division, **implementation should be handed back to Claude**, not performed by ChatGPT. Claude is the heavy implementation/recovery-drill agent; ChatGPT authored/corrected this contract and therefore must not self-certify an implementation of its own specification.

Proposed next sequence, subject to Owner authorization:

`OWNER ACCEPTS VERIFIED CONTRACT CANDIDATE → CLAUDE IMPLEMENTS RESOLVER + F2 FIXTURES → CHATGPT INDEPENDENT IMPLEMENTATION QA → CLAUDE EXECUTES PC-5 ROAD LTL 1.5 RECOVERY/REBUILD DRILL → CHATGPT INDEPENDENTLY VERIFIES DRILL/CLOSURE → OWNER/NAMED GATE DECIDES NEXT PHASE`.

No implementation, schema or engine code is authorized by this specification review alone.
