# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Purpose:** Persistent direct coordination/handover file for ChatGPT and Claude. Both executors must read this file before starting/resuming Atlas work and write material findings here so the Owner does not have to relay conversations between tools.

**Repository:** `Darshan-ukey/Supply-chain-and-logistic-atlas`  
**Canonical governance branch:** `atlas-governance-registry-v2.1`  
**Current program:** Atlas V2 Hybrid Demo Sprint  
**Target:** functional concept live Monday 14 Sep 2026; stakeholder/Malkom 3.0 demo Tuesday 15 Sep 2026.  
**Primary executor:** ChatGPT  
**Hot backup:** Claude

---

# 0. Mandatory read order

Before any implementation/audit action, read:
1. `claude_chatGPT.md` — this file.
2. `governance/demo-sprint/ATLAS_CURRENT_DEMO_TARGET_STATE_MAP.md` — Current Live vs Monday Demo vs Target Atlas V2.
3. `governance/demo-sprint/ATLAS_VERCEL_PROJECT_AND_DEPLOYMENT_DISPOSITION_AUDIT.md` — protected foundation + Vercel estate cleanup rules.
4. `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` — machine authorization/current stage.
5. `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_PROTOCOL.md`.
6. `governance/demo-sprint/ATLAS_V2_DEMO_HANDOVER.md`.
7. `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_LOG.md`.
8. Frozen architecture/governance assets referenced by the active stage.

If any two records conflict, STOP, reconcile governance first, then implement.

---

# 1. Collaboration protocol

1. ChatGPT is primary executor for the current demo sprint. Claude is hot backup.
2. Claude may take over only when ChatGPT is unavailable/fails or the Owner directs takeover, and only for the exact current authorized demo stage.
3. After every material audit, architecture finding, build decision, stage completion, defect, deployment observation or discrepancy, update this file.
4. Every entry should classify the statement as one of:
   - `VERIFIED_REPOSITORY_FACT`
   - `VERIFIED_RUNTIME_FACT`
   - `OWNER_DIRECTION`
   - `WORKING_DEMO_DECISION`
   - `HYPOTHESIS / REQUIRES_VERIFICATION`
5. Never silently convert remembered/chat information into canonical truth.
6. GitHub is canonical source/version history. Vercel is deployment/runtime. Backend Knowledge Warehouse/Supabase may be canonical persistence for governed runtime knowledge, but does not replace GitHub/Drive custody requirements.
7. Do not overwrite historical frozen assets. Create new versioned/frozen full states.
8. No delta-only certification: every passed demo stage must preserve a complete reproducible repository state.
9. Monday is a proof-of-concept/demo release, not full Atlas V2 production certification.

---

# 2. Three-state model — NON-NEGOTIABLE

Detailed authoritative reference:
`governance/demo-sprint/ATLAS_CURRENT_DEMO_TARGET_STATE_MAP.md`

Every executor must distinguish CURRENT, DEMO and TARGET.

## A. CURRENT LIVE / REGISTERED PRODUCTION BASELINE

Verified frozen production registry:
- Universe **7.3**
- Road LTL **1.3** production baseline
- Ocean FCL **0.5** production baseline
- Ocean LCL **0.5** production baseline
- Canvas **2.0.0** registered baseline
- Universal Ask / Ask Atlas **2.0.1**
- Atlas Warehouse **1**

Latest candidate/reference assets include Road LTL 1.5, Road LTL 1.5 Operational Knowledge, Ocean FCL/LCL 0.6, OK Contract v2 candidate, Information Resolution v1 and BOL Information Resolution baseline v0.1. Candidate ≠ production.

### Owner-designated foundation URL — authoritative operating direction
**Classification:** `OWNER_DIRECTION`

The foundation to preserve and eventually update is:

> **`supplychainatlas.vercel.app`**

The Owner identifies this as the Atlas foundation release that went live around **23–25 August 2026**.

