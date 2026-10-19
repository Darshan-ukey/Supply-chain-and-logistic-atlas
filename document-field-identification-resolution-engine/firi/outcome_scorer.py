"""Exact adjudicated-field scorer. Never treats proposed hypotheses as applied output."""
from copy import deepcopy
def score(expected, baseline, final, required_fields=None):
    if not isinstance(expected,dict) or not expected: raise ValueError('nonempty adjudicated ground truth required')
    if not isinstance(baseline,dict) or not isinstance(final,dict): raise ValueError('baseline and final must be keyed records')
    if required_fields is not None and not isinstance(required_fields,dict): raise ValueError('required_fields must be a mapping')
    counts=dict(total=0,baseline_correct=0,final_correct=0,corrected=0,harmed=0,unchanged_correct=0,unchanged_incorrect=0); changes=[]
    for rid,fields in expected.items():
        if not isinstance(fields,dict): raise ValueError('ground truth records must be objects')
        keys=required_fields.get(rid,list(fields)) if required_fields is not None else list(fields)
        for key in keys:
            if key not in fields: raise ValueError('required field lacks adjudicated truth')
            truth=fields[key]; b=baseline.get(rid,{}).get(key); f=final.get(rid,{}).get(key); bc=b==truth and b is not None; fc=f==truth and f is not None
            counts['total']+=1; counts['baseline_correct']+=bc; counts['final_correct']+=fc; counts['corrected']+=not bc and fc; counts['harmed']+=bc and not fc; counts['unchanged_correct']+=bc and fc; counts['unchanged_incorrect']+=not bc and not fc
            if b!=f: changes.append({'record_id':rid,'field':key,'before':deepcopy(b),'after':deepcopy(f),'adjudicated':deepcopy(truth),'outcome':'IMPROVED' if not bc and fc else 'HARMED' if bc and not fc else 'NO_ACCURACY_CHANGE'})
    if not counts['total']: raise ValueError('no adjudicated fields')
    total=counts['total']; counts.update(baseline_accuracy=counts['baseline_correct']/total,final_accuracy=counts['final_correct']/total,absolute_accuracy_gain=(counts['final_correct']-counts['baseline_correct'])/total,harmful_correction_rate=counts['harmed']/counts['baseline_correct'] if counts['baseline_correct'] else None)
    return {'metrics':counts,'changes':changes,'score_basis':'EXACT_ADJUDICATED_FIELDS','warning':'Does not independently verify adjudication or detect missing ground-truth records.'}
