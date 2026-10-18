"""Executable, source-bounded cross-document reconciliation and exception classification."""
from decimal import Decimal, InvalidOperation
from copy import deepcopy

def _decimal(value):
    try: return Decimal(str(value))
    except (InvalidOperation, ValueError): return None

def evaluate(source_assertions, extracted_items):
    """Requires independently established commodity keys and source references."""
    sources=deepcopy(source_assertions); items=deepcopy(extracted_items)
    ids=[s.get("source_id") for s in sources]
    if any(not x for x in ids) or len(ids)!=len(set(ids)): raise ValueError("source IDs must be unique and nonempty")
    by_key={}
    for s in sources:
        if s.get("explicit_association") is True and all(k in s for k in ("commodity_key","field","value")):
            by_key.setdefault((s["commodity_key"],s["field"]),[]).append(s)
    findings=[]
    def emit(code,stage,key,field,refs,detail,proposal=None):
        findings.append({"code":code,"stage":stage,"commodity_key":key,"field":field,"source_ids":refs,
                         "detail":detail,"candidate_correction":proposal,"auto_applied":False})
    established={s["commodity_key"] for s in sources if s.get("identity_established") is True and s.get("commodity_key")}
    observed={x["commodity_key"] for x in items if x.get("commodity_key")}
    for key in sorted(established-observed):
        refs=[s["source_id"] for s in sources if s.get("commodity_key")==key and s.get("identity_established") is True]
        emit("OMITTED_COMMODITY","OBJECT_RECONSTRUCTION",key,None,refs,"Source-established commodity missing from extraction")
    for key in sorted(observed-established):
        emit("IDENTITY_UNVERIFIED","IDENTITY_VALIDATION",key,None,[],"Extracted commodity identity not independently established")
    for item in items:
        key=item.get("commodity_key")
        for field,value in item.get("attributes",{}).items():
            refs=by_key.get((key,field),[])
            if not refs:
                emit("ASSOCIATION_MISSING","ASSOCIATE",key,field,[],"No explicit source-to-commodity field link")
                continue
            distinct={str(s["value"]).strip().casefold() for s in refs}
            if len(distinct)>1:
                emit("CONFLICTING_SOURCES","CORROBORATE",key,field,[s["source_id"] for s in refs],"Independent source assertions disagree")
            elif str(value).strip().casefold() not in distinct:
                emit("VALUE_CONTRADICTED","VALIDATE",key,field,[s["source_id"] for s in refs],"Extracted value differs from explicit source association",refs[0]["value"])
        a=item.get("attributes",{})
        if all(k in a for k in ("gross_weight","net_weight","tare_weight")):
            vals=[_decimal(a[k]) for k in ("gross_weight","net_weight","tare_weight")]
            units={a.get(k+"_uom") for k in ("gross_weight","net_weight","tare_weight")}
            if None not in vals and len(units)==1 and None not in units and vals[0]!=vals[1]+vals[2]:
                emit("WEIGHT_ARITHMETIC_CONFLICT","VALIDATE",key,"gross_weight",[],"Gross != net + tare in matching explicit units; no automatic correction")
    return {"schema":"firi.execution.v0.2","findings":findings,"original_extraction":items,"corrections_applied":[],"atlas_lookup":False}
