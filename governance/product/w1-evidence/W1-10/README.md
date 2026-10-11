# W1-10 RECEIPT: framework coverage mapping (SCOR L0-L2, APQC PCF 8.0, other registered frameworks)
Op: W110-20261011-0803-IST | 2026-10-11 | Claude Sonnet 5.5 (scheduled Atlas monitor; executor; read-only) | State set: DONE_CLAIMED (not VERIFIED)
Risk class (DEC-052/055): MEDIUM, QA_REQUIRED (QA-1, QA-2); batch QA = W1-12 (ChatGPT). Protocol cited: frozen v1 (gap classes 1-5) + DEC-053 A1 read + DEC-057 acceptance addendum. This task proposes classes only; W1-12 challenges every assignment and the Owner resolves. No disposition (PASS/PATCH/REDESIGN/REGENERATE) is given here.
Authorization: READ-ONLY SOURCE ACCESS; evidence writes only to Wave 0 Control row 19, Change Event Ledger, Integrity Gate and Project/Drive/GitHub-evidence copies (DEC-050, DEC-055 13). No backend, frozen-file, Linear or release write.

## 1. Result in one view
Mapped 213 rows to the Universe: SCOR DS 41 nodes (Orchestrate 13, L1 6, L2 22), APQC PCF 8.0 145 nodes (L1 13, L2 74, L3 30, L4 28), and 27 rows for the other registered frameworks. Of the 41 SCOR nodes, 33 are FULL and 8 PARTIAL, none unmapped: all 6 L1 and 17 of 22 L2 are FULL; the 5 PARTIAL L2 are P2-P6 (cited only as one block "P2-P6 process plans"); the 3 PARTIAL Orchestrate nodes are OE1 and OE12 (no construct cites them) and OE5 (workforce lens, unresearched). For APQC, 70 of 145 are FULL, 40 PARTIAL, 35 NONE. Of the 35 NONE nodes, 34 are proposed class 5 (outside the logistics Universe: enterprise strategy, R&D, marketing, HR administration, IT organization, GL/payroll, investor/board/PR) and 1 is proposed class 1: **6.4 Manage product recalls and regulatory audits (critical)**. Gap-class totals over unmapped and partial framework nodes: class 1: 1; class 2 (present via a different abstraction or at lens level only): 33 (SCOR 8, APQC 25); class 3 (daughter-level specialization): 2 (DCSA vessel journey and liner phase) plus the channel variants noted on SCOR O1-O3 and F1-F3 which are FULL at parent level; class 4: 0; class 5: 46 (APQC 45, ISA-95 control levels 1).

Reading of the numbers. FULL/PARTIAL/NONE counts are not a score: the protocol thresholds (90 percent in-scope mapping, 100 percent critical) apply to the L4 value-chain mapping of W1-11, not to this framework-coverage task. Excluding proposed class 5 nodes, APQC has 100 in-scope nodes: 70 FULL, 29 PARTIAL, 1 NONE (6.4).

