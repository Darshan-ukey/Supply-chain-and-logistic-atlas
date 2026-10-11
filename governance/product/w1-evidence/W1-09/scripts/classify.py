#!/usr/bin/env python3
"""W1-09 step 4: per-item result record (60 items) and summary statistics.
Inputs : selected_60.json (draw), plus the evidence listed per item (evidence is recorded here by hand after reading
         hits.txt, vocab_index.jsonl, the APQC PCF 8.0 xlsx text and the issuer pages named in `ev`).
Outputs: results.json, results.tsv, summary.json.
usage: classify.py <selected_60.json> <outdir>

Result categories (extends W1-08):
  PASS                  equivalent named entity found in a registered source (class/message/document/key/event); meaning matches
  PASS_WITH_NOTE        supported, but label differs (alias / composite / role-qualified) or support is a property or code value
  PASS_WITH_LIMITATION  supported ONLY at a coarser level: process level (APQC/SCOR/ISO), parent concept, or system function.
                        The item itself is not defined by any registered vocabulary read in this run.
  NO_BASIS              nothing found in any registered source reachable in this run (this is the 'unsupported' count)
  UNRESOLVED            could not be checked (tool-side)
  FAIL / CRITICAL       source contradicts the item (none in this run)
Claim classes (assigned before scoring the statistics; W1-12 challenges every assignment):
  CC1 standards-defined object/document/event
  CC2 alias, composite, role-qualified or property-level variant of a standards-defined concept
  CC3 enterprise process concept grounded only in process frameworks (APQC PCF / SCOR / ISO management-system)
  CC4 specialization, state or role of a supported parent concept; the specific variant is not defined
  CC5 software system category: function-level basis only; the category itself is not defined by any registered vocabulary
  CC6 domain-internal operational/client construct with no registered vocabulary
Evidence types: L = local machine-readable copy of issuer repo (commit heads in receipt); W = issuer web page via WebFetch
(small-model summary); P = APQC PCF 8.0 Excel (Project file, PCF ID cited).
"""
import sys, json, collections
sel = json.load(open(sys.argv[1])); outdir = sys.argv[2]

P_, N_, L_, X_ = 'PASS', 'PASS_WITH_NOTE', 'PASS_WITH_LIMITATION', 'NO_BASIS'
R = {}
def r(id_, cat, cc, basis, note, ev, d57=''):
    R[id_] = dict(cat=cat, cc=cc, basis=basis, note=note, ev=ev, dec057=d57)

ONE = 'src-iata-one-record'; UNR = 'src-uncefact-rdm'; CBV = 'src-gs1-cbv'; EPC = 'src-gs1-epcis'
DCB = 'src-dcsa-booking'; DBL = 'src-dcsa-ebl'; PCF = 'src-apqc-pcf'; X12 = 'src-x12'

# ---------------- business objects (40) ----------------
r('obj-vehicle', N_, 'CC2',
  f'{ONE}: IATA-1R-DM-Ontology.ttl class TransportMeans ("Transport means details"), property vehicleType; {UNR}: D23B defs logisticsTransportMeansType',
  'Registered vocabularies name the concept Transport Means; "Vehicle" is a label variant. domainIds is empty in the registry.', 'L')
r('obj-equipment', P_, 'CC1',
  f'{UNR}: D23B def logisticsTransportEquipmentType ("equipment used to hold, protect or secure cargo"); {ONE}: classes ULD, LoadingUnit; src-iso6346 identifies equipment (not read)',
  '', 'L')
r('obj-knowledge-asset', L_, 'CC3',
  f'{PCF}: PCF 8.0 13.6 Manage Content (21646): description names "enterprise content and knowledge assets"; src-iso30401 (knowledge-management system, page not read)',
  'Exact phrase appears in a process description only; no registered data vocabulary defines a knowledge-asset object.', 'P',
  'depth gap: conceptual coverage valid; object definition belongs to a knowledge/enterprise layer')
r('obj-filing', N_, 'CC2',
  f'{UNR}: D23B defs declarationType, exchangedDeclarationType; {ONE}: classes SecurityDeclaration, DgDeclaration; src-wco-dm registered (page read is generic, object level not confirmed)',
  '"Filing" is not a term used in the registered vocabularies searched; they use "declaration". Overlaps obj-declaration.', 'L,W')
