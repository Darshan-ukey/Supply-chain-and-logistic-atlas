"""Cross-document commodity intelligence v0.2: all ten families, no live Atlas dependency."""
import re
from copy import deepcopy
FAMILIES={
"dangerous_goods":(("un_number","proper_shipping_name","hazard_class","packing_group","subsidiary_risk","dg_declaration"),r"\b(?:hazmat|dangerous goods|flammable|corrosive|un\s?\d{4})\b"),
"classification":(("hs_code","hsn_code","hts_code","tariff_code","nmfc","freight_class"),None),
"controlled_goods":(("restriction_code","licence_code","license_code","control_code","export_control_classification"),r"\b(?:dual[- ]use|export controlled|licen[cs]e required|restricted goods)\b"),
"origin":(("country_of_origin","preferential_origin","certificate_of_origin"),r"\b(?:country of origin|made in|preferential origin)\b"),
"bio_agri":(("phytosanitary_certificate","veterinary_certificate","quarantine_reference"),r"\b(?:seeds?|grain|wheat|rice|plants?|fertili[sz]er|livestock|fresh produce)\b"),
"pharma_cold_chain":(("batch_number","lot_number","expiry_date","temperature_range","cold_chain_instruction"),r"\b(?:pharmaceuticals?|medicines?|vaccines?|tablets?|capsules?|refrigerated|keep frozen|cold chain)\b"),
"battery":(("battery_chemistry","battery_configuration","watt_hours","lithium_content"),r"\b(?:lithium[- ]?ion|sodium[- ]?ion|batter(?:y|ies))\b"),
"special_cargo":(("length","width","height","oversize_flag","heavy_lift_flag","handling_instruction"),r"\b(?:oversi[sz]ed|out of gauge|heavy lift|center of gravity)\b"),
"packaging":(("package_type","package_count","handling_unit_count","carton_count","pallet_count","package_marks"),r"\b(?:pallets?|skids?|cartons?|crates?|drums?)\b"),
"quantities":(("quantity","quantity_uom","gross_weight","net_weight","tare_weight","invoice_quantity"),None)}
DOCUMENTS={"BOL","AWB","COMMERCIAL_INVOICE","PACKING_LIST","CUSTOMS_DECLARATION"}
def inspect(document_type,fields,description="",required_fields=None,references=None):
    if document_type not in DOCUMENTS: raise ValueError("Unsupported document type")
    if not isinstance(fields,dict): raise TypeError("fields must be dict")
    fields=deepcopy(fields); required_fields=deepcopy(required_fields or {});references=deepcopy(references or {})
    findings=[]
    for family,(names,pattern) in FAMILIES.items():
        for name in names:
            value=fields.get(name)
            if value is not None and str(value).strip():
                findings.append({"family":family,"field":name,"value":str(value).strip(),"status":"OBSERVED","verification":"NOT_PERFORMED","source_ids":fields.get(name+"_source_ids",[])})
        if pattern and re.search(pattern,description,re.I):
            findings.append({"family":family,"status":"CANDIDATE","evidence":"DESCRIPTION_TERM","verification":"NOT_PERFORMED"})
    for field,rule in required_fields.items():
        if not isinstance(rule,dict) or rule.get("applicability")!="VERIFIED" or not all(rule.get(k) for k in ("authority","version","effective_date")):
            findings.append({"field":field,"status":"REQUIREMENT_UNVERIFIED","verification":"NOT_PERFORMED"})
        elif fields.get(field) is None or not str(fields[field]).strip():
            findings.append({"field":field,"status":"MISSING_REQUIRED_FIELD","authority":rule["authority"],"version":rule["version"],"effective_date":rule["effective_date"],"verification":"APPLICABILITY_ONLY"})
    return {"schema":"firi.commodity_intelligence.v0.2","document_type":document_type,"findings":findings,"families_covered":list(FAMILIES),"atlas_integration":"FUTURE_OPTIONAL_PROVIDER","references_supplied":bool(references),"compliance_decision":None,"corrections":[]}
