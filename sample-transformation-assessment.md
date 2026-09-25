# Supply Chain Atlas — Transformation Assessment

## Context
- Module: Road LTL / Groupage
- Version: V1.2
- Depth: A5_VERIFIED
- Lens: Transformation / Whitespace
- Filter: all

> Governance note: Source facts, Atlas-derived diagnostic signals, risk hypotheses and automation hypotheses are deliberately separated. No client metrics or client-confirmed issues are asserted.

## Findings

### LTL-01::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-01 — Resolve service demand and execution eligibility
- A3 area: Commercial, order and service commitment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-oms / sys-erp / sys-customer-portal · Authority: sys-tms
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-scor, src-apqc-pcf, src-uncefact-rdm

### LTL-01::TF-TIMING
- A5 task: LTL-01 — Resolve service demand and execution eligibility
- A3 area: Commercial, order and service commitment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Quote/request validity and pickup cut-off.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-scor, src-apqc-pcf, src-uncefact-rdm

### LTL-01::TF-CONTROL
- A5 task: LTL-01 — Resolve service demand and execution eligibility
- A3 area: Commercial, order and service commitment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Eligibility rule version and override authority recorded.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-scor, src-apqc-pcf, src-uncefact-rdm

### LTL-02::TF-TIMING
- A5 task: LTL-02 — Classify, rate and commit the commercial offer
- A3 area: Commercial, order and service commitment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Quote validity; tender/request response clock.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-apqc-pcf, src-nmfc, src-uncefact-rdm

### LTL-02::TF-CONTROL
- A5 task: LTL-02 — Classify, rate and commit the commercial offer
- A3 area: Commercial, order and service commitment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Preserve input measures, classification/rate version, exception approvals and quoted-to-executed linkage.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-apqc-pcf, src-nmfc, src-uncefact-rdm

### LTL-02::TF-FINANCIAL-OBJECT
- A5 task: LTL-02 — Classify, rate and commit the commercial offer
- A3 area: Commercial, order and service commitment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Financial-object dependency
- Source-confidence: HIGH
- Evidence from A5 contract: Outputs: obj-rate, obj-quote, obj-freight-charge
- Risk hypothesis: Potential financial leakage or settlement exposure if the governed execution state feeding a financial object is incomplete or inconsistent.
- Candidate intervention patterns: Automated charge validation; Revenue-assurance control; Financial reconciliation
- Sources: src-apqc-pcf, src-nmfc, src-uncefact-rdm

### LTL-03::TF-RECONCILIATION
- A5 task: LTL-03 — Create and validate shipment, consignment and transport-document identity
- A3 area: Shipment and transport-document establishment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Uniqueness, required-field, version, duplicate and amendment controls.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-uncefact-rdm, src-nmfta-dsdc-ltl, src-49cfr373, src-cmr, src-ecmr, src-nmfta-scac, src-nmfta-splc

### LTL-03::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-03 — Create and validate shipment, consignment and transport-document identity
- A3 area: Shipment and transport-document establishment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 2 document IDs · Evidence: Versioned shipment, transport document, validation response and identifier crosswalk.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-uncefact-rdm, src-nmfta-dsdc-ltl, src-49cfr373, src-cmr, src-ecmr, src-nmfta-scac, src-nmfta-splc

### LTL-03::TF-TIMING
- A5 task: LTL-03 — Create and validate shipment, consignment and transport-document identity
- A3 area: Shipment and transport-document establishment
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Before pickup acceptance and applicable document cut-off.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-uncefact-rdm, src-nmfta-dsdc-ltl, src-49cfr373, src-cmr, src-ecmr, src-nmfta-scac, src-nmfta-splc

### LTL-04::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-04 — Request pickup and prove shipment readiness
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-tms / sys-customer-portal · Authority: sys-carrier-platform
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-dsdc-pickup, src-uncefact-rdm, src-x12

### LTL-04::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-04 — Request pickup and prove shipment readiness
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 2 document IDs · Evidence: Pickup request, acknowledgement/status, appointment and change history.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-dsdc-pickup, src-uncefact-rdm, src-x12

### LTL-04::TF-TIMING
- A5 task: LTL-04 — Request pickup and prove shipment readiness
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Pickup response SLA and local cut-off.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-dsdc-pickup, src-uncefact-rdm, src-x12

