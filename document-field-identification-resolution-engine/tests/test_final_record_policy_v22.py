import unittest
from firi.source_span_gate import verify
from firi.final_record_policy import evaluate

R=[{'source_id':'s','document_id':'d','text':'229 cartons'}]
A=[{'source_id':'s','document_id':'d','text':'229 cartons','page':1,'region':'row-1','role':'quantity','object_id':'item1','value':'229'}]
H={'hypotheses':[{'hypothesis_id':'h','evidence_ids':['s'],'field':'quantity','target_object_id':'item1','value':'229'}]}
BASE={'item1':{'quantity':'228'}}

class TestV22Integrity(unittest.TestCase):
    def test_same_verifier_and_approver_rejected(self):
        span=verify(R,H,A,verifier_id='reviewer-1')
        with self.assertRaises(ValueError):
            evaluate(BASE,H['hypotheses'],span,[{'hypothesis_id':'h','reviewer_id':'reviewer-1','approved':True}])

    def test_distinct_verifier_and_approver_can_propose(self):
        span=verify(R,H,A,verifier_id='source-reviewer')
        result=evaluate(BASE,H['hypotheses'],span,[{'hypothesis_id':'h','reviewer_id':'final-reviewer','approved':True}])
        self.assertEqual(result['proposals'][0]['decision'],'PATCH_PROPOSED')
        self.assertFalse(result['final_record_mutated'])

    def test_v22_still_does_not_apply_correction(self):
        span=verify(R,H,A,verifier_id='source-reviewer')
        result=evaluate(BASE,H['hypotheses'],span,[{'hypothesis_id':'h','reviewer_id':'final-reviewer','approved':True}])
        self.assertEqual(result['final_record'],BASE)
        self.assertEqual(result['corrections_applied'],[])

if __name__=='__main__': unittest.main()
