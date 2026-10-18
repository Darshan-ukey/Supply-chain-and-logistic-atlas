import unittest
from experimental.firi_resolution.commodity_signals import recognize
class CommoditySignalsTests(unittest.TestCase):
 def test_optional_absence_not_error(self):
  r=recognize("COMMERCIAL_INVOICE",{},"steel parts")
  self.assertEqual(r["findings"],[])
 def test_hs_observed_not_verified(self):
  r=recognize("COMMERCIAL_INVOICE",{"hsn_code":"850760"},"")
  self.assertEqual(r["findings"][0]["status"],"OBSERVED")
  self.assertEqual(r["findings"][0]["verification"],"NOT_PERFORMED")
 def test_restriction_code_observed(self):
  r=recognize("CUSTOMS_DECLARATION",{"restriction_code":"R-TEST"},"")
  self.assertEqual(r["findings"][0]["family"],"restriction_code")
 def test_pharma_candidate(self):
  r=recognize("COMMERCIAL_INVOICE",{},"pharmaceutical tablets")
  self.assertTrue(any(f["family"]=="pharmaceutical" and f["status"]=="CANDIDATE" for f in r["findings"]))
 def test_battery_dg_candidate(self):
  r=recognize("AWB",{},"Lithium-ion batteries UN3480")
  self.assertTrue(any(f["family"]=="battery" for f in r["findings"]))
  self.assertTrue(any(f["family"]=="dangerous_goods" for f in r["findings"]))
  self.assertIsNone(r["compliance_decision"])
 def test_supplied_reference_not_automatic_verification(self):
  r=recognize("BOL",{"nmfc":"12345"},"",references={"nmfc":"unverified"})
  self.assertEqual(r["findings"][0]["verification"],"NOT_PERFORMED")
if __name__=="__main__":unittest.main()
