import unittest
from experimental.firi_resolution.execution_pipeline import evaluate
class PipelineTests(unittest.TestCase):
 def test_omitted_identity(self):
  r=evaluate([{"source_id":"a","commodity_key":"A","identity_established":True}],[])
  self.assertEqual(r["findings"][0]["code"],"OMITTED_COMMODITY")
 def test_wrong_weight(self):
  s=[{"source_id":"a","commodity_key":"A","identity_established":True,"field":"weight","value":1200,"explicit_association":True}]
  r=evaluate(s,[{"commodity_key":"A","attributes":{"weight":800}}])
  self.assertIn("VALUE_CONTRADICTED",[f["code"] for f in r["findings"]])
  self.assertEqual(r["corrections_applied"],[])
 def test_source_conflict(self):
  s=[{"source_id":str(v),"commodity_key":"A","field":"weight","value":v,"explicit_association":True} for v in (100,200)]
  self.assertIn("CONFLICTING_SOURCES",[f["code"] for f in evaluate(s,[{"commodity_key":"A","attributes":{"weight":100}}])["findings"]])
 def test_weight_arithmetic(self):
  a={"gross_weight":12,"net_weight":8,"tare_weight":3,"gross_weight_uom":"kg","net_weight_uom":"kg","tare_weight_uom":"kg"}
  self.assertIn("WEIGHT_ARITHMETIC_CONFLICT",[f["code"] for f in evaluate([],[{"commodity_key":"A","attributes":a}])["findings"]])
 def test_mixed_units_abstain(self):
  a={"gross_weight":12,"net_weight":8,"tare_weight":3,"gross_weight_uom":"kg","net_weight_uom":"lb","tare_weight_uom":"kg"}
  self.assertNotIn("WEIGHT_ARITHMETIC_CONFLICT",[f["code"] for f in evaluate([],[{"commodity_key":"A","attributes":a}])["findings"]])
 def test_no_implicit_association(self):
  s=[{"source_id":"a","commodity_key":"A","field":"weight","value":10}]
  self.assertIn("ASSOCIATION_MISSING",[f["code"] for f in evaluate(s,[{"commodity_key":"A","attributes":{"weight":10}}])["findings"]])
if __name__=="__main__":unittest.main()
