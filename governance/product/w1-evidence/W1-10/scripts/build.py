import json,re,sys,csv,collections
sys.path.insert(0,'../s')
from mapping_data import SCOR,AP
import importlib
# re-run explicit helpers
src=open('../s/explicit.py').read()
ns={}; os_cwd=None
exec(compile(src.split("json.dump(res")[0],'explicit','exec'),ns)
cov_scor=ns['cov_scor']; cov_apqc=ns['cov_apqc']; scor_nodes=ns['scor_nodes']; A=json.load(open('apqc_nodes.json'))['all']
rows=[]
def basis_apqc(code):
    if code in cov_apqc: return 'EXPLICIT_CITATION'
    parts=code.split('.')
    anc=['.'.join(parts[:i]) for i in range(1,len(parts))]
    anc=[x if '.' in x else x+'.0' for x in anc]
    if any(x in cov_apqc for x in anc): return 'ANCESTOR_CITED'
    if any(c.startswith(code+'.') for c in cov_apqc): return 'DESCENDANT_CITED'
    return 'SCOPE_READ'
# SCOR rows
for lvl,code,name in scor_nodes:
    st,cons,cls,crit,typ,why=SCOR[code]
    if lvl=='L1':
        ch=[c for p in ns['U']['scor'] if p['code']==code for c,_ in p['l2']]
        ex=any(c in cov_scor for c in ch) or code in cov_scor
    else: ex=code in cov_scor
    rows.append(dict(framework='SCOR DS',level=lvl,code=code,name=name,status=st,basis='EXPLICIT_CITATION' if ex else 'SCOPE_READ',constructs=cons,gap_class=cls or '',critical=crit,dec057=typ,evidence='ASCM SCOR DS v14.0 intro doc (scor.ascm.org/api/files/24) + unversioned Quick Reference Guide mirror (names/codes)',rationale=why))
# APQC rows (order by hierarchy)
def key(h): return [int(x) for x in h.split('.')]
want=[r for r in A if r['h'] in AP]
miss=[r['h'] for r in A if (r['h'].count('.')<=1 or r['h'].startswith('4.') and r['h'].count('.')<=2 or r['h'].startswith('3.5.') and r['h'].count('.')==2 or r['h'].startswith('4.4.') and r['h'].count('.')==3) and r['h'] not in AP]
print('APQC rows mapped',len(want),'in-scope not mapped',miss)
for r in sorted(want,key=lambda r:key(r['h'])):
    h=r['h']; d=h.count('.')+1; lvl='L1' if h.endswith('.0') else 'L%d'%d
    st,cons,cls,crit,typ,why=AP[h]
    rows.append(dict(framework='APQC PCF 8.0',level=lvl,code=h,name=r['name'],status=st,basis=basis_apqc(h),constructs=cons,gap_class=cls or '',critical=crit,dec057=typ,evidence='APQC Cross-Industry PCF 8.0 Excel (Project file), PCF ID %s'%r['pcf'],rationale=why))
json.dump(rows,open('mapping_core.json','w'),indent=1)
print(len(rows),collections.Counter((r['framework'],r['level']) for r in rows))
print(collections.Counter((r['framework'],r['status']) for r in rows))
print(collections.Counter((r['framework'],r['gap_class']) for r in rows if r['status']!='FULL'))
print(collections.Counter((r['framework'],r['basis']) for r in rows))
