"""Provenance-aware, competing-hypothesis adjudication; no domain-rule invention."""
from copy import deepcopy
from collections import defaultdict

def resolve(spans, hypotheses, *, minimum_origins=2):
    spans, hypotheses = deepcopy(spans), deepcopy(hypotheses)
    index = {}
    for s in spans:
        sid=s.get('source_id')
        if not sid or sid in index: raise ValueError('source IDs must be unique and nonempty')
        index[sid]=s
    results=[]
    for h in hypotheses:
        blockers,support,origins=set(),[],set()
        for sid in h.get('evidence_ids',[]):
            s=index.get(sid)
            if s is None: blockers.add('UNKNOWN_SOURCE'); continue
            if s.get('role_provenance')!='INDEPENDENTLY_VERIFIED': blockers.add('ROLE_NOT_VERIFIED'); continue
            if s.get('object_provenance')!='INDEPENDENTLY_VERIFIED': blockers.add('OBJECT_NOT_VERIFIED'); continue
            if s.get('role')!=h.get('field'): blockers.add('ROLE_CONTRADICTION'); continue
            if s.get('object_id')!=h.get('target_object_id'): blockers.add('OBJECT_CONTRADICTION'); continue
            if str(s.get('value','')).strip().casefold()!=str(h.get('value','')).strip().casefold(): blockers.add('VALUE_CONTRADICTION'); continue
            origin=s.get('origin_family')
            if not origin: blockers.add('UNKNOWN_ORIGIN'); continue
            support.append(sid); origins.add(origin)
        decision=('REJECT' if blockers.intersection({'UNKNOWN_SOURCE','ROLE_CONTRADICTION','OBJECT_CONTRADICTION','VALUE_CONTRADICTION'}) else 'ABSTAIN' if blockers or len(origins)<minimum_origins else 'EVIDENCE_SUPPORTED_CANDIDATE')
        if not blockers and len(origins)<minimum_origins: blockers.add('INSUFFICIENT_INDEPENDENT_ORIGINS')
        results.append({'hypothesis_id':h.get('hypothesis_id'),'decision':decision,'support_ids':sorted(set(support)),'independent_origin_count':len(origins),'reasons':sorted(blockers),'auto_applied':False})
    groups=defaultdict(list)
    for i,h in enumerate(hypotheses): groups[(h.get('target_object_id'),h.get('field'))].append(i)
    for group in groups.values():
        supported=[i for i in group if results[i]['decision']=='EVIDENCE_SUPPORTED_CANDIDATE']
        if len({str(hypotheses[i].get('value')).strip().casefold() for i in supported})>1:
            for i in supported:
                results[i]['decision']='ABSTAIN'; results[i]['reasons'].append('COMPETING_SUPPORTED_VALUES')
    return {'schema':'firi.provenance_resolver.v0.10','decisions':results,'corrections_applied':[],'canonical_knowledge_mutated':False}
