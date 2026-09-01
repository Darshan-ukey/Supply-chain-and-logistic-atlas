# ADR-0003: Local Storage Authority

- Status: accepted
- Date: 2026-08-02
- Decision owner: product owner
- Requirements: REL-001, EXT-001

## Context

Runs, evidence, tasks, artifacts, interruption recovery, and cleanup outcomes
need durable local authority. The existing product has an append-only run
journal and atomic final-result writes. A native database would increase the
default installation and cross-platform burden.

## Decision

Evolve the existing append-only journal and atomic artifact store as the
default authoritative local store. Place it behind versioned, pluggable run,
result, evidence, task, and artifact storage contracts. A native database is
not required by the core package.

## Authoritative Sources

- Existing `RunJournal`, recovery, and handover data flows.
- The local-first and lightweight-install product requirements.
- Product-owner approval recorded on 2026-08-02.

## Consequences

- Existing recovery work is reused rather than replaced.
- Atomicity, locking, corruption detection, retention, and multi-process
  behavior require explicit proof.
- Hosts and remote deployments may provide stronger storage implementations.
- Transport sessions never become the source of truth for product runs.

## Alternatives Rejected

- Required native SQLite dependency: stronger querying, but conflicts with the
  default installation constraint and Node.js 20 compatibility.
- Memory-only state: cannot meet interruption and resumption requirements.

## Proof Required

- Crash, partial-write, concurrent-access, retention, recovery, and cleanup
  continuation tests.
- Storage-adapter conformance and host integration proof.

