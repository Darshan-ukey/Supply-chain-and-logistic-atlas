"""Evidence-bound exception executor. No Atlas calls and no automatic mutations."""
from copy import deepcopy

def execute(source_assertions, extracted_items):
    source_assertions=deepcopy(source_assertions); extracted_items=deepcopy(extracted_items)
    if any(not s.get("source_id") for s in source_assertions): raise ValueError("Missing source_id")
    if len({s["source_id"] for s in source_assertions})!=len(source_assertions): raise ValueError("Duplicate source_id")
    indexed={}
    for s in source_assertions:
        if s.get("explicit_association") is True and all(k in s for k in ("commodity_key","field","value")):
            indexed.setdefault((s["commodity_key"],s["field"]),[]).append(s)
    findings=[]
    for i,item in enumerate(extracted_items):
        for field,value in item.get("attributes",{}).items():
            sources=indexed.get((item.get("commodity_key"),field),[])
            refs=[s["source_id"] for s in sources]
            if not sources: code,status,proposal="ASSOCIATION_EVIDENCE_MISSING","UNRESOLVED",None
            elif len({str(s["value"]).strip().casefold() for s in sources})>1:
                code,status,proposal="SOURCE_CONFLICT","UNRESOLVED",None
            elif str(value).strip().casefold()!=str(sources[0]["value"]).strip().casefold():
                code,status,proposal="WRONG_COMMODITY_ATTRIBUTE","CONTRADICTED",sources[0]["value"]
            else: code,status,proposal="SOURCE_MATCH","SUPPORTED",None
            findings.append({"item_index":i,"field":field,"code":code,"status":status,"source_ids":refs,"proposed_value":proposal,"auto_applied":False})
    return {"schema":"firi.exception_execution.v0.1","findings":findings,"original_extraction":extracted_items,"corrections_applied":[],"runtime_atlas_lookup":False}
