"""Policy gate: domain rules require provenance; heuristics remain candidate-only."""
REQUIRED=("authority","document","version","provision","applicability","semantic_claim","atlas_mapping","execution_rule_id","tests")
def evaluate_rule(rule):
    kind=rule.get("claim_type","HEURISTIC")
    if kind not in ("SOURCE_BACKED","DERIVED","HEURISTIC","UNRESOLVED"):
        return {"decision":"REJECT","reasons":["INVALID_CLAIM_TYPE"]}
    if kind in ("HEURISTIC","UNRESOLVED"):
        return {"decision":"CANDIDATE_ONLY","reasons":["NO_VERIFIED_AUTHORITY"]}
    missing=[k for k in REQUIRED if not rule.get(k)]
    if missing:
        return {"decision":"BLOCK_AUTHORITY_EXECUTION","reasons":["MISSING_"+k.upper() for k in missing]}
    if rule.get("source_verified") is not True:
        return {"decision":"BLOCK_AUTHORITY_EXECUTION","reasons":["SOURCE_NOT_VERIFIED"]}
    if rule.get("applicability_verified") is not True:
        return {"decision":"BLOCK_AUTHORITY_EXECUTION","reasons":["APPLICABILITY_NOT_VERIFIED"]}
    if kind=="DERIVED" and not rule.get("derivation"):
        return {"decision":"BLOCK_AUTHORITY_EXECUTION","reasons":["MISSING_DERIVATION"]}
    return {"decision":"ELIGIBLE_FOR_BOUNDED_VALIDATION","reasons":[]}