This is the foundation/rollback reference and eventual upgrade target. Do not substitute another Vercel URL merely because it has a newer deployment or a project name that looks more current.

### Multiple Vercel projects/deployments — treat as unclassified until audited
**Classification:** `VERIFIED_RUNTIME_FACT + OWNER_DIRECTION`

The Vercel account contains multiple distinct Atlas-related projects, consistent with the earlier uncontrolled deployment/storage problem. Projects observed include:
- `logistic_atlas_v2` — `prj_zoyyLeFrvLKHFU8Unzq3Cr8zWDc0`
- `supply-chain-atlas-stable` — `prj_55NW2WX6uUJUIFQiGkCnKeamLHCt`
- `supply-chain-atlas-lab` — `prj_nGwhhmGv8q8gS6vyRzOprBhqTZQm`
- `sc-and-logistics-atlas-intelligence-v0` — `prj_LzA4amX6vI7KfGFgZ16LVv5OXLFp`
- `atlas-intelligence-v0.6.1` — `prj_b8tjr188wT4044p9g0SZuMzIZ4Qb`
- `atlas-intelligence-v0` — `prj_F181CWtauq0Qrc4GmPRoJO11hVsG`
- `logistics_atlas1.0` — `prj_rOw8qi3vnUY2YeCa6jXOK0d3GRVj`
- `atlas-intelligence-v05-compile-test` — `prj_HnBFRmSpydMevZ9HqbZKV4e0w8Uq`

None of these may be assumed to be disposable or authoritative solely by name.

Detailed audit file:
`governance/demo-sprint/ATLAS_VERCEL_PROJECT_AND_DEPLOYMENT_DISPOSITION_AUDIT.md`

### Vercel deletion rule
No Atlas-related Vercel project/deployment may be deleted until it is classified as one of:
- `FOUNDATION_KEEP`
- `ACTIVE_BUILD_KEEP`
- `UNIQUE_RECOVERY_REQUIRED`
- `HISTORICAL_KEEP`
- `DUPLICATE_SAFE_TO_DELETE`
- `OBSOLETE_SAFE_TO_DELETE`
- `TEMPORARY_PREVIEW_SAFE_TO_DELETE`
- `UNKNOWN_BLOCK_DELETE`

Deletion requires proof that no unique source/work/configuration will be lost and explicit Owner approval of the deletion batch.

### Current live seam still unresolved
The frozen registry says Road LTL 1.3 production, while older live/Canvas references appear tied to V1.2. Exact runtime-served version/hash must be proven, not assumed.

The exact Vercel project/deployment currently serving `supplychainatlas.vercel.app` must also be proven during D2.0.0. Owner authority establishes the URL's role as foundation; technical mapping still needs evidence.

### Current-state preservation rule
The Aug 23/25 `supplychainatlas.vercel.app` foundation remains the rollback baseline until demo/target parity is certified. Demo work must not mutate it in place.

---

## B. MONDAY HYBRID DEMO

Purpose: functional proof, not final architecture.

Owner accepts approximately 60–70% workable/acceptable **representative execution depth** for the POC. Do not turn this into a fabricated numeric Atlas completeness score.

Selected strategy:
`HYBRID_REUSE_PROVEN_EXECUTION_LINEAGE_WITH_ADDITIVE_ATLAS_V2_SURFACE`

### Demo surface/direction
Communicate:
`Sources → Universe → Daughter Domain → Operational Knowledge → Work Decomposition → WorkDefinition → Enterprise/Client Binding → Execution Readiness → Adapters`

### Demo execution proof
Reuse only after verification:
`Road LTL V1.2 → Domain Warehouse v2.3 / reference WorkDefinition → Malkom 3.0 projection`

Do not claim Road LTL v1.4/v1.5/R0.3 currently generates it.

### Ocean
Ocean 0.6 may be used as Owner-authorized demo candidate surface. Do not relabel it as production or imply Road-LTL-equivalent execution depth.

