"""Experimental FIRI knowledge-requirement planner; no customs or DG compliance determinations."""
from copy import deepcopy

FAMILIES = {
 "dangerous_goods": ("UN_ID","PROPER_SHIPPING_NAME","HAZARD_CLASS","SUBSIDIARY_RISK","PACKING_GROUP","PACKAGING","DECLARATION"),
 "classification": ("HS_6","NATIONAL_TARIFF","NMFC","CLASSIFICATION_DESCRIPTION"),
 "controlled_goods": ("LICENCE_REQUIREMENT","RESTRICTION_SCREENING"),
 "origin": ("COUNTRY_OF_ORIGIN","PREFERENTIAL_ORIGIN"),
 "bio_agri": ("PHYTOSANITARY","VETERINARY","QUARANTINE"),
 "pharma_cold_chain": ("TEMPERATURE","BATCH_LOT","EXPIRY"),
 "battery": ("CHEMISTRY","INSTALLED_IN_EQUIPMENT","TRANSPORT_CONDITIONS"),
 "special_cargo": ("DIMENSIONS","WEIGHT","HANDLING"),
 "packaging": ("PACKAGE_TYPE","PACKAGE_COUNT","HU_COMMODITY_LINK"),
 "quantities": ("UNIT","GROSS_NET_TARE","INVOICE_PACKING_RECONCILIATION")
}
DOCUMENTS={"BOL","AWB","COMMERCIAL_INVOICE","PACKING_LIST","CUSTOMS_DECLARATION"}
def plan(document_type, observed, context, atlas_responses=None):
    if document_type not in DOCUMENTS: raise ValueError("Unknown document type")
    observed=deepcopy(observed);context=deepcopy(context);atlas_responses=deepcopy(atlas_responses or {})
    requested=[];findings=[]
    def ask(family, topic, reason):
        key=f"{family}.{topic}"
        result=atlas_responses.get(key)
        if not isinstance(result,dict) or result.get("status")!="VERIFIED" or not result.get("authority") or not result.get("version") or not result.get("effective_date"):
            requested.append({"key":key,"reason":reason,"jurisdiction":context.get("jurisdiction"),"transport_mode":context.get("transport_mode"),"transaction_date":context.get("transaction_date"),"status":"ATLAS_LOOKUP_REQUIRED"})
        else:
            findings.append({"key":key,"status":"REFERENCE_AVAILABLE_NOT_VALIDATED","authority":result["authority"],"version":result["version"],"effective_date":result["effective_date"]})
    if document_type in {"COMMERCIAL_INVOICE","CUSTOMS_DECLARATION"}:
        ask("classification","HS_REQUIREMENT_APPLICABILITY","Mandatory status varies by document, jurisdiction and transaction")
    hazard=observed.get("dangerous_goods_signal")
    if hazard in {"DECLARED","SUSPECTED","CONFLICTING"}:
        for topic in ("DG_APPLICABILITY","UN_ID","PROPER_SHIPPING_NAME","HAZARD_CLASS","PACKING_GROUP","DOCUMENTATION_REQUIREMENTS"):
            ask("dangerous_goods",topic,"Transport-mode, date and jurisdiction specific DG verification")
        findings.append({"code":"DG_REVIEW_REQUIRED","status":"UNRESOLVED","signal":hazard,"no_nonhazardous_inference":True})
    elif hazard is None or hazard=="NOT_DECLARED":
        findings.append({"code":"DG_STATUS_NOT_ESTABLISHED","status":"UNRESOLVED","no_nonhazardous_inference":True})
    if observed.get("battery_signal"): ask("battery","TRANSPORT_CONDITIONS","Battery chemistry and packing status affect applicable controls")
    if observed.get("perishable_signal"): ask("bio_agri","CONDITIONAL_REQUIREMENTS","Commodity and route dependent")
    if observed.get("controlled_goods_signal"): ask("controlled_goods","RESTRICTION_SCREENING","Transaction and jurisdiction dependent")
    return {"status":"EXPERIMENTAL_PLANNER","document_type":document_type,"atlas_requests":requested,"findings":findings,"compliance_decision":None,"corrections":[]}
