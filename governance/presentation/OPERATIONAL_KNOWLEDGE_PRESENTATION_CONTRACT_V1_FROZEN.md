# Operational Knowledge Presentation Contract V1

**Status:** FROZEN  
**Phase:** P1 — Presentation and access contracts  
**Governing architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`

## Purpose

Define the human-readable, authorization-aware projection of Daughter Operational Knowledge. This contract is a presentation/access contract only. It does not alter Daughter semantics and never authorizes raw canonical objects to be passed through to the browser.

## Canonical source families

The projection is compiled from governed A5 task content including:
- identity and applicability;
- required information;
- decision gates;
- constraints and controls;
- atomic actions;
- states and branch transitions;
- temporal constraints;
- responsibility;
- system exchanges;
- documents/objects;
- evidence contracts and expected outcomes;
- client-binding requirements;
- provenance claims;
- executability and WorkDefinition-readiness metadata.

## Required presentation sections

1. **What information is required?**
   - canonical concept/field label;
   - category and cardinality where governed;
   - `requiredWhen`;
   - `why`;
   - `valueOrigin` class;
   - human-readable validation;
   - evidence class;
   - whether client binding remains required.

2. **What decisions and rules govern the work?**
   - decision/gate label or question;
   - human-readable condition;
   - pass/fail outcome family;
   - basis/evidence class;
   - whether client configuration is required.

3. **What controls and actions occur?**
   - control objective;
   - execution point;
   - failure behavior;
   - action description;
   - precondition/postcondition;
   - performer/authority/system role in safe canonical form.

4. **What can happen next?**
   - before/success/failure/recovery state family;
   - branch type;
   - human-readable branch condition;
   - next handling or downstream handoff summary;
   - required evidence summary.

5. **What timing applies?**
   - clock type;
   - activation and stop semantics;
   - deadline-resolution class;
   - timezone/context basis;
   - unresolved/resolution status.

6. **Who and what systems are involved?**
   - performer/owner/decision-authority/exception-owner canonical role;
   - producer/authority/consumer system role;
   - interface class;
   - canonical object/document family.

7. **What proves completion?**
   - evidence type and requirement;
   - acceptance criteria;
   - retention class where safe;
   - outcome code/meaning/state family/required-evidence summary.

8. **What remains client-dependent or unresolved?**
   - binding category/type;
   - canonical binding object/concept;
   - `requiredWhen`, `why`, `valueOrigin`, human-readable validation;
   - resolution status;
   - collection question only for entitled Pilot/Client Workspace/Admin/Owner users.

## Explicit public-safe allowlist

A public/anonymous projection MAY contain only deliberately constructed presentation fields, never the raw canonical container. Public-safe presentation fields are:
- task identity/title/purpose and safe boundary summary;
- applicability summary and active-context status;
- required-information concept/name/category/cardinality/requiredWhen/why/valueOrigin class/human-readable validation/evidence class/client-binding-required flag;
- decision question/gate name/human-readable condition/pass-fail family/basis class/client-configured flag;
- constraint statement/type/basis class;
- control objective/execution point/failure behavior;
- action description/precondition/postcondition/executor-neutral flag;
- state-family summary and branch-family summary;
- timing type/requiredWhen/startWhen/stopWhen/deadline-resolution class/timezone class/resolution status;
- canonical responsibility roles;
- canonical system role names and interface class without client application names/endpoints;
- canonical document/object family and safe human-readable field-contract summary;
- evidence requirement/acceptance criteria/evidence class;
- expected outcome code/meaning/state-family/required-evidence summary;
- binding type/category, canonical binding concept, why/requiredWhen/value-origin class, resolution status and aggregate unresolved counts;
- provenance/evidence class and confidence/status summaries without restricted source identifiers or source-to-claim detail;
- executability/readiness status and approved aggregate diagnostics.

## Explicit protected fields

The following are absent from Public/Anonymous and normal Authenticated Atlas projections unless a stronger entitlement explicitly permits them:
- raw canonical object payloads or unclassified descendant fields;
- exact client application/environment names, endpoints, credentials or internal identifiers;
- exact `clientFieldOrApiElement`, code crosswalk or local status-code mapping;
- client named person/team/delegated authority detail;
- client contract/tariff/rate values and local threshold values;
- restricted source identifiers, exact source-to-claim crosswalk and detailed provenance basis;
- machine expressions, executable decision expressions or compiler-ready rule syntax;
- runtime-specific projection details;
- full Work Decomposition or WorkDefinition detail.

## Client-binding projection rule

Canonical binding semantics and client-owned values are separated:
- **canonical side** may be shown as safe operational knowledge where classified;
- **client side** (`clientApplication`, `clientEnvironment`, `clientFieldOrApiElement`, client role/team/person, local values/codes/policies) requires own-workspace or governance entitlement;
- Public/Anonymous sees only binding category, canonical need and unresolved status;
- no user outside the authorized client workspace receives another workspace's bound values.

## Provenance rule

Public/normal views may show `evidenceClass`, confidence/status and a safe basis label. Exact `sourceRefs`, claim-boundary text and source-to-claim relationships are governance data and require a stronger entitlement unless independently classified public-safe.

## Unresolved behavior

Unresolved or conditional knowledge must never be silently omitted or substituted with a guessed value. The presentation must emit one of:
- `RESOLVED_REFERENCE`;
- `CONTEXT_REQUIRED`;
- `CLIENT_BINDING_REQUIRED`;
- `RESEARCH_REQUIRED`;
- `NOT_APPLICABLE`;
- `NOT_YET_EXECUTOR_PROVEN`;
- `NOT_YET_COMPILED`.

The renderer may translate these to user-friendly labels but may not change their semantic meaning.

## No pass-through rule

If a canonical object gains a new field, that field is **PRIVATE_NOT_PROJECTED by default**. It becomes visible only after explicit classification in the P1 field-classification registry or a superseding frozen contract.

## Projection output identity

Every emitted presentation object must retain backend trace keys sufficient to resolve the canonical source object without exposing protected data, at minimum:
- module/version identity;
- `taskId`;
- canonical element type;
- canonical element identifier where one exists;
- projection contract version.

## Exit condition

A P2 Operational Knowledge projection is conformant only if it constructs its response from this allowlist after authorization and never sends protected/unclassified canonical fields to an unauthorized browser.
