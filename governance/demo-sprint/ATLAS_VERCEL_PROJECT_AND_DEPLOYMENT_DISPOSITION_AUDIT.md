# Atlas — Vercel Project & Deployment Disposition Audit

Status: ACTIVE FORENSIC INVENTORY / NO DELETION AUTHORIZED  
Effective: 12 September 2026

## Owner direction
The only Atlas web foundation to be treated as the intended upgrade base is:

> `supplychainatlas.vercel.app`

The Owner identifies this as the foundation release that went live around 23–25 August 2026 and intends to update this foundation eventually.

All other Atlas-related Vercel URLs/projects/deployments must be treated as **UNCLASSIFIED** until verified. Their existence may be the result of uncontrolled direct/agent-driven deployments that also contributed to the earlier ~25 GB Deployment Storage issue.

No Atlas-related Vercel project/deployment may be deleted solely because it appears old, duplicated, unused or differently named.

## Why this audit exists
The account currently contains multiple Atlas-related Vercel projects and many deployments. Some may be:
- true duplicates;
- preview/lab/staging experiments;
- historical foundations;
- abandoned compile tests;
- branches/deployments created automatically from GitHub;
- direct/agent-driven Vercel-only work;
- unique work not yet recovered to GitHub;
- safe-to-delete deployment copies once source integrity is proven.

The objective is to recover source integrity and reduce storage without deleting unique implementation history.

## Vercel account inventory observed 12 Sep 2026
Team: `ukeydarsh-2051's projects`  
Team ID: `team_82G0YS5CSlKdabFzFBgLUj3r`

Atlas-related projects currently visible include:

1. `logistic_atlas_v2`
   - Project ID: `prj_zoyyLeFrvLKHFU8Unzq3Cr8zWDc0`
   - GitHub-linked to `Darshan-ukey/Supply-chain-and-logistic-atlas`
   - Current metadata domains observed include `scoperationsintelligence.vercel.app` and `logisticatlasv2...`
   - Classification: `UNCLASSIFIED_ACTIVE_BUILD_PROJECT`
   - Do not assume this is the Aug 23/25 foundation.

2. `supply-chain-atlas-stable`
   - Project ID: `prj_55NW2WX6uUJUIFQiGkCnKeamLHCt`
   - No GitHub link shown by project listing
   - Domain observed: `supply-chain-atlas-stable.vercel.app`
   - Classification: `UNCLASSIFIED`

3. `supply-chain-atlas-lab`
   - Project ID: `prj_nGwhhmGv8q8gS6vyRzOprBhqTZQm`
   - No GitHub link shown by project listing
   - Domain observed: `supply-chain-atlas-lab.vercel.app`
   - Classification: `UNCLASSIFIED_LAB_CANDIDATE`

4. `sc-and-logistics-atlas-intelligence-v0`
   - Project ID: `prj_LzA4amX6vI7KfGFgZ16LVv5OXLFp`
   - Domain observed: `sc-and-logistics-atlas-intelligence.vercel.app`
   - Classification: `UNCLASSIFIED_HISTORICAL_CANDIDATE`

5. `atlas-intelligence-v0.6.1`
   - Project ID: `prj_b8tjr188wT4044p9g0SZuMzIZ4Qb`
   - Domain observed: `atlas-intelligence-v061.vercel.app`
   - Classification: `UNCLASSIFIED_HISTORICAL_CANDIDATE`

6. `atlas-intelligence-v0`
   - Project ID: `prj_F181CWtauq0Qrc4GmPRoJO11hVsG`
   - Classification: `UNCLASSIFIED_HISTORICAL_CANDIDATE`

7. `logistics_atlas1.0`
   - Project ID: `prj_rOw8qi3vnUY2YeCa6jXOK0d3GRVj`
   - Domain observed: `logisticsatlas10.vercel.app`
   - Classification: `UNCLASSIFIED_HISTORICAL_CANDIDATE`

