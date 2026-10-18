"""Experimental tests for explicit many-to-many association."""
import unittest
from experimental.firi_resolution.association import associate
class AssociationTests(unittest.TestCase):
    def test_one_hu_two_commodities(self):
        r=associate([{"id":"c1"},{"id":"c2"}],[{"id":"h1"}],[{"commodity_id":c,"handling_unit_id":"h1","source_ids":[c],"relationship_explicit":True} for c in ("c1","c2")])
        self.assertEqual(len(r["edges"]),2)
    def test_two_hus_one_commodity(self):
        r=associate([{"id":"c1"}],[{"id":"h1"},{"id":"h2"}],[{"commodity_id":"c1","handling_unit_id":h,"source_ids":[h],"relationship_explicit":True} for h in ("h1","h2")])
        self.assertEqual(len(r["edges"]),2)
    def test_many_to_many(self):
        links=[{"commodity_id":c,"handling_unit_id":h,"source_ids":[c+h],"relationship_explicit":True} for c in ("c1","c2") for h in ("h1","h2")]
        self.assertEqual(len(associate([{"id":"c1"},{"id":"c2"}],[{"id":"h1"},{"id":"h2"}],links)["edges"]),4)
    def test_ambiguous_no_link(self):
        r=associate([{"id":"c1"}],[{"id":"h1"}],[{"commodity_id":"c1","handling_unit_id":"h1","source_ids":["s1"]}])
        self.assertEqual(r["edges"],[])
    def test_no_source_no_link(self):
        r=associate([{"id":"c1"}],[{"id":"h1"}],[{"commodity_id":"c1","handling_unit_id":"h1","relationship_explicit":True}])
        self.assertEqual(r["edges"],[])
    def test_unknown_object_no_link(self):
        r=associate([{"id":"c1"}],[{"id":"h1"}],[{"commodity_id":"c2","handling_unit_id":"h1","source_ids":["s1"],"relationship_explicit":True}])
        self.assertEqual(r["edges"],[])
if __name__=="__main__":unittest.main()
