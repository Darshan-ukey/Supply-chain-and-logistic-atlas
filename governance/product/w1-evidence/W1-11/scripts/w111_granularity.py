#!/usr/bin/env python3
"""W1-11 read-only analysis. Input: data.json from extract.mjs (frozen V7.3 HTML registries, W1-02 hook). Output: result.json.
Question: can domain/family-level source links support Source Watch impact analysis, or is entity-level tagging needed?
Route definitions (R1..R4) are derived ONLY from fields already in the frozen file; nothing is inferred from source text."""
import json,sys,collections,statistics
D=json.load(open(sys.argv[1])); U=D['U']; out=sys.argv[2]
ids=U['activePage0SourceIds']; S=U['sourceRecords']
def fam(k):
    n=k.lower()
    return [i for i in ids if i=='src-'+n or i.startswith('src-'+n+'-') or (n=='cesni' and i.startswith('src-cesni'))]
dom={x['id']:x for x in U['domains']}
recs=[(g['key'],r) for g in U['entityRegistryGroups'] for r in g['records']]
ent={r['id']:g for g,r in recs}
def dom_ents(d):
    s=set(d['systemIds']+d['inputObjectIds']+d['outputObjectIds']+d['actorIds']+d['eventIds']+d['documentIds'])
    s|={r['id'] for g,r in recs if d['id'] in r.get('domainIds',[])}
    return s
DE={k:dom_ents(v) for k,v in dom.items()}
sd=collections.defaultdict(set); sl=collections.defaultdict(set); sc=collections.defaultdict(set); route=collections.defaultdict(set)
for x in U['domains']:
    for k in x['sources']:
        for s in fam(k): sd[s].add(x['id']); route[s].add('R1 domain family key')
for dk,lst in U['evidenceProfiles'].items():
    for e in lst:
        for s in fam(e['key']): sd[s].add(dk); route[s].add('R1 evidenceProfile family key')
for l in U['enterpriseCoverage']:
    for s in l['sourceIds']: sl[s].add(l['id']); sd[s]|=set(l['domainIds']); route[s].add('R2 lens direct sourceIds')
for c in U['businessCycles']:
    for s in c['sourceIds']: sc[s].add(c['id']); sd[s]|=set(c['domainIds']); route[s].add('R2 cycle direct sourceIds')
unres=[(x['id'],k) for x in U['domains'] for k in x['sources'] if not fam(k)]
unres_ev=[(dk,e['key']) for dk,l in U['evidenceProfiles'].items() for e in l if not fam(e['key'])]
def reach(s):
    e=set()
    for d in sd[s]: e|=DE[d]
    for l in U['enterpriseCoverage']:
        if l['id'] in sl[s]: e|=set(l['systemIds']+l['objectIds'])
    for c in U['businessCycles']:
        if c['id'] in sc[s]: e|=set(c['systemIds']+c['objectIds'])
    return e
R={s:reach(s) for s in ids}
allr=set().union(*R.values())
unreach=[i for i in ent if i not in allr]
unlinked=[s for s in ids if not route[s]]
ndom=[len(sd[s]) for s in ids]
linked=[s for s in ids if sd[s]]
es=sorted(len(R[s]) for s in linked)
res={
 'input':{'sha256':D['sha256'],'bytes':D['bytes'],'pageErrors':len(D['pageErrors'])},
 'sources':len(ids),'entities':len(ent),
 'unresolvedFamilyKeys_domains':unres,'unresolvedFamilyKeys_evidenceProfiles':unres_ev,
 'F4_definition_D3_noStructuredRoute':{'count':len(unlinked),'ids':unlinked,'roles':{s:S[s]['role'] for s in unlinked}},
 'sourcesReachingDomains':{'ge1':len(linked),'zero':len(ids)-len(linked),'distribution':sorted(collections.Counter(ndom).items()),
   'oneToThree':sum(1 for n in ndom if 1<=n<=3),'fourToSeven':sum(1 for n in ndom if 4<=n<=7),'eightPlus':sum(1 for n in ndom if n>=8)},
 'derivedEntityReviewScope_perLinkedSource':{'n':len(es),'min':es[0],'median':statistics.median(es),'p90':es[int(len(es)*.9)],'max':es[-1]},
 'broadSources':[(s,len(sd[s]),len(R[s])) for s in ids if len(sd[s])>=8],
 'entitiesReachableFromAnySource':{'reachable':len(allr),'of':len(ent),'unreachable':len(unreach),'unreachableByGroup':dict(collections.Counter(ent[i] for i in unreach)),'unreachableIds':sorted(unreach)},
 'entitiesWithoutDomainIds':dict(collections.Counter(g for g,r in recs if not r.get('domainIds'))),
 'placementGroupRoute':{'sourcesWithPlacementGroup':len({i for p in D['placementSources'] for i in p['ids']}),'placements':len(D['placementSources']),'placementsWithoutSourceId':sum(1 for p in D['placementSources'] if not p['ids'])},
 'sourceRouteTable':{s:{'domains':sorted(sd[s]),'lenses':sorted(sl[s]),'cycles':sorted(sc[s]),'routes':sorted(route[s]),'derivedEntityScope':len(R[s]),'role':S[s]['role']} for s in ids},
 'lensReadiness':{k:v for k,v in collections.Counter(l['status'] for l in U['enterpriseCoverage']).items()},
 'embeddedIdentity':{k:U['universeReleaseMetadata'][k] for k in ('id','version','releaseDate','correctionCycle')},
}
json.dump(res,open(out,'w'),indent=1)
for k in ('unresolvedFamilyKeys_domains','unresolvedFamilyKeys_evidenceProfiles','F4_definition_D3_noStructuredRoute','sourcesReachingDomains','derivedEntityReviewScope_perLinkedSource','broadSources','entitiesReachableFromAnySource','entitiesWithoutDomainIds','placementGroupRoute','lensReadiness'):
    v=res[k]; 
    if k=='entitiesReachableFromAnySource': v={a:b for a,b in v.items() if a!='unreachableIds'}
    if k=='F4_definition_D3_noStructuredRoute': v={'count':v['count'],'ids':v['ids']}
    print(k,json.dumps(v))
