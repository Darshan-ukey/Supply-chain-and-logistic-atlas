# W1-27 A4-AMD3 design-contract test script. Run: python3 -I run_design_contract_tests.py  (needs jsonschema>=4)
# Layer 1: design-contract.schema.json. Layer 2: independent semantic validator (rules R, A, Q, C, L). Specification tests only; no backend access.
import json, copy, re
from jsonschema import Draft202012Validator as DV
schema = json.load(open('design-contract.schema.json')); DV.check_schema(schema); V = DV(schema)
BASE = json.load(open('design-contract.json'))
FROZEN = {'CONFIRMED', 'ENRICH', 'CONTEXT_SPECIFIC', 'CONTRADICTS_CURRENT_ATLAS', 'CLIENT_BINDING_REQUIRED', 'SOURCE_ACCESS_GAP', 'UNKNOWN'}
S31 = {'gap_type', 'origin_trigger', 'subject_kind', 'subject_id', 'subject_version', 'scope_class', 'owning_layer', 'route', 'router_state', 'evidence_links', 'dedupe_key', 'parent_gap_id', 'router_version', 'routing_history'}
ABS = {'TMP-AG-02': 'ABSORBED', 'TMP-AG-13': 'SPLIT', 'TMP-AG-07': 'REUSED', 'TMP-AG-08': 'REUSED', 'TMP-AG-09': 'REUSED', 'TMP-AG-10': 'REUSED'}
QA = {'QA-1': 'W1-28', 'QA-2': 'W1-29', 'QA-3': 'W1-40', 'QA-4': 'CYCLE-0 AND FIRST-LIVE-CYCLE'}
RULES = ['R01','R02','R03','R04','R05','A01','A02','A03','A04','A05','Q01','Q02','Q03','C01','C02','C03','C04','C05','C06','C07','C08','L01','L02','L03','L04','L05']

def check_ddl(stmts):
    """Deterministic RLS rule over proposed DDL text. Returns list of (code, msg)."""
    out = []
    if not stmts: out.append(('L04', 'no proposed staging DDL'))
    for s in stmts:
        u = ' '.join(s.split())
        tables = re.findall(r'CREATE TABLE (?:IF NOT EXISTS )?([A-Za-z0-9_\.]+)', u, re.I)
        if not tables: out.append(('L04', 'statement with no CREATE TABLE')); continue
        for t in tables:
            if '.' not in t: out.append(('L04', '%s is not schema-qualified' % t))
            if not re.search(r'ALTER TABLE %s ENABLE ROW LEVEL SECURITY' % re.escape(t), u, re.I): out.append(('L01', '%s lacks ENABLE ROW LEVEL SECURITY' % t))
            m = re.search(r'REVOKE ALL (?:PRIVILEGES )?ON (?:TABLE )?%s FROM ([A-Za-z_, ]+?)(?:;|$)' % re.escape(t), u, re.I)
            roles = {r.strip().lower() for r in m.group(1).split(',')} if m else set()
            if not {'anon', 'authenticated'} <= roles: out.append(('L02', '%s lacks REVOKE ALL FROM anon, authenticated' % t))
        if re.search(r'GRANT\s+(?!.*REVOKE).*?\sTO\s[^;]*\b(anon|authenticated)\b', re.sub(r'REVOKE[^;]*;', '', u, flags=re.I), re.I): out.append(('L03', 'GRANT to anon/authenticated'))
        if re.search(r'DISABLE ROW LEVEL SECURITY', u, re.I): out.append(('L03', 'DISABLE ROW LEVEL SECURITY'))
    return out

def semantic(p, off=frozenset()):
    try: return _sem(p, off)
    except (KeyError, TypeError, IndexError, AttributeError): return ['S00 structurally malformed']
