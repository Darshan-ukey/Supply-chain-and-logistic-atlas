#!/usr/bin/env python3
"""W1-09: for each of the 60 sampled items, search the local vocabulary index (ONE Record, GS1 CBV/EPCIS, UN/CEFACT D23B schemas).
Search terms = item name + aliases + a few manual synonyms (stated below, so the search is reproducible).
Match = case-insensitive, word-boundary match of the whole term in the entry NAME or LABEL (comment text is shown but a comment-only match is flagged 'C').
usage: search_items.py <selected_60.json> <vocab_index.jsonl> <out.txt>
"""
import sys, json, re

sel = json.load(open(sys.argv[1]))
rows = [json.loads(l) for l in open(sys.argv[2])]

EXTRA = {  # manual synonyms/terms (documented; reproducible)
 'obj-vehicle': ['transport means', 'vehicle'],
 'obj-equipment': ['transport equipment', 'equipment', 'ULD', 'loading unit'],
 'obj-knowledge-asset': ['knowledge'],
 'obj-filing': ['filing', 'declaration', 'customs'],
 'obj-seal': ['seal'],
 'obj-subrogation': ['subrogation', 'insurance'],
 'obj-shipping-instructions': ['shipping instruction', 'forwarding instruction', 'transport instruction'],
 'obj-trailer': ['trailer', 'chassis'],
 'obj-condition-record': ['condition'],
 'obj-supplier-invoice': ['invoice'],
 'obj-payment': ['payment'],
 'obj-order': ['order'],
 'obj-asset-master': ['asset'],
 'obj-cfs-handoff': ['freight station', 'CFS'],
 'obj-accrual': ['accrual'],
 'obj-regulatory-status': ['regulatory', 'regulated', 'security status'],
 'obj-control-evidence': ['evidence'],
 'obj-release': ['release'],
 'obj-execution-state': ['execution status', 'execution state', 'disposition'],
 'obj-appointment': ['appointment'],
 'obj-refund': ['refund'],
 'obj-shipment-readiness': ['ready', 'readiness'],
 'obj-reference-code': ['reference'],
 'obj-rate': ['rate'],
 'obj-performance-record': ['performance', 'scorecard'],
 'obj-reserve': ['reserve'],
 'obj-emission-record': ['emission', 'CO2', 'greenhouse'],
 'obj-wave': ['wave'],
 'obj-load-plan': ['load plan', 'loading plan', 'stowage', 'bay plan', 'load list'],
 'obj-freight-charge': ['freight charge', 'charge'],
 'obj-pick-confirmation': ['picking', 'pick'],
 'obj-sourcing-decision': ['sourcing'],
 'obj-arrival-notice': ['arrival notice', 'arrival'],
 'obj-booking': ['booking'],
 'obj-asn': ['despatch advice', 'dispatch advice', 'advance ship', 'desadv'],
 'obj-tender-response': ['tender'],
 'obj-declaration': ['declaration'],
 'obj-recipient': ['recipient', 'consignee'],
 'obj-driver': ['driver'],
 'obj-receipt': ['receiving', 'receipt', 'recadv', 'receiving advice'],
 'sys-customer-portal': ['portal'],
 'sys-ibp': ['integrated business planning', 'business planning'],
 'sys-billing': ['billing'],
 'sys-control-tower': ['control tower'],
 'sys-forwarder-platform': ['forwarder'],
 'sys-cpq': ['quote', 'quotation', 'price'],
 'sys-oms': ['order management'],
 'sys-analytics': ['analytics'],
 'sys-carrier-documentation': ['documentation'],
 'sys-tax-engine': ['tax'],
 'evt-pickup-dispatched': ['pickup', 'dispatch', 'collection'],
 'doc-fiata-fbl': ['multimodal', 'bill of lading'],
 'doc-air-awb': ['air waybill', 'waybill'],
 'doc-road-cmr-bol': ['consignment note', 'road'],
 'doc-vgm-declaration': ['gross mass', 'VGM'],
 'doc-rail-consignment': ['rail', 'consignment note'],
 'doc-ocean-sea-waybill': ['sea waybill', 'waybill'],
 'doc-arrival-notice': ['arrival notice'],
 'evt-exception-detected': ['exception'],
 'evt-delivery-attempted': ['delivery attempt', 'attempt', 'delivery'],
}

def terms_for(it):
    t = [it['name']] + list(it.get('aliases') or []) + EXTRA.get(it['id'], [])
    seen, out = set(), []
    for x in t:
        k = x.strip().lower()
        if k and k not in seen:
            seen.add(k); out.append(x.strip())
    return out

def rx(term):
    return re.compile(r'(?<![A-Za-z0-9])' + re.escape(term) + r'(?![a-z])', re.I)  # allows camelCase joins via lookahead on lowercase only

def split_camel(s):
    return re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', s).replace('_', ' ').replace('.', ' ')

out = []
for stratum in ['business_object', 'system', 'document_event']:
    for it in sel[stratum]:
        terms = terms_for(it)
        out.append('=' * 100)
        out.append(f"[{stratum} #{it['rank']}] {it['id']} | {it['name']} | aliases={it.get('aliases')} | terms={terms}")
        for src in ['one-record', 'one-record-cl', 'gs1-cbv', 'gs1-epcis', 'uncefact']:
            hits = []
            seen = set()
            for r in rows:
                if r['src'] != src:
                    continue
                if src == 'uncefact' and r['kind'] == 'prop':
                    continue
                key = (src, r['name'])
                if key in seen:
                    continue
                nm = split_camel(r['name']) + ' | ' + r['label']
                flag = None; score = 0
                for t in terms:
                    if rx(t).search(nm):
                        base = split_camel(r['name']).lower().strip()
                        lab0 = re.split(r'\.|\|', r['label'])[0].strip().lower().replace('_ ', ' ').replace('_', ' ')
                        tl = t.lower()
                        score = 3 if (base == tl or base.replace(' type', '') == tl or lab0 == tl or lab0.endswith(' ' + tl)) else 2 if base.endswith(tl) else 1
                        flag = 'N:' + t; break
                if not flag:
                    for t in terms:
                        if len(t) > 3 and rx(t).search(r['comment']):
                            flag = 'C:' + t; score = 0; break
                if flag:
                    seen.add(key)
                    hits.append((flag, r, score))
            hits.sort(key=lambda x: (-x[2], len(x[1]['name'])))
            if hits:
                nN = sum(1 for h in hits if h[0][0] == 'N'); nC = len(hits) - nN
                out.append(f"  -- {src}: {nN} name/label hits, {nC} comment-only hits (showing top 6 by exactness)")
                for flag, r, sc in hits[:6]:
                    c = (r['comment'] or '').replace('\n', ' ')[:140]
                    out.append(f"     [{flag}|s{sc}] {r['kind'][:14]:14} {r['name'][:46]:46} | {r['label'][:44]} | {c}  @{r['loc'].split('/')[-1][:60]}")
            else:
                out.append(f"  -- {src}: none")
open(sys.argv[3], 'w').write('\n'.join(out))
print('written', len(out), 'lines')
