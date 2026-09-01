# ADR-0002: Optional Adapter Packages

- Status: accepted
- Date: 2026-08-02
- Decision owner: product owner
- Requirements: ADP-001, DX-001

## Context

The default product must remain easy to install and local-first. Browser,
broker, database, cloud, and platform SDKs can add large dependency trees,
native components, services, credentials, or runtime requirements.

## Decision

`brisk-aitesting` remains the lightweight core. Heavy production adapters are
packaged separately behind the same versioned capability, evidence, lowering,
execution, cancellation, security, and conformance contracts.

## Authoritative Sources

- The product mandate's adapter and ease-of-use requirements.
- The current optional Playwright and external-adapter architecture.
- Product-owner approval recorded on 2026-08-02.

## Consequences

- Beginners do not install unrelated runtimes.
- Every optional package needs independent compatibility, packaging, security,
  documentation, and reference-application proof.
- Fixture-only compiler compatibility does not qualify an adapter as supported.

## Alternatives Rejected

- One package containing all runtimes: simpler discovery, but unacceptable
  installation weight and security surface.
- Host forks: violates the extension and adaptability requirements.

## Proof Required

- Core packed-install size and dependency measurements.
- Optional-package installation and conformance proof.
- Compatibility matrix across supported core/adapter versions.

