# ATL-35 / LTL-03 Freeze-Candidate Manifest v0.1

Status: FREEZE_CANDIDATE — ATL-37 PASS_WITH_BINDING_CORRECTIONS; CORRECTION CYCLE IN PROGRESS
Date: 2026-09-20
Purpose: immutable research-side handoff manifest for independent crossed-QA.

## 1. Freeze-candidate decision

ATL-35 has completed the bounded research/normalization work required to present LTL-03 as the detailed worked example for deterministic Atlas execution-readiness generation.

Broad research is closed. The authoritative NMFTA eBOL 2.1 BOL_Request schema has been recovered and normalized. The required 22-task coverage matrix has established the transfer boundary between reusable machinery and future task-specific research.

This manifest does **not** certify implementation correctness or execution readiness. ATL-37 must independently test the frozen package.

## 2. Canonical graph checkpoint

File:
`governance/research/LTL_03_EXECUTION_LOGIC_GRAPH_V0_1.json`

Blob SHA at assembly:
`fdc4cb3ee5bdd5a1abcd7416357727bf73f9bb8e`

Validated state:
- 471 nodes
- 2,538 typed edges
- 69 evidence nodes
- 149 domain facts
- 21 semantic primitives
- 18 rule families
- 148 generated rule instances
- 31 explicit exceptions
- 11 reusable execution patterns
- 15 explicit client-binding requirements
- 1 CLIENT_BINDING node (`CB-LOCATIONID-REQUIRED`)
- 3 explicit knowledge gaps
- 5 runtime projection types
- 0 broken edges
- 0 stranded evidence
- 0 unused rule families
- 0 unused primitives
- 0 generated instances missing evidence
- 0 generated instances missing primitive linkage
- 0 generated instances missing rule-family linkage
- 0 reusable patterns missing primitive/family/task-instance linkage

Latest graph checkpoint:
`NMFTA_EBOL21_BOL_REQUEST_SCHEMA_CLOSURE`

## 3. Authoritative source hierarchy represented

Highest-authority evidence used includes:
1. U.S. federal regulation — 49 CFR BOL / hazardous-material shipping-paper requirements.
2. NMFTA / DSDC — eBOL 2.1, SCAC, SPLC, NMFC/classification, handling-unit density, Pickup Request & Visibility, In-Transit Visibility, Preliminary Freight Charges.
3. UN/CEFACT — reusable transport/consignment semantic objects, measures, identifiers, locations, documents, monetary/temporal/service/equipment semantics.

Carrier/client implementation evidence is not promoted over issuer/regulatory authority. Client-specific rules remain Client Binding.

## 4. Exact issuer schema closure

Recovered file:
`ebol-apiv2.1.0.yaml`

Source-declared:
- OpenAPI 3.0.0
- Electronic Bill Of Lading Service
- version 2.1.0

Exact source-byte SHA-256:
`39715755793a2f39ee290e17f3997cb1bd7cadf001e5531f4a61093df1094e8c`

Closure artifact:
`governance/research/LTL_03_NMFTA_EBOL21_BOL_REQUEST_SCHEMA_CLOSURE_V0_1.md`
Commit:
`1b835974298b7121c203dd6afd7f602616c85c5d`

Graph materialization:
`2cddde4513842c6da4f7bd27f603fb6374cae78f`

The prior BOL_Request property/nesting/cardinality gap is resolved.

## 5. Reusable execution machinery

21 semantic primitives are governed in the graph.

18 rule families:
RF1 Identity & Reference Resolution; RF2 Relationship Integrity; RF3 Lifecycle & State Transition; RF4 Requiredness & Cardinality; RF5 Controlled-Value Validation; RF6 Master/Reference Reconciliation; RF7 Conditional Activation; RF8 Error & Exception Semantics; RF9 Source Authority & Precedence; RF10 Representation Constraint; RF11 Client Specialization; RF12 Aggregate Reconciliation; RF13 Measure Semantics; RF14 Hierarchy; RF15 Candidate Parsing & Semantic Assignment; RF16 Instruction/Note Ownership; RF17 Monetary Amount / Charge Semantics; RF18 Temporal & Version Semantics.