r('obj-seal', P_, 'CC1',
  f'{UNR}: D23B def logisticsSealType ("device used to secure an object ... during transport"); {ONE}: datatype properties seal, sealNumber', '', 'L')
r('obj-subrogation', X_, 'CC6',
  f'Nothing found. Neighbours only: {ONE} class Insurance and {UNR} def cargoInsuranceType (insurance cover, not a recovery right); {PCF} 11.1.3.3.1 Assess adequacy of insurance coverage (18129)',
  'Subrogation (insurer recovery against a liable third party) is not defined in any registered source searched. Legal instruments (src-cmr, src-montreal, src-hague-visby) were not read at clause level.', 'L,P',
  'depth gap, not structural: valid claims-domain concept; destination layer = claims/insurance daughter; class 4/5 in the frozen protocol gap classes (proposal)')
r('obj-shipping-instructions', P_, 'CC1',
  f'{DBL}: Bill of Lading 3.0 introduction section 1.3 defines Shipping Instructions; {UNR}: UNECE-MultimodalShippingInstructions.json', '', 'W,L')
r('obj-trailer', N_, 'CC2',
  f'{UNR}: D23B logisticsTransportEquipmentType.categoryCode ("container or trailer")',
  'Trailer is a category value of Transport Equipment, not a class of its own.', 'L')
r('obj-condition-record', N_, 'CC2',
  f'{UNR}: D23B def conditionType ("a state, such as of a specified person or thing"); {ONE}: class ULDConditionCode (cXML 1.21), property serviceabilityCode; {CBV}: dispositions (damaged etc.)',
  'Concept is covered by several condition/state constructs; "Condition Record" as a wrapper object is not named anywhere.', 'L')
r('obj-supplier-invoice', N_, 'CC2',
  f'{CBV}: BTT-inv Invoice; {UNR}: UNECE-CrossIndustryInvoice.json', '"Supplier" is the seller role of an Invoice.', 'L')
r('obj-payment', P_, 'CC1',
  f'{UNR}: D23B defs tradeSettlementPaymentType, advancePaymentType, instalmentPaymentType; UNECE-CrossIndustryRemittanceAdvice.json', '', 'L')
r('obj-order', P_, 'CC1',
  f'{CBV}: BTT-po Purchase Order, BTT-prodorder; {UNR}: UNECE-CrossIndustryOrder.json (+ OrderChange, OrderResponse)', '', 'L')
r('obj-asset-master', L_, 'CC3',
  f'{PCF}: 9.3.3.2 Maintain fixed-asset master data files (10829); src-iso55001 (asset-management system, page not read)',
  'Process-level only; GS1 asset keys (GIAI/GRAI) were not checked.', 'P',
  'depth gap: conceptual coverage valid; master-data object is an enterprise/ERP-layer construct')
r('obj-cfs-handoff', L_, 'CC4',
  f'{DCB}: DCSA Booking and eBL Logical Data Model 2024.3, class Booking: Receipt Type at Origin / Delivery Type at Destination value CFS defined ("carrier responsible for stuffing/stripping")',
  'CFS is defined as a service-type value. A handoff object at a CFS is not defined; "handoff" is an Atlas composite.', 'W',
  'depth gap: valid ocean LCL concept; destination layer = Ocean LCL daughter')
r('obj-accrual', L_, 'CC3',
  f'{PCF}: 9.6.1.5 Process financial accruals and reversals (10873)', 'Exact term, process level; no registered data vocabulary defines an accrual object.', 'P',
  'depth gap: finance-layer object; conceptual coverage valid')
r('obj-regulatory-status', N_, 'CC2',
  f'{ONE}: classes SecurityStatus (cXML 1.103), ShipmentSecurityStatus (DM and CL ontologies)',
  'ONE Record covers the security-status sense; customs and dangerous-goods information sit in separate constructs there.', 'L')
