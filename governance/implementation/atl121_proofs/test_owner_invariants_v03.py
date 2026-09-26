import pytest
from owner_invariants_v03 import acquire, validate, release, disposition, runtime_use, end_to_end

FIELD="detention_authorization_code"

def test_dual_trigger_same_source_first_pipeline():
    h=acquire(FIELD,"HUMAN"); d=acquire(FIELD,"DOWNSTREAM_EXECUTION")
    assert h["mechanism"]==d["mechanism"] and h["steps"]==d["steps"]
    assert h["source_sha256"]==d["source_sha256"] and h["candidate"]["evidence_ref"]==d["candidate"]["evidence_ref"]

def test_missing_bol_field_is_source_backed_and_normalized():
    a=acquire(FIELD,"HUMAN")
    assert a["candidate"]["ontology_entity"]=="BOL_FIELD" and a["candidate"]["aliases"]
    assert a["candidate"]["promotion_status"]=="PENDING"

def test_release_precedes_promotion():
    a=acquire(FIELD,"DOWNSTREAM_EXECUTION"); p=release(a["candidate"],"MALKOM_REFERENCE")
    assert validate(a["candidate"])["execution_safe"] and p["promotion_at_release"]=="PENDING"

def test_later_nonpromotion_preserves_released_lineage():
    a=acquire(FIELD,"HUMAN"); p=release(a["candidate"],"MALKOM_REFERENCE")
    d=disposition(a["candidate"],"NOT_PROMOTED")
    assert d["promotion_status"]=="NOT_PROMOTED" and p["source_evidence_ref"]==a["candidate"]["evidence_ref"]

def test_runtime_cache_use_preserves_package_lineage():
    a=acquire(FIELD,"HUMAN"); p=release(a["candidate"],"MALKOM_REFERENCE"); r=runtime_use(p)
    assert r["outcome"]=="USED" and r["package_hash"]==p["package_hash"] and r["source_evidence_ref"]==p["source_evidence_ref"]

def test_unsafe_candidate_fails_closed():
    bad={"candidate_id":"bad","field_name":FIELD}
    assert not validate(bad)["execution_safe"]
    with pytest.raises(ValueError,match="UNSAFE_CANDIDATE"): release(bad,"MALKOM_REFERENCE")

def test_complete_fast_path():
    r=end_to_end(FIELD,"DOWNSTREAM_EXECUTION","MALKOM_REFERENCE")
    assert r["runtime"]["outcome"]=="USED" and r["disposition"]["promotion_status"]=="NOT_PROMOTED"
