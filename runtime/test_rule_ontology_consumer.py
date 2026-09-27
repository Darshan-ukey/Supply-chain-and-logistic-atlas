import unittest
from runtime.rule_ontology_consumer import evaluate_ltl_bol_rule

class RuleOntologyRuntimeIntegration(unittest.TestCase):
    def test_real_consumer_executes_governed_chain(self):
        result = evaluate_ltl_bol_rule({
            "detention_requested": True,
            "detention_authorization_code": "AUTH-77",
        })
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["stage"], "runtime")
        self.assertEqual(result["package_hash"], result["deployed_package_hash"])
        self.assertEqual(result["promotion_state"], "PENDING")
        self.assertEqual(result["release_status"], "RELEASED_FOR_BOUNDED_EXECUTION")
        steps=[x[0] for x in result["acquisition_trace"]]
        self.assertEqual(steps[0:2], ["governed_knowledge_lookup", "explicit_gap"])
        self.assertIn("governed_candidate_persistence", steps)

    def test_real_consumer_fails_closed_when_required_value_missing(self):
        result = evaluate_ltl_bol_rule({"detention_requested": True})
        self.assertEqual(result["status"], "FAIL_CLOSED")
        self.assertEqual(result["stage"], "runtime")

if __name__ == "__main__":
    unittest.main(verbosity=2)