r('obj-control-evidence', L_, 'CC3',
  f'{PCF}: 9.8 Manage internal controls (10735); 9.8.3 Report on internal controls compliance (10764)',
  'Process level only. ISO management-system standards (src-iso9001, src-iso37301) were not read at clause level, so no ISO claim is made.', 'P',
  'depth gap: enterprise compliance-layer object; conceptual coverage valid')
r('obj-release', L_, 'CC4',
  f'{ONE}: CL ontology code DK "Release order"; {UNR}: crossBorderRegulatoryProcedureType.transitReleaseCustomsOfficeSpecifiedLogisticsLocation (transit release customs office); DCSA Arrival Notice glossary: "Release" not defined',
  'Label is unqualified (customs release, cargo release, hold release). src-wco-dm is registered but its page gave no object-level confirmation.', 'L,W',
  'depth gap: qualify the sense; conceptual coverage valid')
r('obj-execution-state', N_, 'CC2',
  f'{ONE}: class ExecutionStatus ("restricted code list for the execution status of activities"); {EPC}: properties disposition, persistentDisposition',
  'Aliases "Actual state" and "Authoritative state" have no counterpart in any registered vocabulary.', 'L')
r('obj-appointment', N_, 'CC2',
  f'{X12}: transaction set 163 Transportation Appointment Schedule Information (x12.org catalogue)',
  'The X12 set name is "appointment schedule information". Catalogue read through a page summary.', 'W')
r('obj-refund', N_, 'CC2',
  f'{UNR}: D23B paymentTradeSettlementType.refundAmount, tradeTaxType.refundAmount; {PCF} 6.2.4.1 Authorize return (10364) mentions refund in its description only',
  'Refund is an attribute (amount) of a payment settlement, not an object.', 'L,P')
r('obj-shipment-readiness', L_, 'CC4',
  f'{X12}: transaction set 216 Motor Carrier Shipment Pickup Notification (shipper tells carrier a shipment is ready for pickup)',
  'A readiness message exists; no readiness state or object is named in any indexed vocabulary (no term "ready"/"readiness").', 'W,L',
  'depth gap: warehouse/transport state; conceptual coverage valid')
r('obj-reference-code', N_, 'CC2',
  f'{UNR}: D23B def referenceType ("Supply Chain_ Reference"); {ONE}: class ExternalReference', 'Generic label; many reference types exist.', 'L')
r('obj-rate', N_, 'CC2',
  f'{ONE}: classes RateClassCode, ChargeCode, property rateCharge ("TACT rate"); {UNR}: tradePriceType',
  'No class named Rate; the term covers freight rate, tax rate and exchange rate (domains: commercial, transport, finance, claims).', 'L')
r('obj-performance-record', L_, 'CC3',
  f'{PCF}: 4.4.4.2 Track carrier delivery performance (10361); PCF measure rows; src-scor registered (page not read)',
  'Process level only.', 'P', 'depth gap: KPI/scorecard object belongs to a performance-management layer')
r('obj-reserve', L_, 'CC3',
  f'{PCF}: 9.2.4.5 Process adjustments/write off balances (10808): "maintaining reserves for write-offs and adjustments"',
  'Finance-reserve sense only. The claims-reserve sense (registry domain: claims) is not defined anywhere searched. Sense mismatch is possible; W1-12 should challenge.', 'P',
  'depth gap: claims/finance daughter; conceptual coverage valid')
r('obj-emission-record', N_, 'CC2',
  f'{ONE}: class CO2Emissions ("CO2 calculation"), property calculatedEmissions; {UNR}: def calculatedEmissionType; src-iso14083, src-ghg-scope3, src-iso14064 registered (method standards, not read)',
  '"Record" wrapper is Atlas wording; "GHG record" alias is broader than CO2.', 'L')
r('obj-wave', X_, 'CC6',
  f'Nothing found. Neighbours only: {CBV} BizStep-picking; {PCF} 4.4.3.4 Pick, pack, and ship product for delivery (10356)',
  'Warehouse wave (batch release of orders for picking) is a WMS construct; no registered source defines it.', 'L,P',
  'depth gap, not structural: valid warehouse concept; destination layer = warehouse daughter; class 3/4 in the frozen protocol gap classes (proposal)')
