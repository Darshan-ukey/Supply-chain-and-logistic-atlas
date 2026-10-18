import unittest
from experimental.firi_resolution.exception_engine import execute
class TestExceptionExecution(unittest.TestCase):
 def test_wrong_association(self):
  s=[{"source_id":"s1","commodity_key":"A","field":"weight","value":1200,"explicit_association":True}]
  r=execute(s,[{"commodity_key":"A","attributes":{"weight":800}}])
  self.assertEqual(r["findings"][0]["code"],"WRONG_COMMODITY_ATTRIBUTE")
  self.assertEqual(r["findings"][0]["proposed_value"],1200)
  self.assertEqual(r["corrections_applied"],[])
 def test_source_conflict(self):
  s=[{"source_id":str(v),"commodity_key":"A","field":"weight","value":v,"explicit_association":True} for v in (10,20)]
  r=execute(s,[{"commodity_key":"A","attributes":{"weight":10}}])
  self.assertEqual(r["findings"][0]["code"],"SOURCE_CONFLICT")
 def test_unproven_association(self):
  s=[{"source_id":"s1","commodity_key":"A","field":"weight","value":10}]
  r=execute(s,[{"commodity_key":"A","attributes":{"weight":10}}])
  self.assertEqual(r["findings"][0]["status"],"UNRESOLVED")
 def test_supported(self):
  s=[{"source_id":"s1","commodity_key":"A","field":"weight","value":10,"explicit_association":True}]
  r=execute(s,[{"commodity_key":"A","attributes":{"weight":10}}])
  self.assertEqual(r["findings"][0]["status"],"SUPPORTED")
 def test_duplicate_source(self):
  with self.assertRaises(ValueError):execute([{"source_id":"s"},{"source_id":"s"}],[])
 def test_no_mutation(self):
  o=[{"commodity_key":"A","attributes":{"weight":2}}];execute([],o)
  self.assertEqual(o,[{"commodity_key":"A","attributes":{"weight":2}}])
if __name__=="__main__":unittest.main()
