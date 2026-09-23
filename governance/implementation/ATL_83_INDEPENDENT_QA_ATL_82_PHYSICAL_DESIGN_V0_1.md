# ATL-83 — Independent QA: ATL-82 Physical DDL/Migration Design V0.1

**Task:** ATL-83 / logical ATL-82B
**Reviewer:** Claude, independent of the ATL-82 builder (ChatGPT)
**Date:** 2026-09-23

**Artifact under QA:** `governance/implementation/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_1.sql`, blob `b16a4bd9b16763287a76574e7231695b2c271f2e`, unchanged since `5fe4c63`. It was reviewed together with rationale V0.2 (`033d5819…`) and first-party proof V0.2 (`745dcee3…`).

**Governing inputs** (each verified against its pinned blob):
- ATL-60 logical design `eba2a510…` and schema mapping `00d5c154…`;
- the Transformer Contract `7e166945…`, on `atlas-governance-execution-readiness-contract-v1`;
- the ATL-80 seed pack `50bb54cb…`;
- ATL-86 reconciliation and the ATL-90 QA plus recheck;
- the Continuity Standard as amended by ATL-91.

**State checked:**
- GitHub `atlas-governance-registry-v2.1` @ `353a40c411f17029ac10aafce8ba13d52f41c895`, fetched fresh at start and end;
- live Supabase `aaoyesktlzhaunqqjhdq`, read-only;
- a disposable local PostgreSQL 16.13 test cluster, which is not Supabase.

**Executable evidence** (target paths, to be landed):
- `governance/implementation/ATL_83_EXECUTABLE_TEST_PACK_V0_1.sh`, blob `4ef23709a52483ec667f2bf8712e23d73a64bcc2`;
- `governance/implementation/ATL_83_TEST_PACK_OUTPUT_V0_1.txt`, blob `ab0d0be839efb3d746a33e923719b67a8e4db2a4`.

**Independent verification of this report:** before delivery, a separate agent that had not seen the QA reasoning checked every factual claim against the raw evidence. It confirmed the core findings (all blob hashes, every test result relied on, all section citations) and found one wrong claim, several overstatements and mis-citations. All of these are corrected in this version.

## Disposition: **FAIL as written. Architecture sound; correctable.**

The candidate as written cannot be approved. Its architecture holds:
- a stable kernel with versioned type registries;
- exact composite type/version pins;
- a generation-run lineage anchor;
- an additive Z5 bridge.

The four criteria that exercise that architecture pass.

Six of the ten predetermined criteria are **not satisfied as written**: 1, 3, 4, 5, 6 and 7.

The ATL-82 first-party proofs (V0.1 and V0.2) marked all ten PASS. Two of those passes carried explicit deferrals: criterion 5 was "PASS at identity/version model only" and criterion 7 was "PASS candidate". Of this QA's six failures:
- four are shown by execution (3, 4, 5, 7);
- 1 and 6 fail by comparing the SQL with the logical model, with execution evidence for part of each.

Six binding corrections are specified exactly: C1–C4, C7 and C8. Reference DDL for each is proven effective in the test pack, and none alters any existing live table.

Two further binding corrections, C5 and C6 (the Z6 readiness tables), cannot be fixed in form by QA alone. They depend on **Owner decision D1** (§5).

Re-QA after correction should be bounded: the corrections plus a full re-run of the test pack as regression.

## 1. Method

1. **Contract reading.** I compared the raw SQL with the ATL-60 logical model, the Transformer Contract and the ATL-80 pack, not with the builder's rationale or proof.
2. **Live read-only facts.** For the existing tables I read:
   - columns, primary keys, RLS flags, policy counts and grants;
   - `pg_default_acl`, functions, triggers and available extensions;
   - the P6.1 and P6.2 migrations' own protection statements, on `atlas-presentation-architecture-v1-p6-2`.