r('obj-load-plan', L_, 'CC4',
  'src-dcsa-load-list-bay-plan: DCSA "Load List and Bay Plan Definitions" (2020); page uses "load list" and "bay plan", not "load plan"',
  'Ocean/vessel-specific neighbour. No generic load plan found in ONE Record, UN/CEFACT D23B or CBV.', 'W,L',
  'depth gap: transport-layer object; conceptual coverage valid')
r('obj-freight-charge', N_, 'CC2',
  f'{UNR}: D23B def logisticsServiceChargeType ("a charge made for a logistics related service"); {ONE}: property chargeType, classes OtherCharge, ChargeCode', '', 'L')
r('obj-pick-confirmation', N_, 'CC2',
  f'{CBV}: BizStep-picking ("selecting of objects to fill an order")',
  'CBV defines the picking activity, not a confirmation record. X12 warehouse sets (944/945) were not found in the catalogue text read.', 'L,W')
r('obj-sourcing-decision', L_, 'CC3',
  f'{PCF}: 4.2.1 Provide sourcing governance (10277); 4.2.3 Select suppliers and develop/maintain contracts (10278); src-scor Source (page not read)',
  'Process level only.', 'P', 'depth gap: procurement-layer object; conceptual coverage valid')
r('obj-arrival-notice', P_, 'CC1',
  'src-dcsa-arrival: DCSA Arrival Notice v1 (current 1.0.1) release page; v1.0.1 glossary defines "Arrival notice" (notice from publisher to receiver that a shipment is scheduled to arrive)',
  'Same concept is registered twice (obj-arrival-notice and doc-arrival-notice).', 'W')
r('obj-booking', P_, 'CC1',
  f'{DCB}: DCSA Booking and eBL Logical Data Model 2024.3/2024.4 class Booking; {ONE}: class Booking; {UNR}: UNECE-MultimodalTransportBooking.json', '', 'W,L')
r('obj-asn', P_, 'CC1',
  f'{CBV}: BTT-desadv Despatch Advice ("also called an Advanced Shipment Notice"); {UNR}: UNECE-CrossIndustryDespatchAdvice.json', '', 'L')
r('obj-tender-response', N_, 'CC2',
  f'{UNR}: UNECE-CrossIndustryRequestforQuotationResponse.json; {X12}: 204 Motor Carrier Load Tender (request side) confirmed on catalogue',
  'The X12 response set (990) was not found in the catalogue text read (page truncated; not verified). Procurement-tender and load-tender senses differ.', 'L,W')
r('obj-declaration', N_, 'CC2',
  f'{UNR}: D23B defs declarationType, exchangedDeclarationType; {ONE}: classes DgDeclaration, SecurityDeclaration; {EPC}: ErrorDeclaration (different sense)',
  'Generic label for several typed declarations. Overlaps obj-filing.', 'L')
r('obj-recipient', N_, 'CC2',
  f'{ONE}: property consignee ("Reference to the Organization that fulfills the role of the consignee"), class Party',
  'Role name differs (consignee/receiver). GS1 GSRN-Recipient was not checked.', 'L')
r('obj-driver', L_, 'CC4',
  f'{ONE}: class Person (parent); property documents mentions "driver\'s license"; CL code PA (truck pre-announcement: driver name, license plates)',
  'No Driver class or role in ONE Record, D23B or CBV.', 'L', 'depth gap: person role; conceptual coverage valid')
r('obj-receipt', N_, 'CC2',
  f'{CBV}: BTT-recadv Receiving Advice, BizStep-receiving; {UNR}: UNECE-CrossIndustryReceivingAdvice.json', 'Goods-receipt sense.', 'L')

# ---------------- systems (10) ----------------
SYS = ('Function-level basis only; the software system category is not defined by any registered vocabulary.')
r('sys-customer-portal', X_, 'CC5',
  f'Nothing found. {PCF} mentions portals only in recruiting text and in benchmark measure wording', 'No registered source defines a customer portal or its function.', 'P',
  'client-binding/product category (class 4 proposal); not structural')
