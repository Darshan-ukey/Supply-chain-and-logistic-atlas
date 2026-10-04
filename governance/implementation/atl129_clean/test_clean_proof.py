import hashlib, json, unittest
from pathlib import Path
from clean_proof import *

class ATL129CleanProof(unittest.TestCase):
    def setUp(self):
        self.store=KnowledgeStore(); self.pipe=AcquisitionPipeline(self.store)

    def acquire(self, trigger="DOWNSTREAM_EXECUTION"):
        return self.pipe.acquire(trigger,"detention_authorization_code")

    def test_01_governed_contract_present(self):
        self.assertTrue(CONTRACT.exists())
        text=CONTRACT.read_text()
        self.assertIn("ATL-119",text); self.assertIn("DYNAMIC_LOOKUP",text)
        self.assertIn("VALIDATED_FOR_BOUNDED_EXECUTION",text)

    def test_02_existing_knowledge_lookup_precedes_gap(self):
        r=self.acquire(); self.assertEqual(r["trace"][0][0],"governed_knowledge_lookup")
        self.assertEqual(r["trace"][1][0],"explicit_gap")

    def test_03_missing_field_is_genuine(self):
        self.assertIsNone(self.store.lookup_field("detention_authorization_code"))

    def test_04_source_is_committed_fixture_and_honest(self):
        src=json.loads(SOURCE.read_text())
        self.assertTrue(src["authority"]["not_external_observation"])
        self.assertEqual(src["provenance"]["status"],"TEST_AUTHORITY")

    def test_05_human_trigger_uses_pipeline(self):
        r=self.acquire("HUMAN"); self.assertEqual(r["status"],"ACQUIRED")
        self.assertEqual(r["trace"][2][0],"authoritative_source_read")

    def test_06_downstream_trigger_uses_same_pipeline(self):
        a=self.acquire("HUMAN")["trace"]
        b=AcquisitionPipeline(KnowledgeStore()).acquire("DOWNSTREAM_EXECUTION","detention_authorization_code")["trace"]
        self.assertEqual([x[0] for x in a],[x[0] for x in b])

    def test_07_normalization_and_aliases(self):
        c=self.acquire()["candidate"]
        self.assertEqual(c["canonical_name"],"detention_authorization_code")
        self.assertIn("detention auth code",c["aliases"])

    def test_08_ontology_mapping(self):
        c=self.acquire()["candidate"]; self.assertEqual(c["rule_family"],"CONDITIONAL_MANDATORY_RULE")

    def test_09_candidate_persisted_with_provenance(self):
        c=self.acquire()["candidate"]; self.assertIn(c["candidate_id"],self.store.candidates)
        self.assertEqual(len(c["source_hash"]),64)

    def test_10_structural_domain_does_not_manufacture_extension(self):
        r=classify_structurally_different_rule(); self.assertFalse(r["extension_required"])
        self.assertIn(r["family"],SEED_FAMILIES)

    def test_11_embed(self): self.assertEqual(distribution_proof("EMBED",False),"EXECUTED_OFFLINE")
    def test_12_snapshot(self): self.assertEqual(distribution_proof("SNAPSHOT",False,True),"EXECUTED_SNAPSHOT")
    def test_13_snapshot_expiry_fail_closed(self): self.assertEqual(distribution_proof("SNAPSHOT",False,False),"FAIL_CLOSED")
    def test_14_dynamic_lookup(self): self.assertEqual(distribution_proof("DYNAMIC_LOOKUP",True),"EXECUTED_DYNAMIC")
    def test_15_dynamic_dependency_fail_closed(self): self.assertEqual(distribution_proof("DYNAMIC_LOOKUP",False),"FAIL_CLOSED")
    def test_16_client_binding_lookup(self): self.assertEqual(distribution_proof("CLIENT_SYSTEM_LOOKUP"),"CLIENT_BINDING_LOOKUP")
    def test_17_external_authority_is_explicit_mock(self): self.assertEqual(distribution_proof("EXTERNAL_AUTHORITY"),"MOCK_EXTERNAL_AUTHORITY")

    def test_18_bounded_validation_distinct_from_promotion(self):
        c=self.acquire()["candidate"]; v=bounded_validate(c)
        self.assertEqual(v["state"],"VALIDATED_FOR_BOUNDED_EXECUTION")
        self.assertEqual(c["status"],"CANDIDATE")

    def test_19_release_before_promotion(self):
        c=self.acquire()["candidate"]; self.assertEqual(bounded_validate(c)["state"],"VALIDATED_FOR_BOUNDED_EXECUTION")
        p=PackageRegistry().release(c); self.assertEqual(p["promotion_state"],"PENDING")

    def test_20_nonpromotion_does_not_rewrite_released_package(self):
        c=self.acquire()["candidate"]; reg=PackageRegistry(); p=reg.release(c)
        d=promotion_disposition(c,False)
        self.assertEqual(d["promotion_state"],"NOT_PROMOTED")
        self.assertEqual(reg.packages[p["package_id"]]["promotion_state"],"PENDING")

    def test_21_package_lineage_and_runtime_execution(self):
        c=self.acquire()["candidate"]; reg=PackageRegistry(); p=reg.release(c); rt=RuntimeCache()
        self.assertEqual(rt.deploy(p),p["package_hash"])
        result=rt.evaluate(p["package_id"],{"detention_requested":True,"detention_authorization_code":"AUTH-77"})
        self.assertEqual(result["status"],"PASS"); self.assertEqual(result["candidate_id"],c["candidate_id"])
        self.assertEqual(result["source_hash"],c["source_hash"])

    def test_22_runtime_fail_closed_when_required_field_absent(self):
        c=self.acquire()["candidate"]; p=PackageRegistry().release(c); rt=RuntimeCache(); rt.deploy(p)
        result=rt.evaluate(p["package_id"],{"detention_requested":True})
        self.assertEqual(result["status"],"FAIL_CLOSED")

    def test_23_unsafe_candidate_cannot_release(self):
        c=self.acquire()["candidate"]; self.assertEqual(bounded_validate(c,False)["state"],"NOT_EXECUTION_SAFE")

    def test_24_package_is_immutable_version_closed_hash(self):
        c=self.acquire()["candidate"]; p=PackageRegistry().release(c)
        body={k:v for k,v in p.items() if k!="package_hash"}
        self.assertEqual(p["package_hash"],digest(body))

    def test_25_three_logical_storage_responsibilities_are_separate(self):
        c=self.acquire()["candidate"]; reg=PackageRegistry(); p=reg.release(c); rt=RuntimeCache(); rt.deploy(p)
        self.assertIn(c["candidate_id"],self.store.candidates)
        self.assertIn(p["package_id"],reg.packages); self.assertIn(p["package_id"],rt.deployed)
        self.assertIsNot(reg.packages[p["package_id"]],rt.deployed[p["package_id"]])

if __name__=="__main__":
    unittest.main(verbosity=2)
