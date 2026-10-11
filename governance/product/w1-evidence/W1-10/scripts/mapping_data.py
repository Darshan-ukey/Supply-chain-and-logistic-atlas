# Assessor judgments (W1-10). status: FULL / PARTIAL / NONE / NA. cls: gap class 1-5 or '' ; crit Y/N ; typ: STRUCTURAL / DEPTH / OUT_OF_SCOPE / ''.
# constructs: D:<domain id>, L:<lens id>, C:<cycle id>, M:<operating role/mode overlay>
SCOR = {
 'OE1':('PARTIAL','D:plan(Performance policy,Network design); L:ecl-a; L:ecl-p',2,'N','DEPTH','Strategy setting is only implicit in plan-domain policy sub-capabilities; no construct cites OE1 (script: zero explicit references). Proposed anchor addition, no ID change.'),
 'OE2':('FULL','L:ecl-f; L:ecl-z; L:ecl-aa',0,'N','','Business rules carried by lenses F, Z, AA (explicit OE2).'),
 'OE3':('FULL','D:exception; L:ecl-l; L:ecl-aa; C:cycle-issue-resolution',0,'N','','Performance and continuous improvement: exception rail "Learn/prevent" plus lenses (explicit OE3).'),
 'OE4':('FULL','D:masterdata; L:ecl-g; L:ecl-k; L:ecl-aa',0,'N','','Data, information and technology: master-data domain (explicit OE4).'),
 'OE5':('PARTIAL','L:ecl-w (SOURCE RESEARCH REQUIRED)',2,'N','DEPTH','Present as a lens only; the Universe itself states no supply-chain workforce taxonomy exists yet (lens W gap text).'),
 'OE6':('FULL','D:source(Contract); L:ecl-b; L:ecl-e; L:ecl-q; C:cycle-source-contract',0,'N','','Contracts and agreements (explicit OE6).'),
 'OE7':('FULL','D:plan(Network design); L:ecl-p; L:ecl-v',0,'N','','Network design (explicit OE7).'),
 'OE8':('FULL','D:trade; L:ecl-t; L:ecl-z',0,'N','','Regulatory and compliance (explicit OE8); trade domain is conditional by design.'),
 'OE9':('FULL','L:ecl-h; L:ecl-u; L:ecl-z',0,'N','','Risk (explicit OE9); lens U readiness PARTIALLY READY.'),
 'OE10':('FULL','L:ecl-y',0,'N','','ESG (explicit OE10). Label differs: Universe "Environmental, Social and Governance"; quick-reference guide reads "Environment, Social, and Governance" (wording variant, no defect).'),
 'OE11':('FULL','L:ecl-a',0,'N','','Enterprise business planning (explicit OE11).'),
 'OE12':('PARTIAL','L:ecl-i (service segmentation); L:ecl-h (supplier segmentation)',2,'N','DEPTH','Segmentation appears only as text inside two lenses; no construct cites OE12 (zero explicit references).'),
 'OE13':('FULL','L:ecl-y; D:returns',0,'N','','Circular supply chain management (explicit OE13 on lens Y); recovery paths in returns domain.'),
 'P':('FULL','D:plan',0,'N','','Plan L1.'),
 'O':('FULL','D:commercial',0,'N','','Order L1.'),
 'S':('FULL','D:source',0,'N','','Source L1.'),
 'T':('FULL','D:transform',0,'N','','Transform L1.'),
 'F':('FULL','D:warehouse; D:transport; D:delivery',0,'N','','Fulfill L1 spread over three execution domains (explicit F1-F3 on all three).'),
 'R':('FULL','D:returns',0,'N','','Return L1.'),
 'P1':('FULL','D:plan(Demand and supply planning; Capacity and inventory policy)',0,'N','','Explicit P1.'),
 'P2':('PARTIAL','D:plan',2,'N','DEPTH','P2-P6 are cited as one block ("P2-P6 process plans"); the plan domain has five sub-capabilities, none per process plan. Present via a different abstraction (single Plan domain).'),
 'P3':('PARTIAL','D:plan; D:source',2,'N','DEPTH','As P2: block citation only; sourcing plan appears as Category plan in the Source domain.'),
 'P4':('PARTIAL','D:plan; D:transform(Schedule); C:cycle-plan-produce',2,'N','DEPTH','As P2; explicit P4 on cycle Plan-to-Produce and lens J.'),
 'P5':('PARTIAL','D:plan(Deployment planning); L:ecl-i',2,'N','DEPTH','As P2; explicit P5 on lens I.'),
 'P6':('PARTIAL','D:plan; D:returns(Plan reverse movement)',2,'N','DEPTH','As P2; reverse-flow planning sits in returns sub-capability.'),
 'O1':('FULL','D:commercial',3,'N','DEPTH','Explicit O1. Channel variant (B2C) is carried by the commercial domain; channel-specific detail is a daughter/client specialization (lens D gap names channel variants).'),
 'O2':('FULL','D:commercial',3,'N','DEPTH','Explicit O2; B2B specifics are daughter-level.'),
 'O3':('FULL','D:commercial',3,'N','DEPTH','Explicit O3; intra-company order specifics are daughter-level.'),
 'S1':('FULL','D:source(Sourcing governance; Category plan; Supplier/provider selection; Contract)',0,'N','','Explicit S1.'),
 'S2':('FULL','D:source(Requisition and PO); C:cycle-procure-pay',0,'N','','Explicit S2.'),
 'S3':('FULL','D:source(Requisition and PO); C:cycle-procure-pay',0,'N','','Explicit S3.'),
 'S4':('FULL','D:source; D:returns',0,'N','','Explicit S4 on source and returns.'),
 'T1':('FULL','D:transform; L:ecl-j',0,'N','','Explicit T1.'),
 'T2':('FULL','D:transform(service transformation)',0,'N','','Explicit T2.'),
 'T3':('FULL','D:transform(MRO/VAS); D:assets(Maintain/repair/MRO)',0,'N','','Explicit T3.'),
 'F1':('FULL','D:warehouse; D:transport; D:delivery',3,'N','DEPTH','Explicit F1; B2C channel variants are daughter-level.'),
 'F2':('FULL','D:warehouse; D:transport; D:delivery',3,'N','DEPTH','Explicit F2; B2B variants are daughter-level.'),
 'F3':('FULL','D:warehouse; D:transport; D:delivery',3,'N','DEPTH','Explicit F3; intra-company variants are daughter-level.'),
 'R1':('FULL','D:returns; C:cycle-return-refund',0,'N','','Explicit R1.'),
 'R2':('FULL','D:returns',0,'N','','Explicit R2 (service returns).'),
 'R3':('FULL','D:returns; D:assets',0,'N','','Explicit R3 (MRO returns).'),
}
# APQC: code -> (status, constructs, cls, crit, typ, rationale)
AP = {}
def a(code,status,cons,cls=0,crit='N',typ='',why=''): AP[code]=(status,cons,cls,crit,typ,why)
# L1
a('1.0','NONE','',5,'N','OUT_OF_SCOPE','Enterprise vision and strategy; not a supply-chain operating capability. No construct cites it. SCOR OE1 is the nearest supply-chain-level strategy anchor (see OE1).')
a('2.0','PARTIAL','L:ecl-k',5,'N','OUT_OF_SCOPE','Only item/product lifecycle (introduction, change, retirement) is in scope via lens K; R&D design is not.')
a('3.0','PARTIAL','D:commercial; L:ecl-d; L:ecl-f; L:ecl-o',5,'N','OUT_OF_SCOPE','Order, quote and rate parts are covered; marketing and sales planning are not.')
a('4.0','FULL','D:plan; D:source; D:transform; D:warehouse; D:transport; D:delivery; D:returns',0,'N','','Core supply-chain category; sub-nodes 4.1-4.4 cited explicitly.')
a('5.0','PARTIAL','D:transform(service transformation); D:transport; D:delivery; D:warehouse (logistics services are themselves the delivered service)',2,'N','DEPTH','Not cited anywhere (script). Service delivery for a service enterprise (e.g. a 3PL) is performed by the execution domains; no construct names service-delivery governance or resources. Flagged for challenge: whether PCF 5.0 should be an explicit anchor.')
a('6.0','FULL','D:customer; L:ecl-m; C:cycle-issue-resolution',0,'N','','Explicit 6.0 on customer domain.')
a('7.0','PARTIAL','L:ecl-w (SOURCE RESEARCH REQUIRED)',5,'N','OUT_OF_SCOPE','Enterprise HR category; only supply-chain workforce aspects (skill, qualification, shift, safety) are in lens W, itself unresearched.')
a('8.0','PARTIAL','D:masterdata; L:ecl-g; L:ecl-aa',5,'N','OUT_OF_SCOPE','Not cited. Enterprise IT management is outside scope; information management (8.4) is carried by master-data domain.')
a('9.0','PARTIAL','D:finance; L:ecl-x; L:ecl-n',0,'N','','Revenue accounting (9.2), payables (9.6) and global trade services (9.11) mapped; other 9.x enterprise-accounting nodes are out of scope.')
a('10.0','PARTIAL','D:assets; L:ecl-v',0,'N','','Maintain (10.3) and end-of-life (10.4) covered; construction projects (10.2) out of scope.')
a('11.0','PARTIAL','L:ecl-u; L:ecl-z; L:ecl-t; D:exception; D:trade',0,'N','','Risk, compliance and resilience covered at lens level; remediation (11.3) through exception/claims rails.')
a('12.0','PARTIAL','L:ecl-e; L:ecl-h; D:claims',5,'N','OUT_OF_SCOPE','Supplier/contract relationship parts covered; investor/board/PR relations out of scope.')
a('13.0','PARTIAL','L:ecl-l; L:ecl-aa; L:ecl-g; L:ecl-y',0,'N','','Quality, knowledge, analytics and sustainability covered at lens level (two lenses SOURCE RESEARCH REQUIRED).')
# L2
a('1.1','NONE','',5,'N','OUT_OF_SCOPE','Enterprise strategy.'); a('1.2','NONE','',5,'N','OUT_OF_SCOPE','Enterprise strategy.')
a('1.3','NONE','',5,'N','OUT_OF_SCOPE','Strategic initiatives; no supply-chain execution content.'); a('1.4','NONE','',5,'N','OUT_OF_SCOPE','Business model definition; the Universe\'s operating-role overlays (shipper, forwarder, 3PL...) describe roles, not enterprise business-model management.')
a('2.1','PARTIAL','L:ecl-k',5,'N','OUT_OF_SCOPE','Program governance for development is out of scope; item governance partly via lens K.')
a('2.2','NONE','',5,'N','OUT_OF_SCOPE','Idea generation / R&D.'); a('2.3','PARTIAL','L:ecl-k',5,'N','OUT_OF_SCOPE','Product design out of scope; engineering change and item introduction via lens K (lens gap: needs sector research).')
a('3.1','NONE','',5,'N','OUT_OF_SCOPE','Market research.'); a('3.2','NONE','',5,'N','OUT_OF_SCOPE','Marketing strategy.'); a('3.3','NONE','',5,'N','OUT_OF_SCOPE','Marketing plans.')
a('3.4','PARTIAL','D:commercial(Rate and pricing; Enquiry and solution)',5,'N','OUT_OF_SCOPE','Sales strategy is out of scope; pricing/solution design touchpoint only.')
a('3.5','FULL','D:commercial',0,'N','','Sales plans: order/quote handling covered (3.5.3 quote, 3.5.4 order); selling-channel nodes (3.5.5-3.5.8) are not.')
a('4.1','FULL','D:plan; C:cycle-forecast-plan; L:ecl-a',0,'N','','Explicit 4.1.'); a('4.2','FULL','D:source; C:cycle-source-contract; C:cycle-procure-pay',0,'N','','Explicit 4.2; Source sub-capability names mirror 4.2.1-4.2.5.')
a('4.3','FULL','D:transform; C:cycle-plan-produce; L:ecl-j',0,'N','','Explicit 4.3.'); a('4.4','FULL','D:plan; D:transport; D:warehouse; D:delivery; D:returns',0,'N','','Explicit 4.4 and its children.')
a('5.1','PARTIAL','D:plan(Performance policy)',2,'N','DEPTH','Service delivery governance: only service policy in plan domain; not cited.'); a('5.2','PARTIAL','D:assets; D:warehouse',2,'N','DEPTH','Service delivery resources: assets/fleet and node capacity; not cited.')
a('5.3','PARTIAL','D:transform(service transformation); D:exception',2,'N','DEPTH','Operate the delivery system: transform T2 and exception rail; not cited.'); a('5.4','PARTIAL','D:transport; D:delivery; D:warehouse',2,'N','DEPTH','Deliver service to customer: realized by logistics execution domains for a logistics service provider; not cited.')
a('6.1','PARTIAL','D:customer; D:plan(Performance policy)',2,'N','DEPTH','Service strategy: only implicit in service policy.'); a('6.2','FULL','D:customer',0,'N','','Contacts: receive, classify/route, status (customer sub-capabilities).')
a('6.3','PARTIAL','D:assets(Maintain/repair/MRO); D:returns; D:customer',2,'N','DEPTH','After-sales service: via T3/R3 and customer service; no after-sales construct.')
a('6.4','NONE','(closest: D:returns; src-gs1-trace; D:trade)',1,'Y','STRUCTURAL','Product recall and regulatory audit. PROPOSED CLASS 1 (challenge invited): the word "recall" does not occur anywhere in the frozen HTML (0 matches); returns domain scope starts at customer/supplier return signal, not regulator- or manufacturer-initiated trace-and-retrieve. Alternative reading, class 2: composable from returns + GS1 traceability + compliance lens Z. Critical because recall is a legal/regulatory step in pharma, automotive and consumer reference chains (W1-06 QA R1 flagged recall/returns generalization).')
a('6.5','FULL','D:customer(Close and capture feedback)',0,'N','','Satisfaction evaluation.')
for c,n in [('7.1','HR planning'),('7.2','Recruiting'),('7.4','Employee relations'),('7.5','Reward and retain'),('7.6','Redeploy and retire'),('7.8','Employee communication')]:
    a(c,'NONE','',5,'N','OUT_OF_SCOPE',n+': enterprise HR administration.')
