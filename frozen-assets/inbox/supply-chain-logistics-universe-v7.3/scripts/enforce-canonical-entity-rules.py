#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit('usage: enforce-canonical-entity-rules.py <html>')
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
orig=s
# Normalize the one historical parent ambiguity by stable ID.
pat=r"\{id:'obj-location-master',code:'',name:'[^']*',aliases:\[[^\]]*\],description:'Governed identity for a physical or logical business location/site\. It remains distinct from party identity, free-text address, node type and transient execution location; GS1/UN location codes apply only within their source scope\.'\}"
repl="{id:'obj-location-master',code:'',name:'Location Master',aliases:['Location Identity','Place Master','Site Master'],description:'Governed identity for a physical or logical business location/site. It remains distinct from party identity, free-text address, node type and transient execution location; GS1/UN location codes apply only within their source scope.'}"
s,n=re.subn(pat,repl,s,count=1)
if n != 1:
    raise SystemExit(f'expected exactly one obj-location-master record; normalized {n}')
# Normalize the display label on the authority record while preserving authority semantics.
s,n2=re.subn(r"(\{id:'AUTH-12',objectId:'obj-location-master',object:)'[^']*'",r"\1'Location Master'",s,count=1)
if n2 != 1:
    raise SystemExit(f'expected exactly one AUTH-12 location authority record; normalized {n2}')
p.write_text(s,encoding='utf-8')
print('changed' if s!=orig else 'already-normalized')