### LTL-20::TF-HUMAN-INSPECTION
- A5 task: LTL-20 — Assure vehicle, equipment and qualified resource readiness
- A3 area: Vehicle, equipment and qualified-resource readiness
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Human / inspection dependency
- Source-confidence: HIGH
- Evidence from A5 contract: decision: Is the assigned resource available, suitable, inspected and qualified for active conditions?
- Risk hypothesis: Potential cycle-time or consistency exposure where execution depends on human inspection, adjudication or manual work.
- Candidate intervention patterns: Workflow orchestration; Rules-assisted validation; Human-in-the-loop automation
- Sources: src-scor, src-apqc-pcf

### LTL-20::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-20 — Assure vehicle, equipment and qualified resource readiness
- A3 area: Vehicle, equipment and qualified-resource readiness
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: CONDITIONAL
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-scor, src-apqc-pcf

### LTL-20::TF-CONTROL
- A5 task: LTL-20 — Assure vehicle, equipment and qualified resource readiness
- A3 area: Vehicle, equipment and qualified-resource readiness
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Authoritative availability/inspection record and controlled override.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-scor, src-apqc-pcf

### LTL-05::TF-HUMAN-INSPECTION
- A5 task: LTL-05 — Dispatch pickup, accept freight and establish custody
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Human / inspection dependency
- Source-confidence: HIGH
- Evidence from A5 contract: action: Dispatch, inspect presented freight, accept with/without reservation, or refuse with reason.
- Risk hypothesis: Potential cycle-time or consistency exposure where execution depends on human inspection, adjudication or manual work.
- Candidate intervention patterns: Workflow orchestration; Rules-assisted validation; Human-in-the-loop automation
- Sources: src-49cfr373, src-cmr, src-gs1-epcis

### LTL-05::TF-RECONCILIATION
- A5 task: LTL-05 — Dispatch pickup, accept freight and establish custody
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Positive identity match, timestamp/location, condition/count variance and custody acknowledgement.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-49cfr373, src-cmr, src-gs1-epcis

### LTL-05::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-05 — Dispatch pickup, accept freight and establish custody
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 2 document IDs · Evidence: Dispatch event, pickup scan, receipt/BOL acknowledgement, count/condition record and reservation/refusal.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-49cfr373, src-cmr, src-gs1-epcis

### LTL-05::TF-TIMING
- A5 task: LTL-05 — Dispatch pickup, accept freight and establish custody
- A3 area: Pickup request, readiness and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Appointment window; acceptance/refusal communication clock.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-49cfr373, src-cmr, src-gs1-epcis

### LTL-06::TF-HUMAN-INSPECTION
- A5 task: LTL-06 — Receive at origin service centre and verify handling-unit state
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Human / inspection dependency
- Source-confidence: HIGH
- Evidence from A5 contract: action: Unload, identify, inspect, measure/reweigh where controlled, receive or hold.
- Risk hypothesis: Potential cycle-time or consistency exposure where execution depends on human inspection, adjudication or manual work.
- Candidate intervention patterns: Workflow orchestration; Rules-assisted validation; Human-in-the-loop automation
- Sources: src-gs1-epcis, src-gs1-cbv, src-gs1-genspec, src-nmfc

### LTL-06::TF-RECONCILIATION
- A5 task: LTL-06 — Receive at origin service centre and verify handling-unit state
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: decision: Do handling-unit identity, count, weight/dimensions, condition and routing attributes reconcile?
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-gs1-epcis, src-gs1-cbv, src-gs1-genspec, src-nmfc

### LTL-06::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-06 — Receive at origin service centre and verify handling-unit state
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 2 document IDs · Evidence: Node receipt, scans, measurements, condition images/records and variance case.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-gs1-epcis, src-gs1-cbv, src-gs1-genspec, src-nmfc

### LTL-06::TF-CONTROL
- A5 task: LTL-06 — Receive at origin service centre and verify handling-unit state
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: decisionAuthority: Node supervisor; controlled hold/release authority
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-gs1-epcis, src-gs1-cbv, src-gs1-genspec, src-nmfc

### LTL-07::TF-RECONCILIATION
- A5 task: LTL-07 — Build consolidation and authorize origin load
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Planned-versus-scanned unit reconciliation and supervisor release for exceptions.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-scor, src-uncefact-rdm, src-gs1-epcis

