# W1-27 Source Watch delta (addendum A4 as amended by AMD1/R2 and AMD2) test script. Run: python3 -I run_delta_tests.py  (needs jsonschema>=4)
# Layer 1: JSON Schema 2.1 (cycle-package.schema.json). Layer 2: independent semantic validator (defence in depth).
# R3 files (schema 1.2, run_schema_tests.py) are not touched; this suite covers only the A4 delta scope.
import json, copy, hashlib, itertools
from collections import Counter
from jsonschema import Draft202012Validator as DV
schema = json.load(open('cycle-package.schema.json')); DV.check_schema(schema); V = DV(schema)
H = lambda s: hashlib.sha256(s.encode()).hexdigest()

ORDER = ['DETECTED','TRIAGED','EVIDENCE_COLLECTED','SEMANTIC_DIFFED','IMPACT_ASSESSED','PROPOSED','RISK_CLASSIFIED','ADMIN_REVIEW',
         'POLICY_ELIGIBLE','APPROVED','STAGING_APPLIED','INDEPENDENTLY_VALIDATED','PUBLISHED','CONSUMER_PROPAGATED','MONITORED']
HELDS = {'HELD','REJECTED','DEFERRED','ROLLED_BACK'}
OPENS = {'CONTENT_CHANGED_SAME_VERSION','NEW_VERSION','SUPERSEDED_OR_WITHDRAWN'}
LOW = {'SOURCE_METADATA_REFRESH','DUPLICATE_DETECTION','UNCHANGED_CONTENT_CHECK','NONSEMANTIC_INDEXING','ADDITIVE_METADATA'}
SDCCAE = {'RELATIONSHIP_CHANGE','PROFILE_CHANGE','TYPED_VALUE_CHANGE','COMPATIBILITY_CHANGE','PERMISSION_CHANGE','APPLICABILITY_CHANGE'}
RANK = {'HIGH_RISK': 0, 'FRAMEWORK': 1, 'STANDARD': 2}
DESTS = ['PRODUCT_DEFINITION', 'ARCHITECTURE_REGISTRY', 'FEATURE_CAPABILITY_REGISTRY', 'GOVERNANCE_CHANGE_CONTROL', 'PRODUCT_EVOLUTION_RECORD', 'DECISION_REGISTER']
SEGS = ['placement','constructs','relationships','profiles','typed_dimension_values','daughter_leaves','consumer_bindings']

def canon_hash(p):
    q = copy.deepcopy(p); q['identity'].pop('package_hash', None)
    return H(json.dumps(q, sort_keys=True, separators=(',', ':')))
def rehash(p): p['identity']['package_hash'] = canon_hash(p); return p
def list_hash(entries): return H('\n'.join(sorted('%s:%s' % (e['source_id'], e['risk_class']) for e in entries)))

def semantic(p, off=frozenset()):
    try: return _sem(p, off)
    except (KeyError, TypeError, IndexError, AttributeError): return ['S00 structurally malformed']