3. **Execution.** The exact pinned SQL was run in a disposable PostgreSQL 16.13 cluster whose harness mirrors live Supabase:
   - The live default ACL grants ALL on new public tables to `anon`, `authenticated` and `service_role`. On PG16 that is `arwdDxt`; live PG17 adds MAINTAIN (`m`).
   - The harness also includes stubs of the existing tables with their live primary-key shapes.

The test pack has four phases, each in its own fresh database:

| Phase | What it does |
|---|---|
| **PHASE-1** | Runs the candidate as written. |
| **PHASE-2** | Runs defect probes against a committed copy. |
| **PHASE-3** | Applies the reference corrections, then runs post-correction and regression tests. |
| **PHASE-4** | Drops every new structure in reverse dependency order and checks that protected stub rows survive. Then rebuilds. |

The pack refuses to run unless `ATL83_DISPOSABLE=1` is set and the host is local. It also rejects Supabase hosts.

**Limits of the evidence.**
- The engines are PG16 and PG17. Every feature used is supported in both: composite FKs, `NULLS NOT DISTINCT` (PG15+), identity columns, row and statement triggers, and RLS.
- The only privilege difference between the two engines is MAINTAIN.
- Roles and privileges are mirrored from the live catalogue, not taken from the real Supabase stack.
- The TRUNCATE exposure in C1 is a database-privilege fact. PostgREST does not issue TRUNCATE, so this is a defense-in-depth deviation from the established protected pattern, not a demonstrated Data API exploit.

## 2. Criterion-by-criterion result

| # | ATL-82 acceptance criterion | Result | Evidence and correction |
|---|---|---|---|
| 1 | Faithful to the validated logical model; no LTL/BOL universalization | **FAIL** | No LTL/BOL identifiers or enums: PASS. Logical requirements not implemented: the ATL-60 §4 source-class option (C4), the §5 gap linkage (C7), §6.1 `scope_ref` and `requested_level` (C5), and the §6.2 readiness-evidence fields (C6). |
| 2 | Exact composite type/version and knowledge/version identity | **PASS** | T3a rejects an entity pinned to the non-existent `ET-TEST@9.9.9`. T3c rejects a half-key evidence link. T6 blocks deleting a type version that knowledge pins. |
| 3 | Mechanical Z0/Z1/Z2/Z5/Z6 boundaries and research-vs-client classification | **FAIL** | T4c: the same source (`DOC-123`) is accepted as both `AUTHORITATIVE_RESEARCH` and `CLIENT_PROVIDED` (C4). T4e: an `ENTERPRISE_EXECUTION_READY` run is accepted with no client or workspace scope (C5). |
| 4 | Referential integrity and controlled lifecycle/readiness/support vocabularies | **FAIL** | The declared vocabularies are check constraints in the SQL; T3d exercises the readiness one. But relationships have **no lifecycle column** (T4d: 0), so a generated relationship cannot be marked CANDIDATE (C3). Gaps have no FK path to knowledge (T4g: 0) (C7). |
| 5 | Append-only, versioned semantic history | **FAIL** | T4a: a pinned type's `schema_contract` is rewritten in place, and the read-back shows the new contract. T4b: a knowledge `definition` is rewritten in place, and the read-back shows `silently rewritten`. T6: an unpinned ACTIVE type row is deleted. Enforcement was deferred to QA as open question 1; decided in Q1 (C2). |
| 6 | Explicit Z1→Z5 and Z6 lineage | **FAIL** | Z1→Z5: a bridge row with `output_hash` null, targeting a WorkDefinition with 0 rows, is accepted (T4f) (C8, R1). Z6: run-level lineage exists (`knowledge_generation_run_id` NOT NULL FK, `input_manifest`, `input_manifest_hash`). The per-requirement links to the exact knowledge, bindings and Z5 artifacts assessed (ATL-60 §6.2) are gone (C6). |
| 7 | RLS/access controls fit for protected execution IP | **FAIL** | RLS works for rows: `authenticated` sees 0 of 2 rows (T5). But all 9 tables grant `anon` and `authenticated` DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE (T2a). `authenticated` **TRUNCATEd the evidence-link table from 2 rows to 0** (T5). The protected pattern revokes all browser-role privileges: P6.1 migration lines 26–27 and P6.2 lines 49–52, confirmed by the live grant read (C1). |
| 8 | Rollback/rebuild path, verifiable without mutation | **PASS** (design level) | PHASE-1: the pinned SQL compiles, and ROLLBACK leaves 0 tables. PHASE-4: the corrected structures drop one by one in reverse dependency order. Protected stub rows survive (1 and 1), and the rebuild restores 11 structures and 18 guard triggers. Pre-application conditions are in §6. |
| 9 | Compatible with the existing Atlas schema and protected P6.1/P6.2 tables | **PASS** | No name collisions and no alteration of existing tables (ATL-90 criteria 1 and 8, re-confirmed live). Compiles beside live-shaped stubs. The access-pattern deviation is counted under criterion 7. |
| 10 | No canonical data materialization or Supabase mutation | **PASS** | No INSERT, UPDATE or DELETE statements. Ends in ROLLBACK. Live state unchanged (§8). |

