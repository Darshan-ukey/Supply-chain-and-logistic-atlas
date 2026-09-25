# Supply Chain Atlas — Client Discovery Pack

## Workspace
- Client workspace: Synthetic Demo Client
- Atlas module: Road LTL / Groupage
- Atlas version: V1.2
- Unknown A5 tasks: 16
- Questions: 176
- Answers recorded: 2

> Governance: questions are generated deterministically from the governed A5 reference contract. Answers are client-scoped discovery evidence and do not automatically confirm a task, validate a risk, or modify Atlas Reference.

## LTL-01 — Resolve service demand and execution eligibility
- Client state: Client Confirmed

### OWNERSHIP
**Question:** Who actually performs and owns “Resolve service demand and execution eligibility” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Active role; shipper/3PL/4PL commonly initiates; owner: Commercial / transport service owner

**Client answer:** Synthetic Stage-7 demonstration answer. Not a real client fact.

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Approved order, replenishment demand or service request exists.; inputs: obj-order, obj-contract, obj-product-master, obj-transport-service-request

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-transport-service-request? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-tms; producer: sys-oms / sys-erp / sys-customer-portal; consumers: sys-tms / sys-rate-engine

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Is Road LTL eligible for cargo, lane, service and required date?; rule: Serviceability, commodity, size/weight, prohibited-goods, lane, cut-off and contract rules must pass.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Eligibility rule version and override authority recorded.; evidence: Eligibility result, rule version, request timestamp and rejection/override record.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Quote/request validity and pickup cut-off.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-transport-service-request, obj-shipment; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-02 — Classify, rate and commit the commercial offer
- Client state: Client Confirmed

### OWNERSHIP
**Question:** Who actually performs and owns “Classify, rate and commit the commercial offer” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Commercial owner or contracted logistics provider; owner: Pricing / commercial management

**Client answer:** Synthetic Stage-7 demonstration answer. Not a real client fact.

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Eligible LTL service request with measured cargo attributes.; inputs: obj-transport-service-request, obj-rate, obj-contract, obj-product-master

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-rate? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-rate-engine; producer: sys-rate-engine / sys-cpq; consumers: sys-tms / sys-billing / customer channel

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which classification, tariff/contract rate, accessorial basis and service offer apply?; rule: Use contract/tariff hierarchy, effective dates, verified attributes and approval tolerances; NMFC only in its applicable North-American relationship.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Preserve input measures, classification/rate version, exception approvals and quoted-to-executed linkage.; evidence: Class/rate response, source/version, charge components, approval and quote.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Quote validity; tender/request response clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-rate, obj-quote, obj-freight-charge; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-03 — Create and validate shipment, consignment and transport-document identity
- Client state: Client Observed

### OWNERSHIP
**Question:** Who actually performs and owns “Create and validate shipment, consignment and transport-document identity” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Role resolved by contract and regime; owner: Shipment data owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Commercial offer or service request is accepted.; inputs: obj-order, obj-contract, obj-rate, obj-party-master, obj-product-master

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-shipment? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-tms; producer: sys-tms / sys-customer-portal; consumers: sys-carrier-platform / sys-wms / sys-dms / sys-billing

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Are parties, locations, cargo, references and document form complete and mutually consistent?; rule: Reuse Page‑0 atomic objects; distinguish shipment, consignment and transport document; apply eBOL, CMR/e-CMR or national form only when scope resolves.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Uniqueness, required-field, version, duplicate and amendment controls.; evidence: Versioned shipment, transport document, validation response and identifier crosswalk.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Before pickup acceptance and applicable document cut-off.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-shipment, obj-transport-document, obj-handling-unit; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-04 — Request pickup and prove shipment readiness
- Client state: Client Observed