def _sem(p, off):
    v = []
    def chk(code, bad, msg):
        if code not in off and bad: v.append(f'{code} {msg}')
    cyc, srcs, dl, im, gp, cs, pr = p['cycle'], p['source_results'], p['node_deltas'], p['impacts'], p['gaps'], p['candidate_sources'], p['proposals']
    st, g, ident = p['status']['package_state'], p['gates'], p['identity']
    idx = ORDER.index(st) if st in ORDER else -1
    sid = {s['source_id']: s for s in srcs}; did = {d['delta_id']: d for d in dl}; gid = {x['gap_id']: x for x in gp}
    co = cyc['carried_over']
    cref = lambda k: [c['item_ref'] for c in co if c['item_kind'] == k]
    wl = cyc['watch_list']; wents = wl['entries']; wl_map = {}
    for e in wents: wl_map.setdefault(e['source_id'], e['risk_class'])
    # --- F-A4-01 pinned watch list: every registered source has exactly one result
    chk('S58', set(sid) != set(wl_map), 'source results do not equal the pinned watch list (omitted %s; unregistered %s)' % (sorted(set(wl_map) - set(sid)), sorted(set(sid) - set(wl_map))))
    chk('S59', len(wents) != len(wl_map), 'duplicate watch-list entry')
    chk('S60', wl['list_hash'] != list_hash(wents), 'watch_list list_hash does not match its entries')
    for s in srcs: chk('S61', s['source_id'] in wl_map and wl_map[s['source_id']] != s['risk_class'], '%s risk class differs from the pinned watch list' % s['source_id'])
    # --- F-A4-02 delta/source provenance both ways
    for d in dl: chk('S62', d['source_id'] not in sid or d['delta_id'] not in sid[d['source_id']]['node_delta_ids'], 'node delta %s is not listed on its parent source result %s (orphan delta)' % (d['delta_id'], d['source_id']))
    chk('S63', len(did) != len(dl), 'duplicate delta_id')
    chk('S64', any(n > 1 for n in Counter(x for s in srcs for x in s['node_delta_ids']).values()), 'a node delta is listed under more than one source result')
    chk('S65', any(n > 1 for n in Counter(i['delta_id'] for i in im).values()), 'duplicate impact record for one delta')
    # --- F-A4-03 delta-research cap and risk-ordered deferral
    opened = [s for s in srcs if s['outcome'] in OPENS]
    researched = [s for s in opened if s['node_delta_ids']]; deferred = [s for s in opened if not s['node_delta_ids']]
    staged = idx >= ORDER.index('SEMANTIC_DIFFED') or st in HELDS
    if staged:
        chk('S67', len(researched) > cyc['caps']['max_delta_research'], 'researched opened sources exceed max_delta_research (carry-over cannot excuse an over-cap package)')
        chk('S70', bool(deferred) and len(researched) < cyc['caps']['max_delta_research'], 'delta research deferred while below max_delta_research')
        chk('S66', any(RANK[d['risk_class']] < RANK[r['risk_class']] for d in deferred for r in researched), 'higher-risk source deferred while a lower-risk source was researched')
        chk('S76', any(d['risk_class'] == 'HIGH_RISK' for d in deferred) and not (st in HELDS and g['fail_closed']['triggered']), 'deferred HIGH_RISK delta research without a held fail-closed package')
    # --- F-A4-05 exact carry-over reconciliation
    kinds = Counter((c['item_kind'], c['item_ref']) for c in co)
    chk('S74', any(n > 1 for n in kinds.values()), 'duplicate carried_over entry')
    chk('S75', any((c['item_kind'] == 'DELTA_RESEARCH' and c['item_ref'] not in sid) or (c['item_kind'] == 'GAP_SEARCH' and c['item_ref'] not in gid) or (c['item_kind'] == 'PROPOSAL' and c['item_ref'] not in did) for c in co), 'carried_over names an ID that is not in the package')
    if idx >= ORDER.index('SEMANTIC_DIFFED') and st not in HELDS:
        chk('S69', set(cref('DELTA_RESEARCH')) != {d['source_id'] for d in deferred}, 'DELTA_RESEARCH carry-over does not equal the opened sources left without research')
    # --- source outcomes
    for s in srcs:
        o, cur, base, mp, loc = s['outcome'], s['current'], s['baseline'], s['manual_path'], s['locator']
        chk('S01', o == 'UNCHANGED' and (cur is None or base is None or cur['sha256'] != base['sha256'] or cur['version_label'] != base['version_label'] or cur['effective_date'] != base['effective_date']), 'UNCHANGED without equal retrieved snapshot (hash, version label and effective date)')
        chk('S02', o == 'UNREACHABLE_OR_UNVERIFIABLE' and (mp is None or not (mp.get('owner_snapshot_ref') or mp.get('deferred_reason'))), 'UNREACHABLE without manual Owner-snapshot path or deferral reason')
        chk('S03', loc['state'] == 'MISSING' and o != 'UNREACHABLE_OR_UNVERIFIABLE', 'missing watch locator but outcome is not UNREACHABLE')
        chk('S04', cyc['cycle_type'] == 'QUARTERLY' and base is None and o != 'UNREACHABLE_OR_UNVERIFIABLE', 'quarterly comparison without cycle-0 baseline')
        chk('S05', o == 'CONTENT_CHANGED_SAME_VERSION' and (cur is None or base is None or (cur['sha256'] == base['sha256'] and cur['effective_date'] == base['effective_date']) or cur['version_label'] != base['version_label']), 'CONTENT_CHANGED needs a different hash or effective date under the same version label')
        chk('S06', o == 'NEW_VERSION' and (cur is None or base is None or (cur['version_label'] == base['version_label'] and not s['successor_ref'])), 'NEW_VERSION needs a different version label or a successor reference')
        chk('S07', o == 'UNCHANGED' and s['node_delta_ids'], 'UNCHANGED source cites node deltas')
        chk('S08', o in OPENS and idx >= ORDER.index('SEMANTIC_DIFFED') and not s['node_delta_ids'] and s['source_id'] not in cref('DELTA_RESEARCH'), 'opened delta without node deltas after SEMANTIC_DIFFED (and not carried over)')
        for d in s['node_delta_ids']:
            chk('S09', d not in did or did[d]['source_id'] != s['source_id'], f'node delta {d} not found for this source')
    chk('S10', len({s['source_id'] for s in srcs}) != len(srcs), 'duplicate source_id')
    # --- impacts / lineage
    unknown = False
    for i in im:
        miss = any(i['path'][k]['status'] == 'MISSING' for k in SEGS)
        chk('S11', i['status'] == 'TRACED' and miss, 'TRACED impact with a MISSING segment')
        chk('S12', miss and i['status'] != 'IMPACT_UNKNOWN', 'missing lineage not reported as IMPACT_UNKNOWN')
        chk('S14', i['delta_id'] not in did, 'impact for unknown delta')
        if i['status'] == 'IMPACT_UNKNOWN' or miss: unknown = True
        chk('S15', i['status'] == 'TRACED' and i['path']['placement']['status'] == 'NONE_CONFIRMED' and not i['path']['placement']['basis'], 'NONE_CONFIRMED placement without lookup basis')
    if idx >= ORDER.index('IMPACT_ASSESSED'):
        for d in dl: chk('S16', d['delta_id'] not in {i['delta_id'] for i in im}, f'delta {d["delta_id"]} has no impact record after IMPACT_ASSESSED')
    cov = p['lineage_coverage']
    chk('S17', cov['status'] == 'NOT_PRODUCED' and any(i['status'] == 'TRACED' for i in im), 'TRACED impact while lineage coverage report not produced')
    hr_open = any(s['risk_class'] == 'HIGH_RISK' and s['outcome'] in OPENS for s in srcs)
    cov_hold = (cov['status'] == 'NOT_PRODUCED' and bool(dl)) or (cov['status'] == 'INCOMPLETE' and cov['uncovered_high_risk_count'] > 0 and hr_open)
    consumer_gap = any(i['path']['consumer_bindings']['status'] == 'MISSING' for i in im)
    must_hold = unknown or cov_hold or consumer_gap
    chk('S18', must_hold and (st not in HELDS or not g['fail_closed']['triggered']), 'unresolved lineage/consumer/coverage but package not held with fail_closed')
    chk('S19', g['fail_closed']['triggered'] and (st not in HELDS or not g['fail_closed']['reasons']), 'fail_closed triggered without held state or reasons')
    # --- consequential / proposals
    nonlow = [x for x in pr if x['change_class'] not in LOW]
    need_cons = any(s['outcome'] == 'SUPERSEDED_OR_WITHDRAWN' for s in srcs) or hr_open or bool(nonlow)
    for x in pr:
        chk('S20', x['change_class'] not in LOW and not x['consequential'], f'{x["change_id"]} non-low-risk class marked non-consequential')
    chk('S21', need_cons and any(not x['consequential'] for x in pr), 'consequential change (withdrawn/high-risk/non-low class) with a non-consequential proposal')
    chk('S22', need_cons and not pr and idx >= ORDER.index('PROPOSED') and st not in HELDS, 'consequential outcome without any proposal')
    chk('S23', len(pr) > cyc['caps']['max_proposals'], 'proposals exceed max_proposals (carry-over cannot excuse an over-cap package)')
    for x in pr:
        chk('S24', x['route'] == 'SOURCE_WATCH_DIRECT' and x['change_class'] in SDCCAE, f'{x["change_id"]} bypasses SDCCAE spine')
        chk('S25', x['route'] == 'SDCCAE' and not x['sdccae_candidate_ref'], f'{x["change_id"]} SDCCAE route without candidate ref')
        chk('S26', x['automation'] == 'ALLOWLISTED_AUTOMATIC' and (x['change_class'] not in LOW or x['consequential'] or need_cons or any(s['risk_class'] == 'HIGH_RISK' and s['outcome'] != 'UNCHANGED' for s in srcs) or not x['policy_ref'] or not g['allowlist_policy'] or g['allowlist_policy']['policy_id'] != x['policy_ref']), f'{x["change_id"]} automation outside allowlist/risk limits')
        chk('S27', x['change_class'] not in LOW and x['trigger'] == 'SOURCE' and not x['linked_delta_ids'], f'{x["change_id"]} source-trigger proposal without delta')
        chk('S28', x['trigger'] == 'GAP' and (not x['linked_gap_ids'] or any(q not in gid for q in x['linked_gap_ids'])), f'{x["change_id"]} gap-trigger proposal without a known gap')
        chk('S29', x['change_class'] not in LOW and not x['regression_sample_ref'], f'{x["change_id"]} no risk-driven regression sample')
        chk('S30', x['knowledge_revision_id'].upper().startswith('V7.3') or x['target_table'].startswith('frozen_'), f'{x["change_id"]} targets the frozen V7.3')
        for d in x['linked_delta_ids']: chk('S31', d not in did, f'{x["change_id"]} cites unknown delta {d}')
    ids = [x['change_id'] for x in pr]; chk('S32', len(set(ids)) != len(ids), 'duplicate change_id')
    sem_open = [d for d in dl if d['semantic_change'] in ('SEMANTIC', 'UNDETERMINED')]
    unlinked = {d['delta_id'] for d in sem_open} - {q for x in pr for q in x['linked_delta_ids']}
    chk('S33', idx >= ORDER.index('PROPOSED') and st not in HELDS and set(cref('PROPOSAL')) != unlinked, 'PROPOSAL carry-over does not equal the semantic deltas left without a proposal')
    # --- gaps / new source path
    nsearch = 0
    for x in gp:
        ca, ns = x['closure_attempt'], x['new_source_search']
        chk('S34', ns['performed'] and (not ca['performed'] or ca['outcome'] not in ('PARTIAL', 'NOT_CLOSABLE') or not ca['registered_sources_consulted']), f'{x["gap_id"]} new-source search without failed registered-source closure')
        chk('S35', not ns['performed'] and ns['candidate_source_ids'], f'{x["gap_id"]} lists candidate sources without a search')
        chk('S36', x['state'] == 'RESOLVED' and not x['resolution_ref'], f'{x["gap_id"]} RESOLVED without resolution')
        chk('S37', ca['outcome'] == 'CLOSED' and ns['performed'], f'{x["gap_id"]} searched although closable from registered sources')
        nsearch += ns['performed']
    chk('S38', nsearch > cyc['caps']['max_gap_searches'], 'gap searches exceed max_gap_searches (carry-over cannot excuse an over-cap package)')
    chk('S71', bool(cref('GAP_SEARCH')) and nsearch < cyc['caps']['max_gap_searches'], 'gap search deferred while below max_gap_searches')
    chk('S72', bool(cref('PROPOSAL')) and len(pr) < cyc['caps']['max_proposals'], 'proposal work deferred while below max_proposals')
    if idx >= ORDER.index('PROPOSED') and st not in HELDS:
        pending = {x['gap_id'] for x in gp if x['state'] == 'OPEN' and x['closure_attempt']['outcome'] in ('PARTIAL', 'NOT_CLOSABLE') and not x['new_source_search']['performed']}
        chk('S73', set(cref('GAP_SEARCH')) != pending, 'GAP_SEARCH carry-over does not equal the OPEN not-closable gaps left without a search')
    chk('S39', len({x['dedupe_key'] for x in gp}) != len(gp), 'duplicate gap dedupe_key')
    for c in cs:
        gap = gid.get(c['discovered_via_gap_id'])
        chk('S40', gap is None or not gap['new_source_search']['performed'] or c['candidate_source_id'] not in gap['new_source_search']['candidate_source_ids'], f'candidate source {c["candidate_source_id"]} has no gap-triggered search (scheduled discovery is not allowed)')
        chk('S41', c['admission_state'] != 'ADMITTED' and c['authority_granted'], f'{c["candidate_source_id"]} holds authority before admission')
        a = c['admission_approval']
        chk('S42', c['admission_state'] == 'ADMITTED' and (a is None or a['approver'] == ident['created_by']), f'{c["candidate_source_id"]} admitted without independent approval')
    # --- coverage of search/discovery
    # --- adjudication / approval / validation
    adj, ap, va = p.get('adjudication'), p.get('approval'), p.get('validation')
    auto_all = bool(pr) and all(x['automation'] == 'ALLOWLISTED_AUTOMATIC' for x in pr)
    chk('S43', idx >= ORDER.index('POLICY_ELIGIBLE') and st == 'POLICY_ELIGIBLE' and not auto_all, 'POLICY_ELIGIBLE with a proposal that is not allowlisted-automatic')
    chk('S44', idx >= ORDER.index('APPROVED') and not auto_all and adj is None, 'approved state without independent adjudication')
    chk('S45', idx >= ORDER.index('APPROVED') and ap is None, 'approved state without approval record')
    if adj: chk('S46', adj['adjudicator'] == ident['created_by'] or not adj['independent_of_executor'], 'adjudicator is not independent of the executor')
    if ap:
        chk('S47', ap['approver'] == ident['created_by'] or (adj and ap['approver'] == adj['adjudicator']), 'approver equals executor or adjudicator (self-approval)')
        chk('S48', not auto_all and ap['approver_role'] != g['required_approver_role'], 'approver lacks the required admin role')
        chk('S49', any(x['consequential'] for x in pr) and ap['approver_role'] == 'POLICY_ALLOWLIST', 'consequential change approved by policy')
    chk('S50', idx >= ORDER.index('INDEPENDENTLY_VALIDATED') and (va is None or va['result'] != 'PASS' or not va['rollback_tested']), 'validated state without PASS and tested rollback')
    if va: chk('S51', va['validator'] in (ident['created_by'], (ap or {}).get('approver')), 'validator not independent of executor and approver')
    chk('S52', idx >= ORDER.index('CONSUMER_PROPAGATED') and consumer_gap, 'consumer propagation with unmapped consumers')
    chk('S53', idx >= ORDER.index('PUBLISHED') and any(x['knowledge_revision_id'].upper().startswith('V7.3') for x in pr), 'publication into the frozen revision')
    chk('S54', ident['package_hash'] != canon_hash(p), 'package_hash mismatch')
    # --- digest consistency
    dg = p['digest']; cnt = {k: sum(1 for s in srcs if s['outcome'] == k) for k in dg['outcome_counts']}
    chk('S55', dg['outcome_counts'] != cnt or dg['sources_total'] != len(srcs), 'digest counts do not match source results')
    chk('S68', dg['sources_total'] != len(wents), 'digest sources_total does not equal the watch-list size')
    chk('S56', dg['impact_unknown_items'] != sum(1 for i in im if i['status'] == 'IMPACT_UNKNOWN'), 'digest impact_unknown_items mismatch')
    chk('S57', dg['auto_applied'] > 0 and not auto_all, 'digest reports automatic application without an allowlisted-automatic package')
    # --- AMD2 (v3.2 s8.7, W1-GOV-001): per-destination disposition and completeness readback on every accepted delta
    if idx >= ORDER.index('PUBLISHED'):
        clo = p.get('delta_closure') or []
        accepted = {q for x in pr for q in x['linked_delta_ids']}
        cids = [c['delta_id'] for c in clo]
        chk('S77', set(cids) != accepted or len(cids) != len(set(cids)), 'delta_closure does not hold exactly one record per accepted delta')
        for c in clo:
            chk('S78', sorted(x['destination'] for x in c['destinations']) != sorted(DESTS), 'delta_closure %s does not cover each of the six destinations exactly once' % c['delta_id'])
            chk('S79', any(x['disposition'] == 'BLOCKED' for x in c['destinations']), 'delta_closure %s has a BLOCKED destination in a published state' % c['delta_id'])
            rb = c['readback']
            chk('S80', not rb['performed'] or rb['result'] != 'PASS' or rb['destinations_checked'] != len(DESTS), 'delta_closure %s completeness readback not performed, not PASS, or not over all six destinations' % c['delta_id'])
    return v

