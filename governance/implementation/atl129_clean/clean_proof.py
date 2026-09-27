"""ATL-129 clean-room executable proof model.

Built from the governed ATL-119 contract on the clean registry lineage.
This module intentionally does not import or copy ATL-121 proof code.
"""
from __future__ import annotations
import copy, hashlib, json
from dataclasses import dataclass, asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "governance/product/ATLAS_V2_BUSINESS_RULE_ONTOLOGY_RUNTIME_CONSUMPTION_CONTRACT_V0_1_CANDIDATE.md"
SOURCE = Path(__file__).parent / "fixtures/bol_authority_source.json"

SEED_FAMILIES = {
    "MANDATORY_DATA_RULE","CONDITIONAL_MANDATORY_RULE","FORMAT_RULE",
    "CLASSIFICATION_RULE","SOURCE_AUTHORITY_RULE","DECISION_RULE",
    "ROUTING_RULE","CLIENT_BINDING_RULE","EXCEPTION_HANDLING_RULE",
    "KNOWLEDGE_PROMOTION_RULE"
}

def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

def digest(value):
    raw = value if isinstance(value, bytes) else canonical_json(value).encode()
    return hashlib.sha256(raw).hexdigest()

@dataclass(frozen=True)
class Candidate:
    candidate_id: str
    field: str
    canonical_name: str
    aliases: tuple
    rule_family: str
    value_domain: str
    source_id: str
    source_hash: str
    status: str = "CANDIDATE"

class KnowledgeStore:
    def __init__(self):
        self.rules = {
            "BOL-PRO-001": {"family":"MANDATORY_DATA_RULE","field":"pro_number","taxonomy_version":"ATL119-V0.1"},
            "BOL-SHIP-001": {"family":"MANDATORY_DATA_RULE","field":"shipper_name","taxonomy_version":"ATL119-V0.1"},
        }
        self.candidates = {}
    def lookup_field(self, field):
        for rid, rule in self.rules.items():
            if rule["field"] == field:
                return {"rule_id":rid, **rule}
        return None
    def persist_candidate(self, c):
        self.candidates[c.candidate_id] = asdict(c)
        return self.candidates[c.candidate_id]

class AcquisitionPipeline:
    def __init__(self, store):
        self.store = store
    def acquire(self, trigger, requested_field):
        assert trigger in {"HUMAN","DOWNSTREAM_EXECUTION"}
        existing = self.store.lookup_field(requested_field)
        trace=[("governed_knowledge_lookup", bool(existing))]
        if existing:
            return {"trigger":trigger,"status":"EXISTING","trace":trace,"rule":existing}
        trace.append(("explicit_gap", requested_field))
        source_bytes=SOURCE.read_bytes()
        source=json.loads(source_bytes)
        trace.append(("authoritative_source_read", source["source_id"]))
        extracted=source["field"]
        trace.append(("extraction", extracted["canonical_name"]))
        normalized=extracted["canonical_name"].strip().lower()
        aliases=tuple(sorted({a.strip().lower() for a in extracted["aliases"]}))
        trace.append(("normalization_synonym_entity_resolution", [normalized,*aliases]))
        conflict = extracted["rule_family"] not in SEED_FAMILIES
        trace.append(("reconciliation_conflict_handling", "CONFLICT" if conflict else "NO_CONFLICT"))
        if conflict:
            return {"trigger":trigger,"status":"FAIL_CLOSED","trace":trace}
        trace.append(("ontology_mapping", extracted["rule_family"]))
        c=Candidate(
            candidate_id="CAND-"+digest({"field":normalized,"source":source["source_id"]})[:16],
            field=requested_field, canonical_name=normalized, aliases=aliases,
            rule_family=extracted["rule_family"], value_domain=extracted["value_domain"],
            source_id=source["source_id"], source_hash=hashlib.sha256(source_bytes).hexdigest()
        )
        persisted=self.store.persist_candidate(c)
        trace.append(("governed_candidate_persistence", c.candidate_id))
        return {"trigger":trigger,"status":"ACQUIRED","trace":trace,"candidate":persisted}

class PackageRegistry:
    def __init__(self): self.packages={}
    def release(self, candidate, consumer="MALKOM", scope="LTL_BOL_DETENTION"):
        assert candidate["status"]=="CANDIDATE"
        payload={
          "package_id":"ATL129-PKG-001","version":"1.0.0","consumer":consumer,"scope":scope,
          "work_definition":{"id":"BOL_DIGITIZATION","version":"governed-current"},
          "knowledge":[{"candidate_id":candidate["candidate_id"],"source_id":candidate["source_id"],
                        "source_hash":candidate["source_hash"],"field":candidate["canonical_name"],
                        "rule_family":candidate["rule_family"]}],
          "bindings":{"evaluation_mode":"DETERMINISTIC_EXPRESSION","distribution_mode":"EMBED"},
          "failure_behavior":"FAIL_CLOSED","promotion_state":"PENDING",
          "release_status":"RELEASED_FOR_BOUNDED_EXECUTION"
        }
        package_hash=digest(payload)
        record={**payload,"package_hash":package_hash}
        self.packages[record["package_id"]]=copy.deepcopy(record)
        return record

class RuntimeCache:
    def __init__(self): self.deployed={}
    def deploy(self, package):
        self.deployed[package["package_id"]]=copy.deepcopy(package)
        return package["package_hash"]
    def evaluate(self, package_id, shipment):
        pkg=self.deployed[package_id]
        item=pkg["knowledge"][0]
        if item["field"]=="detention_authorization_code" and shipment.get("detention_requested"):
            ok=bool(shipment.get("detention_authorization_code"))
            return {"status":"PASS" if ok else "FAIL_CLOSED","package_hash":pkg["package_hash"],
                    "candidate_id":item["candidate_id"],"source_hash":item["source_hash"]}
        return {"status":"PASS","package_hash":pkg["package_hash"]}

def bounded_validate(candidate, evidence_safe=True):
    required={"candidate_id","canonical_name","rule_family","source_id","source_hash"}
    if not evidence_safe or not required.issubset(candidate) or not candidate["source_hash"]:
        return {"state":"NOT_EXECUTION_SAFE","failure_behavior":"FAIL_CLOSED"}
    return {"state":"VALIDATED_FOR_BOUNDED_EXECUTION","candidate_id":candidate["candidate_id"]}

def promotion_disposition(candidate, promote=False):
    return {"candidate_id":candidate["candidate_id"],
            "promotion_state":"PROMOTED" if promote else "NOT_PROMOTED",
            "execution_release_affected":False}

def distribution_proof(mode, atlas_available=True, snapshot_valid=True):
    if mode=="EMBED": return "EXECUTED_OFFLINE"
    if mode=="SNAPSHOT": return "EXECUTED_SNAPSHOT" if snapshot_valid else "FAIL_CLOSED"
    if mode=="DYNAMIC_LOOKUP": return "EXECUTED_DYNAMIC" if atlas_available else "FAIL_CLOSED"
    if mode=="CLIENT_SYSTEM_LOOKUP": return "CLIENT_BINDING_LOOKUP"
    if mode=="EXTERNAL_AUTHORITY": return "MOCK_EXTERNAL_AUTHORITY"
    raise ValueError(mode)

def classify_structurally_different_rule():
    # Shipment-tracking state transition fits existing seed semantics; no manufactured extension.
    return {"domain":"SHIPMENT_TRACKING","semantic":"arrival_scan advances shipment state",
            "family":"DECISION_RULE","extension_required":False}
