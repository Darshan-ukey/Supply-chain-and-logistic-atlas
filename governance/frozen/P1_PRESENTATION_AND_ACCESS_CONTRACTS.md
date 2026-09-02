# P1 — Presentation & Access Contracts

**Status:** COMPLETE / PASS  
**Date:** 2026-09-02  
**Branch:** `atlas-p1-presentation-access-contracts`  
**Parent:** `atlas-p0-presentation-freeze`  
**Architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`

## Objective

P1 defines exactly **who may receive each execution-depth field, in what form, and through which projection** before any backend/API or renderer implementation changes are made.

P1 is a contract/security phase only. It does not change daughter semantics, WorkDefinition semantics, Canvas behavior, Ask Atlas behavior, backend authorization code or production deployment.

## Frozen P1 assets

1. `governance/contracts/operational-knowledge-presentation-contract-v1.json`
2. `governance/contracts/execution-readiness-presentation-contract-v1.json`
3. `governance/contracts/authorization-projection-matrix-v1.json`
4. `governance/contracts/canonical-execution-field-coverage-v1.json`

## Core access rule

> **DENY UNLESS EXPLICITLY ALLOWED.**

P1 deliberately uses a positive allowlist model. A field that has not been explicitly classified cannot be returned by a presentation or runtime projection.

Protection must occur before retrieval/payload delivery. Browser hiding, collapsed sections, CSS, client-side filtering and LLM instructions are not authorization boundaries.

## Audience model

P1 freezes six audiences:

- `ANONYMOUS_PUBLIC`
- `AUTHENTICATED_ATLAS_USER`
- `PILOT_USER`
- `CLIENT_WORKSPACE_USER`
- `ADMIN_GOVERNOR`
- `OWNER`

### Public / general authenticated

May receive:

- Universe / daughter reference knowledge;
- A5 Overview;
- approved human-readable Operational Knowledge summaries;
- safe Execution Readiness metrics/status;
- Work Decomposition availability/count/type summary;
- WorkDefinition availability/status;
- client-binding counts/categories only;
- evidence basis / authority class / coverage status.

Must not receive:

- full recursive Work Decomposition;
- full WorkDefinition;
- machine-readable WorkDefinition exports;
- exact client field/system/value mappings;
- detailed runtime/Malkom projections;
- exact protected source inventory/version/claim mappings;
- research/crosswalk/governance internals.

### Pilot User

Pilot is a functional-access role, not a governance role.

A Pilot User may receive protected execution detail only where the pilot entitlement explicitly grants that domain/scope. Pilot access never grants canonical approval authority, other-client access or access-policy administration.

### Client Workspace User

May receive:

- public/authenticated projections;
- protected execution detail authorized for the workspace;
- the workspace's client-binding requirements, values, mappings and evidence.

Must never receive another client's workspace data and cannot rewrite canonical Atlas truth.

### Admin / Governor

May receive full canonical/protected execution detail, source/provenance/research detail and governance trace within delegated scope; may review/approve canonical changes within that scope.

### Owner

Full platform/governance access, subject to legitimate-purpose, privacy and external source-license constraints.

## Operational Knowledge presentation boundary

P1 treats Operational Knowledge as more than process description. It includes the process's **information-resolution logic**:

- what information is required;
- why it is required;
- when it is required;
- where it may originate;
- how it can be derived/established;
- what validates it;
- what authority/system owns truth;
- what happens when evidence conflicts.

Public presentation is intentionally useful but not equivalent to publishing the execution design asset.

### Public-safe examples

- task purpose and boundary;
- trigger and pre/post state;
- applicability summary;
- required-information name, why, required-when, canonical origin class and validation summary;
- decision question;
- reference-level rule/control/action summaries;
- outcome families;
- high-level exceptions/timing/actors/system roles/objects/documents/evidence;
- evidence basis class and authority class.

### Protected examples

- exact decision gate/branch logic;
- executable condition expressions;
- atomic action pre/postconditions;
- retry/escalation/recovery graph;
- exact document-field contracts where execution IP is exposed;
- evidence acceptance criteria;
- interface contracts;
- exact source IDs/versions/claim mappings;
- information derivation/conflict-resolution logic where it exposes executable design.

## Client Binding boundary

Public users may see only aggregate dependency information such as number/category of unresolved binding requirements.

The following are client-authorized/protected:

- `requiredWhen`
- `why`
- `valueOrigin`
- `validation`
- `sourceRefsOrBasis`
- `systemOfRecord`
- `clientFieldMapping`
- `authorityOwner`
- `collectionQuestion`
- `resolutionStatus`
- actual client values/codes/systems/fields/SLAs/routes/evidence.

This preserves the core separation:

> **Atlas determines reference semantics and what must be bound. Client Binding supplies the actual client environment.**

## Execution Readiness contract

P1 freezes the standard visible readiness model:

- decomposition required;
- decomposition status;
- executor ready;
- independent executor proof;
- WorkDefinition availability/status;
- required-information coverage;
- decision coverage;
- branch coverage;
- evidence coverage;
- exception/recovery completeness;
- unresolved Operational Knowledge count/severity;
- unresolved Client Binding count/category;
- HITL dependency;
- deterministic-work band;
- system-action dependency band;
- automation/execution suitability profile.

Key truth rule:

> **A5 verified is not the same as executor ready.**

A missing client runtime value is not automatically an Operational Knowledge gap when the required object, applicability, validation and authoritative origin are already defined as bindable.

## Work Decomposition and WorkDefinition boundary

Public/general authenticated presentation:

- Work Decomposition available? yes/no;
- node count / type-family counts / decomposition depth;
- WorkDefinition available/status;
- execution-profile summary.

Protected presentation:

- recursive decomposition nodes;
- triggers/inputs/decisions/actions/system interactions/human boundaries/controls/outcomes/exceptions/evidence/provenance per node;
- full canonical WorkDefinition identity/lineage/applicability/inputs/fields/decisions/rules/validations/controls/actions/systems/actors/outcomes/transitions/clocks/retries/escalations/recovery/evidence/completion criteria/execution characteristics/client-binding points;
- machine-readable contract/export.

## Provenance visibility

Public/general authenticated:

- evidence status;
- basis class (`SOURCE_EXPLICIT`, `SOURCE_DERIVED`, `ATLAS_DERIVED`, etc.);
- authority class;
- coverage status.

Protected/internal:

- exact source ID/name/URL/version;
- claim-to-source mapping;
- detailed claim boundary;
- research notes;
- source crosswalk logic;
- internal confidence rationale.

Source-license restrictions remain independently enforceable even for Admin/Owner.

## Empty / unresolved rendering behavior

- `UNKNOWN` → show **Unknown — evidence not established**; do not infer.
- `NOT_APPLICABLE` → show **Not applicable in current governed context**.
- `CLIENT_BINDING_REQUIRED` → show dependency status outside the workspace; full requirement only inside authorized workspace/protected views.
- `SOURCE_RESOLUTION_REQUIRED` → public sees incompleteness; protected users may see research requirement detail.
- `PENDING_VALIDATION` → show **Candidate / validation pending**, never approved truth.
- `CONFLICT` → show **Conflict / resolution required**, limited to audience-allowed detail.
- optional null values do not generate misleading empty cards.

## Full canonical field-family coverage

The P1 field registry classifies the complete execution chain:

**A5 Overview → Operational Knowledge → Execution Readiness → Work Decomposition → WorkDefinition → Client Binding → Runtime Projection → Execution Evidence → Governance/Impact → Access Policy.**

Any new canonical field introduced after P1 is denied by default until classified in the field registry.

## Explicit non-changes

P1 does **not** change:

- Universe V7.3 semantics;
- Road LTL V1.4 semantics;
- Ocean FCL V0.6 semantics;
- Ocean LCL V0.6 semantics;
- Operational Knowledge canonical semantics;
- Client Binding canonical semantics;
- recursive executability principle;
- WorkDefinition canonical principle;
- Atlas Warehouse semantics;
- Canvas V2 visual architecture;
- current runtime/API behavior;
- production deployment.

## P1 exit gate

**PASS.**

For every canonical execution field family we can now answer:

1. **Who may receive it?**
2. **In what form?**
3. **Through which projection?**
4. **What is shown when it is empty/unresolved?**
5. **What provenance detail is permitted?**

P2 may now implement the backend projection boundary from these frozen contracts without inventing presentation or authorization rules.
