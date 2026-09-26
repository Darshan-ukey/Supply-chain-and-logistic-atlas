"""
ATL-121 Proof 2 — bounded LTL-03/BOL rule set, classified against the seed
taxonomy. Reuses the rule *content* already researched under ATL-60 (LTL-03
execution-logic graph / BOL field universe); what changes versus the
rejected prior submission is that each rule below is a real, executable
RuleDecl consumed by packages.py/runtime_executor.py, not a narrative
description.
"""

from rule_ontology import (
    DistributionMode,
    EvaluationMode,
    FailureBehavior,
    RuleDecl,
    RuleFamily,
)

BOL_RULES: list[RuleDecl] = [
    RuleDecl(
        rule_id="BOL-R01",
        version="1.0",
        family=RuleFamily.MANDATORY_DATA,
        evaluation_mode=EvaluationMode.DETERMINISTIC_EXPRESSION,
        distribution_mode=DistributionMode.EMBED,
        kind="field_presence",
        params={"field": "shipper_name"},
        notes="BOL shipper name is mandatory per BOL information-resolution baseline.",
    ),
    RuleDecl(
        rule_id="BOL-R02",
        version="1.0",
        family=RuleFamily.FORMAT_DATATYPE_MASTER_DATA,
        evaluation_mode=EvaluationMode.DETERMINISTIC_EXPRESSION,
        distribution_mode=DistributionMode.EMBED,
        kind="regex_format",
        params={"field": "weight_lbs", "pattern": r"\d+(\.\d{1,2})?"},
        notes="Declared weight must be numeric with at most 2 decimal places.",
    ),
    RuleDecl(
        rule_id="BOL-R03",
        version="1.0",
        family=RuleFamily.CLASSIFICATION_DERIVATION,
        evaluation_mode=EvaluationMode.EXTERNAL_API,
        distribution_mode=DistributionMode.EXTERNAL_AUTHORITY,
        kind="external_lookup",
        params={"field": "commodity_description"},
        source_authority="NMFTA (National Motor Freight Traffic Association)",
        is_mock_channel=True,
        failure_behavior=FailureBehavior.ESCALATE,
        notes="NMFC freight classification is externally authoritative; Atlas is not source of truth.",
    ),
    RuleDecl(
        rule_id="BOL-R04",
        version="1.0",
        family=RuleFamily.JURISDICTION_COMPLIANCE,
        evaluation_mode=EvaluationMode.TABLE_LOOKUP,
        distribution_mode=DistributionMode.SNAPSHOT,
        kind="table_lookup",
        params={"field": "hazmat_un_number", "table": "hazmat_snapshot"},
        notes="Hazmat UN-number classification snapshotted at package build time.",
    ),
    RuleDecl(
        rule_id="BOL-R05",
        version="1.0",
        family=RuleFamily.APPLICABILITY_ELIGIBILITY,
        evaluation_mode=EvaluationMode.DETERMINISTIC_EXPRESSION,
        distribution_mode=DistributionMode.EMBED,
        kind="set_membership",
        params={"field": "carrier_scac", "allowed_set": ["SEFL", "AACT", "SAIA"]},
        notes="Carrier SCAC must be in the lane's eligible-carrier set.",
    ),
    RuleDecl(
        rule_id="BOL-R06",
        version="1.0",
        family=RuleFamily.CLIENT_BINDING,
        evaluation_mode=EvaluationMode.CLIENT_BINDING,
        distribution_mode=DistributionMode.CLIENT_SYSTEM_LOOKUP,
        kind="client_binding_lookup",
        params={"field": "accessorial_code"},
        notes="Liftgate accessorial code is universal in meaning but client-specific in encoding.",
    ),
    RuleDecl(
        rule_id="BOL-R07",
        version="1.0",
        family=RuleFamily.TIMING_SLA,
        evaluation_mode=EvaluationMode.TABLE_LOOKUP,
        distribution_mode=DistributionMode.DYNAMIC_LOOKUP,
        kind="dynamic_lookup",
        params={"field": "fuel_surcharge_pct"},
        failure_behavior=FailureBehavior.FAIL_CLOSED,
        notes="Fuel surcharge must be current at billing time; mandatory, no stale fallback permitted.",
    ),
    RuleDecl(
        rule_id="BOL-R08",
        version="1.0",
        family=RuleFamily.RELATIONSHIP_CONSISTENCY,
        evaluation_mode=EvaluationMode.DETERMINISTIC_EXPRESSION,
        distribution_mode=DistributionMode.EMBED,
        kind="uniqueness_check",
        params={"field": "bol_number", "registry": "bol_number_registry"},
        notes="BOL number must not duplicate a previously seen number in this execution scope.",
    ),
    RuleDecl(
        rule_id="BOL-R10",
        version="1.0",
        family=RuleFamily.TIMING_SLA,
        evaluation_mode=EvaluationMode.DETERMINISTIC_EXPRESSION,
        distribution_mode=DistributionMode.EMBED,
        kind="time_cutoff",
        params={"field": "pickup_requested_time", "cutoff": "17:00"},
        notes="Same-day pickup requests after the 17:00 cutoff route to next-day.",
    ),
]

HAZMAT_SNAPSHOT_V1 = {
    "version": "hazmat-snapshot-2026-09-01",
    "data": {
        "UN1993": {"class": "3", "packing_group": "II", "label": "Flammable liquid, n.o.s."},
        "UN3077": {"class": "9", "packing_group": "III", "label": "Environmentally hazardous substance, solid, n.o.s."},
    },
}

HAZMAT_SNAPSHOT_V2 = {
    "version": "hazmat-snapshot-2026-09-27",
    "data": {
        **HAZMAT_SNAPSHOT_V1["data"],
        "UN1170": {"class": "3", "packing_group": "II", "label": "Ethanol solution"},
    },
}

SAMPLE_BOL_RECORD_VALID = {
    "shipper_name": "Acme Manufacturing Co",
    "weight_lbs": "482.50",
    "commodity_description": "LCD_TV_PALLETIZED",
    "hazmat_un_number": "UN1993",
    "carrier_scac": "SEFL",
    "bol_number": "BOL-2026-000481",
    "pickup_requested_time": "14:30",
}
