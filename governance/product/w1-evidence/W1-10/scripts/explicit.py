import json,re,sys
U=json.load(open('data.json'))['U']; A=json.load(open('apqc_nodes.json'))
refs=[]  # (construct kind,id,framework,token)
def add(kind,id_,fw,t): refs.append((kind,id_,fw,t))
for d in U['domains']:
    for t in d['scor']: add('domain',d['id'],'scor',t)
    for t in d['apqc']: add('domain',d['id'],'apqc',t)
for l in U['enterpriseCoverage']:
    for t in l['scorRefs']: add('lens',l['id'],'scor',t)
    for t in l['apqcRefs']: add('lens',l['id'],'apqc',t)
for c in U['businessCycles']:
    for t in c['scorRefs']: add('cycle',c['id'],'scor',t)
    for t in c['apqcRefs']: add('cycle',c['id'],'apqc',t)
# SCOR nodes
scor_nodes=[]
for g in U['orchestrate']: scor_nodes.append(('L0',g[0],g[1]))
for p in U['scor']:
    scor_nodes.append(('L1',p['code'],p['l1']))
    for c,n in p['l2']: scor_nodes.append(('L2',c,n))
def scor_codes(tok):
    out=set()
    tok=tok.replace('–','-').replace('—','-')
    for m in re.finditer(r'\b(OE\d+|[POSTFR]\d)(?:\s*[-/]\s*(?:([POSTFR])?(\d+)))?',tok):
        a=m.group(1); 
        if a.startswith('OE'): out.add(a); continue
        if m.group(3):
            if '-' in tok[m.start():m.end()]:
                for i in range(int(a[1]),int(m.group(3))+1): out.add(a[0]+str(i))
            else:
                out.add(a); out.add(a[0]+m.group(3))
        else: out.add(a)
    return out
def apqc_codes(tok):
    tok=tok.replace('–','-')
    m=re.match(r'^(\d+(?:\.\d+)*)\s*-\s*(\d+(?:\.\d+)*)',tok)
    if m:
        a,b=m.groups(); pa=a.split('.'); pb=b.split('.')
        if len(pa)==len(pb) and pa[:-1]==pb[:-1]:
            return {'.'.join(pa[:-1]+[str(i)]) for i in range(int(pa[-1]),int(pb[-1])+1)}
        return {a,b}
    m=re.match(r'^(\d+(?:\.\d+)*)',tok)
    return {m.group(1)} if m else set()
cov_scor={};cov_apqc={}
for k,i,fw,t in refs:
    if fw=='scor':
        for c in scor_codes(t): cov_scor.setdefault(c,set()).add((k,i))
    else:
        for c in apqc_codes(t): cov_apqc.setdefault(c,set()).add((k,i))
# L1 SCOR code 'P' etc covered if any L2 child explicit
res={'scor':[],'apqc':[]}
for lvl,code,name in scor_nodes:
    if lvl=='L1':
        ch=[c for c,_ in [x for p in U['scor'] if p['code']==code for x in p['l2']]]
        ex=set().union(*[cov_scor.get(c,set()) for c in ch]) if ch else set()
        ex|=cov_scor.get(code,set())
    else: ex=cov_scor.get(code,set())
    res['scor'].append(dict(level=lvl,code=code,name=name,explicit=sorted(f'{k}:{i}' for k,i in ex)))
for r in A['L1']+A['L2']:
    h=r['h']; lvl='L1' if h.endswith('.0') else 'L2'
    key=h
    ex=set(cov_apqc.get(h,set()))
    pcode=h.split('.')[0]+'.0'
    parent=set(cov_apqc.get(pcode,set())) if lvl=='L2' else set()
    # children explicit (descendant cited)
    desc=set()
    for c,s in cov_apqc.items():
        if lvl=='L1' and c!=h and c.split('.')[0]==h.split('.')[0]: desc|=s
        if lvl=='L2' and c.startswith(h+'.'): desc|=s
    res['apqc'].append(dict(level=lvl,code=h,pcf=r['pcf'],name=r['name'],explicit=sorted(f'{k}:{i}' for k,i in ex),parent_level=sorted(f'{k}:{i}' for k,i in parent),descendant=sorted(f'{k}:{i}' for k,i in desc)))
json.dump(res,open('explicit.json','w'),indent=1)
print('SCOR nodes',len(res['scor']),'explicit',sum(1 for r in res['scor'] if r['explicit']))
for r in res['scor']: 
    if not r['explicit']: print('  SCOR no explicit:',r['code'],r['name'])
print('APQC',len(res['apqc']))
n=0
for r in res['apqc']:
    s='EXPL' if r['explicit'] else ('DESC' if r['descendant'] else ('PARENT' if r['parent_level'] else 'NONE'))
    print(r['code'],s,r['name'][:60], (r['explicit'] or r['descendant'] or r['parent_level'])[:3])
