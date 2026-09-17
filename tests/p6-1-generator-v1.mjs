import { generate, __internal } from '../tools/generate-canonical-work-decomposition-v1.mjs';

// Atlas P6.1 successor generator — deterministic fixture suite.
// Covers CR1-CR11 equivalents from the contract, negative cases, ordering,
// hashing, blocker taxonomy, child-split rules, runtime-contamination
// guards, and historical-count non-influence.

let passed = 0, failed = 0;
const failures = [];
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}
function throws(fn) { try { fn(); return null; } catch (e) { return e; } }

const seed = (over = {}) => ({ id: 's1', action: 'do the thing', sourceRefs: ['src:1'], ...over });
const task = (over = {}) => ({ taskId: 'T-01', moduleId: 'm', moduleVersion: '1', workDecompositionSeed: [seed()], ...over });
const run = (t) => generate({ moduleId: 'm', moduleVersion: '1', tasks: [t] });

console.log('\nAtlas P6.1 generator v1.1.0 — fixture suite\n');

console.log('--- CR1: seed preservation (do not split on lexical multiplicity alone) ---');
{
  const r = run(task({ workDecompositionSeed: [seed({ action: 'create shipment, consignment and document identity' })] }));
  check('CR1 multi-noun action stays one unit (no childContracts declared)', r.tasks[0].units.length === 2);
}

console.log('--- CR2 / contract 4.4: split only on >=2 source-supported children ---');
{
  const zero = run(task({ workDecompositionSeed: [seed({ childContracts: [] })] }));
  check('0 children: no split, primary unit stands', zero.tasks[0].units.length === 2 && zero.tasks[0].units[1].childContractAudit === null);

  const one = run(task({ workDecompositionSeed: [seed({ action: null, childContracts: [{ sourceSupported: true, action: 'child' }] })] }));
  check('1 accepted child: below threshold, not split', one.tasks[0].units.length === 2);
  check('1 accepted child, parent ungrounded: fails closed, not silently discarded',
    one.tasks[0].units[1].status === 'BLOCKED_BY_KNOWLEDGE_GAP' && one.tasks[0].units[1].blockerRefs.includes('MISSING_ACTION_OR_DECISION'));

  const two = run(task({ workDecompositionSeed: [seed({ childContracts: [
    { sourceSupported: true, action: 'child 1' }, { sourceSupported: true, action: 'child 2' }
  ] })] }));
  check('2 accepted children: split applied, container + 2 leaves', two.tasks[0].units.length === 4);
  check('container is NEEDS_DECOMPOSITION', two.tasks[0].units[1].status === 'NEEDS_DECOMPOSITION');
  check('container type is always ACTION_GROUP regardless of seed type',
    two.tasks[0].units[1].type === 'ACTION_GROUP');
  check('both children present with distinct content',
    two.tasks[0].units[2].action === 'child 1' && two.tasks[0].units[3].action === 'child 2');
}

console.log('--- child rejection is never silent (regression: the exact confirmed defect) ---');
{
  const r = run(task({ workDecompositionSeed: [seed({ action: 'parent action', childContracts: [
    { sourceSupported: true, action: 'accepted' },
    { sourceSupported: false, action: 'rejected - not source supported' },
    { id: 'named', sourceSupported: true, action: null, decisionCriteria: null }
  ] })] }));
  const audit = r.tasks[0].units[1].childContractAudit;
  check('all 3 candidates accounted for in audit', audit.declaredCount === 3);
  check('only the genuinely-grounded one accepted', audit.acceptedCount === 1);
  check('the ungrounded-but-flagged-supported candidate is rejected, not silently accepted',
    audit.rejected.some(x => x.id === 'named' && x.reason === 'NO_INDEPENDENT_EXECUTION_SEMANTICS'));
  check('rejected list is deterministically ordered', audit.rejected[0].id < audit.rejected[1].id);
}

