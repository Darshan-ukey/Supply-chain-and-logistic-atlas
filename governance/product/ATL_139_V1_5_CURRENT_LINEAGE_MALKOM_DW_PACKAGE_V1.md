# ATL-139 — Current-Lineage Road LTL → Malkom Domain Warehouse Package v1

Status: BUILD CANDIDATE — requires independent Claude QA.

This package is a bounded, deterministic consumer projection from current Atlas v1.5 governed Road LTL semantics. It does not rewrite Atlas canonical truth into a Malkom schema and does not relabel the historical Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0 fixture.

## Lineage

Canonical source: `wd::road-ltl::LTL-04::v1` plus ATL-165 client-binding state and ATL-163 readiness state. Consumer: MALKOM. Projection is read-only with respect to canonical Atlas records.

## Fail-closed boundary

Mandatory unresolved client/master execution parameters remain `CLIENT_BINDING_REQUIRED`; package readiness is therefore not executable-ready. No unconfirmed Malkom interface is invented. The package is exposed as a machine-readable governed export artifact; downstream transport/API binding remains `REQUIREMENT_NOT_CONFIRMED` until independently governed.

## Projection contract

Preserve canonical IDs, versions, source IDs, state/event/decision/rule/control/evidence, required objects, actors/systems, actions/outcomes/exceptions, binding dispositions and readiness. Any mandatory semantic that cannot be represented is emitted as `LOSS` or `UNSUPPORTED` and causes fail-closed readiness. Unknown knowledge remains `UNKNOWN`; client-specific values remain separate bindings.

## Bounded scope

Road LTL / LTL-04 only. This is not full Road LTL coverage, enterprise onboarding, BOL/FIRI, or v2 generalized projection.