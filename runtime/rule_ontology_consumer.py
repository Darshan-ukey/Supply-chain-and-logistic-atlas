"""Governed Atlas rule-ontology runtime consumer for F-130-06.

This is an execution-facing caller, deliberately separate from the ATL-129 proof tests.
It consumes the governed acquisition/package/runtime interfaces and exposes one bounded
transaction that downstream execution can call without treating proof-harness PASS as
product integration.
"""
from governance.implementation.atl129_clean.clean_proof import (
    AcquisitionPipeline,
    KnowledgeStore,
    PackageRegistry,
    RuntimeCache,
    bounded_validate,
)

def evaluate_ltl_bol_rule(shipment, requested_field="detention_authorization_code", trigger="DOWNSTREAM_EXECUTION"):
    store = KnowledgeStore()
    acquisition = AcquisitionPipeline(store).acquire(trigger, requested_field)
    if acquisition.get("status") not in {"ACQUIRED", "EXISTING"}:
        return {"status": "FAIL_CLOSED", "stage": "acquisition", "trace": acquisition.get("trace", [])}
    if acquisition["status"] == "EXISTING":
        return {"status": "FAIL_CLOSED", "stage": "packaging", "reason": "existing_rule_projection_not_implemented"}

    candidate = acquisition["candidate"]
    validation = bounded_validate(candidate)
    if validation.get("state") != "VALIDATED_FOR_BOUNDED_EXECUTION":
        return {"status": "FAIL_CLOSED", "stage": "validation", "candidate_id": candidate.get("candidate_id")}

    registry = PackageRegistry()
    package = registry.release(candidate)
    runtime = RuntimeCache()
    deployed_hash = runtime.deploy(package)
    result = runtime.evaluate(package["package_id"], shipment)
    return {
        **result,
        "stage": "runtime",
        "package_id": package["package_id"],
        "deployed_package_hash": deployed_hash,
        "promotion_state": package["promotion_state"],
        "release_status": package["release_status"],
        "acquisition_trace": acquisition["trace"],
    }
