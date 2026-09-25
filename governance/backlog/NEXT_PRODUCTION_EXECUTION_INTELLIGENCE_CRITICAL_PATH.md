# Atlas V2 — Governed Roadmap and Critical Paths

Status: ACTIVE BACKLOG / DEMO SPRINT PRIORITY / ARCHITECTURE REFINEMENT PRESERVED  
Updated: 12 September 2026  
Canonical machine queue: `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on `atlas-governance-registry-v2.1`.

## Immediate priority — Atlas V2 Demo Sprint

Owner target: GitHub-certified functional Atlas 2.0 demo concept by Monday 14 September 2026 for stakeholder demonstration Tuesday 15 September 2026. **No Vercel deployment/preview/promotion is authorized.** Demo branch: `atlas-v2-demo-2026-09-14`; merge to `main` is separately Owner-gated and does not authorize Vercel.

### Corrected two-lineage demo architecture — 12 Sep evidence

**New governed target lineage**  
`Road LTL 1.5 → Operational Knowledge → Certified Recursive Decomposition (P6.1) → Canonical WorkDefinition compiler proven (P6.2), persistence pending → Client Binding / Runtime Projection not yet complete`

Evidence state: P6.1 = 22 tasks / 603 work units / 444 terminal leaves / 185 EXECUTOR_READY / 163 BLOCKED_BY_CLIENT_BINDING / 96 BLOCKED_BY_KNOWLEDGE_GAP. P6.2 compiler/verifier path is technically proven against its frozen contract, but canonical WD persistence is not authorized/completed. Do not show 185 WDs as persisted/canonical until persistence + QA/custody actually occur.

**Proven Malkom execution-reference lineage**  
`Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0 projection`

This remains the proven Malkom-consumable adapter/projection reference unless D2.0.0+ verifies a new-lineage Client Binding + Malkom projection. **Never imply that the existing Malkom proof was generated from Road LTL 1.5/P6.2.**

### Why the demo path was corrected
Earlier demo planning conservatively treated recursive decomposition / canonical WD implementation in the new lineage as largely unfinished. Claude's 12 Sep forensic review recovered stronger evidence: P6.1 is certified/live in the protected store and P6.2's compiler infrastructure exists and passes certification. The remaining seam to Malkom is downstream of canonical compilation: persistence/custody where applicable, Client Binding, and Runtime Projection. The hybrid demo therefore remains valid, but its narrative must show the actual maturity of both lineages rather than understating the new lineage or overstating its Malkom connectivity.

## Demo stages

### D2.0.0 — Baseline seam verification + branch/freeze setup
Status: CURRENT / completion evidence must reconcile both lineages.

Verify repository/foundation baseline, Canvas assets/history, exact Road LTL version seams, P6.1/P6.2 evidence, old Domain Warehouse 2.3/Malkom proof assets, branch provenance, additive compatibility and no Vercel side effect. Freeze the complete pre-change state.

### D2.0.1 — Additive Canvas V2 shell + Atlas scope/future page
Status: Owner separately authorized Claude to execute in parallel; any completed work is valid if logged/audited. Present `Atlas — From Domain Knowledge to Execution Readiness` without redefining canonical truth.

### D2.0.2 — Road LTL + Ocean demo domain surfaces
Show verified Road LTL target-lineage maturity and Ocean candidate surface with exact status labels. Fail closed where Ocean execution depth is unavailable.

### D2.0.3 — Road LTL execution-depth integration
Expose the **new governed lineage** accurately through certified P6.1 decomposition and P6.2 compiler-ready status where inspectable. For actual Malkom execution-depth proof, use the **old proven reference lineage** and label it explicitly. Do not fabricate persisted P6.2 WDs and do not rebrand Domain Warehouse 2.3 artifacts as Road LTL 1.5 outputs.

### D2.0.4 — Malkom 3.0 adapter/projection integration
Demonstrate the verified `Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0` reference adapter/projection. Malkom is the first execution consumer, not canonical Atlas truth. If a new-lineage Malkom seam is discovered, it requires independent verification before replacing this reference path.

### D2.0.5 — Representative POC journey + secondary governance/readiness view
Connect the stakeholder journey. Governance/readiness remains secondary. Explicit blocker classes may be shown, but no fake numeric completeness score and no claim of persisted 185 WDs before P6.2 authorization/persistence/QA.

### D2.0.6 — GitHub full integration + regression + merge-readiness certification
Full-state audit, security/public-admin boundary checks, stale/false-version-label checks, complete repository freeze. No Vercel deployment/parity requirement.

### D2.0.7 — Owner-approved merge to `main`
Requires D2.0.6 PASS + explicit Owner approval. Merge to `main` is **not** Vercel go-live authorization.

## Preserved architecture/recovery state
- R0.1A-R/R0.1B/R0.1C/R0.2/R0.3: COMPLETE / QA PASS as recorded in machine queue.
- AR0.1: COMPLETE; targeted successor refinement required.
- AR0.2 candidate remains Owner-review pending during demo sprint.
- P6.1 evidence is now explicitly recognized as certified/live protected decomposition.
- P6.2 implementation is materially mature but persistence remains gated/unauthorized.
- No production pointer changes are implied by the demo.

## Post-demo architecture / production correction
The historical fully serial `AR0.2 → AR0.6 → R0.4 → R0.6 → P6.2 → P6.5` path must **not be resumed blindly**. Evidence recovered on 12 Sep shows the old blanket recovery/architecture gate is too coarse.

Candidate successor certification boundaries, pending Owner freeze:
1. `P6_2_PARTIAL_WD_COMPILE_GATE`
2. `SCOPE_EXECUTION_READINESS_GATE`
3. `RUNTIME_PROJECTION_GATE`
4. `FULL_DOMAIN_COVERAGE_GATE`

Partial canonical materialization is permissible in principle if each candidate leaf is semantically sufficient and blockers remain explicit. If all current ready leaves pass review, coverage is `444 terminal / 185 compiled / 163 client-binding blocked / 96 knowledge-gap blocked`; this must never be called full Road LTL execution readiness.

Post-demo re-baselining should consider parallel tracks for canonical WD materialization, knowledge hardening, Client Binding framework, architecture refinement, security/public-protected certification and multi-mode/Ocean proof. True upstream contract dependencies remain serial.

## Platform North Star
> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

> **Atlas owns understanding and specification. Downstream platforms own execution.**

Knowledge repository, governance platform, execution/implementation readiness and solution-architecture capability are outcomes/byproducts of the governed Atlas foundation. Runtime business execution remains outside Atlas.

## Recovery references
- Detailed architecture correction: `governance/architecture-refinement/CHATGPT_RESPONSE_TO_CLAUDE_P6_AR_GATES_2026-09-12.md`
- Architecture log: `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_LOG.md`
- Decision ledger: `governance/architecture-refinement/ARCHITECTURE_DECISION_LEDGER_V1.md`
- Shared executor state: `claude_chatGPT.md`
- Demo protocol/state map/handover must be reconciled to this corrected lineage before later demo-stage closure.