### LTL-07::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-07 — Build consolidation and authorize origin load
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 0 document IDs · Evidence: Load plan, manifest, scan reconciliation, seal/closure evidence where used and release.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-scor, src-uncefact-rdm, src-gs1-epcis

### LTL-07::TF-TIMING
- A5 task: LTL-07 — Build consolidation and authorize origin load
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Outbound cut-off and dispatch deadline.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-scor, src-uncefact-rdm, src-gs1-epcis

### LTL-07::TF-CONTROL
- A5 task: LTL-07 — Build consolidation and authorize origin load
- A3 area: Origin terminal receipt and consolidation
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Planned-versus-scanned unit reconciliation and supervisor release for exceptions.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-scor, src-uncefact-rdm, src-gs1-epcis

### LTL-09::TF-RECONCILIATION
- A5 task: LTL-09 — Unload, sort and cross-dock at an intermediate service centre
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: decision: Does each unit reconcile and which outbound route/door/load should receive it?
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-gs1-epcis, src-gs1-cbv, src-scor

### LTL-09::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-09 — Unload, sort and cross-dock at an intermediate service centre
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: CONDITIONAL
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-gs1-epcis, src-gs1-cbv, src-scor

### LTL-09::TF-TIMING
- A5 task: LTL-09 — Unload, sort and cross-dock at an intermediate service centre
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Connection cut-off, dwell threshold and exception escalation clock.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-gs1-epcis, src-gs1-cbv, src-scor

### LTL-09::TF-CONTROL
- A5 task: LTL-09 — Unload, sort and cross-dock at an intermediate service centre
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Inbound-to-outbound scan reconciliation, missort prevention, damage/shortage capture and controlled release.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-gs1-epcis, src-gs1-cbv, src-scor

### LTL-10::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-10 — Transfer or interchange to the next network leg
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-carrier-platform / sys-forwarder-platform · Authority: sys-tms
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-uncefact-rdm, src-cmr, src-gs1-epcis

### LTL-10::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-10 — Transfer or interchange to the next network leg
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: CONDITIONAL
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-uncefact-rdm, src-cmr, src-gs1-epcis

### LTL-10::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-10 — Transfer or interchange to the next network leg
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 2 document IDs · Evidence: Interchange receipt, custody record, successor leg ID, document link and timestamps.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-uncefact-rdm, src-cmr, src-gs1-epcis

### LTL-10::TF-TIMING
- A5 task: LTL-10 — Transfer or interchange to the next network leg
- A3 area: Road network movement and transfer
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Connection cut-off and acceptance clock.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-uncefact-rdm, src-cmr, src-gs1-epcis

### LTL-11::TF-RECONCILIATION
- A5 task: LTL-11 — Deconsolidate and build the destination-delivery load
- A3 area: Destination readiness, delivery and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: rule: Receipt reconciliation, active holds, service/recipient constraints, route capacity and delivery readiness must pass.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-scor, src-gs1-epcis, src-uncefact-rdm

### LTL-11::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-11 — Deconsolidate and build the destination-delivery load
- A3 area: Destination readiness, delivery and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 0 document IDs · Evidence: Destination receipt, unit state, route/stop/load plan and release.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-scor, src-gs1-epcis, src-uncefact-rdm

### LTL-11::TF-TIMING
- A5 task: LTL-11 — Deconsolidate and build the destination-delivery load
- A3 area: Destination readiness, delivery and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Delivery-plan cut-off and commitment window.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-scor, src-gs1-epcis, src-uncefact-rdm

### LTL-12::TF-TIMING
- A5 task: LTL-12 — Confirm destination readiness, appointment and delivery dispatch
- A3 area: Destination readiness, delivery and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Appointment and promised-delivery window.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-apqc-pcf, src-uncefact-rdm

### LTL-13::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-13 — Attempt delivery, capture acceptance/reservations and close custody
- A3 area: Destination readiness, delivery and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-mobile-delivery / sys-dms · Authority: sys-last-mile
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-cmr, src-gs1-epcis, src-apqc-pcf

