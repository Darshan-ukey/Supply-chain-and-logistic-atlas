# Deployment & Infrastructure Operational Control V1

Status: OWNER-AUTHORIZED GLOBAL OPERATIONAL GOVERNANCE  
Effective: 16 September 2026  
Applies to: ChatGPT, Prod/production execution agents, Claude when authorized, and any future Atlas execution agent or human operator changing deployment, hosting, CI/CD, storage, runtime configuration or production infrastructure.

## 1. Purpose

Atlas deployment/runtime infrastructure must not change implicitly as a side effect of repository activity.

The September 2026 demo/recovery period exposed that GitHub pushes could trigger Vercel deployments even for governance-only changes and that deployment storage had materially exceeded the included allowance. This is an operational-governance concern separate from Atlas domain/knowledge architecture.

The governing principle is:

> GitHub is the governed source/version system; deployment infrastructure is a controlled runtime projection and must not become an uncontrolled source of state, cost or history.

## 2. Mandatory controls

### DI-1 — Explicit deployment intent
Every production-affecting deployment must have an identifiable trigger and purpose.

Repository changes that do not alter deployable runtime behavior — for example governance logs, architecture records, evidence or documentation-only changes — should not create a production deployment where the platform supports path/filter controls.

If platform limitations prevent selective deployment, that limitation must be documented and its storage/cost impact monitored.

### DI-2 — GitHub remains canonical for deployable source
No production-relevant code/configuration may exist only in Vercel or another hosting platform.

Any emergency or direct runtime change must be reconciled back to GitHub before the change can be considered governed or closed.

### DI-3 — Production promotion is explicit
A successful preview/build does not authorize production promotion.

Production promotion must reference:
- exact Git commit/version;
- deployment identity;
- QA/verification evidence required by the governing phase;
- rollback target;
- named authorization state.

### DI-4 — Deployment storage and retention control
Deployment artifacts must not accumulate without control.

The operating record must define:
- current hosting/storage allowance or budget;
- current usage where measurable;
- retention/cleanup mechanism;
- which deployments must be preserved for rollback/audit;
- which deployments are safe to prune;
- escalation point before capacity/cost becomes operationally material.

Historic deployments may be retained only where they serve a named rollback, audit, legal or evidence need. Hosting history is not the canonical source archive.

### DI-5 — No governance-only deployment churn
Where technically feasible, CI/CD must exclude governance-only/document-only changes from runtime deployment triggers.

If the current Vercel/GitHub integration deploys every push, remediation should be tracked as infrastructure work rather than accepted as permanent architecture.

### DI-6 — Runtime configuration custody
Production environment variables, routing configuration, domain mappings, authentication integration and other runtime-critical configuration must have:
- an authoritative configuration record or reproducible setup definition;
- owner/access boundary;
- backup/recovery method where applicable;
- change evidence for material modifications.

Secrets must not be committed to GitHub merely to satisfy reproducibility.

### DI-7 — Rollback readiness
Before a material production deployment:
- identify the known-good prior deployment/version;
- confirm rollback is technically possible;
- identify any data/schema changes that make rollback non-trivial;
- if rollback is not safely possible, classify the change HIGH-RISK under the Controlled Phase Execution & Recovery Gate.

### DI-8 — Deployment-state truthfulness
Do not claim a deployment is production-ready, promoted, healthy or verified unless that state has actually been observed from the relevant runtime/deployment evidence.

A Git commit existing does not prove deployment. A deployment existing does not prove production promotion. A production URL loading does not prove data/recovery correctness.

## 3. Integration with phase governance

`CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md` remains the governing phase-advancement standard.

This deployment standard adds infrastructure-specific checks. Any phase that changes production deployment/runtime configuration must include the relevant DI controls in its closure evidence.

Material deployment, storage, security, migration or runtime-boundary changes are HIGH-RISK by default unless the phase gate explicitly proves otherwise.

## 4. Minimum deployment checkpoint

For every material production/runtime change, record at minimum:
- Git commit/version;
- deployment ID and environment;
- trigger/purpose;
- QA/health result;
- rollback target;
- runtime configuration impact;
- storage/retention impact if material;
- authorization/promotion state.

Use existing governance/control logs where possible; do not create redundant records.

## 5. Current remediation item

The previously observed Vercel pattern — frequent auto-deployments on repository pushes and deployment storage materially above the included allowance — must remain tracked until one of the following is proven:
1. non-runtime changes no longer generate unnecessary deployments; or
2. a documented retention/cleanup and monitoring control makes the behavior operationally acceptable.

This is an infrastructure remediation item, not DG-12 and not a new Atlas semantic layer.

## 6. Governing principle

> Runtime infrastructure may project Atlas, but it must never silently become Atlas's source of truth, uncontrolled archive, or automatic side effect of every governance change.