def _sem(p, off):
    v = []
    def chk(code, bad, msg):
        if code not in off and bad: v.append('%s %s' % (code, msg))
    rs = p['routing_storage']; opts = rs['options']
    chk('R01', {o['option_id'] for o in opts} != {'A_ADDITIVE_COLUMNS', 'B_SIBLING_TABLE'} or len(opts) != 2, 'routing options must be exactly A_ADDITIVE_COLUMNS and B_SIBLING_TABLE')
    chk('R02', rs['kind_overloaded'] is not False or any(o['kind_use'] != 'unchanged' for o in opts), 'kind must not be overloaded')
    chk('R03', rs['unmodified_by_w1_27'] is not True or 'W1-28' not in rs['decision_owner'] or rs['decision_status'] != 'OPEN_FOR_W1_28', 'W1-27 must leave the choice to W1-28 and not alter the existing table')
    chk('R04', set(rs['required_routing_fields']) != S31, 'required routing fields differ from requirements s3.1 set (missing %s extra %s)' % (sorted(S31 - set(rs['required_routing_fields'])), sorted(set(rs['required_routing_fields']) - S31)))
    chk('R05', any(f not in o['field_homes'] or re.search(r'\b(kind column|details|context)\b', o['field_homes'][f]) for o in opts for f in S31), 'every routing field needs a home in every option, never kind, details or context')
    am = p['absorption_map']; ids = [a['item'] for a in am]
    chk('A01', len(ids) != len(set(ids)) or {a['item']: a['disposition'] for a in am} != ABS, 'absorption map must be exactly TMP-AG-02 ABSORBED, 13 SPLIT, 07/08/09/10 REUSED')
    chk('A02', any(a['separate_build'] is not False for a in am), 'no TMP-AG item may be built separately (built twice, DEC-064)')
    chk('A03', any(a['disposition'] in ('ABSORBED', 'SPLIT') and (a.get('specified_in') != ['W1-27'] or a.get('staged_in') != ['W1-28'] or a.get('dry_run_in') != ['W1-29']) for a in am), 'ABSORBED/SPLIT items need W1-27 spec, W1-28 staging, W1-29 dry run')
    chk('A04', any((a['disposition'] == 'SPLIT') != bool(a.get('v2_successor')) or (a['disposition'] == 'SPLIT' and not a.get('absorbed_part')) for a in am), 'only SPLIT carries a V2 successor and it must name the absorbed part')
    chk('A05', any(a['disposition'] == 'REUSED' and not a.get('reused_store') for a in am), 'REUSED item must name the reused store')
    q = p['qa_layer_map']; ql = [x['layer'] for x in q]
    chk('Q01', sorted(ql) != ['QA-1', 'QA-2', 'QA-3', 'QA-4'], 'QA layers must be QA-1..QA-4 exactly once')
    chk('Q02', {x['layer']: x['evidence_task'] for x in q} != QA or any((x['layer'] == 'QA-4') != (x['kind'] == 'CYCLE') for x in q), 'QA mapping must be W1-28/W1-29/W1-40 and cycle 0 plus first live cycle for QA-4')
    cr = p['closure_rule']
    chk('Q03', sorted(cr['qa_layers_required_for_capability_closure']) != ['QA-1', 'QA-2', 'QA-3', 'QA-4'] or cr['closed_on_qa1_alone'] is not False, 'closure requires all four layers; QA-1 alone never closes')
    cm = p['convergence_map']; st = [c['state'] for c in cm]; by0 = {c['state']: c for c in cm}
    class _G(dict):
        def __missing__(self, k): return {}
    by = _G(by0)
    chk('C01', len(st) != len(set(st)) or set(st) != FROZEN, 'convergence map must be total over the 7 frozen states, once each (unmapped %s)' % sorted(FROZEN - set(st)))
    chk('C02', any(c['currency_outcome'] == 'UNCHANGED' and c['state'] != 'CONFIRMED' for c in cm) or any(c['state'] == 'CONFIRMED' and c['currency_outcome'] != 'UNCHANGED' for c in cm), 'only CONFIRMED maps to UNCHANGED, and CONFIRMED must')
    chk('C03', any(by[s].get('outside_in_search') is not False for s in ('CLIENT_BINDING_REQUIRED', 'CONTEXT_SPECIFIC')), 'client-specific states are never searched outside-in')
    chk('C04', any(c['may_fill_unknown'] is not False for c in cm), 'no state may fill an unknown')
    chk('C05', by['SOURCE_ACCESS_GAP'].get('currency_outcome') != 'UNREACHABLE_OR_UNVERIFIABLE' or by['SOURCE_ACCESS_GAP'].get('gap_route') != 'SOURCE_FOUNDATION', 'SOURCE_ACCESS_GAP is UNREACHABLE_OR_UNVERIFIABLE routed to SOURCE_FOUNDATION')
    chk('C06', by['CLIENT_BINDING_REQUIRED'].get('gap_route') != 'CLIENT_BINDING' or by['CLIENT_BINDING_REQUIRED'].get('terminal_blocker') is not True, 'CLIENT_BINDING_REQUIRED routes to CLIENT_BINDING as a terminal blocker')
    chk('C07', by['UNKNOWN'].get('gap_route') != 'DEFERRED_OR_UNROUTED' or by['CONFIRMED'].get('gap_route') != 'NONE' or any(c['terminal_blocker'] and c['state'] != 'CLIENT_BINDING_REQUIRED' for c in cm), 'UNKNOWN is deferred or unrouted; CONFIRMED has no route; only CLIENT_BINDING_REQUIRED is a terminal blocker')
    chk('C08', by['CONTRADICTS_CURRENT_ATLAS'].get('approval') != 'ADMIN_AND_INDEPENDENT_VALIDATION' or by['SOURCE_ACCESS_GAP'].get('approval') == 'NONE_RECORD_ONLY', 'contradictions need admin approval and independent validation')
    rl = p['rls_rule']
    errs = check_ddl(rl['proposed_staging_ddl'])
    for code in ('L01', 'L02', 'L03', 'L04'): chk(code, any(c == code for c, _ in errs), '; '.join(m for c, m in errs if c == code))
    chk('L05', len(rl['readback_required']) < 2 or 'relrowsecurity' not in ' '.join(rl['readback_required']) or 'anon' not in ' '.join(rl['readback_required']), 'readback must prove relrowsecurity and absence of anon/authenticated privileges')
    return v