### LTL-13::TF-TIMING
- A5 task: LTL-13 — Attempt delivery, capture acceptance/reservations and close custody
- A3 area: Destination readiness, delivery and acceptance
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Delivery window; damage/shortage/refusal notification and claim clocks remain source/contract specific.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-cmr, src-gs1-epcis, src-apqc-pcf

### LTL-14::TF-RECONCILIATION
- A5 task: LTL-14 — Detect, classify and assign execution variance
- A3 area: Execution exception and recovery
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Duplicate-case prevention, severity model, owner/clock assignment and evidence preservation.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-scor, src-apqc-pcf, src-gs1-epcis, src-iso10002

### LTL-14::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-14 — Detect, classify and assign execution variance
- A3 area: Execution exception and recovery
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-event-platform / sys-wms / sys-tms / sys-crm · Authority: sys-case
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-scor, src-apqc-pcf, src-gs1-epcis, src-iso10002

### LTL-14::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-14 — Detect, classify and assign execution variance
- A3 area: Execution exception and recovery
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: EXCEPTION
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-scor, src-apqc-pcf, src-gs1-epcis, src-iso10002

### LTL-15::TF-RECONCILIATION
- A5 task: LTL-15 — Contain, replan and recover service
- A3 area: Execution exception and recovery
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Decision record, authority, alternative evaluation, action confirmation, state reconciliation and closure evidence.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-scor, src-apqc-pcf, src-iso10002

### LTL-15::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-15 — Contain, replan and recover service
- A3 area: Execution exception and recovery
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-case / sys-control-tower · Authority: sys-workflow
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-scor, src-apqc-pcf, src-iso10002

### LTL-15::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-15 — Contain, replan and recover service
- A3 area: Execution exception and recovery
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: EXCEPTION
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-scor, src-apqc-pcf, src-iso10002

### LTL-16::TF-RECONCILIATION
- A5 task: LTL-16 — Calculate preliminary and executed freight charges
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: rule: Reconcile contract/rate version, measured facts, service events, accessorial evidence, tax context and approval tolerance.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-dsdc-pfc, src-x12, src-apqc-pcf

### LTL-16::TF-TIMING
- A5 task: LTL-16 — Calculate preliminary and executed freight charges
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Accrual/billing cut-off and dispute-notice windows by contract/policy.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-dsdc-pfc, src-x12, src-apqc-pcf

### LTL-16::TF-CONTROL
- A5 task: LTL-16 — Calculate preliminary and executed freight charges
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Quote-to-charge comparison, duplicate charge, effective-rate, evidence and approval controls.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-dsdc-pfc, src-x12, src-apqc-pcf

### LTL-16::TF-FINANCIAL-OBJECT
- A5 task: LTL-16 — Calculate preliminary and executed freight charges
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Financial-object dependency
- Source-confidence: HIGH
- Evidence from A5 contract: Outputs: obj-freight-charge, obj-accrual
- Risk hypothesis: Potential financial leakage or settlement exposure if the governed execution state feeding a financial object is incomplete or inconsistent.
- Candidate intervention patterns: Automated charge validation; Revenue-assurance control; Financial reconciliation
- Sources: src-dsdc-pfc, src-x12, src-apqc-pcf

### LTL-17::TF-RECONCILIATION
- A5 task: LTL-17 — Invoice, audit, approve and settle transport obligations
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: decision: Does invoice/receivable reconcile to contract, rate, shipment, performed service, evidence, tax and tolerance?
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-apqc-pcf, src-x12, src-uncefact-rdm

### LTL-17::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-17 — Invoice, audit, approve and settle transport obligations
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-billing / supplier billing · Authority: sys-erp
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-apqc-pcf, src-x12, src-uncefact-rdm

### LTL-17::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-17 — Invoice, audit, approve and settle transport obligations
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 1 document IDs · Evidence: Invoice, audit result, approval, posting, payment/receipt and settlement reference.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-apqc-pcf, src-x12, src-uncefact-rdm

### LTL-17::TF-CONTROL
- A5 task: LTL-17 — Invoice, audit, approve and settle transport obligations
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Duplicate, three-way/evidence match, tolerance, approval, beneficiary and payment-release controls.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-apqc-pcf, src-x12, src-uncefact-rdm

