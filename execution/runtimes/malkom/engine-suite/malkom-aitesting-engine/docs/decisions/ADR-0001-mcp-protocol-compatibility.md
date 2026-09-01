# ADR-0001: MCP Protocol Compatibility

- Status: accepted
- Date: 2026-08-02
- Decision owner: product owner
- Requirement: MCP-001

## Context

The official versioning page checked on 2026-08-03 still names `2025-11-25` as
the current protocol. Official project material separately describes
`2026-07-28` as a release-candidate/draft generation planned to become final,
with a stateless core and long-running work through an extension. The expected
publication date has passed, but the authoritative pages are not yet consistent;
Brisk must not call the 2026 generation final or current until they are.

## Decision

The first-party server is intended to target the 2026 generation natively once
it is published as current/final and supported by the official TypeScript MCP
SDK, while retaining `2025-11-25` compatibility. Until then, implementation and
conformance claims must identify 2026 work as draft/RC-targeted. Stdio is the
default local transport. Authenticated Streamable HTTP is optional.

## Authoritative Sources

- Current-version policy: https://modelcontextprotocol.io/docs/learn/versioning
- Official 2025-11-25 specification: https://modelcontextprotocol.io/specification/2025-11-25
- Official 2026-07-28 RC announcement: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- Official draft changelog: https://modelcontextprotocol.io/specification/draft/changelog
- Official TypeScript MCP SDK compatibility documentation.
- Product-owner approval recorded on 2026-08-02.

## Consequences

- No 2026 production-conformance claim is allowed while authoritative publication
  and official SDK support remain unverified.
- Modern clients will receive the stateless protocol and applicable extensions
  only after the above gate passes.
- Down-level behavior requires explicit compatibility and conformance tests.
- Long-running product runs share durable run state rather than transport
  session state.
- Protocol-era differences remain at the MCP boundary and do not fork the
  compiler or execution pipeline.

## Security and Observability

- Local stdio minimizes the default exposed attack surface.
- HTTP requires origin validation, loopback defaults, authentication,
  authorization-context binding, resource limits, and audit telemetry.
- Correlation IDs must cross MCP, application service, run journal, and
  artifacts.

## Alternatives Rejected

- 2026-only: simpler, but excludes existing clients.
- 2025-only: avoids draft risk, but does not prepare for the announced next
  architecture; `2025-11-25` is still the current official revision at audit time.
- Hand-written protocol stack: rejected in favor of the mature official SDK.

## Proof Required

- Official conformance for both supported eras.
- Stdio and Streamable HTTP integration proof.
- Progress, Tasks, cancellation, interruption, resumption, authorization,
  tenant-isolation, load, and packed-product proof.
