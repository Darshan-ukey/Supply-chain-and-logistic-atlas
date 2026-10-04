# Atlas Knowledge-to-Execution Architecture V1 — FROZEN

Status: **FROZEN ARCHITECTURE**  
Effective: 2026-09-02

## Canonical chain
AUTHORITATIVE SOURCES → UNIVERSE → DAUGHTER DOMAIN MODEL → OPERATIONAL KNOWLEDGE → RECURSIVE WORK DECOMPOSITION → CANONICAL WORKDEFINITION → CLIENT BINDING → RUNTIME PROJECTION/COMPILER → EXECUTION → EVIDENCE/FEEDBACK.

## Ownership boundaries
- Universe defines the enterprise/domain universe and cross-domain semantics.
- Daughter modules define governed domain work and applicability.
- Operational Knowledge defines what must exist, when, why, constraints, decision/control behavior and expected outcomes.
- Work Decomposition recursively resolves composite A5 work into executable units.
- Canonical WorkDefinition is executor-neutral.
- Client Binding supplies only environment-specific values/mappings/configuration.
- Runtime projections (Malkom, workflow, RPA, agent, API, etc.) are derived consumers and never become canonical Atlas truth.
- Evidence/feedback may propose knowledge gaps but cannot mutate canonical knowledge without governance.

## Persistence rule
The backend Knowledge Warehouse is the canonical persistent store. HTML, JSON pages, Canvas views, WorkDefinition packages and runtime projections are generated/materialized views of governed data, not independent sources of truth.

## Change rule
Downstream assets retain explicit lineage to source, Universe, daughter version, operational-knowledge version and decomposition/WorkDefinition schema. Daughter changes trigger impact analysis, selective regeneration, and full regression.