### OWNERSHIP
**Question:** Who actually performs and owns “Request pickup and prove shipment readiness” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Shipper/3PL requests; carrier responds; owner: Transport execution owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Validated shipment and transport-document identity.; inputs: obj-shipment, obj-transport-document, obj-shipment-readiness, obj-appointment

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-booking? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-carrier-platform; producer: sys-tms / sys-customer-portal; consumers: sys-carrier-platform / sys-dispatch / sys-wms

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Can the carrier/service accept requested location, window, quantity and freight readiness?; rule: Valid identity, serviceability, pickup window, cargo readiness and condition-specific prerequisites required.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Request/response correlation, idempotency, change/cancel reason and stale-version rejection.; evidence: Pickup request, acknowledgement/status, appointment and change history.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Pickup response SLA and local cut-off.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-pickup, obj-booking, obj-transport-event; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-20 — Assure vehicle, equipment and qualified resource readiness
- Client state: Client Inferred

### OWNERSHIP
**Question:** Who actually performs and owns “Assure vehicle, equipment and qualified resource readiness” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Carrier or contracted provider; owner: Asset/fleet owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Pickup accepted and equipment/resource assignment is required.; inputs: obj-equipment, obj-vehicle, obj-trailer, obj-driver, obj-availability-state

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-equipment? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-fleet; producer: sys-fleet / sys-eam / sys-cmms; consumers: sys-dispatch / sys-tms / sys-wms

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Is the assigned resource available, suitable, inspected and qualified for active conditions?; rule: Capacity, compatibility, maintenance, inspection, qualification and condition-specific requirements must pass.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Authoritative availability/inspection record and controlled override.; evidence: Assignment, availability state, inspection/qualification evidence and exception approval.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Before dispatch and before load acceptance.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-equipment, obj-inspection-evidence, obj-dispatch; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-05 — Dispatch pickup, accept freight and establish custody
- Client state: Client Confirmed

