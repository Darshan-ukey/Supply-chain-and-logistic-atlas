"""Cross-document FIRI exception triage: evidence-backed diagnosis, no auto-correction."""
from copy import deepcopy
from hashlib import sha256
import json

SUPPORTED = {'BOL', 'AWB', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CUSTOMS_DECLARATION'}

def _digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()

def localize(document_type, evidence, extracted):
    """Evidence is independently observed, never inferred from extracted output."""
    if document_type not in SUPPORTED:
        raise ValueError('Unsupported document type')
    evidence, extracted = deepcopy(evidence), deepcopy(extracted)
    ids = [r.get('source_id') for r in evidence]
    if any(not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('Independent evidence requires unique nonempty source_id')
    findings = []
    def flag(code, stage, source_ids, detail, next_evidence, candidate=None):
        findings.append({'code': code, 'stage': stage, 'source_ids': sorted(set(source_ids)),
                         'detail': detail, 'status': 'UNRESOLVED', 'next_evidence': next_evidence,
                         'candidate_index': candidate, 'correction_attempted': False})
    source_map = {r['source_id']: r for r in evidence}
    supported_keys = {r['commodity_key'] for r in evidence if r.get('commodity_key') and r.get('identity_established') is True}
    output_keys = {r['commodity_key'] for r in extracted if r.get('commodity_key')}
    for key in sorted(supported_keys - output_keys):
        refs = [r['source_id'] for r in evidence if r.get('commodity_key') == key and r.get('identity_established') is True]
        flag('F01_OMITTED_COMMODITY', 'OBJECT_RECONSTRUCTION', refs,
             'Independently established commodity identity missing from extraction', 'Confirm source-to-output alignment')
    for key in sorted(output_keys - supported_keys):
        flag('F12_UNSUPPORTED_INFERENCE', 'IDENTITY_VALIDATION', [],
             f'Extracted commodity identity {key!r} lacks independent identity proof', 'Independent commodity identity evidence')
    for idx, item in enumerate(extracted):
        cited = item.get('source_ids', [])
        absent = [sid for sid in cited if sid not in source_map]
        if absent or not cited:
            flag('F14_MISSING_SOURCE_PROVENANCE', 'PROVENANCE', absent,
                 'Missing or unknown source references', 'Source span identifiers from OCR/layout', idx)
        key = item.get('commodity_key')
        if not key or key not in supported_keys:
            continue
        for field, value in item.get('attributes', {}).items():
            known = [r for r in evidence if r.get('commodity_key') == key and r.get('field') == field and r.get('association_explicit') is True]
            if known and all(str(r.get('value')).casefold() != str(value).casefold() for r in known):
                flag('F05_WRONG_COMMODITY_ATTRIBUTE_ASSOCIATION', 'ASSOCIATION',
                     [r['source_id'] for r in known], f'Value for {field} contradicts explicit source-linked commodity association',
                     'Review independently linked commodity and attribute spans', idx)
            elif not known:
                flag('F13_UNRESOLVED_AMBIGUITY', 'ASSOCIATION', [],
                     f'No independently established association for {field}', 'Explicit commodity-to-attribute linkage', idx)
    return {'schema': 'firi.failure_localization.v0.1', 'document_type': document_type,
            'evidence_sha256': _digest(evidence), 'extraction_sha256': _digest(extracted),
            'findings': findings, 'corrections': [], 'status': 'EXPERIMENTAL_DIAGNOSTIC_ONLY'}