11 reusable patterns:
- RPAT-LTL-IDENTITY-BEFORE-MUTATION
- RPAT-LTL-ROLE-BEFORE-MASTER
- RPAT-LTL-CONDITIONAL-CONTRACT
- RPAT-LTL-MEASURE-WITH-OWNER
- RPAT-LTL-EVENT-LIFECYCLE
- RPAT-LTL-CHANGE-EVENT
- RPAT-LTL-REPEATING-CHILD-OBJECT
- RPAT-LTL-CLIENT-OPTIONALITY-SPECIALIZATION
- RPAT-LTL-MONETARY-CHARGE
- RPAT-LTL-REFERENCE-GROUPING
- RPAT-LTL-CUSTODY-HANDOFF

All 148 generated instances are linked to evidence, primitive(s) and rule family/families.

## 6. Runtime projection boundary

Generated knowledge is projected to five runtime categories in the graph:
- API
- AI Agent
- BPM
- RPA
- Malkom/IDP

Projection does not make Atlas the executor. Atlas remains the governed execution-readiness layer; downstream tools execute.

## 7. Explicit Client Binding register

15 graph-materialized requirements remain client/carrier/partner scoped:
1. PFC charge liability/payer/dispute treatment.
2. Pickup dock/shipment readiness policy.
3. Pickup equipment vocabulary/requiredness/assignment.
4. Pickup delay-reason/revised-arrival policy.
5. ETA calculation/confidence/consumption policy.
6. In-transit exception escalation thresholds/actions.
7. POD retrieval/retention/validation policy.
8. eBOL custom-error contract.
9. eBOL nullability/serialization specialization.
10. eBOL authentication/security configuration.
11. visibility subscription/channel configuration.
12. Verified/Public exposure matrix and supported lookup behavior.
13. customs-state source mapping/temporal evidence.
14. damage/shortage/loss escalation/inspection/claims handoff.
15. reconsignment/missed-delivery/accessorial response policy.

These are not research failures. They are governed enterprise-delta requirements.

## 8. Explicit unresolved knowledge gaps

Only three remain:

### KG-LTL-CHARGEABLE-WEIGHT-RATING-FORMULA
No universal authoritative LTL DIM divisor/formula has been established. Blocks universal automatic chargeable-weight derivation, not the semantic distinction among gross/net/volume/chargeable measures.

### KG-DSDC-PUBLICATION-STATE-RECONCILIATION
First-party DSDC pages conflict on formal release/publication state for some standards. Preserve conflict/provenance; semantic evidence independently supported remains usable. Availability-dependent readiness must not silently infer a status.

### KG-CUSTOMS-JURISDICTION-RULES
Jurisdiction/broker/client-specific customs clearance decisions require separate regulatory/client authority. DSDC customs visibility states do not authorize legal, duty/tax, brokerage or release conclusions.

## 9. Research-depth / residual-knowledge ledger

Artifact:
`governance/research/LTL_03_RESEARCH_COVERAGE_LEDGER_V0_1.md`
Commit:
`7a9bcd2fe801a73e71f4c48739ebf44a4690f4ab`

This ledger records researched domains, provisional SEFL/Malkom 76-field coverage, residual knowledge and the stop-control preventing open-ended research.

## 10. Road LTL 22-task transfer boundary

Artifact:
`governance/research/ATL_35_ROAD_LTL_22_TASK_COVERAGE_MATRIX_V0_1.md`
Commit:
`5bb20a1caf40c22e97575da89746be743485d945`

Result:
- A — reuse/materialize: 8 tasks
- B — reuse + targeted evidence: 8 tasks
- C — task-specific authoritative research required: 6 tasks
- D — whole-task primarily Client Binding: 0

16/22 tasks can substantially reuse the present semantic/generative foundation. This is a transfer/reuse result, not a percentage-complete claim for all LTL knowledge.

The six C tasks are future depth requirements, not blockers to freezing the LTL-03 worked example.

