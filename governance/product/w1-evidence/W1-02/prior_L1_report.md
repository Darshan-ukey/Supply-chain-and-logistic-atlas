# Universe V7.3 fitness assessment - L1 structural integrity (full population, scripted, read-only)
Artifact: Supply-Chain-Logistics-Universe-V7.3.html (standalone), SHA-256 31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd, git blob 27695e6e, repo commit e5f5029. Data extracted by evaluating the file's own embedded literals in a sandbox (no edits, no import). Status: INTERIM, assessor Claude, ChatGPT challenge pending.

## Counts reconcile to the package manifest (FROZEN_RELEASE_MANIFEST.json integrity block)
| Item | Manifest | Extracted | Result |
|---|---|---|---|
| Core domains / conditional / rails | 8 / 1 / 6 | 8 / 1 / 6 (15 domains) | match |
| Enterprise lenses | 27 | 27 | match |
| Business cycles | 9 | 9 | match |
| Navigator entries (planned) | 71 (67) | 71 (6 families) | match |
| Context resolver rules | 51 | 51 | match |
| Governed source records | 67 | 67 | match |
| Reference placements | 192 | 192 (17 groups) | match |
| First-class entities | 265 | 78 systems + 128 objects + 11 actors + 9 events + 19 documents + 20 process relationships = 265 | match |
| Relationship types | 30 | 30 | match |
| Directional exchanges | 36 | 36 | match |
| Authority rules | 12 (authorityDomainCount 17) | 12 rules | 17 not reproduced; label unclear (open) |
| Contract/service contexts | 5 | 6 (incl. 'contract-unresolved') | explained difference |

## Identity and integrity checks
- No duplicate IDs inside any registry. 12 cross-registry ID reuses, all roleProfiles/models (same actor keys used twice) and 'warehouse' (domain id vs role key): by design, but 'warehouse' is one string for a domain and a role.
- No broken references: lens/cycle -> domain, source, system, object, cycle; authority -> system/object; context rules -> modes; mode relevance -> domains. All resolve.
- All 20 process relationships use types in the 30-type vocabulary. 2 have an endpoint that is not a domain (an event; an object): intended mixed-type edges.
- Objects: 128/128 carry aliases; 0 alias collisions across objects; 0 non-atomic names.
- "344 declared IDs" is a REGEX COUNT of `{id:'...'` literals in the HTML (349 literals, 344-345 distinct), not an ontology measure. It must not be used as an acceptance threshold. The meaningful registry counts are the table above.

## Findings (to be classified; not yet scored)
F1 Embedded version metadata still says id 'supply-chain-logistics-universe-v7.2', version 7.2.0, release 2026-08-30, correctionCycle V7_1_TO_V7_2, while the file/package/manifest are V7.3. Machine-readable identity inside the frozen artifact is stale. Import must take identity from the manifest, not the embedded block. Frozen file must not be edited.
F2 Source tagging is NOT record-level for the entity registry. Domains, lenses and cycles carry source references; systems (78), objects (128), actors (11), events (9), documents (19) and process relationships (20) carry only id/code/name/aliases (+description/domains). Provenance for them exists only indirectly (domain/lens/cycle, authority rules, exchange 'basis', object tree). The statement that every item carries a source tag is not true of the entity registry.
F3 Domain->source links use family keys (e.g. 'gs1' -> 5 source records, 'dcsa' -> 10, 'uncefact' -> 3), and 4 keys resolve to no source record (apqcFinance x2, otif, uncitral). Source Watch can map a changed source to domains/families, not to entities.
F4 5 of 67 governed sources are referenced by no record (unedifact-d25a, gs1-cbv, iata-one-record, iata-cargo, hague-visby); 37 of 67 are not referenced by any domain/lens/cycle (some are used by exchanges/context rules).
F5 Self-declared readiness: lenses = 7 READY FOR WHITE-SPACE ANALYSIS, 13 PARTIALLY READY, 5 EXECUTION DETAIL REQUIRED, 2 SOURCE RESEARCH REQUIRED; all 27 carry a gap statement. The Universe discloses that 20 of 27 lenses are not yet fully ready.
Implication for dispositions: F2/F3 point to a PATCH-class item (add an entity-to-source mapping layer at import) if Source Watch needs entity-level impact analysis; F1 is an import-time identity correction. Neither is a regeneration signal.
