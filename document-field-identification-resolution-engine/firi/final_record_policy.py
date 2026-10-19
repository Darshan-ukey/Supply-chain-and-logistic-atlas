"""Fail-closed final-record proposal policy. Never edits the input record.

A verified span is necessary but not sufficient for a correction. Explicit
independent approval is required to promote a candidate to a proposed patch.
"""
from copy import deepcopy
from collections import defaultdict


def evaluate(record, hypotheses, span_result, approvals=None):
    if not isinstance(record, dict) or not isinstance(hypotheses, list):
        raise ValueError('invalid record or hypotheses')
    if span_result.get('schema') != 'firi.source_span_gate.v0.20':
        raise ValueError('source-span verification required')
    approvals = approvals or []
    verifier_id = span_result.get('verifier_id')
    if not isinstance(verifier_id, str) or not verifier_id.strip():
        raise ValueError('source-span verifier identity required')
    approved = {}
    for a in approvals:
        if not isinstance(a, dict) or not a.get('reviewer_id') or not a.get('hypothesis_id') or not a.get('approved') is True:
            raise ValueError('invalid independent approval')
        if a['hypothesis_id'] in approved:
            raise ValueError('duplicate approval')
        if a['reviewer_id'].strip() == verifier_id.strip():
            raise ValueError('independent approval must use a reviewer distinct from the source-span verifier')
        approved[a['hypothesis_id']] = a
    decisions = span_result['provenance_resolution']['decisions']
    by_id = {h.get('hypothesis_id'):h for h in hypotheses}
    if len(by_id)!=len(hypotheses) or None in by_id or len(decisions)!=len(hypotheses):
        raise ValueError('hypothesis/decision mismatch')
    groups=defaultdict(list)
    for h in hypotheses:
        if not all(h.get(k) is not None for k in ('target_object_id','field','value')):
            raise ValueError('incomplete hypothesis')
        groups[(h['target_object_id'],h['field'])].append(h)
    output=[]
    for d in decisions:
        hid=d['hypothesis_id']
        if hid not in by_id: raise ValueError('unknown decision')
        h=by_id[hid]; reasons=[]
        if d['decision']!='SOURCE_SPAN_VERIFIED_CANDIDATE': reasons.append('SPAN_NOT_VERIFIED')
        if hid not in approved: reasons.append('INDEPENDENT_APPROVAL_MISSING')
        if len({str(x['value']).strip().casefold() for x in groups[(h['target_object_id'],h['field'])]})>1:
            reasons.append('COMPETING_HYPOTHESES')
        obj=record.get(h['target_object_id'])
        if not isinstance(obj,dict) or h['field'] not in obj: reasons.append('UNKNOWN_TARGET_FIELD')
        before=obj.get(h['field']) if isinstance(obj,dict) else None
        if not reasons and before == h['value']: reasons.append('NO_CHANGE')
        output.append({'hypothesis_id':hid,'target_object_id':h['target_object_id'], 'field':h['field'],
                       'current_value':before,'proposed_value':h['value'],
                       'decision':'PATCH_PROPOSED' if not reasons else 'NO_PATCH', 'reasons':reasons,
                       'support_ids':deepcopy(d.get('support_ids',[]))})
    return {'schema':'firi.final_record_policy.v0.22-reconstructed','proposals':output,
            'final_record':deepcopy(record),'final_record_mutated':False,
            'corrections_applied':[], 'canonical_knowledge_mutated':False,
            'limitation':'Verifier/reviewer separation is enforced by asserted identities, but identities and image regions are not authenticated by this function. Patches are proposals only.'}