## 3. The seven physical-design checks

**Q1 — Database-enforced append-only before first materialization? YES, binding (C2).**
- **Why DB-level.** Governance-only enforcement depends on every writer, and in this workflow the agents themselves hold service-role SQL access. No existing Atlas append-only mechanism exists to reuse: the protected P6 tables have no triggers (live `pg_trigger`).
- **The reference guard.** A single trigger function, `atlas_guard_append_only(<mutable columns>)`:
  - makes every column immutable except an allowlist per table: `status` on the type registries, `lifecycle_status` and `updated_at` on entities, `lifecycle_status` on relationships, `run_status` on generation runs, and nothing on links, sources and bridge rows;
  - rejects DELETE;
  - rejects TRUNCATE at statement level.
- **Test results.** Promotion still works (P-C2a, P-C2f). In-place edits fail with "create a successor version" (P-C2b, P-C2c, P-C2f). DELETE and even owner TRUNCATE are rejected (P-C2d, P-C2e).
- **Bypass.** It now needs deliberate privileged action: dropping or disabling the trigger, or a privileged session setting, not an ordinary write. Recommendation: the governing standard should require any such action to go through `apply_migration`, so it is recorded.

**Q2 — Which existing capability/RLS pattern? The P6.1/P6.2 protected-IP pattern, with one extra step (C1).**
- **Live state.** Both protected tables have RLS on, no policies, and no `anon`/`authenticated` grants.
- **Migrations.** The P6.1 migration (lines 26–27) and the P6.2 migration (lines 49–52) each state `revoke all … from anon, authenticated; grant select, insert, update, delete … to service_role`. P6.2 adds the comment "Reads are served only through the capability-gated server API using the service role". That capability-gated server API is the existing pattern to reuse.
- **What doesn't fit.** Workspace-membership policies suit client tables, not global Z1 knowledge.
- **The extra step.** ATL-82 should also revoke TRUNCATE from `service_role`; the P6 migrations do not.
- **Audit.** The existing audit trigger `atlas_record_change()` is not reusable: it reads `NEW.workspace_id` and `NEW.id::uuid`, which the ATL-82 tables do not have (R3).

**Q3 — Is link-level source class enough? NO, binding (C4).**
- **Why not.** Classification belongs to the source, not to each citation. T4c shows two links giving one source contradictory classes.
- **What ATL-60 §4 required.** Either (a) source class on the evidence substrate or (b) a separate Mechanism-1 path. The candidate did neither.
- **Why it matters live.** Every existing evidence table (`atlas_evidence_files`, `atlas_client_documents`, `atlas_document_chunks`) has `workspace_id` NOT NULL. Global authoritative research therefore has **no substrate**, only free-text `evidence_ref`.
- **The reference fix.** An `atlas_evidence_sources` registry that closes both gaps:
  - one class per `(kind, ref)`;
  - `CLIENT_PROVIDED` requires a workspace, and `AUTHORITATIVE_RESEARCH` forbids one;
  - links reference `source_id`.

  Tested by P-C4a to P-C4d.