## 2. Scope definition (what "registered frameworks" means here) and evidence basis
SCOR L1-L2 was named by the task. "Other registered frameworks" was not enumerated, so I fixed it from the V7.3 registry: process or reference frameworks among the 67 governed sources and 17 reference groups: APQC PCF 8.0 (node-level, L1-L2 with L3/L4 depth for the supply-chain categories 4.0 and 3.5), ISA-95/IEC 62264, DCSA Industry Blueprint 2026.Q1, Contract Management Standard 4th ed., UN/CEFACT International Forwarding and Transport BRS v2, and the ISO management-system references (9001, 31000, 22301, 37301, 44001, 55001, 30401, 10002, 30414). Excluded as not process frameworks: BPMN and DMN (notations), ISO 22400 (KPI set), CIPS/ISM (competency references), GS1/ISO 8000/ISO 28000 and the other data, identity and legal-instrument standards. This reading is mine; W1-12 should confirm or widen it.
Independent structure of each framework (not the Universe's own lists) was taken from: APQC Cross-Industry PCF 8.0 Excel (Project file, 13 L1, 74 L2, 2,017 nodes total in the category sheets); SCOR DS from the ASCM introduction document "SCOR Digital Standard, Version 14.0 (c) ASCM 2022" (scor.ascm.org/api/files/24: Orchestrate L0, six L1, Plan and Source L2 names, code scheme) and an unversioned "Quick Reference Guide, SCOR Digital Standard" copy (setsustainability.com/download/etnv23axhujkryi) that lists every L2 name and OE1-OE13. The Universe's SCOR lists (13 OE, 6 L1, 22 L2) equal those lists name for name; the only wording difference is OE10 ("Environment, Social, and Governance" in the guide, "Environmental, Social and Governance" in the Universe).
Mapping basis column: EXPLICIT_CITATION = the Universe cites the node code in a domain, lens or cycle reference (computed by script, ranges expanded); ANCESTOR_CITED = only a parent code is cited; SCOPE_READ = my reading of domain/lens scope text, which is a judgement.

## 3. Method
1. Frozen V7.3 HTML fetched at commit e5f5029 and extracted with the W1-02 method (read-only export hook in a scratch copy, Chromium, 0 page errors); SHA-256 recomputed 31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd, equal to the expected value. The frozen file was not edited.
2. Explicit references: scripts/explicit.py collects every SCOR and APQC reference from the 15 domains, 27 lenses and 9 cycles and expands ranges (P1-P6, S2-S3, 4.2.1-4.2.3, 4.4.3.1-4.4.3.8 and so on).
3. Every framework node received a status (FULL, PARTIAL, NONE, NA), the Universe constructs that carry it, a proposed gap class, a criticality flag and a DEC-057 type (STRUCTURAL, DEPTH, OUT_OF_SCOPE), with a rationale (scripts/mapping_data.py, scripts/tier2.py).
4. Reverse check of the Universe's own citations against PCF 8.0: 43 APQC citations (constant list, 15 domains) checked; 40 equal the PCF name; 3 are shortened labels (4.4.2 "Plan/manage inbound material flow", 4.4.1.7 "Reverse logistics strategy" vs "Define reverse logistics strategy", 4.4.4.4 "Process/audit carrier invoices"). No citation points to a code absent from PCF 8.0.
Status meanings: FULL = a Universe domain sub-capability or lens carries the node's scope; PARTIAL = carried only in part, at lens level with readiness below READY, or by block citation; NONE = no construct carries it; NA = not a process structure or structure not retrieved.

## 4. SCOR: nodes that are not FULL
| code | name | status | gap_class | constructs | rationale |
|---|---|---|---|---|---|
| OE1 | Supply Chain Strategy | PARTIAL | 2 | D:plan(Performance policy,Network design); L:ecl-a; L:ecl-p | Strategy setting is only implicit in plan-domain policy sub-capabilities; no construct cites OE1 (script: zero explicit references). Proposed anchor addition, no ID change. |
| OE5 | Human Resources | PARTIAL | 2 | L:ecl-w (SOURCE RESEARCH REQUIRED) | Present as a lens only; the Universe itself states no supply-chain workforce taxonomy exists yet (lens W gap text). |
| OE12 | Segmentation | PARTIAL | 2 | L:ecl-i (service segmentation); L:ecl-h (supplier segmentation) | Segmentation appears only as text inside two lenses; no construct cites OE12 (zero explicit references). |
| P2 | Plan Order | PARTIAL | 2 | D:plan | P2-P6 are cited as one block ("P2-P6 process plans"); the plan domain has five sub-capabilities, none per process plan. Present via a different abstraction (single Plan domain). |
| P3 | Plan Source | PARTIAL | 2 | D:plan; D:source | As P2: block citation only; sourcing plan appears as Category plan in the Source domain. |
| P4 | Plan Transform | PARTIAL | 2 | D:plan; D:transform(Schedule); C:cycle-plan-produce | As P2; explicit P4 on cycle Plan-to-Produce and lens J. |
| P5 | Plan Fulfill | PARTIAL | 2 | D:plan(Deployment planning); L:ecl-i | As P2; explicit P5 on lens I. |
| P6 | Plan Return | PARTIAL | 2 | D:plan; D:returns(Plan reverse movement) | As P2; reverse-flow planning sits in returns sub-capability. |

All other SCOR nodes are FULL (Orchestrate OE2-OE4, OE6-OE11, OE13; all six L1; L2 O1-O3, S1-S4, T1-T3, F1-F3, R1-R3 and P1). Channel variants (B2C, B2B, intra-company) for O and F are carried by one domain each; I classed the channel-specific detail as class 3 (daughter-level), consistent with the lens D gap statement.

## 5. APQC PCF 8.0: proposed class 1 (the one item that would count as a Universe defect)
| code | name | status | gap_class | critical | dec057 | constructs | rationale |
|---|---|---|---|---|---|---|---|
| 6.4 | Manage product recalls and regulatory audits | NONE | 1 | Y | STRUCTURAL | (closest: D:returns; src-gs1-trace; D:trade) | Product recall and regulatory audit. PROPOSED CLASS 1 (challenge invited): the word "recall" does not occur anywhere in the frozen HTML (0 matches); returns domain scope starts at customer/supplier return signal, not regulator- or manufacturer-initiated trace-and-retrieve. Alternative reading, class 2: composable from returns + GS1 traceability + compliance lens Z. Critical because recall is a legal/regulatory step in pharma, automotive and consumer reference chains (W1-06 QA R1 flagged recall/returns generalization). |

Challenge points for W1-12: (a) is recall composable from returns + GS1 traceability + compliance lens Z (class 2) or a missing parent capability (class 1); (b) it is critical under the protocol definition only if a reference chain cannot complete without it, which holds for the regulated pharma, automotive and consumer chains; (c) DEC-057: a missing named capability whose composition has not been tested is a conceptual coverage question, so I record it as STRUCTURAL-candidate pending the W1-11 composition scenarios rather than as a confirmed defect.

## 6. APQC PCF 8.0: proposed class 2 (present via a different abstraction or at lens level only)
| code | name | status | constructs | rationale |
|---|---|---|---|---|
| 3.5.1 | Manage leads/opportunities | PARTIAL | D:commercial(Enquiry and solution) | Leads/opportunities: enquiry only. |
| 3.5.2 | Manage customers and accounts | PARTIAL | D:masterdata; D:customer | Customer/account management: party master data and service contacts. |
| 4.1.8 | Develop quality standards and procedures | PARTIAL | L:ecl-l | Quality standards and procedures: lens L (PARTIALLY READY), no domain. |
| 4.4.1.3 | Communicate outsourcing needs | PARTIAL | D:source; L:ecl-q; M:3pl,4pl | Outsourcing needs communication: provider sourcing and role overlays. |
| 5.0 | Deliver Services | PARTIAL | D:transform(service transformation); D:transport; D:delivery; D:warehouse (logistics services are themselves the delivered service) | Not cited anywhere (script). Service delivery for a service enterprise (e.g. a 3PL) is performed by the execution domains; no construct names service-delivery governance or resources. Flagged for challenge: whether PCF 5.0 should be an explicit anchor. |
| 5.1 | Establish service delivery governance and strategies | PARTIAL | D:plan(Performance policy) | Service delivery governance: only service policy in plan domain; not cited. |
| 5.2 | Manage service delivery resources | PARTIAL | D:assets; D:warehouse | Service delivery resources: assets/fleet and node capacity; not cited. |
| 5.3 | Manage and Operate Service Delivery System | PARTIAL | D:transform(service transformation); D:exception | Operate the delivery system: transform T2 and exception rail; not cited. |
| 5.4 | Deliver service to customer | PARTIAL | D:transport; D:delivery; D:warehouse | Deliver service to customer: realized by logistics execution domains for a logistics service provider; not cited. |
| 6.1 | Develop customer service strategy | PARTIAL | D:customer; D:plan(Performance policy) | Service strategy: only implicit in service policy. |
| 6.3 | Service products after sales | PARTIAL | D:assets(Maintain/repair/MRO); D:returns; D:customer | After-sales service: via T3/R3 and customer service; no after-sales construct. |
| 7.3 | Manage employee onboarding, training, and development | PARTIAL | L:ecl-w | Training/qualification for logistics roles appears in lens W text; taxonomy unresearched. |
| 7.7 | Manage employee information and analytics | PARTIAL | L:ecl-w | Workforce analytics: lens W only. |
| 8.4 | Manage information | PARTIAL | D:masterdata; L:ecl-g | Manage information: master and reference data governance. |
| 9.7 | Manage treasury operations | PARTIAL | D:finance(Trade finance); L:ecl-x; sys-treasury | Treasury operations: trade-finance/working-capital touchpoints; Treasury Management System is registered. |
| 9.8 | Manage internal controls | PARTIAL | L:ecl-z | Internal controls: lens Z (PARTIALLY READY). |
| 9.9 | Manage taxes | PARTIAL | D:trade(Duties/taxes); D:finance; sys-tax-engine | Taxes: duties/taxes in trade domain and tax engine system; indirect-tax accounting depth not modelled. Financial-settlement relevance noted; not an unmapped node. |
| 10.1 | Plan and acquire assets | PARTIAL | D:assets(Plan availability) | Plan and acquire assets: availability/allocation planning; acquisition itself not. |
| 11.3 | Manage remediation efforts | PARTIAL | D:exception(Contain/recover); D:claims | Remediation efforts: via exception recovery and claims rails. |
| 12.4 | Manage legal and ethical issues | PARTIAL | D:claims; L:ecl-z | Legal and ethical issues: liability conventions and claims branches. |
| 13.1 | Manage business processes | PARTIAL | L:ecl-aa; BPMN registered as notation | Business process management: notation and knowledge lens. |
| 13.6 | Manage Content | PARTIAL | L:ecl-aa; D:masterdata | Content management: document registry exists (19 document records) but no content-management construct. |
| 13.7 | Measure and benchmark | PARTIAL | D:plan(Performance policy); L:ecl-aa; OE3 | Measure and benchmark: performance policy and OE3. |
| 13.8 | Develop, Manage, and Deliver Analytics | PARTIAL | L:ecl-aa; sys-analytics | Analytics: lens AA (SOURCE RESEARCH REQUIRED) and analytics platform system. |
| 13.9 | Manage Environmental Health and Safety (EHS) | PARTIAL | L:ecl-w (safety); D:trade (dangerous goods, conditional) | EHS: "EHS"/"health and safety" do not occur in the frozen HTML (0 matches); workplace safety only as a word in lens W; transport dangerous-goods safety sits in the conditional dangerous-goods layer. Flagged for challenge (class 2 vs class 1). |

## 7. APQC PCF 8.0: proposed class 5 (outside the logistics Universe) and class-5 partials
| code | name | status | constructs | rationale |
|---|---|---|---|---|
| 1.0 | Develop Vision and Strategy | NONE |  | Enterprise vision and strategy; not a supply-chain operating capability. No construct cites it. SCOR OE1 is the nearest supply-chain-level strategy anchor (see OE1). |
| 1.1 | Define the business concept and long-term vision | NONE |  | Enterprise strategy. |
| 1.2 | Develop business strategy | NONE |  | Enterprise strategy. |
| 1.3 | Develop and measure strategic initiatives | NONE |  | Strategic initiatives; no supply-chain execution content. |
| 1.4 | Develop and maintain business models | NONE |  | Business model definition; the Universe's operating-role overlays (shipper, forwarder, 3PL...) describe roles, not enterprise business-model management. |
| 2.2 | Generate and define new product/service ideas | NONE |  | Idea generation / R&D. |
| 3.1 | Understand markets, customers, and capabilities | NONE |  | Market research. |
| 3.2 | Develop marketing strategy | NONE |  | Marketing strategy. |
| 3.3 | Develop and manage marketing plans | NONE |  | Marketing plans. |
| 3.5.5 | Manage sales partners and alliances | NONE |  | Selling-channel / sales organization processes; orders from these channels enter at commercial "Order capture". |
| 3.5.6 | Perform sales at physical outlets | NONE |  | Selling-channel / sales organization processes; orders from these channels enter at commercial "Order capture". |
| 3.5.7 | Perform field sales | NONE |  | Selling-channel / sales organization processes; orders from these channels enter at commercial "Order capture". |
| 3.5.8 | Perform digital sales | NONE |  | Selling-channel / sales organization processes; orders from these channels enter at commercial "Order capture". |
| 7.1 | Develop and manage human resources (HR) planning, policies, and strategies | NONE |  | HR planning: enterprise HR administration. |
| 7.2 | Recruit, source, and select employees | NONE |  | Recruiting: enterprise HR administration. |
| 7.4 | Manage employee relations | NONE |  | Employee relations: enterprise HR administration. |
| 7.5 | Reward and retain employees | NONE |  | Reward and retain: enterprise HR administration. |
| 7.6 | Redeploy and retire employees | NONE |  | Redeploy and retire: enterprise HR administration. |
| 7.8 | Manage employee communication | NONE |  | Employee communication: enterprise HR administration. |
| 8.1 | Develop and manage IT customer relationships | NONE |  | IT organization management; outside the logistics Universe. |
| 8.2 | Develop and manage IT business strategy | NONE |  | IT organization management; outside the logistics Universe. |
| 8.5 | Develop and manage services/solutions | NONE |  | IT organization management; outside the logistics Universe. |
| 8.6 | Deploy services/solutions | NONE |  | IT organization management; outside the logistics Universe. |
| 8.7 | Create and manage support services/solutions | NONE |  | IT organization management; outside the logistics Universe. |
| 9.3 | Perform general accounting and reporting | NONE |  | General ledger and reporting. |
| 9.4 | Manage fixed-asset project accounting | NONE |  | Fixed-asset project accounting. |
| 9.5 | Process payroll | NONE |  | Payroll. |
| 9.10 | Manage international funds/consolidation | NONE |  | Intercompany funds/consolidation. |
| 10.2 | Design and construct assets | NONE |  | Design and construct assets (capital projects). |
| 12.1 | Build investor relationships | NONE |  | Investor relations. |
| 12.3 | Manage relations with board of directors | NONE |  | Board relations. |
| 12.5 | Manage public relations program | NONE |  | Public relations. |
| 13.2 | Manage portfolio, program, and project | NONE |  | Portfolio/program/project management. |
| 13.4 | Manage change | NONE |  | Change management. |
| 2.0 | Develop and Manage Products and Services | PARTIAL | L:ecl-k | Only item/product lifecycle (introduction, change, retirement) is in scope via lens K; R&D design is not. |
| 2.1 | Govern and manage product/service development program | PARTIAL | L:ecl-k | Program governance for development is out of scope; item governance partly via lens K. |
| 2.3 | Develop products and services | PARTIAL | L:ecl-k | Product design out of scope; engineering change and item introduction via lens K (lens gap: needs sector research). |
| 3.0 | Market and Sell Products and Services | PARTIAL | D:commercial; L:ecl-d; L:ecl-f; L:ecl-o | Order, quote and rate parts are covered; marketing and sales planning are not. |
| 3.4 | Develop sales strategy | PARTIAL | D:commercial(Rate and pricing; Enquiry and solution) | Sales strategy is out of scope; pricing/solution design touchpoint only. |
| 7.0 | Develop and Manage Human Resources | PARTIAL | L:ecl-w (SOURCE RESEARCH REQUIRED) | Enterprise HR category; only supply-chain workforce aspects (skill, qualification, shift, safety) are in lens W, itself unresearched. |
| 8.0 | Manage Information Technology (IT) | PARTIAL | D:masterdata; L:ecl-g; L:ecl-aa | Not cited. Enterprise IT management is outside scope; information management (8.4) is carried by master-data domain. |
| 8.3 | Develop and manage IT resilience and risk | PARTIAL | L:ecl-u | IT resilience and risk: enterprise risk lens only. |
| 9.1 | Perform planning and management accounting | PARTIAL | D:finance(Freight accrual; Allocation) | Management accounting: only freight cost accrual/allocation. |
| 12.0 | Manage External Relationships | PARTIAL | L:ecl-e; L:ecl-h; D:claims | Supplier/contract relationship parts covered; investor/board/PR relations out of scope. |
| 12.2 | Manage government and industry relationships | PARTIAL | D:trade(authority/broker) | Government relations: only regulator interaction in trade domain. |

## 8. Other registered frameworks
| framework | level | code | name | status | gap_class | constructs | rationale |
|---|---|---|---|---|---|---|---|
| ISA-95 / IEC 62264 | Level | L0-L2 | Physical process; sensing/manipulating; monitoring and supervising control | NONE | 5 |  | Control-system levels are outside the logistics Universe; ISA-95 is registered only for the enterprise-control boundary. |
| ISA-95 / IEC 62264 | Level | L3 | Manufacturing operations management | FULL | 0 | D:transform; D:warehouse; D:assets; L:ecl-j | Operations management carried by transform, warehouse and asset domains; lens J cites ISA-95. |
| ISA-95 / IEC 62264 | Level | L4 | Business planning and logistics | FULL | 0 | D:plan; D:source; D:commercial; D:transport | Business planning and logistics levels. |
| ISA-95 / IEC 62264 | Part 3 category | P3-prod | Production operations management | FULL | 0 | D:transform | Maps to Transform. |
| ISA-95 / IEC 62264 | Part 3 category | P3-maint | Maintenance operations management | FULL | 0 | D:assets(Maintain/repair/MRO) | Maps to Assets. |
| ISA-95 / IEC 62264 | Part 3 category | P3-qual | Quality operations management | PARTIAL | 2 | D:transform(Inspect and test); L:ecl-l | Quality is a lens (PARTIALLY READY) plus transform inspection. |
| ISA-95 / IEC 62264 | Part 3 category | P3-inv | Inventory operations management | FULL | 0 | D:warehouse | Maps to Inventory & warehousing. |
| DCSA Industry Blueprint 2026.Q1 | Journey | SHIP | Shipment journey (booking to payment) | FULL | 0 | D:commercial; D:transport; D:trade; D:finance; M:ocean-fcl | Booking-to-payment spans commercial, transport, trade and finance. |
| DCSA Industry Blueprint 2026.Q1 | Journey | EQUIP | Equipment journey (pick-up to return) | FULL | 0 | D:assets(Reposition empty equipment); D:transport | Container equipment movements: assets and transport. |
| DCSA Industry Blueprint 2026.Q1 | Journey | VESSEL | Vessel journey (departure to arrival, port calls) | PARTIAL | 3 | M:ocean-fcl; M:ocean-lcl; D:transport(Main carriage/transship) | Vessel/port-call operations are carrier-side ocean-mode specialization (Ocean daughter), not a parent capability. |
| DCSA Industry Blueprint 2026.Q1 | Phase | PRE | Pre-shipping | FULL | 0 | D:commercial; D:trade; D:transport | Activities before pick-up. |
| DCSA Industry Blueprint 2026.Q1 | Phase | LINER | Liner operation | PARTIAL | 3 | M:ocean-fcl; D:transport | Liner operations belong to the Ocean mode overlay/daughter. |
| DCSA Industry Blueprint 2026.Q1 | Phase | POST | Post-shipping | FULL | 0 | D:transport; D:delivery; D:warehouse | Terminal delivery to final destination, reporting and warehousing. |
| Contract Management Standard 4th ed. | Phase | PRE | Pre-award | FULL | 0 | D:source(Supplier/provider selection); D:commercial; L:ecl-b | Need definition through selection. |
| Contract Management Standard 4th ed. | Phase | AWD | Award | FULL | 0 | D:source(Contract); L:ecl-e | Contract formation. |
| Contract Management Standard 4th ed. | Phase | POST | Post-award | PARTIAL | 2 | L:ecl-e (PARTIALLY READY) | Obligation execution, change, renewal are lens-level; lens gap says obligation semantics need execution research. |
| UN/CEFACT International Forwarding and Transport BRS v2 | Process scope | ALL | Booking, instructions, waybill/status, consolidation context | NA | 0 |  | STRUCTURE NOT RETRIEVED: no mapping asserted (UNRESOLVED). Registry applicability text names the scope; node-level mapping deferred. |
| ISO 9001 | Standard | ISO 9001:2015 | Quality management systems | PARTIAL | 2 | L:ecl-l; D:transform(Inspect and test) | Quality lens carries ISO 9001. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 31000 | Standard | ISO 31000:2018 | Risk management (principles, framework, process) | PARTIAL | 2 | L:ecl-u; L:ecl-z | Risk lenses. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 22301 | Standard | ISO 22301:2019 | Business continuity management systems | PARTIAL | 2 | L:ecl-u | Resilience lens. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 37301 | Standard | ISO 37301:2021 | Compliance management systems | PARTIAL | 2 | L:ecl-z; L:ecl-t | Compliance lens. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 44001 | Standard | ISO 44001:2017 | Collaborative business relationship management | PARTIAL | 2 | L:ecl-h; L:ecl-q | Supplier and provider lenses. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 55001 | Standard | ISO 55001:2024 | Asset management systems | PARTIAL | 2 | D:assets; L:ecl-v | Assets domain and lens. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 30401 | Standard | ISO 30401:2018 | Knowledge management systems | PARTIAL | 2 | L:ecl-aa (SOURCE RESEARCH REQUIRED) | Knowledge lens, unresearched. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 10002 | Standard | ISO 10002:2018 | Complaints handling | PARTIAL | 2 | D:customer; D:claims; L:ecl-m | Customer service lens. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| ISO 30414 | Standard | ISO 30414:2025 | Human capital reporting | PARTIAL | 2 | L:ecl-w (SOURCE RESEARCH REQUIRED) | Workforce lens, unresearched. Standard-level mapping only; clause-level NOT mapped (structure not retrieved). |
| World CC / CIPS / ISM competency bodies; BPMN; DMN; ISO 22400 | Reference kind | - | Notation, KPI set or competency reference (not process hierarchies) | NA | 0 |  | Not process frameworks; excluded from the mapping denominator. BPMN/DMN are notations (DMN states "not process-content evidence"); ISO 22400 is a KPI set. |

## 9. Reverse view and observations (Universe side; not scored)
- Domain load (core nodes carried per domain): plan 28, warehouse 19, source 16, transport 16, transform 15, returns 14, delivery 13, commercial 11, assets 9, trade 8, customer 7, finance 7, masterdata 5, exception 4, claims 3. The Universe says it does not treat exception, claims, customer, finance, assets and masterdata as SCOR primary processes, and that trade, claims, exception and masterdata carry no forced APQC subordinate mapping; this is disclosed Atlas construction, not a fault.
- O-1. Warehouse domain cites "R1/R3 receive and storage elements". In SCOR DS, R1 and R3 are Return Product and Return MRO. Receipt and storage elements would sit at Source or Return L3, which I did not retrieve. Imprecise reference label; not classified as a defect.
- O-2. Trade domain says APQC "no forced subordinate mapping", yet PCF 9.11 "Perform global trade services" exists and fits CAN-07. Proposed explicit anchor (no ID change).
- O-3. Commercial domain says quote processes are "mapped separately"; no separate mapping appears in the file. 3.5.3 is carried by the Quote and terms sub-capability.
- O-4. APQC level-1 categories 1.0, 5.0 and 8.0 do not appear in the Universe's APQC list (10 of 13 shown), which states that only selected nodes are shown.
- O-5. SCOR code notation: the Universe writes P1, F1; the ASCM document writes P.3 and F.1 in prose and F1.1 for L3. Notation variance only. The Universe's registry text says "published L0-L2 semantics" for the current web edition; the document I read is version 14.0 (2022); I could not confirm that the web edition is unchanged.
- O-6. Orchestrate OE1 and OE12 have no explicit reference anywhere (script); P2-P6 are cited only as a block.
- O-7. Items inherited from earlier tasks and not re-opened: W1-02 F4 (source-reference definition) and the CMR/eCMR URLs routed by W1-07 are not framework-mapping questions.

## 10. DEC-057 and DEC-053 reporting
- Structural or conceptual defects: none confirmed. One candidate, APQC 6.4 recall (above), held as a question for W1-12, W1-11 composition scenarios and the Owner.
- Depth gaps (class 2 or 3, DEPTH): 33 class-2 rows and 2 class-3 rows; the Universe itself marks the matching lenses PARTIALLY READY, EXECUTION DETAIL REQUIRED or SOURCE RESEARCH REQUIRED (W, AA especially). Destination layers: workforce, knowledge/decision and quality lenses (enterprise layer), service-delivery and after-sales (logistics service provider daughter), Ocean daughter (DCSA vessel and liner), contract post-award (commercial/source layer).
- On-demand depth detection, research, normalization and governed publication: NOT BUILT (DEC-057). Nothing here claims PASS for it; no Universe edit, task or gate is proposed.
- DEC-053 CH-02 (parent-only denominator with cited exclusions) applies to the value-chain steps of W1-11, not to framework nodes; here class 5 exclusions cite the reason in the rationale column. CH-01 sample statistics are not involved.

## 11. Limits and disclosures
- One assessor assigned every status and class; 19 APQC rows and 2 SCOR rows are SCOPE_READ judgements without any citation by code in the Universe. The 38 EXPLICIT and 88 ANCESTOR_CITED APQC rows rest on script-found references, but PARTIAL versus FULL is still my reading.
- SCOR L3 and below were not mapped (task asks L1-L2). The ASCM introduction document was read through WebFetch summaries (about 15,000 characters per chunk); the L2 names for Order, Transform, Fulfill and Return come from the unversioned Quick Reference Guide copy, not from an ASCM-hosted page. The ASCM page itself lists only Orchestrate and the six L1 names.
- ISA-95 Part 3 operations categories and the ISO clause structures were not retrieved from issuers (the ISA page lists part titles and Levels 0-4 only; ISO pages are catalogue pages); ISO rows are standard-level only. The UN/CEFACT IFT BRS v2 page failed to load (client error, one try); no mapping asserted for it. The DCSA blueprint page gives journeys and phases only; stages below them were not read. The Contract Management Standard page gives phase names only.
- Gap class 4 (client binding) was assigned to nothing; if W1-12 disagrees on any class 3 or class 5 item it may move to class 4 or 2.
- The PCF Excel in the Project is the Cross-Industry edition 8.0 generated 2026-02-25; the Consumer Products PCF and the industry PDFs were not used (no industry-specific framework is registered in the Universe).

## 12. Acceptance (task row C19 / H19; AD; DEC-057)
1. Mapping table with every SCOR L1-L2 node (and Orchestrate) and the registered frameworks: PASS (data/mapping.tsv, 213 rows).
2. Unmapped list with gap classes 1-5: PASS (data/unmapped_and_partial.tsv, sections 4-8); classes are proposals for W1-12.
3. Read-only scope, no frozen/backend edit: PASS.
4. DEC-057 conceptual versus depth separation recorded; on-demand evolution not claimed built: PASS (section 10).
5. Independence: not claimed. Batch QA W1-12 (ChatGPT) carries the QA.

## 13. For the W1-12 batch QA
1. Re-run scripts/explicit.py on the frozen HTML to reproduce the 39 of 41 SCOR and the APQC explicit-citation findings.
2. Re-judge class 1 (6.4), the 25 class-2 APQC rows, the SCOR P2-P6, OE1, OE5, OE12 partials, and the 46 class-5 exclusions (is any a logistics-relevant capability?).
3. Check the independent SCOR L2 source (the Quick Reference Guide is a third-party copy) against an ASCM-hosted copy if you can open one.
4. Confirm or widen the definition of "other registered frameworks" in section 2.

## 14. Identity and evidence location (DEC-055 13)
GitHub evidence-only branch w1-evidence-20261011, folder governance/product/w1-evidence/W1-10/ (README.md = this document, SHA256SUMS.txt, scripts/, data/). Commit SHA and file hashes are recorded in AA19 after the push (see Wave 0 Control row 19).
