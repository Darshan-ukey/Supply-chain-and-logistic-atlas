"""ATL-134 experimental executable rule bridge. Detection only; never mutates baseline."""
import copy
RULES={"FIRI-BOL002-R01":"SEPARATE","FIRI-BOL002-R02":"OBJECT_CARDINALITY","FIRI-BOL002-R03":"OBJECT_CARDINALITY","FIRI-BOL002-R04":"VALIDATE","FIRI-BOL002-R05":"CORROBORATE","FIRI-BOL002-R06":"RESOLVE_ESCALATE","FIRI-BOL002-R07":"VALIDATE","FIRI-BOL002-R08":"RESOLVE_ESCALATE"}
def evaluate(source_evidence, baseline, canonical):
    if canonical.get("field_id")!="BOL-002" or {r["id"]:r["stage"] for r in canonical.get("rules",[])}!=RULES:
        raise ValueError("Canonical FIRI rules drifted")
    original=copy.deepcopy(baseline)
    by_id={x["source_id"]:x for x in source_evidence}
    checks=[]
    def add(rule,status,reason,ids=None):
        checks.append({"rule_id":rule,"status":status,"reason":reason,"source_ids":ids or [],"implementation":"EXPERIMENTAL_PARTIAL"})
    for item in original.get("items",[]):
        sid=item.get("source_id"); source=by_id.get(sid)
        if source is None:
            add("FIRI-BOL002-R01","UNRESOLVED","No independently linked source evidence",[sid] if sid else [])
            continue
        desc=str(item.get("description") or "")
        embedded=[x for x in source.get("field_candidates",[]) if x.get("raw") and x["raw"].casefold() in desc.casefold()]
        add("FIRI-BOL002-R01","FAIL" if embedded else "UNRESOLVED","Recognized non-description text included" if embedded else "Token check cannot establish semantic correctness",[sid])
        add("FIRI-BOL002-R06","PASS" if source.get("description_candidate") is not None else "UNRESOLVED","Observed source candidate retained; classification sufficiency not proven",[sid])
    groups={(x.get("page"),x.get("row_group") or x["source_id"]) for x in source_evidence if x.get("description_candidate")}
    add("FIRI-BOL002-R02","UNRESOLVED",f"{len(groups)} description-bearing source groups vs {len(original.get('items',[]))} output rows; grouping is not proof of commodity cardinality")
    for rule,reason in [
        ("FIRI-BOL002-R03","HU-to-commodity association edges not independently proven"),
        ("FIRI-BOL002-R04","Versioned NMFC authority unavailable"),
        ("FIRI-BOL002-R05","Packaging corroboration not proven"),
        ("FIRI-BOL002-R07","Versioned ClassIT+ evidence and subitem logic unavailable")]:
        add(rule,"UNRESOLVED",reason)
    add("FIRI-BOL002-R08","PASS","Unresolved evidence retained without guessing")
    return {"status":"EXPERIMENTAL_NOT_CERTIFIED","checks":checks,"items":original.get("items",[]),"corrections":[],"established_commodity_count":None}
