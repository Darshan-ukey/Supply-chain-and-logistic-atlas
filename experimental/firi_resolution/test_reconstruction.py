import unittest
from experimental.firi_resolution.reconstruction import reconstruct
class ReconstructionTests(unittest.TestCase):
 def test_two_explicit_identities(self):
  s=[{"source_id":"s1","commodity_ref":"A","commodity_ref_role":"EXPLICIT_COMMODITY_ID","description":"Valves"},{"source_id":"s2","commodity_ref":"B","commodity_ref_role":"EXPLICIT_COMMODITY_ID","description":"Pipes"}]
  self.assertEqual(reconstruct(s)["total_commodity_count"],2)
 def test_hu_line_number_not_commodity(self):
  r=reconstruct([{"source_id":"s1","commodity_ref":"2","commodity_ref_role":"HU_LINE_NO","description":"Parts"}])
  self.assertIsNone(r["total_commodity_count"])
 def test_row_groups_do_not_prove_cardinality(self):
  r=reconstruct([{"source_id":str(i),"page":1,"row_group":str(i),"description":"Parts"} for i in range(5)])
  self.assertEqual(r["established_commodity_count"],0)
  self.assertIsNone(r["total_commodity_count"])
 def test_description_fragments_not_silently_joined(self):
  s=[{"source_id":"s1","commodity_ref":"A","commodity_ref_role":"EXPLICIT_COMMODITY_ID","description":"Steel"},{"source_id":"s2","commodity_ref":"A","commodity_ref_role":"EXPLICIT_COMMODITY_ID","description":"fittings"}]
  self.assertEqual(reconstruct(s)["objects"][0]["description_resolution"],"UNRESOLVED")
 def test_duplicate_source_rejected(self):
  with self.assertRaises(ValueError): reconstruct([{"source_id":"s"},{"source_id":"s"}])
 def test_no_mutation(self):
  s=[{"source_id":"s","description":"Parts"}];reconstruct(s);self.assertEqual(s,[{"source_id":"s","description":"Parts"}])
 def test_explicit_and_provisional_count_unknown(self):
  r=reconstruct([{"source_id":"a","commodity_ref":"A","commodity_ref_role":"EXPLICIT_COMMODITY_ID"},{"source_id":"b","description":"unknown"}])
  self.assertEqual(r["established_commodity_count"],1)
  self.assertIsNone(r["total_commodity_count"])
if __name__=="__main__":unittest.main()
