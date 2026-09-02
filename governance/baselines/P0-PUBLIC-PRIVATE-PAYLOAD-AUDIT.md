# P0 Public / Private Payload Audit

**Status:** COMPLETE — baseline audit only; no remediation performed in P0.

## Current execution-fabric boundary

The current repository already has a meaningful protection boundary:

- `.vercelignore` excludes `execution/runtimes/`, `execution/adapters/`, `execution/core/`, `execution/contracts/` and `execution/manifest.json` from web deployment.
- `execution/SECURITY_BOUNDARY.md` explicitly states that public Atlas does not receive WorkDefinition/runtime payloads.
- Only generic browser UI helpers under `execution/ui/` are intended for deployment.
- Authorized runtime users receive runtime data through authenticated/capability-gated APIs.
- Admin/Governor remains a stronger capability boundary.
- Repository privacy is separately required for protected runtime source; Vercel exclusion alone is not treated as source-code security.

## P0 exposure classification

### A. Current protected implementation source
**Private / deployment-excluded:** execution runtime implementations, adapters, execution core, execution contracts, execution manifest and runtime-specific engine/projection material.

### B. Browser-deployable implementation
**Public-safe only:** generic UI/rendering helpers that contain no protected runtime projection data.

### C. Operational Knowledge
**New presentation requirement:** the frozen Presentation Architecture V1 requires an explicit human-readable, allowlisted Operational Knowledge projection. Canonical Operational Knowledge must not be delivered wholesale to an unauthorized browser.

### D. Execution Readiness
**Visible governed projection:** aggregate/readiness statuses may be visible, but they must not become a covert channel for full protected execution logic.

### E. Work Decomposition
**Protection must be explicit:** the new architecture extends the protected boundary to the **full recursive Work Decomposition**, not only WorkDefinition/runtime projection. Public/normal views may receive only an approved summary.

### F. WorkDefinition
**Protected:** full canonical WorkDefinition and machine-readable execution contracts remain protected.

## Candidate-page risk recorded for later phases

The candidate Daughter build process is capable of producing rich HTML/reference artifacts containing operational structures. P0 therefore records a release rule for P2/P3:

> Raw candidate HTML/data must never be treated as the public projection merely because protected sections are visually hidden.

The final public payload must be created by an explicit allowlist/projection service or build step before it reaches the browser.

Because Road LTL V1.4 and Ocean V0.6 are frozen candidates and are not promoted by P0, this is recorded as a **candidate publication risk**, not as evidence of a current production leak.

## P0 browser-data rules frozen for implementation

1. Unauthorized browser receives no full Work Decomposition.
2. Unauthorized browser receives no full WorkDefinition.
3. Unauthorized browser receives no runtime-specific projection.
4. Operational Knowledge public/normal view is allowlisted.
5. New canonical fields default to private/not-present until classified.
6. UI hiding is never a security control.
7. Ask Atlas and Trace must use the same projection/authorization policy as Daughter/Canvas.
8. Exact client mappings and restricted provenance remain protected according to governance policy.

## Exit conclusion

The current execution fabric already has a strong server/deployment boundary for WorkDefinition/runtime IP. P1–P2 must formalize the missing presentation matrix and extend that boundary to full Work Decomposition plus the new safe Operational Knowledge projection.
