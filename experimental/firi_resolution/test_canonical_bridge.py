"""Experimental ATL-134 rule bridge smoke tests; not a real BOL pilot."""
import unittest
from experimental.firi_resolution.canonical_bridge import evaluate,RULES
C={"field_id":"BOL-002","rules":[{"id":k,"stage":v} for k,v in RULES.items()]}
class TestBridge(unittest.TestCase):
    def test_compound_field_detection(self):
        source=[{"source_id":"s1","description_candidate":"MACHINE PARTS","field_candidates":[{"raw":"4 PLT"}]}]
        result=evaluate(source,{"items":[{"source_id":"s1","description":"4 PLT MACHINE PARTS"}]},C)
        self.assertTrue(any(c["rule_id"]=="FIRI-BOL002-R01" and c["status"]=="FAIL" for c in result["checks"]))
        self.assertEqual(result["corrections"],[])
    def test_five_source_groups_three_rows_abstains(self):
        source=[{"source_id":str(i),"row_group":str(i),"description_candidate":f"ITEM {i}"} for i in range(5)]
        result=evaluate(source,{"items":[{"source_id":str(i),"description":f"ITEM {i}"} for i in range(3)]},C)
        self.assertIsNone(result["established_commodity_count"])
        self.assertEqual(next(c for c in result["checks"] if c["rule_id"]=="FIRI-BOL002-R02")["status"],"UNRESOLVED")
    def test_no_hu_equals_commodity_assumption(self):
        result=evaluate([{"source_id":"s1","description_candidate":"PARTS","field_candidates":[{"raw":"4 PLT"}]}],{"items":[{"source_id":"s1","description":"PARTS"}]},C)
        self.assertEqual(next(c for c in result["checks"] if c["rule_id"]=="FIRI-BOL002-R03")["status"],"UNRESOLVED")
    def test_rule_identity_mismatch_rejected(self):
        with self.assertRaises(ValueError):evaluate([],{"items":[]},{"field_id":"BOL-002","rules":[]})
    def test_original_not_mutated(self):
        b={"items":[{"source_id":"s1","description":"PARTS"}]}
        evaluate([{"source_id":"s1","description_candidate":"PARTS"}],b,C)
        self.assertEqual(b,{"items":[{"source_id":"s1","description":"PARTS"}]})
    def test_missing_nmfc_authority_abstains(self):
        r=evaluate([],{"items":[]},C)
        self.assertEqual(next(c for c in r["checks"] if c["rule_id"]=="FIRI-BOL002-R04")["status"],"UNRESOLVED")
if __name__=="__main__":unittest.main()