a('7.3','PARTIAL','L:ecl-w',2,'N','DEPTH','Training/qualification for logistics roles appears in lens W text; taxonomy unresearched.'); a('7.7','PARTIAL','L:ecl-w',2,'N','DEPTH','Workforce analytics: lens W only.')
for c in ['8.1','8.2','8.5','8.6','8.7']: a(c,'NONE','',5,'N','OUT_OF_SCOPE','IT organization management; outside the logistics Universe.')
a('8.3','PARTIAL','L:ecl-u',5,'N','OUT_OF_SCOPE','IT resilience and risk: enterprise risk lens only.'); a('8.4','PARTIAL','D:masterdata; L:ecl-g',2,'N','DEPTH','Manage information: master and reference data governance.')
a('9.1','PARTIAL','D:finance(Freight accrual; Allocation)',5,'N','OUT_OF_SCOPE','Management accounting: only freight cost accrual/allocation.'); a('9.2','FULL','D:finance(Revenue accounting; Customer invoice and AR; Collections/deductions)',0,'N','','Explicit 9.2.')
a('9.3','NONE','',5,'N','OUT_OF_SCOPE','General ledger and reporting.'); a('9.4','NONE','',5,'N','OUT_OF_SCOPE','Fixed-asset project accounting.'); a('9.5','NONE','',5,'N','OUT_OF_SCOPE','Payroll.')
a('9.6','FULL','D:finance(Carrier invoice/audit; AP and payment)',0,'N','','Explicit 9.6.')
a('9.7','PARTIAL','D:finance(Trade finance); L:ecl-x; sys-treasury',2,'N','DEPTH','Treasury operations: trade-finance/working-capital touchpoints; Treasury Management System is registered.')
a('9.8','PARTIAL','L:ecl-z',2,'N','DEPTH','Internal controls: lens Z (PARTIALLY READY).'); a('9.9','PARTIAL','D:trade(Duties/taxes); D:finance; sys-tax-engine',2,'N','DEPTH','Taxes: duties/taxes in trade domain and tax engine system; indirect-tax accounting depth not modelled. Financial-settlement relevance noted; not an unmapped node.')
a('9.10','NONE','',5,'N','OUT_OF_SCOPE','Intercompany funds/consolidation.')
a('9.11','FULL','D:trade',0,'N','','Global trade services is the trade, customs and regulatory domain (CAN-07); not cited by code (trade domain apqc text says "no forced subordinate mapping") - mapped by scope. Proposed explicit anchor.')
a('10.1','PARTIAL','D:assets(Plan availability)',2,'N','DEPTH','Plan and acquire assets: availability/allocation planning; acquisition itself not.'); a('10.2','NONE','',5,'N','OUT_OF_SCOPE','Design and construct assets (capital projects).')
a('10.3','FULL','D:assets(Maintain/repair/MRO; Inspect and certify)',0,'N','','Maintain assets.'); a('10.4','FULL','D:assets(Retire/replace)',0,'N','','Asset end-of-life.')
a('11.1','FULL','L:ecl-u; L:ecl-z',0,'N','','Enterprise risk (lens level).'); a('11.2','FULL','L:ecl-z; D:trade; L:ecl-t',0,'N','','Compliance.')
a('11.3','PARTIAL','D:exception(Contain/recover); D:claims',2,'N','DEPTH','Remediation efforts: via exception recovery and claims rails.'); a('11.4','FULL','L:ecl-u',0,'N','','Business resiliency (lens level; ISO 22301 registered).')
a('12.1','NONE','',5,'N','OUT_OF_SCOPE','Investor relations.'); a('12.2','PARTIAL','D:trade(authority/broker)',5,'N','OUT_OF_SCOPE','Government relations: only regulator interaction in trade domain.')
a('12.3','NONE','',5,'N','OUT_OF_SCOPE','Board relations.'); a('12.4','PARTIAL','D:claims; L:ecl-z',2,'N','DEPTH','Legal and ethical issues: liability conventions and claims branches.'); a('12.5','NONE','',5,'N','OUT_OF_SCOPE','Public relations.')
a('13.1','PARTIAL','L:ecl-aa; BPMN registered as notation',2,'N','DEPTH','Business process management: notation and knowledge lens.'); a('13.2','NONE','',5,'N','OUT_OF_SCOPE','Portfolio/program/project management.')
a('13.3','FULL','L:ecl-l',0,'N','','Enterprise quality (lens L; ISO 9001 registered).'); a('13.4','NONE','',5,'N','OUT_OF_SCOPE','Change management.')
a('13.5','FULL','L:ecl-aa',0,'N','DEPTH','Knowledge management: lens AA exists but readiness is SOURCE RESEARCH REQUIRED (depth gap disclosed by the Universe).')
a('13.6','PARTIAL','L:ecl-aa; D:masterdata',2,'N','DEPTH','Content management: document registry exists (19 document records) but no content-management construct.')
a('13.7','PARTIAL','D:plan(Performance policy); L:ecl-aa; OE3',2,'N','DEPTH','Measure and benchmark: performance policy and OE3.'); a('13.8','PARTIAL','L:ecl-aa; sys-analytics',2,'N','DEPTH','Analytics: lens AA (SOURCE RESEARCH REQUIRED) and analytics platform system.')
a('13.9','PARTIAL','L:ecl-w (safety); D:trade (dangerous goods, conditional)',2,'N','DEPTH','EHS: "EHS"/"health and safety" do not occur in the frozen HTML (0 matches); workplace safety only as a word in lens W; transport dangerous-goods safety sits in the conditional dangerous-goods layer. Flagged for challenge (class 2 vs class 1).')
a('13.10','FULL','L:ecl-y',0,'N','','Sustainability (lens Y; ISO 14083/14064/GHG registered).')
# L3 APQC 4.x and 3.5.x (depth extension)
for c,s,cons,why in [
 ('4.1.1','FULL','D:plan(Capacity and inventory policy); D:transform','Production and materials strategies.'),
 ('4.1.2','FULL','D:plan(Demand and supply planning)','Demand management.'),('4.1.3','FULL','D:plan; D:source','Materials plan.'),
 ('4.1.4','FULL','D:plan; D:transform(Schedule)','Master production schedule.'),('4.1.5','FULL','D:plan(Deployment planning)','Distribution requirements.'),
 ('4.1.6','FULL','D:plan(Deployment planning; Performance policy)','Distribution planning constraints.'),('4.1.7','FULL','D:plan(Performance policy)','Distribution planning policies.'),
 ('4.2.1','FULL','D:source(Sourcing governance)','Explicit 4.2.1.'),('4.2.2','FULL','D:source(Category plan)','Explicit 4.2.2.'),('4.2.3','FULL','D:source(Supplier/provider selection; Contract)','Explicit 4.2.3.'),
 ('4.2.4','FULL','D:source(Requisition and PO)','Explicit 4.2.4.'),('4.2.5','FULL','D:source(Supplier management); L:ecl-h','Explicit 4.2.5.'),
 ('4.3.1','FULL','D:transform(Schedule)','Schedule production.'),('4.3.2','FULL','D:transform(Execute/transform)','Produce/assemble.'),('4.3.3','FULL','D:transform(Inspect and test)','Quality testing.'),
 ('4.3.4','FULL','D:transform(Pack and release); L:ecl-j ("Transform and record genealogy"); src-gs1-trace','Production records and lot traceability (genealogy named in lens J).'),
 ('4.4.1','FULL','D:plan (Network design; Performance policy)','Explicit 4.4.1 on plan domain.'),('4.4.2','FULL','D:transport; D:warehouse(Receive and inspect)','Explicit 4.4.2.'),('4.4.3','FULL','D:warehouse','Explicit 4.4.3 (+4.4.3.1-8).'),
 ('4.4.4','FULL','D:transport','Explicit 4.4.4.'),('4.4.5','FULL','D:delivery','Explicit 4.4.5.'),
 ('3.5.3','FULL','D:commercial(Quote and terms)','Quotes: sub-capability exists; the Universe says quote mapping is "separate" but no separate mapping is shown (observation O-3).'),
 ('3.5.4','FULL','D:commercial(Order capture; Validate and promise; Amend or cancel)','Explicit 3.5.4.'),
 ('3.5.1','PARTIAL','D:commercial(Enquiry and solution)','Leads/opportunities: enquiry only.'),('3.5.2','PARTIAL','D:masterdata; D:customer','Customer/account management: party master data and service contacts.'),
]: a(c,s,cons,0 if s=='FULL' else 2,'N','' if s=='FULL' else 'DEPTH',why)
for c in ['3.5.5','3.5.6','3.5.7','3.5.8']: a(c,'NONE','',5,'N','OUT_OF_SCOPE','Selling-channel / sales organization processes; orders from these channels enter at commercial "Order capture".')
a('4.1.8','PARTIAL','L:ecl-l',2,'N','DEPTH','Quality standards and procedures: lens L (PARTIALLY READY), no domain.')
# L4 4.4.x
for c,s,cons,why,cls in [
 ('4.4.1.1','FULL','D:plan(Performance policy); D:commercial','Translate service requirements into logistics requirements.',0),
 ('4.4.1.2','FULL','D:plan(Network design); L:ecl-p','Design logistics network.',0),
 ('4.4.1.3','PARTIAL','D:source; L:ecl-q; M:3pl,4pl','Outsourcing needs communication: provider sourcing and role overlays.',2),
 ('4.4.1.4','FULL','D:plan(Performance policy)','Delivery service policy.',0),
 ('4.4.1.5','FULL','D:transport(Mode/service and route; Consolidate/load build)','Optimize transport schedules and costs.',0),
 ('4.4.1.6','FULL','D:plan(Performance policy)','Key performance measures.',0),
 ('4.4.1.7','FULL','D:returns(Plan reverse movement)','Explicit 4.4.1.7.',0),
 ('4.4.2.1','FULL','D:transport; D:warehouse(Receive and inspect)','Plan inbound receipts.',0),('4.4.2.2','FULL','D:transport','Inbound material flow.',0),
 ('4.4.2.3','FULL','D:transport(Visibility/exception); L:ecl-q','Inbound delivery performance.',0),
 ('4.4.2.4','FULL','D:returns','Explicit 4.4.2.4.',0),('4.4.2.5','FULL','D:returns(Disposition/recover)','Explicit 4.4.2.5.',0),
 ('4.4.3.1','FULL','D:warehouse; D:plan(Deployment planning)','Explicit 4.4.3.1.',0),('4.4.3.2','FULL','D:warehouse(Receive and inspect; Putaway and storage)','Explicit.',0),
 ('4.4.3.3','FULL','D:warehouse(Inventory accuracy)','Explicit.',0),('4.4.3.4','FULL','D:warehouse(Pick-pack-stage-load)','Explicit.',0),('4.4.3.5','FULL','D:warehouse(Inventory accuracy)','Explicit.',0),
 ('4.4.3.6','FULL','L:ecl-q; M:3pl,warehouse','3PL storage/shipping performance: provider management lens and role overlays.',0),
 ('4.4.3.7','FULL','D:warehouse','Explicit.',0),('4.4.3.8','FULL','D:warehouse(Cross-dock and transfer)','Explicit.',0),
 ('4.4.4.1','FULL','D:transport','Plan, transport and deliver outbound product.',0),('4.4.4.2','FULL','L:ecl-q; D:transport(Visibility/exception)','Carrier delivery performance.',0),
 ('4.4.4.3','FULL','D:assets','Manage transportation fleet.',0),('4.4.4.4','FULL','D:finance(Carrier invoice/audit)','Explicit 4.4.4.4 (label shortened).',0),
 ('4.4.5.1','FULL','D:delivery(Destination readiness; Appointment)','Last-mile requirements.',0),('4.4.5.2','FULL','D:delivery(Last-mile dispatch)','Last-mile resources.',0),
 ('4.4.5.3','FULL','D:delivery(Deliver/install; Delivery attempt; POD/acceptance)','Last-mile service.',0),('4.4.5.4','FULL','D:delivery; D:customer','Last-mile quality.',0),
]: a(c,s,cons,cls,'N','' if s=='FULL' else 'DEPTH',why)
