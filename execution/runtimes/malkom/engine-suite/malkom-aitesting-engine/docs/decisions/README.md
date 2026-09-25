# Architecture Decision Records

Architecture decisions are immutable records. A later decision may supersede
an earlier record, but must not rewrite its history.

| ADR | Decision | Status |
| --- | --- | --- |
| [ADR-0001](ADR-0001-mcp-protocol-compatibility.md) | Native MCP 2026-07-28 with 2025-11-25 compatibility | accepted |
| [ADR-0002](ADR-0002-optional-adapter-packages.md) | Lightweight core with optional heavy adapter packages | accepted |
| [ADR-0003](ADR-0003-local-storage-authority.md) | Append-only local authority behind pluggable storage | accepted |
| [ADR-0004](ADR-0004-dependency-safe-delivery.md) | Dependency-safe vertical delivery order | accepted |
| [ADR-0005](ADR-0005-package-source-map-policy.md) | Keep source maps locally and omit incomplete maps from the npm package | accepted |
| [ADR-0006](ADR-0006-provider-trust-and-isolation.md) | Trusted in-process helpers with an optional isolated-worker path | accepted |

Every ADR must record context, decision, authoritative data sources,
consequences, security and observability impact, alternatives, and proof
requirements.
