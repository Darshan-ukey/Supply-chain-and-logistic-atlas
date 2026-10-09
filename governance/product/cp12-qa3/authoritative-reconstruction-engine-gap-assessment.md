# Atlas authoritative-source reconstruction engine — evidence-based gap assessment (2026-10-09)

**Status: ASSESSED / IMPLEMENTATION NOT AUTHORIZED.** Scope is architecture-to-implementation gap assessment only. No product, database or frozen-asset mutation.

## Owner acceptance model
Authoritative sources -> independent research/acquisition -> claim/evidence extraction -> canonical normalization and governance -> persisted backend -> deterministic Universe/Daughter projection -> **independent semantic comparison** to Universe V7.3 and intended Road LTL V1.5 / Ocean V0.6 benchmark. HTML is a **reference output and parity oracle only**, never an acquisition/normalization input. Gap remediation traces to source discovery, research, normalization, persistence or generation. Malkom consumes governed backend contracts, not HTML.

## Inspected evidence
1. Live connected Supabase project `aaoyesktlzhaunqqjhdq` (`ACTIVE_HEALTHY`): `public` tables `atlas_evidence_sources`, `atlas_knowledge_entities`, `atlas_knowledge_relationships`, `atlas_knowledge_evidence_links`, `atlas_knowledge_generation_runs`, `atlas_generation_z5_outputs`, `atlas_knowledge_gaps`, `atlas_knowledge_gap_links` and relevant type registries exist, RLS enabled; **all reported 0 rows** at inspection. The project is identified by schema/table matches, not a separately confirmed deployment binding.
2. Read-only information_schema inspection confirms evidence-source authority class, evidence ref and content hash; knowledge entity canonical identity/version, module/version, semantic payload, status and generator run; claim-level evidence links with locator, support role and scope; generation run implementation identity, consumed knowledge manifest/hash, output manifest; output hashes. **Schema presence is not evidence of a functioning ingestion or projection pipeline.**
3. `FOUNDATION_HARDENING_V1.1_SOURCE_AUDIT.md` (historical GitHub record) reports 66 governed sources, 185 Page-0 references, data contract and validators, 71-destination registry and 2,130 synthetic processes, but explicitly lists **full source-native concept extraction/outside-in completeness** and **research approval** as open. Historical PASS is bounded to those reported tests, not independent authoritative-source regeneration.
4. `governance/product/s8-6-evidence/exact-qa.json` is an exact frozen RC certification, not a certificate for this engine or a backend-to-Universe V8 generation.
5. Owner clarification `governance/product/cp12-qa3/ca1-owner-asset-authority-clarification.md`: final intended reference assets Universe V7.3, Road LTL V1.5, Ocean V0.6; HTML pointers represent legacy integration drift.

## Mechanism-by-mechanism findings
| ID | Stage | Evidence | Classification | Closure evidence needed |
|---|---|---|---|---|
| AKR-01 | Authoritative source registry / governance | Historical 66-source registry and live `atlas_evidence_sources` schema | **RETAIN + TEST_REQUIRED** | Source inventory and authority/freshness/citation policy with real persisted records |
| AKR-02 | Independent research and source-native acquisition | Historical audit explicitly excludes full source-native concept extraction; no run demonstrated | **GAP — COMPOSE/EXTEND subject to repo code audit** | Source-native fetch/extract/claim/evidence run with zero HTML input |
| AKR-03 | Canonical normalization, synonym/relationship model | Entity/relationship schemas, contracts and historical validator evidence | **RETAIN + TEST_REQUIRED** | Actual source claims -> canonical objects, conflict/ambiguity resolution, validation and evidence links |
| AKR-04 | Backend persistence / governed snapshots | Supabase knowledge/evidence/run/output schemas exist, all 0 rows | **SCHEMA PRESENT / DATA & END-TO-END UNPROVEN** | Write/readback of non-sensitive approved research sample, immutable version manifest and reproducible lineage |
| AKR-05 | Universe/Daughter generation from backend | `atlas_knowledge_generation_runs` and `atlas_generation_z5_outputs` schemas exist, 0 rows; no executed output shown | **MECHANISM UNVERIFIED** | Deterministic generated UI/view from governed backend snapshot; zero HTML-source dependence |
| AKR-06 | V7.3 benchmark comparison | Historical HTML pointer diff exists; no source-independent semantic parity evidence | **GAP — ACCEPTANCE MECHANISM NOT SHOWN** | Concept/process/relationship/accuracy/traceability/depth benchmark; disagreements reviewed against sources, not blindly copied |
| AKR-07 | Gap diagnosis and closed-loop remediation | Knowledge gap tables exist; no persisted run demonstrated | **SCHEMA PRESENT / LOOP UNPROVEN** | Gap -> stage-specific root cause -> corrective research/normalization/persistence/generation -> rerun |
| AKR-08 | Executor-neutral consumption | Work decomposition/definition tables exist; no populated execution contract observed | **RETAIN + TEST_REQUIRED / LIVE HOST BLOCKED** | Same snapshot consumed by UI and Malkom adapter; live host QA separately gated |
| AKR-09 | Security, audit and reproducibility | Public tables report RLS enabled; run/hash columns exist | **PARTIAL / NOT SECURITY-CERTIFIED** | RLS policy/privilege inspection, source-license checks, full run replay, negative mutations and independent QA |

## Architecture conclusion
The **schema and earlier generic controls exist**. The **independent authoritative-source-to-backend-to-generated-Universe-to-semantic-parity closed loop is NOT DEMONSTRATED**. It would be incorrect to declare the entire engine absent or implemented. Classify as **COMPOSE/EXTEND existing architecture with targeted evidence and likely source-acquisition/parity implementation gaps** after inspecting relevant source code and frozen governance contracts.

## Proposed bounded proof sequence (no build authorization implied)
P0. Pin approved source set, authority rules, output schema, acceptance thresholds and HTML exclusion boundary.
P1. Execute one independently researched bounded Road LTL domain slice from original sources; capture source hashes, claims, citations and contradictions.
P2. Normalize and persist versioned entities/relationships/evidence; verify round-trip and immutable snapshot.
P3. Generate Universe and Daughter views solely from that backend snapshot; prove deterministic replay.
P4. Compare semantic coverage/correctness/depth against V7.3 and Road V1.5 (and later Ocean V0.6); independently adjudicate discrepancies against sources.
P5. Inject at least two mutations (source evidence omission, relationship/pointer or normalized concept corruption); verify fail-closed controls and remediation rerun.
P6. QA1–QA4 and owner gate; separately verify Malkom live adapter when host access available.

**Do not convert CP-12 CA-1 historical HTML identity proof into engine PASS.** Track the reconstruction engine as a distinct architectural obligation; preserve CP-12 release HOLD and frozen S8-6.
