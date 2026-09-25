# Atlas Verification Harness V0.1 — First-Party Contract

Status: VERIFIED_FIRST_PARTY_PATTERN / GENERALIZATION IN PROGRESS  
Linear: ATL-101

## Governing invariant

BUILD → EXECUTE/VERIFY → PROVE → INDEPENDENT QA (where required) → ADVANCE.

Static/model review is never executable proof.

## Required task declaration

Every behavioral task must declare before build:
1. behavior changed;
2. executable environment;
3. positive tests;
4. negative/refusal tests;
5. durable evidence identity;
6. whether independent QA is required.

## Validation routing

- SQL/migration → disposable PostgreSQL matching target major version; apply candidate as written; valid/invalid/update/delete/rollback/constraint probes.
- Code/compiler/resolver → unit + integration + golden + negative fixtures against exact commit/blob.
- API → start real service/handler and make real requests including failure paths.
- UI → browser automation against a running/deployed application; capture material evidence.
- Data/transformation → known input → produced output → predetermined invariants/counts/hashes/semantic assertions.
- Frozen/recovery → actual clean restore/rebuild and identity verification.
- Security/permissions → authorized + unauthorized attempts with explicit allow/refuse proof.

## Durable proof envelope

Each run must retain:
- task_id;
- input identities/hashes;
- implementation commit/blob;
- validator identity/version;
- environment identity;
- command/action;
- timestamp;
- raw result/artifact pointer;
- normalized PASS/FAIL;
- predetermined acceptance criteria;
- QA-required flag.

Unknown/missing proof = FAIL_CLOSED.

## Demonstrated Atlas pattern

ATL-94 is the first executable SQL pattern: candidate SQL was exercised in disposable PostgreSQL, defects were found before closure, corrected, rerun, and independently QA'd through ATL-83. This demonstrates why executable verification precedes QA.

## Controller integration

ATL-120/ATL-99 may advance a behavioral task only when the required proof envelope is present and PASS. For material canonical/schema/security/generator/readiness/projection/product-contract/release work, independent QA remains a separate gate.

## Non-authority

This harness does not authorize production mutation, product-contract freeze, frozen-asset promotion, or go-live.