### OWNERSHIP
**Question:** Who actually performs and owns “Dispatch pickup, accept freight and establish custody” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Operating carrier; owner: Carrier pickup operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Pickup accepted; freight and resource readiness confirmed.; inputs: obj-pickup, obj-shipment, obj-transport-document, obj-handling-unit

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-custody-record? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-carrier-platform; producer: sys-mobile-delivery / sys-carrier-platform; consumers: sys-tms / sys-visibility / sys-dms

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Does presented freight match the accepted request/document and acceptance criteria?; rule: Identity, count, apparent condition, prohibited/controlled-goods and document checks must pass or reservations/refusal be recorded.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Positive identity match, timestamp/location, condition/count variance and custody acknowledgement.; evidence: Dispatch event, pickup scan, receipt/BOL acknowledgement, count/condition record and reservation/refusal.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Appointment window; acceptance/refusal communication clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-custody-record, obj-condition-record, obj-transport-event; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-06 — Receive at origin service centre and verify handling-unit state
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Receive at origin service centre and verify handling-unit state” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Carrier or contracted node operator; owner: Origin-node operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Accepted freight arrives at the origin LTL node.; inputs: obj-shipment, obj-handling-unit, obj-custody-record, obj-transport-document

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-inventory-state? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-wms; producer: sys-wms / sys-carrier-platform; consumers: sys-tms / sys-event-platform / sys-rate-engine

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Do handling-unit identity, count, weight/dimensions, condition and routing attributes reconcile?; rule: Receive only against authoritative shipment/handling-unit identity; quarantine or case any discrepancy.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Scan/measurement provenance, scale/device validity where required, duplicate/missing-unit and damage controls.; evidence: Node receipt, scans, measurements, condition images/records and variance case.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Unload/receiving and discrepancy-notification clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-receipt, obj-condition-record, obj-transport-event, obj-exception-case; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-07 — Build consolidation and authorize origin load
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Build consolidation and authorize origin load” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Operating carrier/node operator; owner: Origin line-haul operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Eligible handling units are received and route/capacity plan exists.; inputs: obj-handling-unit, obj-route, obj-leg, obj-equipment, obj-capacity-profile

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-load-plan? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-tms; producer: sys-tms / sys-wms / sys-dock; consumers: sys-dispatch / sys-carrier-platform / sys-visibility

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which handling units can share the planned vehicle/route while meeting service and condition constraints?; rule: Capacity, route, compatibility, segregation, cut-off, custody and load-integrity rules must pass.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Planned-versus-scanned unit reconciliation and supervisor release for exceptions.; evidence: Load plan, manifest, scan reconciliation, seal/closure evidence where used and release.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Outbound cut-off and dispatch deadline.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-load-plan, obj-dispatch, obj-transport-event; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-08 — Execute line-haul leg and publish actual movement state
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Execute line-haul leg and publish actual movement state” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Operating carrier or disclosed subcontractor; owner: Line-haul operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Authorized load and dispatch exist.; inputs: obj-load-plan, obj-dispatch, obj-route, obj-leg, obj-equipment

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-transport-event? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-carrier-platform; producer: sys-carrier-platform / sys-fleet / sys-event-platform; consumers: sys-tms / sys-visibility / sys-control-tower

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Can the leg continue within route, hours, safety, condition and service constraints?; rule: Only authorized load/resource may depart; actual events must preserve leg, load and unit correlation.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Departure gate, route/deviation monitoring, event chronology and unresolved-hold block.; evidence: Departure/arrival events, location/time, load/resource identity and deviation evidence.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Planned milestones and exception thresholds.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-transport-event, obj-execution-state; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-09 — Unload, sort and cross-dock at an intermediate service centre
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Unload, sort and cross-dock at an intermediate service centre” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Carrier or contracted node operator; owner: Intermediate-node operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Inbound load arrives at an intermediate LTL node.; inputs: obj-load-plan, obj-handling-unit, obj-transport-event, obj-route

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-inventory-state? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-wms; producer: sys-wms / sys-carrier-platform; consumers: sys-tms / sys-event-platform / sys-dispatch

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Does each unit reconcile and which outbound route/door/load should receive it?; rule: Positive identity, custody continuity, route eligibility, condition and cut-off controls must pass; unresolved units move to exception state.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Inbound-to-outbound scan reconciliation, missort prevention, damage/shortage capture and controlled release.; evidence: Transfer events, location/door, unit/load containment, condition and outbound assignment.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Connection cut-off, dwell threshold and exception escalation clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-custody-record, obj-transport-event, obj-load-plan, obj-exception-case; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-10 — Transfer or interchange to the next network leg
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Transfer or interchange to the next network leg” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Role varies by active service chain; owner: Service-chain/transport owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Unit assigned to a next leg, carrier or mode interface.; inputs: obj-handling-unit, obj-leg, obj-contract, obj-transport-document, obj-custody-record

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-leg? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-tms; producer: sys-carrier-platform / sys-forwarder-platform; consumers: sys-tms / successor platform / sys-dms

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Is the successor party/leg authorized, ready and compatible with the active contract/regime/condition?; rule: Leg-by-leg carrier, contract, document, custody and legal scope must be resolved; do not merge regimes.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Successor identity/authority, handoff evidence, document correlation and unresolved-scope lock.; evidence: Interchange receipt, custody record, successor leg ID, document link and timestamps.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Connection cut-off and acceptance clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-leg, obj-custody-record, obj-transport-event; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-11 — Deconsolidate and build the destination-delivery load
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Deconsolidate and build the destination-delivery load” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Operating carrier/node operator; owner: Destination operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Destination service centre receives the inbound load.; inputs: obj-load-plan, obj-handling-unit, obj-transport-event, obj-hold

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-destination-handoff? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-tms; producer: sys-wms / sys-tms; consumers: sys-dispatch / sys-last-mile / sys-visibility

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which units are releasable and which route/stop/appointment can execute them?; rule: Receipt reconciliation, active holds, service/recipient constraints, route capacity and delivery readiness must pass.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Inbound/unit reconciliation, hold block, route assignment and planned-versus-loaded check.; evidence: Destination receipt, unit state, route/stop/load plan and release.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Delivery-plan cut-off and commitment window.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-destination-handoff, obj-route, obj-stop, obj-dispatch; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-12 — Confirm destination readiness, appointment and delivery dispatch
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Confirm destination readiness, appointment and delivery dispatch” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Operating carrier or contracted last-mile provider; owner: Delivery operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Delivery load/units ready for destination execution.; inputs: obj-destination-handoff, obj-appointment, obj-recipient, obj-hold

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-dispatch? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-dispatch; producer: sys-dispatch / sys-customer-portal; consumers: sys-mobile-delivery / sys-tms / sys-crm

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Can the shipment be dispatched to the recipient/site under active instructions, restrictions and window?; rule: Valid recipient/location, appointment, access constraints, holds, service and special-condition prerequisites required.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Latest-instruction/version check, hold check, appointment acknowledgement and dispatch authority.; evidence: Appointment response, recipient instruction, dispatch and change record.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Appointment and promised-delivery window.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-dispatch, obj-delivery-order, obj-transport-event; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-13 — Attempt delivery, capture acceptance/reservations and close custody
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Attempt delivery, capture acceptance/reservations and close custody” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Operating carrier or contracted delivery provider; owner: Delivery operations

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Authorized delivery dispatch reaches the stop.; inputs: obj-delivery-order, obj-dispatch, obj-handling-unit, obj-recipient

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-delivery-evidence? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-last-mile; producer: sys-mobile-delivery / sys-dms; consumers: sys-tms / sys-billing / sys-crm / sys-claims

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Was delivery completed to an authorized recipient/site, refused, short/damaged or unsuccessful?; rule: Identity, authorization, actual count/condition, exception reason and applicable signature/evidence requirements must pass.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Geotime/user/device provenance, tamper-resistant evidence, reservation/refusal and failed-attempt reason controls.; evidence: POD/acceptance, delivery attempt, recipient, count/condition, reservation/refusal and location/time.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Delivery window; damage/shortage/refusal notification and claim clocks remain source/contract specific.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-delivery-attempt, obj-pod, obj-acceptance, obj-failure-reason, obj-delivery-evidence; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-14 — Detect, classify and assign execution variance
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Detect, classify and assign execution variance” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Detecting role or automated deterministic rule; owner: Exception control owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Expected-versus-actual variance, missing event, condition breach, discrepancy, refusal or service failure.; inputs: obj-execution-state, obj-transport-event, obj-condition-record, obj-control-evidence

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-exception-case? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-case; producer: sys-event-platform / sys-wms / sys-tms / sys-crm; consumers: sys-control-tower / sys-workflow / sys-claims

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: What is the failure class, severity, affected object, true detection point and accountable recovery owner?; rule: Do not assign root cause to detection location; correlate object lineage, upstream process, system/role and downstream impact.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Duplicate-case prevention, severity model, owner/clock assignment and evidence preservation.; evidence: Exception case, variance, affected object/version, detection signal, owner and clock.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Condition/service/legal/contract clock selected by active context; generic clock is not fabricated.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-exception-case, obj-risk-signal; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-15 — Contain, replan and recover service
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Contain, replan and recover service” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Role selected by recovery action; owner: Exception/recovery owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Owned exception with classified impact and valid current state.; inputs: obj-exception-case, obj-risk-signal, obj-execution-state

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-recovery-action? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-workflow; producer: sys-case / sys-control-tower; consumers: sys-tms / sys-wms / sys-crm / sys-billing / sys-claims

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which feasible action contains risk and restores an authorized execution state with least justified consequence?; rule: Recovery cannot precede detection/ownership; respect holds, custody, contract, safety and legal scope.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Decision record, authority, alternative evaluation, action confirmation, state reconciliation and closure evidence.; evidence: Decision, authorized action, actual recovery event, reconciled objects and closure approval.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Assigned exception/recovery clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-recovery-action, obj-resolution, obj-control-evidence; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-16 — Calculate preliminary and executed freight charges
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Calculate preliminary and executed freight charges” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Financial responsibility varies by active role/contract; owner: Revenue/cost accounting owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Execution evidence changes charge-relevant facts or billable completion occurs.; inputs: obj-rate, obj-contract, obj-transport-event, obj-delivery-evidence, obj-condition-record

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-freight-charge? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-billing; producer: sys-rate-engine / sys-tms / sys-billing; consumers: sys-erp / sys-freight-audit / sys-ar / sys-ap

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which evidenced, contractually valid charges or changes can be accrued/billed/referred?; rule: Reconcile contract/rate version, measured facts, service events, accessorial evidence, tax context and approval tolerance.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Quote-to-charge comparison, duplicate charge, effective-rate, evidence and approval controls.; evidence: Charge lines, rate basis, measures, events, variance reason and approval.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Accrual/billing cut-off and dispute-notice windows by contract/policy.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-freight-charge, obj-accrual; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-17 — Invoice, audit, approve and settle transport obligations
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Invoice, audit, approve and settle transport obligations” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Resolved by active role and commercial relationship; owner: Finance process owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Billable/receivable or payable obligation and supporting execution evidence exist.; inputs: obj-freight-charge, obj-carrier-invoice, obj-customer-invoice, obj-delivery-evidence, obj-accrual

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-invoice? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-erp; producer: sys-billing / supplier billing; consumers: sys-freight-audit / sys-ap / sys-ar / sys-treasury

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Does invoice/receivable reconcile to contract, rate, shipment, performed service, evidence, tax and tolerance?; rule: No approval without authoritative charge/evidence; preserve original invoice and controlled adjustment; segregate duties.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Duplicate, three-way/evidence match, tolerance, approval, beneficiary and payment-release controls.; evidence: Invoice, audit result, approval, posting, payment/receipt and settlement reference.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Invoice, approval, payment-term and deduction/dispute clocks.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-approved-payable, obj-payment, obj-settlement, obj-control-evidence; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-18 — Adjudicate cargo/service claim or billing dispute
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Adjudicate cargo/service claim or billing dispute” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Claims/dispute team by active role; owner: Claims/dispute owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Preserved loss/damage/service/billing evidence and asserted claim or dispute.; inputs: obj-claim-file, obj-delivery-evidence, obj-custody-record, obj-condition-record, obj-invoice

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-claim-file? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-claims; producer: sys-claims / sys-billing-dispute; consumers: sys-erp / sys-insurance / sys-crm / sys-dms

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Does claimant have standing and do contract/regime, evidence, causation, time bar, liability/charge and quantum support relief?; rule: Keep cargo/service claim, billing dispute and insurance recovery separate; apply only resolved contract/regime/policy.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Completeness, evidence integrity, conflict, reserve, authority, time-bar and settlement controls.; evidence: Claim file, liability/coverage position, decision, settlement/decline and recovery evidence.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Exact notice/claim/action clocks from active contract/regime; no generic LTL clock asserted.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-liability-position, obj-coverage-position, obj-credit-adjustment, obj-settlement; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-19 — Resolve regulatory scope, operate hold/release and retain evidence
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Resolve regulatory scope, operate hold/release and retain evidence” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Duty holder or authorized representative; owner: Trade/compliance owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Jurisdiction, carriage regime or controlled-goods/transit/bonded/security condition selected.; inputs: obj-product-master, obj-transport-document, obj-regulatory-status, obj-contract

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-regulatory-status? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-gtm; producer: sys-gtm / sys-broker-platform / sys-customs-platform; consumers: sys-tms / sys-wms / sys-control-tower

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which operative authority/instrument and participant duty apply to this lane, goods, party, facility and procedure?; rule: No regime loads from mode name alone; resolve legal scope separately and block movement when an operative hold exists.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Source/effective-date record, filing correlation, authority-response provenance and hold-release segregation.; evidence: Scope record, declaration/shipping paper, authority response, inspection, hold/release and retained evidence.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Authority, transit, filing and response clock from operative source.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-declaration, obj-inspection, obj-hold, obj-release, obj-control-evidence; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-21 — Reconcile party, location, shipment, unit and network identities
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Reconcile party, location, shipment, unit and network identities” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: MDM/data operations; owner: Master/reference-data owner by object

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Identifier conflict, missing crosswalk, duplicate or stale reference blocks execution.; inputs: obj-party-master, obj-location-master, obj-shipment, obj-handling-unit, obj-reference-code

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-lineage? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-mdm; producer: sys-mdm / authoritative transaction system; consumers: sys-erp / sys-oms / sys-tms / sys-wms / sys-billing

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: Which authoritative identity/version and relationship survives for the governed scope?; rule: Apply Page‑0 object authority; never merge shipment, consignment, handling unit, document or equipment into one compound object.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Stewardship, survivorship, version, uniqueness and consumer acknowledgement.; evidence: Crosswalk, stewardship decision, source/version, changed records and consumer acknowledgements.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Before dependent action; exception clock based on operational consequence.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-lineage, obj-control-evidence; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
## LTL-22 — Coordinate customer communication and resolution evidence
- Client state: Unknown

