from pathlib import Path
import json, hashlib, re, subprocess, tempfile, sys
import jsonschema
from bs4 import BeautifulSoup
root=Path('/mnt/data/atlas-canvas-stage18.5')
base=Path('/mnt/data/atlas-canvas-stage18')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p): return json.loads(Path(p).read_text())
checks=[]
def check(name, cond, details=None):
    checks.append({'name':name,'status':'PASS' if cond else 'FAIL','details':details})
    if not cond: print('FAIL',name,details)
# Canonical preservation
for rel in ['data/atlas-registry.json','data/page0/page0-v6.2.2.json','data/modules/road-ltl-v1.2.json']:
    check(f'Canonical unchanged: {rel}', sha(root/rel)==sha(base/rel), {'stage18':sha(base/rel),'stage18.5':sha(root/rel)})
reg=read(root/'data/atlas-registry.json'); page=read(root/'data/page0/page0-v6.2.2.json'); road=read(root/'data/modules/road-ltl-v1.2.json')
check('Canonical counts retained',len(reg['items'])==71 and len(page['page0Domains'])==15 and len(road['a3Parents'])==13 and len(road['processes'])==22 and len(road['processFlowEdges'])==39 and len(road['executionTransitions'])==22 and len(road['sources'])==29, {'registry':len(reg['items']),'page0':len(page['page0Domains']),'a3':len(road['a3Parents']),'processes':len(road['processes']),'edges':len(road['processFlowEdges']),'transitions':len(road['executionTransitions']),'sources':len(road['sources'])})
# Contracts and packs
core=read(root/'data/core/enterprise-core-ontology-v1.json'); sc=read(root/'data/domains/supply-chain-domain-pack-v1.json'); ap=read(root/'data/domains/accounts-payable-fixture-domain-pack-v1.json'); apm=read(root/'data/fixtures/accounts-payable-module-v0.1.json'); cat=read(root/'data/module-catalog.json')
check('Core ontology has requested 15 concepts',len(core['concepts'])==15,[x['name'] for x in core['concepts']])
ds=read(root/'data/contracts/domain-extension-contract-v1.schema.json'); ms=read(root/'data/contracts/enterprise-module-contract-v1.schema.json')
try:
    jsonschema.Draft202012Validator(ds).validate(sc); jsonschema.Draft202012Validator(ds).validate(ap); schema_packs=True
except Exception as e: schema_packs=False; packerr=str(e)
check('Domain packs validate against one extension contract',schema_packs,None if schema_packs else packerr)
try:
    jsonschema.Draft202012Validator(ms).validate(apm); schema_ap=True
except Exception as e: schema_ap=False; aperr=str(e)
check('AP fixture validates against enterprise module contract',schema_ap,None if schema_ap else aperr)
check('SCM specificity moved to Supply Chain domain pack',len(sc['territories'])==15 and len(sc['applicabilityDimensions'])==7 and len(sc['signalTypes'])==5 and len(sc['transformationHeuristics'])==8, {'territories':len(sc['territories']),'dimensions':len(sc['applicabilityDimensions']),'signals':[x['id'] for x in sc['signalTypes']],'heuristics':len(sc['transformationHeuristics'])})
check('AP pack differs structurally from SCM pack',len(ap['territories'])==7 and len(ap['applicabilityDimensions'])==3 and len(ap['signalTypes'])==4 and 'physical' not in [x['id'] for x in ap['signalTypes']], {'territories':len(ap['territories']),'dimensions':[x['id'] for x in ap['applicabilityDimensions']],'signals':[x['id'] for x in ap['signalTypes']]})
# Core leakage scan
corejs=(root/'engine/domain-neutral-core.js').read_text().lower()
forbidden=['road ltl','shipment','handling unit','carrier','bill of lading','awb','pod','movementpattern','carriageregime','page0domainid']
leaks=[x for x in forbidden if x in corejs]
check('Domain-neutral engine contains no SCM vocabulary/legacy field assumptions',not leaks,leaks)
# Fixture publication gate
fx=next((x for x in cat.get('testFixtures',[]) if x.get('id')=='accounts-payable-fixture'),None)
check('AP fixture is registry-driven but non-publishable',bool(fx) and fx.get('testOnly') and fx.get('mustNotPublish') and not fx.get('approved'),fx)
# Acceptance smoke result
smoke=subprocess.run(['node','tests/stage18.5-domain-neutral-smoke.mjs'],cwd=root,capture_output=True,text=True)
check('Domain-neutral AP acceptance test passes',smoke.returncode==0,smoke.stdout.strip() if smoke.returncode==0 else smoke.stderr)
smokejson=read(root/'tests/stage18.5-domain-neutral-smoke.json')
check('Acceptance path complete',all(smokejson['acceptance'].get(k)=='PASS' for k in ['moduleRegistry','rules','canvas','semanticZoom','playback','inspector','trace','transformation']) and smokejson['acceptance']['engineChangesRequiredForAP']==0,smokejson['acceptance'])
# JavaScript syntax for source and standalone inline scripts
srcs=['engine/domain-neutral-core.js','engine/adapters/supply-chain-legacy-v1.js','engine/adapters/legacy-canvas-compat.js','stage17-client.js','stage18-client.js']+[str(p.relative_to(root)) for p in (root/'api').glob('*.js')]
js_ok=True; js_err=[]
for rel in srcs:
    r=subprocess.run(['node','--check',str(root/rel)],capture_output=True,text=True)
    if r.returncode: js_ok=False;js_err.append(rel+': '+r.stderr)
