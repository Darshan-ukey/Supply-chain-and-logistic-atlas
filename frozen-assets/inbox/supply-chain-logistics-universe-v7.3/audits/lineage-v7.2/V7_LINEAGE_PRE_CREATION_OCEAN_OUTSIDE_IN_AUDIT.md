# PRE-CREATION OCEAN OUTSIDE-IN AUDIT — UNIVERSE V7

**Audit date:** 30 Aug 2026  
**Baseline:** Frozen Universe V6.2.2 canonical parent + V6.2.3 accepted release-lineage guidance  
**Focus:** Ocean FCL / Ocean LCL parent-level implications only  
**Rule:** External research may propose a Universe change; it cannot silently mutate the parent. Daughter-specific A3/A4/A5 stays in the daughter module.

## Verdict

The existing Universe was already materially stronger than expected. It already held the 71-destination universe, Ocean FCL/LCL as distinct reference destinations, 17 authority domains, Systems & Exchanges, Context Resolver, DCSA Booking 2.0.4, DCSA eBL 3.0.3, DCSA Track & Trace 2.2, WCO Data Model 4.3.0 and core maritime/legal source families.

The Ocean outside-in audit therefore **did not justify a broad rewrite**. V7 should be an additive parent refresh with targeted governance/ontology/source improvements.

## Current official source findings

| Source / authority | Finding at audit | Universe action |
|---|---|---|
| DCSA Industry Blueprint | 2026.Q1 is the current living blueprint; explicitly separates Shipment, Equipment and Vessel journeys | **ADD** as the primary current Ocean process-reference layer |
| DCSA Booking | 2.0.4 published 13 Apr 2026 | **PRESERVE** — already current in baseline |
| DCSA Bill of Lading | 3.0.3 published 13 Apr 2026 | **PRESERVE** — already current in baseline; strengthen SI/TD legal/document model |
| DCSA Port Call | 2.0 is current implementation family | **ADD** current source pointer; prior JIT retained as lineage only |
| DCSA Verified Gross Mass | 1.0.1 published 13 Mar 2026 | **ADD** current versioned source |
| DCSA Arrival Notice | 1.0.1 published 13 Mar 2026 | **ADD** current versioned source |
| DCSA Operational Vessel Schedules | 3.0.2 published 12 Jun 2026 | **ADD** current versioned source |
| DCSA Commercial Schedules | 1.0.3 published 12 Jun 2026 | **ADD** current versioned source; reinforces leg/cut-off semantics |
| DCSA Load List & Bay Plan | Current DCSA cargo-operations framework for container volume/stowage exchange | **ADD** source and exchange semantics |
| IMO Compendium | FAL.5/Circ.56 approved at FAL 50, Mar 2026; supersedes FAL.5/Circ.55 | **ADD** Maritime Single Window / facilitation data source |
| IMO IMDG Code | 2024 Edition incl. Amendment 42-24 mandatory from 1 Jan 2026 | **ADD/REFRESH** current DG baseline |
| IMO/ILO/UNECE CTU Code | 2014 code remains published non-mandatory baseline; revision work exists | **ADD + WATCH**; do not present revision work as adopted law |
| TIC4.0 | Release 2025.019, May 2026 | **ADD** current terminal semantics reference |
| FIATA eFBL | 2026 practical guide; aligned with UN/CEFACT MMT RDM and WCO Data Model | **ADD** for LCL/forwarder/document layer |
| WCO Data Model | 4.3.0 already present | **PRESERVE** |

## Parent-level changes justified by the audit

1. **Living source governance** — continuous monitoring + periodic issuer review + daughter-module outside-in review.
2. **Execution instance / governed leg model** — generic, reusable across Ocean and future multimodal daughters.
3. **Typed document + legal/lifecycle state model** — needed for SI, B/L/eBL, House/Master, VGM, Arrival Notice, release instructions.
4. **House/Master and consolidation relationship semantics** — generic relationship vocabulary, not hard-coded Ocean workflow.
5. **Temporal constraints** — cut-offs, planned/estimated/actual times and leg-specific timing must be modelled structurally.
6. **Systems/exchanges** — carrier documentation, eBL platform, TOS, CFS, Maritime Single Window and directional exchange semantics.
7. **Context-required sea-carriage/legal regime handling** — no global assumption that one liability regime always applies.
8. **Ocean object vocabulary** — container, seal, consignment, consolidation/deconsolidation, CFS handoff, port call, SI, VGM, arrival notice.

## Items deliberately NOT promoted into Universe V7

- Detailed FCL A3/A4/A5 workflows.
- Detailed LCL CFS sequence.
- House/Master operational workflow assumptions not supported universally.
- Carrier/NVOCC/forwarder client-specific operating practices.
- Ocean-specific exception/recovery branches.
- Emerging DCSA roadmap items (e.g. future Track & Trace 3.x / release / DG initiatives) as active canonical execution truth.
- Work Decomposition, WorkDefinition or Atlas Work Warehouse content.

These stay in the daughter-module build and must pass their own outside-in/source/publication gates.

## Official web references used

- https://dcsa.org/standards/industry-blueprint
- https://developer.dcsa.org/implementing-booking
- https://developer.dcsa.org/implementing-bill-of-lading-si-td
- https://developer.dcsa.org/implementing-port-call
- https://reference.dcsa.org/content/standards/releases/verified-gross-mass/v1-0-1
- https://reference.dcsa.org/content/standards/releases/arrival-notice/v1-0-1/arrival-notice-v1-0-1-implementation-guide
- https://developer.dcsa.org/implementing-operational-vessel-schedules
- https://developer.dcsa.org/implementing-commercial-schedules
- https://dcsa.org/standards/load-list-and-bay-plan
- https://imocompendium.imo.org/public/IMO-Compendium/Current/in1.htm
- https://www.imo.org/en/publications/pages/imdg%20code.aspx
- https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx
- https://tic40.org/standards/
- https://fiata.org/n/fiata-launches-efbl-guide-a-roadmap-to-digital-freight-forwarding-and-trusted-trade/

**Pre-creation gate: PASS.** Changes were sufficiently parent-level, additive and source-backed to justify Universe V7.
