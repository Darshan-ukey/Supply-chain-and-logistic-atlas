import unittest
from experimental.firi_resolution.knowledge_requirements import plan
class KnowledgePlannerTests(unittest.TestCase):
 def test_invoice_hs_not_unconditionally_required(self):
  r=plan("COMMERCIAL_INVOICE",{},{"jurisdiction":"IN"})
  self.assertIn("classification.HS_REQUIREMENT_APPLICABILITY",[x["key"] for x in r["atlas_requests"]])
  self.assertIsNone(r["compliance_decision"])
 def test_hazard_suspected_requests_authority(self):
  r=plan("AWB",{"dangerous_goods_signal":"SUSPECTED"},{"transport_mode":"AIR"})
  self.assertTrue(any(x["key"]=="dangerous_goods.UN_ID" for x in r["atlas_requests"]))
  self.assertTrue(any(x.get("code")=="DG_REVIEW_REQUIRED" for x in r["findings"]))
 def test_absence_not_nonhazardous(self):
  r=plan("BOL",{"dangerous_goods_signal":"NOT_DECLARED"},{})
  self.assertTrue(any(x.get("code")=="DG_STATUS_NOT_ESTABLISHED" for x in r["findings"]))
 def test_unverified_atlas_not_authoritative(self):
  r=plan("CUSTOMS_DECLARATION",{}, {},{"classification.HS_REQUIREMENT_APPLICABILITY":{"status":"VERIFIED"}})
  self.assertEqual(len(r["atlas_requests"]),1)
 def test_versioned_authority_recognized_not_applied(self):
  a={"classification.HS_REQUIREMENT_APPLICABILITY":{"status":"VERIFIED","authority":"TEST","version":"1","effective_date":"2026-01-01"}}
  r=plan("COMMERCIAL_INVOICE",{}, {},a)
  self.assertEqual(len(r["atlas_requests"]),0)
  self.assertEqual(r["findings"][0]["status"],"REFERENCE_AVAILABLE_NOT_VALIDATED")
 def test_battery_requests_mode_specific_rule(self):
  r=plan("AWB",{"battery_signal":True},{"transport_mode":"AIR"})
  self.assertIn("battery.TRANSPORT_CONDITIONS",[x["key"] for x in r["atlas_requests"]])
if __name__=="__main__":unittest.main()