### LTL-17::TF-FINANCIAL-OBJECT
- A5 task: LTL-17 — Invoice, audit, approve and settle transport obligations
- A3 area: Freight charge, invoice and settlement
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Financial-object dependency
- Source-confidence: HIGH
- Evidence from A5 contract: Outputs: obj-approved-payable, obj-payment, obj-settlement, obj-control-evidence
- Risk hypothesis: Potential financial leakage or settlement exposure if the governed execution state feeding a financial object is incomplete or inconsistent.
- Candidate intervention patterns: Automated charge validation; Revenue-assurance control; Financial reconciliation
- Sources: src-apqc-pcf, src-x12, src-uncefact-rdm

### LTL-18::TF-HUMAN-INSPECTION
- A5 task: LTL-18 — Adjudicate cargo/service claim or billing dispute
- A3 area: Claims and disputes resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Human / inspection dependency
- Source-confidence: HIGH
- Evidence from A5 contract: decisionAuthority: Authorized adjudicator; court/authority where applicable
- Risk hypothesis: Potential cycle-time or consistency exposure where execution depends on human inspection, adjudication or manual work.
- Candidate intervention patterns: Workflow orchestration; Rules-assisted validation; Human-in-the-loop automation
- Sources: src-cmr, src-49usc14706, src-49cfr370, src-apqc-pcf, src-iso10002

### LTL-18::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-18 — Adjudicate cargo/service claim or billing dispute
- A3 area: Claims and disputes resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: EXCEPTION
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-cmr, src-49usc14706, src-49cfr370, src-apqc-pcf, src-iso10002

### LTL-18::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-18 — Adjudicate cargo/service claim or billing dispute
- A3 area: Claims and disputes resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 2 document IDs · Evidence: Claim file, liability/coverage position, decision, settlement/decline and recovery evidence.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-cmr, src-49usc14706, src-49cfr370, src-apqc-pcf, src-iso10002

### LTL-18::TF-FINANCIAL-OBJECT
- A5 task: LTL-18 — Adjudicate cargo/service claim or billing dispute
- A3 area: Claims and disputes resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Financial-object dependency
- Source-confidence: HIGH
- Evidence from A5 contract: Outputs: obj-liability-position, obj-coverage-position, obj-credit-adjustment, obj-settlement
- Risk hypothesis: Potential financial leakage or settlement exposure if the governed execution state feeding a financial object is incomplete or inconsistent.
- Candidate intervention patterns: Automated charge validation; Revenue-assurance control; Financial reconciliation
- Sources: src-cmr, src-49usc14706, src-49cfr370, src-apqc-pcf, src-iso10002

### LTL-19::TF-HUMAN-INSPECTION
- A5 task: LTL-19 — Resolve regulatory scope, operate hold/release and retain evidence
- A3 area: Trade, regulatory hold and release
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Human / inspection dependency
- Source-confidence: HIGH
- Evidence from A5 contract: action: Classify/screen, file where required, receive response, inspect, hold, release or escalate.
- Risk hypothesis: Potential cycle-time or consistency exposure where execution depends on human inspection, adjudication or manual work.
- Candidate intervention patterns: Workflow orchestration; Rules-assisted validation; Human-in-the-loop automation
- Sources: src-wco-dm, src-49cfr177, src-cmr, src-adr, src-atp, src-tir, src-india-eway

### LTL-19::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-19 — Resolve regulatory scope, operate hold/release and retain evidence
- A3 area: Trade, regulatory hold and release
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: CONDITIONAL
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-wco-dm, src-49cfr177, src-cmr, src-adr, src-atp, src-tir, src-india-eway

### LTL-19::TF-EVIDENCE-DOCUMENT
- A5 task: LTL-19 — Resolve regulatory scope, operate hold/release and retain evidence
- A3 area: Trade, regulatory hold and release
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Evidence / document dependency
- Source-confidence: HIGH
- Evidence from A5 contract: 3 document IDs · Evidence: Scope record, declaration/shipping paper, authority response, inspection, hold/release and retained evidence.
- Risk hypothesis: Potential handling or validation effort where the task depends on multiple governed documents or scan/photo/document evidence.
- Candidate intervention patterns: Document intelligence; Computer-vision evidence capture; Automated completeness validation
- Sources: src-wco-dm, src-49cfr177, src-cmr, src-adr, src-atp, src-tir, src-india-eway