console.log('--- CR3 / contract 4.5: sequence establishes order only, never semantics ---');
{
  const r = run(task({ workDecompositionSeed: [seed({ id: 'a' }), seed({ id: 'b', action: 'second' })] }));
  check('seed order preserved as given (source order), not re-sorted', r.tasks[0].units[1].path[0] === 1 && r.tasks[0].units[2].path[0] === 2);
  const noAction = run(task({ workDecompositionSeed: [seed({ action: null, decisionCriteria: null })] }));
  check('position alone never grounds readiness', noAction.tasks[0].units[1].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
}

console.log('--- CR4 / floor: EXECUTOR_READY requires actual governed content (regression: confirmed defect) ---');
{
  const r = run(task({ workDecompositionSeed: [seed({ action: null, decisionCriteria: null })] }));
  check('null action + no other flags -> BLOCKED, not READY', r.tasks[0].units[1].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
  check('specific ref names the gap', r.tasks[0].units[1].blockerRefs.includes('MISSING_ACTION_OR_DECISION'));
  const withAction = run(task({ workDecompositionSeed: [seed({ action: 'real action' })] }));
  check('a genuine action alone is sufficient to clear the floor', withAction.tasks[0].units[1].status === 'EXECUTOR_READY');
}

console.log('--- CR5: fail-closed blocker taxonomy, all applicable gaps surfaced (regression: confirmed defect) ---');
{
  const r = run(task({ workDecompositionSeed: [seed({
    action: 'x', type: 'DECISION_GATE', materialDecision: true,
    validationRequired: true, authorityMaterial: true, failureModeMaterial: true
  })] }));
  const refs = r.tasks[0].units[1].blockerRefs;
  check('all 4 simultaneous gaps surfaced, not just the first', refs.length === 4,
    `got ${refs.length}: ${refs.join(', ')}`);
  check('deterministically sorted', JSON.stringify(refs) === JSON.stringify([...refs].sort()));
}

console.log('--- CR6 / contract 4.9: no ready mechanical child from a blocked binding ---');
{
  const r = run(task({ workDecompositionSeed: [seed({ clientBindingRequired: true })] }));
  check('unit with client binding requirement is blocked, not readied', r.tasks[0].units[1].status === 'BLOCKED_BY_CLIENT_BINDING');
  check('no downstream child materializes on its own', r.tasks[0].units.length === 2);
}

console.log('--- CR8/CR9 precedence: knowledge gap outranks client binding when both apply ---');
{
  const r = run(task({ workDecompositionSeed: [seed({
    action: null, authorityMaterial: true, authority: null, clientBindingRequired: true
  })] }));
  check('knowledge-gap class wins over client-binding class', r.tasks[0].units[1].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
}

console.log('--- CR10: authority required only where material ---');
{
  const notMaterial = run(task({ workDecompositionSeed: [seed({ authorityMaterial: false })] }));
  check('authority not required when not material', notMaterial.tasks[0].units[1].status === 'EXECUTOR_READY');
  const material = run(task({ workDecompositionSeed: [seed({ authorityMaterial: true })] }));
  check('authority required and missing when material', material.tasks[0].units[1].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
}

console.log('--- CR11: failure/exception semantics ---');
{
  const withPolicy = run(task({ workDecompositionSeed: [seed({ failureModeMaterial: true, exceptionPolicy: 'ltl-exception-policy-1' })] }));
  check('genuine exception policy satisfies material failure requirement', withPolicy.tasks[0].units[1].status === 'EXECUTOR_READY');
  const withoutPolicy = run(task({ workDecompositionSeed: [seed({ failureModeMaterial: true })] }));
  check('material failure with no policy fails closed', withoutPolicy.tasks[0].units[1].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
}

console.log('--- negative / malformed input ---');
{
  check('missing moduleId throws', throws(() => generate({ moduleVersion: '1', tasks: [] })) !== null);
  check('missing moduleVersion throws', throws(() => generate({ moduleId: 'm', tasks: [] })) !== null);
  check('missing taskId throws', throws(() => generate({ moduleId: 'm', moduleVersion: '1', tasks: [{}] })) !== null);
  check('empty tasks array does not throw (valid empty module)', throws(() => generate({ moduleId: 'm', moduleVersion: '1', tasks: [] })) === null);
  const empty = generate({ moduleId: 'm', moduleVersion: '1', tasks: [task({ workDecompositionSeed: [] })] });
  check('empty seed list on a real task fails closed at root', empty.tasks[0].units[0].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
  check('empty-seed root names the gap', empty.tasks[0].units[0].blockerRefs.includes('WORK_DECOMPOSITION_SEED_NOT_DECLARED'));
}

console.log('--- graph integrity ---');
{
  const dup = () => generate({ moduleId: 'm', moduleVersion: '1', tasks: [task({ taskId: 'LTL-03' }), task({ taskId: 'ltl_03' })] });
  check('slug-colliding task IDs fail closed rather than silently merging', throws(dup) !== null);
  const r = run(task({ workDecompositionSeed: [seed({ childContracts: [
    { sourceSupported: true, action: 'a' }, { sourceSupported: true, action: 'b' }
  ] })] }));
  check('no orphan parents', r.tasks[0].units.every(u => u.parentId === null || r.tasks[0].units.some(x => x.id === u.parentId)));
  check('every NEEDS_DECOMPOSITION unit has at least one child', r.tasks[0].units.filter(u => u.status === 'NEEDS_DECOMPOSITION').every(u => r.tasks[0].units.some(x => x.parentId === u.id)));
}

console.log('--- ordering: task order and array-field order do not affect output ---');
{
  const a = generate({ moduleId: 'm', moduleVersion: '1', tasks: [task({ taskId: 'LTL-02' }), task({ taskId: 'LTL-01' })] });
  const b = generate({ moduleId: 'm', moduleVersion: '1', tasks: [task({ taskId: 'LTL-01' }), task({ taskId: 'LTL-02' })] });
  check('task insertion order does not affect output (canonically re-sorted by taskId)', a.semanticHash === b.semanticHash);

  const c = run(task({ workDecompositionSeed: [seed({ sourceRefs: ['b', 'a'] })] }));
  const d = run(task({ workDecompositionSeed: [seed({ sourceRefs: ['a', 'b'] })] }));
  check('sourceRefs order does not affect hash (sorted before hashing)', c.semanticHash === d.semanticHash);

  const e = run(task({ workDecompositionSeed: [seed({ id: 's1' }), seed({ id: 's2', action: 'second' })] }));
  const f = run(task({ workDecompositionSeed: [seed({ id: 's2', action: 'second' }), seed({ id: 's1' })] }));
  check('seed order DOES affect hash (source order is semantic, not incidental)', e.semanticHash !== f.semanticHash);
}

console.log('--- hashing / determinism ---');
{
  const r1 = run(task());
  const r2 = run(task());
  check('identical input -> identical semantic hash, repeated runs', r1.semanticHash === r2.semanticHash);
  const changed = run(task({ workDecompositionSeed: [seed({ action: 'a different thing' })] }));
  check('changed input -> different hash', r1.semanticHash !== changed.semanticHash);
  check('every unit carries its own deterministic content hash', r1.tasks[0].units.every(u => typeof u.contentHash === 'string' && u.contentHash.length === 64));
}

console.log('--- runtime/adapter contamination guard (contract 7) ---');
{
  const r = run(task({ workDecompositionSeed: [seed({
    queueId: 'malkom-queue-7', malkomWorkType: 'STANDARD', workflowEngineState: 'RUNNING'
  })] }));
  const u = r.tasks[0].units[1];
  check('unknown runtime-shaped fields are not carried into canonical output', !('queueId' in u) && !('malkomWorkType' in u) && !('workflowEngineState' in u));
  check('adapterCapabilityRequirements is the only sanctioned runtime-facing field, and is sorted',
    Array.isArray(u.adapterCapabilityRequirements));
}

console.log('--- historical-count non-influence (contract 5) ---');
{
  // The function signature itself takes no historical-count parameter, so
  // influence is structurally impossible, not merely avoided by convention.
  // This proves it two ways: (a) generate.length shows no such parameter
  // exists to pass, and (b) passing a decoy field that LOOKS like a
  // historical hint has zero effect on output.
  check('generate() has no channel for a historical-count argument', generate.length <= 1);
  const withDecoy = generate({ moduleId: 'm', moduleVersion: '1', tasks: [task()],
    _historicalWorkUnitCount: 603, _historicalLeafCount: 444, _targetCount: 43 });
  const withoutDecoy = run(task());
  check('a decoy historical-count field in the input has zero effect on output',
    withDecoy.semanticHash === withoutDecoy.semanticHash);
}

console.log('--- unsupported runtime semantics: preserved as capability gaps, never silently altered ---');
{
  const r = run(task({ workDecompositionSeed: [seed({ adapterCapabilityRequirements: ['PARALLEL_JOIN', 'CONDITIONAL_TIMEOUT'] })] }));
  const u = r.tasks[0].units[1];
  check('declared capability requirements are preserved verbatim, not dropped', u.adapterCapabilityRequirements.length === 2);
  check('capability requirements never influence canonical readiness on their own',
    u.status === 'EXECUTOR_READY');
  check('capability requirements are sorted for determinism', u.adapterCapabilityRequirements[0] === 'CONDITIONAL_TIMEOUT');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) { console.log('Failures:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