def schema_ok(p): return not list(V.iter_errors(p))
def verdict(p): return schema_ok(p) and not semantic(p)
results = []
def rec(tid, ok, what, note): results.append((tid, 'PASS' if ok else 'FAIL', what, note))
def mut(f):
    p = copy.deepcopy(BASE); f(p); return p
def cmap(p, state): return next(c for c in p['convergence_map'] if c['state'] == state)
def amap(p, item): return next(a for a in p['absorption_map'] if a['item'] == item)

rec('DC-D01', verdict(BASE), 'baseline contract valid (schema and semantic)', 'schema errors %d semantic %s' % (len(list(V.iter_errors(BASE))), semantic(BASE)))
rec('DC-D02', check_ddl(BASE['rls_rule']['proposed_staging_ddl']) == [], 'proposed staging DDL passes the RLS checker', str(check_ddl(BASE['rls_rule']['proposed_staging_ddl'])))
rec('DC-D03', len(BASE['routing_storage']['options']) == 2 and BASE['routing_storage']['decision_status'] == 'OPEN_FOR_W1_28', 'two routing options recorded, choice open for W1-28', 'no option chosen')
good = 'CREATE TABLE s.t (a int);\nALTER TABLE s.t ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON s.t FROM anon, authenticated;'
rec('DC-D04', check_ddl([good]) == [], 'minimal compliant DDL accepted', '')
rec('DC-D05', check_ddl([good + '\n' + good.replace('s.t', 's.u')]) == [] and len(check_ddl([good, good.replace('s.t', 's.u')])) == 0, 'two compliant statements accepted', '')