## 11. Research closure / saturation evidence

Coverage-and-closure audit:
`ec224bda1fd8a61efaad2559e54ecc5e37cf41b3`

Successive authoritative tranches repeatedly reused the same primitive/rule/pattern machinery. The recovered eBOL YAML added exact schema evidence and generated instances but required no new semantic primitive or reusable execution pattern. This supports research-side semantic saturation for LTL-03.

## 12. Independent QA contract for ATL-37

ATL-37 must independently verify at minimum:

1. **Artifact integrity**
   - graph parses;
   - manifest-referenced files/commits exist;
   - source fingerprints and immutable commits match.

2. **Graph integrity**
   - 471 nodes / 2,538 edges at frozen candidate;
   - zero broken edges;
   - every generated instance has evidence + primitive + family;
   - every reusable pattern has primitive/family/task-instance linkage.

3. **Evidence traceability**
   - sampled and risk-selected generated instances trace to authoritative evidence;
   - no carrier/client evidence has been silently promoted to universal industry truth;
   - source conflict is retained where applicable.

4. **Unsafe-inference tests**
   - requestedPickupDate does not become Pickup Request;
   - ETA does not become Delivered;
   - POD availability does not become POD content validation;
   - customs status does not become legal/duty/release conclusion;
   - accessorial event does not automatically become charge/liability;
   - classification/density does not become universal rating result;
   - optional/null does not become business value;
   - exposure/subscription does not become shipment state.

5. **Client Binding tests**
   - all 15 explicit client-binding requirements remain unresolved until client/partner evidence is supplied;
   - local specialization cannot rewrite canonical industry truth.

6. **Determinism / reproducibility**
   - same frozen evidence + governed primitives/families/patterns must reproduce equivalent rule-instance semantics;
   - ordering/serialization differences must not alter semantic output;
   - unresolved gaps must remain unresolved rather than be filled by model inference.

7. **22-task boundary**
   - matrix classifications are supported as research-depth triage;
   - they must not be misread as execution-readiness certification for the other 21 tasks.

## 13. Freeze restrictions

Until ATL-37 completes:
- status is `FREEZE_CANDIDATE_AWAITING_INDEPENDENT_QA`;
- do not call LTL-03 QA-passed;
- do not close knowledge gaps by inference;
- do not expand broad research without a specific QA/closure defect;
- do not mutate frozen research artifacts except through a documented defect/revision cycle;
- do not start ATL-40 substantive redesign using an unstable package.

## 14. Handoff

Research-side package is ready for independent crossed-QA.

Next governed stage:
**ATL-37 — Independent QA of the frozen LTL-03 evidence / generator package.**

ATL-35 may be treated as research work complete only after the repository/Linear governance state records this freeze-candidate handoff. Final QA acceptance remains outside ATL-35.


## 15. ATL-37 correction-cycle addendum — 2026-09-20

Independent QA disposition: `PASS_WITH_BINDING_CORRECTIONS`.

Binding correction #1 applied: graph internal status/freezeStatus corrected in commit `da8e7ea3ced2c25a36739abed20beef86b40af7b`. Because correcting object-level freeze metadata changes the graph blob, the original audited blob `fdc4cb3ee5bdd5a1abcd7416357727bf73f9bb8e` remains the immutable ATL-37 audit input; the corrected graph is a post-QA revision and must be rechecked before final acceptance.

Binding correction #2 applied in this manifest revision: the category list now explicitly includes the one `CLIENT_BINDING` node `CB-LOCATIONID-REQUIRED`. Total node count remains 471.

Binding correction #3 remains pending until the exact raw `ebol-apiv2.1.0.yaml` bytes are placed into governed custody and independently hash-verified against `39715755793a2f39ee290e17f3997cb1bd7cadf001e5531f4a61093df1094e8c`.

Binding correction #4 is a separate governance/process disposition: ATL-40 substantive continuation remains unauthorized pending Owner/ChatGPT resolution of the freeze-window sequencing violation. It does not invalidate ATL-37's technical findings because the audited graph/manifest were unmutated during QA.
