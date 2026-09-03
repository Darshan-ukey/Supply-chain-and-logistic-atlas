# Universal Daughter Renderer Contract V2

**Status:** FROZEN  
**Phase:** P3 — Universal Daughter Renderer V2  
**Governing architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`  
**Consumes:** P2 Backend Projection Boundary + Presentation Contracts v1.1

## Purpose

Define one generic Daughter rendering contract for A5 execution depth without introducing daughter-specific business rules or a second source of operational truth.

The canonical A5 presentation sequence is fixed:

**Overview → Operational Knowledge → Execution Readiness → [Protected] Work Decomposition → [Protected] WorkDefinition**

Information Resolution is rendered inside Operational Knowledge. It is not a sixth top-level depth.

## Renderer inputs

The normal/public Daughter renderer may consume only the P2 `PUBLIC_SAFE` execution-depth projection returned by:

`GET /api/execution-depth-projection?moduleId=<id>&moduleVersion=<version>&taskId=<id>`

The renderer must not directly load canonical daughter files, Operational Knowledge JSON, source-claim packs, client bindings, runtime projections, Work Decomposition, WorkDefinition or private seed data.

The renderer is a projection consumer. It is not an authority for process semantics, readiness computation, access policy or execution logic.

## Exact-version rule

A Daughter selection is a tuple of:
- `moduleId`
- `moduleVersion`
- `taskId`

The renderer must fail closed when that exact tuple is not published by the P2 projection source registry. It must never silently substitute a different Daughter version, production version, candidate version or task.

This rule is critical while product/runtime modules and frozen execution-reference candidates can coexist at different versions.

## Five-depth behavior

### 1. Overview
May render only projected safe fields such as:
- task title/purpose;
- trigger;
- state before/after;
- outcome;
- semantic status;
- canonical trace identifiers and contract versions exposed by the safe projection.

### 2. Operational Knowledge
May render only projected safe fields such as:
- business meaning and why;
- canonical object families;
- required/prohibited conditions;
- safe resolution-capability labels;
- human-readable resolution summaries;
- unresolved counts/status families;
- measurement-integrity summary;
- rule/control/action/timing/evidence summaries;
- aggregate client-binding dependency.

It must not render raw canonical Operational Knowledge/Information Resolution records.

### 3. Execution Readiness
May render only safe diagnostic projection fields such as:
- overall readiness status;
- decomposition requirement/status;
- executor-ready status;
- independent-executor-proof status;
- aggregate coverage components;
- unresolved counts/categories;
- aggregate HITL/system/client-binding dependencies;
- protected downstream asset availability/status.

No renderer-side calculation may strengthen the server-side readiness claim.

### 4. Work Decomposition — protected
The normal Daughter surface renders status/availability only. It does not preload or fetch the protected decomposition endpoint.

A user action may emit a neutral authorization intent for an enclosing authenticated surface to handle. The shared public renderer itself must not know or call the protected endpoint.

### 5. WorkDefinition — protected
The normal Daughter surface renders status/availability only. It does not preload or fetch the protected WorkDefinition endpoint.

A user action may emit a neutral authorization intent for an enclosing authenticated surface to handle. The shared public renderer itself must not know or call the protected endpoint.

## Authorization invariant

Visibility is enforced before rendering by the P2 data/API projection boundary. UI/CSS hiding is never an authorization mechanism.

The normal Daughter browser must never receive:
- recursive Work Decomposition;
- WorkDefinition fields/rules/transitions;
- machine-ready resolution workflow;
- reconstructive cross-field/cross-object logic;
- source-claim IDs/crosswalks where protected;
- client field/API mappings or client values;
- runtime mappings/configuration;
- private compiler/materialization payloads.

## Generic-renderer invariant

The shared renderer must contain no:
- daughter IDs or task IDs;
- mode/service-specific decision logic;
- jurisdiction-specific business rules;
- client-specific behavior;
- fixed layout coordinates per daughter;
- semantic fallbacks from one daughter/version to another.

All visible domain semantics come from the authorized projection object.

## Daughter vs Canvas boundary

P3 introduces the universal Daughter execution-depth route independently of Canvas. P3 must not alter Canvas V2 behavior or `index.html` rendering semantics.

P4 may integrate this same presentation contract into the Canvas inspector, but must consume the same P2 projections rather than fork the renderer semantics.

## Navigation model

Daughter-level navigation remains conceptually:

**Overview → Compose Context → Execution Graph → Reference Configurations → Enterprise Lenses → Sources**

The five execution-depth tabs live inside the selected A5 experience and do not replace this Daughter-level navigation.

## Accessibility and responsive behavior

The five depths use semantic tab controls with an explicit selected state. Content must remain usable at mobile widths through horizontally scrollable depth tabs and vertically stacked content. Protected status must be communicated in text, not by icon/color alone.

## Failure behavior

On incomplete selection, unavailable exact-version projection, network error or denied publication:
- show a neutral fail-closed state;
- state that no alternate version was substituted;
- do not read raw data files from the browser;
- do not downgrade to protected/canonical endpoints.

## Versioning

This contract creates **Universal Daughter Renderer V2**.

Renderer versioning does not alter Daughter semantic versions. Road LTL 1.5, Ocean FCL 0.6 and Ocean LCL 0.6 retain their independent semantic/candidate identities.

## P3 exit gate

P3 passes only when:
1. one generic renderer exposes all five frozen depths;
2. public content is loaded only from the P2 public-safe projection;
3. protected depth is never preloaded by the public renderer;
4. unavailable exact selections fail closed without version substitution;
5. shared renderer contains no daughter-specific business logic;
6. the same renderer can render a contract-conformant non-LTL test projection without code changes;
7. Canvas/index semantics remain unchanged;
8. P2 projection/IP-boundary tests continue to pass.
