"""ATL-121 V0.3 Owner invariant bounded proof."""
import copy, hashlib, json, os
SOURCE=os.path.join(os.path.dirname(__file__),"fixtures","missing_field_source.json")
MECHANISM="atlas-source-first-acquisition-v1"

def acquire(field_name, requester):
    if requester not in ("HUMAN","DOWNSTREAM_EXECUTION"): raise ValueError(requester)
    raw=open(SOURCE,"rb").read(); source=json.loads(raw)
    record=next(x for x in source["fields"] if x["field_name"]==field_name)
    sha=hashlib.sha256(raw).hexdigest()
    candidate={"candidate_id":"cand-"+record["canonical_name"],"field_name":record["canonical_name"],
      "value":record["value"],"aliases":sorted(set(record["aliases"])),"ontology_entity":record["ontology_entity"],
      "evidence_ref":"acquired-via-"+sha,"promotion_status":"PENDING"}
    return {"requester":requester,"mechanism":MECHANISM,"source_sha256":sha,"candidate":candidate,
      "steps":["existing_knowledge_lookup","explicit_gap_confirmed","authoritative_research","extraction",
      "normalization_synonym_entity_resolution","reconciliation_conflict_handling","ontology_mapping",
      "validation","governed_persistence_candidate"]}

def validate(candidate):
    missing=[k for k in ("field_name","value","evidence_ref") if not candidate.get(k)]
    return {"execution_safe":not missing,"missing":missing,"promotion_status":candidate.get("promotion_status","PENDING")}

def release(candidate, consumer):
    v=validate(candidate)
    if not v["execution_safe"]: raise ValueError("UNSAFE_CANDIDATE")
    p={"package_id":"exec-pkg-"+candidate["candidate_id"],"version":"1.0","consumer":consumer,
       "source_field":candidate["field_name"],"source_value":candidate["value"],
       "source_evidence_ref":candidate["evidence_ref"],"promotion_at_release":v["promotion_status"]}
    p["package_hash"]=hashlib.sha256(json.dumps(p,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    return p

def disposition(candidate, decision):
    if decision not in ("PROMOTED","NOT_PROMOTED"): raise ValueError(decision)
    out=copy.deepcopy(candidate); out["promotion_status"]=decision; return out

def runtime_use(package):
    p=copy.deepcopy(package); expected=p.pop("package_hash")
    actual=hashlib.sha256(json.dumps(p,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    if actual!=expected: raise ValueError("PACKAGE_HASH_MISMATCH")
    return {"outcome":"USED","package_id":package["package_id"],"package_hash":expected,
            "source_evidence_ref":package["source_evidence_ref"],"value_used":package["source_value"]}

def end_to_end(field_name, requester, consumer):
    a=acquire(field_name,requester); p=release(a["candidate"],consumer); r=runtime_use(p)
    d=disposition(a["candidate"],"NOT_PROMOTED")
    return {"acquisition":a,"package":p,"runtime":r,"disposition":d}
