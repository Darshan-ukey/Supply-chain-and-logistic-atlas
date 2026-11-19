# Execution Demo Environment — Atlas Parallel MVP Track
Status: PLANNED / NOT IMPLEMENTED. Owner-approved scope captured 2026-11-19.
This directory is a project-planning workspace, not an assertion that a branch, backend, integration or certification exists.

## Purpose
Demonstrate Atlas as an operations intelligence and execution-readiness knowledge product while Wave 3 universal architecture proceeds independently. The execution environment is **outside Atlas**. Atlas defines work, rules, controls, roles, variations, dependencies, data requirements, handoff and evidence specifications; receiving tools evaluate transactions, choose next operational actions, detect live exceptions and execute tasks.

## Agreed decisions
- No new broad asset reconciliation: inherit completed Wave 3 W3-21/W3-22 evidence, current W3-23 checkpoints and verified frozen assets. Only investigate specific uncovered gaps.
- Never alter the live deployment during assembly. Create an isolated copy/feature branch and Vercel preview, test and approve before promotion.
- Integrate existing assets where appropriate: OKv2, Canvas V2 hybrid spine+towers, Road LTL domain depth, Work Decomposition/Work Definitions, partly built Ocean pages, Ask Atlas, Trace/Inspector and existing UI.
- Expand LTL to **at least five connected end-to-end processes**, selected for distinct capabilities, not merely BOL variants. Final names pending selection against the existing 27-process universe.
- Respect Admin/Public separation: sensitive work decomposition, runtime projections and proprietary execution definitions remain controlled.
- MVP may use structured JSON/files and lightweight backend APIs; SQL is not a prerequisite. Keep one storage-neutral, versioned knowledge contract compatible with Wave 3 PostgreSQL.
- Execution readiness is an **Atlas tool-compatibility certification capability**, not execution by Atlas.
- No commercial licences or live task execution required for MVP. Simulated/mock adapters are acceptable but must not be called production validation.
- Build a lightweight external agentic harness; consider desktop RPA bot specifications, free/open-source BPMN tooling and digital-twin simulation only where useful. Avoid building four full engines.
- Reuse Vendor Debit reference/prototype work as a cross-domain test; do not merge Vendor Debit into LTL or claim its process is already integrated.

## Parallel workstreams
A. Atlas product branch: existing live product copy -> UX corrections -> asset integration -> five LTL processes -> partial Ocean -> lightweight knowledge API -> QA -> controlled release.
B. Wave 3: continue W3-21..W3-28 governed extensible architecture and database work, preserving independent status/evidence.
C. External execution demo: define neutral handoff package, tool adapters, test harness and compatibility certification; consume Atlas outputs without embedding execution logic in Atlas.

## Architecture boundary
Atlas -> versioned knowledge/handoff package -> independent test adapters (agentic, BPM, RPA, digital twin, human) -> compatibility test results -> Atlas readiness/certification view.
No actual shipment or Vendor Debit transaction execution by Atlas.

## Readiness levels
1. Knowledge-ready: mandatory process and work definition fields present and traceable.
2. Tool-mappable: mapping to selected tool contract validated, with gaps explicit.
3. Simulation-validated: independent mock harness successfully consumes the package in representative scenarios.
4. Production-ready: NEVER claimed without real tool/environment, security, integration and operational validation.

Certification must identify process version, target tool/category and version, contract version, test evidence, gaps, assessor and date. No blanket 'ready for all tools' claim.

## Reference anchors to resolve from existing evidence (not a fresh inventory)
Wave 3 frozen asset index and reconciliation, W3-21/W3-22/W3-23 evidence, Page-0 v6.2.3, Road LTL v1.2, OKv2, Canvas V2, Ocean frozen pages, Work Decomposition and Vendor Debit learning studio V3/V4. References are pointers, not a claim that all artifacts are already available in this branch.

## Guardrails
No hardcoding of LTL-specific semantics into universal interfaces. No unverified capabilities or invented test results. No secrets/API keys in repository. No changes to live/main runtime without explicit release decision. Preserve evidence and readback at each checkpoint. See CHECKLIST.md and DECISIONS.md.
