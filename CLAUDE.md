# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select work from chat history, assumptions or perceived convenience.

## Mandatory shared-executor logging — NO LOG → NO ADVANCE
Read and obey `governance/standards/ATLAS_SHARED_EXECUTOR_LOGGING_STANDARD_V1.md`. Canonical shared log: `claude_chatGPT.md`. This applies equally to Claude and ChatGPT. Every material action requires PRE_ACTION, MATERIAL_FINDING where applicable, POST_ACTION, and STAGE_CLOSURE before advancement. A stale shared log invalidates stage completion.

## Mandatory start-of-work read order
1. `governance/frozen-assets/CURRENT.json` and `LATEST.md`.
2. `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json`.
3. `claude_chatGPT.md` and shared-executor logging standard.
4. During demo sprint: current/demo/target state map; Vercel disposition audit; GitHub-only release policy; demo build protocol; handover; build log.
5. `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md`.
6. Architecture decision ledger/log and authorized-stage frozen contracts.
7. Verify intended branch/SHA before editing.

## Platform boundary
> **Atlas owns understanding and specification. Downstream platforms own execution.**

Atlas is the governed enterprise-to-tool intelligence/specification layer. Canonical business semantics remain technology-neutral. Malkom, SAP/TMS/WMS, workflow/RPA/agent platforms, ServiceNow, BPM/digital-twin tools and custom applications are downstream consumers/projections.

## Mandatory corrected two-lineage truth — 12 September 2026
All executors must preserve this distinction unless later governed evidence supersedes it.

### New governed target lineage
`Road LTL 1.5 → Operational Knowledge → Certified Recursive Decomposition (P6.1) → Canonical WorkDefinition compiler proven (P6.2), persistence pending → Client Binding / Runtime Projection not yet complete`

Known P6.1 certified distribution: 22 tasks / 603 work units / 444 terminal leaves / 185 EXECUTOR_READY / 163 BLOCKED_BY_CLIENT_BINDING / 96 BLOCKED_BY_KNOWLEDGE_GAP. P6.2 compiler/verifier infrastructure is technically proven, but canonical WD persistence is not authorized/completed. Never render or describe the 185 as persisted canonical WDs until persistence + independent QA/custody actually occur.

### Proven Malkom execution-reference lineage
`Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0 projection`

This is the proven Malkom-consumable reference path unless a later stage independently verifies a new-lineage Client Binding + Malkom runtime projection. Never claim the existing Malkom proof was generated from Road LTL 1.5/P6.2. Never silently bridge or relabel these lineages.

### Why this distinction exists
Earlier recovery/demo planning understated the maturity of the new governed lineage. Forensic evidence recovered on 12 Sep established that P6.1 is certified/live in protected persistence and P6.2's compiler path exists and passes certification. That does **not** establish the downstream Client Binding/runtime projection seam. Therefore the demo must simultaneously show the stronger target-lineage maturity and retain the older proven Malkom reference path for actual projection proof.

## Architecture gate correction — candidate, Owner freeze pending
Do not treat all AR/recovery questions as one monolithic prerequisite. Current working correction separates:
1. partial canonical WD compile gate;
2. scope execution-readiness gate;
3. runtime projection gate;
4. full-domain coverage gate.

This is a working architecture correction recorded in the decision ledger/log, not authorization to persist P6.2 or bypass Owner gates. Control-flow semantics are owned by meaning: business-required sequence/join/retry/idempotency/compensation semantics must be governed before affected work is executor-ready; runtime encoding of already-governed meaning belongs downstream.

## Demo sprint authority and branch rules
- Primary executor: ChatGPT; Claude is hot backup and may also execute a D2.0 stage when the Owner explicitly directs Claude.
- Demo implementation branch: `atlas-v2-demo-2026-09-14`.
- Never work directly on `main`.
- D2.0.6 must certify full GitHub state before D2.0.7.
- D2.0.7 is Owner-approved merge to `main`, **not** Vercel go-live.
- No Vercel deployment, preview, promotion, live change or deletion is authorized. Vercel is read-only forensic scope.
- Stop before any action expected to trigger Vercel.

## Demo path guardrails
D2.0.0 must reconcile both lineages and exact assets. D2.0.3 may expose certified P6.1 / compiler-ready P6.2 target-lineage maturity, while actual Malkom proof remains explicitly labeled as the V1.2 → DW2.3 reference lineage. D2.0.4 uses that proven Malkom projection unless stronger independently verified evidence is found. D2.0.5 may show blocker classes but cannot fabricate persisted WDs or a fake completeness score.

Ocean FCL/LCL 0.6 may be shown only under the Owner-authorized demo-candidate assumption and must fail closed where execution depth is unavailable. Do not claim Road-LTL-equivalent Ocean depth unless verified.

## Build and custody discipline
Every demo build stage requires:
1. PRE_ACTION shared-log entry;
2. PRE_BUILD_AUDIT;
3. narrow authorized mutation only;
4. MID_BUILD_AUDIT after meaningful slices;
5. MATERIAL_FINDING/POST_ACTION log updates;
6. POST_BUILD_AUDIT of complete resulting application;
7. regression/integration checks;
8. exact full-repository commit SHA;
9. immutable full-state freeze point when practical;
10. frozen-state manifest + handover + shared-log update;
11. STAGE_CLOSURE;
12. no advancement until authorization.

Delta-only PASS is invalid. Historical freeze points and certified evidence are immutable.

## Permanent integrity rules
Do not fabricate domain/business knowledge, execution depth, readiness, source mappings or identifiers. Do not make runtime structures canonical Atlas truth. Do not move client-specific values into canonical domain/WD truth. Do not hide blockers/gaps. Do not use public-safe projections as canonical private source. Do not substitute historical adjacent versions without exact governed evidence. Do not treat CI/hash success alone as semantic completeness. Do not advance with a stale shared log.

## Governance synchronization
Chat instructions do not supersede GitHub governance. Architecture, demo/recovery sequencing, authorization, certification criteria, source-of-truth hierarchy and agent-rule changes must be synchronized to GitHub before implementation proceeds.

## Current safe-resume rule
Read the latest shared log and backlog before acting. The demo sprint remains priority. P6.2 persistence is not part of the demo sprint unless the Owner separately authorizes it. Recent P6.1/P6.2 findings change the truthful demo narrative and post-demo critical-path design; they do not by themselves create a new-lineage Malkom projection.