N = []  # (id, mutator-or-ddl, intended rule, layer 'sem' or 'ddl', description)
def addN(i, f, rule, desc): N.append((i, f, rule, desc))
addN('DC-N01', lambda p: p['routing_storage']['options'].pop(), 'R01', 'only one routing option')
addN('DC-N02', lambda p: p['routing_storage'].update(kind_overloaded=True), 'R02', 'kind overloaded')
addN('DC-N03', lambda p: p['routing_storage']['options'][0].update(kind_use='store route in kind'), 'R02', 'option reuses kind')
addN('DC-N04', lambda p: p['routing_storage'].update(decision_status='CHOSEN_A'), 'R03', 'W1-27 pre-empts the W1-28 decision')
addN('DC-N05', lambda p: p['routing_storage'].update(unmodified_by_w1_27=False), 'R03', 'existing table altered')
addN('DC-N06', lambda p: p['routing_storage']['required_routing_fields'].remove('scope_class'), 'R04', 'scope_class dropped from required fields')
addN('DC-N07', lambda p: p['routing_storage']['options'][1]['field_homes'].pop('router_version'), 'R05', 'option B has no home for router_version')
addN('DC-N08', lambda p: p['routing_storage']['options'][0]['field_homes'].update(owning_layer='stored in details jsonb'), 'R05', 'owning_layer hidden in details jsonb')
addN('DC-N09', lambda p: p['absorption_map'].pop(0), 'A01', 'TMP-AG-02 missing')
addN('DC-N10', lambda p: amap(p, 'TMP-AG-13').update(disposition='ABSORBED', v2_successor=None), 'A01', 'TMP-AG-13 not split')
addN('DC-N11', lambda p: amap(p, 'TMP-AG-02').update(separate_build=True), 'A02', 'TMP-AG-02 built separately')
addN('DC-N12', lambda p: amap(p, 'TMP-AG-02').update(dry_run_in=['W1-30']), 'A03', 'dry run not in W1-29')
addN('DC-N13', lambda p: amap(p, 'TMP-AG-13').update(v2_successor=None), 'A04', 'SPLIT without V2 successor')
addN('DC-N14', lambda p: amap(p, 'TMP-AG-07').update(reused_store=''), 'A05', 'REUSED without store')
addN('DC-N15', lambda p: p['qa_layer_map'].pop(), 'Q01', 'QA-4 missing')
addN('DC-N16', lambda p: p['qa_layer_map'][0].update(evidence_task='W1-29'), 'Q02', 'QA-1 mapped to W1-29')
addN('DC-N17', lambda p: p['qa_layer_map'][3].update(kind='TASK'), 'Q02', 'QA-4 treated as a task')
addN('DC-N18', lambda p: p['closure_rule'].update(closed_on_qa1_alone=True), 'Q03', 'closure on QA-1 alone')
addN('DC-N19', lambda p: p['closure_rule']['qa_layers_required_for_capability_closure'].remove('QA-4'), 'Q03', 'QA-4 not required for closure')
addN('DC-N20', lambda p: p['convergence_map'].pop(5), 'C01', 'SOURCE_ACCESS_GAP unmapped')
addN('DC-N21', lambda p: p['convergence_map'].append(copy.deepcopy(p['convergence_map'][0])), 'C01', 'duplicate CONFIRMED mapping')
addN('DC-N22', lambda p: cmap(p, 'SOURCE_ACCESS_GAP').update(currency_outcome='UNCHANGED'), 'C02', 'access gap reported UNCHANGED')
addN('DC-N23', lambda p: cmap(p, 'CLIENT_BINDING_REQUIRED').update(outside_in_search=True), 'C03', 'client binding researched outside-in')
addN('DC-N24', lambda p: cmap(p, 'CONTEXT_SPECIFIC').update(outside_in_search=True), 'C03', 'context-specific researched outside-in')
addN('DC-N25', lambda p: cmap(p, 'UNKNOWN').update(may_fill_unknown=True), 'C04', 'unknown may be filled')
addN('DC-N26', lambda p: cmap(p, 'SOURCE_ACCESS_GAP').update(gap_route='DEFERRED_OR_UNROUTED'), 'C05', 'access gap not routed to SOURCE_FOUNDATION')
addN('DC-N27', lambda p: cmap(p, 'CLIENT_BINDING_REQUIRED').update(terminal_blocker=False), 'C06', 'client binding not a terminal blocker')
addN('DC-N28', lambda p: cmap(p, 'CLIENT_BINDING_REQUIRED').update(gap_route='LAYER_BY_PLACEMENT'), 'C06', 'client binding routed by placement')
addN('DC-N29', lambda p: cmap(p, 'UNKNOWN').update(gap_route='LAYER_BY_PLACEMENT'), 'C07', 'unknown routed as a resolvable gap')
addN('DC-N30', lambda p: cmap(p, 'ENRICH').update(terminal_blocker=True), 'C07', 'ENRICH marked terminal blocker')
addN('DC-N31', lambda p: cmap(p, 'CONTRADICTS_CURRENT_ATLAS').update(approval='ADMIN_UNLESS_ALLOWLISTED'), 'C08', 'contradiction auto-approvable')
addN('DC-N32', lambda p: cmap(p, 'CONFIRMED').update(currency_outcome='NOT_APPLICABLE'), 'C02', 'CONFIRMED not mapped to UNCHANGED')
DDLN = [
 ('DC-N33', ['CREATE TABLE atlas_stg_v73.t (a int);\nREVOKE ALL ON atlas_stg_v73.t FROM anon, authenticated;'], 'L01', 'table without ENABLE RLS'),
 ('DC-N34', ['CREATE TABLE atlas_stg_v73.t (a int);\nALTER TABLE atlas_stg_v73.t ENABLE ROW LEVEL SECURITY;'], 'L02', 'table without REVOKE'),
 ('DC-N35', ['CREATE TABLE atlas_stg_v73.t (a int);\nALTER TABLE atlas_stg_v73.t ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON atlas_stg_v73.t FROM anon;'], 'L02', 'REVOKE only from anon'),
 ('DC-N36', ['CREATE TABLE atlas_stg_v73.t (a int);\nALTER TABLE atlas_stg_v73.t ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON atlas_stg_v73.t FROM anon, authenticated;\nGRANT SELECT ON atlas_stg_v73.t TO anon;'], 'L03', 'GRANT SELECT to anon'),
 ('DC-N37', ['CREATE TABLE atlas_stg_v73.t (a int);\nALTER TABLE atlas_stg_v73.t ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON atlas_stg_v73.t FROM anon, authenticated;\nGRANT ALL ON atlas_stg_v73.t TO authenticated;'], 'L03', 'GRANT ALL to authenticated'),
 ('DC-N38', ['CREATE TABLE atlas_stg_v73.t (a int);\nALTER TABLE atlas_stg_v73.t ENABLE ROW LEVEL SECURITY;\nALTER TABLE atlas_stg_v73.t DISABLE ROW LEVEL SECURITY;\nREVOKE ALL ON atlas_stg_v73.t FROM anon, authenticated;'], 'L03', 'RLS enabled then disabled'),
 ('DC-N39', ['CREATE TABLE t (a int);\nALTER TABLE t ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON t FROM anon, authenticated;'], 'L04', 'unqualified table name'),
 ('DC-N40', [], 'L04', 'no proposed DDL'),
 ('DC-N41', ['CREATE TABLE atlas_stg_v73.t1 (a int); CREATE TABLE atlas_stg_v73.t2 (a int);\nALTER TABLE atlas_stg_v73.t1 ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON atlas_stg_v73.t1 FROM anon, authenticated;'], 'L01', 'two tables in one statement, one without RLS'),
 ('DC-N42', ['CREATE TABLE atlas_stg_v73.t (a int);\nALTER TABLE atlas_stg_v73.t ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON atlas_stg_v73.t FROM public;'], 'L02', 'REVOKE from public only'),
]
for i, f, rule, desc in N:
    p = mut(f); sch = schema_ok(p); sem = semantic(p)
    codes = sorted({s.split()[0] for s in sem})
    ok = (not sch or rule in codes) and (rule in codes or not sch) and not verdict(p)
    ok = ok and (rule in codes)
    rec(i, ok, desc, 'schema_ok %s; semantic codes %s; intended %s' % (sch, codes, rule))
