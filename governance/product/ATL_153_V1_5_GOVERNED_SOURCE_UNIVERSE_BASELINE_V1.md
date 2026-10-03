# ATL-153 — Atlas v1.5 Governed Source/Universe Baseline for Bounded Generation

**Status:** v1.5 bounded capability contract and frozen demo baseline  
**Scope:** ATL-153 only  
**Sequence:** ATL-177  
**Successor for continuous refresh:** ATL-154 / v2

## 1. Purpose

Atlas v1.5 must generate Daughter/depth knowledge from an identifiable governed Source/Universe baseline, not from an unbounded or silently changing evidence pool. This contract freezes the exact repository baseline used by the v1.5 demo, defines how governed source identities are consumed, and constrains bounded gap research so new evidence can become a candidate without mutating frozen Universe truth.

## 2. Frozen v1.5 baseline identity

The v1.5 demo baseline is pinned to production source commit `f9b08a951ca823ff8c23b64044fe1a7abb9dde79`.

| Governed layer | Frozen identity / evidence | v1.5 use |
|---|---|---|
| Source Registry | `data/governance/source-registry-v1.json` at production commit above; registryId `atlas-source-registry-v1`; snapshotDate `2026-08-24` | Canonical source identity, issuer/version/status/scope, evidence URL, confidence/research state, registry scope |
| Source Registry counts | 66 unique governed sources; 51 Page-0 governed sources; 29 Road-LTL sources; 185 Page-0 reference placements; 17 authority domains | Demo baseline completeness identity; not a claim of universal external completeness |
| Universe / destination coverage | `data/governance/destination-coverage-registry-v1.json` at the same pinned commit | Governed destination/universe coverage state |
| Atlas module registry | `data/atlas-registry.json` at the same pinned commit | Active module identity and governed module resolution |
| Claim provenance | `data/provenance/road-ltl-claim-provenance-v1.json` at the same pinned commit | Material claim → source identity linkage and claim boundary |
| Foundation audit | `FOUNDATION_HARDENING_V1.1_SOURCE_AUDIT.md` at the same pinned commit | Confirms unified source/version/change/coverage/gap registries and records external/research gates |

A consumer MUST retain the pinned commit plus the registry/object identity used for generation. A later source release is not silently substituted into this baseline.

## 3. Governed read/query contract

For every material generated Daughter/depth claim, the generator MUST resolve evidence through governed identities. Minimum retained fields are:

- baseline commit;
- governed source ID(s);
- issuer/title/version or equivalent source identity;
- source status/research state/confidence when present;
- jurisdiction/mode/role/applicability scope when present;
- `supports` and `notSupports` boundaries when present;
- claim/evidence class and claim boundary when a provenance sidecar exists;
- generated object/page identity consuming the evidence.

Missing evidence identity is a gap state, not permission to fabricate provenance.

## 4. Provenance rule for material claims

A material claim is publishable as governed baseline-derived only when its source identity is resolvable in the frozen Source Registry or another explicitly pinned governed Atlas evidence object. Generated prose may compress evidence, but MUST NOT erase applicability limits, legal/operational scope, confidence, or a recorded `notSupports` boundary.

Atlas synthesis MUST remain distinguishable from source-native content. Where a provenance record says `ATLAS_SYNTHESIS`, generation must preserve that classification rather than presenting the synthesis as source-native language.

## 5. Bounded authoritative-source research for a selected gap

v1.5 MAY research one explicitly selected gap outside the frozen baseline. The transaction is bounded as follows:

1. identify the gap and affected Atlas object/claim;
2. record the frozen baseline and evidence already checked;
3. define the missing evidence question and scope;
4. consult authoritative/primary sources first; high-quality secondary evidence may support discovery but cannot silently replace an available primary authority;
5. capture source identity, URL/location, version/effective date where available, access date, applicability and conflicts;
6. state what the evidence supports and does not support;
7. create a **CANDIDATE** addition/change with provenance;
8. require governed review/promotion before it can become successor Universe truth.

