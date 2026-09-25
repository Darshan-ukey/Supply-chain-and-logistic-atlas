# ATL-35 — Road LTL 22-Task Evidence / Decomposition Coverage Matrix v0.1

Status: CLOSURE MATRIX — RESEARCH-DEPTH TRIAGE, NOT TASK QA
Date: 2026-09-20
Basis:
- governed 22-task Road LTL A5 inventory from sample-discovery-pack.md / road-ltl claim provenance
- LTL-03 execution-logic graph after authoritative eBOL 2.1 schema closure
- current graph checkpoint: 471 nodes / 2,538 typed edges / 148 generated rule instances / 11 reusable patterns / 15 client-binding requirements / 3 knowledge gaps / 0 broken edges

## Purpose

Determine whether ATL-35 requires further authoritative research outside the LTL-03 worked example. This matrix does not assert that all 22 tasks are execution-ready. It asks whether the current LTL-03 research machinery/evidence can be reused, whether a genuinely new task-specific authoritative dimension remains, or whether the unresolved portion belongs primarily to Client Binding.

Classification:
- **A — REUSE / MATERIALIZE:** current governed primitives, patterns and evidence cover the dominant execution semantics; materialize task-specific decomposition rather than perform broad research.
- **B — REUSE + TARGETED EVIDENCE:** substantial machinery is reusable, but one or more task-specific authoritative dimensions should be checked before claiming execution-ready depth.
- **C — TASK-SPECIFIC RESEARCH REQUIRED:** current LTL-03 corpus does not provide sufficient authoritative operational depth for the task's defining decisions/controls.
- **D — PRIMARILY CLIENT BINDING:** reusable industry semantics exist, but enterprise execution is dominated by client/carrier policy/system authority. This classification is used only where authoritative generic research would not resolve the main execution delta.

## Matrix

| Task | Governed task | Class | Current reusable coverage | Residual before freeze |
|---|---|---|---|---|
| LTL-01 | Resolve service demand and execution eligibility | B | conditional activation; party/location/cargo/service objects; controlled values; source precedence | serviceability/prohibited-goods/lane/cut-off eligibility authority is not deeply researched; likely mixes carrier/client rules with regulatory restrictions |
| LTL-02 | Classify, rate and commit the commercial offer | B | NMFC/classification; density/dimensions; measure ownership; monetary semantics; PFC; version/source precedence | tariff/contract rating hierarchy and commercial commitment remain largely enterprise-specific; universal DIM formula intentionally unresolved |
| LTL-03 | Create and validate shipment, consignment and transport-document identity | A | deep worked example; eBOL 2.1 exact schema; 49 CFR; UN/CEFACT; SCAC/SPLC; identity, hierarchy, lifecycle, validation, exceptions | no broad research gap; proceed to freeze packaging |
| LTL-04 | Request pickup and prove shipment readiness | A | DSDC Pickup Request & Visibility; create/update/reschedule/cancel; readiness/equipment/delay; pickup-date boundary | carrier/client readiness/equipment/delay policy already explicit Client Binding |
| LTL-20 | Assure vehicle, equipment and qualified resource readiness | C | transport-equipment primitive and pickup equipment requirement only | defining vehicle/equipment qualification, driver/resource qualification, hours/safety/authorization controls require separate authoritative transport/safety evidence |
| LTL-05 | Dispatch pickup, accept freight and establish custody | A | custody-handoff pattern; pickup lifecycle; identity; count/condition; possession boundary; event chronology | dispatch authority and local acceptance policy are Client Binding; no new generic pattern expected |
| LTL-06 | Receive at origin service centre and verify handling-unit state | B | handling-unit hierarchy; identity; custody; count/condition; damage/shortage; event/state machinery | terminal receipt, scan/reconciliation and release/hold control depth not directly researched as an authoritative operational contract |
| LTL-07 | Build consolidation and authorize origin load | C | package/unit identity; relationships; equipment; lifecycle/state primitives | consolidation/load-building, compatibility, capacity, route/door/load authorization controls are not deeply researched |
| LTL-08 | Execute line-haul leg and publish actual movement state | A | DSDC In-Transit lifecycle; movement vs information events; push/pull; exception/reason semantics; custody | route/deviation/hours/safety thresholds remain client/regulatory specialization, but movement-state contract is covered |
| LTL-09 | Unload, sort and cross-dock at an intermediate service centre | C | custody, handling unit, event, damage/shortage, hierarchy patterns | cross-dock sort, door/route assignment, missort prevention, inbound-to-outbound reconciliation need task-specific authoritative depth |
| LTL-10 | Transfer or interchange to the next network leg | B | custody/responsibility handoff; leg/event identity; interline visibility; source authority; relationship integrity | interchange acceptance/document/custody controls merit targeted authoritative corroboration |
| LTL-11 | Deconsolidate and build the destination-delivery load | C | handling unit, custody, state/event, delivery readiness and hold concepts | destination deconsolidation, release, route/stop/load build and planned-vs-loaded controls are not deeply researched |
| LTL-12 | Confirm destination readiness, appointment and delivery dispatch | A | appointment lifecycle; accessorial/limited-access/time-critical structures; delivery information; reconsignment; readiness semantics | dispatch/recipient policy is Client Binding; generic semantic machinery covered |
| LTL-13 | Attempt delivery, capture acceptance/reservations and close custody | A | delivered/missed-delivery distinction; POD boundary; custody close; damage/shortage/loss; recipient/condition evidence; exception attribution | signature/evidence policy and claims clocks remain carrier/client/source-specific |
| LTL-14 | Detect, classify and assign execution variance | A | typed exception/event machinery; normalized reason/responsible-party separation; evidence provenance; duplicate/error semantics | severity/ownership/escalation thresholds are Client Binding |
| LTL-15 | Contain, replan and recover service | B | lifecycle mutation; reconsignment; appointment reschedule; missed delivery; exception response; conditional client-policy binding | recovery-option selection/approval and operational replan authority are not established as reusable industry truth |
| LTL-16 | Calculate preliminary and executed freight charges | B | PFC lifecycle; reweigh/reclass; accessorial add/remove; monetary vs operational change; storage/detention/redelivery categories | executed/final rating calculation and tariff/contract liability remain client/carrier-specific; universal chargeable-weight formula unresolved |
| LTL-17 | Invoice, audit, approve and settle transport obligations | C | monetary primitive; charge semantics; party/payment terms; preliminary-vs-final separation | invoice audit, settlement, tolerance, approval, payment/offset and financial control semantics were outside LTL-03 research |
| LTL-18 | Adjudicate cargo/service claim or billing dispute | C | damage/shortage/loss events; evidence provenance; operational attribution separated from liability | claim filing, liability, adjudication, limitation, settlement and billing-dispute rules require separate authoritative/legal/contract evidence |
| LTL-19 | Resolve regulatory scope, operate hold/release and retain evidence | B | hazmat conditional contract; source authority; customs-state separation; holds; provenance; conditional activation | broad regulatory-scope/hold-release rules beyond hazmat and generic customs visibility require regime-specific authority; customs legal decisions intentionally remain a gap |
| LTL-21 | Reconcile party, location, shipment, unit and network identities | A | identity/reference resolution; role-before-master; SCAC/SPLC; LocationID; PRO/BOL/reference hierarchy; master reconciliation | enterprise master-source precedence is Client Binding |
| LTL-22 | Coordinate customer communication and resolution evidence | B | push/pull visibility; subscription/exposure; status/exception information; evidence provenance | channel/SLA/communication ownership and resolution policy are primarily enterprise-specific; generic communication process not deeply researched |