r('sys-ibp', L_, 'CC5',
  f'{PCF}: 4.1 Plan for and align supply chain resources (10215); 4.1.2 Manage demand for products (10222); src-scor Plan (page not read)', SYS + ' "Integrated business planning" is not named.', 'P',
  'product category; not structural')
r('sys-billing', L_, 'CC5',
  f'{PCF}: 9.2.2 Invoice customer (10743); 9.2.2.2 Generate customer billing data (10795); {UNR}: UNECE-CrossIndustryInvoice.json (document, not system)', SYS, 'P,L', 'product category; not structural')
r('sys-control-tower', L_, 'CC5',
  f'{EPC}/{CBV} registered as event/visibility standards; src-uncefact-multimodal-visibility-brs-v1 registered (page fetch errored, not verified)', SYS + ' Control-tower function is only indirectly supported by event standards.', 'W',
  'product category; not structural')
r('sys-forwarder-platform', L_, 'CC5',
  f'{UNR}: UNECE-MultimodalShippingInstructions.json, MultimodalTransportBooking.json, FIATATransportContract.json; src-uncefact-ift-brs-v2 registered (page not read)', SYS, 'L', 'product category; not structural')
r('sys-cpq', L_, 'CC5',
  f'{PCF}: 3.5.3 Develop and manage sales proposals, bids, and quotes (11779); 3.5.3.14 Revise bid/proposal/quote (20018); {UNR}: UNECE-CrossIndustryQuotationProposal.json', SYS, 'P,L', 'product category; not structural')
r('sys-oms', L_, 'CC5',
  f'{PCF}: 3.5.4 Manage sales orders (10185); {UNR}: UNECE-CrossIndustryOrder.json, OrderChange, OrderResponse', SYS, 'P,L', 'product category; not structural')
r('sys-analytics', L_, 'CC5',
  f'{PCF}: 13.8 Develop, Manage, and Deliver Analytics (20959); 8.4.1 Define business information and analytics strategy (20766); 2.1.2.5.4 Apply data and analytics to review supply chain methodologies (19647)', SYS, 'P', 'product category; not structural')
r('sys-carrier-documentation', L_, 'CC5',
  f'{DBL}: Bill of Lading 3.0 (carrier issues the Transport Document); src-fiata eFBL; {UNR}: UNECE-MaritimeBillofLading.json', SYS, 'W,L', 'product category; not structural')
r('sys-tax-engine', L_, 'CC5',
  f'{PCF}: 9.9 Manage taxes (10736); {UNR}: D23B defs tradeTaxType, appliedTaxType', SYS, 'P,L', 'product category; not structural')

# ---------------- documents / events (10) ----------------
r('evt-pickup-dispatched', N_, 'CC2',
  f'{UNR}: D23B headerTradeDeliveryType.actualPickUpEvent / confirmedPickUpEvent, logisticsTransportEquipmentType.pickUpEvent; {X12}: 216 Motor Carrier Shipment Pickup Notification; {ONE}: CL code PU "Pick-Up"',
  '"Dispatched" (carrier assigns a pickup) is an Atlas qualifier; the pick-up event itself is supported.', 'L,W')
r('doc-fiata-fbl', P_, 'CC1',
  f'src-fiata: fiata.org/resources lists the Negotiable FIATA Multimodal Transport Bill of Lading (FBL) and the Digital Negotiable FBL; {UNR}: UNECE-FIATATransportContract.json', 'Page does not use the abbreviation "eFBL".', 'W,L')
r('doc-air-awb', P_, 'CC1',
  f'{ONE}: class Waybill (waybillType House/Direct/Master); {UNR}: UNECE-AirWaybill.json', 'e-AWB as an IATA programme is registered under src-iata-cargo (W1-08: page generic).', 'L')
r('doc-road-cmr-bol', N_, 'CC2',
  f'{UNR}: UNECE-eCMR.json; src-cmr and src-ecmr registered (UNECE pages not fetchable in W1-07/W1-08, not re-tried); road BOL: src-nmfta-dsdc-ltl eBOL API Standard 2.1 (W1-08: confirmed latest)',
  'Composite label: two instruments (CMR consignment note, road bill of lading) in one record.', 'L')
