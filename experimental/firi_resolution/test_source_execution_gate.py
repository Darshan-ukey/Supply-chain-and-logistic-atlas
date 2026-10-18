import unittest
from experimental.firi_resolution.source_execution_gate import evaluate_rule
class GateTests(unittest.TestCase):
 def test_heuristic(self):self.assertEqual(evaluate_rule({"claim_type":"HEURISTIC"})["decision"],"CANDIDATE_ONLY")
 def test_missing_provision(self):self.assertEqual(evaluate_rule({"claim_type":"SOURCE_BACKED"})["decision"],"BLOCK_AUTHORITY_EXECUTION")
 def complete(self,kind="SOURCE_BACKED"):
  x=dict.fromkeys(("authority","document","version","provision","applicability","semantic_claim","atlas_mapping","execution_rule_id","tests"),"x")
  x.update(claim_type=kind,source_verified=True,applicability_verified=True)
  return x
 def test_unverified_source(self):
  x=self.complete();x["source_verified"]=False
  self.assertEqual(evaluate_rule(x)["reasons"],["SOURCE_NOT_VERIFIED"])
 def test_verified(self):self.assertEqual(evaluate_rule(self.complete())["decision"],"ELIGIBLE_FOR_BOUNDED_VALIDATION")
 def test_derived_requires_derivation(self):self.assertEqual(evaluate_rule(self.complete("DERIVED"))["reasons"],["MISSING_DERIVATION"])
if __name__=="__main__":unittest.main()
