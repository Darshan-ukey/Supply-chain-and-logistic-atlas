"""Conditional commodity signal recognition, with no live Atlas dependency.

Recognition is not classification, clearance, or proof of a restriction.
"""
import re
from copy import deepcopy

PATTERNS = {
 "pharmaceutical": r"\b(?:pharmaceuticals?|medicines?|vaccines?|tablets?|capsules?)\b",
 "food": r"\b(?:food|edible|frozen fish|dairy|meat|beverages?)\b",
 "agriculture": r"\b(?:seeds?|grain|wheat|rice|plants?|fertili[sz]er)\b",
 "battery": r"\b(?:lithium[- ]?ion|sodium[- ]?ion|batter(?:y|ies))\b",
 "dangerous_goods": r"\b(?:hazmat|dangerous goods|flammable|corrosive|un\s?\d{4})\b",
 "temperature_sensitive": r"\b(?:refrigerated|keep frozen|cold chain|2\s?[-–]\s?8\s?°?c)\b",
 "controlled_goods": r"\b(?:dual[- ]use|export controlled|licen[cs]e required)\b",
}
FIELD_ALIASES = {
 "hs_code": ("hs_code","hsn_code","hts_code","tariff_code"),
 "restriction_code": ("restriction_code","licence_code","license_code","control_code"),
 "un_number": ("un_number","un_id"),
 "nmfc": ("nmfc",),
}
def recognize(document_type, fields, description="", references=None):
    fields=deepcopy(fields);references=deepcopy(references or {})
    if not isinstance(fields,dict): raise ValueError("fields must be mapping")
    findings=[]
    for family,aliases in FIELD_ALIASES.items():
        for alias in aliases:
            value=fields.get(alias)
            if value is not None and str(value).strip():
                findings.append({"family":family,"value":str(value).strip(),"field":alias,
                    "status":"OBSERVED","verification":"NOT_PERFORMED",
                    "source_ids":fields.get(alias+"_source_ids",[]),
                    "next_step":"Verify against applicable governed reference when available"})
    for family,pattern in PATTERNS.items():
        if re.search(pattern,description,re.I):
            findings.append({"family":family,"status":"CANDIDATE","evidence":"DESCRIPTION_TERM",
                "verification":"NOT_PERFORMED","next_step":"Corroborate with document and authoritative evidence"})
    return {"schema":"firi.commodity_signals.v0.1","document_type":document_type,
            "findings":findings,"atlas_integration":"FUTURE_OPTIONAL_PROVIDER",
            "references_supplied":bool(references),"compliance_decision":None,
            "auto_classification":None,"corrections":[]}
