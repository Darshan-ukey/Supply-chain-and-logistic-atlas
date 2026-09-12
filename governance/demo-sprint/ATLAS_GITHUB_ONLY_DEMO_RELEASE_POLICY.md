# Atlas Demo — GitHub-Only Build and Release Policy

Status: OWNER_AUTHORIZED_STANDING_RULE  
Effective: 12 September 2026

## Owner direction
For the current Atlas V2 demo sprint:

- **Do not deploy, promote, preview, or otherwise make any demo build live on Vercel.**
- Do not use Vercel as a working surface for the demo build.
- All demo implementation changes must be committed to GitHub only.
- Use one explicit demo implementation branch: `atlas-v2-demo-2026-09-14`.
- That branch is based on `main` and is the only branch authorized for demo feature implementation unless the Owner explicitly changes this rule.
- Tomorrow, after D2.0.6 audit/certification and Owner approval, the demo branch may be merged to `main`.
- **Merge to `main` is not authorization to deploy Vercel.** Any Vercel deployment or update to `supplychainatlas.vercel.app` requires a separate later Owner instruction.

## Branch roles
- `main` — integration destination / eventual canonical application branch after Owner-approved merge.
- `atlas-v2-demo-2026-09-14` — sole active demo implementation branch.
- `atlas-governance-registry-v2.1` — governance/authorization/decision state; not the feature implementation branch.
- architecture, recovery, presentation, backup and historical branches remain reference/history unless explicitly brought into the demo through a governed cherry-pick/merge or asset copy with lineage.

## Build discipline
1. Audit source asset/branch before reusing anything.
2. Bring required assets into the demo branch through traceable Git history or explicit governed copy.
3. Build only on `atlas-v2-demo-2026-09-14`.
4. Run PRE/MID/POST audits against the full repository state.
5. Create full-state freeze evidence at each passed stage.
6. D2.0.6 produces the certified demo release candidate **in GitHub only**.
7. D2.0.7 means Owner-approved merge of the certified demo branch to `main`.
8. `ATLAS_V2_DEMO_GO_LIVE` is suspended/renamed conceptually for this sprint: there is no Vercel go-live action under current authorization.

## Vercel prohibition
Until the Owner gives a new explicit instruction, executors must not:
- call Vercel deployment actions;
- trigger a production promotion;
- create a preview intentionally for this sprint;
- alter domain assignments;
- delete Vercel projects/deployments;
- change Vercel environment configuration;
- treat a GitHub merge as implicit deployment approval.

Vercel access is read-only for forensic inventory/audit purposes.

## Existing Vercel estate
`supplychainatlas.vercel.app` is the Owner-designated Aug 23/25 foundation and eventual upgrade target. Other Atlas-related Vercel projects/deployments remain unclassified until audited for unique content, duplicates, recoverability and safe deletion. No deletion is authorized by this policy.

## Stop rule
If GitHub/Vercel integration would automatically deploy a branch or `main` merge, stop before merge/push that would trigger deployment and report the risk. The Owner must explicitly decide how to prevent or accept that automation before any live effect is allowed.
