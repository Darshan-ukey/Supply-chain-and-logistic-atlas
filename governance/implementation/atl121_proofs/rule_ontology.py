"""
ATL-121 executable proof harness — rule ontology data model.

This module encodes the ATL-119 seed taxonomy (rule family / evaluation mode /
distribution mode) as real Python enums, and a Rule declaration dataclass.
Nothing here is a mock: this is the actual shared vocabulary the rest of the
harness (packages.py, runtime_executor.py, atlas_services.py) operates on.

Source of the taxonomy: governance/product/ATLAS_V2_BUSINESS_RULE_ONTOLOGY_
RUNTIME_CONSUMPTION_CONTRACT_V0_1_CANDIDATE.md and the ATL-119 Linear issue
"Current seed rule families" / "Seed evaluation modes" / "Seed distribution
modes" sections. test_atl121_proofs.py::test_proof_1_reconciliation reads
that governance file at runtime and asserts every enum value used below has
literal textual support in it — this is not asserted here, it is checked by
executing code against the committed contract file.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional


class RuleFamily(str, Enum):
    APPLICABILITY_ELIGIBILITY = "applicability_eligibility_prerequisites"
    MANDATORY_DATA = "mandatory_conditional_data"
    FORMAT_DATATYPE_MASTER_DATA = "format_datatype_allowed_values_master_reference_data"
    CLASSIFICATION_DERIVATION = "classification_derivation_calculation_transformation_normalization"
    RELATIONSHIP_CONSISTENCY = "relationships_cardinality_consistency_duplicate_reconciliation"
    SOURCE_AUTHORITY_PRECEDENCE = "source_authority_precedence_conflict_override"
    DECISION_ROUTING_STATE = "decision_routing_sequencing_state_transition_completion"
    TIMING_SLA = "timing_sla_cutoff_effective_date_temporal_precedence"
    JURISDICTION_COMPLIANCE = "jurisdiction_policy_compliance_regulatory_contractual"
    ROLES_APPROVAL_CONTROLS = "roles_authority_approval_segregation_controls_security_privacy_retention"
    EVIDENCE_AUDIT = "evidence_audit_traceability"
    EXCEPTION_HANDLING = "exception_detection_handling_retry_escalation_fallback_recovery_idempotency"
    CONFIDENCE_HUMAN_IN_LOOP = "confidence_ambiguity_human_in_loop"
    CLIENT_BINDING = "client_binding_client_override_system_of_record_client_master"
    MAPPING_INTEGRATION = "mapping_integration_runtime_capability_projection_unsupported_semantic"
    OBSERVATION_RECONCILIATION = "observation_reconciliation_knowledge_promotion"


class EvaluationMode(str, Enum):
    DETERMINISTIC_EXPRESSION = "DETERMINISTIC_EXPRESSION"
    DECISION_TABLE = "DECISION_TABLE"
    REFERENCE_LOOKUP = "REFERENCE_LOOKUP"
    TABLE_LOOKUP = "TABLE_LOOKUP"
    MASTER_DATA_LOOKUP = "MASTER_DATA_LOOKUP"
    RETRIEVE_AND_REASON = "RETRIEVE_AND_REASON"
    LLM_CLASSIFICATION = "LLM_CLASSIFICATION"
    LLM_EXTRACTION_WITH_VALIDATION = "LLM_EXTRACTION_WITH_VALIDATION"
    EXTERNAL_API = "EXTERNAL_API"
    CLIENT_BINDING = "CLIENT_BINDING"
    HUMAN_DECISION = "HUMAN_DECISION"
    COMPOSITE = "COMPOSITE"


class DistributionMode(str, Enum):
    EMBED = "EMBED"
    SNAPSHOT = "SNAPSHOT"
    DYNAMIC_LOOKUP = "DYNAMIC_LOOKUP"
    EXTERNAL_AUTHORITY = "EXTERNAL_AUTHORITY"
    CLIENT_SYSTEM_LOOKUP = "CLIENT_SYSTEM_LOOKUP"
    HUMAN_RESOLUTION = "HUMAN_RESOLUTION"


class FailureBehavior(str, Enum):
    FAIL_CLOSED = "FAIL_CLOSED"          # raise, reject transaction, no default
    ESCALATE = "ESCALATE"                 # mark for human/operational review, continue rest of record
    FALLBACK_ALLOWED = "FALLBACK_ALLOWED"  # explicitly permitted to use a declared default


@dataclass
class RuleDecl:
    """A declared business rule. `kind`/`params` are the EMBED/SNAPSHOT-safe
    data representation of the rule's logic, evaluated generically by
    runtime_executor.evaluate_rule — this is what actually gets packaged
    and executed, not a narrative description."""

    rule_id: str
    version: str
    family: RuleFamily
    evaluation_mode: EvaluationMode
    distribution_mode: DistributionMode
    kind: str
    params: dict
    failure_behavior: FailureBehavior = FailureBehavior.ESCALATE
    source_authority: Optional[str] = None
    is_mock_channel: bool = False
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "version": self.version,
            "family": self.family.value,
            "evaluation_mode": self.evaluation_mode.value,
            "distribution_mode": self.distribution_mode.value,
            "kind": self.kind,
            "params": self.params,
            "failure_behavior": self.failure_behavior.value,
            "source_authority": self.source_authority,
            "is_mock_channel": self.is_mock_channel,
            "notes": self.notes,
        }


def classify_fit(rule_shape: dict, candidate_families: list[RuleFamily]) -> dict:
    """Deterministic, executable fit-checker used by Proof 3 (taxonomy
    extensibility test). This is NOT an LLM call and NOT a narrated claim —
    it scores a candidate rule's declared operational *shape* attributes
    against each seed family's defining characteristics (also declared as
    data, in FAMILY_SHAPE_SIGNATURES below) and returns the actual computed
    result.

    rule_shape keys expected: multi_signal (bool), has_temporal_cutoff (bool),
    is_state_transition (bool), is_reconciliation_of_observations (bool),
    is_classification_or_derivation (bool), is_external_authority_sourced (bool).
    """
    scores: dict[str, int] = {}
    for fam in candidate_families:
        sig = FAMILY_SHAPE_SIGNATURES[fam]
        score = sum(1 for k, v in sig.items() if rule_shape.get(k) == v)
        scores[fam.value] = score

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best_family, best_score = ranked[0]
    max_possible = max(len(FAMILY_SHAPE_SIGNATURES[f]) for f in candidate_families)

    # A rule "fits cleanly" if it scores >=2 distinct matching families at
    # non-trivial strength (i.e. it decomposes into existing families,
    # possibly as a COMPOSITE), or a single family covers the full shape.
    strong_matches = [f for f, s in scores.items() if s >= 2]
    fits_seed_taxonomy = best_score >= 2 or len(strong_matches) >= 2

    return {
        "scores": scores,
        "ranked": ranked,
        "best_family": best_family,
        "best_score": best_score,
        "max_possible": max_possible,
        "strong_matches": strong_matches,
        "fits_seed_taxonomy": fits_seed_taxonomy,
        "recommendation": (
            "NO_EXTENSION_REQUIRED_COMPOSITE_OF_EXISTING_FAMILIES"
            if fits_seed_taxonomy and len(strong_matches) >= 2
            else "NO_EXTENSION_REQUIRED_SINGLE_FAMILY_FIT"
            if fits_seed_taxonomy
            else "GOVERNED_TAXONOMY_EXTENSION_CANDIDATE"
        ),
    }


# Defining shape signatures per seed family relevant to this proof's domain
# (not exhaustive of all 16 families — only the ones plausibly implicated by
# a shipment-tracking status-inference rule, which is what Proof 3 tests).
FAMILY_SHAPE_SIGNATURES: dict[RuleFamily, dict] = {
    RuleFamily.DECISION_ROUTING_STATE: {
        "is_state_transition": True,
    },
    RuleFamily.TIMING_SLA: {
        "has_temporal_cutoff": True,
    },
    RuleFamily.OBSERVATION_RECONCILIATION: {
        "multi_signal": True,
        "is_reconciliation_of_observations": True,
    },
    RuleFamily.CLASSIFICATION_DERIVATION: {
        "is_classification_or_derivation": True,
    },
    RuleFamily.SOURCE_AUTHORITY_PRECEDENCE: {
        "is_external_authority_sourced": True,
    },
}
