# Execution Demo Environment — Action Checklist
Legend: [ ] pending; [x] decision captured (not implementation complete).

## Governance and setup
- [x] Agree Atlas/execution-tool boundary
- [x] Agree parallel MVP + Wave 3 approach
- [x] Agree no repeated Wave 3 reconciliation
- [x] Agree isolated branch and preview before production
- [x] Agree execution-readiness certification in Atlas
- [ ] Identify latest verified W3 evidence pointers and source asset commit SHAs (lookup only; no new reconciliation)
- [ ] Create isolated feature branch from approved live baseline; record SHA, preview URL and rollback plan
- [ ] Create baseline acceptance criteria and non-regression tests for existing Atlas
- [ ] Confirm public/admin visibility for Work Decomposition and execution artifacts

## Product assembly
- [ ] Decide specific frontend corrections before integration
- [ ] Integrate existing OKv2 and LTL domain depth
- [ ] Integrate Canvas V2, retaining governed context, zoom, signals and trace
- [ ] Integrate Work Decomposition/Work Definitions with access controls
- [ ] Integrate verified partial Ocean pages with clear incomplete labels
- [ ] Preserve and extend Ask Atlas and Inspector knowledge grounding
- [ ] Select five connected LTL processes from governed universe; document why each tests a distinct capability
- [ ] Build missing depth for selected processes; distinguish verified knowledge vs inferred/reference-only
- [ ] Implement storage-neutral knowledge APIs and contract validation (JSON acceptable for MVP)
- [ ] Validate LTL and Ocean using shared model; run preview regression and accessibility/security checks

## Tool-compatibility certification
- [ ] Define versioned neutral execution-readiness package schema: process/activity IDs, hierarchy, inputs/outputs, dependencies, variants, roles, rules, decision definitions, controls, escalation/HITL definitions, data mappings, interfaces, evidence, audit and acceptance criteria
- [ ] Define mandatory vs conditional fields and explicit missing/unknown semantics
- [ ] Define tool profile and compatibility matrix: agentic AI, desktop RPA, BPM/workflow, digital twin, human work management, enterprise apps
- [ ] Define levels: knowledge-ready, tool-mappable, simulation-validated, production-ready (last excluded from MVP claim)
- [ ] Specify independent test harness input/output and evidence manifest
- [ ] Build lightweight external agentic harness with mocked tools, deterministic rules and optional open-model reasoning
- [ ] Evaluate free/open-source BPMN validation/simulation; do not assume licences
- [ ] Define desktop bot-ready specification; optional local test only
- [ ] Define digital-twin state/transition/resource/time specification; optional simulation
- [ ] Test successful and failing mappings, incomplete knowledge, version mismatches and rejected handoffs
- [ ] Publish per-process/per-tool evidence-backed compatibility report inside Atlas

## Cross-domain and release
- [ ] Reuse Vendor Debit process understanding, execution-ready knowledge and site validation pack as independent cross-domain case
- [ ] Verify Vendor Debit V4 existence/content before claiming any detailed counts or coverage
- [ ] Validate no live transactions, enterprise credentials or paid platform dependencies
- [ ] Compare MVP contract to evolving Wave 3 contract and record drift/decisions
- [ ] Independent QA, evidence custody and readback
- [ ] Owner signoff; promote tested branch only after explicit authorization

## Candidate LTL process selection — not finalized
Select five distinct connected processes that cover: documentation/data, decision/variation, exception/control definition, cross-functional handoff and commercial/financial knowledge. Choose actual canonical process names from existing 27-process universe and record connectivity and knowledge availability. BOL can be one, but not the entire demonstration.

## Open decisions
- Exact five LTL processes and depth/coverage criteria
- Specific frontend corrections and asset integration order
- Which agentic framework/model endpoint, if any, to use
- Whether a BPMN engine/simulator or only BPMN validation is needed
- Which execution-tool profile to use for first end-to-end mock handoff
- Source-of-truth and evidence publishing location for this parallel track
