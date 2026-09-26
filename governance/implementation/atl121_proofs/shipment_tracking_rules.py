"""
ATL-121 Proof 3 — structurally different domain (shipment tracking, not BOL
digitization) used to test taxonomy extensibility. TRK-R01's *shape* is
declared as data and scored by rule_ontology.classify_fit at test time —
the fit/no-fit conclusion is computed, not asserted in prose.
"""

from rule_ontology import DistributionMode, EvaluationMode, RuleDecl, RuleFamily

# Candidate rule under test: a shipment's status becomes DELIVERED only when
# BOTH a proof-of-delivery scan event AND a recipient signature capture are
# present; if neither is present and the SLA cutoff has passed, it becomes
# EXCEPTION; otherwise IN_TRANSIT.
TRK_R01_SHAPE = {
    "multi_signal": True,
    "has_temporal_cutoff": True,
    "is_state_transition": True,
    "is_reconciliation_of_observations": True,
    "is_classification_or_derivation": False,
    "is_external_authority_sourced": False,
}

TRK_R01 = RuleDecl(
    rule_id="TRK-R01",
    version="1.0",
    family=RuleFamily.DECISION_ROUTING_STATE,  # provisional pending classify_fit result
    evaluation_mode=EvaluationMode.COMPOSITE,
    distribution_mode=DistributionMode.EMBED,
    kind="composite_state_transition",
    params={
        "signals": ["pod_scan_event", "signature_capture_event"],
        "cutoff_field": "sla_cutoff_passed",
    },
    notes=(
        "Shipment-tracking domain rule (not BOL digitization) used for the "
        "Proof 3 taxonomy-extensibility test."
    ),
)

SAMPLE_TRACKING_RECORDS = {
    "delivered": {"pod_scan_event": True, "signature_capture_event": True, "sla_cutoff_passed": False},
    "in_transit": {"pod_scan_event": False, "signature_capture_event": False, "sla_cutoff_passed": False},
    "exception": {"pod_scan_event": False, "signature_capture_event": False, "sla_cutoff_passed": True},
    "partial_signals": {"pod_scan_event": True, "signature_capture_event": False, "sla_cutoff_passed": False},
}
