"""Evidence-first commodity group arithmetic; no regulatory classification claims."""
from decimal import Decimal, InvalidOperation
import re
COMPACT = re.compile(r'(?P<count>\d+)\s*(?:CTNS?|CARTONS?|BAGS?|PLTS?|PALLETS?)\s*[/, ]+\s*(?P<weight>[\d,.]+)\s*KGS?\s*[/, ]+\s*(?P<volume>[\d,.]+)\s*(?:CBM|M3)\b',re.I)
def parse_group(text, source_id):
    m=COMPACT.search(text)
    if not m: return {'status':'UNRESOLVED','reason':'NO_COMPLETE_COMPACT_GROUP','source_id':source_id}
    try:return {'status':'OBSERVED','source_id':source_id,'package_count':int(m['count']),'weight_kg':str(Decimal(m['weight'].replace(',',''))),'volume_cbm':str(Decimal(m['volume'].replace(',','')))}
    except InvalidOperation:return {'status':'UNRESOLVED','reason':'INVALID_NUMERIC_FORMAT','source_id':source_id}
def reconcile(groups, totals):
    parsed=[parse_group(x['text'],x['source_id']) for x in groups]
    if not parsed or any(p['status']!='OBSERVED' for p in parsed):return {'status':'ABSTAIN','reason':'INCOMPLETE_GROUP_EVIDENCE','groups':parsed}
    if not totals or not all(k in totals for k in ('package_count','weight_kg','volume_cbm')):return {'status':'ABSTAIN','reason':'INCOMPLETE_SHIPMENT_TOTAL','groups':parsed}
    try:
        sums={'package_count':sum(p['package_count'] for p in parsed),'weight_kg':sum((Decimal(p['weight_kg']) for p in parsed),Decimal(0)),'volume_cbm':sum((Decimal(p['volume_cbm']) for p in parsed),Decimal(0))}
        diffs={k:str(Decimal(str(sums[k]))-Decimal(str(totals[k]))) for k in sums}
    except (InvalidOperation,ValueError):return {'status':'ABSTAIN','reason':'INVALID_SHIPMENT_TOTAL','groups':parsed}
    return {'status':'RECONCILED' if all(Decimal(v)==0 for v in diffs.values()) else 'CONFLICT','differences':diffs,'groups':parsed,'corrections_applied':[]}