**Q4 — Z5 bridge FKs? Now feasible (R1, recommended); hash binding (C8).**
- **Why feasible.** The live primary keys are single text columns: `atlas_work_decompositions(decomposition_id)` and `atlas_work_definitions(work_definition_id)`.
- **The fix.** Type-specific nullable FK columns plus a kind/target check prevent dangling lineage (P-R1a, P-R1b).
- **Version pinning.** The P6 keys exclude version, so the FK proves existence. `output_version` plus a non-null `output_hash` pin identity.

**Q5 — DB-level JSON-Schema validation? Not required before first materialization (R2).**
- **What stays mandatory.** Generator write-time validation, recorded in the Generation Registry.
- **The extension option.** `pg_jsonschema` 0.3.3 is available but not installed, and enabling it is itself a governed change.
- **Recommended now.** Cheap structural checks: `jsonb_typeof(…) = 'object'` on `applicability`, `semantic_payload`, `schema_contract` and `claim_scope`.

**Q6 — Seed FR-02 relationship types before the first Z2/gap edge? Partly, and FR-02 needs revision.**
- **The constraint.** Both endpoints of `atlas_knowledge_relationships` must be `atlas_knowledge_entities`.
- **`HAS_KNOWLEDGE_GAP` therefore cannot be a relationship type.** Gaps live in `atlas_knowledge_gaps` and are not entities. The C7 junction is the correct carrier, and FR-02 should drop this type.
- **`REQUIRES_CLIENT_BINDING` / `REQUIRES_MASTER_DATA` work only one way.** The binding requirement must be modelled as a Z1 entity (a declaration that a binding is needed, never its Z2 value). That entity type and both relationship types need governed contracts before the first Z2-boundary row.
- **Not a DDL blocker.**

**Q7 — Does the governance registry point operators away from the Sep-1/Sep-2 DDL? PASS.**
- `ASSET_REGISTER.json` is unchanged since `608598d`. Both `executionGuards` are present, and the frozen P6.1/P6.2 successors are `current: true`.
- Adjacent gap: the AR0.3 readiness contract and resolver have no registry entry (R5).

## 4. Binding corrections

The SQL for C1–C4, C7, C8 and R1 is a **QA reference only**, embedded in the test pack's PHASE-3. The builder owns the corrected candidate and may implement differently if the same PHASE-3 behaviour results. None of the corrections alters an existing live table. C4 restructures the candidate's own evidence-link table, and C8 tightens a candidate column.

