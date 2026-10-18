"""Conservative commodity identity reconstruction from independent source spans."""
from collections import defaultdict
from copy import deepcopy

def reconstruct(spans):
    spans=deepcopy(spans)
    ids=[s.get("source_id") for s in spans]
    if any(not x for x in ids) or len(ids)!=len(set(ids)):
        raise ValueError("source_id must be unique and nonempty")
    established=defaultdict(list); provisional=defaultdict(list);issues=[]
    for span in spans:
        key=span.get("commodity_ref")
        if key and span.get("commodity_ref_role")=="EXPLICIT_COMMODITY_ID":
            established[str(key)].append(span)
        else:
            group=(span.get("document_id"),span.get("page"),span.get("row_group") or span["source_id"])
            provisional[group].append(span)
            if key: issues.append({"code":"UNVERIFIED_IDENTIFIER_ROLE","source_ids":[span["source_id"]],"status":"UNRESOLVED"})
    objects=[]
    for key,members in sorted(established.items()):
        descriptions=[m.get("description","").strip() for m in members if m.get("description","").strip()]
        unique=list(dict.fromkeys(descriptions))
        objects.append({"commodity_key":key,"identity_status":"SOURCE_ESTABLISHED","source_ids":[m["source_id"] for m in members],
                        "description_fragments":unique,"description_resolution":"UNRESOLVED" if len(unique)>1 else "OBSERVED"})
        if len(unique)>1:
            issues.append({"code":"DESCRIPTION_FRAGMENTS_NEED_ORDERING","commodity_key":key,"source_ids":[m["source_id"] for m in members],"status":"UNRESOLVED"})
    for group,members in provisional.items():
        objects.append({"commodity_key":None,"identity_status":"PROVISIONAL_GROUP","group":list(group),
                        "source_ids":[m["source_id"] for m in members],
                        "description_fragments":[m["description"] for m in members if m.get("description")],
                        "description_resolution":"UNRESOLVED"})
    return {"schema":"firi.reconstruction.v0.1","objects":objects,"issues":issues,
            "established_commodity_count":len(established),
            "total_commodity_count":len(established) if not provisional else None,
            "source_spans":spans,"corrections_applied":[]}
