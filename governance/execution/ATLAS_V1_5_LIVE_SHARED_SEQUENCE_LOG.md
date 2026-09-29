# Atlas v1.5 LIVE — Shared Sequence & Failover Log

## Purpose

This file is the durable GitHub failover log for the Atlas v1.5 LIVE ChatGPT ↔ Claude execution sequence controlled by ATL-177.

Linear remains the normal execution/task mirror and should be updated on every transition. This GitHub log exists so a Linear mutation/persistence failure does **not** stop an otherwise authorized and evidenced sequence.

## Authority and failover rules

1. At the start of every executor invocation, read the Linear `Atlas Autonomous Execution — Shared Baton Log` **and** this GitHub log before selecting work.
2. When both surfaces are current and consistent, follow the latest identical routed transition.
3. Every completed implementation/remediation or independent QA handoff should be persisted to **both** Linear and this GitHub log and read back.
4. If Linear persistence fails but the same transition is successfully written to this GitHub log and read back, GitHub becomes the temporary durable sequencing authority for that transition. The sequence must **not** pause merely because Linear could not be updated.
5. The next eligible ChatGPT worker (:00 or :30) must first repair the missing Linear mirror using the exact GitHub-persisted evidence/transition. After read-back verifies the Linear mirror, it must continue the exact work currently assigned to ChatGPT by the latest valid GitHub transition, if any.
6. Do not redo implementation or QA already evidenced and read-back verified. Repair only the missing mirror/persistence step.
7. If GitHub persistence fails but Linear succeeds, Linear remains sufficient for the handoff; the next eligible worker repairs this GitHub mirror first.
8. If both persistence surfaces fail, preserve `PERSISTENCE_RETRY_REQUIRED` and fail closed for that invocation. Both ChatGPT workers remain enabled; the next eligible worker retries recovery first.
9. A stale surface never overrides a newer, read-back-verified transition on the other surface. Reconcile the stale mirror before new implementation.
10. Never use this failover mechanism to bypass Owner gates, Governance Holds, task acceptance criteria, independent QA, or ATL-130 governance.
11. BOL/FIRI owner-run work remains outside this v1.5 LIVE sequence unless explicitly re-routed by the Owner.
12. Expected cadence remains ChatGPT :00/:30 and Claude :15/:45.

## Mirror-repair payload requirement

A failover entry must contain enough information to recreate the missing mirror exactly:

- timestamp;
- transition and current holder;
- exact task/finding ID;
- sequence controller;
- disposition;
- implementation/QA evidence IDs, commit/blob/artifact references as applicable;
- exact next-agent action;
- Owner/gate status;
- which mirror failed and what exact persistence remains.

## Bootstrap state

### CURRENT BATON — ATL-177 / ATL-161 IMPLEMENTATION PERSISTED → CLAUDE INDEPENDENT QA — 2026-09-29T00:08Z

**Transition:** ChatGPT → Claude  
**Current holder / next agent:** Claude  
**Exact current task:** ATL-161 — Atlas v1.5 Capability — Explicit Knowledge & Gap States — independent QA  
**Sequence controller:** ATL-177  
**Disposition:** CHATGPT IMPLEMENTATION COMPLETE / LINEAR PERSISTENCE RECOVERED / AWAITING INDEPENDENT QA

### Durable evidence

- Commit: `f1ff33fce6891695b26d652c8c42d676b353808c`
- Machine-readable artifact: `governance/product/ATL_161_V1_5_EXPLICIT_KNOWLEDGE_GAP_STATES_V1.json`
- Machine-readable blob SHA: `bca822e874700619b933958386e533da799495f7`
- Companion contract: `governance/product/ATL_161_V1_5_EXPLICIT_KNOWLEDGE_GAP_STATES_V1.md`
- Companion Markdown blob SHA: `a39a48126c470392262c792adefffb562f1cd75c`
- Linear evidence comment: `29dce659-bf04-45a8-8c88-7fecad9155e3`
- Linear Shared Baton was successfully updated and read back at this transition.

### Exact Claude action

Independently QA ATL-161 against its Build/STOP/Handover scope and v1.5 QA standard. If PASS, persist QA evidence and route only the next eligible ATL-177 task after fresh dependency/gate verification. If FAIL, route exact ATL-161 defects to ChatGPT.

**Owner/gate status:** No Owner decision pending for this QA handoff. Production promotion remains Owner-gated at ATL-142.