| ID | Correction | Criteria | Proven by |
|---|---|---|---|
| **C1** | `revoke all` on every new table from `anon, authenticated, service_role`; `grant select, insert, update, delete` to `service_role`; RLS on any added tables; revoke EXECUTE on the guard function from `public, anon, authenticated`. | 7 | P-C1a to P-C1d |
| **C2** | Database append-only guard on all semantic, lineage and provenance tables: column allowlist on UPDATE, DELETE rejection, statement-level TRUNCATE rejection. | 5 | P-C2a to P-C2f |
| **C3** | Add `lifecycle_status` (CANDIDATE…DEPRECATED, default CANDIDATE) to `atlas_knowledge_relationships`. This is also an **ATL-60 logical-design erratum**: the logical model omitted it, and Claude's own ATL-60 QA (F1–F6) missed it. The Transformer Contract §3 says every generated output begins as CANDIDATE and cannot self-promote. | 4 (and 1) | P-C3 |
| **C4** | Add an `atlas_evidence_sources` registry: class, kind, ref, `workspace_id`, `authority_class`, hash, unique `(kind, ref)`, and the client/research scope checks. Evidence links reference `source_id` NOT NULL; the source-level fields move off the link. | 1, 3 | P-C4a to P-C4d |
| **C5** | Readiness runs must carry the **requested** level (`requested_level`, missing; the evaluated level already exists as `readiness_state`) and the scope identity (`scope_ref`, missing). For ENTERPRISE and RUNTIME, they must also carry the enterprise/workspace scope. The Constitution §6 defines ENTERPRISE readiness as: "All mandatory enterprise/client bindings, mappings, authorities, policies, thresholds and operating constraints required for the scope are resolved or explicitly governed as not applicable." **Form depends on D1.** | 1, 3, 6 | T4e |
| **C6** | Readiness evidence must restore the per-requirement fields from ATL-60 §6.2: requirement key and type, status, blocker class, knowledge / binding / Work Decomposition / WorkDefinition refs, and a content hash. The candidate collapses these into `evidence_kind` / `evidence_ref` / `evidence_payload` (SQL lines 165–175). **Form depends on D1.** | 1, 6 | contract comparison |
| **C7** | Add an `atlas_knowledge_gap_links` junction: FK to `atlas_knowledge_gaps(id)`, exactly one target entity or relationship by composite FK, and `unique nulls not distinct`. This satisfies ATL-60 §5 without altering the existing gaps table. | 1, 4 | P-C7a |
| **C8** | Make `atlas_generation_z5_outputs.output_hash` NOT NULL (ATL-60 §7: "immutable output identity/hash"). | 6 | P-C8 |

The PHASE-3 regression block confirms the original passing controls still hold after the corrections: type pinning, the link target check and the readiness vocabulary.

## 5. Owner decision D1: Z6 readiness tables versus AR0.3

**The resolver.** The implemented AR0.3 resolver is on `atlas-architecture-ar0-3-readiness-resolver` @ `d938a44`: `lib/readiness/readiness-resolver.mjs`, `RESOLVER_IMPLEMENTATION_VERSION = '2.0.0'`, ruleset `readiness-ruleset-v1`. AR0.3 closure was QA'd under ATL-5.

**The contract.** `governance/architecture-refinement/AR0.3/READINESS_VERIFICATION_CONTRACT_DRAFT_V1.md` (blob `653a07eb…`) has been **on `atlas-governance-registry-v2.1` itself since `425729d` (2026-09-16)**, six days before ATL-82's SQL commit. It is headed "independently verified specification candidate — not Owner-frozen".

**Its `ReadinessResult` shape.** The contract's result has `proof_id`, `scope_id`, `scope_version`, `state_evaluated`, `result` (READY / NOT_READY / BLOCKED / NOT_APPLICABLE), `blockers[]`, `dependency_chain`, `predecessor_proofs`, `rule_evaluations`, `monotonicity_check`, `semantic_result_hash`, and an identity block including ruleset, `configuration_hash` and `input_manifest_hash`. Resolver 2.0.0 emits only READY, NOT_READY and BLOCKED; NOT_APPLICABLE exists only as item-level waivers.

**ATL-82's fit with it.**

| Result field | ATL-82 readiness tables |
|---|---|
| `state_evaluated` | Counterpart exists: `readiness_state`. |
| `blockers` | Counterpart exists: `blocker_manifest`, as jsonb. |
| `input_manifest_hash` | Counterpart exists: `input_manifest_hash`. |
| READY / NOT_READY / BLOCKED result, as distinct from the state | **No column.** |
| scope ID and version | **No column.** |
| semantic result hash | **No column.** |
| ruleset and configuration identity | **No column.** |
| predecessor proof linkage | **No column.** |
| rule evaluations | **No column.** |

The missing fields could only go into an untyped `result_payload`.

