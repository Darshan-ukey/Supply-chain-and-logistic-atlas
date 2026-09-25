# LTL-03 Graph-First Research — DSDC Publication-State Conflict and Source-State Governance v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: a41e880d8828be0dba6dbc277c106f410a5106c5 (427 nodes / 2,222 typed edges / 128 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Authoritative issuer pages reviewed:
- DSDC API Standards catalogue.
- DSDC home page.
- Digital LTL Council page.

Observed issuer-state conflict:
1. The API Standards catalogue identifies Preliminary Freight Charges Version 1.0.0 and In-Transit Visibility Version 1.0.0 in the LTL API Standards catalogue and describes their functions.
2. The Digital LTL Council page explicitly says Preliminary Freight Charges is now available/live.
3. The DSDC home page simultaneously renders Preliminary Freight Charges and In-Transit with an "In Development / Subscribe For Updates" treatment.
4. These pages are all first-party DSDC/NMFTA issuer material. Atlas therefore cannot resolve the discrepancy by source-authority rank alone.
5. Publication/release state is metadata about the governed source artifact; it is distinct from the semantic content extracted from issuer descriptions.
6. Where first-party publication-state metadata conflicts, Atlas must retain the conflict and retrieval provenance rather than silently promote one status to canonical truth.
7. Semantic facts that are independently supported by the issuer pages remain usable with provenance, but a deployment/readiness decision that depends on formal standard availability/version must remain unresolved until the issuer state is reconciled.

## Track B — continuous normalization/materialization

Reuse:
- RF9 Source Authority & Precedence;
- RF18 Temporal & Version Semantics;
- SP-STATE, SP-TEMPORAL-VALUE, SP-EVIDENCE-PROVENANCE, SP-RELATIONSHIP;
- conditional-contract pattern.

Generated-instance candidates:
- detect and retain conflicting publication/release-state metadata across equally authoritative issuer pages;
- separate source publication-state uncertainty from source-backed semantic facts;
- block any readiness decision that requires confirmed formal availability/version while publication state is unresolved.

Knowledge-gap / reconciliation dependency:
- authoritative reconciliation of current publication/release state for DSDC In-Transit Visibility and, where relevant, any other standard with conflicting first-party status metadata.

## Guardrails

- Do not choose one first-party status merely because it is newer-looking or more convenient.
- Do not downgrade all semantic evidence solely because publication-state metadata conflicts.
- Do not represent "Version 1.0.0 listed in catalogue" and "In Development" as simultaneously resolved canonical status.
- Preserve page/source provenance and retrieval date for every status assertion.
- Formal availability-dependent execution readiness remains blocked until status conflict is reconciled.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
