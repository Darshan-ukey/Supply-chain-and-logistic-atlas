# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Purpose:** Persistent direct coordination/handover file for ChatGPT and Claude. Both executors must read this file before starting/resuming Atlas work and write material findings here so the Owner does not have to relay conversations between tools.

> Full history through D2.0.2 closure and D2.0.3 PRE_ACTION remains recoverable at blob `78e4c8091fb7e13bacf7f68c87f3a478de4b039e`. Existing architecture, GitHub-only, no-Vercel, two-lineage and audit rules remain binding.

## 2026-09-12 — ChatGPT — D2.0.3
Classification: VERIFIED_REPOSITORY_FACT
Checkpoint: MATERIAL_FINDING

Evidence inspected:
- Recursive Git tree of current demo branch `atlas-v2-demo-2026-09-14`.

Material finding:
- The current demo branch does contain the older/proven Road LTL Domain Warehouse / WorkDefinition / Malkom reference assets needed for D2.0.3–D2.0.4. They are not hypothetical recovery targets.
- Concrete reference WD asset located: `canvas-v2/data/road-ltl-workdefinitions-v2.3.json`, blob SHA `f1670218f5925c1db5358a5e17d25228107043bf`, size 167,329 bytes.
- Related reference assets located on the same branch include:
  - `canvas-v2/data/road-ltl-audit-v2.3.csv`
  - `canvas-v2/data/road-ltl-canvas-v2.0-map.json`
  - `canvas-v2/data/road-ltl-domain-contract-v1.0.json`
  - `canvas-v2/data/road-ltl-roadmap-c1-c5.json`
  - `canvas-v2/data/road-ltl-v1.3-source.json`
  - `malkom-adapter-v0.1.html`
  - `api-secure/malkom-adapter-v0.1.html`
  - `malkom3-workdefinition-v1.schema.json`
  - `road-ltl-projection-v0.1.package.json`
  - `ROAD_LTL_MALKOM3_ADAPTER_BUILD_V0.1.md`
  - `ROAD_LTL_MALKOM3_ADAPTER_PROJECTION_PACKAGE_V0.1.md`
  - `ROAD_LTL_MALKOM3_ADAPTER_EMBED_V0.1.md`
  - `ROAD_LTL_MALKOM3_INTEGRATED_CERTIFICATION_V0.2.md`
  - `ROAD_LTL_MALKOM3_SEMANTIC_GAP_REGISTER_V0.1.md`
  - `MALKOM3_ADAPTER_V0.1_TEST_REPORT.md`
  - `MALKOM3_STAGE3_PROJECTION_VERIFICATION_REPORT.md`
  - `ROAD_LTL_SHOWCASE_BUILD_REPORT_V2.3.md`
  - `ROAD_LTL_SHOWCASE_RELEASE_V2.3.md`
  - `ROAD_LTL_WORKDEFINITION_V2.3_QA_REPORT.md`
  - `ROAD_LTL_COMPREHENSIVE_LOGIC_AUDIT_V2.3.md`.

Interpretation / guardrail:
- This strengthens the hybrid strategy: the old execution-reference lineage is physically present on the demo branch and can be audited rather than recreated.
- Presence alone does not prove exact definition counts, queue/subqueue counts, Malkom semantic fidelity or current UI consumption. Those claims remain unverified until the bundle and certification reports are inspected.
- This does not connect the reference lineage to Road LTL 1.5/P6.1/P6.2. The two lineages remain separate unless explicit bridge evidence is found.

Current/Demo/Target effect:
- CURRENT: no mutation.
- DEMO: D2.0.3 can preferentially reuse/certify existing execution-reference assets instead of authoring new semantics.
- TARGET: no change; these remain bridge/reference assets to retire/rebase after canonical target parity.

Next exact action:
- Inspect the v2.3 WorkDefinition bundle and Malkom projection/certification/gap reports to verify counts, lineage, mapping behavior, known semantic losses and actual UI/adapter consumption before any D2.0.3 code change.
