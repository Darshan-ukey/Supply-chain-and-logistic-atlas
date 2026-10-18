"""Evidence-backed many-to-many association graph. Never infer links from counts."""
def associate(commodities, handling_units, evidence_links):
    cids={c["id"] for c in commodities}
    hids={h["id"] for h in handling_units}
    edges=[]; issues=[]; seen=set()
    for link in evidence_links:
        c=link.get("commodity_id"); h=link.get("handling_unit_id")
        sources=link.get("source_ids",[])
        if c not in cids or h not in hids:
            issues.append({"code":"UNKNOWN_OBJECT","link":link,"status":"UNRESOLVED"})
        elif not sources or not link.get("relationship_explicit",False):
            issues.append({"code":"UNSUPPORTED_ASSOCIATION","link":link,"status":"UNRESOLVED"})
        elif (c,h) not in seen:
            edges.append({"commodity_id":c,"handling_unit_id":h,"source_ids":sources,"status":"SUPPORTED_EXPLICIT"})
            seen.add((c,h))
    covered={e["commodity_id"] for e in edges}
    for c in sorted(cids-covered):
        issues.append({"code":"COMMODITY_HU_LINK_UNRESOLVED","commodity_id":c,"status":"UNRESOLVED","next_evidence":"Source-supported commodity-to-handling-unit association"})
    return {"edges":edges,"issues":issues,"commodity_count":None,"note":"No implicit one-to-one assignment or commodity cardinality inference."}
