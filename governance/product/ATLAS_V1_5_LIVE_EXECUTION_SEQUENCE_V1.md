# Atlas v1.5 LIVE — Canonical Execution Sequence & Cross-Agent QA V1

**Owner authorization:** 2026-09-28  
**Linear sequence controller:** ATL-177  
**Release parent:** ATL-136  
**Capability split register:** ATL-152

## Cross-agent operating model

- :00 / :30 — ChatGPT builder/executor
- :15 / :45 — Claude independent QA

For every substantive task:

ChatGPT build/remediation → durable evidence → Shared Baton to Claude → independent QA → if PASS, Claude reconciles and routes the next pre-authorized ChatGPT task.

If QA fails, the same task remains authoritative and is routed back to ChatGPT for remediation. No parallel defect issue unless the finding is a genuinely distinct material prerequisite.

## Canonical sequence

1. ATL-137 — Baseline/Frozen-Asset & Current UX Reuse Audit
2. ATL-138 — Malkom Domain Warehouse Consumption Contract
3. ATL-153 — Governed Source/Universe Baseline for Bounded Generation
4. ATL-161 — Explicit Knowledge & Gap States
5. ATL-155 — Bounded Daughter Knowledge & Page Generation
6. ATL-171 — Bounded Operational Knowledge & Canonical Information Semantics
7. ATL-157 — Bounded On-Demand Depth: Deepen This Scope
8. ATL-159 — Bounded Work Decomposition & Canonical WorkDefinition
9. ATL-165 — Minimal Client Binding Requirements & Manual Resolution
10. ATL-163 — Malkom-Oriented Readiness Summary
11. ATL-139 — Current-Lineage Road LTL → Malkom Domain Warehouse Package
12. ATL-169 — Current-Lineage Malkom Projection Boundary & Handoff
13. ATL-178 — Generated Queue Flow Explorer & BPMN Export
14. ATL-167 — Coherent Public/Private Interaction Slice
15. ATL-140 — Product UX Integration for Malkom Domain Warehouse Demo
16. ATL-175 — Bounded API, Versioning, Release & Rollback Contract
17. ATL-173 — Malkom Domain Warehouse Utility Proof
18. ATL-141 — Release Integrity, Browser/Visual Regression & Product Polish
19. ATL-143 — v1.5 → v2 BOL/FIRI Deferred-Work Handover Freeze
20. ATL-142 — Independent QA, Drive Custody & Owner-Gated Go-Live

## v2 continuity

ATL-154, ATL-156, ATL-158, ATL-160, ATL-162, ATL-164, ATL-166, ATL-168, ATL-170, ATL-172, ATL-174 and ATL-176 remain deferred v2 continuations. They do not gate v1.5 and must later consume the frozen v1.5 results rather than restart conceptual design.

## Product-completeness statement

The full-concept audit found no untracked major Atlas capability after adding ATL-171/172, ATL-173/174 and ATL-175/176.

Full-v2-only capabilities remain preserved in the existing v2 backlog:
- continuous source refresh / semantic delta;
- generic cross-domain Daughter regeneration;
- scalable dual-trigger On-Demand Depth and compounding;
- generic recursive decomposition / WorkDefinition coverage;
- generalized Operational Knowledge / information-resolution/FIRI coverage;
- full epistemic promotion lifecycle;
- deterministic Domain/Enterprise/Runtime readiness;
- enterprise discovery / client ingestion;
- universal Ask/Trace/Compare interaction;
- multi-consumer runtime projections;
- dependency/impact/staleness graph;
- full backend/API migration architecture;
- Operations + Transformation + Execution Intelligence;
- full Execution Readiness Leverage / kill test;
- end-to-end v2 release/go-live proof.

Execution itself remains outside Atlas.


## Added Hasmukh capability — generated Queue Flow Explorer / BPMN

v1.5 adds ATL-178 after ATL-159/ATL-169. It must generate flow/BPMN from governed data, not hand-drawn diagrams. Malkom-specific `subQueues[].outcomes` may be used as a projection input but must not become canonical Atlas truth.

The generic cross-domain/BPMN continuation is ATL-179 and remains deferred to v2.
