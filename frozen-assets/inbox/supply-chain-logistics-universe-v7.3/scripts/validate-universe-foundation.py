#!/usr/bin/env python3
from pathlib import Path
import re, sys, json, hashlib

if len(sys.argv) < 2:
    raise SystemExit('usage: validate-universe-foundation.py <html> [pre-normalization-html]')
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
errors=[]
# declared IDs (record declarations, not reference arrays)
declared_ids=[x for x in re.findall(r"\{id:'([^']+)'",s) if not x.startswith('supply-chain-logistics-universe-v')]
loc=re.search(r"\{id:'obj-location-master',code:'',name:'([^']*)',aliases:\[([^\]]*)\]",s)
if not loc: errors.append('obj-location-master record missing')
else:
    name=loc.group(1)
    aliases=re.findall(r"'([^']+)'",loc.group(2))
    if name!='Location Master': errors.append(f'location canonical name is {name!r}')
    for a in ['Location Identity','Place Master','Site Master']:
        if a not in aliases: errors.append(f'missing location alias: {a}')
    if '/' in name or re.search(r'\sor\s',name,re.I): errors.append('location canonical name is not atomic')
# global atomic Business Object check
block=re.search(r"const businessObjectRecords=\[(.*?)\]\.map\(",s,re.S)
if not block:
    # V7 block ends directly before actor records; tolerate this shape.
    block=re.search(r"const businessObjectRecords=\[(.*?)\];\s*const actorRecords",s,re.S)
if block:
    for rid,name in re.findall(r"\{id:'([^']+)'[^\n]*?name:'([^']+)'",block.group(1)):
        if '/' in name or re.search(r'\sor\s',name,re.I):
            errors.append(f'non-atomic business-object canonical name {rid}: {name}')
if "objectId:'obj-location-master',object:'Location Master'" not in s:
    errors.append('Location Master authority display not normalized')
# Stable-reference checks
if s.count("'obj-location-master'") < 4:
    errors.append('unexpectedly few obj-location-master references')
# Optional pre/post declared-ID parity check
parity={}
if len(sys.argv)>2:
    before=Path(sys.argv[2]).read_text(encoding='utf-8')
    before_ids={x for x in re.findall(r"\{id:'([^']+)'",before) if not x.startswith('supply-chain-logistics-universe-v')}; after_ids=set(declared_ids)
    parity={'beforeDeclaredIds':len(before_ids),'afterDeclaredIds':len(after_ids),'addedIds':sorted(after_ids-before_ids),'removedIds':sorted(before_ids-after_ids)}
    if before_ids!=after_ids: errors.append(f'declared ID set changed during normalization: {parity}')
# Universe V7.2 source-governance guards
required_v72 = ['src-uncefact-ift-brs-v2','src-uncefact-multimodal-visibility-brs-v1','src-smdg-terminal-messages','src-fmc-oti-nvocc']
for sid in required_v72:
    if sid not in s: errors.append(f'V7.2 required source ID missing from artifact: {sid}')
if "watchStatus:'FINALIZATION_IN_PROGRESS_NOT_PROMOTED'" not in s: errors.append('CTU revision candidate/finalization is not explicitly non-promoted')
if "jurisdictionIds:['jur-north-america']" not in s: errors.append('FMC source jurisdiction guard missing')

if "signatureOpeningDate:'2026-10-26'" not in s: errors.append('NCD signature-opening status refresh missing')
if "sourceGovernanceStatus:'EMERGING_NOT_IN_FORCE'" not in s: errors.append('NCD must remain emerging/not in force')

result={
  'status':'PASS' if not errors else 'FAIL',
  'file':str(p),
  'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
  'declaredIdCount':len(set(declared_ids)),
  'locationMasterReferenceCount':s.count("'obj-location-master'"),
  'parity':parity,
  'errors':errors
}
print(json.dumps(result,indent=2))
raise SystemExit(0 if not errors else 1)
