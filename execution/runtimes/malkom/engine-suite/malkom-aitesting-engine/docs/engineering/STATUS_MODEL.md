# Engineering Status Model

Status progression is monotonic for a product version unless new evidence
invalidates a claim. Invalidated claims must be downgraded visibly.

| Status | Entry criteria |
| --- | --- |
| `specified` | Requirement, authoritative data source, acceptance criteria, security/observability impact, and test plan exist. |
| `implemented` | Code and public contracts exist; applicable static, unit, negative, and adversarial checks pass. |
| `integration-proven` | Real subsystem or reference-application integration passes with inspected artifacts. |
| `cross-architecture-proven` | The requirement's declared platform, runtime, protocol, and packaging matrix passes. |
| `release-ready` | All applicable release gates, docs, migration, capability, traceability, claim, and security records pass. |
| `complete` | Nothing required by the accepted scope remains open, skipped, decision-blocked, or externally blocked. |

`implemented` cannot be inferred from types alone. `integration-proven` cannot
be inferred from synthetic fixtures. `release-ready` and `complete` cannot be
inferred from a selected suite.