def schema_ok(p): return not list(V.iter_errors(p))
def verdict(p): return schema_ok(p) and not semantic(p)

# ------------------------------------------------------------------ fixtures
T0 = '2026-10-16T09:30:00+05:30'
def snap(sid, tag, ver, eff, size=1000): return {'snapshot_id': sid, 'retrieved_at': T0, 'sha256': H(tag), 'size': size, 'version_label': ver, 'effective_date': eff, 'custody_pointer': 'drive:' + sid}
def seg(status='TRACED', ids=('x',), basis='lineage index lookup'): return {'status': status, 'ids': list(ids) if status == 'TRACED' else [], 'basis': basis}
def full_path(): return {k: seg(ids=(k + '-1',)) for k in SEGS}
def src(sid='src-apqc-pcf', risk='FRAMEWORK', outcome='UNCHANGED', deltas=()):
    base = snap('SNAP-%s-C0' % sid, sid + 'v8', '8.0', '2023-01-01')
    cur = {'UNCHANGED': base, 'CONTENT_CHANGED_SAME_VERSION': snap('SNAP-%s-Q1' % sid, sid + 'v8b', '8.0', '2023-01-01'),
           'NEW_VERSION': snap('SNAP-%s-Q1' % sid, sid + 'v9', '9.0', '2026-07-01'),
           'SUPERSEDED_OR_WITHDRAWN': snap('SNAP-%s-Q1' % sid, sid + 'v9w', '9.0', '2026-07-01'), 'UNREACHABLE_OR_UNVERIFIABLE': None}[outcome]
    return {'source_id': sid, 'risk_class': risk, 'tier': 'TIER_TBD', 'locator': {'state': 'ESTABLISHED', 'url': 'https://example.org/' + sid, 'method': 'PAGE_TEXT', 'version_pattern': r'\d+\.\d+'},
            'baseline': base, 'current': cur, 'outcome': outcome, 'outcome_basis': 'hash and version compare against cycle-0 baseline',
            'manual_path': {'owner_snapshot_ref': 'owner-snapshot-request-1', 'deferred_reason': None} if outcome == 'UNREACHABLE_OR_UNVERIFIABLE' else None,
            'successor_ref': 'src-apqc-pcf-9.0' if outcome in ('NEW_VERSION', 'SUPERSEDED_OR_WITHDRAWN') else None, 'node_delta_ids': list(deltas)}
def delta(did='D1', sid='src-apqc-pcf', op='SPLIT', sem='SEMANTIC'): return {'delta_id': did, 'source_id': sid, 'node_id': 'PCF-6.4', 'operation': op, 'structural_summary': 'node split into two processes', 'semantic_change': sem, 'evidence_pointer': 'drive:delta-' + did}
def impact(did='D1', status='TRACED', path=None): return {'delta_id': did, 'status': status, 'path': path or full_path(), 'reasons': ['path from lineage index'], 'confidence': 'HIGH'}
def proposal(cid='CR-SW-0001', cls='PLACEMENT_REMAP', trig='SOURCE', deltas=('D1',), gaps=(), cons=True, route='SOURCE_WATCH_DIRECT', auto='ADMIN_REQUIRED', policy=None, sample='drive:regression-sample'):
    return {'change_id': cid, 'change_class': cls, 'trigger': trig, 'linked_delta_ids': list(deltas), 'linked_gap_ids': list(gaps), 'target_table': 'stg_source_placement', 'target_key': 'PCF-6.4',
            'rationale': 'map split node to existing constructs', 'evidence_pointer': 'drive:ev', 'rollback_pointer': 'compensating CR', 'tests_pointer': 'drive:tests', 'alternatives': 'keep old mapping',
            'consequential': cons, 'route': route, 'sdccae_candidate_ref': 'SDCCAE-C-17' if route == 'SDCCAE' else None, 'automation': auto, 'policy_ref': policy,
            'reassessment_scope': 'IMPACTED_SUBSET', 'regression_sample_ref': sample, 'knowledge_revision_id': 'KR-2026Q4-PROPOSED'}
def gap(gid='GAP-1', state='OPEN', searched=False, outcome=None, cands=()):
    return {'gap_id': gid, 'gap_type': 'MISSING', 'subject': {'kind': 'construct', 'ref': 'recall-initiation'}, 'origin': 'W1_25_BACKLOG', 'evidence_pointer': 'drive:gap', 'dedupe_key': 'dk-' + gid,
            'state': state, 'reason': 'awaiting evidence' if state in ('DEFERRED', 'BLOCKED') else None, 'resolution_ref': 'res-1' if state == 'RESOLVED' else None,
            'closure_attempt': {'performed': True, 'registered_sources_consulted': ['src-apqc-pcf'], 'outcome': outcome}, 'new_source_search': {'performed': searched, 'candidate_source_ids': list(cands)}}
def candsrc(cid='CS-1', gid='GAP-1', state='CANDIDATE', auth=False, approval=None):
    return {'candidate_source_id': cid, 'discovered_via_gap_id': gid, 'name': 'Candidate standard', 'url': 'https://example.org/cand', 'admission_state': state, 'authority_granted': auth, 'tier_proposed': 'TIER_TBD', 'admission_approval': approval}
def digest(p):
    cnt = {k: sum(1 for s in p['source_results'] if s['outcome'] == k) for k in ['UNCHANGED', 'CONTENT_CHANGED_SAME_VERSION', 'NEW_VERSION', 'SUPERSEDED_OR_WITHDRAWN', 'UNREACHABLE_OR_UNVERIFIABLE']}
    p['digest'] = {'sources_total': len(p['source_results']), 'outcome_counts': cnt, 'proposals_awaiting_decision': len(p['proposals']), 'held_items': 1 if p['status']['package_state'] in HELDS else 0,
                   'impact_unknown_items': sum(1 for i in p['impacts'] if i['status'] == 'IMPACT_UNKNOWN'), 'auto_applied': 0}
    return p
def pkg(pid='PKG-SW-2026Q4-001', state='ADMIN_REVIEW', srcs=None, deltas=None, impacts=None, props=None, gaps=None, cands=None, cov='COMPLETE', ctype='QUARTERLY', held_reason=None):
    p = {'identity': {'package_id': pid, 'schema_version': '2.1', 'op_id': 'SW-OP-FIXTURE', 'created_at': T0, 'created_by': 'CLAUDE controlled executor', 'package_hash': '0' * 64},
         'r3_basis': {'candidate_schema_version': '1.2', 'r3_package_id': None},
         'cycle': {'cycle_id': 'SW-2026Q4', 'cycle_type': ctype, 'cycle_date': '2026-12-31', 'executor': 'CLAUDE controlled executor', 'executor_class': 'CONTROLLED_AI_EXECUTOR',
                   'caps': {'max_delta_research': 20, 'max_gap_searches': 5, 'max_proposals': 10}, 'carried_over': [], 'watch_list': None},
         'source_results': srcs if srcs is not None else [src(outcome='NEW_VERSION', deltas=['D1'])],
         'node_deltas': deltas if deltas is not None else [delta()],
         'impacts': impacts if impacts is not None else [impact()],
         'gaps': gaps or [], 'candidate_sources': cands or [],
         'proposals': props if props is not None else [proposal()],
         'lineage_coverage': {'status': cov, 'report_ref': 'drive:lineage-coverage' if cov != 'NOT_PRODUCED' else None, 'uncovered_high_risk_count': 0},
         'digest': {}, 'gates': {'fail_closed': {'triggered': held_reason is not None, 'reasons': [held_reason] if held_reason else []}, 'frozen_v73_write': False, 'scheduled_new_source_search': False,
                   'required_adjudicator_role': 'independent adjudicator', 'required_approver_role': 'OWNER_ADMIN', 'independence_statement': 'adjudicator and approver differ from executor', 'allowlist_policy': None},
         'status': {'package_state': state, 'history': [{'at': T0, 'state': state, 'actor': 'CLAUDE'}]}}
    wl = [{'source_id': x['source_id'], 'risk_class': x['risk_class']} for x in p['source_results']]
    p['cycle']['watch_list'] = {'pinned_at': T0, 'registry_ref': 'drive:source-registry-cycle-pin', 'entries': wl, 'list_hash': list_hash(wl)}
    return rehash(digest(p))
