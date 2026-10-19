"""Evidence candidate association, not a forced source-to-commodity join."""
from copy import deepcopy
def resolve_candidates(spans, commodity_keys):
    keys=set(commodity_keys); out=[]
    for span in deepcopy(spans):
        ref=span.get('source_id')
        if not ref: raise ValueError('source_id required')
        role=span.get('source_role')
        if role not in ('COMMODITY_DESCRIPTION','COMMODITY_ATTRIBUTE'):
            out.append({'source_id':ref,'status':'REJECTED_IRRELEVANT','candidates':[],'reason':'NON_COMMODITY_SOURCE_ROLE'});continue
        explicit=span.get('commodity_ref') if span.get('commodity_ref_role')=='EXPLICIT_COMMODITY_ID' else None
        if explicit and explicit in keys:
            out.append({'source_id':ref,'status':'SOURCE_ESTABLISHED','candidates':[explicit],'reason':'EXPLICIT_COMMODITY_ID'});continue
        hints=[k for k in span.get('candidate_commodity_refs',[]) if k in keys]; unique=list(dict.fromkeys(hints))
        out.append({'source_id':ref,'status':'AMBIGUOUS' if len(unique)>1 else 'CANDIDATE_ONLY' if unique else 'UNRESOLVED','candidates':unique,'reason':'LAYOUT_HINT_NOT_PROOF' if unique else 'NO_SUPPORTED_ASSOCIATION'})
    return out