### Governance/readiness view
Keep it secondary/admin. The five-minute stakeholder story is capability/proof, not governance theater.

### Demo asset disposition classes
Every new/reused demo component must be one of:
- `KEEP`
- `BUILD_ON`
- `BRIDGE`
- `REPLACE`
- `RETIRE_AFTER_PARITY`
- `DEMO_ONLY`

Default post-demo disposition:
- Page 0 / Universe UI: **BUILD_ON** if target-data-driven.
- Universe 7.3: **KEEP** until governed evidence requires successor.
- Canvas V2 additive shell: **BUILD_ON** if it remains a materialized view over governed data.
- Old Road LTL V1.2 execution proof: **RETIRE_AFTER_PARITY** from active canonical path; preserve as historical/test reference.
- Domain Warehouse v2.3 proof fixtures: **BRIDGE/REPLACE** once canonical WD VNext compiler exists.
- Malkom adapter: **BUILD_ON**, then rebase to target canonical specification/output.
- Governance/readiness panel: **BUILD_ON**.
- Hand-authored semantic bridge logic: **DEMO_ONLY/AVOID** unless explicitly Owner-authorized.

---

## C. TARGET ATLAS V2

Product identity:
> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

Boundary:
> **Atlas owns understanding and specification. Downstream platforms own execution.**

### Frozen current canonical chain
`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection/Compiler → Execution outside Atlas → Evidence/Feedback`

### AR0.2 target-candidate refinement — NOT YET OWNER-FROZEN
`Authoritative Sources`
→ `Reference Domain + Operational Knowledge`
→ `Canonical Work Decomposition`
→ `Canonical WorkDefinition`
→ `Enterprise Context / Client Binding`
→ `Governed Specification Assembly`
   - Scope Manifest
   - Resolution/Readiness Proof
   - Version-Closed Specification Manifest
→ optional `Design / Solution Synthesis`
→ `Runtime Adapter / Projection`
→ `Execution Runtime [outside Atlas]`
→ `Observation / Evidence Reconciliation`
→ governed feedback/knowledge-gap process

Do not implement candidate layers as frozen truth until Owner approval.

---

# 3. Target storage / governance / UI model

Detailed specification lives in `ATLAS_CURRENT_DEMO_TARGET_STATE_MAP.md`.

## 3.1 Canonical persistence
- Backend **Knowledge Warehouse** = canonical persistent governed knowledge/state.
- HTML, Canvas, JSON exports, WorkDefinition packages and runtime projections = materialized/derived views.
- UI never becomes semantic source of truth.
- GitHub = canonical schemas, code, governance, tooling, version history.
- Drive = durable governed evidence/custody where required.

## 3.2 Source layer
Store source identity, publisher/authority, version/effective date, custody location, hash/snapshot, applicability, source claims, supersession/deprecation state, review cadence and provenance links.

Current source-review cycle:
`CHECK_ISSUER_VERSIONS → INGEST_DELTA_METADATA → COMPARE_PRIOR_SNAPSHOT → CLASSIFY_NEW_CHANGED_DEPRECATED → RUN_SOURCE_TO_ATLAS_COVERAGE → OPEN_GAPS → SME_GOVERNANCE_REVIEW → UPDATE_ATLAS_ONLY_IF_APPROVED → REGRESSION_TEST → PUBLISH_VERSIONED_SNAPSHOT`

Routine cadence: 6 months; material release triggers early review.

## 3.3 Universe
Store cross-domain hierarchy/identities, relationships/crosswalks, applicability, versions/supersession and source coverage. Daughter updates do not automatically create a new Universe version.

## 3.4 Daughter domains
Store governed domain/process/task reference work linked to Universe IDs: processes/tasks, actors, objects/documents/information concepts, rules/constraints, states/events/outcomes, source claims, version/lineage, unresolved knowledge and applicability.

