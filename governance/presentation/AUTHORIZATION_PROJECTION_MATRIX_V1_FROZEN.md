# Authorization Projection Matrix V1

**Status:** FROZEN  
**Phase:** P1 — Presentation and access contracts

## Purpose

Define which Atlas presentation projections each consumer class may receive. This is a projection/access model, not a replacement for existing database roles. Current workspace roles (`OWNER`, `ADMIN`, `PILOT_USER`, `VIEWER`) remain unchanged until a separate authorization implementation phase.

## Consumer classes

1. **PUBLIC_ANONYMOUS** — no authenticated identity/workspace.
2. **AUTHENTICATED_ATLAS** — authenticated Atlas user without stronger workspace/execution entitlement.
3. **PILOT** — invited pilot user operating in an approved pilot workspace.
4. **CLIENT_WORKSPACE** — authenticated member of a specific client workspace; may access only that workspace's bound/local data according to membership.
5. **ADMIN_GOVERNOR** — authorized Atlas/domain governance capability.
6. **OWNER** — highest Atlas owner/governance capability.

Consumer class resolution occurs server-side. The browser may not self-assert a class.

## Projection matrix

| Projection / data class | Public / Anonymous | Authenticated Atlas | Pilot | Client Workspace | Admin / Governor | Owner |
|---|---|---|---|---|---|---|
| A5 Overview | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Operational Knowledge safe projection | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Execution Readiness safe projection | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Safe provenance class/confidence | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Exact sourceRefs / claim crosswalk | DENY | DENY | DENY by default | DENY by default | ALLOW | ALLOW |
| Binding category/canonical need/status | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Binding collection question | DENY | DENY | ALLOW | ALLOW | ALLOW | ALLOW |
| Client local value/policy/contract parameter | DENY | DENY | OWN PILOT WORKSPACE ONLY | OWN WORKSPACE ONLY | GOVERNED ACCESS ONLY | ALLOW |
| Client application/environment | DENY | DENY | OWN PILOT WORKSPACE ONLY | OWN WORKSPACE ONLY | GOVERNED ACCESS ONLY | ALLOW |
| Client field/API mapping / code crosswalk | DENY | DENY | OWN PILOT WORKSPACE ONLY when required for pilot | OWN WORKSPACE ONLY | GOVERNED ACCESS ONLY | ALLOW |
| Client named role/team/person/authority limit | DENY | DENY | OWN PILOT WORKSPACE ONLY | OWN WORKSPACE ONLY | GOVERNED ACCESS ONLY | ALLOW |
| Full recursive Work Decomposition | DENY | DENY | DENY unless separately execution-entitled | DENY unless separately execution-entitled | ALLOW with execution capability | ALLOW |
| Work Decomposition aggregate summary | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Full canonical WorkDefinition | DENY | DENY | DENY unless separately execution-entitled | DENY unless separately execution-entitled | ALLOW with execution capability | ALLOW |
| WorkDefinition status/availability | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Runtime-specific projection | DENY | DENY | DENY unless runtime-entitled | OWN/ASSIGNED RUNTIME ONLY | ASSIGNED/GOVERNED RUNTIME | ALLOW |
| Machine rule/expression/compiler payload | DENY | DENY | DENY | DENY unless execution-entitled | ALLOW with execution capability | ALLOW |
| Governance audit/source basis | DENY | LIMITED SAFE STATUS | LIMITED OWN-WORKSPACE | OWN-WORKSPACE | ALLOW | ALLOW |
| Canonical mutation/approval | DENY | DENY | PROPOSE ONLY | PROPOSE ONLY | GOVERNED APPROVAL BY SCOPE | ALLOW |

## Capability model for implementation

P2/P5 should resolve permissions into capabilities rather than hard-code UI role names. Minimum capabilities:

- `atlas.overview.read`
- `atlas.operational.safe.read`
- `atlas.readiness.read`
- `atlas.binding.canonical.read`
- `atlas.binding.own.read`
- `atlas.binding.own.write`
- `atlas.provenance.safe.read`
- `atlas.provenance.full.read`
- `atlas.execution.summary.read`
- `atlas.work_decomposition.full.read`
- `atlas.workdefinition.full.read`
- `atlas.runtime.assigned.read`
- `atlas.governance.propose`
- `atlas.governance.approve`
- `atlas.owner`

## Existing-role compatibility

Current workspace database roles observed in the Atlas stack are `OWNER`, `ADMIN`, `PILOT_USER`, and `VIEWER`. P1 does not alter them. Recommended P2 mapping:

- `VIEWER` → at least AUTHENTICATED_ATLAS safe projections; own-workspace read only when membership/RLS permits.
- `PILOT_USER` → PILOT projection plus own pilot-workspace data.
- `ADMIN` → workspace manager capability; **not automatically equivalent to global Admin/Governor for protected canonical execution IP** unless separately granted.
- `OWNER` → workspace owner; global Atlas `OWNER` capability must remain explicitly distinguished if the product later supports multiple workspace owners.

This avoids conflating workspace management with canonical Atlas governance.

## Workspace isolation rule

`CLIENT_WORKSPACE` and `PILOT` permissions are always scoped to the active workspace. A user may never retrieve another workspace's:
- local values;
- system mappings;
- field/API mappings;
- codes;
- named roles/teams/persons;
- contracts/policies;
- derived client execution projection.

RLS/data authorization remains authoritative. Projection logic is an additional allowlist boundary, not a substitute.

## Protection rule

Full Work Decomposition, full WorkDefinition and runtime projection require explicit execution capability even for an authenticated workspace member. Collapsed UI, hidden tabs or frontend role checks are not authorization.

## New-field rule

Any new canonical field is `DENY/NOT_PROJECTED` for all classes until explicitly classified. Owner access to backend-governed raw data may exist administratively, but browser presentation still requires an explicit protected projection.

## Exit condition

P2/P3/P5 must consume this matrix or a superseding frozen version. No product surface may independently reinterpret the projection boundary.
