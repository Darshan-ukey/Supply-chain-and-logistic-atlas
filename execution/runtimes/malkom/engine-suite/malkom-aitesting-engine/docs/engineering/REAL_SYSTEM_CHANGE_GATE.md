# Real-System Change Gate

## Meaning of an upgrade

For this product, an **upgrade** is any change that can alter what a user or
integrated application experiences. This includes compiler/planner behavior,
evidence acquisition, adapters, authentication, authorization, network or
secret policy, execution, verification, retries, waiting, cancellation,
cleanup, recovery, result wording, configuration, packaging, startup, or a
dependency/runtime version.

A prose-only correction that cannot change executable behavior is a
documentation change, not a product-behavior upgrade. It still requires the
engineering-record and packed-document checks when shipped documentation
changes.

## Default rule

Every product-behavior upgrade must be tested against Directus, Medusa, and n8n
before it is called complete. The applications are a minimum architecture set,
not the complete compatibility claim. A pass on one application cannot
substitute for an unexecuted application.

The gate has these ordered parts:

1. Record the exact change and which shared behaviors it can affect.
2. Run the normal focused and connected `brisk-aitesting` tests.
3. Prove the three pinned applications and their isolated data are ready.
4. Pack and clean-install the actual `brisk-aitesting` artifact.
5. Run the applicable positive, expected-refusal, invalid, missing-information,
   timeout/cancellation, mutation, cleanup, and residual-state scenarios on
   **each** application.
6. Record exact attempts, actual safe responses, counts, failures, skips,
   cleanup, remaining data, timing, proof class, and exclusions.
7. Run the engineering-record gate so neither test code nor progress can change
   without reviewed coverage documentation.

If an application is unavailable, the result is **blocked/not executed**, not
passed. The upgrade remains incomplete unless the product owner explicitly
changes scope; a temporary outage is never converted into compatibility proof.

## Current enforcement depth

| Gate part | Current state | Honest meaning |
| --- | --- | --- |
| Exact three-app source/runtime identity | Built and executable | TCV-0032 checks the pinned clean sources and recorded Medusa application path. |
| Three-app readiness and setup safety | Built and executable | TCV-0032 currently passes 66/66 with all applications ready. |
| Coverage/progress integrity | Built and executable | `smoke:engineering-records` rejects undocumented tests, stale digests, false counts, and 14 named malformed records. |
| Packed-product proof | Built for package import and one Directus API journey | TCV-0035 drove one connected real-AI Directus API journey from a clean-installed tarball; Medusa, n8n, UI, depth, and stress denominators remain open. |
| Directus business scenarios | Historical narrow API evidence only | The earlier journey passed but lacks the new raw-response digest/token record, so accepted corpus coverage is 0/100; this is not Directus application-support, UI, GraphQL, database, stress, or benchmark proof. |
| Medusa business scenarios | Missing | Initial data exists; dedicated customer/test identities and scenario flows remain open. |
| n8n business scenarios | Missing | Dedicated credentials/workflows and execution/cleanup proof remain open. |
| One executable all-app upgrade command | Partially built | Readiness and one Directus packed API journey are executable; the command cannot be called complete until the 300-scenario, depth, stress, and three-app packed-product gates exist and pass. |

Therefore, from this rule's adoption onward, readiness-only results may support
lab/setup changes but must not approve a compiler, adapter, execution, cleanup,
security, or result-behavior upgrade as fully cross-application tested. Those
upgrades remain blocked at the missing scenario row until the relevant suites
are implemented and pass.

## Required report for every upgrade

Every upgrade report must answer in ordinary language:

- What user-visible behavior changed?
- Why was the change needed?
- Which old or incorrect behavior could escape?
- What was attempted on Directus, Medusa, and n8n?
- What did each application actually return?
- Which attempt was expected to succeed or be refused, and why?
- What data changed, what was cleaned, and what may remain?
- How many checks ran, failed, or skipped?
- What is still unproven?

The dated result belongs in `REAL_SYSTEM_PROOF_LOG.md`; test mechanics and
exclusions belong in `TEST_COVERAGE.md`; escaped defects belong in
`REGRESSION_CATALOGUE.md`; progress belongs in the execution checkpoints.