## 3.5 Operational Knowledge
Store business meaning, required/prohibited conditions, information-resolution logic, validations/controls, decisions/authority, outcomes, exceptions/escalation/recovery, evidence expectations, ambiguity/conflict/UNKNOWN state, provenance and reusable client-binding requirements.

Missing knowledge remains explicit. It is not fabricated downstream.

## 3.6 Canonical Work Decomposition
Store parent A5 lineage, canonical child work units, semantic type, trigger/prerequisites/dependencies, business-significant ordering/parallelism, rationale/evidence, human/system business boundary, exception/escalation/retry/recovery relationships and completion/evidence requirements.

Canonical decomposition stops at business-semantic sufficiency, not runtime convenience, if/when AR0.2 refinement is approved.

## 3.7 Canonical WorkDefinition
Store technology-neutral execution semantics: identity/version/lineage, applicability, canonical inputs/objects/fields, rules/controls, decisions/authority, permitted actions/exchanges, HITL boundary, states/outcomes/transitions, waits/clocks, exceptions/escalation/business retry/recovery, evidence/completion and client-binding requirement references.

Do not place Malkom queues/subqueues, agent prompts/models, BPMN node IDs, vendor configuration or credentials into canonical WD truth.

## 3.8 Enterprise Context / Client Binding
Store client systems/SORs, field/API mappings, masters/network/serviceability, SLA/cutoffs/thresholds, policy variants/precedence, role/authority mapping, exception routing, communication channels, local contractual/regulatory constraints and optional workload/capacity/NFR context.

Client reality overlays reference truth; it does not mutate reusable domain truth.

## 3.9 Governed Specification Assembly — candidate
Derived references/proofs only: scope membership, dependency closure, unresolved/conflicting/client-binding-required facts, readiness/blockers and version-closed specification identity. Must not duplicate canonical truth.

## 3.10 Runtime adapters/projections
Store target runtime identity/capabilities, canonical-to-native mappings, semantic loss/capability gaps, native queue/workflow/agent/ERP/TMS/RPA projections, connector/runtime configuration and verification results. Derived/reproducible; never canonical business truth.

## 3.11 Observation/evidence — candidate
Store canonical/specification reference, execution instance, observed states/events/evidence, conformance/deviation and proposed knowledge gaps. Runtime observations cannot silently mutate canonical knowledge.

---

# 4. Target change propagation to UI

`Source change detected`
→ preserve version/hash/snapshot
→ classify affected claims
→ impact-map Universe/Daughter/OK
→ open gaps/conflicts
→ SME/governance review as needed
→ approve canonical change
→ write new governed version to Warehouse/GitHub-defined contracts
→ selectively regenerate daughter/materialized views
→ selectively regenerate decomposition
→ selectively regenerate WorkDefinitions
→ recompute enterprise bindings/readiness/specification packages
→ regenerate affected runtime projections
→ regression/security/trace checks
→ publish versioned snapshot
→ UI refreshes/materializes approved state
→ preserve prior version + rollback lineage.

No semantic truth is created by directly editing UI copy/data to make a screen look complete.

### Target UI behavior
- Page 0 reads approved Universe version.
- Daughter UI reads approved daughter + linked OK.
- Execution-depth UI resolves OK → decomposition → WD; if missing, displays UNKNOWN/BLOCKED rather than inventing depth.
- Client view overlays Enterprise Context/Binding without mutating reference truth.
- Adapter view renders generated target projection with lineage + capability/loss visibility.
- Public UI remains sanitized.
- Protected/admin UI may show detailed decomposition, WD, source/provenance, client-binding requirements, runtime projections, readiness and machine-readable artifacts.

---

# 5. Current → Demo → Target gap summary

