# Atlas v2 — Measurement & Value Intelligence Contract v0.1 Candidate

**Linear authority:** ATL-180  
**Status:** CANDIDATE / NOT IMPLEMENTED / NOT COMPLETE  
**Scope:** Atlas v2 only. This contract must not expand the Atlas v1.5 Malkom release.

## Purpose

Atlas should reuse its governed operational knowledge, WorkDefinitions and end-to-end value-chain relationships to define how operational performance, outcomes and business value can be measured and projected into downstream analytics implementations.

This is not a KPI catalogue and Atlas is not the BI/analytics execution engine.

## Architecture

Canonical operational knowledge + WorkDefinition + process/value-chain graph
→ Metric / Outcome / Value semantics
→ governed Value Relationships
→ Client Measurement Binding
→ Measurement Readiness
→ Analytics Projection
→ downstream analytics consumer.

## Reusable semantic objects

### MetricDefinition
Versioned definition, purpose, formula, numerator/denominator, exclusions, grain, unit, time window, dimensions, directionality, required objects/fields/events/timestamps, process/work ownership, evidence/provenance, epistemic state and reuse scope.

### OutcomeDefinition
Operational/business condition to improve or protect. Outcome is distinct from the metric used to observe it.

### ValueDefinition
Value classes include cost, capacity, revenue, working capital, service/customer outcome and risk/control.

Mandatory distinctions:
- operational benefit != capacity benefit != financially realized benefit;
- revenue opportunity != revenue protected != revenue recovered != revenue realized.

### ValueRelationship
Connect process/work, metrics, outcomes and value. Relationship semantics must distinguish at least:
DEFINITIONAL / DIRECT_DRIVER / CONTRIBUTORY / CORRELATED / HYPOTHESIZED / VALIDATED.

Each material relationship carries mechanism, direction, conditions, evidence/provenance, validation state and material confounders/limitations where applicable.

Atlas must not automatically convert operational dependency into causal business-value claims.

### MeasurementContract
Client-specific binding of canonical measurement semantics to source systems, fields, joins, grain, history, data quality, baseline, target, attribution/counterfactual, ownership and analytics-runtime binding.

## Value Causality / Influence Graph

Represent:
Activity/Work → Operational Metric → Process Outcome → Cross-process Effect → Enterprise Outcome → Value.

Graph traversal must work in both directions:
- forward transformation/design impact;
- backward diagnostic/root-driver analysis.

Many-to-many relationships, cycles and indirect effects are allowed. Do not force a linear value chain.

## Measurement Readiness

Knowing a KPI does not mean it can be measured.

Resolver evaluates:
metric definition → required data → grain compatibility → source systems → field/event availability → historical sufficiency → data quality → baseline constructability → attribution/counterfactual validity where required → analytics-runtime capability.

Minimum states:
- MEASUREMENT_READY
- MEASUREMENT_BLOCKED

Blocked results must expose exact blockers and governed resolution routes.

## Attribution and realization controls

Atlas must:
- separate baseline, target, observed change and realized value;
- require explicit attribution methodology for causal/transformation value claims;
- preserve assumptions/confounders and counterfactual/baseline method where material;
- maintain value lineage from value claim to operational change and evidence;
- expose overlapping benefit pools to prevent double counting;
- never infer monetary value from operational improvement without required client binding/evidence.

## Canonical/client boundary

Reusable definitions, relationship mechanisms and evidence-backed domain/value knowledge may be canonical.

Client volumes, labor rates, financial values, targets, local systems, field mappings, thresholds, baselines and realization assumptions belong in Client Measurement Binding unless independently justified as reusable truth.

## Analytics projection boundary

Atlas emits governed analytics specifications/projections. Downstream BI, process-mining, data/lakehouse, control-tower, Malkom, analytics-agent and custom-application runtimes execute analytics/visualization.

Vendor-specific mappings belong in analytics/runtime bindings, not canonical Atlas truth.

## Failure controls

Guard against:
1. KPI-library accumulation without decision/value relevance;
2. false causality;
3. operational metrics mislabeled as business value;
4. incompatible grain;
5. missing/poor-quality data;
6. invalid baseline or attribution;
7. double-counted benefits;
8. static/unversioned relationships;
9. generic assumptions leaking into client truth;
10. dashboard-first architecture.

## Acceptance gate

ATL-180 cannot complete until independent QA verifies one governed scope demonstrating:
1. reusable MetricDefinition + OutcomeDefinition + ValueDefinition;
2. evidence-state ValueRelationship graph;
3. Client Measurement Binding;
4. deterministic MEASUREMENT_READY/BLOCKED with exact blockers;
5. a value claim blocked by insufficient attribution/baseline/data;
6. value-lineage/double-counting control;
7. forward and backward graph traversal;
8. representative downstream analytics projection without mutation of canonical operational truth.

## Architectural relationships

- ATL-108 — Operations & Transformation Intelligence.
- ATL-113 — versioned dependency/impact graph.
- ATL-114 — enterprise/client discovery feeds Measurement Binding.
- ATL-116 — epistemic/promotion lifecycle.
- ATL-117 — Atlas product economics; separate from client operational/business value intelligence.
- ATL-164 — analogous readiness mechanics; measurement readiness remains distinct from runtime implementation readiness.
- ATL-107 / ATL-170 — share canonical-truth/runtime-specific projection principle; analytics projections are not execution-runtime packages.

## Governance status

Owner-directed architecture addition, 29 Sep 2026.
This file is a candidate architecture contract. It does not claim implementation, runtime proof, QA PASS or completion.
