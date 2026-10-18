import unittest
from experimental.firi_resolution.commodity_intelligence import inspect,FAMILIES
class TestAllFamilies(unittest.TestCase):
 def test_ten_families(self):
  samples={"dangerous_goods":{"un_number":"UN3480"},"classification":{"hs_code":"850760"},"controlled_goods":{"restriction_code":"R"},"origin":{"country_of_origin":"IN"},"bio_agri":{"phytosanitary_certificate":"P"},"pharma_cold_chain":{"batch_number":"B"},"battery":{"battery_chemistry":"lithium"},"special_cargo":{"height":"4m"},"packaging":{"pallet_count":3},"quantities":{"gross_weight":100}}
  self.assertEqual(len(FAMILIES),10)
  for family,fields in samples.items():
   with self.subTest(family=family):
    self.assertTrue(any(x.get("family")==family and x["status"]=="OBSERVED" for x in inspect("BOL",fields)["findings"]))
 def test_optional_absence(self):self.assertEqual(inspect("COMMERCIAL_INVOICE",{})["findings"],[])
 def test_unverified_rule(self):
  r=inspect("COMMERCIAL_INVOICE",{},required_fields={"hs_code":{"applicability":"CANDIDATE"}})
  self.assertEqual(r["findings"][0]["status"],"REQUIREMENT_UNVERIFIED")
 def test_verified_rule(self):
  r=inspect("COMMERCIAL_INVOICE",{},required_fields={"hs_code":{"applicability":"VERIFIED","authority":"TEST","version":"1","effective_date":"2026-01-01"}})
  self.assertEqual(r["findings"][0]["status"],"MISSING_REQUIRED_FIELD")
 def test_hazard_candidate(self):
  r=inspect("AWB",{},"flammable liquid")
  self.assertTrue(any(x.get("family")=="dangerous_goods" and x["status"]=="CANDIDATE" for x in r["findings"]))
  self.assertIsNone(r["compliance_decision"])
 def test_immutable(self):
  fields={"gross_weight":12};inspect("BOL",fields);self.assertEqual(fields,{"gross_weight":12})
if __name__=="__main__":unittest.main()
