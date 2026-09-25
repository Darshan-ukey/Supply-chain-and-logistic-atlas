#!/usr/bin/env python3
import json, sys
from pathlib import Path
from collections import Counter
CORE=["id","label","level","a3ParentId","trigger","before","event","decision","rule","control","clock","action","evidence","after","outcome","inputs","outputs","sourceIds","applicability","pathType","participants","confidenceModel","stateBeforeId","stateAfterId","decisionId","ruleId","controlId","actionId","evidenceId","outcomeId"]
PLACEHOLDERS=["resolved by contract and operating model","competent operational/contractual authority for the task","resolved by context and contract"]
def load(p): return json.loads(Path(p).read_text())
def report(path):
 d=load(path); ps=d.get('processes',[]); a3={x.get('id') for x in d.get('a3Parents',[])}; src={x.get('id') for x in d.get('sources',[])}; ids={p.get('id') for p in ps}; hard=[]; warn=[]
 for p in ps:
  miss=[k for k in CORE if k not in p or p[k] in (None,'')]
  if miss: hard.append(f"{p.get('id')}: missing core fields {miss}")
  if p.get('a3ParentId') not in a3: hard.append(f"{p.get('id')}: unknown A3")
  if any(x not in src for x in p.get('sourceIds',[])): hard.append(f"{p.get('id')}: unknown source")
  if not p.get('participants'): hard.append(f"{p.get('id')}: no participants")
  if not p.get('sourceIds'): hard.append(f"{p.get('id')}: no sources")
 for e in d.get('processFlowEdges',[]):
  if e.get('from') not in ids or e.get('to') not in ids: hard.append(f"edge {e.get('id')}: unknown endpoint")
 trans={x.get('processId') for x in d.get('executionTransitions',[])}
 if ids-trans: hard.append(f"Missing execution transitions: {sorted(ids-trans)}")
 # legacy text placeholders only block if no normalized actor-ID resolution exists
 for field,key in [('owner','owner'),('decisionAuthority','decisionAuthority'),('custody','custody'),('financial','financial'),('exceptionOwner','exceptionOwner')]:
  for p in ps:
   v=str(p.get(field,'')).lower(); normalized=p.get('responsibilityResolution',{}).get(key)
   if any(x in v for x in PLACEHOLDERS) and not normalized: warn.append(f"{p.get('id')} {field}: generic placeholder without structured resolution")
 # generic explanatory legacy fields are acceptable only when structured replacements exist
 structured={'identifiers':'identifierRefs','lineage':'structuredLineage','interface':'systemExchange','upstream':'structuredLineage','downstream':'structuredLineage'}
 for legacy,new in structured.items():
  vals=[str(p.get(legacy,'')) for p in ps if p.get(legacy) is not None]
  if vals and len(set(vals))==1 and not all(p.get(new) for p in ps): warn.append(f"{legacy}: repeated legacy text lacks structured {new}")
 if not all(p.get('documentRelevance',{}).get('state') in ['LINKED','NONE','NOT_APPLICABLE','CONTEXT_DEPENDENT'] for p in ps): warn.append('document relevance not explicit on every task')
 for f in ['canonicalProcessConceptId','provenanceClaims','temporalConstraints','shortLabel','semanticZoomLabel','systemExchange','eventRelevance','structuredLineage','a5ContractId','responsibilityResolution']:
  if not all(p.get(f) for p in ps): warn.append(f'{f} missing on one or more tasks')
 return {'module':d.get('module',{}),'processCount':len(ps),'a3Count':len(a3),'edgeCount':len(d.get('processFlowEdges',[])),'transitionCount':len(d.get('executionTransitions',[])),'hardGateStatus':'PASS' if not hard else 'FAIL','hardErrors':hard,'richnessStatus':'PASS' if not warn else 'ENRICHMENT_REQUIRED','warnings':sorted(set(warn)),'documentLinkedTaskCount':sum(p.get('documentRelevance',{}).get('state')=='LINKED' for p in ps),'documentContextDependentTaskCount':sum(p.get('documentRelevance',{}).get('state')=='CONTEXT_DEPENDENT' for p in ps)}
if __name__=='__main__': print(json.dumps(report(sys.argv[1]),indent=2))