check('Source JavaScript syntax',js_ok,js_err or {'files':len(srcs)})
inline_ok=True;inline_err=[]
for htmlname in ['index.html','preview-standalone.html','accounts-payable-fixture-standalone.html']:
    text=(root/htmlname).read_text();
    for i,m in enumerate(re.finditer(r'<script(?:\\s[^>]*)?>(.*?)</script>',text,re.S),1):
        attrs=text[m.start():text.find('>',m.start())+1]
        if 'src=' in attrs: continue
        f=Path(tempfile.gettempdir())/f's185_{htmlname.replace(".","_")}_{i}.js';f.write_text(m.group(1));r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
        if r.returncode:inline_ok=False;inline_err.append(f'{htmlname} script {i}: {r.stderr}')
check('Inline/standalone JavaScript syntax',inline_ok,inline_err or 'PASS')
# Static initial DOM ids (scripts excluded)
soup=BeautifulSoup((root/'index.html').read_text(),'html.parser')
for script in soup.find_all('script'): script.decompose()
ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
dups=sorted({i for i in ids if ids.count(i)>1})
check('No duplicate IDs in initial static DOM',not dups,dups)
# Stage 18.5 architecture files present
required=['data/core/enterprise-core-ontology-v1.json','data/contracts/domain-extension-contract-v1.schema.json','data/contracts/enterprise-module-contract-v1.schema.json','data/domain-pack-catalog.json','data/domains/supply-chain-domain-pack-v1.json','data/domains/accounts-payable-fixture-domain-pack-v1.json','data/fixtures/accounts-payable-module-v0.1.json','engine/domain-neutral-core.js','engine/adapters/supply-chain-legacy-v1.js','engine/adapters/legacy-canvas-compat.js']
check('All domain-boundary artifacts present',all((root/x).exists() for x in required),[x for x in required if not (root/x).exists()])
status='PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL'
out={'stage':'18.5','auditType':'POST_BUILD','status':status,'canonicalCounts':{'registryItems':71,'page0Domains':15,'roadLtlA3':13,'roadLtlProcesses':22,'roadLtlEdges':39,'roadLtlTransitions':22,'roadLtlSources':29},'checks':checks,'browserRuntime':{'status':'NOT_RUN','reason':'Container Chromium hangs on local/file navigation; pure engine, contracts, syntax, and fixture acceptance were validated instead.'},'stage19Status':'PAUSED_PROVISIONAL_UNTIL_REBASED_ON_18_5'}
(root/'audit-after-stage18.5.json').write_text(json.dumps(out,indent=2))
print(status,len(checks),'checks')
if status!='PASS': sys.exit(1)