for i, ddl, rule, desc in DDLN:
    p = mut(lambda q, d=ddl: q['rls_rule'].update(proposed_staging_ddl=d))
    if not ddl: sch_ok = not schema_ok(p)  # schema minItems 1 also rejects; semantic must too via L04
    codes = sorted({s.split()[0] for s in semantic(p)}) if ddl else sorted({c for c, _ in check_ddl(ddl)})
    ok = (rule in codes) and not verdict(p)
    rec(i, ok, desc, 'codes %s; intended %s; verdict accepts: %s' % (codes, rule, verdict(p)))
rec('DC-N43', not schema_ok(mut(lambda p: p['convergence_map'][0].update(state='MAYBE'))), 'unknown convergence state rejected by schema', '')
rec('DC-N44', not schema_ok(mut(lambda p: p.update(extra_field=1))), 'additional root property rejected by schema', '')
rec('DC-N45', not schema_ok(mut(lambda p: p['qa_layer_map'][0].update(layer='QA-5'))), 'QA-5 rejected by schema', '')
fired = set()
for i, f, rule, desc in N: fired |= {s.split()[0] for s in semantic(mut(f))}
for i, ddl, rule, desc in DDLN: fired |= {s.split()[0] for s in semantic(mut(lambda q, d=ddl: q['rls_rule'].update(proposed_staging_ddl=d)))}
dead = [r for r in RULES if r not in fired and r != 'L05']
rec('DC-D06', not dead, 'every semantic rule fires on at least one negative fixture (L05 covered separately)', 'never fired: %s' % dead)
p = mut(lambda q: q['rls_rule'].update(readback_required=['relrowsecurity true']))
rec('DC-N46', 'L05' in {s.split()[0] for s in semantic(p)} and not verdict(p), 'readback missing anon/authenticated privilege proof', '')
bad = []
for i, f, rule, desc in N:
    p = mut(f)
    if rule in {s.split()[0] for s in semantic(p, off=frozenset([rule]))}: bad.append(i)
rec('DC-D07', not bad, 'rule-switch mutation: with its intended rule disabled the negative no longer reports that rule', 'offenders: %s' % bad)
unsafe_accepts = 0
for i, f, rule, desc in N:
    if verdict(mut(f)): unsafe_accepts += 1
rec('DC-D08', unsafe_accepts == 0, 'no negative fixture is accepted by both layers combined', 'unsafe accepts: %d' % unsafe_accepts)
m = 0
for i, f, rule, desc in N:
    if not semantic(mut(f), off=frozenset(RULES)) : m += 1
rec('DC-D09', m == len(N) , 'mutation check: with all semantic rules disabled every negative semantic-only fixture is accepted by the semantic layer (guards are what reject)', 'accepted without guards: %d of %d' % (m, len(N)))
for r in results: print('|'.join(r))
print('TOTAL TESTS:', len(results)); print('FAILS:', sum(1 for r in results if r[1] == 'FAIL'))