**Governance context.**
- The Owner-authorized `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1` §7 places the Supabase canonical store "subject to AR0.3 schema/security design".
- Neither ATL-60 nor ATL-82 cites AR0.3. This is a **same-branch pickup omission**: the contract was on the branch ATL-82 was built from.
- It is the second material pickup omission in ATL-82, after the P6.2 lineage found by ATL-86.
- The resolver also refuses every real governed scope (`UPSTREAM_CONTRACTS_UNFROZEN`, R-VAL-018) until the Z1–Z5 contracts are frozen, so Z6 tables would have **no producer** until then.

**Option A — split and defer (recommended).**
- ATL-82 proceeds with the Z1 kernel, registries, provenance and Z1→Z5 lineage, corrected by C1–C4, C7 and C8.
- `atlas_readiness_runs` and `atlas_readiness_evidence` move to a new Linear task. Its governing inputs are the AR0.3 `ReadinessResult` contract and the resolver identity. It is blocked until the resolver can evaluate a real scope.
- This avoids rework and avoids building tables with no consumer.

**Option B — keep them in ATL-82.**
- Bind the AR0.3 contract and resolver identity as ATL-82 governing inputs.
- Redesign both tables to persist `ReadinessResult` losslessly. C5 and C6 then take that form.

Either way, Continuity Standard §11.3 item 9 (as amended by ATL-91) applies. The ATL-82, ATL-83 and ATL-60 manifests and Linear must be synchronized in the same change set that records the decision.

## 6. Non-binding recommendations and pre-application conditions

- **R1:** Z5 bridge type-specific FKs, as in Q4. Tested.
- **R2:** JSON structural checks, as in Q5.
- **R3:** audit status and lifecycle transitions.
  - `atlas_record_change()` can't be used here: it needs `workspace_id` and a UUID `id`.
  - C2 blocks semantic change, but status promotions are still unaudited. Consider a transition-history table.
- **R4:** add a `generation_registry_ref` on `atlas_knowledge_generation_runs`, pointing to the GitHub-hosted Generation Registry entry (Freeze Standard §7 and §8).
  - The table covers only part of the §8 minimum record. Environment identity, QA result, canonical/derived class, custody and rebuild result are absent.
- **R5:** register the AR0.3 readiness contract and resolver identity in `ASSET_REGISTER.json`.
  - It currently has no AR0.3 entry.
  - The registry is how operators find authoritative current assets, and a missing entry makes them easy to miss.
- **R6 (mechanism):** first-party DDL proofs should include executable behaviour tests on a disposable Postgres, not only structural checks. This test pack is reusable for that.
- **R7:** forward compatibility with ATL-87 (client-observed knowledge). With C4, a new source class is a single constraint change on one registry.

**Pre-application conditions (criterion 8).** Before any `apply_migration` authorization, all of the following are required:
- an executable down-migration;
- a rebuild proof from frozen Generation Registry inputs;
- a clean run of the corrected candidate through this test pack.

## 7. Adjacent finding for the Owner (outside ATL-83 scope, not binding here)

**D2 — the protected P6.1/P6.2 tables have no guard against `service_role` TRUNCATE, DELETE or UPDATE.**
- Live grants give `service_role` DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE on both tables.
- Neither table has any trigger.
- The single P6.1 row, whose recoverability is already documented as defect B, can be removed or rewritten by any service-role session with no audit record.

Applying the C1/C2 pattern there would touch protected structures, so it needs its own Linear task and Owner authorization.

## 8. Mutation statement

No Supabase mutation, migration, DDL, `execute_sql` write, branch operation or GitHub write was performed.

Live Supabase at the end of this QA:
- latest migration `20260908015858`;
- `atlas_work_decompositions` = 1 and `atlas_work_definitions` = 0;
- 20 public tables;
- 0 ATL-82 or correction tables.

All DDL in this QA ran only inside the disposable local PostgreSQL test cluster.