### LTL-19::TF-TIMING
- A5 task: LTL-19 — Resolve regulatory scope, operate hold/release and retain evidence
- A3 area: Trade, regulatory hold and release
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Authority, transit, filing and response clock from operative source.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-wco-dm, src-49cfr177, src-cmr, src-adr, src-atp, src-tir, src-india-eway

### LTL-19::TF-CONTROL
- A5 task: LTL-19 — Resolve regulatory scope, operate hold/release and retain evidence
- A3 area: Trade, regulatory hold and release
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Source/effective-date record, filing correlation, authority-response provenance and hold-release segregation.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-wco-dm, src-49cfr177, src-cmr, src-adr, src-atp, src-tir, src-india-eway

### LTL-21::TF-RECONCILIATION
- A5 task: LTL-21 — Reconcile party, location, shipment, unit and network identities
- A3 area: Master and reference-data control
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Reconciliation dependency
- Source-confidence: HIGH
- Evidence from A5 contract: evidence: Crosswalk, stewardship decision, source/version, changed records and consumer acknowledgements.
- Risk hypothesis: Potential rework or state-consistency exposure where execution depends on reconciliation, discrepancy resolution or duplicate control.
- Candidate intervention patterns: Deterministic validation rules; Automated reconciliation; Exception-based workflow
- Sources: src-uncefact-rdm, src-gs1-genspec, src-scor, src-nmfta-scac, src-nmfta-splc

### LTL-21::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-21 — Reconcile party, location, shipment, unit and network identities
- A3 area: Master and reference-data control
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: CONDITIONAL
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-uncefact-rdm, src-gs1-genspec, src-scor, src-nmfta-scac, src-nmfta-splc

### LTL-22::TF-SYSTEM-AUTHORITY-HANDOFF
- A5 task: LTL-22 — Coordinate customer communication and resolution evidence
- A3 area: Customer service coordination and resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Cross-system authority handoff
- Source-confidence: HIGH
- Evidence from A5 contract: Producer: sys-crm / sys-customer-portal · Authority: sys-case
- Risk hypothesis: Potential synchronization exposure where the producing system and system of authority are different governed systems.
- Candidate intervention patterns: API/event synchronization; Authoritative-state orchestration; Integration monitoring
- Sources: src-apqc-pcf, src-iso10002

### LTL-22::TF-CONDITIONAL-EXCEPTION
- A5 task: LTL-22 — Coordinate customer communication and resolution evidence
- A3 area: Customer service coordination and resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Conditional / exception branch
- Source-confidence: HIGH
- Evidence from A5 contract: Path type: CONDITIONAL
- Risk hypothesis: Potential operational complexity where the task is conditional or exception-path execution rather than the standard path.
- Candidate intervention patterns: Rules-based routing; Exception classification; Case orchestration
- Sources: src-apqc-pcf, src-iso10002

### LTL-22::TF-TIMING
- A5 task: LTL-22 — Coordinate customer communication and resolution evidence
- A3 area: Customer service coordination and resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Time-window dependency
- Source-confidence: HIGH
- Evidence from A5 contract: clock: Service/contract SLA and active exception/claim clock.
- Risk hypothesis: Potential service-level exposure where execution depends on a governed validity period, cutoff, response clock or operating window.
- Candidate intervention patterns: Event-driven alerts; Deadline orchestration; Predictive exception warning
- Sources: src-apqc-pcf, src-iso10002

### LTL-22::TF-CONTROL
- A5 task: LTL-22 — Coordinate customer communication and resolution evidence
- A3 area: Customer service coordination and resolution
- Classification: ATLAS-DERIVED SIGNAL
- Signal: Control / approval dependency
- Source-confidence: HIGH
- Evidence from A5 contract: control: Identity/authentication, case linkage, SLA, approval and communication-history controls.
- Risk hypothesis: Potential control latency or audit burden where execution depends on explicit approval, override, qualification, regulatory or release controls.
- Candidate intervention patterns: Policy/rules engine; Approval workflow; Automated control evidence
- Sources: src-apqc-pcf, src-iso10002

## Epistemic boundary
1. **Source-backed A5 contract** — governed Atlas content.
2. **Derived signal** — deterministic rule applied to the A5 contract.
3. **Risk hypothesis** — requires operational/client validation.
4. **Automation hypothesis** — candidate intervention only; not a recommendation until validated.
