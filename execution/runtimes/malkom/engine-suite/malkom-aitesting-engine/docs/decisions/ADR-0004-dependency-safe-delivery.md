# ADR-0004: Dependency-Safe Vertical Delivery

- Status: accepted
- Date: 2026-08-02
- Decision owner: product owner
- Requirement: ENG-001

## Context

The mandate spans contracts, evidence, compiler behavior, adapters, security,
observability, CLI, MCP, benchmarks, documentation, and release proof. Building
surfaces before shared contracts would create weaker duplicate pipelines.

## Decision

Deliver in vertical, dependency-safe order:

1. engineering truth and acceptance gates;
2. shared pipeline and evidence foundations;
3. compiler, mutation, and cleanup invariants;
4. OpenAPI end-to-end proof;
5. reliability, security, observability, and shared application service;
6. complete CLI;
7. dual-era MCP;
8. optional production adapters;
9. benchmark and release proof.

Independent optional-adapter research may proceed once shared contracts are
stable. External proof blockers must not stop unrelated core work.

## Consequences

- Each surface reuses one proven pipeline.
- OpenAPI provides an early real vertical slice without becoming a universal
  compiler assumption.
- Broad adapter claims arrive later, backed by conformance and reference proof.

## Alternatives Rejected

- Surface-first implementation: creates duplicated planning and recovery paths.
- Adapter breadth first: produces many fixture-level integrations without a
  proven product lifecycle.

## Proof Required

- Traceability from each surface to the shared application service.
- No weaker duplicate planning pipeline.
- Checkpoint and record validation throughout delivery.

