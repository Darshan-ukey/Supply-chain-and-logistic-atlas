# Decision Log and Working Contract
Date: 2026-11-19. These are conversation-approved project notes; not formal Unified Master Decision Register IDs.

| ID | Decision | Status |
|---|---|---|
| EDE-001 | Atlas is knowledge/intelligence and execution-readiness provider; downstream tools execute, detect transactional exceptions and decide operational next actions | Agreed |
| EDE-002 | Build product MVP in parallel with Wave 3, not instead of Wave 3 | Agreed |
| EDE-003 | Reuse completed Wave 3 reconciliation and frozen asset evidence; no repeat inventory | Agreed |
| EDE-004 | Copy live baseline to isolated branch; preview/test before promotion | Agreed |
| EDE-005 | Bring in OKv2, Canvas V2, LTL depth, Work Decomposition, partial Ocean and relevant existing functions | Agreed scope, implementation pending |
| EDE-006 | Expand LTL to at least five connected processes selected for different capability demonstrations | Agreed, names pending |
| EDE-007 | Lightweight backend with JSON acceptable for MVP; one storage-neutral knowledge contract shared with Wave 3 | Agreed principle |
| EDE-008 | Execution readiness is an Atlas tool-compatibility certification capability, evidence-backed and tool-specific | Agreed |
| EDE-009 | No paid execution licences or actual task execution required; use external lightweight agentic harness, mock adapters and free tools if useful | Agreed |
| EDE-010 | Vendor Debit prototype is a reusable cross-domain test case; execution harness stays outside Atlas | Agreed |
| EDE-011 | Production readiness cannot be certified from mock-only validation | Guardrail |
| EDE-012 | Preserve Admin/Public split and do not expose proprietary work definitions publicly | Existing governance retained |

## Handoff / restart instructions
On resumption: read README, CHECKLIST and DECISIONS; then read the existing verified Wave 3 source/evidence pointers and current W3-23 checkpoint. Do not restart asset discovery. Confirm the approved live baseline before creating a feature branch. Start with five-process selection and frontend correction list; implement only after the owner approves the concrete plan. Record changed files, tests, evidence and next action at every checkpoint. Do not silently promote to production.

## Non-goals
Not a new production execution platform, not live transaction processing, not a replacement for Wave 3, not an LLM making operational decisions inside Atlas, not a universal certification without specific target-tool validation.