### OWNERSHIP
**Question:** Who actually performs and owns “Coordinate customer communication and resolution evidence” in the client environment, and who has decision/override authority?

**Reference basis:** Atlas reference performer: Active customer-facing role; owner: Customer service owner

**Client answer:** UNANSWERED

### TRIGGER + INPUT
**Question:** What client event or request triggers this activity, and which inputs must be present before work can start?

**Reference basis:** Reference trigger: Customer enquiry, service variance, delivery failure, claim/dispute or material status change.; inputs: obj-service-request, obj-shipment, obj-exception-case, obj-delivery-evidence

**Client answer:** UNANSWERED

### SYSTEM AUTHORITY
**Question:** Which client system is authoritative for obj-service-request? Which systems produce and consume the update, and how are handoffs reconciled?

**Reference basis:** Reference authority: sys-case; producer: sys-crm / sys-customer-portal; consumers: sys-tms / sys-workflow / sys-billing / sys-claims

**Client answer:** UNANSWERED

### DECISION + RULE
**Question:** How is the reference decision implemented in practice? What rules, thresholds or overrides are used, and who can approve an exception?

**Reference basis:** Reference decision: What authenticated, authorized and evidenced response/action can be provided without contradicting execution truth?; rule: Use authoritative shipment/case state; protect data; do not promise recovery/credit outside authority.

**Client answer:** UNANSWERED

### CONTROL + EVIDENCE
**Question:** What control is actually performed, what evidence proves it happened, and where is that evidence retained?

**Reference basis:** Reference control: Identity/authentication, case linkage, SLA, approval and communication-history controls.; evidence: Service request, authenticated party, response, commitment, resolution and feedback.

**Client answer:** UNANSWERED

### TIMING / SLA
**Question:** What operational SLA, cut-off, validity window or ageing rule applies to this activity? What happens if it is missed?

**Reference basis:** Reference clock: Service/contract SLA and active exception/claim clock.

**Client answer:** UNANSWERED

### EXCEPTION
**Question:** What client exception path is used when this activity fails or the expected state is not achieved? Who owns recovery?

**Reference basis:** Reference escalation: LTL-14 · Detect, classify and assign execution variance; recovery: LTL-15 · Contain, replan and recover service

**Client answer:** UNANSWERED

### OUTPUT + DOWNSTREAM
**Question:** Which downstream teams, systems or financial/customer processes consume the outputs of this activity, and how is successful receipt acknowledged?

**Reference basis:** Reference outputs: obj-resolution, obj-control-evidence; downstream: Road LTL service, cost, cash, compliance and customer outcomes

**Client answer:** UNANSWERED
