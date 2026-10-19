"""Bounded single-document source-span verification; never trusts LLM authority labels."""
from copy import deepcopy
from .provenance_resolver import resolve
def verify(source_rows, model_response, trusted_anchors, *, verifier_id):
    if not isinstance(verifier_id, str) or not verifier_id.strip(): raise ValueError('independent verifier identity required')
    if not isinstance(model_response, dict) or not isinstance(model_response.get('hypotheses'), list): raise ValueError('invalid hypotheses')
    if not isinstance(trusted_anchors, list): raise ValueError('trusted anchors must be list')
    rows={r['source_id']:r for r in source_rows}
    if len(rows)!=len(source_rows) or not all(rows): raise ValueError('duplicate or empty source ID')
    evidence=[]; seen=set()
    for anchor in trusted_anchors:
        if not isinstance(anchor,dict): raise ValueError('invalid anchor')
        sid=anchor.get('source_id')
        if sid in seen or sid not in rows: raise ValueError('duplicate or unknown source anchor')
        seen.add(sid); row=rows[sid]
        if not isinstance(row.get('text'),str) or anchor.get('text')!=row['text']: raise ValueError('source span text mismatch')
        if not all(anchor.get(k) for k in ('document_id','page','region','role','object_id','value')): raise ValueError('missing image locator or semantic attestation')
        if row.get('document_id')!=anchor['document_id']: raise ValueError('document mismatch')
        evidence.append({'source_id':sid,'text':row['text'],'role':anchor['role'],'object_id':anchor['object_id'],'value':anchor['value'],'role_provenance':'INDEPENDENTLY_VERIFIED','object_provenance':'INDEPENDENTLY_VERIFIED','origin_family':'SINGLE_DOCUMENT_VERIFIED_SPAN'})
    hypotheses=deepcopy(model_response['hypotheses'])
    if len(hypotheses)>50: raise ValueError('too many hypotheses')
    decisions=resolve(evidence,hypotheses,minimum_origins=1)
    for d in decisions['decisions']:
        if d['decision']=='EVIDENCE_SUPPORTED_CANDIDATE':
            d['decision']='SOURCE_SPAN_VERIFIED_CANDIDATE'; d['reasons'].append('SINGLE_DOCUMENT_VERIFIER_ATTESTED')
    return {'schema':'firi.source_span_gate.v0.20','verifier_id':verifier_id,'provenance_resolution':decisions,'corrections_applied':[],'final_record_mutated':False,'canonical_knowledge_mutated':False,'limitation':'Trusted anchor assertions require independent image review; this code does not authenticate images.'}
