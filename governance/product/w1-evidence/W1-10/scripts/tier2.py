import json
T=[]
def t(fw,level,code,name,status,cons,cls,crit,typ,ev,why): T.append(dict(framework=fw,level=level,code=code,name=name,status=status,basis='SCOPE_READ',constructs=cons,gap_class=cls,critical=crit,dec057=typ,evidence=ev,rationale=why))
ISA='ISA-95 page (isa.org) read via WebFetch: part titles and Levels 0-4 names; Part 3 category names NOT on that page (assessor knowledge, not retrieved)'
t('ISA-95 / IEC 62264','Level','L0-L2','Physical process; sensing/manipulating; monitoring and supervising control','NONE','',5,'N','OUT_OF_SCOPE',ISA,'Control-system levels are outside the logistics Universe; ISA-95 is registered only for the enterprise-control boundary.')
t('ISA-95 / IEC 62264','Level','L3','Manufacturing operations management','FULL','D:transform; D:warehouse; D:assets; L:ecl-j',0,'N','',ISA,'Operations management carried by transform, warehouse and asset domains; lens J cites ISA-95.')
t('ISA-95 / IEC 62264','Level','L4','Business planning and logistics','FULL','D:plan; D:source; D:commercial; D:transport',0,'N','',ISA,'Business planning and logistics levels.')
t('ISA-95 / IEC 62264','Part 3 category','P3-prod','Production operations management','FULL','D:transform',0,'N','','assessor knowledge of Part 3 (not retrieved)','Maps to Transform.')
t('ISA-95 / IEC 62264','Part 3 category','P3-maint','Maintenance operations management','FULL','D:assets(Maintain/repair/MRO)',0,'N','','assessor knowledge of Part 3 (not retrieved)','Maps to Assets.')
t('ISA-95 / IEC 62264','Part 3 category','P3-qual','Quality operations management','PARTIAL','D:transform(Inspect and test); L:ecl-l',2,'N','DEPTH','assessor knowledge of Part 3 (not retrieved)','Quality is a lens (PARTIALLY READY) plus transform inspection.')
t('ISA-95 / IEC 62264','Part 3 category','P3-inv','Inventory operations management','FULL','D:warehouse',0,'N','','assessor knowledge of Part 3 (not retrieved)','Maps to Inventory & warehousing.')
DC='DCSA Industry Blueprint page (dcsa.org) via WebFetch: journey and phase names only; stages beneath each journey not on the page'
t('DCSA Industry Blueprint 2026.Q1','Journey','SHIP','Shipment journey (booking to payment)','FULL','D:commercial; D:transport; D:trade; D:finance; M:ocean-fcl',0,'N','',DC,'Booking-to-payment spans commercial, transport, trade and finance.')
t('DCSA Industry Blueprint 2026.Q1','Journey','EQUIP','Equipment journey (pick-up to return)','FULL','D:assets(Reposition empty equipment); D:transport',0,'N','',DC,'Container equipment movements: assets and transport.')
t('DCSA Industry Blueprint 2026.Q1','Journey','VESSEL','Vessel journey (departure to arrival, port calls)','PARTIAL','M:ocean-fcl; M:ocean-lcl; D:transport(Main carriage/transship)',3,'N','DEPTH',DC,'Vessel/port-call operations are carrier-side ocean-mode specialization (Ocean daughter), not a parent capability.')
t('DCSA Industry Blueprint 2026.Q1','Phase','PRE','Pre-shipping','FULL','D:commercial; D:trade; D:transport',0,'N','',DC,'Activities before pick-up.')
t('DCSA Industry Blueprint 2026.Q1','Phase','LINER','Liner operation','PARTIAL','M:ocean-fcl; D:transport',3,'N','DEPTH',DC,'Liner operations belong to the Ocean mode overlay/daughter.')
t('DCSA Industry Blueprint 2026.Q1','Phase','POST','Post-shipping','FULL','D:transport; D:delivery; D:warehouse',0,'N','',DC,'Terminal delivery to final destination, reporting and warehousing.')
CM='Contract Management Standard page (ccm.institute) via WebFetch: phases only (pre-award, award, post-award)'
t('Contract Management Standard 4th ed.','Phase','PRE','Pre-award','FULL','D:source(Supplier/provider selection); D:commercial; L:ecl-b',0,'N','',CM,'Need definition through selection.')
t('Contract Management Standard 4th ed.','Phase','AWD','Award','FULL','D:source(Contract); L:ecl-e',0,'N','',CM,'Contract formation.')
t('Contract Management Standard 4th ed.','Phase','POST','Post-award','PARTIAL','L:ecl-e (PARTIALLY READY)',2,'N','DEPTH',CM,'Obligation execution, change, renewal are lens-level; lens gap says obligation semantics need execution research.')
t('UN/CEFACT International Forwarding and Transport BRS v2','Process scope','ALL','Booking, instructions, waybill/status, consolidation context','NA','',0,'N','','page fetch failed (client error); not retrieved','STRUCTURE NOT RETRIEVED: no mapping asserted (UNRESOLVED). Registry applicability text names the scope; node-level mapping deferred.')
IS='ISO catalogue page only (Universe sourceRecords applicability); clause structure not retrieved (paywalled standard)'
for code,name,cons,why in [
 ('ISO 9001:2015','Quality management systems','L:ecl-l; D:transform(Inspect and test)','Quality lens carries ISO 9001.'),
 ('ISO 31000:2018','Risk management (principles, framework, process)','L:ecl-u; L:ecl-z','Risk lenses.'),
 ('ISO 22301:2019','Business continuity management systems','L:ecl-u','Resilience lens.'),
 ('ISO 37301:2021','Compliance management systems','L:ecl-z; L:ecl-t','Compliance lens.'),
 ('ISO 44001:2017','Collaborative business relationship management','L:ecl-h; L:ecl-q','Supplier and provider lenses.'),
 ('ISO 55001:2024','Asset management systems','D:assets; L:ecl-v','Assets domain and lens.'),
 ('ISO 30401:2018','Knowledge management systems','L:ecl-aa (SOURCE RESEARCH REQUIRED)','Knowledge lens, unresearched.'),
 ('ISO 10002:2018','Complaints handling','D:customer; D:claims; L:ecl-m','Customer service lens.'),
 ('ISO 30414:2025','Human capital reporting','L:ecl-w (SOURCE RESEARCH REQUIRED)','Workforce lens, unresearched.')]:
    t(code.split(':')[0],'Standard',code,name,'PARTIAL',cons,2,'N','DEPTH',IS,why+' Standard-level mapping only; clause-level NOT mapped (structure not retrieved).')
t('World CC / CIPS / ISM competency bodies; BPMN; DMN; ISO 22400','Reference kind','-','Notation, KPI set or competency reference (not process hierarchies)','NA','',0,'N','','Universe sourceRecords roles / referenceGroups use text','Not process frameworks; excluded from the mapping denominator. BPMN/DMN are notations (DMN states "not process-content evidence"); ISO 22400 is a KPI set.')
json.dump(T,open('mapping_tier2.json','w'),indent=1)
print(len(T))
