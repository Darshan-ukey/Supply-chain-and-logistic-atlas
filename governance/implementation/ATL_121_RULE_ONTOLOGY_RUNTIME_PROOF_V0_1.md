# ATL-121: Rule Ontology Runtime Proof & Adversarial Validation — Evidence V0.1

> **SUPERSEDED — 2026-09-27.** ChatGPT independent QA FAILed this V0.1 evidence twice
> (Linear comments `0006cec8-6928-4ded-8161-6533c5c59b42` and
> `9ff327f7-064b-4f28-a03a-dd58ede64498`): the four proof documents below contained
> authored Markdown JSON/log scenarios presented as execution evidence, with no
> runnable fixtures. That finding was correct. Real, executed evidence now lives in
> `governance/implementation/ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` and
> `governance/implementation/atl121_proofs/`. This file is retained for audit trail;
> the per-proof status table at the bottom has been updated to point to the real
> evidence rather than left claiming the superseded V0.1 state.

**Status:** BUILDER REWORK COMPLETE — AWAITING INDEPENDENT QA (see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md`)  
**Parent issue:** ATL-119 (Business Rule Ontology & Runtime Consumption Contract)  
**Predecessor:** ATL-60 (LTL-03 Research Evidence Recovery & Reconciliation) — GOVERNED_COMPLETE  
**Related:** ATL-95 (Canonical intelligence), ATL-107 (Execution packages), ATL-110 (Freeze gate)  
**V0.1 evidence date (superseded):** 2026-09-26  
**V0.2 executable evidence date:** 2026-09-27  
**Builder:** Claude  
**V0.1 commit (superseded):** cf10322213c9c8a3c9d4c1f06ed5d73925d70ce6  
**V0.1 manifest-only correction (also insufficient per QA):** e2e47aa2dd8d1b4a17fb5497a8de9a3051d3d355  

---

## Purpose

Execute all ten proof obligations and Owner acceptance additions for ATL-119's Business Rule Ontology & Runtime Consumption Contract, demonstrating that the rule taxonomy, evaluation modes, distribution modes and runtime consumption patterns are operationally sound before permitting §14-level reconciliation and ATL-110 freeze.

This proof is **adversarial and bounded**: it tests whether the contract survives real evidence and real execution scenarios without retreating to surrogates, self-authored harnesses or theoretical assumptions.

---

## Scope & Boundaries

**In scope:**
- All ten proof obligations from ATL-121 issue description
- Owner architecture invariant (dual-trigger depth, bounded-execution validation, three-storage-layer separation)
- Rule extraction/classification from LTL-03/BOL evidence
- Taxonomy extensibility test (new rule family on a structurally different domain)
- Distribution mode proofs (EMBED, SNAPSHOT, DYNAMIC_LOOKUP, EXTERNAL_AUTHORITY, CLIENT_SYSTEM_LOOKUP)
- Client-binding and external-authority lookup
- Atlas unavailability resilience
- Fail-closed behavior on mandatory dependency unavailability

**Out of scope (preserved from ATL-95/107):**
- Canonical WD/readiness/runtime-neutrality work (ATL-95 responsibility)
- Three-consumer execution packages (ATL-107 responsibility)
- Runtime-specific implementation/deployment mechanics (AR0.2 Z6 post-boundary)

**Reused evidence:**
- ATL-60 structured execution knowledge and LTL-03/BOL universe
- ATL-119 Business Rule Ontology contract (latest candidate)
- Frozen Operational Knowledge Contract v2
- Frozen Work Decomposition V1 / WorkDefinition V1

---

## 10 Required Proof Obligations

### 1. Rule Model Reconciliation Against Operational Knowledge & Work Decomposition

**Obligation:** Reconcile the rule model against current Operational Knowledge and frozen Work Decomposition / WorkDefinition semantics.

**Approach:**
- Verify that the Business Rule Ontology's rule families map cleanly to OKv2 embedded policy fields
- Verify that WorkDefinition §8 boundary (no runtime leakage) remains respected
- Establish the logical storage boundary: canonical rule in WorkDefinition vs. runtime projection

**Evidence location:** `governance/implementation/ATL_121_PROOF_1_RECONCILIATION_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 2. Consume a Bounded LTL-03/BOL Rule Set

**Obligation:** Classify and consume a bounded LTL-03/BOL rule set using the seed rule taxonomy.

**Approach:**
- Select a representative subset of BOL digitization rules from ATL-60 evidence
- Classify each against the seed rule families
- Record classification, rationale and any taxonomy gaps
- Verify that no important semantic is distorted by forcing into existing families

**Evidence location:** `governance/implementation/ATL_121_PROOF_2_LTL03_CONSUMPTION_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 3. Structurally Different Domain: Taxonomy Extensibility Test

**Obligation:** Use a structurally different process/domain to test whether genuinely new rule semantics require a governed taxonomy extension.

**Approach:**
- Select an evidence-driven use case from a non-BOL domain (e.g. rates/pricing, hazmat compliance, shipment tracking)
- Apply the seed taxonomy
- Identify any semantics that do not fit cleanly
- Follow the candidate's own §5 taxonomy-extension procedure
- Record the new candidate family with definition, scope and differentiation
- Do NOT invent an extension if evidence fits the seed taxonomy

**Evidence location:** `governance/implementation/ATL_121_PROOF_3_TAXONOMY_EXTENSION_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 4. Prove EMBED Distribution Mode

**Obligation:** Prove EMBED — rule is packaged directly into the version-closed runtime package.

**Approach:**
- Select a high-criticality, deterministic rule (e.g. BOL basic field validation, carrier eligibility)
- Create an execution package containing the rule serialized directly as part of the package binary
- Execute the rule from the embedded form in isolation from Atlas
- Verify that the rule evaluates correctly and carries its version/hash identities
- Record the package hash and evidence

**Evidence location:** `governance/implementation/ATL_121_PROOF_4_EMBED_MODE_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 5. Prove SNAPSHOT Distribution Mode

**Obligation:** Prove SNAPSHOT — versioned rule/reference subset is copied into the runtime package and refreshed through controlled release.

**Approach:**
- Select a reference rule set (e.g. US hazmat classification, NMFC commodity codes)
- Create an execution package containing a version-closed snapshot of the reference set
- Run the package with the snapshot
- Advance the reference set upstream (Atlas knowledge store) without changing the deployed package
- Verify that the deployed package continues using the old snapshot while new packages use the new reference
- Simulate a refresh cycle (new package deployment with updated snapshot)
- Record identities, versions, refresh mechanics

**Evidence location:** `governance/implementation/ATL_121_PROOF_5_SNAPSHOT_MODE_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 6. Prove DYNAMIC_LOOKUP Distribution Mode

**Obligation:** Prove DYNAMIC_LOOKUP — executor calls Atlas (or an Atlas-served rule/knowledge API) at runtime.

**Approach:**
- Select a rule that legitimately requires dynamic freshness (e.g. client-specific surcharge rules, current rate lookups, real-time compliance flags)
- Create an execution package that declares the rule as DYNAMIC_LOOKUP
- Implement a minimal rule API endpoint (mock or real Supabase query)
- Run the package calling the API at runtime
- Verify that the package retrieves the current version
- Update the rule source and re-run; verify that new execution gets the updated version
- Record the API contract, rule version tracking, failure behavior

**Evidence location:** `governance/implementation/ATL_121_PROOF_6_DYNAMIC_LOOKUP_MODE_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 7. Prove Client-Binding Lookup

**Obligation:** Prove client-binding lookup — executor obtains client-specific value from declared system of record.

**Approach:**
- Select a rule that has universal semantics but client-specific binding (e.g. handling code for a client's unique accessorials)
- Create an execution package with a CLIENT_BINDING_RULE and CLIENT_SYSTEM_LOOKUP distribution mode
- Implement a client-data lookup (mock or real)
- Run the package for Client A and Client B; verify that each gets its correct client-specific value
- Verify that the package binding remains traceable to Atlas master rule
- Record the binding identities and lineage

**Evidence location:** `governance/implementation/ATL_121_PROOF_7_CLIENT_BINDING_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 8. Prove External-Authority Lookup

**Obligation:** Prove external-authority lookup — executor calls the authoritative external service/source rather than Atlas acting as source of truth.

**Approach:**
- Select a rule where an external authority is the source of truth (e.g. NMFTA hazmat classification, FMCSA safety regulations, carrier-published rates)
- Create an execution package that declares EXTERNAL_AUTHORITY distribution mode
- Implement an external authority call (mock or real)
- Run the package calling the external service
- Verify that the package uses the external authority's current value and version
- Record external authority identity, version tracking, failure behavior

**Evidence location:** `governance/implementation/ATL_121_PROOF_8_EXTERNAL_AUTHORITY_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 9. Prove Atlas Outage Resilience

**Obligation:** Prove Atlas outage does not stop execution whose required semantics are entirely embedded/snapshotted.

**Approach:**
- Create an execution package containing a complete BOL digitization workflow with:
  - EMBED rules for core validation (deterministic, always available)
  - SNAPSHOT rules for reference data (loaded at package creation)
  - A hypothetical DYNAMIC_LOOKUP rule for a non-critical optional enhancement
- Take Atlas offline (or simulate unavailability via error injection)
- Execute the package
- Verify that embedded/snapshotted rules execute successfully
- Verify that the dynamic-lookup rule gracefully fails closed or uses fallback per its failure_behavior policy
- Verify that the overall BOL digitization completes with no silent data loss
- Record failure scenarios and recovery behavior

**Evidence location:** `governance/implementation/ATL_121_PROOF_9_OUTAGE_RESILIENCE_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

### 10. Prove Mandatory Dynamic Dependency Fails Closed

**Obligation:** Prove a mandatory dynamic dependency fails closed when unavailable.

**Approach:**
- Create an execution package with a rule marked as DYNAMIC_LOOKUP and explicitly flagged failure_behavior: FAIL_CLOSED
- Make the rule's source/API unavailable
- Execute the package
- Verify that the rule's evaluation attempt fails and triggers the FAIL_CLOSED behavior (rejects the transaction, escalates, or follows the declared alternative)
- Verify that the package does NOT continue with a silent fallback value or default
- Verify that the failure is auditable and traceable

**Evidence location:** `governance/implementation/ATL_121_PROOF_10_FAIL_CLOSED_V0_1.md`

**Status:** SUPERSEDED — see `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` for real executed evidence for this obligation

---

## Owner Architecture Invariant — Dual-Trigger On-Demand Depth & Execution-Package Release

### Scope
The Owner architecture invariant (added 26 Sep 2026 to ATL-121) mandates that both trigger paths for on-demand depth converge on one bounded mechanism and remain distinct from canonical promotion.

### Required Demonstrations

#### A. Dual-Trigger Paths
**Path 1: Explicit human/user demand** → identify a missing BOL field/rule → research → extraction → validation → deliver to a representative execution consumer without waiting for canonical promotion.

**Path 2: Downstream execution demand** → Malkom (or agent/RPA/BPM) declares a field/rule/decision it cannot execute without → same bounded research mechanism → bounded-execution validation → package release.

**Evidence location:** `governance/implementation/ATL_121_PROOF_OWNER_A_DUAL_TRIGGERS_V0_1.md`

---

#### B. Bounded-Execution Validation Distinct from Canonical Promotion
**Requirement:** End-to-end proof must demonstrate:
- Candidate knowledge passes bounded-execution validation (sufficient evidence for declared consumer/scope)
- Release to Malkom or representative consumer occurs WITHOUT waiting for canonical promotion
- Canonical promotion proceeds independently in parallel (or deferred/not pursued if evidence insufficient)
- Package remains traceable to exact candidate/version/evidence used
- One-off/client-specific logic does not silently become reusable Atlas truth

**Evidence location:** `governance/implementation/ATL_121_PROOF_OWNER_B_VALIDATION_VS_PROMOTION_V0_1.md`

---

#### C. Three-Storage-Layer Separation
**Requirement:** Prove that implementation mechanics respect logical separation:

1. **Atlas Knowledge Store** — durable versioned evidence-backed semantic truth and candidates (exact hash, promotion lifecycle)
2. **Atlas Execution Package Registry** — first-class registry of immutable/version-closed packages authorized for bounded scope (package identity/version/hash, consumer class, exact rule versions, failure behavior, deployment lineage)
3. **Downstream runtime store/cache** — deployed optimized representation consumed by Malkom/agent/RPA (NOT an independent source of business truth; lineage remains traceable to Atlas)

**Evidence location:** `governance/implementation/ATL_121_PROOF_OWNER_C_STORAGE_LAYERS_V0_1.md`

---

#### D. Fast Path for Newly Researched Execution Logic
**Requirement:** Demonstrate the flow: Downstream gap → source-first research → bounded-execution validation → immutable execution-package successor → downstream deployment.

**Evidence location:** `governance/implementation/ATL_121_PROOF_OWNER_D_FAST_PATH_V0_1.md`

---

#### E. Package→Knowledge/Evidence Lineage
**Requirement:** For every executed package, record and verify:
- Package identity and version
- Exact rule versions packaged (with hashes)
- Source evidence (Knowledge Store, candidate version, promotion state)
- Deployment lineage (who released, when, to which consumer/scope)
- Runtime execution lineage (which transactions used this package, with audit trail)

**Evidence location:** `governance/implementation/ATL_121_PROOF_OWNER_E_LINEAGE_V0_1.md`

---

#### F. Fail-Closed for Unsafe Candidates
**Requirement:** Demonstrate that a candidate knowledge that fails execution validation does NOT reach the downstream executor and is NOT marked safe for use.

**Evidence location:** `governance/implementation/ATL_121_PROOF_OWNER_F_FAIL_CLOSED_CANDIDATES_V0_1.md`

---

## Evidence Structure

Each proof obligation generates:

1. **Proof documentation** (.md file with detailed approach, results, observations)
2. **Evidence artifacts** (JSON schemas, rule definitions, package manifests)
3. **Execution traces** (logs showing actual runtime behavior, not assertions)
4. **Validation results** (independent verification of claims, not builder self-report)

All artifacts are committed to GitHub with exact blob SHAs recorded for auditability.

---

## Quality Standards

This proof is **not self-approving**:

- ✓ Real evidence from governed artifacts (ATL-60, ATL-119, Operational Knowledge, Work Decomposition)
- ✓ Actual executable/provable demonstrations, not surrogates or theoretical harnesses
- ✓ Independent verification (each claim against committed evidence, not builder assertion)
- ✓ Failure modes recorded honestly (limitations, gaps, unresolved questions)
- ✓ Exact GitHub identities (blob SHAs, commit hashes) recorded for every material claim
- ✗ NOT self-approved by builder; requires crossed independent QA
- ✗ NOT assumed to replace Owner freeze/promotion gates downstream

---

## Next Actions (V0.1 — superseded, kept for audit trail)

1. ~~Complete all ten proof obligation evidence files~~ — done narratively, then rejected by QA.
2. ~~Complete all Owner acceptance proof files~~ — done narratively, then rejected by QA.
3. ~~Commit all evidence to this branch~~ — done, then rejected by QA.
4. ~~Record exact blob SHAs and commit hashes in the manifest~~ — done, then rejected by QA (manifest-only correction is not sufficient rework).
5. Hand to ChatGPT for crossed independent QA with `Awaiting Independent QA` label — **now applies to the V0.2 executable evidence below, not this file's original content.**
6. Await ATL-121 PASS disposition before proceeding to ATL-110 freeze — unchanged.

## Next Actions (V0.2 — current)

1. Real executable proof harness built under `governance/implementation/atl121_proofs/` — done.
2. Suite executed (`pytest -v -s`); one real defect found and fixed (Proof 10 exception-propagation bug); re-executed clean (16/16 pass) — done.
3. `ATL_121_EXECUTABLE_EVIDENCE_V0_2.md` written, quoting real captured output — done.
4. This manifest updated with the V0.2 commit/blob identities (recorded in a follow-up commit per this repo's established two-commit pattern, e.g. `cf10322` → `e2e47aa`) — pending.
5. Hand to ChatGPT for crossed independent QA with `Awaiting Independent QA` label — pending (Owner/ChatGPT action, not Claude's to self-grant).
6. Await ATL-121 PASS disposition before proceeding to ATL-110 freeze — unchanged.

---

## Manifest

### V0.1 (superseded — rejected by independent QA, kept for audit trail only)

| Proof | File | Status | Blob SHA | Commit |
|---|---|---|---|---|
| Structure | ATL_121_RULE_ONTOLOGY_RUNTIME_PROOF_V0_1.md | SUPERSEDED | e81130e0abe05c197f896b879f6d69745a1013d4 | cf10322213c9c8a3c9d4c1f06ed5d73925d70ce6 |
| Reconciliation (1) | ATL_121_PROOF_1_RECONCILIATION_V0_1.md | SUPERSEDED | 6d677af9ee55975704871705b4896f02047f807b | cf10322213c9c8a3c9d4c1f06ed5d73925d70ce6 |
| LTL-03 Consumption (2) | ATL_121_PROOF_2_LTL03_CONSUMPTION_V0_1.md | SUPERSEDED | c12baa8c3a48db871e623b4928a986ebd71f966b | cf10322213c9c8a3c9d4c1f06ed5d73925d70ce6 |
| Proofs 3-10 & Owner A-F | ATL_121_COMPREHENSIVE_PROOFS_3_TO_10_V0_1.md | SUPERSEDED | 3b4fa3eb5628014526501883c6411cdf210229d7 | cf10322213c9c8a3c9d4c1f06ed5d73925d70ce6 |

### V0.2 (current — executable evidence, awaiting independent QA)

| Artifact | Path | Status | Blob SHA | Commit |
|---|---|---|---|---|
| Executable evidence doc | governance/implementation/ATL_121_EXECUTABLE_EVIDENCE_V0_2.md | AWAITING_INDEPENDENT_QA | _recorded in follow-up commit_ | _pending_ |
| Proof harness code + results | governance/implementation/atl121_proofs/ (10 files + results/) | AWAITING_INDEPENDENT_QA | _recorded in follow-up commit_ | _pending_ |

_Exact blob SHAs and the commit hash will be recorded here in a follow-up commit against this same file, per this repo's established pattern (see `cf10322` → `e2e47aa` for V0.1), immediately after the code/evidence commit lands — not before, so the recorded identities are always real, not anticipated._

---

**Compiled:** 2026-09-26T18:30:00Z (V0.1) / 2026-09-27 (V0.2 rework)  
**Ready for:** Proof obligation execution