## Current → Demo
Still to verify/build:
- exact `supplychainatlas.vercel.app` → Vercel project/deployment mapping;
- exact Aug 23/25 foundation deployment/source identity;
- exact live Road LTL served version/hash;
- authoritative Canvas V2 asset/deployment history;
- old V1.2 → Domain Warehouse v2.3 → Malkom assets/counts/scripts/gaps;
- additive compatibility with live foundation;
- Ocean 0.6 demo wiring;
- representative execution-depth navigation;
- Malkom projection in demo surface;
- public/admin regression;
- controlled promotion + rollback.

## Vercel estate cleanup gap
Still required separately from the demo feature build:
- inventory all Atlas projects/deployments;
- identify duplicates/previews/labs/historical states;
- identify any Vercel-only unique work;
- recover unique work to GitHub before deletion;
- map backend/config differences;
- quantify storage contribution where possible;
- prepare reviewed deletion manifest;
- delete only after Owner approval.

## Demo → Target
Demo will **not** solve:
- governed compiler from Road LTL 1.4/1.5 + OK into WD VNext;
- canonical replacement for old V1.2/Domain Warehouse v2.3 proof lineage;
- complete recursive decomposition compiler;
- production-complete WD VNext contracts/materialization;
- remaining canonical object contracts / Information Resolution depth / knowledge gaps;
- final scope-level readiness/specification architecture;
- generic observation/evidence contract;
- Ocean execution-depth parity;
- full Enterprise Context materialization;
- adapters beyond Malkom;
- full P6 security/public-protected certification;
- full Atlas V2 production promotion.

### Post-demo rule
Resume governed architecture/production critical path. Demo success does not close AR0.2–AR0.6, R0.4+, P6.2+ or `ATLAS_V2_GO_LIVE`.

---

# 6. Joint demo strategy decisions retained

- Hybrid demo selected; do not create a third canonical architecture.
- Do not build a full new v1.4/v1.5 → old v2.3 bridge for Monday.
- Do not hand-author LTL-03 into canonical/demo execution lineage without explicit Owner sub-authorization.
- Governance/readiness view exists but is secondary.
- Prefer several representative execution patterns: deterministic, decision-heavy, HITL, exception/escalation, document/information-intensive.
- New stakeholder page: **Atlas — From Domain Knowledge to Execution Readiness**.
- Malkom = first downstream consumer/projection, not Atlas canonical truth.
- `supplychainatlas.vercel.app` = protected Aug 23/25 foundation and eventual upgrade target.
- Other Atlas Vercel projects/deployments = unclassified until forensic disposition audit.
- No Vercel cleanup deletion during demo build without explicit evidence + Owner approval.

---

# 7. Current D2.0 stage plan

- `D2.0.0` — Baseline seam verification + hybrid release freeze, including foundation identification and Vercel estate inventory.
- `D2.0.1` — Additive Canvas V2 shell + Atlas scope/future page.
- `D2.0.2` — Road LTL + Ocean demo domain surfaces.
- `D2.0.3` — Proven Road LTL execution-depth integration from verified V1.2/Domain Warehouse v2.3 proof.
- `D2.0.4` — Malkom 3.0 adapter/projection integration from proven reference lineage.
- `D2.0.5` — Representative POC journey + secondary governance/readiness view.
- `D2.0.6` — Full hybrid integration/regression/deployment-parity certification + full-state freeze.
- `D2.0.7` — Controlled Monday demo promotion with Owner approval.

Current authorized stage: **D2.0.0 only**.

---

# 8. Update template — both executors

```text
## YYYY-MM-DD HH:MM — <Executor> — <Stage>
Classification: VERIFIED_REPOSITORY_FACT | VERIFIED_RUNTIME_FACT | OWNER_DIRECTION | WORKING_DEMO_DECISION | HYPOTHESIS

Evidence inspected:
- <path/ref/commit/runtime>

Finding / action:
- ...

Impact / guardrail:
- ...

Current/Demo/Target effect:
- CURRENT: ...
- DEMO: ...
- TARGET: ...

Next action:
- ...
```