def mut(f, b=None):
    p = copy.deepcopy(b or BASE); f(p); return rehash(digest(p)) if 'nohash' not in f.__dict__ else p
BASE = pkg()
ADJ = {'adjudicator': 'CHATGPT independent adjudicator', 'adjudicated_at': T0, 'independent_of_executor': True, 'outcome': 'ACCEPT'}
APR = {'approver': 'OWNER Darshan', 'approver_role': 'OWNER_ADMIN', 'approved_at': T0, 'decision_ref': 'DEC-xxx'}
VAL = {'validator': 'CHATGPT independent validator', 'validated_at': T0, 'independent_of_executor': True, 'result': 'PASS', 'staging_readback_ref': 'drive:readback', 'rollback_tested': True}
POLICY = {'policy_id': 'POL-LOW-1', 'version': '1', 'approved_by': 'OWNER Darshan', 'approved_at': T0, 'thresholds_ref': 'drive:thr', 'rollback_pointer': 'drive:rb', 'test_gate_ref': 'drive:tg', 'separation_of_duties': True}
def setstate(p, st): p['status']['package_state'] = st; p['status']['history'].append({'at': T0, 'state': st, 'actor': 'x'})
def approved(p, st='APPROVED'): setstate(p, st); p['adjudication'] = copy.deepcopy(ADJ); p['approval'] = copy.deepcopy(APR)
def validated(p, st='INDEPENDENTLY_VALIDATED'): approved(p, 'APPROVED'); setstate(p, st); p['validation'] = copy.deepcopy(VAL)
def hold(p, reason='held'): setstate(p, 'HELD'); p['gates']['fail_closed'] = {'triggered': True, 'reasons': [reason]}

