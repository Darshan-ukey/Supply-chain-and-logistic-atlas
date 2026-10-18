import unittest
from experimental.firi_resolution.failure_localizer import localize

class ExceptionLocalization(unittest.TestCase):
    def test_missing_commodity_invoice(self):
        e=[{'source_id':'a','commodity_key':'A','identity_established':True,'field':'description','value':'valves'}, {'source_id':'b','commodity_key':'B','identity_established':True,'field':'description','value':'pipes'}]
        r=localize('COMMERCIAL_INVOICE',e,[{'commodity_key':'A','source_ids':['a']}])
        self.assertIn('F01_OMITTED_COMMODITY',[x['code'] for x in r['findings']])
    def test_swapped_weights_awb(self):
        e=[{'source_id':'a','commodity_key':'A','identity_established':True,'association_explicit':True,'field':'weight','value':'1200'}, {'source_id':'b','commodity_key':'B','identity_established':True,'association_explicit':True,'field':'weight','value':'800'}]
        r=localize('AWB',e,[{'commodity_key':'A','source_ids':['a'],'attributes':{'weight':'800'}},{'commodity_key':'B','source_ids':['b'],'attributes':{'weight':'1200'}}])
        self.assertEqual(sum(x['code']=='F05_WRONG_COMMODITY_ATTRIBUTE_ASSOCIATION' for x in r['findings']),2)
    def test_missing_link_abstains(self):
        e=[{'source_id':'a','commodity_key':'A','identity_established':True,'field':'weight','value':'1200'}]
        r=localize('BOL',e,[{'commodity_key':'A','source_ids':['a'],'attributes':{'weight':'800'}}])
        self.assertIn('F13_UNRESOLVED_AMBIGUITY',[x['code'] for x in r['findings']]);self.assertEqual(r['corrections'],[])
    def test_unknown_provenance(self):
        r=localize('PACKING_LIST',[],[{'source_ids':['fake']}])
        self.assertIn('F14_MISSING_SOURCE_PROVENANCE',[x['code'] for x in r['findings']])
    def test_unsupported_identity(self):
        r=localize('CUSTOMS_DECLARATION',[],[{'commodity_key':'C','source_ids':[]}])
        self.assertIn('F12_UNSUPPORTED_INFERENCE',[x['code'] for x in r['findings']])
    def test_duplicate_evidence_rejected(self):
        with self.assertRaises(ValueError):localize('BOL',[{'source_id':'a'},{'source_id':'a'}],[])
    def test_no_mutation(self):
        e=[{'source_id':'a'}];o=[{'source_ids':['a']}]
        localize('BOL',e,o);self.assertEqual(e,[{'source_id':'a'}]);self.assertEqual(o,[{'source_ids':['a']}])
if __name__=='__main__':unittest.main()
