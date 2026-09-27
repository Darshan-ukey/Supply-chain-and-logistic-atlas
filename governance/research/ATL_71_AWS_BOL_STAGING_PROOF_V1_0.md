# ATL-71 — AWS BOL Staging Proof v1.0

## Purpose and boundary
This is an isolated, non-production proof instrument for ATL-49F. It evaluates the same BOL corpus through a generic extraction control arm and an optional Atlas-enriched treatment arm. Atlas is a post-extraction intelligence layer; it does not perform OCR/IDP and it does not write to production/client systems.

Governed inputs:
- ATL-69 frozen experimental scope: 66/76 testable fields.
- ATL-70 frozen benchmark/ground-truth/metrics contract. Ground truth and scoring rules must not be changed after a run starts.

## Flow
1. Intake: immutable BOL object is written to the staging intake S3 prefix.
2. Extraction: a generic IDP/OCR adapter produces a normalized structured extraction envelope. The adapter may target Amazon Textract or another generic IDP, but both arms MUST consume the identical extraction envelope for a document/run.
3. Control arm: normalized extraction passes directly to validation/contextualization without Atlas enrichment.
4. Treatment arm: the identical normalized extraction is copied through the Atlas intelligence adapter, which may add semantic/contextual candidates and provenance but MUST preserve the raw extraction.
5. Validation: both arms use the same ATL-70 truth manifest, field applicability rules, cardinality rules, and scorer version.
6. Evidence: run manifest, immutable input hash, extraction payload/hash, Atlas output/hash when applicable, validation result, metrics, config version and audit events are stored under the run ID.

## Isolation and write safety
- STAGING_ONLY=true is mandatory.
- ALLOW_PRODUCTION_WRITEBACK=false is mandatory and checked before execution.
- No production API endpoint, production database credential, client writeback queue, or production mutation permission belongs in this stack.
- S3 buckets block public access and use versioning/server-side encryption.
- IAM is least-privilege to the staging evidence/intake resources.
- Each run gets a run_id; artifacts are append-only by run_id. Re-running requires a new run_id.

## Reproducibility contract
Each run manifest records:
- run_id and UTC start time
- document/corpus manifest ID and SHA-256
- ATL-69 scope version/commit
- ATL-70 contract version/commit
- extraction adapter + model/config version
- Atlas adapter + knowledge/config version (treatment only)
- validation/scorer version
- arm = control|treatment
- source document SHA-256
- normalized extraction SHA-256
- output/evidence SHA-256 values

A control/treatment pair is comparable only when corpus manifest, source hash, normalized extraction hash, truth manifest, scorer version and applicability rules match.

## Deployment
Deploy `template.yaml` into a dedicated non-production AWS account or isolated staging environment. Required parameter `EnvironmentName` must remain `atlas-bol-staging`. The template creates only staging S3 evidence/intake storage, a DynamoDB run ledger, a Step Functions state machine, Lambda orchestration functions, and staging-scoped IAM/logging.

The orchestration state machine implements:
`ValidateRun -> Extract -> Choice(arm) -> AtlasEnrich(treatment only) -> Validate -> PersistEvidence`.

External IDP/Atlas calls are adapter boundaries. Credentials/endpoints are injected only from staging configuration/Secrets Manager and are not committed.

## Run path
1. Upload BOL to the intake prefix.
2. Create a manifest with arm, immutable source hash, governed contract/scope versions and adapter versions.
3. Start the state machine with that manifest.
4. ValidateRun rejects any environment other than staging, any production writeback flag, invalid arm, or missing governed version.
5. Extract produces the normalized extraction once.
6. Treatment optionally enriches; control bypasses enrichment.
7. Validate applies the frozen ATL-70 scoring contract.
8. PersistEvidence records hashes/results and closes the run ledger entry.
9. Compare paired arms only through ATL-70 metrics; do not tune treatment using benchmark labels/results.

## Acceptance mapping
- Deployable staging stack: `template.yaml`.
- Architecture/config documented: this file + `config.example.json`.
- Repeatable run path: state-machine flow and immutable run manifest.
- No production-client writeback: hard false flag plus runtime validation and staging-scoped resources.
- Same base extraction for control/treatment: one Extract state precedes arm Choice; treatment enriches only a copy of that extraction.
- Audit/config versioning: run ledger + S3 versioning + manifest hashes/versions + CloudWatch logs.

## QA evidence expectations
Independent QA should verify the branch artifact content, the hard staging/writeback guards, state-machine ordering (Extract before arm Choice), identical base-extraction requirement, immutable evidence/version fields, and absence of production mutation resources.