# valid fixtures
v_auto = pkg(state='POLICY_ELIGIBLE', srcs=[src(outcome='UNCHANGED')], deltas=[], impacts=[], props=[proposal('CR-SW-0002', 'SOURCE_METADATA_REFRESH', deltas=(), cons=False, auto='ALLOWLISTED_AUTOMATIC', policy='POL-LOW-1', sample=None)])
v_auto['gates']['allowlist_policy'] = copy.deepcopy(POLICY); v_auto['approval'] = {**APR, 'approver_role': 'POLICY_ALLOWLIST', 'approver': 'allowlist policy POL-LOW-1'}; v_auto['digest']['auto_applied'] = 0; rehash(v_auto)
v_c0 = pkg(state='EVIDENCE_COLLECTED', srcs=[src(outcome='UNCHANGED'), src('src-fda-pack', 'HIGH_RISK', 'UNCHANGED')], deltas=[], impacts=[], props=[], ctype='BASELINE_CYCLE_0')
v_unreach = pkg(state='EVIDENCE_COLLECTED', srcs=[src(outcome='UNREACHABLE_OR_UNVERIFIABLE')], deltas=[], impacts=[], props=[])
v_noloc = pkg(state='EVIDENCE_COLLECTED', srcs=[{**src(outcome='UNREACHABLE_OR_UNVERIFIABLE'), 'locator': {'state': 'MISSING', 'url': None, 'method': None, 'version_pattern': None}, 'baseline': None}], deltas=[], impacts=[], props=[])
v_content = pkg(srcs=[src('src-fda-pack', 'HIGH_RISK', 'CONTENT_CHANGED_SAME_VERSION', ['D1'])], deltas=[delta('D1', 'src-fda-pack', 'MODIFY')])
v_withdrawn = pkg(srcs=[src(outcome='SUPERSEDED_OR_WITHDRAWN', deltas=['D1'])], deltas=[delta('D1', op='DEPRECATE')])
v_unknown = pkg(state='HELD', held_reason='IMPACT_UNKNOWN: no placement lineage', impacts=[impact(path={**full_path(), 'placement': seg('MISSING'), 'constructs': seg('MISSING')}, status='IMPACT_UNKNOWN')])
v_gap = pkg(state='ADMIN_REVIEW', srcs=[src(outcome='UNCHANGED')], deltas=[], impacts=[],
            gaps=[gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1'])], cands=[candsrc()],
            props=[proposal('CR-SW-0003', 'SOURCE_ADMISSION', 'GAP', deltas=(), gaps=('GAP-1',), cons=True)])
v_sdccae = mut(lambda p: p['proposals'].append(proposal('CR-SW-0004', 'RELATIONSHIP_CHANGE', route='SDCCAE')))
v_validated = mut(lambda p: validated(p))
def build_overflow():
    ds = ['D%d' % k for k in range(1, 12)]
    p = pkg(srcs=[src(outcome='NEW_VERSION', deltas=ds)], deltas=[delta(d) for d in ds], impacts=[impact(d) for d in ds], props=[proposal('CR-SW-%04d' % k, deltas=('D%d' % k,)) for k in range(1, 11)])
    p['cycle']['carried_over'] = [{'item_kind': 'PROPOSAL', 'item_ref': 'D11', 'reason': 'per-cycle proposal cap reached'}]
    return rehash(digest(p))
v_overflow = build_overflow()
v_gap_deferred = pkg(state='EVIDENCE_COLLECTED', srcs=[src(outcome='UNCHANGED')], deltas=[], impacts=[], props=[], gaps=[gap('GAP-2', 'DEFERRED', False, 'PARTIAL')])
v_none_conf = mut(lambda p: p['impacts'][0]['path'].update(profiles=seg('NONE_CONFIRMED', basis='profile index negative lookup q1')))

def sset(p, **kw): p['source_results'][0].update(kw)
ms = lambda f: mut(f)
cases = [
 ('SW-D01', 'valid: NEW_VERSION (APQC 8.0 to 9.0 style) with node split, traced impact, 2 proposals', BASE, True),
 ('SW-D02', 'valid: cycle-0 baseline package, snapshots only', v_c0, True),
 ('SW-D03', 'valid: UNREACHABLE source on manual Owner-snapshot path', v_unreach, True),
 ('SW-D04', 'valid: missing locator is UNREACHABLE', v_noloc, True),
 ('SW-D05', 'valid: CONTENT_CHANGED_SAME_VERSION high-risk, consequential, proposal', v_content, True),
 ('SW-D06', 'valid: SUPERSEDED_OR_WITHDRAWN consequential with proposal', v_withdrawn, True),
 ('SW-D07', 'valid: IMPACT_UNKNOWN held with fail_closed', v_unknown, True),
 ('SW-D08', 'valid: gap not closable, bounded new-source search, candidate source without authority', v_gap, True),
 ('SW-D09', 'valid: relationship change routed through SDCCAE spine', v_sdccae, True),
 ('SW-D10', 'valid: allowlisted low-risk automation under approved policy', v_auto, True),
 ('SW-D11', 'valid: independently validated chain (adjudication, approval, validation)', v_validated, True),
 ('SW-D12', 'valid: proposals at cap, the unlinked semantic delta carried over by its exact ID', v_overflow, True),
 ('SW-D13', 'valid: DEFERRED gap with reason', v_gap_deferred, True),
 ('SW-D14', 'valid: NONE_CONFIRMED segment with index lookup basis', v_none_conf, True),
 # --- currency outcomes
 ('SW-N01', 'invalid: UNCHANGED but hash differs from baseline', ms(lambda p: sset(p, outcome='UNCHANGED', current=snap('S2', 'other', '8.0', '2023-01-01'), node_delta_ids=[])), False),
 ('SW-N02', 'invalid: UNCHANGED with no retrieved snapshot (not verified)', ms(lambda p: sset(p, outcome='UNCHANGED', current=None, node_delta_ids=[])), False),
 ('SW-N03', 'invalid: UNREACHABLE without manual path', ms(lambda p: sset(p, outcome='UNREACHABLE_OR_UNVERIFIABLE', current=None, manual_path=None, node_delta_ids=[])), False),
 ('SW-N04', 'invalid: UNREACHABLE with empty manual path (no snapshot ref, no reason)', ms(lambda p: sset(p, outcome='UNREACHABLE_OR_UNVERIFIABLE', current=None, manual_path={'owner_snapshot_ref': None, 'deferred_reason': None}, node_delta_ids=[])), False),
 ('SW-N05', 'invalid: missing locator recorded as UNCHANGED', ms(lambda p: sset(p, locator={'state': 'MISSING', 'url': None, 'method': None, 'version_pattern': None}, outcome='UNCHANGED', current=p['source_results'][0]['baseline'], node_delta_ids=[])), False),
 ('SW-N06', 'invalid: quarterly comparison with no cycle-0 baseline', ms(lambda p: sset(p, baseline=None)), False),
 ('SW-N07', 'invalid: CONTENT_CHANGED with same hash', ms(lambda p: sset(p, outcome='CONTENT_CHANGED_SAME_VERSION', current=p['source_results'][0]['baseline'])), False),
 ('SW-N08', 'invalid: CONTENT_CHANGED but version label changed', ms(lambda p: sset(p, outcome='CONTENT_CHANGED_SAME_VERSION')), False),
 ('SW-N09', 'invalid: NEW_VERSION with identical label and no successor', ms(lambda p: sset(p, current=snap('S3', 'x', '8.0', '2023-01-01'), successor_ref=None)), False),
 ('SW-N10', 'invalid: unknown outcome class', ms(lambda p: sset(p, outcome='PROBABLY_FINE')), False),
 ('SW-N11', 'invalid: opened delta without node deltas after SEMANTIC_DIFFED', ms(lambda p: (sset(p, node_delta_ids=[]), p.update(node_deltas=[]), p.update(impacts=[]))), False),
 ('SW-N12', 'invalid: UNCHANGED source cites node deltas', ms(lambda p: sset(p, outcome='UNCHANGED', current=p['source_results'][0]['baseline'], successor_ref=None)), False),
 ('SW-N13', 'invalid: duplicate source_id', ms(lambda p: p['source_results'].append(copy.deepcopy(p['source_results'][0]))), False),
 # --- impact / lineage / fail closed
 ('SW-N14', 'invalid: TRACED impact with a MISSING consumer segment', ms(lambda p: p['impacts'][0]['path'].update(consumer_bindings=seg('MISSING'))), False),
 ('SW-N15', 'invalid: MISSING segment reported as IMPACT_UNKNOWN but package ADMIN_REVIEW (not held)', ms(lambda p: p['impacts'][0].update(status='IMPACT_UNKNOWN', path={**full_path(), 'placement': seg('MISSING')})), False),
 ('SW-N16', 'invalid: IMPACT_UNKNOWN in ADMIN_REVIEW', ms(lambda p: p['impacts'][0].update(status='IMPACT_UNKNOWN')), False),
 ('SW-N17', 'invalid: impact IMPACT_UNKNOWN with no reasons', ms(lambda p: (p['impacts'][0].update(status='IMPACT_UNKNOWN', reasons=[]), hold(p))), False),
 ('SW-N18', 'invalid: NONE_CONFIRMED without lookup basis', ms(lambda p: p['impacts'][0]['path'].update(profiles=seg('NONE_CONFIRMED', basis=''))), False),
 ('SW-N19', 'invalid: delta without impact record after IMPACT_ASSESSED', ms(lambda p: p.update(impacts=[])), False),
 ('SW-N20', 'invalid: lineage coverage NOT_PRODUCED but impact TRACED', ms(lambda p: p['lineage_coverage'].update(status='NOT_PRODUCED', report_ref=None)), False),
 ('SW-N21', 'invalid: incomplete coverage with uncovered high-risk lineage, high-risk delta, not held', ms(lambda p: (p['lineage_coverage'].update(status='INCOMPLETE', uncovered_high_risk_count=3), sset(p, risk_class='HIGH_RISK'))), False),
 ('SW-N22', 'invalid: fail_closed triggered but state ADMIN_REVIEW', ms(lambda p: p['gates']['fail_closed'].update(triggered=True, reasons=['x'])), False),
 ('SW-N23', 'invalid: fail_closed triggered without reasons', ms(lambda p: (hold(p), p['gates']['fail_closed'].update(reasons=[]))), False),
 # --- consequential, routing, automation
 ('SW-N24', 'invalid: withdrawn source with non-consequential proposal', ms(lambda p: (sset(p, outcome='SUPERSEDED_OR_WITHDRAWN'), p['proposals'][0].update(consequential=False))), False),
 ('SW-N25', 'invalid: high-risk source delta with non-consequential proposal', ms(lambda p: (sset(p, risk_class='HIGH_RISK'), p['proposals'][0].update(consequential=False))), False),
 ('SW-N26', 'invalid: semantic delta with no proposal after PROPOSED', ms(lambda p: p.update(proposals=[])), False),
 ('SW-N27', 'invalid: relationship change routed directly (bypasses SDCCAE)', ms(lambda p: p['proposals'].append(proposal('CR-SW-0005', 'RELATIONSHIP_CHANGE', route='SOURCE_WATCH_DIRECT'))), False),
 ('SW-N28', 'invalid: SDCCAE route without candidate ref', ms(lambda p: p['proposals'].append({**proposal('CR-SW-0006', 'PROFILE_CHANGE', route='SDCCAE'), 'sdccae_candidate_ref': None})), False),
 ('SW-N29', 'invalid: profile change marked automatic', ms(lambda p: p['proposals'].append({**proposal('CR-SW-0007', 'PROFILE_CHANGE', route='SDCCAE', cons=False, auto='ALLOWLISTED_AUTOMATIC', policy='POL-LOW-1')})), False),
 ('SW-N30', 'invalid: automatic low-risk class without policy', ms(lambda p: p['proposals'].append(proposal('CR-SW-0008', 'SOURCE_METADATA_REFRESH', deltas=(), cons=False, auto='ALLOWLISTED_AUTOMATIC', policy=None, sample=None))), False),
 ('SW-N31', 'invalid: automatic low-risk class but proposal consequential', ms(lambda p: (p['gates'].update(allowlist_policy=copy.deepcopy(POLICY)), p['proposals'].append(proposal('CR-SW-0009', 'SOURCE_METADATA_REFRESH', deltas=(), cons=True, auto='ALLOWLISTED_AUTOMATIC', policy='POL-LOW-1', sample=None)))), False),
 ('SW-N32', 'invalid: automatic action against a high-risk source with a delta', ms(lambda p: (sset(p, risk_class='HIGH_RISK'), p['gates'].update(allowlist_policy=copy.deepcopy(POLICY)), p['proposals'].append(proposal('CR-SW-0010', 'ADDITIVE_METADATA', deltas=(), cons=False, auto='ALLOWLISTED_AUTOMATIC', policy='POL-LOW-1', sample=None)))), False),
 ('SW-N33', 'invalid: automatic proposal citing a policy that is not the declared allowlist policy', ms(lambda p: (p['gates'].update(allowlist_policy=copy.deepcopy(POLICY)), p['proposals'].append(proposal('CR-SW-0011', 'DUPLICATE_DETECTION', deltas=(), cons=False, auto='ALLOWLISTED_AUTOMATIC', policy='POL-OTHER', sample=None)))), False),
 ('SW-N34', 'invalid: allowlist policy without separation of duties', ms(lambda p: p['gates'].update(allowlist_policy={**POLICY, 'separation_of_duties': False})), False),
 ('SW-N35', 'invalid: non-low proposal without regression sample (blind reassessment)', ms(lambda p: p['proposals'][0].update(regression_sample_ref=None)), False),
 ('SW-N36', 'invalid: reassessment scope FULL', ms(lambda p: p['proposals'][0].update(reassessment_scope='FULL_REASSESSMENT')), False),
 ('SW-N37', 'invalid: source-trigger structural proposal without delta', ms(lambda p: p['proposals'][0].update(linked_delta_ids=[])), False),
 ('SW-N38', 'invalid: proposals above cap and nothing carried over', ms(lambda p: p['proposals'].extend([proposal('CR-SW-%04d' % (20 + i)) for i in range(11)])), False),
 ('SW-N39', 'invalid: proposal targets the frozen V7.3 revision', ms(lambda p: p['proposals'][0].update(knowledge_revision_id='V7.3')), False),
 ('SW-N40', 'invalid: package declares a frozen write', ms(lambda p: p['gates'].update(frozen_v73_write=True)), False),
 ('SW-N41', 'invalid: package declares scheduled new-source search', ms(lambda p: p['gates'].update(scheduled_new_source_search=True)), False),
 # --- gap path and candidate sources
 ('SW-N42', 'invalid: new-source search although gap closed from registered sources', ms(lambda p: p['gaps'].append(gap('GAP-1', 'OPEN', True, 'CLOSED', ['CS-1']))), False),
 ('SW-N43', 'invalid: new-source search with no closure attempt', ms(lambda p: p['gaps'].append({**gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1']), 'closure_attempt': {'performed': False, 'registered_sources_consulted': [], 'outcome': None}})), False),
 ('SW-N44', 'invalid: candidate source with no gap-triggered search (scheduled discovery)', ms(lambda p: (p['gaps'].append(gap('GAP-1', 'OPEN', False, 'PARTIAL')), p['candidate_sources'].append(candsrc()))), False),
 ('SW-N45', 'invalid: candidate source holds authority before admission', ms(lambda p: (p['gaps'].append(gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1'])), p['candidate_sources'].append(candsrc(auth=True)))), False),
 ('SW-N46', 'invalid: ADMITTED source without approval record', ms(lambda p: (p['gaps'].append(gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1'])), p['candidate_sources'].append(candsrc(state='ADMITTED', auth=True)))), False),
 ('SW-N47', 'invalid: ADMITTED by the executor itself', ms(lambda p: (p['gaps'].append(gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1'])), p['candidate_sources'].append(candsrc(state='ADMITTED', auth=True, approval={**APR, 'approver': p['identity']['created_by']})))), False),
 ('SW-N48', 'invalid: RESOLVED gap without resolution reference', ms(lambda p: p['gaps'].append({**gap('GAP-1', 'RESOLVED', False, 'CLOSED'), 'resolution_ref': None})), False),
 ('SW-N49', 'invalid: BLOCKED gap without reason', ms(lambda p: p['gaps'].append({**gap('GAP-1', 'BLOCKED', False, 'PARTIAL'), 'reason': None})), False),
 ('SW-N50', 'invalid: duplicate gap dedupe_key', ms(lambda p: p['gaps'].extend([gap('GAP-1'), {**gap('GAP-2'), 'dedupe_key': 'dk-GAP-1'}])), False),
 ('SW-N51', 'invalid: gap searches above cap and nothing carried over', ms(lambda p: (p['cycle']['caps'].update(max_gap_searches=0), p['gaps'].append(gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1'])), p['candidate_sources'].append(candsrc()))), False),
 ('SW-N52', 'invalid: gap-trigger proposal that cites no gap', ms(lambda p: p['proposals'].append(proposal('CR-SW-0012', 'SOURCE_ADMISSION', 'GAP', deltas=(), gaps=()))), False),
 ('SW-N53', 'invalid: gap-trigger proposal citing an unknown gap', ms(lambda p: p['proposals'].append(proposal('CR-SW-0013', 'SOURCE_ADMISSION', 'GAP', deltas=(), gaps=('GAP-NOPE',)))), False),
 # --- adjudication, approval, validation
 ('SW-N54', 'invalid: APPROVED without adjudication', ms(lambda p: (setstate(p, 'APPROVED'), p.update(approval=copy.deepcopy(APR)))), False),
 ('SW-N55', 'invalid: APPROVED without approval record', ms(lambda p: (setstate(p, 'APPROVED'), p.update(adjudication=copy.deepcopy(ADJ)))), False),
 ('SW-N56', 'invalid: adjudicator equals executor', ms(lambda p: (approved(p), p['adjudication'].update(adjudicator=p['identity']['created_by']))), False),
 ('SW-N57', 'invalid: approver equals executor', ms(lambda p: (approved(p), p['approval'].update(approver=p['identity']['created_by']))), False),
 ('SW-N58', 'invalid: approver equals adjudicator', ms(lambda p: (approved(p), p['approval'].update(approver=p['adjudication']['adjudicator']))), False),
 ('SW-N59', 'invalid: approver lacks the admin role', ms(lambda p: (approved(p), p['approval'].update(approver_role='REVIEWER'))), False),
 ('SW-N60', 'invalid: consequential change approved by the allowlist policy', ms(lambda p: (approved(p), p['approval'].update(approver_role='POLICY_ALLOWLIST'))), False),
 ('SW-N61', 'invalid: INDEPENDENTLY_VALIDATED without validation record', ms(lambda p: (approved(p), setstate(p, 'INDEPENDENTLY_VALIDATED'))), False),
 ('SW-N62', 'invalid: validation FAIL in a validated state', ms(lambda p: (validated(p), p['validation'].update(result='FAIL'))), False),
 ('SW-N63', 'invalid: validation without tested rollback', ms(lambda p: (validated(p), p['validation'].update(rollback_tested=False))), False),
 ('SW-N64', 'invalid: validator equals approver', ms(lambda p: (validated(p), p['validation'].update(validator=p['approval']['approver']))), False),
 ('SW-N65', 'invalid: validator equals executor', ms(lambda p: (validated(p), p['validation'].update(validator=p['identity']['created_by']))), False),
 ('SW-N66', 'invalid: consumer propagation with consumers unmapped', ms(lambda p: (validated(p), setstate(p, 'CONSUMER_PROPAGATED'), p['impacts'][0]['path'].update(consumer_bindings=seg('MISSING')))), False),
 ('SW-N67', 'invalid: POLICY_ELIGIBLE with an admin-required proposal', ms(lambda p: setstate(p, 'POLICY_ELIGIBLE')), False),
 # --- structure / hash / digest
 ('SW-N68', 'invalid: extra top-level field', ms(lambda p: p.update(auto_approve=True)), False),
 ('SW-N69', 'invalid: schema_version 1.2 (candidate package) used as cycle package', ms(lambda p: p['identity'].update(schema_version='1.2')), False),
 ('SW-N70', 'invalid: naive timestamp', ms(lambda p: p['identity'].update(created_at='2026-10-16T09:30:00')), False),
 ('SW-N71', 'invalid: unknown package_state', ms(lambda p: p['status'].update(package_state='PROMOTED')), False),
 ('SW-N72', 'invalid: unknown node-delta operation', ms(lambda p: p['node_deltas'][0].update(operation='REWRITE')), False),
 ('SW-N73', 'invalid: unknown gap type', ms(lambda p: p['gaps'].append({**gap('GAP-1'), 'gap_type': 'FUZZY'})), False),
]
# digest-tamper cases must be built so the digest stays wrong (the helper re-hashes only the package)
def tamper(cid, f):
    d = copy.deepcopy(BASE); f(d); rehash(d); return d
cases += [
 ('SW-N74', 'invalid: digest counts do not match results', tamper('x', lambda p: p['digest']['outcome_counts'].update(UNCHANGED=5)), False),
 ('SW-N75', 'invalid: digest hides IMPACT_UNKNOWN items', tamper('x', lambda p: (p['impacts'][0].update(status='IMPACT_UNKNOWN', path={**full_path(), 'placement': seg('MISSING')}), hold(p), p['digest'].update(impact_unknown_items=0, held_items=1))), False),
 ('SW-N76', 'invalid: digest reports automatic application for an admin-required package', tamper('x', lambda p: p['digest'].update(auto_applied=2)), False),
]
fails = 0; out = []
for cid, name, doc, exp in cases:
    se = list(V.iter_errors(doc)); sv = semantic(doc); got_schema = not se; got = got_schema and not sv
    res = 'PASS' if got == exp else 'FAIL'; fails += res == 'FAIL'
    layer = 'schema' if se else ('semantic' if sv else '-')
    msg = se[0].message[:60] if se else (sv[0] if sv else '')
    out.append(f"{cid}|{res}|expected {'valid' if exp else 'invalid'}, got {'valid' if got else 'invalid'}|{name}|caught by {layer}: {msg}")
# every invalid case expressible in the schema alone must be rejected by the schema; semantic-only list names the rest explicitly
SEM_ONLY = {'SW-N01','SW-N02','SW-N04','SW-N06','SW-N07','SW-N08','SW-N09','SW-N11','SW-N12','SW-N13','SW-N15','SW-N16','SW-N19','SW-N20','SW-N21','SW-N22','SW-N24','SW-N25','SW-N26','SW-N31','SW-N32','SW-N33','SW-N35','SW-N37','SW-N38','SW-N39','SW-N42','SW-N44','SW-N47','SW-N50','SW-N51','SW-N52','SW-N53','SW-N54','SW-N55','SW-N56','SW-N57','SW-N58','SW-N59','SW-N60','SW-N62','SW-N63','SW-N64','SW-N65','SW-N66','SW-N67','SW-N74','SW-N75','SW-N76','SW-N14','SW-N43','SW-N29'}
for cid, name, doc, exp in cases:
    if not exp and cid not in SEM_ONLY and schema_ok(doc):
        fails += 1; out.append(f'{cid}|FAIL|schema layer alone accepted an invalid package it is required to reject|{name}|')
# hash tamper
t = copy.deepcopy(BASE); t['cycle']['executor'] = 'tampered'
r = 'PASS' if 'S54 package_hash mismatch' in semantic(t) else 'FAIL'; fails += r == 'FAIL'; out.append(f'SW-H01|{r}|tampered content no longer matches package_hash|hash check|')
r = 'PASS' if canon_hash(BASE) == BASE['identity']['package_hash'] and not semantic(BASE) else 'FAIL'; fails += r == 'FAIL'; out.append(f'SW-H02|{r}|untampered package hash verifies and semantic validator is clean|hash check|')

# ---- exhaustive differential against an independent oracle
def build(outcome, risk, imode, cov, cons, auto, st, ftrig, manual):
    opens = outcome in OPENS
    srcs = [src('src-x', risk, outcome, ['D1'] if opens else [])]
    dl = [delta('D1', 'src-x')] if opens else []
    if imode == 'TRACED': ims = [impact('D1')] if opens else []
    elif imode == 'NO_PLACEMENT': ims = [impact('D1', 'IMPACT_UNKNOWN', {**full_path(), 'placement': seg('MISSING')})] if opens else []
    else: ims = [impact('D1', 'IMPACT_UNKNOWN', {**full_path(), 'consumer_bindings': seg('MISSING')})] if opens else []
    if opens: props = [proposal('CR-SW-0001', 'PLACEMENT_REMAP', cons=cons, auto='ALLOWLISTED_AUTOMATIC' if auto else 'ADMIN_REQUIRED', policy='POL-LOW-1' if auto else None)]
    else: props = [proposal('CR-SW-0002', 'SOURCE_METADATA_REFRESH', deltas=(), cons=cons, auto='ALLOWLISTED_AUTOMATIC' if auto else 'ADMIN_REQUIRED', policy='POL-LOW-1' if auto else None, sample=None)]
    p = pkg(state=st, srcs=srcs, deltas=dl, impacts=ims, props=props, cov=cov)
    if outcome == 'UNREACHABLE_OR_UNVERIFIABLE' and not manual: p['source_results'][0]['manual_path'] = None
    if auto: p['gates']['allowlist_policy'] = copy.deepcopy(POLICY)
    p['gates']['fail_closed'] = {'triggered': ftrig, 'reasons': ['r'] if ftrig else []}
    return rehash(digest(p))
def oracle_unsafe(p):
    s = p['source_results'][0]; o = s['outcome']; opens = o in OPENS; im = p['impacts']; pr = p['proposals'][0]; cov = p['lineage_coverage']['status']
    hold_need = any(i['status'] == 'IMPACT_UNKNOWN' for i in im) or (cov == 'NOT_PRODUCED' and opens) or (cov == 'INCOMPLETE' and p['lineage_coverage']['uncovered_high_risk_count'] > 0 and s['risk_class'] == 'HIGH_RISK' and opens)
    held = p['status']['package_state'] in HELDS and p['gates']['fail_closed']['triggered']
    cons_need = o == 'SUPERSEDED_OR_WITHDRAWN' or (s['risk_class'] == 'HIGH_RISK' and opens) or pr['change_class'] not in LOW
    auto_bad = pr['automation'] == 'ALLOWLISTED_AUTOMATIC' and (pr['change_class'] not in LOW or pr['consequential'] or cons_need or (s['risk_class'] == 'HIGH_RISK' and o != 'UNCHANGED'))
    unreach_bad = o == 'UNREACHABLE_OR_UNVERIFIABLE' and s['manual_path'] is None
    return (hold_need and not held) or (cons_need and not pr['consequential']) or auto_bad or unreach_bad
OUT = ['UNCHANGED', 'CONTENT_CHANGED_SAME_VERSION', 'NEW_VERSION', 'SUPERSEDED_OR_WITHDRAWN', 'UNREACHABLE_OR_UNVERIFIABLE']
GRID = list(itertools.product(OUT, ['HIGH_RISK', 'FRAMEWORK', 'STANDARD'], ['TRACED', 'NO_PLACEMENT', 'NO_CONSUMER'], ['COMPLETE', 'INCOMPLETE', 'NOT_PRODUCED'], [False, True], [False, True], ['ADMIN_REVIEW', 'HELD'], [False, True], [False, True]))
total = unsafe_acc = sem_only = unexplained = schema_alone_unsafe = safe_acc = 0
for a in GRID:
    p = build(*a); total += 1
    if a[6] == 'HELD' and not a[7]: p['gates']['fail_closed']['triggered'] = False; rehash(p)
    s_ok, sv = schema_ok(p), semantic(p); m_ok = not sv; uns = oracle_unsafe(p)
    if s_ok and uns: schema_alone_unsafe += 1
    if s_ok and not m_ok:
        sem_only += 1
        if not uns and {x.split()[0] for x in sv} != {'S17'}: unexplained += 1
    if s_ok and m_ok:
        safe_acc += not uns; unsafe_acc += bool(uns)
r = 'PASS' if unsafe_acc == 0 and unexplained == 0 and safe_acc > 0 else 'FAIL'; fails += r == 'FAIL'
out.append(f'SW-D15|{r}|{total} combinations (5 outcomes x 3 risk x 3 impact x 3 coverage x 2 consequential x 2 automation x 2 state x 2 fail_closed x 2 manual); unsafe packages accepted by BOTH layers: {unsafe_acc}; unsafe packages the schema alone would accept but the semantic layer rejects: {schema_alone_unsafe}; semantic-layer rejections not explained by the oracle or a consistency rule (S17): {unexplained}; safe packages accepted: {safe_acc}|exhaustive fail-closed differential|')
# ---- mutation: remove guards, the oracle must then find unsafe accepts (proves SW-D15 is not vacuous)
def strip(o):
    if isinstance(o, dict): return {k: strip(v) for k, v in o.items() if k != 'allOf'}
    if isinstance(o, list): return [strip(v) for v in o]
    return o
WV = DV(strip(schema)); OFF = frozenset({'S01', 'S02', 'S18', 'S19', 'S20', 'S21', 'S26', 'S49'})
weak_unsafe = 0
for a in GRID:
    p = build(*a)
    if a[6] == 'HELD' and not a[7]: p['gates']['fail_closed']['triggered'] = False; rehash(p)
    if WV.is_valid(p) and not semantic(p, OFF) and oracle_unsafe(p): weak_unsafe += 1
r = 'PASS' if weak_unsafe > 0 else 'FAIL'; fails += r == 'FAIL'
out.append(f'SW-D16|{r}|guards H* (all schema conditionals) and semantic S01,S02,S18-S21,S26,S49 removed: {weak_unsafe} unsafe packages accepted (SW-D15 can detect the defects)|mutation check of the differential test|')
# ---- R3 carry-over guard: this suite must not shadow R3 schema 1.2 identity
r = 'PASS' if schema['properties']['r3_basis']['properties']['candidate_schema_version']['const'] == '1.2' and schema['properties']['identity']['properties']['schema_version']['const'] == '2.1' else 'FAIL'; fails += r == 'FAIL'
out.append(f'SW-D17|{r}|cycle package 2.1 references candidate schema 1.2 and does not redefine it|R3 preservation|')

# ======================= AMD2 / R2-scope additions (v3.2 s8.4-8.7, W1-GOV-001) =======================
def wlfix(p):
    wl = [{'source_id': x['source_id'], 'risk_class': x['risk_class']} for x in p['source_results']]
    p['cycle']['watch_list'].update(entries=wl, list_hash=list_hash(wl)); return p
def mk(f, **kw):
    p = pkg(**kw); f(p); wlfix(p); return rehash(digest(p))
def closure(did, disp='CHANGED', rb=None):
    return {'delta_id': did, 'destinations': [{'destination': d, 'disposition': disp, 'evidence_ref': 'drive:close-%s-%s' % (did, d)} if disp == 'CHANGED' else {'destination': d, 'disposition': disp, 'evidence_ref': 'drive:close-%s-%s' % (did, d), 'reason': 'no change required for this destination'} for d in DESTS],
            'readback': rb or {'performed': True, 'result': 'PASS', 'destinations_checked': 6, 'evidence_ref': 'drive:readback-' + did}}
def published(state='PUBLISHED', ids=('D1',)):
    p = copy.deepcopy(BASE); validated(p); setstate(p, state); p['delta_closure'] = [closure(i) for i in ids]; return rehash(digest(p))
def two_src(risks=('HIGH_RISK', 'STANDARD'), cap=1, defer=1, state='ADMIN_REVIEW', hold_it=False):
    a = src('src-a', risks[0], 'NEW_VERSION', ['D1'])
    b = src('src-b', risks[1], 'NEW_VERSION', [])
    p = pkg(state=state, srcs=[a, b], deltas=[delta('D1', 'src-a')], impacts=[impact('D1')], props=[proposal()])
    p['cycle']['caps']['max_delta_research'] = cap; p['cycle']['carried_over'] = [{'item_kind': 'DELTA_RESEARCH', 'item_ref': 'src-b', 'reason': 'per-cycle research cap reached'}]
    if hold_it: hold(p, 'deferred high-risk research')
    return rehash(digest(p))
def gap2(searched2=False):
    g1 = gap('GAP-1', 'OPEN', True, 'NOT_CLOSABLE', ['CS-1']); g2 = gap('GAP-2', 'OPEN', searched2, 'NOT_CLOSABLE', []); g2['dedupe_key'] = 'other-key'
    return [g1, g2]
def gapbase(co=None, cap=1):
    p = pkg(state='ADMIN_REVIEW', srcs=[src(outcome='UNCHANGED')], deltas=[], impacts=[], gaps=gap2(), cands=[candsrc()],
            props=[proposal('CR-SW-0003', 'SOURCE_ADMISSION', 'GAP', deltas=(), gaps=('GAP-1',), cons=True)])
    p['cycle']['caps']['max_gap_searches'] = cap
    p['cycle']['carried_over'] = co if co is not None else [{'item_kind': 'GAP_SEARCH', 'item_ref': 'GAP-2', 'reason': 'gap search cap reached'}]
    return rehash(digest(p))
def carry(p, kind, ref): p['cycle']['carried_over'].append({'item_kind': kind, 'item_ref': ref, 'reason': 'carried over for test'})
def setcap(p, **kw): p['cycle']['caps'].update(kw)

valid2 = [
 ('SW-D18', 'valid: research deferred at cap, lower-risk source carried over by ID', two_src(), True),
 ('SW-D19', 'valid: deferred HIGH_RISK research in a held fail-closed package', two_src(('HIGH_RISK', 'HIGH_RISK'), hold_it=True, state='ADMIN_REVIEW') if False else (lambda q: q)(two_src(('HIGH_RISK', 'HIGH_RISK'), hold_it=True)), True),
 ('SW-D20', 'valid: gap search deferred at cap and carried over by gap ID', gapbase(), True),
 ('SW-D21', 'valid: PUBLISHED with six-destination closure and PASS readback', published(), True),
 ('SW-D22', 'valid: CONSUMER_PROPAGATED with closure', published('CONSUMER_PROPAGATED'), True),
 ('SW-D23', 'valid: closure with NO_CHANGE_REQUIRED dispositions (each with a reason)', (lambda p: (p['delta_closure'].__setitem__(0, closure('D1', 'NO_CHANGE_REQUIRED')), rehash(p))[1])(published()), True),
]
S_NEG = [  # (id, intended rule, description, document)
 ('SW-N77', 'S58', 'a registered source has no result (silent omission)', tamper('x', lambda p: (p['cycle']['watch_list']['entries'].append({'source_id': 'src-z', 'risk_class': 'STANDARD'}), p['cycle']['watch_list'].update(list_hash=list_hash(p['cycle']['watch_list']['entries']))))),
 ('SW-N78', 'S58', 'a result for an unregistered source', mk(lambda p: p['source_results'].append(src('src-ghost', 'STANDARD', 'UNCHANGED')) or None) if False else tamper('x', lambda p: p['source_results'].append(src('src-ghost', 'STANDARD', 'UNCHANGED')))),
 ('SW-N79', 'S59', 'duplicate watch-list entry', tamper('x', lambda p: p['cycle']['watch_list']['entries'].append(dict(p['cycle']['watch_list']['entries'][0])))),
 ('SW-N80', 'S60', 'list_hash does not match the entries', tamper('x', lambda p: p['cycle']['watch_list'].update(list_hash='f' * 64))),
 ('SW-N81', 'S61', 'result risk class differs from the pinned class', tamper('x', lambda p: p['source_results'][0].update(risk_class='STANDARD'))),
 ('SW-N82', 'S62', 'orphan delta (not listed on its parent source result)', tamper('x', lambda p: p['source_results'][0].update(node_delta_ids=[]))),
 ('SW-N83', 'S63', 'duplicate delta_id', mk(lambda p: p['node_deltas'].append(copy.deepcopy(p['node_deltas'][0])))),
 ('SW-N84', 'S64', 'a delta listed under two source results', mk(lambda p: (p['source_results'].append(src('src-b', 'STANDARD', 'NEW_VERSION', ['D1'])),))),
 ('SW-N85', 'S65', 'duplicate impact record', mk(lambda p: p['impacts'].append(copy.deepcopy(p['impacts'][0])))),
 ('SW-N86', 'S66', 'higher-risk source deferred while a lower-risk source was researched', two_src(('STANDARD', 'HIGH_RISK'))),
 ('SW-N87', 'S67', 'researched sources exceed max_delta_research', mk(lambda p: (p['source_results'].append(src('src-b', 'STANDARD', 'NEW_VERSION', ['D2'])), p['node_deltas'].append(delta('D2', 'src-b')), p['impacts'].append(impact('D2')), p['proposals'].append(proposal('CR-SW-0002', deltas=('D2',))), setcap(p, max_delta_research=1))[-1])),
 ('SW-N88', 'S68', 'digest sources_total differs from the watch-list size', tamper('x', lambda p: p['digest'].update(sources_total=0))),
 ('SW-N89', 'S69', 'DELTA_RESEARCH carry-over omits a deferred source', (lambda p: (p['cycle'].update(carried_over=[]), rehash(p))[1])(two_src())),
 ('SW-N90', 'S69', 'DELTA_RESEARCH carry-over names a source that was researched', (lambda p: (carry(p, 'DELTA_RESEARCH', 'src-a'), rehash(p))[1])(two_src())),
 ('SW-N91', 'S70', 'research deferred while below the cap', (lambda p: (setcap(p, max_delta_research=5), rehash(p))[1])(two_src())),
 ('SW-N92', 'S71', 'gap search deferred while below the gap cap', gapbase(cap=5)),
 ('SW-N93', 'S72', 'proposal work deferred while below the proposal cap', mk(lambda p: carry(p, 'PROPOSAL', 'D1'))),
 ('SW-N94', 'S73', 'GAP_SEARCH carry-over omits an unsearched open gap', gapbase(co=[])),
 ('SW-N95', 'S74', 'duplicate carried_over entry', (lambda p: (carry(p, 'DELTA_RESEARCH', 'src-b'), rehash(p))[1])(two_src())),
 ('SW-N96', 'S75', 'carried_over names an ID that is not in the package', (lambda p: (carry(p, 'GAP_SEARCH', 'GAP-404'), rehash(p))[1])(gapbase())),
 ('SW-N97', 'S76', 'deferred HIGH_RISK research in a package that is not held fail-closed', two_src(('HIGH_RISK', 'HIGH_RISK'))),
 ('SW-N98', 'S77', 'PUBLISHED with a closure record missing for an accepted delta', (lambda p: (p['delta_closure'].clear(), rehash(p))[1])(published())),
 ('SW-N99', 'S77', 'PUBLISHED with two closure records for one delta', (lambda p: (p['delta_closure'].append(closure('D1')), rehash(p))[1])(published())),
 ('SW-N100', 'S77', 'PUBLISHED with a closure record for a delta that was not accepted', (lambda p: (p['delta_closure'].append(closure('D9')), rehash(p))[1])(published())),
 ('SW-N101', 'S78', 'a destination appears twice and another is missing', (lambda p: (p['delta_closure'][0]['destinations'].__setitem__(5, copy.deepcopy(p['delta_closure'][0]['destinations'][0])), rehash(p))[1])(published())),
 ('SW-N102', 'S79', 'a BLOCKED destination in a published state', (lambda p: (p['delta_closure'][0]['destinations'][2].update(disposition='BLOCKED', reason='blocked by test'), rehash(p))[1])(published())),
 ('SW-N103', 'S80', 'readback not performed', (lambda p: (p['delta_closure'][0]['readback'].update(performed=False, result='NOT_RUN', destinations_checked=0), rehash(p))[1])(published())),
 ('SW-N104', 'S80', 'readback result FAIL', (lambda p: (p['delta_closure'][0]['readback'].update(result='FAIL'), rehash(p))[1])(published())),
 ('SW-N105', 'S80', 'readback covered fewer than six destinations', (lambda p: (p['delta_closure'][0]['readback'].update(destinations_checked=5), rehash(p))[1])(published())),
 ('SW-N106', 'H24', 'PUBLISHED without any delta_closure (schema layer)', (lambda p: (p.pop('delta_closure'), rehash(p))[1])(published())),
 ('SW-N107', 'H24', 'MONITORED without any delta_closure (schema layer)', (lambda p: (p.pop('delta_closure'), rehash(p))[1])(published('MONITORED'))),
 ('SW-N108', 'SCHEMA', 'closure with only five destination records', (lambda p: (p['delta_closure'][0]['destinations'].pop(), rehash(p))[1])(published())),
 ('SW-N109', 'SCHEMA', 'closure destination outside the six allowed', (lambda p: (p['delta_closure'][0]['destinations'][0].update(destination='SLACK_CHANNEL'), rehash(p))[1])(published())),
 ('SW-N110', 'SCHEMA', 'NO_CHANGE_REQUIRED without a reason', (lambda p: (p['delta_closure'][0]['destinations'][0].update(disposition='NO_CHANGE_REQUIRED'), rehash(p))[1])(published())),
 ('SW-N111', 'SCHEMA', 'schema_version 2.0 (superseded R2 package) used as 2.1', (lambda p: (p['identity'].update(schema_version='2.0'), rehash(p))[1])(copy.deepcopy(BASE))),
]
for cid, name, doc, exp in valid2:
    se = list(V.iter_errors(doc)); sv = semantic(doc); ok = not se and not sv
    r = 'PASS' if ok else 'FAIL'; fails += r == 'FAIL'; out.append(f"{cid}|{r}|expected valid, got {'valid' if ok else 'invalid'}|{name}|{(se[0].message[:60] if se else (sv[0] if sv else ''))}")
for cid, rule, name, doc in S_NEG:
    se = list(V.iter_errors(doc)); sv = semantic(doc); codes = {x.split()[0] for x in sv}
    if rule in ('H24', 'SCHEMA'): hit = bool(se); layer = 'schema'
    else: hit = rule in codes; layer = 'semantic'
    invalid = bool(se) or bool(sv)
    r = 'PASS' if invalid and hit else 'FAIL'; fails += r == 'FAIL'
    out.append(f"{cid}|{r}|expected invalid and caught by {rule} ({layer}); got {'invalid' if invalid else 'valid'}, codes {sorted(codes)[:6]}{' schema:' + se[0].message[:50] if se else ''}|{name}|")
# differential: every S58-S80 rule is exercised by at least one negative (no dead rule)
fired = set()
for cid, rule, name, doc in S_NEG: fired |= {x.split()[0] for x in semantic(doc)}
need = {'S%d' % k for k in range(58, 81)}
miss = sorted(need - fired); r = 'PASS' if not miss else 'FAIL'; fails += r == 'FAIL'
out.append(f'SW-D24|{r}|every new semantic rule S58-S80 fires on at least one negative fixture; never fired: {miss}|no dead rules|')
# mutation: disabling each new rule must let its own negative through (proves each negative depends on that rule)
dep_fail = []
for cid, rule, name, doc in S_NEG:
    if rule.startswith('S') and rule != 'SCHEMA':
        if not schema_ok(doc): dep_fail.append(cid + '(schema-rejected)') if False else None
        if schema_ok(doc) and not semantic(doc, frozenset({rule})) and False: pass
        still = [x for x in semantic(doc, frozenset({rule})) if x.split()[0] == rule]
        if still: dep_fail.append(cid)
r = 'PASS' if not dep_fail else 'FAIL'; fails += r == 'FAIL'
out.append(f'SW-D25|{r}|rule-switch mutation: with its rule disabled no negative still reports that rule; offenders: {dep_fail}|mutation check of S58-S80|')
# closure differential: PUBLISHED closure grid (disposition x readback x destinations_checked x count)
cg = 0; cbad = 0
for disp in ('CHANGED', 'NO_CHANGE_REQUIRED', 'BLOCKED'):
    for perf, res, nchk in itertools.product((True, False), ('PASS', 'FAIL', 'NOT_RUN'), (0, 5, 6)):
        for ndest in (6, 5):
            p = published(); c = closure('D1', disp if disp != 'BLOCKED' else 'CHANGED')
            if disp == 'BLOCKED': c['destinations'][0].update(disposition='BLOCKED', reason='blocked for grid test')
            c['readback'] = {'performed': perf, 'result': res, 'destinations_checked': nchk, 'evidence_ref': None}
            if ndest == 5: c['destinations'].pop()
            p['delta_closure'] = [c]; rehash(p); cg += 1
            safe = disp != 'BLOCKED' and perf and res == 'PASS' and nchk == 6 and ndest == 6
            if verdict(p) != safe: cbad += 1
r = 'PASS' if cbad == 0 else 'FAIL'; fails += r == 'FAIL'
out.append(f'SW-D26|{r}|{cg} closure combinations (3 dispositions x 2 performed x 3 results x 3 checked-counts x 2 destination-counts); both layers accept exactly the safe ones; mismatches: {cbad}|exhaustive closure differential|')

print('\n'.join(out)); print('TOTAL TESTS:', len(out)); print('FAILS:', fails)