## Quantified result

- A — REUSE / MATERIALIZE: **8 tasks** — LTL-03, 04, 05, 08, 12, 13, 14, 21.
- B — REUSE + TARGETED EVIDENCE: **8 tasks** — LTL-01, 02, 06, 10, 15, 16, 19, 22.
- C — TASK-SPECIFIC RESEARCH REQUIRED: **6 tasks** — LTL-20, 07, 09, 11, 17, 18.
- D — PRIMARILY CLIENT BINDING as whole-task classification: **0 tasks**. Client Binding is nevertheless a material residual inside many A/B tasks and is already represented explicitly in the graph.

Interpretation:
- 16/22 tasks (73%) can substantially reuse the current LTL-03 semantic/generative machinery without starting from zero.
- 8/22 (36%) are strong enough to move directly into task-specific materialization using current machinery.
- 6/22 (27%) expose genuinely new operational domains where authoritative task-specific research would be required for execution-ready depth.
- This does **not** mean 73% of all detailed task knowledge is complete. It measures reuse/readiness of the current Atlas generative foundation.

## Closure implication for ATL-35

ATL-35's objective is not to perform full deep research on all 22 tasks. The 22-task matrix was required to show where deterministic reuse stops and where new authority/client knowledge begins.

The matrix now demonstrates exactly that boundary.

### Recommended bounded closure
Do **not** open six new deep-research workstreams under ATL-35.

For ATL-35 freeze:
1. preserve the six C tasks as explicit future task-specific research requirements;
2. preserve B-task residuals as targeted evidence requirements / Client Binding as applicable;
3. package LTL-03 as the detailed worked example proving the mechanism;
4. document that the 11 reusable patterns and 21 primitives transfer across 16/22 tasks at least partially;
5. use the six C tasks as the future validation set for ATL-40's scalable on-demand research mechanism, rather than delaying LTL-03 freeze.

## Candidate future validation tasks

For ATL-40, choose at least one task structurally different from LTL-03:
- LTL-09 Cross-dock — physical node operations / scan-reconciliation / routing.
- LTL-17 Invoice & settlement — financial controls.
- LTL-18 Claims/disputes — legal/contract/evidence adjudication.
- LTL-20 Resource readiness — equipment/driver/safety authority.

These provide stronger tests of transfer than researching another BOL-adjacent task.

## Research stop-control

The matrix itself does not authorize further ATL-35 research.

Additional ATL-35 research requires a specific closure defect that prevents the LTL-03 worked example or generator/freeze package from being reproducible. Task-specific gaps for the other 21 tasks are now documented future depth requirements, not reasons to keep LTL-03 open.