8. `atlas-intelligence-v05-compile-test`
   - Project ID: `prj_HnBFRmSpydMevZ9HqbZKV4e0w8Uq`
   - Classification: `UNCLASSIFIED_COMPILE_TEST_CANDIDATE`

The exact Vercel project/deployment currently backing `supplychainatlas.vercel.app` is not yet proven by the connected project metadata and must be resolved independently.

## Protected foundation rule
Until forensic verification completes:

### `supplychainatlas.vercel.app`
Classification: `OWNER_DESIGNATED_FOUNDATION__DO_NOT_DELETE__EVENTUAL_UPGRADE_TARGET`

Required treatment:
- preserve as rollback/reference foundation;
- identify exact Vercel project/deployment ID;
- identify exact source package/commit if recoverable;
- compare content/hash/feature set with GitHub Aug 23/25 state;
- do not mutate directly in Vercel;
- future update must come from a controlled GitHub-backed release after demo/full-state audit.

## Required disposition classes for every other project/deployment
Every Atlas-related Vercel project and significant deployment must ultimately receive exactly one disposition:

- `FOUNDATION_KEEP` — owner-designated foundation / rollback state.
- `ACTIVE_BUILD_KEEP` — required for controlled current work.
- `UNIQUE_RECOVERY_REQUIRED` — contains work not reproducibly present in GitHub; recover first.
- `HISTORICAL_KEEP` — intentionally retained historical evidence/reference.
- `DUPLICATE_SAFE_TO_DELETE` — content/source proven duplicate of governed GitHub state or retained deployment.
- `OBSOLETE_SAFE_TO_DELETE` — superseded and no unique content/dependency remains.
- `TEMPORARY_PREVIEW_SAFE_TO_DELETE` — preview artifact with source reproducibly retained elsewhere.
- `UNKNOWN_BLOCK_DELETE` — insufficient evidence to decide.

No deletion is permitted while classification is `UNCLASSIFIED` or `UNKNOWN_BLOCK_DELETE`.

## Verification required before deletion
For each project/deployment, capture at minimum:
1. project ID and deployment ID(s);
2. creation/update/deployment timestamps;
3. domains/aliases;
4. Git branch/commit/source linkage where available;
5. whether source exists in GitHub and at what SHA;
6. file/build output similarity versus retained/foundation versions;
7. environment variables / external backend dependencies relevant to reproducibility;
8. whether Supabase/schema/data expectations differ;
9. unique UI/features/data assets not found elsewhere;
10. storage contribution where obtainable;
11. rollback/recovery value;
12. proposed disposition and evidence supporting it.

## Deletion gate
A project/deployment can be proposed for deletion only when all are true:
- exact source/content lineage is known;
- no Vercel-only implementation needs recovery;
- no unique backend/schema/config dependency would be lost;
- retained GitHub/Drive custody is sufficient to reproduce needed behavior;
- foundation and rollback paths remain intact;
- deletion candidate is listed in a reviewed disposition manifest;
- Owner explicitly approves the deletion batch.

## Relationship to D2.0.0
D2.0.0 must now include two distinct environment tasks:

### A. Foundation identification
Resolve the exact Vercel project/deployment backing `supplychainatlas.vercel.app` and freeze its current state as the protected Aug 23/25 foundation.

### B. Vercel estate forensic inventory
Inventory all other Atlas projects/deployments and classify them without deleting anything during the demo build.

The Monday demo may use a controlled preview/release branch, but must not destroy or replace the protected foundation until D2.0.6 passes and D2.0.7 Owner promotion is authorized.

## Long-term intended deployment model
After cleanup:

`GitHub canonical source → controlled tested release → single intended Atlas production project/domain`

Vercel remains deployment/runtime only. It must not become an alternative source-of-truth/version-history system.

Preview deployments may exist for controlled validation, but automated/uncontrolled deployment fan-out must be minimized and periodically cleaned under this audit policy.