r('doc-vgm-declaration', N_, 'CC2',
  f'src-dcsa-vgm: DCSA Verified Gross Mass v1 (current 1.0.1) release page; {UNR}: logisticsTransportEquipmentType.verifiedGrossWeightMeasure',
  'DCSA page shows title and versions only; the VGM object and who submits it were not read. The registry applicability note names SOLAS as the legal requirement source.', 'W,L')
r('doc-rail-consignment', P_, 'CC1',
  f'{UNR}: UNECE-RailURLConsignmentNote.json, UNECE-SMGSConsignmentNote.json, UNECE-MMTCIM-SMGSConsignmentNote.json; src-cotif-cim registered (page not fetched)', '', 'L')
r('doc-ocean-sea-waybill', P_, 'CC1',
  f'{DBL}: Bill of Lading 3.0 introduction section 1.3 defines Sea Waybill as a Transport Document type; DCSA model entity "Transport document type" (B/L, Sea Waybill)', '', 'W')
r('doc-arrival-notice', P_, 'CC1',
  'src-dcsa-arrival: as obj-arrival-notice (v1.0.1 glossary definition; release page)', 'Duplicate registration of obj-arrival-notice.', 'W')
r('evt-exception-detected', L_, 'CC4',
  f'{EPC}: property exception ("a sensor alert, including an alarm condition or an error condition"); src-uncefact-multimodal-visibility-brs-v1 registered (page fetch errored)',
  'EPCIS covers a narrower sensor sense. No logistics execution-exception event found in the registered sources read.', 'L,W',
  'depth gap: valid event; destination layer = visibility/exception daughter')
r('evt-delivery-attempted', L_, 'CC4',
  f'{UNR}: D23B headerTradeDeliveryType.actualDeliveryEvent (delivery event); {X12}: 214 Transportation Carrier Shipment Status Message exists (status-code list not read); {ONE}: CL code SE "Proof of delivery"',
  'No attempt/outcome concept named in any source read.', 'L,W', 'depth gap: delivery-layer event state; conceptual coverage valid')

out = []
for st in ['business_object', 'system', 'document_event']:
    for it in sel[st]:
        x = R[it['id']]
        out.append(dict(stratum=st, subtype=it['stratum'], rank=it['rank'], popIndex=it['popIndex'], id=it['id'], name=it['name'], domainIds=it['domainIds'], **x))
assert len(out) == 60 and len(R) == 60, (len(out), len(R))
json.dump(out, open(outdir + '/results.json', 'w'), indent=1)
with open(outdir + '/results.tsv', 'w') as f:
    f.write('stratum\trank\tid\tname\tcategory\tclaim_class\tevidence\tbasis\tnote\tdec057\n')
    for o in out:
        f.write('\t'.join([o['stratum'], str(o['rank']), o['id'], o['name'], o['cat'], o['cc'], o['ev'], o['basis'].replace('\t', ' '), o['note'].replace('\t', ' '), o['dec057']]) + '\n')

cats = ['PASS', 'PASS_WITH_NOTE', 'PASS_WITH_LIMITATION', 'NO_BASIS', 'UNRESOLVED', 'FAIL', 'CRITICAL']
S = {}
for st in ['business_object', 'system', 'document_event', 'ALL']:
    rows = [o for o in out if st == 'ALL' or o['stratum'] == st]
    c = collections.Counter(o['cat'] for o in rows)
    S[st] = {'n': len(rows), **{k: c.get(k, 0) for k in cats}}
cc = collections.Counter((o['cc'], o['cat']) for o in out)
S['claim_class_by_category'] = {f'{k[0]}|{k[1]}': v for k, v in sorted(cc.items())}
S['noBasis'] = [o['id'] for o in out if o['cat'] == 'NO_BASIS']
S['limitation'] = [o['id'] for o in out if o['cat'] == 'PASS_WITH_LIMITATION']
S['emptyDomainObjects'] = [o['id'] for o in out if o['stratum'] == 'business_object' and not o['domainIds']]
json.dump(S, open(outdir + '/summary.json', 'w'), indent=1)
print(json.dumps(S, indent=1))