If evidence is ambiguous, conflicting, unavailable, or outside the selected scope, the result remains unresolved/conditional. The generator fails closed on the unsupported claim.

## 6. Candidate-addition contract — no silent overwrite

Bounded research output is separate from frozen truth. Minimum candidate record:

```text
candidate_id
gap_id
target_object_or_claim_id
baseline_commit
candidate_source_identity
candidate_source_version_or_effective_date
provenance_location
access_date
supports
not_supports
applicability_scope
conflict_state
confidence
review_state = CANDIDATE
promotion_target
```

A candidate MUST NOT replace a Source Registry record, canonical Universe object, frozen module, or provenance record in place. Promotion requires a governed successor/versioning action outside the bounded generation transaction.

## 7. Terminology and synonym normalization

Generation may normalize terms only through a governed mapping/crosswalk already present in the pinned baseline or an explicitly governed successor mapping. Free-form semantic similarity is not authority to merge identities.

If no governed mapping exists:

- preserve the observed/source-native term;
- record the unmatched term as a gap/candidate mapping;
- do not collapse distinct shipment, consignment, handling-unit, document, equipment, party, location, process, rule, or other governed identities.

## 8. Source/gap state exposed to Admin / Inspector

For each material generated claim or selected research gap, Admin/Inspector must be able to recover at least:

- baseline identity;
- source/provenance identity;
- evidence class;
- scope/applicability boundary;
- confidence/research state where governed;
- state: `BASELINE_GOVERNED`, `CANDIDATE`, `CONDITIONAL`, `CONFLICT`, or `UNRESOLVED`;
- affected Atlas object/page;
- promotion/review requirement for non-baseline evidence.

This is an inspection contract for v1.5; it does not create continuous monitoring.

## 9. Fail-closed invariants

v1.5 MUST NOT:

- invent a source ID, version, applicability, authority, synonym, or provenance link;
- present a candidate as frozen/canonical truth;
- silently upgrade a source version;
- infer legal/regulatory applicability from mode name alone;
- remove a source's `notSupports` or claim-boundary limitation during generation;
- mutate frozen Universe truth as a side effect of bounded research;
- claim that the 66-source baseline is universally complete.

## 10. Explicit v1.5 STOP boundary

ATL-153 does **not** build:

- continuous source monitoring;
- scheduled/periodic source refresh;
- automatic external-version detection;
- semantic diff propagation;
- automated impact-graph regeneration from source change;
- automated Universe successor generation/promotion.

Those capabilities remain deferred to ATL-154/v2. The v1.5 baseline is intentionally stable and inspectable.

## 11. Handover / recovery contract

The v1.5 demo must retain:

1. exact baseline commit and governed object paths;
2. Source Registry identity/counts used;
3. generated claim → source/provenance identities;
4. bounded research outputs and candidate records, if any;
5. unresolved/conflicting gaps;
6. the explicit refresh limitation and ATL-154 successor reference.

This is sufficient to reconstruct what evidence v1.5 used without implying that the evidence was continuously refreshed.

## 12. Acceptance mapping

| ATL-153 requirement | Contract evidence |
|---|---|
| Read/query current governed source and Universe identities | Sections 2–3 |
| Retain provenance/source identity for material Daughter/depth claims | Sections 3–4 |
| Bounded authoritative-source research for selected gap | Section 5 |
| Governed terminology/synonym normalization only | Section 7 |
| Candidate additions without overwriting frozen truth | Section 6 |
| Expose source/gap state to Admin/Inspector | Section 8 |
| Freeze exact source/Universe baseline used by v1.5 demo | Section 2 |
| Preserve STOP boundary | Section 10 |
| Handover baseline/contracts/research/limitations | Section 11 |

## 13. Evidence notes

The pinned foundation audit records unified source/version/change/coverage/gap registries and explicitly leaves full source-native completeness and research approval for candidate additions outside that hardening. The Source Registry itself carries `noSilentVersionUpgrade: true`, source IDs, versions, applicability/scope and evidence locations. This ATL-153 contract binds those existing governed controls into the v1.5 bounded-generation path; it does not rewrite the underlying frozen registries.
